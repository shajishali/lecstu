#!/usr/bin/env python3
"""
LECSTU ASR Statistical Analysis (Phase 7.4)

Loads benchmark results, computes descriptive + inferential statistics,
generates visualizations, and produces the ASR Benchmark Report.

Usage:
  python analyze_benchmark.py                          # Use latest result
  python analyze_benchmark.py --result PATH            # Specific result file
  python analyze_benchmark.py --result PATH --report   # Generate report only
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_BENCHMARK_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = ASR_BENCHMARK_DIR.parent
RESULTS_DIR = ASR_BENCHMARK_DIR / "results"
REPORTS_DIR = RESEARCH_DIR / "reports"


def load_latest_result() -> Optional[dict]:
    """Load the most recent benchmark result JSON."""
    if not RESULTS_DIR.exists():
        return None
    files = sorted(RESULTS_DIR.glob("asr_benchmark_*.json"), reverse=True)
    if not files:
        return None
    with open(files[0], "r", encoding="utf-8") as f:
        return json.load(f)


def get_valid_wer_rows(data: dict) -> list:
    """Filter raw_results to rows with valid WER (no error)."""
    return [r for r in data.get("raw_results", []) if r.get("wer") is not None and r.get("error") is None]


def descriptive_stats(values: list) -> dict:
    if not values:
        return {}
    n = len(values)
    mean = sum(values) / n
    sorted_v = sorted(values)
    median = sorted_v[n // 2] if n % 2 else (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2
    var = sum((v - mean) ** 2 for v in values) / n
    std = var ** 0.5
    return {"mean": mean, "median": median, "std": std, "min": min(values), "max": max(values), "n": n}


def cohens_d(a: list, b: list) -> float:
    """Cohen's d for two independent samples."""
    if not a or not b:
        return float("nan")
    n1, n2 = len(a), len(b)
    m1, m2 = sum(a) / n1, sum(b) / n2
    v1 = sum((x - m1) ** 2 for x in a) / n1
    v2 = sum((x - m2) ** 2 for x in b) / n2
    pooled_std = ((v1 * (n1 - 1) + v2 * (n2 - 1)) / (n1 + n2 - 2)) ** 0.5
    if pooled_std == 0:
        return 0.0
    return (m1 - m2) / pooled_std


def ci_95(values: list) -> tuple:
    """95% CI using t-distribution approximation."""
    if len(values) < 2:
        return (None, None)
    import math
    n = len(values)
    mean = sum(values) / n
    std = (sum((v - mean) ** 2 for v in values) / (n - 1)) ** 0.5
    # t ≈ 1.96 for large n; use 2.0 as rough approx for small n
    margin = 2.0 * std / math.sqrt(n)
    return (mean - margin, mean + margin)


def run_inferential(rows: list) -> dict:
    """Paired comparison: Whisper(medium) vs Google per language."""
    out = {}
    for lang in ["en", "ta", "si"]:
        w_vals = [r["wer"] for r in rows if r["engine"] == "whisper" and r["model"] == "medium" and r["language"] == lang]
        g_vals = [r["wer"] for r in rows if r["engine"] == "google" and r["language"] == lang]
        if not w_vals or not g_vals:
            out[lang] = {"p_value": None, "test_statistic": None, "cohens_d": None, "ci_95": None, "note": "Insufficient data"}
            continue
        try:
            from scipy import stats
            # Paired if same utterances; use Wilcoxon for non-normal
            if len(w_vals) == len(g_vals):
                stat, p = stats.wilcoxon(w_vals, g_vals)
            else:
                stat, p = stats.mannwhitneyu(w_vals, g_vals, alternative="two-sided")
            d = cohens_d(w_vals, g_vals)
            diff = [w - g for w, g in zip(w_vals[: min(len(w_vals), len(g_vals))], g_vals[: min(len(w_vals), len(g_vals))])]
            lo, hi = ci_95(diff) if len(diff) >= 2 else (None, None)
            out[lang] = {"p_value": round(p, 4), "test_statistic": round(float(stat), 4), "cohens_d": round(d, 4), "ci_95": (round(lo, 4) if lo else None, round(hi, 4) if hi else None)}
        except Exception as e:
            out[lang] = {"p_value": None, "error": str(e)}
    return out


def generate_plots(data: dict, valid_rows: list, out_dir: Path) -> list:
    """Generate matplotlib charts. Returns list of generated file paths."""
    paths = []
    if not valid_rows:
        return paths
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        return paths

    out_dir.mkdir(parents=True, exist_ok=True)

    # Group by (engine, model, language)
    by_config = {}
    for r in valid_rows:
        k = (r["engine"], r["model"], r["language"])
        if k not in by_config:
            by_config[k] = []
        by_config[k].append(r["wer"])

    # 1. Bar chart: WER by engine × language (mean, error bars = std)
    configs = sorted(by_config.keys())
    if configs:
        labels = [f"{e}/{m}\n{lang}" for e, m, lang in configs]
        means = [descriptive_stats(by_config[k])["mean"] for k in configs]
        stds = [descriptive_stats(by_config[k])["std"] for k in configs]
        x = np.arange(len(labels))
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.bar(x, means, yerr=stds, capsize=4)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=15)
        ax.set_ylabel("WER")
        ax.set_title("WER by Engine × Language (mean ± std)")
        ax.set_ylim(bottom=0)
        plt.tight_layout()
        p1 = out_dir / "wer_by_config.png"
        plt.savefig(p1, dpi=120)
        plt.close()
        paths.append(str(p1))

    # 2. Box plot: WER distribution per engine
    engine_vals = {}
    for (e, m, lang), vals in by_config.items():
        key = f"{e}/{m}"
        if key not in engine_vals:
            engine_vals[key] = []
        engine_vals[key].extend(vals)
    if engine_vals:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.boxplot(engine_vals.values(), labels=engine_vals.keys())
        ax.set_ylabel("WER")
        ax.set_title("WER Distribution per Engine/Model")
        plt.tight_layout()
        p2 = out_dir / "wer_boxplot.png"
        plt.savefig(p2, dpi=120)
        plt.close()
        paths.append(str(p2))

    # 3. Latency bar chart (if we have latency data)
    lat_by_config = {}
    for r in valid_rows:
        if r.get("latency_ms") and r["latency_ms"] > 0:
            k = (r["engine"], r["model"], r["language"])
            if k not in lat_by_config:
                lat_by_config[k] = []
            lat_by_config[k].append(r["latency_ms"])
    if lat_by_config:
        configs = sorted(lat_by_config.keys())
        labels = [f"{e}/{m}\n{lang}" for e, m, lang in configs]
        means = [sum(lat_by_config[k]) / len(lat_by_config[k]) for k in configs]
        x = np.arange(len(labels))
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.bar(x, means)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=15)
        ax.set_ylabel("Latency (ms)")
        ax.set_title("Mean Latency by Engine × Language")
        ax.set_ylim(bottom=0)
        plt.tight_layout()
        p3 = out_dir / "latency_by_config.png"
        plt.savefig(p3, dpi=120)
        plt.close()
        paths.append(str(p3))

    # 4. Scatter: WER vs Latency (with legend: color = engine/model)
    filtered = [r for r in valid_rows if r.get("latency_ms") and r["latency_ms"] > 0]
    if filtered:
        fig, ax = plt.subplots(figsize=(8, 5))
        # Group by engine/model for distinct colors and legend
        by_config = {}
        for r in filtered:
            key = f"{r.get('engine', '?')}/{r.get('model', '?')}"
            if key not in by_config:
                by_config[key] = {"lat": [], "wer": []}
            by_config[key]["lat"].append(r["latency_ms"])
            by_config[key]["wer"].append(r["wer"])
        # Assign distinct color per config
        color_cycle = plt.rcParams["axes.prop_cycle"].by_key().get("color", ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"])
        for i, (config, data) in enumerate(by_config.items()):
            color = color_cycle[i % len(color_cycle)]
            ax.scatter(data["lat"], data["wer"], c=color, label=config, alpha=0.7, s=40)
        ax.set_xlabel("Latency (ms)")
        ax.set_ylabel("WER")
        ax.set_title("WER vs. Latency Trade-off")
        ax.legend(loc="upper right", fontsize=8)
        plt.tight_layout()
        p4 = out_dir / "wer_vs_latency.png"
        plt.savefig(p4, dpi=120)
        plt.close()
        paths.append(str(p4))

    return paths


def generate_report(data: dict, valid_rows: list, inferential: dict, plot_paths: list, result_path: str) -> str:
    """Generate Markdown report. plot_paths are absolute; we emit relative paths for report."""
    rel_plot_dir = "../asr-benchmark/results/"
    """Generate Markdown report content."""
    config = data.get("config", {})
    wer_stats = data.get("wer_stats", {})
    latency_stats = data.get("latency_stats", {})
    n_total = len(data.get("raw_results", []))
    n_valid = len(valid_rows)
    n_errors = n_total - n_valid

    sections = []
    sections.append("# ASR Benchmark Report (Phase 7.4)")
    sections.append("")
    sections.append("**Research Objective (RO-1)**: Develop and evaluate an ASR pipeline supporting English, Tamil, and Sinhala for academic voice queries.")
    sections.append("")
    sections.append("**Research Question (RQ-1)**: How does Whisper compare to Google Speech API in terms of WER and latency for multilingual academic queries?")
    sections.append("")
    sections.append("**Hypothesis (H1)**: Whisper (medium) achieves lower WER than Google Speech API for Tamil and Sinhala academic queries.")
    sections.append("")
    sections.append(f"**Experiment ID**: {data.get('experiment_id', 'N/A')}")
    sections.append(f"**Timestamp**: {data.get('timestamp', 'N/A')}")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 1. Introduction")
    sections.append("")
    sections.append("This report presents the statistical analysis of the LECSTU ASR benchmark experiments. The benchmark compares OpenAI Whisper (models: tiny, base, small, medium), Google Cloud Speech-to-Text, and Azure Speech Services on a dataset of 150 academic domain utterances in English, Tamil, and Sinhala.")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 2. Methodology")
    sections.append("")
    sections.append("### 2.1 Dataset")
    sections.append("- **Utterances**: 50 per language (en, ta, si) = 150 total")
    sections.append("- **Categories**: Timetable, Halls, Appointments, Directions, General")
    sections.append("- **Format**: 16 kHz WAV mono")
    sections.append("- **Ground truth**: Manual transcription, double-verified")
    sections.append("")
    sections.append("### 2.2 Experiment Config")
    sections.append(f"- **Utterances used**: {config.get('num_utterances', 'N/A')}")
    sections.append(f"- **Configurations**: {config.get('num_configs', 'N/A')}")
    sections.append(f"- **Runs per config**: {config.get('num_runs', 'N/A')}")
    sections.append("")
    sections.append("### 2.3 Metrics")
    sections.append("- **WER** (Word Error Rate): (S+I+D) / reference length")
    sections.append("- **CER** (Character Error Rate): Edit distance at character level")
    sections.append("- **Latency**: End-to-end transcription time (ms)")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 3. Results")
    sections.append("")
    sections.append(f"### 3.1 Data Summary")
    sections.append(f"- Total transcriptions: {n_total}")
    sections.append(f"- Valid (no error): {n_valid}")
    sections.append(f"- Failed: {n_errors}")
    if n_errors > 0:
        sections.append("- *Note: Some transcriptions failed (e.g., ffmpeg not found). Install ffmpeg and re-run benchmark for full results.*")
    sections.append("")

    if wer_stats:
        sections.append("### 3.2 WER by Configuration (mean ± std)")
        sections.append("")
        sections.append("| Configuration | Mean | Median | Std | Min | Max | N |")
        sections.append("|---------------|------|--------|-----|-----|-----|---|")
        for k, s in sorted(wer_stats.items()):
            sections.append(f"| {k} | {s.get('mean', 'N/A')} | {s.get('median', 'N/A')} | {s.get('std', 'N/A')} | {s.get('min', 'N/A')} | {s.get('max', 'N/A')} | {s.get('count', 'N/A')} |")
        sections.append("")
    else:
        sections.append("### 3.2 WER")
        sections.append("*No valid WER data. Re-run benchmark with ffmpeg installed.*")
        sections.append("")

    if latency_stats:
        sections.append("### 3.3 Latency by Configuration (ms)")
        sections.append("")
        sections.append("| Configuration | Mean | Median | Std | N |")
        sections.append("|---------------|------|--------|-----|---|")
        for k, s in sorted(latency_stats.items()):
            sections.append(f"| {k} | {s.get('mean', 'N/A')} | {s.get('median', 'N/A')} | {s.get('std', 'N/A')} | {s.get('count', 'N/A')} |")
        sections.append("")
    else:
        sections.append("### 3.3 Latency")
        sections.append("*No valid latency data.*")
        sections.append("")

    sections.append("---")
    sections.append("")
    sections.append("## 4. Statistical Analysis")
    sections.append("")
    sections.append("### 4.1 Inferential Tests (Whisper medium vs. Google)")
    sections.append("")
    sections.append("| Language | p-value | Test Statistic | Cohen's d | 95% CI (diff) | Significant? |")
    sections.append("|----------|---------|----------------|-----------|----------------|---------------|")
    for lang in ["en", "ta", "si"]:
        inf = inferential.get(lang, {})
        p = inf.get("p_value")
        stat = inf.get("test_statistic")
        d = inf.get("cohens_d")
        ci = inf.get("ci_95")
        ci_str = f"({ci[0]}, {ci[1]})" if ci and ci[0] is not None else "N/A"
        sig = "Yes" if p is not None and p < 0.05 else "No" if p is not None else "N/A"
        sections.append(f"| {lang} | {p} | {stat} | {d} | {ci_str} | {sig} |")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 5. Visualizations")
    sections.append("")
    for p in plot_paths:
        name = Path(p).name
        sections.append(f"- ![]({rel_plot_dir}{name})")
        sections.append("")
    if not plot_paths:
        sections.append("*No plots generated (insufficient data).*")
        sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 6. Discussion")
    sections.append("")
    if n_valid == 0:
        sections.append("The benchmark could not complete transcriptions due to missing ffmpeg. Install ffmpeg and re-run the benchmark to obtain WER and latency results.")
    else:
        sections.append("### 6.1 Key Findings")
        sections.append("- Analysis based on available valid transcriptions.")
        sections.append("- Full comparison requires running the complete benchmark (150 utterances × 5 Whisper configs + Google × 3 runs).")
        sections.append("### 6.2 Limitations")
        sections.append("- Sample/placeholder audio may not reflect real-world WER.")
        sections.append("- Replace with recorded human speech for final evaluation.")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 7. Conclusion")
    sections.append("")
    if n_valid == 0:
        sections.append("**Hypothesis H1**: *DEFERRED* — Insufficient data. Re-run benchmark with ffmpeg and real audio recordings.")
    else:
        sections.append("**Hypothesis H1**: *PENDING* — Run full benchmark and inferential tests with complete data to accept or reject.")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## 8. Artifacts")
    sections.append("")
    try:
        rp = Path(result_path)
        result_rel = str(rp.relative_to(RESEARCH_DIR)) if rp.is_absolute() and str(result_path).startswith(str(RESEARCH_DIR)) else f"asr-benchmark/results/{rp.name}"
    except (ValueError, TypeError):
        result_rel = str(result_path)
    sections.append("| File | Description |")
    sections.append("|------|-------------|")
    sections.append(f"| {result_rel} | Raw benchmark results |")
    for p in plot_paths:
        sections.append(f"| {rel_plot_dir}{Path(p).name} | Visualization |")
    sections.append("")
    sections.append("*Generated by LECSTU ASR Benchmark Analysis (Phase 7.4)*")
    return "\n".join(sections)


def main():
    parser = argparse.ArgumentParser(description="ASR Benchmark Statistical Analysis (Phase 7.4)")
    parser.add_argument("--result", type=Path, default=None, help="Path to benchmark result JSON")
    parser.add_argument("--report", action="store_true", help="Generate report only (skip stats if no data)")
    args = parser.parse_args()

    if args.result:
        result_path = Path(args.result)
        if not result_path.exists():
            print(f"ERROR: Result file not found: {result_path}")
            sys.exit(1)
        with open(result_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        if not RESULTS_DIR.exists():
            print("ERROR: No benchmark results directory. Run run_benchmark.py first.")
            sys.exit(1)
        files = list(RESULTS_DIR.glob("asr_benchmark_*.json"))
        if not files:
            print("ERROR: No benchmark results found. Run run_benchmark.py first.")
            sys.exit(1)
        result_path = max(files, key=lambda p: p.stat().st_mtime)
        with open(result_path, "r", encoding="utf-8") as f:
            data = json.load(f)

    valid_rows = get_valid_wer_rows(data)
    inferential = run_inferential(valid_rows) if valid_rows else {}
    plot_dir = RESULTS_DIR  # Save plots next to results
    plot_paths = generate_plots(data, valid_rows, plot_dir)

    report_content = generate_report(data, valid_rows, inferential, plot_paths, str(result_path))

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / "asr_benchmark_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"Report saved: {report_path}")
    print(f"Valid WER rows: {len(valid_rows)}")
    if plot_paths:
        print(f"Plots: {', '.join(plot_paths)}")


if __name__ == "__main__":
    main()
