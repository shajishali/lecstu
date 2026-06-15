#!/usr/bin/env python3
"""
CLI entry point for ASR transcription.
Invoked by Node server: python run_transcribe.py --file <path> --language en --engine whisper --model base
Outputs JSON to stdout.
"""
import argparse
import json
import sys
from pathlib import Path

# Ensure ai-services/asr is on path when run from project root or asr dir
_script_dir = Path(__file__).resolve().parent
if str(_script_dir) not in sys.path:
    sys.path.insert(0, str(_script_dir))

from asr_service import transcribe


def main():
    parser = argparse.ArgumentParser(description="ASR transcription CLI")
    parser.add_argument("--file", required=True, help="Path to audio file (WAV, MP3, etc.)")
    parser.add_argument("--language", default="en", help="Language code: en, ta, si")
    parser.add_argument("--engine", default="whisper", choices=["whisper", "whisper-finetuned", "google", "azure"])
    parser.add_argument("--model", default="base", help="Whisper model: tiny, base, small, medium")
    args = parser.parse_args()

    if not Path(args.file).exists():
        print(json.dumps({"text": "", "confidence": 0, "latency_ms": 0, "error": "File not found"}))
        sys.exit(1)

    result = transcribe(
        audio_path=args.file,
        language=args.language,
        engine_name=args.engine,
        model_size=args.model if args.engine == "whisper" else None,
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
