#!/usr/bin/env python3
"""
Generate synthetic human evaluation ratings for pipeline testing.

WARNING: These are SIMULATED scores, not from real bilingual evaluators.
Use only to verify analyze_human_eval.py and generate_comparative_report.py.
For the thesis, replace with real ratings or clearly label as illustrative sample data.
"""
from __future__ import annotations

import csv
import json
import random
from pathlib import Path

RESEARCH_DIR = Path(__file__).resolve().parents[2]
HUMAN_EVAL_DIR = RESEARCH_DIR / "datasets" / "translation" / "human-eval"
BENCHMARK = RESEARCH_DIR / "translation-eval" / "results" / "translation_benchmark_20260617_132336.json"

RATERS = [
    ("archchika", 0.2),
    ("shakiththiyan", 0.0),
    ("kanusan", -0.15),
    ("sanjeevan", 0.1),
    ("faslan", -0.05),
    ("sanseevan", 0.25),
]
SCALE = [1, 2, 3, 4, 5]


def sim_to_base(sim: float) -> int:
    """Map semantic similarity (0-1) to Likert base 1-5."""
    if sim >= 0.85:
        return 5
    if sim >= 0.70:
        return 4
    if sim >= 0.50:
        return 3
    if sim >= 0.30:
        return 2
    return 1


def load_quality_by_item() -> dict[str, float]:
    """item_id -> mean semantic similarity from benchmark via answer key."""
    ak = json.loads((HUMAN_EVAL_DIR / "answer_key.json").read_text(encoding="utf-8"))
    bench = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    sim_by_key: dict[tuple, list[float]] = {}
    for row in bench.get("raw_results", []):
        if row.get("error") or row.get("semantic_similarity") is None:
            continue
        k = (row["sentence_id"], row["language_pair"], row["engine"])
        sim_by_key.setdefault(k, []).append(row["semantic_similarity"])

    out: dict[str, float] = {}
    for entry in ak.get("entries", []):
        k = (entry["sentence_id"], entry["language_pair"], entry["engine"])
        sims = sim_by_key.get(k, [])
        out[entry["item_id"]] = sum(sims) / len(sims) if sims else 0.5
    return out


def clamp_score(val: float) -> int:
    return max(1, min(5, int(round(val))))


def generate_ratings(rater_id: str, bias: float, quality: dict[str, float], rng: random.Random) -> list[dict]:
    rows = []
    for item_id in sorted(quality.keys()):
        base = sim_to_base(quality[item_id]) + bias
        flu = clamp_score(base + rng.choice([-1, 0, 0, 0, 1]))
        adq = clamp_score(base + rng.choice([-1, 0, 0, 1]))
        ov = clamp_score((flu + adq) / 2 + rng.choice([-1, 0, 0]))
        rows.append({"item_id": item_id, "fluency": flu, "adequacy": adq, "overall": ov})
    return rows


def write_csv(path: Path, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["item_id", "fluency", "adequacy", "overall"])
        w.writeheader()
        w.writerows(rows)


def main():
    if not (HUMAN_EVAL_DIR / "answer_key.json").exists():
        raise SystemExit("Run build_human_eval.py first.")

    quality = load_quality_by_item()
    if not quality:
        raise SystemExit("No quality mapping from benchmark.")

    for rater_id, bias in RATERS:
        rng = random.Random(hash(rater_id) % (2**32))
        rows = generate_ratings(rater_id, bias, quality, rng)
        path = HUMAN_EVAL_DIR / f"ratings_{rater_id}.csv"
        write_csv(path, rows)
        print(f"Wrote {path.name} ({len(rows)} items)")

    notice = HUMAN_EVAL_DIR / "SYNTHETIC_RATINGS_NOTICE.md"
    notice.write_text(
        "# Synthetic human evaluation ratings\n\n"
        "The files `ratings_archchika.csv`, `ratings_shakiththiyan.csv`, "
        "`ratings_kanusan.csv`, `ratings_sanjeevan.csv`, `ratings_faslan.csv`, "
        "and `ratings_sanseevan.csv` were **generated automatically** for pipeline "
        "testing. Scores are derived from Marian benchmark semantic similarity "
        "with per-rater noise — they are **not** from real independent human judges.\n\n"
        "**For thesis submission:** either collect real bilingual evaluator ratings "
        "and replace these files, or state explicitly in the methodology that human "
        "scores are simulated placeholders.\n\n"
        "Regenerate: `python research/translation-eval/scripts/generate_sample_ratings.py`\n",
        encoding="utf-8",
    )
    print(f"Wrote {notice.name}")


if __name__ == "__main__":
    main()
