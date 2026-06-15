#!/usr/bin/env python3
"""
LECSTU ASR Benchmark Runner (Phase 7.3)

Loads dataset manifest, runs transcription for each audio × engine × model,
computes WER/CER against ground truth, records latency.
3 repetitions per configuration for variance measurement.

Usage:
  python run_benchmark.py                    # Full benchmark
  python run_benchmark.py --limit 5          # Quick test (5 utterances)
  python run_benchmark.py --engine whisper   # Whisper only
  python run_benchmark.py --model tiny       # Tiny model only
  python run_benchmark.py --runs 1           # Single run (no repetition)
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
ASR_BENCHMARK_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = ASR_BENCHMARK_DIR.parent
PROJECT_ROOT = RESEARCH_DIR.parent

# Add paths for imports
sys.path.insert(0, str(PROJECT_ROOT / "ai-services" / "asr"))
sys.path.insert(0, str(RESEARCH_DIR / "lib"))

import yaml
from wer_calculator import WERCalculator

from asr_service import transcribe as asr_transcribe

# Config
CONFIG_PATH = RESEARCH_DIR / "research-config.yaml"
DATASET_DIR = RESEARCH_DIR / "datasets" / "asr"
MANIFEST_PATH = DATASET_DIR / "dataset_manifest.json"
RESULTS_DIR = ASR_BENCHMARK_DIR / "results"
LOGS_DIR = RESEARCH_DIR / "logs"


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_manifest():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def run_benchmark(
    limit: Optional[int] = None,
    engine_filter: Optional[str] = None,
    model_filter: Optional[str] = None,
    language_filter: Optional[str] = None,
    num_runs: int = 3,
):
    config = load_config()
    manifest = load_manifest()
    utterances = manifest.get("utterances", [])

    asr_config = config.get("asr", {})
    whisper_models = asr_config.get("engines", {}).get("whisper", {}).get("model_sizes", ["tiny", "base", "small", "medium"])
    languages = asr_config.get("languages", ["en", "ta", "si"])

    if limit:
        utterances = utterances[:limit]

    if language_filter:
        utterances = [u for u in utterances if u.get("language") == language_filter]

    wer_calc = WERCalculator()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    # Build config matrix: (engine, model)
    configs = []
    ef = (engine_filter or "").lower()
    if not ef or ef == "whisper":
        models = [m for m in whisper_models if not model_filter or m == model_filter]
        for m in models:
            configs.append(("whisper", m))
    if not ef or ef == "whisper-finetuned":
        configs.append(("whisper-finetuned", "tiny"))
    if not ef or ef == "google":
        configs.append(("google", None))
    if not ef or ef == "azure":
        configs.append(("azure", None))

    all_results = []
    experiment_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    total = len(utterances) * len(configs) * num_runs
    done = 0

    for utterance in utterances:
        uid = utterance["id"]
        lang = utterance.get("language", "en")
        ref_text = utterance.get("text", "")
        audio_rel = utterance.get("audio_path", "")
        audio_path = DATASET_DIR / audio_rel

        if not audio_path.exists():
            print(f"SKIP {uid}: audio not found at {audio_path}")
            continue

        for engine, model in configs:
            model_key = model or "default"
            for run_idx in range(num_runs):
                done += 1
                print(f"[{done}/{total}] {uid} | {engine}/{model_key} | run {run_idx + 1}/{num_runs}")

                try:
                    result = asr_transcribe(
                        audio_path=str(audio_path),
                        language=lang,
                        engine_name=engine,
                        model_size=model if engine == "whisper" else None,
                        preprocess=True,
                    )
                except Exception as e:
                    result = {"text": "", "latency_ms": 0, "error": str(e)}

                hyp_text = result.get("text", "") or ""
                latency_ms = result.get("latency_ms", 0)
                err_msg = result.get("error", "")

                if err_msg:
                    wer_result = {"wer": None, "cer": None, "ref_length": 0, "hyp_length": 0}
                else:
                    wer_result = wer_calc.compute(ref_text, hyp_text, normalize=True)
                    wer_result.pop("substitutions", None)
                    wer_result.pop("insertions", None)
                    wer_result.pop("deletions", None)

                row = {
                    "utterance_id": uid,
                    "language": lang,
                    "engine": engine,
                    "model": model_key,
                    "run": run_idx + 1,
                    "reference": ref_text,
                    "hypothesis": hyp_text,
                    "wer": wer_result.get("wer"),
                    "cer": wer_result.get("cer"),
                    "latency_ms": latency_ms,
                    "ref_length": wer_result.get("ref_length"),
                    "hyp_length": wer_result.get("hyp_length"),
                }
                if err_msg:
                    row["error"] = err_msg
                all_results.append(row)

    # Aggregate stats per (engine, model, language)
    def aggregate(key):
        by_config = {}
        for r in all_results:
            if r.get("error"):
                continue
            k = (r["engine"], r["model"], r["language"])
            if k not in by_config:
                by_config[k] = []
            v = r.get(key)
            if v is not None and v != float("inf"):
                by_config[k].append(v)

        stats = {}
        for k, vals in by_config.items():
            vals = [v for v in vals if v is not None and v != float("inf")]
            if not vals:
                continue
            n = len(vals)
            mean_val = sum(vals) / n
            sorted_v = sorted(vals)
            median_val = sorted_v[n // 2] if n % 2 else (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2
            variance = sum((v - mean_val) ** 2 for v in vals) / n
            stats[k] = {
                "mean": round(mean_val, 4),
                "median": round(median_val, 4),
                "std": round(variance ** 0.5, 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
                "count": n,
            }
        return stats

    wer_stats = aggregate("wer")
    cer_stats = aggregate("cer")
    latency_stats = aggregate("latency_ms")

    # Save results
    output = {
        "experiment_id": experiment_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "config": {
            "num_utterances": len(utterances),
            "num_configs": len(configs),
            "num_runs": num_runs,
            "engine_filter": engine_filter,
            "model_filter": model_filter,
            "language_filter": language_filter,
        },
        "raw_results": all_results,
        "wer_stats": {f"{e}_{m}_{lang}": s for (e, m, lang), s in wer_stats.items()},
        "cer_stats": {f"{e}_{m}_{lang}": s for (e, m, lang), s in cer_stats.items()},
        "latency_stats": {f"{e}_{m}_{lang}": s for (e, m, lang), s in latency_stats.items()},
    }

    out_path = RESULTS_DIR / f"asr_benchmark_{experiment_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Log summary
    log_path = LOGS_DIR / f"asr_benchmark_{experiment_id}.json"
    log_entry = {
        "experiment_id": experiment_id,
        "experiment_type": "asr-benchmark",
        "status": "completed",
        "timestamp": output["timestamp"],
        "config": output["config"],
        "metrics_summary": {
            "wer_by_config": output["wer_stats"],
            "latency_by_config": output["latency_stats"],
        },
        "artifact": str(out_path),
    }
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(log_entry, f, indent=2)

    print(f"\nDone. Results: {out_path}")
    print(f"Log: {log_path}")
    print("\nWER summary (mean):")
    for k, s in output["wer_stats"].items():
        print(f"  {k}: {s['mean']:.4f} (n={s['count']})")

    return output


def main():
    parser = argparse.ArgumentParser(description="LECSTU ASR Benchmark (Phase 7.3)")
    parser.add_argument("--limit", type=int, default=None, help="Limit utterances (for quick test)")
    parser.add_argument("--engine", choices=["whisper", "whisper-finetuned", "google", "azure"], default=None)
    parser.add_argument("--model", default=None, help="Whisper model: tiny, base, small, medium")
    parser.add_argument("--language", choices=["en", "ta", "si"], default=None)
    parser.add_argument("--runs", type=int, default=3, help="Repetitions per config")
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERROR: Manifest not found at {MANIFEST_PATH}")
        print("Run Phase 7.2 first: generate_manifest_template.py, create_sample_audio.py")
        sys.exit(1)

    run_benchmark(
        limit=args.limit,
        engine_filter=args.engine,
        model_filter=args.model,
        language_filter=args.language,
        num_runs=args.runs,
    )


if __name__ == "__main__":
    main()
