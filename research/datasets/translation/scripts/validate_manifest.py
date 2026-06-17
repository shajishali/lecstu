#!/usr/bin/env python3
"""Validate corpus_manifest.json for Phase 9.2 requirements."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_DIR = SCRIPT_DIR.parent
MANIFEST = TRANSLATION_DIR / "corpus_manifest.json"

VALID_LANGS = {"en", "ta", "si"}
VALID_PAIRS = {"en-ta", "en-si", "ta-si"}
VALID_CATEGORIES = {"timetable", "appointment", "navigation", "notification", "general"}
VALID_COMPLEXITY = {"simple", "moderate", "complex"}
REQUIRED_FIELDS = [
    "id",
    "source_text",
    "target_text",
    "source_lang",
    "target_lang",
    "language_pair",
    "category",
    "complexity",
]


def validate() -> int:
    if not MANIFEST.exists():
        print(f"ERROR: {MANIFEST} not found. Run build_corpus_manifest.py first.")
        return 1

    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)

    pairs = data.get("pairs", [])
    errors: list[str] = []
    ids_seen: set[str] = set()

    for i, pair in enumerate(pairs):
        pid = pair.get("id", f"#{i}")
        if pid in ids_seen:
            errors.append(f"{pid}: duplicate id")
        ids_seen.add(pid)

        for field in REQUIRED_FIELDS:
            if field not in pair or not str(pair[field]).strip():
                errors.append(f"{pid}: missing or empty '{field}'")

        if pair.get("source_lang") not in VALID_LANGS:
            errors.append(f"{pid}: invalid source_lang")
        if pair.get("target_lang") not in VALID_LANGS:
            errors.append(f"{pid}: invalid target_lang")
        if pair.get("language_pair") not in VALID_PAIRS:
            errors.append(f"{pid}: invalid language_pair")
        if pair.get("category") not in VALID_CATEGORIES:
            errors.append(f"{pid}: invalid category '{pair.get('category')}'")
        if pair.get("complexity") not in VALID_COMPLEXITY:
            errors.append(f"{pid}: invalid complexity '{pair.get('complexity')}'")

        expected_pair = f"{pair.get('source_lang')}-{pair.get('target_lang')}"
        if pair.get("language_pair") != expected_pair:
            errors.append(f"{pid}: language_pair mismatch (expected {expected_pair})")

    pair_counts = Counter(p["language_pair"] for p in pairs)
    sentence_ids = {p.get("sentence_id") for p in pairs}

    if len(pairs) != 300:
        errors.append(f"Expected 300 pairs, got {len(pairs)}")
    for lp in VALID_PAIRS:
        if pair_counts.get(lp, 0) != 100:
            errors.append(f"Expected 100 pairs for {lp}, got {pair_counts.get(lp, 0)}")
    if len(sentence_ids) != 100:
        errors.append(f"Expected 100 unique sentence_ids, got {len(sentence_ids)}")

    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1

    print(f"Manifest valid: {len(pairs)} pairs, {len(sentence_ids)} sentences")
    for lp in sorted(VALID_PAIRS):
        print(f"  {lp}: {pair_counts[lp]}")
    cat_counts = Counter(p["category"] for p in pairs)
    print("Categories (pair entries):")
    for cat in sorted(VALID_CATEGORIES):
        print(f"  {cat}: {cat_counts.get(cat, 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(validate())
