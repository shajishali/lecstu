#!/usr/bin/env python3
"""
Package evaluator-facing files (no answer key) into a zip for distribution.

Usage:
  python package_evaluator_bundle.py
  python package_evaluator_bundle.py --output ~/Desktop/lecstu-human-eval.zip
"""
from __future__ import annotations

import argparse
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RESEARCH_DIR = SCRIPT_DIR.parent.parent
HUMAN_EVAL_DIR = RESEARCH_DIR / "datasets" / "translation" / "human-eval"
DEFAULT_ZIP = HUMAN_EVAL_DIR / "lecstu-human-eval-bundle.zip"

EVALUATOR_FILES = [
    "INSTRUCTIONS.md",
    "human_eval_form.csv",
    "rater_template.csv",
]


def main():
    parser = argparse.ArgumentParser(description="Zip human-eval files for evaluators")
    parser.add_argument("--output", type=Path, default=DEFAULT_ZIP, help="Output zip path")
    args = parser.parse_args()

    missing = [f for f in EVALUATOR_FILES if not (HUMAN_EVAL_DIR / f).exists()]
    if missing:
        print("ERROR: Missing files. Run build_human_eval.py first:")
        for f in missing:
            print(f"  - {f}")
        raise SystemExit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "README.txt",
            f"LECSTU Translation Human Evaluation (Phase 9.4)\n"
            f"Packaged: {stamp}\n\n"
            "1. Read INSTRUCTIONS.md\n"
            "2. Open human_eval_form.csv to see each sentence + translation\n"
            "3. Copy rater_template.csv to ratings_YOURNAME.csv\n"
            "4. Fill fluency, adequacy, overall (1-5) for every item_id\n"
            "5. Email/send ratings_YOURNAME.csv back to the researcher\n\n"
            "Do not share ratings with other evaluators before submitting.\n",
        )
        for name in EVALUATOR_FILES:
            zf.write(HUMAN_EVAL_DIR / name, arcname=name)

    print(f"Evaluator bundle created: {args.output}")
    print("Share this zip with 5-10 bilingual evaluators (staff/students).")
    print("answer_key.json is NOT included (keeps evaluation blind).")


if __name__ == "__main__":
    main()
