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
