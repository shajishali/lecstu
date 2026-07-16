#!/usr/bin/env python3
"""
LECSTU usability questionnaire analysis (student Google Form export).
Computes demographics, SUS, task ratings, AI trust, feature scores, and
notes H4 is untestable without observer task-times CSV.
"""
from __future__ import annotations

import csv
import json
import math
import statistics as stats
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = ROOT / "research/usability-study/raw-data"
# Prefer newest export; fallback to dated file
_candidates = sorted(RAW_DIR.glob("form-responses-students-*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
CSV_PATH = _candidates[0] if _candidates else RAW_DIR / "form-responses-students-2026-07-08.csv"
REPORT_PATH = ROOT / "research/reports/usability_study_report.md"
JSON_PATH = ROOT / "research/reability-study/results/usability_analysis.json"

# Fix typo path
JSON_PATH = ROOT / "research/usability-study/results/usability_analysis.json"

SUS_BENCHMARK = 68.0
H4_TARGET_N = 20


def col(row: dict, prefix: str) -> str:
    for k, v in row.items():
        if k.strip().startswith(prefix):
            return (v or "").strip()
    return ""


def num(v: str) -> float | None:
    if not v:
        return None
    v = v.strip().lower()
    if v in ("yes", "no", ""):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def sus_score(row: dict) -> float | None:
    vals: list[float] = []
    for i in range(1, 11):
        x = num(col(row, f"SUS{i}"))
        if x is None:
            return None
        if i % 2 == 0:  # negative items
            x = 5.0 - x
        vals.append(x - 1.0)  # 0-4 scale
    return sum(vals) * 2.5


def mean_sd(values: list[float]) -> tuple[float | None, float | None, int]:
    if not values:
        return None, None, 0
    m = stats.mean(values)
    sd = stats.stdev(values) if len(values) > 1 else 0.0
    return round(m, 2), round(sd, 2), len(values)


def paired_ttest(a: list[float], b: list[float]) -> dict | None:
    if len(a) != len(b) or len(a) < 2:
        return None
    diffs = [x - y for x, y in zip(a, b)]
    n = len(diffs)
    mean_d = stats.mean(diffs)
    sd_d = stats.stdev(diffs)
    if sd_d == 0:
        return {"n": n, "mean_diff": round(mean_d, 3), "t": None, "p_approx": None}
    t = mean_d / (sd_d / math.sqrt(n))
    return {"n": n, "mean_diff": round(mean_d, 3), "sd_diff": round(sd_d, 3), "t": round(t, 3)}


def one_sample_t_vs_benchmark(values: list[float], benchmark: float) -> dict | None:
    if len(values) < 2:
        return None
    n = len(values)
    m = stats.mean(values)
    sd = stats.stdev(values)
    if sd == 0:
        return {"n": n, "mean": round(m, 2), "benchmark": benchmark, "t": None}
    t = (m - benchmark) / (sd / math.sqrt(n))
    return {"n": n, "mean": round(m, 2), "sd": round(sd, 2), "benchmark": benchmark, "t": round(t, 3)}


def lecstu_method(method: str) -> str:
    m = method.lower()
    if "lecstu" in m or "system" in m or "both" in m:
        if "manual" in m and "both" not in m:
            return "manual"
        if "both" in m:
            return "both"
        return "lecstu"
    if "manual" in m:
        return "manual"
    return "other"


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    n_total = len(rows)

    # Optional: exclude researcher test accounts
    exclude_emails = ("shakiththiyan", "pirabakaran")
    rows_participants = [
        r for r in rows
        if not any(x in col(r, "Email").lower() for x in exclude_emails)
    ]
    n_participants = len(rows_participants)

    def analyze(dataset: list[dict], label: str) -> dict:
        sus = [s for r in dataset if (s := sus_score(r)) is not None]
        sus_items = {f"SUS{i}": [] for i in range(1, 11)}
        for r in dataset:
            for i in range(1, 11):
                v = num(col(r, f"SUS{i}"))
                if v is not None:
                    sus_items[f"SUS{i}"].append(v)

        tasks = {}
        for key, ease_p, sat_p in [
            ("T1", "T1a", "T1b"),
            ("T2", "T2 a", "T2 b"),
            ("T3", "T3 a", "T3 b"),
            ("T4", "T4 a", "T4 b"),
            ("T5", "T5", "T5 b"),
            ("T6", "T6 a", "T6 b"),
        ]:
            ease = [num(col(r, ease_p)) for r in dataset]
            sat = [num(col(r, sat_p)) for r in dataset]
            ease = [x for x in ease if x is not None]
            sat = [x for x in sat if x is not None]
            em, esd, en = mean_sd(ease)
            sm, ssd, sn = mean_sd(sat)
            tasks[key] = {"ease_mean": em, "ease_sd": esd, "ease_n": en,
                          "sat_mean": sm, "sat_sd": ssd, "sat_n": sn}

        t7 = {}
        for key, p in [("faster", "T7 a"), ("easier", "T7 b")]:
            vals = [num(col(r, p)) for r in dataset]
            vals = [x for x in vals if x is not None]
            m, sd, nn = mean_sd(vals)
            t7[key] = {"mean": m, "sd": sd, "n": nn}
        t7_yes = sum(1 for r in dataset if col(r, "T7 c").lower().startswith("y"))
        t7_no = sum(1 for r in dataset if col(r, "T7 c").lower() == "no")
        t7_blank = n_total - t7_yes - t7_no

        ai = {}
        for i in range(1, 6):
            vals = [num(col(r, f"AI{i}")) for r in dataset]
            vals = [x for x in vals if x is not None]
            m, sd, nn = mean_sd(vals)
            ai[f"AI{i}"] = {"mean": m, "sd": sd, "n": nn}

        features = {}
        for i in [1, 2, 3, 4, 5, 6, 8, 9, 10]:
            vals = [num(col(r, f"F{i}")) for r in dataset]
            vals = [x for x in vals if x is not None]
            m, sd, nn = mean_sd(vals)
            features[f"F{i}"] = {"mean": m, "sd": sd, "n": nn}

        recommend = [col(r, "O6").lower() for r in dataset if col(r, "O6")]
        rec_pos = sum(1 for x in recommend if x.startswith("y") or "yes" in x or "sure" in x or "ofcourse" in x.replace(" ", ""))

        # demographics
        ages = Counter(col(r, "A4.") for r in dataset)
        progs = Counter(col(r, "A5.") for r in dataset)
        years = Counter(col(r, "A6.") for r in dataset)
        langs = Counter(col(r, "A8.") for r in dataset)
        tech = [num(col(r, "A7.")) for r in dataset]
        tech = [x for x in tech if x is not None]
        tm, tsd, _ = mean_sd(tech)

        # paired: T1 ease vs T5 ease
        t1_t5 = []
        for r in dataset:
            a, b = num(col(r, "T1a")), num(col(r, "T5"))
            if a is not None and b is not None:
                t1_t5.append((a, b))
        paired_core_voice = paired_ttest([a for a, _ in t1_t5], [b for _, b in t1_t5])

        sus_m, sus_sd, sus_n = mean_sd(sus)
        sus_vs_68 = one_sample_t_vs_benchmark(sus, SUS_BENCHMARK)

        return {
            "label": label,
            "n": len(dataset),
            "demographics": {
                "age": dict(ages),
                "programme": dict(progs),
                "year": dict(years),
                "language": dict(langs),
                "tech_comfort_mean": tm,
                "tech_comfort_sd": tsd,
            },
            "sus": {
                "scores": [round(x, 1) for x in sus],
                "mean": sus_m,
                "sd": sus_sd,
                "min": round(min(sus), 1) if sus else None,
                "max": round(max(sus), 1) if sus else None,
                "vs_benchmark_68": sus_vs_68,
                "items_raw_mean": {k: round(stats.mean(v), 2) if v else None for k, v in sus_items.items()},
            },
            "tasks": tasks,
            "t7": {**t7, "would_use_again_yes": t7_yes, "would_use_again_no": t7_no},
            "ai_trust": ai,
            "features": features,
            "recommend_positive": rec_pos,
            "recommend_total": len(recommend),
            "paired_t1_ease_vs_t5_ease": paired_core_voice,
            "h4": {
                "testable": False,
                "reason": "No observer task-times CSV (manual vs AI seconds).",
                "preregistered_n": H4_TARGET_N,
                "collected_n": len(dataset),
            },
        }

    all_results = analyze(rows, "all_submissions")
    participant_results = analyze(rows_participants, "excluding_researcher_accounts")

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"source_csv": str(CSV_PATH), "all": all_results, "participants_only": participant_results}
    JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # Markdown report
    r = all_results
    lines = [
        "# Usability Study Analysis Report",
        "",
        f"**Source:** `{CSV_PATH.relative_to(ROOT)}`  ",
        f"**Generated by:** `research/usability-study/scripts/analyze_usability.py`  ",
        f"**Submissions analysed:** *n* = {r['n']} (all rows) · *n* = {participant_results['n']} (excluding researcher test emails)  ",
        "",
        "## H4 status",
        "",
        "**Not testable.** Preregistered H4 requires paired **observer** task times (manual vs AI). ",
        "Only Google Form questionnaires were exported; `task-times-*.csv` is absent.",
        "",
        f"Sample size: **{r['n']}** student questionnaires (target ≥ {H4_TARGET_N}). Lecturer/admin forms: **0**.",
        "",
        "## Demographics (all submissions)",
        "",
        f"- Age: {r['demographics']['age']}",
        f"- Programme: {r['demographics']['programme']}",
        f"- Year: {r['demographics']['year']}",
        f"- Preferred language: {r['demographics']['language']}",
        f"- Technology comfort: mean **{r['demographics']['tech_comfort_mean']}**, SD **{r['demographics']['tech_comfort_sd']}**",
        "",
        "## SUS (0–100)",
        "",
        f"| Metric | Value |",
        f"|---|---:|",
        f"| Mean | **{r['sus']['mean']}** |",
        f"| SD | {r['sus']['sd']} |",
        f"| Min–max | {r['sus']['min']} – {r['sus']['max']} |",
        f"| Industry benchmark | 68 |",
        f"| vs benchmark (one-sample *t*) | {r['sus']['vs_benchmark_68']} |",
        "",
        "## Task ease and satisfaction (1–5)",
        "",
        "| Task | Ease mean (SD) | *n* | Sat mean (SD) | *n* |",
        "|---|---:|---:|---:|---:|",
    ]
    for tk, tv in r["tasks"].items():
        lines.append(
            f"| {tk} | {tv['ease_mean']} ({tv['ease_sd']}) | {tv['ease_n']} | "
            f"{tv['sat_mean']} ({tv['sat_sd']}) | {tv['sat_n']} |"
        )
    lines += [
        "",
        "## Self-reported efficiency (T7)",
        "",
        f"- Faster than manual: mean **{r['t7']['faster']['mean']}** (SD {r['t7']['faster']['sd']}, *n*={r['t7']['faster']['n']})",
        f"- Easier than manual: mean **{r['t7']['easier']['mean']}** (SD {r['t7']['easier']['sd']}, *n*={r['t7']['easier']['n']})",
        f"- Would use again: **{r['t7']['would_use_again_yes']}** yes, **{r['t7']['would_use_again_no']}** no",
        "",
        "## AI trust (1–5)",
        "",
    ]
    for k, v in r["ai_trust"].items():
        lines.append(f"- {k}: mean **{v['mean']}** (SD {v['sd']}, *n*={v['n']})")
    lines += ["", "## Feature ratings (1–5)", ""]
    for k, v in r["features"].items():
        lines.append(f"- {k}: mean **{v['mean']}** (SD {v['sd']}, *n*={v['n']})")
    lines += [
        "",
        f"## Recommendation (O6): **{r['recommend_positive']}/{r['recommend_total']}** positive",
        "",
        "## Paired comparison (within-subject)",
        "",
        f"T1 ease vs T5 ease (voice): {r['paired_t1_ease_vs_t5_ease']}",
        "",
        "## RO-4 conclusion",
        "",
        "**Partially achieved:** satisfaction, SUS, and qualitative themes support perceived usefulness of core features. ",
        "**Not achieved via H4:** timed 25% reduction criterion untested.",
        "",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REPORT_PATH}")
    print(f"Wrote {JSON_PATH}")
    print(json.dumps({"n": r["n"], "sus_mean": r["sus"]["mean"], "h4_testable": False}, indent=2))


if __name__ == "__main__":
    main()
