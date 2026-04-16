import hashlib
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

from pdf2genz.config import PipelineConfig
from pdf2genz.models import LessonChunk, ScriptCandidate
from pdf2genz.prompts import SYSTEM_PROMPT, build_user_prompt
from pdf2genz.providers import LLMProvider, OllamaProvider, OpenRouterProvider
from pdf2genz.quality import validate_genz_quality


@dataclass
class RenderedAsset:
    script: ScriptCandidate
    wav_path: Path
    srt_path: Path
    mp4_path: Path


class PDFToVideoPipeline:
    def __init__(self, cfg: PipelineConfig) -> None:
        self.cfg = cfg
        self.cfg.output_dir.mkdir(parents=True, exist_ok=True)
        self.cfg.work_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = self.cfg.work_dir / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.providers = self._init_providers()

    def _init_providers(self) -> list[LLMProvider]:
        providers: list[LLMProvider] = []
        for name in self.cfg.llm_order:
            if name == "ollama":
                providers.append(OllamaProvider(self.cfg))
            elif name == "openrouter" and self.cfg.openrouter_api_key:
                providers.append(OpenRouterProvider(self.cfg))
        return providers

    def run(self) -> list[RenderedAsset]:
        chunks = self._extract_and_chunk()
        selected = chunks[: self.cfg.videos_per_pdf]
        results: list[RenderedAsset] = []
        for chunk in selected:
            script = self._generate_script_with_cache(chunk)
            self._validate_script(script)
            wav_path = self._synthesize_voice(chunk.index, script.voiceover)
            srt_path = self._make_subtitle(chunk.index, script.voiceover)
            mp4_path = self._render_video(chunk.index, wav_path, srt_path)
            results.append(RenderedAsset(script=script, wav_path=wav_path, srt_path=srt_path, mp4_path=mp4_path))
        return results

    def _extract_and_chunk(self) -> list[LessonChunk]:
        all_text: list[str] = []
        with pdfplumber.open(self.cfg.pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    all_text.append(page_text.strip())
        text = "\n".join(all_text)
        if not text:
            raise ValueError("No text extracted from PDF.")

        paragraphs = [x.strip() for x in text.split("\n\n") if x.strip()]
        chunks: list[LessonChunk] = []
        bucket = ""
        chunk_idx = 1
        for para in paragraphs:
            if len(bucket) + len(para) + 2 <= self.cfg.max_chunk_chars:
                bucket = f"{bucket}\n\n{para}".strip()
                continue
            chunks.append(LessonChunk(index=chunk_idx, title=f"Chunk {chunk_idx}", text=bucket))
            chunk_idx += 1
            bucket = para

        if bucket:
            chunks.append(LessonChunk(index=chunk_idx, title=f"Chunk {chunk_idx}", text=bucket))
        return chunks

    def _generate_script_with_cache(self, chunk: LessonChunk) -> ScriptCandidate:
        prompt = build_user_prompt(
            chunk_title=chunk.title,
            chunk_text=chunk.text,
            min_words=self.cfg.min_words_per_script,
            max_words=self.cfg.max_words_per_script,
        )
        key = hashlib.sha256(f"{chunk.text}|{self.cfg.max_words_per_script}|v1".encode("utf-8")).hexdigest()
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            return ScriptCandidate.model_validate_json(cache_file.read_text(encoding="utf-8"))

        errors: list[str] = []
        for provider in self.providers:
            try:
                script = provider.generate(SYSTEM_PROMPT, prompt)
                cache_file.write_text(script.model_dump_json(indent=2), encoding="utf-8")
                return script
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))

        raise RuntimeError(f"All providers failed for chunk {chunk.index}: {' | '.join(errors)}")

    def _validate_script(self, script: ScriptCandidate) -> None:
        if not script.hook or not script.cta:
            raise ValueError("Missing hook or CTA.")
        result = validate_genz_quality(
            script=script,
            min_words=self.cfg.min_words_per_script,
            max_words=self.cfg.max_words_per_script,
        )
        if not result.passed:
            raise ValueError(f"Script quality failed: {', '.join(result.reasons)}")

    def _synthesize_voice(self, idx: int, text: str) -> Path:
        wav_path = self.cfg.output_dir / f"{idx:02d}.wav"
        if self.cfg.dry_run:
            wav_path.write_bytes(b"")
            return wav_path
        cmd = [
            self.cfg.piper_bin,
            "--model",
            self.cfg.piper_voice,
            "--output_file",
            str(wav_path),
        ]
        subprocess.run(cmd, input=text, text=True, check=True)
        return wav_path

    def _make_subtitle(self, idx: int, text: str) -> Path:
        srt_path = self.cfg.output_dir / f"{idx:02d}.srt"
        words = text.split()
        lines: list[str] = []
        block_words = 8
        total_blocks = max(1, math.ceil(len(words) / block_words))
        sec_per_block = 3.2
        for i in range(total_blocks):
            start = i * sec_per_block
            end = (i + 1) * sec_per_block
            seg = words[i * block_words : (i + 1) * block_words]
            if not seg:
                continue
            lines.append(str(i + 1))
            lines.append(f"{self._srt_ts(start)} --> {self._srt_ts(end)}")
            lines.append(" ".join(seg))
            lines.append("")
        srt_path.write_text("\n".join(lines), encoding="utf-8")
        return srt_path

    def _render_video(self, idx: int, wav_path: Path, srt_path: Path) -> Path:
        out_path = self.cfg.output_dir / f"{idx:02d}.mp4"
        if self.cfg.dry_run:
            out_path.write_bytes(b"")
            return out_path
        vf = (
            f"subtitles={srt_path.as_posix()}:force_style="
            "'Fontsize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BorderStyle=1,Outline=2,MarginV=48'"
        )
        cmd = [
            self.cfg.ffmpeg_bin,
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(self.cfg.bg_video_path),
            "-i",
            str(wav_path),
            "-shortest",
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            str(out_path),
        ]
        subprocess.run(cmd, check=True)
        return out_path

    @staticmethod
    def _srt_ts(seconds: float) -> str:
        ms = int((seconds % 1) * 1000)
        secs = int(seconds) % 60
        mins = int(seconds // 60) % 60
        hours = int(seconds // 3600)
        return f"{hours:02d}:{mins:02d}:{secs:02d},{ms:03d}"

