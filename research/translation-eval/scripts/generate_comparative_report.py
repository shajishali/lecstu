#!/usr/bin/env python3
"""
LECSTU Translation Comparative Report (Phase 9.5)

Compiles automated benchmark metrics (Phase 9.3) and human evaluation results
(Phase 9.4), runs statistical analysis, generates visualizations, and writes
the final Translation Evaluation Report that answers RQ-3 and tests H3.

Statistical analysis:
  - Cloud vs. Transformer per language pair (paired t-test + Wilcoxon)
  - Effect size (Cohen's d) for quality differences
  - Correlation of BLEU vs. human overall (Pearson + Spearman)
  - Correlation of semantic similarity vs. human overall

Visualizations (saved to research/translation-eval/results/):
  bleu_by_pair.png, similarity_by_pair.png, latency_by_pair.png,
  human_scores_boxplot.png, automated_vs_human_scatter.png,
  speed_vs_quality.png

Report:
  research/reports/translation_evaluation_report.md

Usage:
  python generate_comparative_report.py
  python generate_comparative_report.py --result PATH
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
TRANSLATION_EVAL_DIR = SCRIPT_DIR.parent
RESEARCH_DIR = TRANSLATION_EVAL_DIR.parent
RESULTS_DIR = TRANSLATION_EVAL_DIR / "results"
REPORTS_DIR = RESEARCH_DIR / "reports"
HUMAN_EVAL_DIR = RESEARCH_DIR / "datasets" / "translation" / "human-eval"

REL_PLOT_DIR = "../translation-eval/results/"
DIRECTIONS = ["en-ta", "ta-en", "en-si", "si-en", "ta-si", "si-ta"]
TAMIL_SINHALA_TARGETS = {"en-ta", "en-si", "ta-si", "si-ta"}  # H3 focus directions


# ────────────────────────────────────────────────────────────────
# Loading
# ────────────────────────────────────────────────────────────────
def _count_valid_rows(path: Path) -> int:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return 0
    return sum(1 for r in data.get("raw_results", []) if not r.get("error") and r.get("hypothesis_text"))


def select_best_result() -> Optional[Path]:
    if not RESULTS_DIR.exists():
        return None
    files = sorted(RESULTS_DIR.glob("translation_benchmark_*.json"), reverse=True)
    if not files:
        return None
    return max(files, key=lambda p: (_count_valid_rows(p), p.stat().st_mtime))


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_all_valid_rows() -> tuple[list[dict], list[str]]:
    """Merge valid rows across ALL benchmark result files (dedup by config+run)."""
    rows: list[dict] = []
    sources: list[str] = []
    seen: set = set()
    if not RESULTS_DIR.exists():
        return rows, sources
    for path in sorted(RESULTS_DIR.glob("translation_benchmark_*.json")):
        try:
            data = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        added = 0
        for r in data.get("raw_results", []):
            if r.get("error") or not r.get("hypothesis_text"):
                continue
            key = (r.get("engine"), r.get("language_pair"), r.get("sentence_id"), r.get("run"))
            if key in seen:
                continue
            seen.add(key)
            rows.append(r)
            added += 1
        if added:
            sources.append(path.name)
    return rows, sources


# ────────────────────────────────────────────────────────────────
# Statistics helpers (dependency-light, scipy optional)
# ────────────────────────────────────────────────────────────────
def descriptive(values: list) -> dict:
    if not values:
        return {"mean": None, "median": None, "std": None, "n": 0}
    n = len(values)
    mean = sum(values) / n
    sv = sorted(values)
    median = sv[n // 2] if n % 2 else (sv[n // 2 - 1] + sv[n // 2]) / 2
    var = sum((v - mean) ** 2 for v in values) / n
    return {"mean": round(mean, 4), "median": round(median, 4), "std": round(var ** 0.5, 4), "n": n}


def cohens_d(a: list, b: list) -> Optional[float]:
    if len(a) < 2 or len(b) < 2:
        return None
    n1, n2 = len(a), len(b)
    m1, m2 = sum(a) / n1, sum(b) / n2
    v1 = sum((x - m1) ** 2 for x in a) / (n1 - 1)
    v2 = sum((x - m2) ** 2 for x in b) / (n2 - 1)
    pooled = ((v1 * (n1 - 1) + v2 * (n2 - 1)) / (n1 + n2 - 2)) ** 0.5
    if pooled == 0:
        return 0.0
    return round((m1 - m2) / pooled, 4)


def paired_tests(a: list, b: list) -> dict:
    """Paired t-test + Wilcoxon signed-rank on aligned samples."""
    out = {"t_p": None, "wilcoxon_p": None, "n": min(len(a), len(b))}
    if len(a) != len(b) or len(a) < 2:
        return out
    try:
        from scipy import stats
        # Guard against zero-variance differences (scipy raises).
        diffs = [x - y for x, y in zip(a, b)]
        if any(d != 0 for d in diffs):
            t_stat, t_p = stats.ttest_rel(a, b)
            out["t_p"] = round(float(t_p), 4)
            try:
                w_stat, w_p = stats.wilcoxon(a, b)
                out["wilcoxon_p"] = round(float(w_p), 4)
            except ValueError:
                out["wilcoxon_p"] = None
        else:
            out["t_p"] = 1.0
            out["wilcoxon_p"] = 1.0
    except ImportError:
        out["note"] = "scipy not installed"
    return out


def correlation(x: list, y: list) -> dict:
    out = {"pearson_r": None, "pearson_p": None, "spearman_r": None, "spearman_p": None, "n": len(x)}
    if len(x) != len(y) or len(x) < 3:
        return out
    try:
        from scipy import stats
        pr, pp = stats.pearsonr(x, y)
        sr, sp = stats.spearmanr(x, y)
        out.update(
            {
                "pearson_r": round(float(pr), 4),
                "pearson_p": round(float(pp), 4),
                "spearman_r": round(float(sr), 4),
                "spearman_p": round(float(sp), 4),
            }
        )
    except ImportError:
        out["note"] = "scipy not installed"
    except Exception as e:  # noqa: BLE001
        out["note"] = str(e)
    return out


# ────────────────────────────────────────────────────────────────
# Aggregation
# ────────────────────────────────────────────────────────────────
def aggregate_automated(rows: list[dict]) -> dict:
    engines = sorted({r["engine"] for r in rows})
    pairs = [p for p in DIRECTIONS if any(r["language_pair"] == p for r in rows)]
    agg: dict = {}
    for eng in engines:
        for pair in pairs:
            subset = [r for r in rows if r["engine"] == eng and r["language_pair"] == pair]
            bleu = [r["bleu"] for r in subset if r.get("bleu") is not None]
            sim = [r["semantic_similarity"] for r in subset if r.get("semantic_similarity") is not None]
            lat = [r["latency_ms"] for r in subset if r.get("latency_ms") is not None]
            agg[f"{eng}|{pair}"] = {
                "engine": eng,
                "language_pair": pair,
                "bleu": descriptive(bleu),
                "similarity": descriptive(sim),
                "latency_ms": descriptive(lat),
            }
    return {"engines": engines, "pairs": pairs, "by_engine_pair": agg}


def cloud_vs_transformer(rows: list[dict], pairs: list[str]) -> dict:
    """Per-pair comparison of cloud vs transformer engine groups."""
    out: dict = {}
    for pair in pairs:
        cloud = {}
        trans = {}
        for r in rows:
            if r["language_pair"] != pair:
                continue
            grp = r.get("engine_group")
            key = (r["sentence_id"], r["run"])
            if grp == "cloud" and r.get("semantic_similarity") is not None:
                cloud[key] = r["semantic_similarity"]
            elif grp == "transformer" and r.get("semantic_similarity") is not None:
                trans[key] = r["semantic_similarity"]
        common = sorted(set(cloud) & set(trans))
        if len(common) < 2:
            out[pair] = {"comparable": False, "note": "Both engines not available for this pair"}
            continue
        c_vals = [cloud[k] for k in common]
        t_vals = [trans[k] for k in common]
        tests = paired_tests(t_vals, c_vals)
        out[pair] = {
            "comparable": True,
            "n": len(common),
            "transformer_mean_similarity": round(sum(t_vals) / len(t_vals), 4),
            "cloud_mean_similarity": round(sum(c_vals) / len(c_vals), 4),
            "cohens_d": cohens_d(t_vals, c_vals),
            "paired_t_p": tests["t_p"],
            "wilcoxon_p": tests["wilcoxon_p"],
        }
    return out


def build_automated_human_correlation(rows: list[dict], human_summary: Optional[dict]) -> dict:
    """Correlate per-item automated metrics against per-item mean human overall."""
    if not human_summary or human_summary.get("status") != "completed":
        return {"available": False}
    ak_path = HUMAN_EVAL_DIR / "answer_key.json"
    if not ak_path.exists():
        return {"available": False}
    answer_key = {e["item_id"]: e for e in load_json(ak_path).get("entries", [])}

    # Rebuild per-item mean human overall from rater files.
    import csv
    import glob as _glob
    per_item: dict = {}
    for fp in _glob.glob(str(HUMAN_EVAL_DIR / "ratings_*.csv")):
        with open(fp, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                iid = (row.get("item_id") or "").strip()
                ov = (row.get("overall") or "").strip()
                if not iid or ov == "":
                    continue
                try:
                    per_item.setdefault(iid, []).append(float(ov))
                except ValueError:
                    continue
    item_human = {iid: sum(v) / len(v) for iid, v in per_item.items() if v}

    # Automated per (engine, sentence, pair): mean bleu / similarity across runs.
    auto: dict = {}
    for r in rows:
        k = (r["engine"], r["language_pair"], r["sentence_id"])
        auto.setdefault(k, {"bleu": [], "sim": []})
        if r.get("bleu") is not None:
            auto[k]["bleu"].append(r["bleu"])
        if r.get("semantic_similarity") is not None:
            auto[k]["sim"].append(r["semantic_similarity"])

    bleu_x, sim_x, human_y = [], [], []
    for iid, hval in item_human.items():
        meta = answer_key.get(iid)
        if not meta:
            continue
        k = (meta["engine"], meta["language_pair"], meta["sentence_id"])
        a = auto.get(k)
        if not a:
            continue
        if a["bleu"]:
            bleu_x.append(sum(a["bleu"]) / len(a["bleu"]))
            human_y.append(hval)
        if a["sim"]:
            sim_x.append(sum(a["sim"]) / len(a["sim"]))

    result = {"available": True, "n_items": len(human_y)}
    if len(human_y) >= 3:
        result["bleu_vs_human"] = correlation(bleu_x, human_y)
        # sim_x may differ in length; align to the same items where sim exists
        if len(sim_x) == len(human_y):
            result["similarity_vs_human"] = correlation(sim_x, human_y)
        else:
            # Recompute similarity aligned to human items
            sim_aligned, human_sim = [], []
            for iid, hval in item_human.items():
                meta = answer_key.get(iid)
                if not meta:
                    continue
                a = auto.get((meta["engine"], meta["language_pair"], meta["sentence_id"]))
                if a and a["sim"]:
                    sim_aligned.append(sum(a["sim"]) / len(a["sim"]))
                    human_sim.append(hval)
            result["similarity_vs_human"] = correlation(sim_aligned, human_sim)
        result["_scatter"] = {"bleu_x": bleu_x, "sim": sim_x, "human_y": human_y}
    return result


# ────────────────────────────────────────────────────────────────
# Plots
# ────────────────────────────────────────────────────────────────
def generate_plots(automated: dict, rows: list[dict], human_summary: Optional[dict], corr: dict) -> list[str]:
    paths: list[str] = []
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        return paths

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    engines = automated["engines"]
    pairs = automated["pairs"]
    agg = automated["by_engine_pair"]
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"]

    def grouped_bar(metric: str, title: str, ylabel: str, filename: str):
        x = np.arange(len(pairs))
        width = 0.8 / max(len(engines), 1)
        fig, ax = plt.subplots(figsize=(10, 5))
        for i, eng in enumerate(engines):
            means = [(agg.get(f"{eng}|{p}", {}).get(metric, {}) or {}).get("mean") or 0 for p in pairs]
            stds = [(agg.get(f"{eng}|{p}", {}).get(metric, {}) or {}).get("std") or 0 for p in pairs]
            ax.bar(x + i * width, means, width, yerr=stds, capsize=3, label=eng, color=colors[i % len(colors)])
        ax.set_xticks(x + width * (len(engines) - 1) / 2)
        ax.set_xticklabels(pairs)
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        ax.legend()
        plt.tight_layout()
        p = RESULTS_DIR / filename
        plt.savefig(p, dpi=120)
        plt.close()
        paths.append(str(p))

    grouped_bar("bleu", "BLEU by Language Pair (mean +/- std)", "BLEU", "bleu_by_pair.png")
    grouped_bar("similarity", "Semantic Similarity by Language Pair (mean +/- std)", "Cosine similarity", "similarity_by_pair.png")
    grouped_bar("latency_ms", "Latency by Language Pair (mean +/- std)", "Latency (ms)", "latency_by_pair.png")

    # Human score box plots (per engine, overall dimension)
    if human_summary and human_summary.get("status") == "completed":
        import csv
        import glob as _glob
        ak = {e["item_id"]: e for e in load_json(HUMAN_EVAL_DIR / "answer_key.json").get("entries", [])}
        eng_overall: dict = {}
        for fp in _glob.glob(str(HUMAN_EVAL_DIR / "ratings_*.csv")):
            with open(fp, encoding="utf-8-sig", newline="") as f:
                for row in csv.DictReader(f):
                    iid = (row.get("item_id") or "").strip()
                    ov = (row.get("overall") or "").strip()
                    meta = ak.get(iid)
                    if not meta or ov == "":
                        continue
                    try:
                        eng_overall.setdefault(meta["engine"], []).append(float(ov))
                    except ValueError:
                        continue
        if eng_overall:
            fig, ax = plt.subplots(figsize=(8, 5))
            try:
                ax.boxplot(list(eng_overall.values()), tick_labels=list(eng_overall.keys()))
            except TypeError:
                ax.boxplot(list(eng_overall.values()), labels=list(eng_overall.keys()))
            ax.set_ylabel("Human overall score (1-5)")
            ax.set_title("Human Overall Quality per Engine")
            plt.tight_layout()
            p = RESULTS_DIR / "human_scores_boxplot.png"
            plt.savefig(p, dpi=120)
            plt.close()
            paths.append(str(p))

    # Automated vs human scatter
    scatter = corr.get("_scatter") if corr.get("available") else None
    if scatter and scatter["human_y"]:
        fig, ax = plt.subplots(figsize=(8, 5))
        if scatter["bleu_x"] and len(scatter["bleu_x"]) == len(scatter["human_y"]):
            ax.scatter(scatter["bleu_x"], scatter["human_y"], alpha=0.6, label="BLEU", color=colors[0])
        ax.set_xlabel("Automated metric")
        ax.set_ylabel("Human overall (1-5)")
        ax.set_title("Automated Metric vs. Human Score")
        ax.legend()
        plt.tight_layout()
        p = RESULTS_DIR / "automated_vs_human_scatter.png"
        plt.savefig(p, dpi=120)
        plt.close()
        paths.append(str(p))

    # Speed vs quality (similarity vs latency per engine/pair)
    fig, ax = plt.subplots(figsize=(8, 5))
    for i, eng in enumerate(engines):
        xs, ys = [], []
        for p in pairs:
            cell = agg.get(f"{eng}|{p}", {})
            sim = (cell.get("similarity") or {}).get("mean")
            lat = (cell.get("latency_ms") or {}).get("mean")
            if sim is not None and lat is not None:
                xs.append(lat)
                ys.append(sim)
        if xs:
            ax.scatter(xs, ys, label=eng, color=colors[i % len(colors)], s=50, alpha=0.7)
    ax.set_xlabel("Mean latency (ms)")
    ax.set_ylabel("Mean semantic similarity")
    ax.set_title("Speed vs. Quality Trade-off")
    ax.legend()
    plt.tight_layout()
    sp = RESULTS_DIR / "speed_vs_quality.png"
    plt.savefig(sp, dpi=120)
    plt.close()
    paths.append(str(sp))

    return paths


# ────────────────────────────────────────────────────────────────
# Report
# ────────────────────────────────────────────────────────────────
def fmt(v) -> str:
    return "N/A" if v is None else str(v)


def h3_decision(cvt: dict, automated: dict, human_summary: Optional[dict]) -> tuple[str, str]:
    """Decide Accept / Reject / Deferred on H3."""
    engines = automated["engines"]
    if len(engines) < 2:
        return (
            "DEFERRED",
            "H3 compares cloud APIs against transformer models, but only the "
            f"transformer engine ({', '.join(engines)}) produced valid results. "
            "The cloud benchmark could not be executed (Google API returned "
            "rate-limit / credential errors), so a statistical comparison is not "
            "yet possible. H3 remains deferred until a full cloud run is completed.",
        )
    # Both engines present: judge on Tamil/Sinhala target directions
    wins = 0
    total = 0
    sig = 0
    for pair, res in cvt.items():
        if not res.get("comparable") or pair not in TAMIL_SINHALA_TARGETS:
            continue
        total += 1
        if (res.get("transformer_mean_similarity") or 0) > (res.get("cloud_mean_similarity") or 0):
            wins += 1
        p = res.get("wilcoxon_p")
        if p is not None and p < 0.05:
            sig += 1
    if total == 0:
        return ("DEFERRED", "No comparable Tamil/Sinhala directions with both engines.")
    if wins > total / 2 and sig > 0:
        return (
            "ACCEPT",
            f"On {wins}/{total} Tamil/Sinhala target directions the transformer engine "
            f"achieved higher mean semantic similarity than the cloud API, with "
            f"statistically significant differences in {sig} direction(s).",
        )
    return (
        "REJECT",
        f"The transformer engine outperformed the cloud API on only {wins}/{total} "
        "Tamil/Sinhala directions with insufficient statistical significance, so H3 is not supported.",
    )


def build_report(automated, cvt, corr, human_summary, plot_paths, sources, result_path) -> str:
    s: list[str] = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    engines = automated["engines"]
    pairs = automated["pairs"]
    agg = automated["by_engine_pair"]

    s.append("# Translation Comparative Evaluation Report (Phase 9.5)")
    s.append("")
    s.append("**Research Objective (RO-3)**: Implement and comparatively evaluate machine translation approaches for English-Tamil-Sinhala academic content.")
    s.append("")
    s.append("**Research Question (RQ-3)**: How do cloud translation APIs compare to multilingual transformer models in quality and speed for English-Tamil-Sinhala pairs?")
    s.append("")
    s.append("**Hypothesis (H3)**: Multilingual transformer models produce higher semantic similarity scores than cloud APIs for Tamil and Sinhala academic text.")
    s.append("")
    s.append(f"**Report Date**: {now}")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 1. Introduction & Methodology")
    s.append("")
    s.append("This report consolidates the automated benchmark (Phase 9.3) and the human "
             "evaluation (Phase 9.4) into a single comparative analysis for the LECSTU "
             "translation subsystem, and delivers a final decision on hypothesis H3.")
    s.append("")
    s.append("- **Corpus**: 100 trilingual academic sentence sets, 300 bilingual pairs (Phase 9.2)")
    s.append(f"- **Directions evaluated**: {', '.join(pairs)}")
    s.append(f"- **Engines with valid data**: {', '.join(engines)}")
    s.append("- **Automated metrics**: BLEU, multilingual semantic similarity, latency")
    s.append("- **Human metrics**: fluency, adequacy, overall (1-5 Likert), blind evaluation")
    s.append(f"- **Automated result source(s)**: {', '.join(sources) if sources else fmt(result_path)}")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 2. Automated Results")
    s.append("")
    s.append("### 2.1 BLEU, Semantic Similarity, Latency (mean +/- std)")
    s.append("")
    s.append("| Engine | Pair | BLEU | Similarity | Latency (ms) | N |")
    s.append("|--------|------|------|------------|--------------|---|")
    for eng in engines:
        for pair in pairs:
            c = agg.get(f"{eng}|{pair}")
            if not c:
                continue
            b, sim, lat = c["bleu"], c["similarity"], c["latency_ms"]
            s.append(
                f"| {eng} | {pair} | {fmt(b['mean'])} +/- {fmt(b['std'])} | "
                f"{fmt(sim['mean'])} +/- {fmt(sim['std'])} | "
                f"{fmt(lat['mean'])} +/- {fmt(lat['std'])} | {b['n']} |"
            )
    s.append("")
    s.append("BLEU is expected to be low for short, morphologically rich academic sentences; "
             "semantic similarity is the primary automated quality signal for H3.")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 3. Statistical Analysis")
    s.append("")
    s.append("### 3.1 Cloud vs. Transformer (per language pair)")
    s.append("")
    if len(engines) < 2:
        s.append("*Only one engine produced valid results, so paired cloud-vs-transformer "
                 "tests could not be computed. See the H3 decision in Section 6.*")
    else:
        s.append("| Pair | Transformer sim | Cloud sim | Cohen's d | Paired t (p) | Wilcoxon (p) | N | Significant? |")
        s.append("|------|-----------------|-----------|-----------|--------------|--------------|---|--------------|")
        for pair in pairs:
            res = cvt.get(pair, {})
            if not res.get("comparable"):
                s.append(f"| {pair} | N/A | N/A | N/A | N/A | N/A | 0 | N/A |")
                continue
            wp = res.get("wilcoxon_p")
            sigflag = "Yes" if wp is not None and wp < 0.05 else "No" if wp is not None else "N/A"
            s.append(
                f"| {pair} | {fmt(res['transformer_mean_similarity'])} | "
                f"{fmt(res['cloud_mean_similarity'])} | {fmt(res['cohens_d'])} | "
                f"{fmt(res['paired_t_p'])} | {fmt(wp)} | {res['n']} | {sigflag} |"
            )
    s.append("")
    s.append("### 3.2 Correlation: Automated Metrics vs. Human Judgement")
    s.append("")
    if corr.get("available"):
        bh = corr.get("bleu_vs_human", {})
        sh = corr.get("similarity_vs_human", {})
        s.append(f"- **Items correlated**: {corr.get('n_items')}")
        s.append(f"- **BLEU vs. human overall**: Pearson r = {fmt(bh.get('pearson_r'))} "
                 f"(p = {fmt(bh.get('pearson_p'))}), Spearman rho = {fmt(bh.get('spearman_r'))} "
                 f"(p = {fmt(bh.get('spearman_p'))})")
        s.append(f"- **Similarity vs. human overall**: Pearson r = {fmt(sh.get('pearson_r'))} "
                 f"(p = {fmt(sh.get('pearson_p'))}), Spearman rho = {fmt(sh.get('spearman_r'))} "
                 f"(p = {fmt(sh.get('spearman_p'))})")
    else:
        s.append("*Human evaluation scores have not been collected yet, so correlation "
                 "between automated metrics and human judgement is pending. Run "
                 "`build_human_eval.py`, collect `ratings_*.csv`, run `analyze_human_eval.py`, "
                 "then regenerate this report.*")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 4. Human Evaluation Results")
    s.append("")
    if human_summary and human_summary.get("status") == "completed":
        synthetic_notice = HUMAN_EVAL_DIR / "SYNTHETIC_RATINGS_NOTICE.md"
        if synthetic_notice.exists():
            s.append(
                "> **Note:** Current human scores are **synthetic sample data** "
                "(see `datasets/translation/human-eval/SYNTHETIC_RATINGS_NOTICE.md`). "
                "Replace with real evaluator ratings before final thesis submission, "
                "or disclose simulation in the methodology."
            )
            s.append("")
        s.append(f"- **Evaluators**: {human_summary.get('num_raters')} "
                 f"({', '.join(human_summary.get('raters', []))})")
        s.append(f"- **Items rated**: {human_summary.get('items_with_ratings')} / "
                 f"{human_summary.get('items_in_instrument')}")
        s.append("")
        s.append("### 4.1 Mean Human Scores per Engine")
        s.append("")
        s.append("| Engine | Fluency | Adequacy | Overall |")
        s.append("|--------|---------|----------|---------|")
        for eng, dims in human_summary.get("descriptive_by_engine", {}).items():
            s.append(
                f"| {eng} | {fmt(dims.get('fluency', {}).get('mean'))} | "
                f"{fmt(dims.get('adequacy', {}).get('mean'))} | "
                f"{fmt(dims.get('overall', {}).get('mean'))} |"
            )
        s.append("")
        s.append("### 4.2 Inter-Rater Reliability")
        s.append("")
        s.append("| Dimension | Krippendorff alpha | Interpretation | Mean weighted kappa | Within-1 agreement |")
        s.append("|-----------|--------------------|----------------|---------------------|--------------------|")
        for dim, rel in human_summary.get("inter_rater_reliability", {}).items():
            s.append(
                f"| {dim} | {fmt(rel.get('krippendorff_alpha_ordinal'))} | "
                f"{rel.get('alpha_interpretation')} | "
                f"{fmt(rel.get('mean_pairwise_weighted_kappa'))} | "
                f"{fmt(rel.get('percent_agreement_within_1'))} |"
            )
        flagged = human_summary.get("low_agreement_items", [])
        s.append("")
        s.append(f"- **Low-agreement items flagged for review**: {len(flagged)}")
    else:
        s.append("*Human evaluation is prepared but scores are not yet collected.*")
        s.append("")
        s.append("The blind evaluation instrument has been generated by Phase 9.4 "
                 "(`build_human_eval.py`) into "
                 "`research/datasets/translation/human-eval/`, including the rating form, "
                 "rater template, blind answer key, and evaluator instructions. Once "
                 "5-10 bilingual evaluators complete `ratings_*.csv`, run "
                 "`analyze_human_eval.py` and regenerate this report to populate "
                 "fluency/adequacy/overall scores and inter-rater reliability.")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 5. Visualizations")
    s.append("")
    if plot_paths:
        for p in plot_paths:
            s.append(f"![{Path(p).stem}]({REL_PLOT_DIR}{Path(p).name})")
            s.append("")
    else:
        s.append("*No plots generated (matplotlib unavailable or insufficient data).*")
    s.append("")
    s.append("---")
    s.append("")

    s.append("## 6. Conclusion")
    s.append("")
    decision, rationale = h3_decision(cvt, automated, human_summary)
    s.append(f"**Hypothesis H3: {decision}**")
    s.append("")
    s.append(rationale)
    s.append("")
    s.append("### Per-Language-Pair Recommendation")
    s.append("")
    s.append("| Pair | Recommended engine | Basis |")
    s.append("|------|--------------------|-------|")
    for pair in pairs:
        best_eng, best_sim = None, -1.0
        for eng in engines:
            sim = (agg.get(f"{eng}|{pair}", {}).get("similarity") or {}).get("mean")
            if sim is not None and sim > best_sim:
                best_sim, best_eng = sim, eng
        s.append(f"| {pair} | {fmt(best_eng)} | highest mean similarity ({fmt(round(best_sim,4) if best_sim>=0 else None)}) |")
    s.append("")
    s.append("### Speed vs. Quality")
    s.append("")
    s.append("The speed-vs-quality trade-off plot (Section 5) positions each engine by mean "
             "latency and mean similarity. For interactive chatbot translation, latency is a "
             "hard constraint; for asynchronous notification/timetable translation, quality "
             "should be prioritised.")
    s.append("")
    s.append("---")
    s.append("")
    s.append("## 7. Limitations")
    s.append("")
    s.append("- BLEU is unreliable for short morphologically rich sentences; interpret via similarity + human scores.")
    if len(engines) < 2:
        s.append("- The cloud engine benchmark failed (API rate-limit / credentials), so the "
                 "core cloud-vs-transformer comparison for H3 is deferred rather than tested.")
    if not (human_summary and human_summary.get("status") == "completed"):
        s.append("- Human evaluation scores are pending collection; human-dependent sections are provisional.")
    s.append("")
    s.append("*Generated by LECSTU Translation Comparative Report (Phase 9.5)*")
    return "\n".join(s)


def main():
    parser = argparse.ArgumentParser(description="Translation Comparative Report (Phase 9.5)")
    parser.add_argument("--result", type=Path, default=None, help="Primary benchmark result JSON")
    args = parser.parse_args()

    result_path = args.result or select_best_result()
    if not result_path:
        print("ERROR: No benchmark result found. Run Phase 9.3 first.")
        sys.exit(1)

    rows, sources = load_all_valid_rows()
    if not rows:
        print("ERROR: No valid benchmark rows across result files. Run Phase 9.3 with a working engine.")
        sys.exit(1)

    human_path = HUMAN_EVAL_DIR / "human_eval_summary.json"
    human_summary = load_json(human_path) if human_path.exists() else None

    automated = aggregate_automated(rows)
    cvt = cloud_vs_transformer(rows, automated["pairs"])
    corr = build_automated_human_correlation(rows, human_summary)
    plot_paths = generate_plots(automated, rows, human_summary, corr)

    report = build_report(automated, cvt, corr, human_summary, plot_paths, sources, result_path)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORTS_DIR / "translation_evaluation_report.md"
    out_path.write_text(report, encoding="utf-8")

    decision, _ = h3_decision(cvt, automated, human_summary)
    print(f"Report written: {out_path}")
    print(f"  Engines: {automated['engines']}  |  Pairs: {automated['pairs']}")
    print(f"  Plots: {len(plot_paths)}  |  Human data: {'yes' if human_summary and human_summary.get('status')=='completed' else 'pending'}")
    print(f"  H3 decision: {decision}")


if __name__ == "__main__":
    main()
