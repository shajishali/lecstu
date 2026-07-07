#!/usr/bin/env python3
"""
LECSTU Human Evaluation Analysis (Phase 9.4)

Loads the blind answer key plus every collected rater file
(`ratings_*.csv`) from research/datasets/translation/human-eval/, then:

  - Aligns each rating to its engine / language pair via the answer key
  - Computes descriptive statistics per engine x language pair x dimension
    (fluency, adequacy, overall)
  - Computes inter-rater reliability:
      * Krippendorff's alpha (ordinal) per dimension
      * Mean pairwise quadratic-weighted Cohen's kappa
      * Percentage agreement (exact and within-1 Likert point)
  - Flags low-agreement items (high spread across raters) for review

Writes:
  research/datasets/translation/human-eval/human_eval_summary.json

Rater file format (CSV): item_id, fluency, adequacy, overall
Filename convention:      ratings_<name>.csv  (rater id = <name>)

Usage:
  python analyze_human_eval.py
  python analyze_human_eval.py --flag-threshold 1.5
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_EVAL_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = TRANSLATION_EVAL_DIR.parent
HUMAN_EVAL_DIR = RESEARCH_DIR / "datasets" / "translation" / "human-eval"

sys.path.insert(0, str(RESEARCH_DIR / "lib"))
from agreement_metrics import (  # noqa: E402
    krippendorff_alpha,
    mean_pairwise_kappa,
    percent_agreement,
    interpret_kappa,
)

DIMENSIONS = ["fluency", "adequacy", "overall"]
SCALE = [1, 2, 3, 4, 5]


def load_answer_key() -> dict:
    path = HUMAN_EVAL_DIR / "answer_key.json"
    if not path.exists():
        print(f"ERROR: answer key not found: {path}")
        print("Run build_human_eval.py first (Phase 9.4).")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {e["item_id"]: e for e in data.get("entries", [])}


def load_rater_files() -> dict:
    """Return {rater_id: {item_id: {dimension: value}}}."""
    raters: dict = {}
    for fp in sorted(glob.glob(str(HUMAN_EVAL_DIR / "ratings_*.csv"))):
        rater_id = Path(fp).stem.replace("ratings_", "", 1)
        with open(fp, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            item_scores: dict = {}
            for row in reader:
                item_id = (row.get("item_id") or "").strip()
                if not item_id:
                    continue
                scores: dict = {}
                for dim in DIMENSIONS:
                    raw = (row.get(dim) or "").strip()
                    if raw == "":
                        continue
                    try:
                        val = int(round(float(raw)))
                    except ValueError:
                        continue
                    if val in SCALE:
                        scores[dim] = val
                if scores:
                    item_scores[item_id] = scores
            if item_scores:
                raters[rater_id] = item_scores
    return raters


def descriptive(values: list) -> dict:
    if not values:
        return {"mean": None, "median": None, "std": None, "min": None, "max": None, "n": 0}
    n = len(values)
    mean = sum(values) / n
    sv = sorted(values)
    median = sv[n // 2] if n % 2 else (sv[n // 2 - 1] + sv[n // 2]) / 2
    var = sum((v - mean) ** 2 for v in values) / n
    return {
        "mean": round(mean, 4),
        "median": round(median, 4),
        "std": round(var ** 0.5, 4),
        "min": min(values),
        "max": max(values),
        "n": n,
    }


def analyze(raters: dict, answer_key: dict, flag_threshold: float) -> dict:
    engines = sorted({e["engine"] for e in answer_key.values()})
    pairs = sorted({e["language_pair"] for e in answer_key.values()})

    # ── Descriptive stats per engine x pair x dimension ──
    buckets: dict = {}  # (engine, pair, dim) -> [values]
    per_engine: dict = {}  # (engine, dim) -> [values]
    for rater, items in raters.items():
        for item_id, scores in items.items():
            meta = answer_key.get(item_id)
            if not meta:
                continue
            eng = meta["engine"]
            pair = meta["language_pair"]
            for dim, val in scores.items():
                buckets.setdefault((eng, pair, dim), []).append(val)
                per_engine.setdefault((eng, dim), []).append(val)

    by_engine_pair = {}
    for (eng, pair, dim), vals in sorted(buckets.items()):
        by_engine_pair.setdefault(f"{eng}|{pair}", {})[dim] = descriptive(vals)

    by_engine = {}
    for (eng, dim), vals in sorted(per_engine.items()):
        by_engine.setdefault(eng, {})[dim] = descriptive(vals)

    # ── Inter-rater reliability per dimension ──
    reliability = {}
    for dim in DIMENSIONS:
        rel_data = {
            rater: {item: sc[dim] for item, sc in items.items() if dim in sc}
            for rater, items in raters.items()
        }
        rel_data = {r: d for r, d in rel_data.items() if d}
        alpha = krippendorff_alpha(rel_data, level="ordinal", value_domain=SCALE)
        kappa = mean_pairwise_kappa(rel_data, labels=SCALE, weights="quadratic")
        pa_exact = percent_agreement(rel_data, tolerance=0)
        pa_within1 = percent_agreement(rel_data, tolerance=1)
        reliability[dim] = {
            "krippendorff_alpha_ordinal": round(alpha, 4) if alpha is not None else None,
            "alpha_interpretation": interpret_kappa(alpha),
            "mean_pairwise_weighted_kappa": kappa["mean_kappa"],
            "kappa_interpretation": interpret_kappa(kappa["mean_kappa"]),
            "kappa_pairs": kappa["pairs"],
            "percent_agreement_exact": pa_exact["agreement"],
            "percent_agreement_within_1": pa_within1["agreement"],
            "n_comparisons": pa_within1["n_comparisons"],
        }

    # ── Flag low-agreement items (spread across raters on 'overall') ──
    flagged = []
    per_item_overall: dict = {}
    for rater, items in raters.items():
        for item_id, scores in items.items():
            if "overall" in scores:
                per_item_overall.setdefault(item_id, []).append(scores["overall"])
    for item_id, vals in per_item_overall.items():
        if len(vals) < 2:
            continue
        stats = descriptive(vals)
        spread = stats["max"] - stats["min"]
        if stats["std"] is not None and (stats["std"] >= flag_threshold or spread >= 3):
            meta = answer_key.get(item_id, {})
            flagged.append(
                {
                    "item_id": item_id,
                    "engine": meta.get("engine"),
                    "language_pair": meta.get("language_pair"),
                    "overall_scores": vals,
                    "std": stats["std"],
                    "range": spread,
                }
            )
    flagged.sort(key=lambda x: (-(x["std"] or 0), -x["range"]))

    n_rated_items = len(per_item_overall)
    return {
        "phase": "9.4",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "completed" if raters else "pending_data",
        "num_raters": len(raters),
        "raters": sorted(raters.keys()),
        "engines": engines,
        "language_pairs": pairs,
        "items_in_instrument": len(answer_key),
        "items_with_ratings": n_rated_items,
        "descriptive_by_engine": by_engine,
        "descriptive_by_engine_pair": by_engine_pair,
        "inter_rater_reliability": reliability,
        "low_agreement_items": flagged,
        "flag_threshold_std": flag_threshold,
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze human evaluation (Phase 9.4)")
    parser.add_argument("--flag-threshold", type=float, default=1.5, help="Std threshold to flag low-agreement items")
    args = parser.parse_args()

    answer_key = load_answer_key()
    raters = load_rater_files()

    summary = analyze(raters, answer_key, args.flag_threshold)
    out_path = HUMAN_EVAL_DIR / "human_eval_summary.json"
    out_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Human evaluation summary written: {out_path}")
    print(f"  Raters: {summary['num_raters']}  ({', '.join(summary['raters']) or 'none yet'})")
    print(f"  Items with ratings: {summary['items_with_ratings']} / {summary['items_in_instrument']}")
    if summary["status"] == "pending_data":
        print("\nNo rater files found (ratings_*.csv). Distribute rater_template.csv,")
        print("collect completed files into the human-eval folder, then re-run.")
        return

    print("\nInter-rater reliability:")
    for dim, rel in summary["inter_rater_reliability"].items():
        print(
            f"  {dim:9s} | alpha={rel['krippendorff_alpha_ordinal']} ({rel['alpha_interpretation']}) "
            f"| kappa={rel['mean_pairwise_weighted_kappa']} | within-1={rel['percent_agreement_within_1']}"
        )
    if summary["low_agreement_items"]:
        print(f"\nFlagged {len(summary['low_agreement_items'])} low-agreement item(s) for review.")


if __name__ == "__main__":
    main()
