#!/usr/bin/env python3
"""
LECSTU Human Evaluation Instrument Builder (Phase 9.4)

Builds a blinded, randomized human evaluation instrument from the automated
translation benchmark results (Phase 9.3) and the parallel corpus (Phase 9.2).

For each language pair, a balanced subset of sentences is selected (across
complexity levels) and the candidate translation of every available engine is
included. Items are shuffled and given opaque item IDs so evaluators cannot
tell which engine produced a translation (blind evaluation).

Outputs (into research/datasets/translation/human-eval/):
  human_eval_form.csv     — one row per item; blank fluency/adequacy/overall
  human_eval_form.json    — structured instrument (same items, with metadata)
  answer_key.json         — item_id -> engine / sentence / reference (kept
                            separate so the form stays blind)
  rater_template.csv      — copy per evaluator; they fill the score columns
  INSTRUCTIONS.md         — rubric + procedure for evaluators

Usage:
  python build_human_eval.py                       # 30 sentences / pair
  python build_human_eval.py --per-pair 20         # fewer sentences
  python build_human_eval.py --result PATH         # specific benchmark JSON
  python build_human_eval.py --seed 7              # reproducible shuffle
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_EVAL_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = TRANSLATION_EVAL_DIR.parent
RESULTS_DIR = TRANSLATION_EVAL_DIR / "results"
CORPUS_MANIFEST = RESEARCH_DIR / "datasets" / "translation" / "corpus_manifest.json"
HUMAN_EVAL_DIR = RESEARCH_DIR / "datasets" / "translation" / "human-eval"

RATING_DIMENSIONS = ["fluency", "adequacy", "overall"]
COMPLEXITY_ORDER = ["simple", "moderate", "complex"]


def _count_valid_rows(path: Path) -> int:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return 0
    return sum(
        1
        for r in data.get("raw_results", [])
        if not r.get("error") and r.get("hypothesis_text")
    )


def select_best_result() -> Optional[Path]:
    """Pick the benchmark result with the most valid rows (tie-break: newest)."""
    if not RESULTS_DIR.exists():
        return None
    files = sorted(RESULTS_DIR.glob("translation_benchmark_*.json"), reverse=True)
    if not files:
        return None
    return max(files, key=lambda p: (_count_valid_rows(p), p.stat().st_mtime))


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build_complexity_lookup(corpus: dict) -> dict:
    """(language_pair, sentence_id) -> complexity, plus sentence_id -> complexity."""
    lookup: dict = {}
    for pair in corpus.get("pairs", []):
        sid = pair.get("sentence_id")
        lp = pair.get("language_pair")
        lookup[(lp, sid)] = pair.get("complexity", "simple")
        lookup.setdefault(sid, pair.get("complexity", "simple"))
    return lookup


def pick_balanced_sentence_ids(
    rows: list[dict],
    pair: str,
    complexity_lookup: dict,
    per_pair: int,
    rng: random.Random,
) -> list[str]:
    """Select up to `per_pair` sentence IDs for a pair, balanced by complexity."""
    sids = sorted({r["sentence_id"] for r in rows if r["language_pair"] == pair})
    if not sids:
        return []

    buckets: dict[str, list[str]] = {c: [] for c in COMPLEXITY_ORDER}
    for sid in sids:
        comp = complexity_lookup.get((pair, sid)) or complexity_lookup.get(sid, "simple")
        buckets.setdefault(comp, []).append(sid)
    for c in buckets:
        rng.shuffle(buckets[c])

    selected: list[str] = []
    # Round-robin across complexity buckets for balance.
    while len(selected) < per_pair and any(buckets.values()):
        for c in COMPLEXITY_ORDER:
            if buckets.get(c):
                selected.append(buckets[c].pop())
                if len(selected) >= per_pair:
                    break
    return selected


def build_items(
    data: dict,
    corpus: dict,
    per_pair: int,
    rng: random.Random,
) -> tuple[list[dict], list[dict]]:
    """Return (blind_items, answer_key_entries)."""
    rows = [r for r in data.get("raw_results", []) if not r.get("error") and r.get("hypothesis_text")]
    complexity_lookup = build_complexity_lookup(corpus)

    pairs = sorted({r["language_pair"] for r in rows})
    engines = sorted({r["engine"] for r in rows})

    # Deduplicate to one candidate per (sentence, pair, engine) — first run.
    seen: set = set()
    candidate_by_key: dict = {}
    for r in rows:
        key = (r["sentence_id"], r["language_pair"], r["engine"])
        if key in seen:
            continue
        seen.add(key)
        candidate_by_key[key] = r

    blind_items: list[dict] = []
    answer_key: list[dict] = []

    for pair in pairs:
        chosen_sids = pick_balanced_sentence_ids(rows, pair, complexity_lookup, per_pair, rng)
        for sid in chosen_sids:
            for engine in engines:
                r = candidate_by_key.get((sid, pair, engine))
                if not r:
                    continue
                comp = complexity_lookup.get((pair, sid)) or complexity_lookup.get(sid, "simple")
                blind_items.append(
                    {
                        "language_pair": pair,
                        "source_lang": r["source_lang"],
                        "target_lang": r["target_lang"],
                        "source_text": r["source_text"],
                        "candidate_translation": r["hypothesis_text"],
                        # engine + reference intentionally excluded from the blind form
                        "_engine": engine,
                        "_sentence_id": sid,
                        "_category": r.get("category", "general"),
                        "_complexity": comp,
                        "_reference_text": r.get("reference_text", ""),
                    }
                )

    # Shuffle globally so engines/pairs are interleaved (blind presentation).
    rng.shuffle(blind_items)

    final_items: list[dict] = []
    for i, item in enumerate(blind_items, start=1):
        item_id = f"HE{i:04d}"
        final_items.append(
            {
                "item_id": item_id,
                "language_pair": item["language_pair"],
                "source_text": item["source_text"],
                "candidate_translation": item["candidate_translation"],
            }
        )
        answer_key.append(
            {
                "item_id": item_id,
                "language_pair": item["language_pair"],
                "source_lang": item["source_lang"],
                "target_lang": item["target_lang"],
                "engine": item["_engine"],
                "sentence_id": item["_sentence_id"],
                "category": item["_category"],
                "complexity": item["_complexity"],
                "reference_text": item["_reference_text"],
                "source_text": item["source_text"],
                "candidate_translation": item["candidate_translation"],
            }
        )

    return final_items, answer_key


def write_form_csv(items: list[dict], path: Path) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["item_id", "language_pair", "source_text", "candidate_translation"]
            + RATING_DIMENSIONS
            + ["comments"]
        )
        for it in items:
            writer.writerow(
                [
                    it["item_id"],
                    it["language_pair"],
                    it["source_text"],
                    it["candidate_translation"],
                    "", "", "", "",
                ]
            )


def write_rater_template(items: list[dict], path: Path) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["item_id"] + RATING_DIMENSIONS)
        for it in items:
            writer.writerow([it["item_id"], "", "", ""])


INSTRUCTIONS = """# Translation Human Evaluation — Instructions (Phase 9.4)

Thank you for evaluating machine-translated academic sentences for the LECSTU
project. Your ratings help us compare translation engines for English, Tamil,
and Sinhala.

## What you will do

You will see a list of items. Each item has:
- **source_text** — the original sentence
- **candidate_translation** — a machine translation to rate

You do **not** know which engine produced each translation. Please rate each
item honestly and independently.

## Rating scale (1–5)

Rate every item on three dimensions:

| Dimension | Question | 1 | 5 |
|-----------|----------|---|---|
| **Fluency** | Does it read naturally in the target language? | Not fluent at all | Perfectly natural |
| **Adequacy** | Is the original meaning fully preserved? | Meaning lost | Meaning fully preserved |
| **Overall** | Your overall quality judgement | Very poor | Excellent |

Guidance:
- **5** — Native-quality; no changes needed.
- **4** — Good; minor issues only.
- **3** — Acceptable; understandable but noticeable errors.
- **2** — Poor; hard to understand or meaning distorted.
- **1** — Unusable; wrong or nonsensical.

## How to submit

1. Copy `rater_template.csv` to `ratings_<yourname>.csv`
   (e.g. `ratings_anusha.csv`).
2. Fill the `fluency`, `adequacy`, and `overall` columns with a whole number 1–5.
3. Leave a cell blank only if you truly cannot judge that item.
4. Save the file in this folder (`research/datasets/translation/human-eval/`).

## After collection

Run the analysis to compute scores and inter-rater reliability:

```bash
cd research/translation-eval/scripts
python analyze_human_eval.py
```

Please keep evaluations independent — do not discuss individual items with
other evaluators before submitting.
"""


def main():
    parser = argparse.ArgumentParser(description="Build human evaluation instrument (Phase 9.4)")
    parser.add_argument("--result", type=Path, default=None, help="Benchmark result JSON (default: latest)")
    parser.add_argument("--per-pair", type=int, default=30, help="Sentences per language pair (default 30)")
    parser.add_argument("--seed", type=int, default=42, help="Shuffle seed for reproducibility")
    args = parser.parse_args()

    if not CORPUS_MANIFEST.exists():
        print(f"ERROR: Corpus manifest not found: {CORPUS_MANIFEST}")
        print("Run Phase 9.2 first (build_corpus_manifest.py).")
        sys.exit(1)

    result_path = args.result or select_best_result()
    if not result_path or not Path(result_path).exists():
        print("ERROR: No benchmark result found. Run Phase 9.3 (run_benchmark.py) first.")
        sys.exit(1)

    data = load_json(Path(result_path))
    corpus = load_json(CORPUS_MANIFEST)
    rng = random.Random(args.seed)

    items, answer_key = build_items(data, corpus, per_pair=args.per_pair, rng=rng)
    if not items:
        print("ERROR: No valid candidate translations found in benchmark result.")
        sys.exit(1)

    HUMAN_EVAL_DIR.mkdir(parents=True, exist_ok=True)

    engines = sorted({e["engine"] for e in answer_key})
    pairs = sorted({e["language_pair"] for e in answer_key})

    form_json = {
        "schema_version": "1.0",
        "phase": "9.4",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_result": str(result_path),
        "seed": args.seed,
        "per_pair": args.per_pair,
        "rating_dimensions": RATING_DIMENSIONS,
        "rating_scale": [1, 2, 3, 4, 5],
        "engines": engines,
        "language_pairs": pairs,
        "item_count": len(items),
        "items": items,
    }

    (HUMAN_EVAL_DIR / "human_eval_form.json").write_text(
        json.dumps(form_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (HUMAN_EVAL_DIR / "answer_key.json").write_text(
        json.dumps(
            {
                "phase": "9.4",
                "generated_at": form_json["generated_at"],
                "source_result": str(result_path),
                "seed": args.seed,
                "entries": answer_key,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    write_form_csv(items, HUMAN_EVAL_DIR / "human_eval_form.csv")
    write_rater_template(items, HUMAN_EVAL_DIR / "rater_template.csv")
    (HUMAN_EVAL_DIR / "INSTRUCTIONS.md").write_text(INSTRUCTIONS, encoding="utf-8")

    print("Human evaluation instrument generated.")
    print(f"  Items: {len(items)}  |  Engines: {engines}  |  Pairs: {pairs}")
    print(f"  Output dir: {HUMAN_EVAL_DIR}")
    print("  Files: human_eval_form.csv, human_eval_form.json, answer_key.json,")
    print("         rater_template.csv, INSTRUCTIONS.md")
    if len(engines) < 2:
        print("\nNote: only one engine is present in the benchmark result.")
        print("      Cloud-vs-transformer human comparison needs the cloud benchmark run too.")


if __name__ == "__main__":
    main()
