# Translation Benchmark (Phase 9.3)

Automated BLEU + semantic similarity evaluation for cloud vs transformer translation engines.

## Setup

```bash
cd research/translation-eval
pip install -r requirements.txt

# Marian engine (local)
pip install -r ../../ai-services/translation/requirements.txt

# Google Cloud (optional)
# Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON
```

## Run

```bash
cd research/translation-eval/scripts

# Quick smoke test
python run_benchmark.py --limit 3 --runs 1 --engine marian

# Full benchmark (600 tasks × 2 engines × 3 runs = 3600 translations)
python run_benchmark.py

# Cloud only / transformer only
python run_benchmark.py --engine google
python run_benchmark.py --engine marian

# Analyze latest results
python analyze_benchmark.py
```

## Output

| Location | Content |
|----------|---------|
| `research/translation-eval/results/translation_benchmark_*.json` | Raw results + aggregated stats |
| `research/logs/translation_benchmark_*.json` | Experiment log summary |

## Experiment matrix

| Engine group | Engine | Directions | Sentences | Runs |
|--------------|--------|------------|-----------|------|
| Cloud | `google` | en↔ta, en↔si, ta↔si | 100 each | 3 |
| Transformer | `marian` | en↔ta, en↔si, ta↔si | 100 each | 3 |

Corpus input: `research/datasets/translation/corpus_manifest.json` (Phase 9.2).

## Metrics per translation

- **BLEU** — n-gram overlap vs human reference (`research/lib/bleu_calculator.py`)
- **Semantic similarity** — cosine of multilingual sentence embeddings
- **Latency** — milliseconds from translation service

---

# Human Evaluation (Phase 9.4)

Blind, randomized human evaluation of candidate translations plus inter-rater
reliability analysis.

## 1. Build the evaluation instrument

```bash
cd research/translation-eval/scripts
python build_human_eval.py                 # 30 sentences per language pair
python build_human_eval.py --per-pair 20   # smaller study
```

Outputs to `research/datasets/translation/human-eval/`:

| File | Purpose |
|------|---------|
| `human_eval_form.csv` / `.json` | Blind rating form (source + candidate only) |
| `rater_template.csv` | Copy per evaluator → `ratings_<name>.csv` |
| `answer_key.json` | Engine / reference mapping (kept separate = blind) |
| `INSTRUCTIONS.md` | Rubric + procedure for evaluators |

The instrument is blind (engines interleaved, opaque item IDs) and balanced
across complexity levels.

## 2. Collect ratings

Each of the 5–10 bilingual evaluators copies `rater_template.csv` to
`ratings_<name>.csv`, fills `fluency`, `adequacy`, `overall` (1–5), and saves it
back into the `human-eval/` folder.

## 3. Analyze

```bash
python analyze_human_eval.py
```

Computes descriptive stats per engine × pair × dimension and inter-rater
reliability (Krippendorff's α ordinal, mean pairwise weighted Cohen's κ,
within-1 agreement — see `research/lib/agreement_metrics.py`), flags
low-agreement items, and writes `human_eval_summary.json`.

---

# Comparative Report (Phase 9.5)

Consolidates automated (9.3) + human (9.4) results, runs statistics, generates
plots, and writes the final report deciding H3.

```bash
python generate_comparative_report.py
```

Outputs:

| Location | Content |
|----------|---------|
| `research/reports/translation_evaluation_report.md` | Final comparative report |
| `research/translation-eval/results/*.png` | BLEU / similarity / latency bars, human box plot, automated-vs-human scatter, speed-vs-quality |

Statistics: paired t-test + Wilcoxon (cloud vs transformer per pair), Cohen's d
effect size, Pearson/Spearman correlation of BLEU & similarity vs human scores.
Sections that depend on the cloud engine or on human ratings degrade gracefully
to a documented *deferred/pending* state until that data is available.
