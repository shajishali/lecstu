# Translation Human Evaluation — Instructions (Phase 9.4)

Thank you for evaluating machine-translated academic sentences for the LECSTU
project. Your ratings help us compare translation engines for English, Tamil,
and Sinhala.

## What you will do

You will see a list of items. Each item has:
- **source_text** — the original sentence
- **candidate_translation** — a machine translation to rate

You do **not** know which engine produced each translation. Please rate each
item honestly and independently.

## Rating scale (1–5)

Rate every item on three dimensions:

| Dimension | Question | 1 | 5 |
|-----------|----------|---|---|
| **Fluency** | Does it read naturally in the target language? | Not fluent at all | Perfectly natural |
| **Adequacy** | Is the original meaning fully preserved? | Meaning lost | Meaning fully preserved |
| **Overall** | Your overall quality judgement | Very poor | Excellent |

Guidance:
- **5** — Native-quality; no changes needed.
- **4** — Good; minor issues only.
- **3** — Acceptable; understandable but noticeable errors.
- **2** — Poor; hard to understand or meaning distorted.
- **1** — Unusable; wrong or nonsensical.

## How to submit

1. Copy `rater_template.csv` to `ratings_<yourname>.csv`
   (e.g. `ratings_anusha.csv`).
2. Fill the `fluency`, `adequacy`, and `overall` columns with a whole number 1–5.
3. Leave a cell blank only if you truly cannot judge that item.
4. Save the file in this folder (`research/datasets/translation/human-eval/`).

## After collection

Run the analysis to compute scores and inter-rater reliability:

```bash
cd research/translation-eval/scripts
python analyze_human_eval.py
```

Please keep evaluations independent — do not discuss individual items with
other evaluators before submitting.
