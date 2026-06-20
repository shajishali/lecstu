#!/usr/bin/env python3
"""Summarize translation benchmark results (Phase 9.3)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SCRIPT_DIR.parent / "results"


def resolve_results_path(path: Path) -> Path:
    """Resolve --file to an existing results JSON (cwd, results dir, or experiment id)."""
    candidates: list[Path] = [path]
    if not path.is_absolute():
        candidates.extend([Path.cwd() / path, RESULTS_DIR / path, RESULTS_DIR / path.name])
    stem = path.stem
    if stem.isdigit() or (len(stem) == 15 and stem[8] == "_"):
        candidates.append(RESULTS_DIR / f"translation_benchmark_{stem}.json")

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()

    available = sorted(RESULTS_DIR.glob("translation_benchmark_*.json"))
    hint = "\n".join(f"  - {p.name}" for p in available[-5:]) if available else "  (none)"
    raise SystemExit(
        f"Results file not found: {path}\n"
        f"Use a path under {RESULTS_DIR}, an experiment id (e.g. 20260617_132336), "
        f"or omit --file for the latest run.\n"
        f"Recent results:\n{hint}"
    )


def load_latest() -> tuple[Path, dict]:
    files = sorted(RESULTS_DIR.glob("translation_benchmark_*.json"))
    if not files:
        raise SystemExit(f"No results in {RESULTS_DIR}")
    path = files[-1]
    with open(path, encoding="utf-8") as f:
        return path, json.load(f)


def print_summary(data: dict) -> None:
    print(f"Experiment: {data.get('experiment_id')}")
    print(f"Timestamp:  {data.get('timestamp')}")
    cfg = data.get("config", {})
    print(f"Sentences:  {cfg.get('num_sentences')} | Runs: {cfg.get('num_runs')} | Engines: {cfg.get('engines')}")
    summary = data.get("summary", {})
    print(f"Total rows: {summary.get('total_rows')} | Errors: {summary.get('errors')}")

    print("\n=== BLEU (mean) ===")
    for key, stats in sorted(summary.get("bleu_stats", {}).items()):
        print(f"  {key:35s}  {stats['mean']:.4f}  (std {stats['std']:.4f}, n={stats['count']})")

    print("\n=== Semantic similarity (mean) ===")
    for key, stats in sorted(summary.get("semantic_similarity_stats", {}).items()):
        print(f"  {key:35s}  {stats['mean']:.4f}  (std {stats['std']:.4f}, n={stats['count']})")

    print("\n=== Latency ms (mean) ===")
    for key, stats in sorted(summary.get("latency_stats", {}).items()):
        print(f"  {key:35s}  {stats['mean']:.1f}  (std {stats['std']:.1f}, n={stats['count']})")


def main():
    parser = argparse.ArgumentParser(description="Analyze translation benchmark results")
    parser.add_argument("--file", type=Path, default=None, help="Specific results JSON file")
    args = parser.parse_args()

    if args.file:
        path = resolve_results_path(args.file)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        path, data = load_latest()

    print(f"File: {path}\n")
    print_summary(data)


if __name__ == "__main__":
    main()
