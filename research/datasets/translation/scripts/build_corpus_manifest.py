#!/usr/bin/env python3
"""
Build corpus_manifest.json for Phase 9.2 parallel translation corpus.

Sources:
  - research/datasets/asr/utterances.yaml  (ids 001–050)
  - research/datasets/translation/extra_sentences.yaml (ids 051–100)

Output:
  - corpus_manifest.json with 300 sentence pairs (en-ta, en-si, ta-si × 100 each)
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_DIR = SCRIPT_DIR.parent
REPO_ROOT = TRANSLATION_DIR.parents[1]
ASR_UTTERANCES = REPO_ROOT / "datasets" / "asr" / "utterances.yaml"
EXTRA_SENTENCES = TRANSLATION_DIR / "extra_sentences.yaml"
OUTPUT = TRANSLATION_DIR / "corpus_manifest.json"

ASR_CATEGORY_MAP = {
    "timetable": "timetable",
    "halls": "general",
    "appointments": "appointment",
    "directions": "navigation",
    "general": "general",
}

VALID_CATEGORIES = {"timetable", "appointment", "navigation", "notification", "general"}
VALID_COMPLEXITY = {"simple", "moderate", "complex"}
LANGUAGE_PAIRS = [
    ("en", "ta", "en-ta"),
    ("en", "si", "en-si"),
    ("ta", "si", "ta-si"),
]


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def infer_complexity(en_text: str) -> str:
    n = word_count(en_text)
    if n <= 7:
        return "simple"
    if n <= 14:
        return "moderate"
    return "complex"


def load_asr_sentences() -> list[dict]:
    with open(ASR_UTTERANCES, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    sentences: list[dict] = []
    seq = 1
    for asr_category, en_list in data["en"].items():
        category = ASR_CATEGORY_MAP.get(asr_category, "general")
        ta_list = data["ta"][asr_category]
        si_list = data["si"][asr_category]
        for en, ta, si in zip(en_list, ta_list, si_list):
            sid = f"{seq:03d}"
            sentences.append(
                {
                    "id": sid,
                    "category": category,
                    "complexity": infer_complexity(en),
                    "en": en.strip(),
                    "ta": ta.strip(),
                    "si": si.strip(),
                    "source": "asr_corpus",
                    "review_status": "asr_aligned",
                }
            )
            seq += 1
    return sentences


def load_extra_sentences() -> list[dict]:
    with open(EXTRA_SENTENCES, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    sentences = []
    for row in data["sentences"]:
        sentences.append(
            {
                "id": row["id"],
                "category": row["category"],
                "complexity": row["complexity"],
                "en": row["en"].strip(),
                "ta": row["ta"].strip(),
                "si": row["si"].strip(),
                "source": "platform_extension",
                "review_status": "primary_draft",
            }
        )
    return sentences


def build_pairs(sentences: list[dict]) -> list[dict]:
    pairs: list[dict] = []
    lang_key = {"en": "en", "ta": "ta", "si": "si"}

    for sentence in sentences:
        sid = sentence["id"]
        for src, tgt, pair_code in LANGUAGE_PAIRS:
            pair_id = f"{pair_code}_{sentence['category']}_{sid}"
            pairs.append(
                {
                    "id": pair_id,
                    "source_text": sentence[lang_key[src]],
                    "target_text": sentence[lang_key[tgt]],
                    "source_lang": src,
                    "target_lang": tgt,
                    "language_pair": pair_code,
                    "category": sentence["category"],
                    "complexity": sentence["complexity"],
                    "sentence_id": sid,
                    "corpus_source": sentence["source"],
                    "review_status": sentence["review_status"],
                }
            )
    return pairs


def summarize(pairs: list[dict]) -> dict:
    by_pair: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_complexity: dict[str, int] = {}
    for p in pairs:
        by_pair[p["language_pair"]] = by_pair.get(p["language_pair"], 0) + 1
        by_category[p["category"]] = by_category.get(p["category"], 0) + 1
        by_complexity[p["complexity"]] = by_complexity.get(p["complexity"], 0) + 1
    return {
        "total_pairs": len(pairs),
        "by_language_pair": by_pair,
        "by_category": by_category,
        "by_complexity": by_complexity,
    }


def main() -> int:
    asr = load_asr_sentences()
    extra = load_extra_sentences()
    sentences = asr + extra

    if len(sentences) != 100:
        raise SystemExit(f"Expected 100 sentences, got {len(sentences)}")

    ids = [s["id"] for s in sentences]
    if len(set(ids)) != 100:
        raise SystemExit("Duplicate sentence ids detected")

    pairs = build_pairs(sentences)
    if len(pairs) != 300:
        raise SystemExit(f"Expected 300 pairs, got {len(pairs)}")

    manifest = {
        "schema_version": "1.0",
        "phase": "9.2",
        "description": "LECSTU academic parallel translation corpus (English, Tamil, Sinhala)",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sentence_count": 100,
        "pair_count": 300,
        "language_pairs": ["en-ta", "en-si", "ta-si"],
        "categories": sorted(VALID_CATEGORIES),
        "summary": summarize(pairs),
        "pairs": pairs,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {OUTPUT}")
    print(f"  Sentences: {manifest['sentence_count']}")
    print(f"  Pairs: {manifest['pair_count']}")
    for pair, count in sorted(manifest["summary"]["by_language_pair"].items()):
        print(f"    {pair}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
