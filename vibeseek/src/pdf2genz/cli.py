import argparse
import os
from pathlib import Path

from dotenv import load_dotenv

from pdf2genz.config import PipelineConfig
from pdf2genz.pipeline import PDFToVideoPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert PDF to short Gen Z videos.")
    parser.add_argument("--pdf", required=True, help="Input PDF path")
    parser.add_argument("--output-dir", default="outputs", help="Output directory")
    parser.add_argument("--work-dir", default=".work", help="Temp/cache directory")
    parser.add_argument("--bg-video", default="assets/background.mp4", help="Background mp4 path")
    parser.add_argument("--videos", default=10, type=int, help="Max videos per PDF")
    parser.add_argument("--dry-run", action="store_true", help="Skip TTS/video rendering")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    cfg = PipelineConfig(
        pdf_path=Path(args.pdf),
        output_dir=Path(args.output_dir),
        work_dir=Path(args.work_dir),
        bg_video_path=Path(args.bg_video),
        videos_per_pdf=args.videos,
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
        dry_run=args.dry_run,
    )
    pipeline = PDFToVideoPipeline(cfg)
    assets = pipeline.run()
    print(f"Done. Generated {len(assets)} video(s).")
    for item in assets:
        print(f"- {item.mp4_path}")


if __name__ == "__main__":
    main()

