#!/usr/bin/env python3
"""
LECSTU Translation Benchmark Runner (Phase 9.3)

Loads parallel corpus manifest, runs translation for each sentence × direction × engine,
computes BLEU and semantic similarity against human reference, records latency.
3 repetitions per configuration for variance measurement.

Usage:
  python run_benchmark.py                      # Full benchmark (google + marian)
  python run_benchmark.py --limit 5            # Quick test (5 sentences)
  python run_benchmark.py --engine marian      # Transformer only
  python run_benchmark.py --engine google      # Cloud API only
  python run_benchmark.py --runs 1             # Single run (no repetition)
  python run_benchmark.py --pair en-ta         # One language pair only
  python run_benchmark.py --skip-similarity    # Skip embedding model (faster)
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_EVAL_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = TRANSLATION_EVAL_DIR.parent
PROJECT_ROOT = RESEARCH_DIR.parent

sys.path.insert(0, str(PROJECT_ROOT / "ai-services" / "translation"))
sys.path.insert(0, str(RESEARCH_DIR / "lib"))

from bleu_calculator import BLEUCalculator
from similarity_calculator import SimilarityCalculator
from translation_service import translate

CONFIG_PATH = RESEARCH_DIR / "research-config.yaml"
CORPUS_MANIFEST = RESEARCH_DIR / "datasets" / "translation" / "corpus_manifest.json"
RESULTS_DIR = TRANSLATION_EVAL_DIR / "results"
LOGS_DIR = RESEARCH_DIR / "logs"

DIRECTIONS = [
    ("en", "ta", "en-ta"),
    ("ta", "en", "ta-en"),
    ("en", "si", "en-si"),
    ("si", "en", "si-en"),
    ("ta", "si", "ta-si"),
    ("si", "ta", "si-ta"),
]

ENGINE_GROUPS = {
    "cloud": "google",
    "transformer": "marian",
}


def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_corpus() -> dict:
    with open(CORPUS_MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def build_sentence_lookup(pairs: list[dict]) -> dict[str, dict[str, str]]:
    """Build sentence_id -> {en, ta, si} from trilingual manifest pairs."""
    lookup: dict[str, dict[str, str]] = {}
    for pair in pairs:
        sid = pair["sentence_id"]
        lookup.setdefault(sid, {})
        lookup[sid][pair["source_lang"]] = pair["source_text"]
        lookup[sid][pair["target_lang"]] = pair["target_text"]
    return lookup


def build_tasks(sentence_lookup: dict[str, dict[str, str]], pair_filter: Optional[str] = None) -> list[dict]:
    tasks = []
    for sid in sorted(sentence_lookup.keys()):
        texts = sentence_lookup[sid]
        if not all(lang in texts for lang in ("en", "ta", "si")):
            continue
        for src, tgt, pair_code in DIRECTIONS:
            if pair_filter and pair_code != pair_filter:
                continue
            tasks.append(
                {
                    "sentence_id": sid,
                    "source_lang": src,
                    "target_lang": tgt,
                    "language_pair": pair_code,
                    "source_text": texts[src],
                    "reference_text": texts[tgt],
                    "category": None,
                }
            )
    return tasks


def attach_categories(tasks: list[dict], pairs: list[dict]) -> None:
    cat_by_sid: dict[str, str] = {}
    for pair in pairs:
        cat_by_sid[pair["sentence_id"]] = pair["category"]
    for task in tasks:
        task["category"] = cat_by_sid.get(task["sentence_id"], "general")


def aggregate_metric(results: list[dict], key: str) -> dict:
    by_config: dict[tuple, list[float]] = {}
    for row in results:
        if row.get("error"):
            continue
        value = row.get(key)
        if value is None:
            continue
        config_key = (row["engine_group"], row["engine"], row["language_pair"])
        by_config.setdefault(config_key, []).append(float(value))

    stats = {}
    for config_key, values in by_config.items():
        if not values:
            continue
        n = len(values)
        mean_val = sum(values) / n
        sorted_v = sorted(values)
        median_val = sorted_v[n // 2] if n % 2 else (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2
        variance = sum((v - mean_val) ** 2 for v in values) / n
        stats[config_key] = {
            "mean": round(mean_val, 4),
            "median": round(median_val, 4),
            "std": round(variance**0.5, 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "count": n,
        }
    return stats


def run_benchmark(
    limit: Optional[int] = None,
    engine_filter: Optional[str] = None,
    pair_filter: Optional[str] = None,
    num_runs: int = 3,
    skip_similarity: bool = False,
):
    config = load_config()
    corpus = load_corpus()
    pairs = corpus.get("pairs", [])
    sentence_lookup = build_sentence_lookup(pairs)
    tasks = build_tasks(sentence_lookup, pair_filter=pair_filter)
    attach_categories(tasks, pairs)

    sentence_ids = sorted({t["sentence_id"] for t in tasks})
    if limit:
        allowed = set(sentence_ids[:limit])
        tasks = [t for t in tasks if t["sentence_id"] in allowed]

    engines: list[tuple[str, str]] = []
    ef = (engine_filter or "").lower()
    if not ef or ef in ("google", "cloud"):
        engines.append(("cloud", "google"))
    if not ef or ef in ("marian", "transformer"):
        engines.append(("transformer", "marian"))

    if not engines:
        raise SystemExit(f"Unknown engine filter: {engine_filter}")

    bleu_calc = BLEUCalculator()
    sim_calc = None
    embedding_model = config.get("translation", {}).get(
        "embedding_model", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    if not skip_similarity:
        sim_calc = SimilarityCalculator(model_name=embedding_model)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    experiment_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    all_results: list[dict] = []
    total = len(tasks) * len(engines) * num_runs
    done = 0

    print(f"Experiment {experiment_id}")
    print(f"  Sentences: {len({t['sentence_id'] for t in tasks})}")
    print(f"  Directions: {len({t['language_pair'] for t in tasks})}")
    print(f"  Tasks: {len(tasks)} | Engines: {[e for _, e in engines]} | Runs: {num_runs}")
    print(f"  Total translations: {total}")

    for task in tasks:
        sid = task["sentence_id"]
        src_text = task["source_text"]
        ref_text = task["reference_text"]
        src = task["source_lang"]
        tgt = task["target_lang"]
        pair_code = task["language_pair"]

        for engine_group, engine_name in engines:
            for run_idx in range(num_runs):
                done += 1
                print(
                    f"[{done}/{total}] {sid} | {pair_code} | {engine_name} | run {run_idx + 1}/{num_runs}",
                    flush=True,
                )

                result = translate(text=src_text, src_lang=src, tgt_lang=tgt, engine=engine_name)
                hyp_text = result.get("translated_text", "") or ""
                latency_ms = result.get("latency_ms", 0)
                err_msg = result.get("error", "")

                bleu = None
                similarity = None
                if not err_msg and hyp_text:
                    bleu = bleu_calc.compute(ref_text, hyp_text)["bleu"]
                    if sim_calc is not None:
                        similarity = sim_calc.cosine(ref_text, hyp_text)

                row = {
                    "sentence_id": sid,
                    "language_pair": pair_code,
                    "source_lang": src,
                    "target_lang": tgt,
                    "category": task["category"],
                    "engine_group": engine_group,
                    "engine": engine_name,
                    "run": run_idx + 1,
                    "source_text": src_text,
                    "reference_text": ref_text,
                    "hypothesis_text": hyp_text,
                    "bleu": bleu,
                    "semantic_similarity": similarity,
                    "latency_ms": latency_ms,
                }
                if err_msg:
                    row["error"] = err_msg
                all_results.append(row)

    bleu_stats = aggregate_metric(all_results, "bleu")
    sim_stats = aggregate_metric(all_results, "semantic_similarity")
    latency_stats = aggregate_metric(all_results, "latency_ms")

    def stat_key(k):
        group, engine, pair = k
        return f"{group}_{engine}_{pair}"

    output = {
        "experiment_id": experiment_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "phase": "9.3",
        "hardware": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "processor": platform.processor() or "unknown",
        },
        "config": {
            "corpus_manifest": str(CORPUS_MANIFEST),
            "num_sentences": len({t["sentence_id"] for t in tasks}),
            "num_directions": len({t["language_pair"] for t in tasks}),
            "num_tasks": len(tasks),
            "engines": [e for _, e in engines],
            "num_runs": num_runs,
            "engine_filter": engine_filter,
            "pair_filter": pair_filter,
            "embedding_model": None if skip_similarity else embedding_model,
            "limit": limit,
        },
        "summary": {
            "total_rows": len(all_results),
            "errors": sum(1 for r in all_results if r.get("error")),
            "bleu_stats": {stat_key(k): v for k, v in bleu_stats.items()},
            "semantic_similarity_stats": {stat_key(k): v for k, v in sim_stats.items()},
            "latency_stats": {stat_key(k): v for k, v in latency_stats.items()},
        },
        "raw_results": all_results,
    }

    out_path = RESULTS_DIR / f"translation_benchmark_{experiment_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    log_path = LOGS_DIR / f"translation_benchmark_{experiment_id}.json"
    log_entry = {
        "experiment_id": experiment_id,
        "experiment_type": "translation-benchmark",
        "status": "completed",
        "timestamp": output["timestamp"],
        "config": output["config"],
        "metrics_summary": output["summary"],
        "artifact": str(out_path),
    }
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(log_entry, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Results: {out_path}")
    print(f"Log: {log_path}")
    print(f"Errors: {output['summary']['errors']} / {len(all_results)}")
    print("\nBLEU summary (mean):")
    for key, stats in sorted(output["summary"]["bleu_stats"].items()):
        print(f"  {key}: {stats['mean']:.4f} (n={stats['count']})")

    return output


def main():
    parser = argparse.ArgumentParser(description="LECSTU Translation Benchmark (Phase 9.3)")
    parser.add_argument("--limit", type=int, default=None, help="Limit sentences (quick test)")
    parser.add_argument(
        "--engine",
        choices=["google", "cloud", "marian", "transformer"],
        default=None,
        help="Run one engine group only",
    )
    parser.add_argument(
        "--pair",
        choices=["en-ta", "ta-en", "en-si", "si-en", "ta-si", "si-ta"],
        default=None,
        help="Run one language direction only",
    )
    parser.add_argument("--runs", type=int, default=3, help="Repetitions per config")
    parser.add_argument("--skip-similarity", action="store_true", help="Skip semantic similarity (faster)")
    args = parser.parse_args()

    if not CORPUS_MANIFEST.exists():
        print(f"ERROR: Corpus not found at {CORPUS_MANIFEST}")
        print("Run Phase 9.2 first: build_corpus_manifest.py")
        sys.exit(1)

    run_benchmark(
        limit=args.limit,
        engine_filter=args.engine,
        pair_filter=args.pair,
        num_runs=args.runs,
        skip_similarity=args.skip_similarity,
    )


if __name__ == "__main__":
    main()
