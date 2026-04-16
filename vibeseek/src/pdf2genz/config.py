from pathlib import Path

from pydantic import BaseModel, Field


class PipelineConfig(BaseModel):
    pdf_path: Path
    output_dir: Path = Field(default=Path("outputs"))
    work_dir: Path = Field(default=Path(".work"))
    max_chunk_chars: int = 1400
    max_words_per_script: int = 160
    min_words_per_script: int = 90
    videos_per_pdf: int = 10
    bg_video_path: Path = Field(default=Path("assets/background.mp4"))
    llm_order: list[str] = Field(default_factory=lambda: ["ollama", "openrouter"])
    ollama_model: str = "qwen2.5:7b-instruct"
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct:free"
    openrouter_api_key: str | None = None
    piper_voice: str = "vi_VN-vais1000-medium.onnx"
    ffmpeg_bin: str = "ffmpeg"
    piper_bin: str = "piper"
    dry_run: bool = False

