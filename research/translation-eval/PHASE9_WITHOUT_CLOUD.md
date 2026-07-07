# Phase 9 — Continue Without Google Cloud Translation

Cloud API benchmarking is **excluded** from this study (billing / project constraints).
Evaluation uses:

| Component | Status | Artifact |
|-----------|--------|----------|
| Transformer (Marian) automated benchmark | Done | `translation-eval/results/translation_benchmark_20260617_132336.json` |
| Human evaluation (fluency / adequacy / overall) | **In progress** | `datasets/translation/human-eval/` |
| Comparative report | Generated (cloud = deferred) | `reports/translation_evaluation_report.md` |

## Step 1 — Send forms to evaluators

```bash
cd research/translation-eval/scripts
python package_evaluator_bundle.py
```

Creates: `research/datasets/translation/human-eval/lecstu-human-eval-bundle.zip`

Share the zip + text from `EVALUATOR_MESSAGE.txt` with **5–10 bilingual** university staff or students.

Each evaluator returns: `ratings_<name>.csv`

## Step 2 — Collect ratings

Copy every returned file into:

```
research/datasets/translation/human-eval/ratings_alice.csv
research/datasets/translation/human-eval/ratings_bob.csv
...
```

## Step 3 — Analyze + regenerate report

```bash
cd research/translation-eval/scripts
python analyze_human_eval.py
python generate_comparative_report.py
```

Outputs:
- `human_eval_summary.json` — means + Krippendorff's α + Cohen's κ
- `reports/translation_evaluation_report.md` — updated with human results

## Step 4 — Thesis wording (H3 without cloud)

> Automated evaluation used the local Marian transformer (1800 tasks, six language directions).
> Cloud Translation API comparison was not performed due to Google Cloud billing verification
> requirements. Human evaluation (N bilingual raters, 180 blind items) provides the primary
> quality assessment. H3 (transformer vs cloud semantic similarity) is reported as deferred;
> conclusions on translation quality rely on automated Marian metrics and human scores.

## Optional — commit ratings

```bash
git add research/datasets/translation/human-eval/ratings_*.csv
git commit -m "Add human translation evaluation ratings"
git push origin main
```
