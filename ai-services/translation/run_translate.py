#!/usr/bin/env python3
"""
CLI entry point for translation.
Invoked by Node server or directly: python run_translate.py --text "Hello" --src en --tgt ta --engine google
Outputs JSON to stdout.
"""
import argparse
import json
import sys
from pathlib import Path

_script_dir = Path(__file__).resolve().parent
if str(_script_dir) not in sys.path:
    sys.path.insert(0, str(_script_dir))

from translation_service import translate


def main():
    parser = argparse.ArgumentParser(description="Translation CLI")
    parser.add_argument("--text", required=True, help="Text to translate")
    parser.add_argument("--src", default="en", help="Source language: en, ta, si")
    parser.add_argument("--tgt", default="ta", help="Target language: en, ta, si")
    parser.add_argument("--engine", default="google", choices=["google", "azure", "marian", "mbart"], help="Translation engine")
    args = parser.parse_args()

    result = translate(text=args.text, src_lang=args.src, tgt_lang=args.tgt, engine=args.engine)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
