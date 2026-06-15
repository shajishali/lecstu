# LECSTU NLP Evaluation — Phase 8.3

NLU evaluation for the Rasa chatbot (RO-2).

## Quick Run

From project root:

```powershell
cd research/nlp-evaluation/scripts
.\run_nlp_evaluation.ps1
```

Or from chatbot directory:

```powershell
cd ai-services/chatbot
rasa test nlu --cross-validation --folds 5 --out ../../research/nlp-evaluation/results/cv-5fold
rasa test nlu --model models/<latest>.tar.gz --nlu ../../research/datasets/nlp/test_data.yml --out ../../research/nlp-evaluation/results/heldout
```

## Outputs

- `results/cv-5fold/` — 5-fold cross-validation metrics
- `results/heldout/` — Held-out test set metrics

Rasa generates:
- `intent_report.json` — Per-intent precision, recall, F1
- `entity_report.json` — Per-entity metrics
- `intent_confusion_matrix.png` — Confusion matrix visualization
- `errors.json` — Misclassified examples
