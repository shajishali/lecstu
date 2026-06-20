 # Translation Automated Benchmark Report (Phase 9.3)

**Research Objective (RO-3)**: Implement and comparatively evaluate machine translation approaches for English-Tamil-Sinhala academic content.

**Research Question (RQ-3)**: How do cloud translation APIs compare to multilingual transformer models in quality and speed for English-Tamil-Sinhala pairs?

**Hypothesis (H3)**: Multilingual transformer models produce higher semantic similarity scores than cloud APIs for Tamil and Sinhala academic text.

**Report Date**: 2026-06-18

---

## 1. Scope

This report closes the automated benchmark portion of Phase 9.3. It evaluates the local transformer translation engine (`marian`) on the curated Phase 9.2 parallel corpus using BLEU, multilingual semantic similarity, and latency.

The cloud API benchmark path is implemented in `research/translation-eval/scripts/run_benchmark.py`, but the full cloud run was not executed because Google/Azure credentials are external to the repository. Cloud comparison remains a Phase 9.5 reporting input once credentials are available.

---

## 2. Methodology

### 2.1 Corpus

- **Source**: `research/datasets/translation/corpus_manifest.json`
- **Validated size**: 300 bilingual pair entries, representing 100 trilingual sentence sets
- **Language directions evaluated**: en-ta, ta-en, en-si, si-en, ta-si, si-ta
- **Categories**: timetable, appointment, navigation, notification, general

### 2.2 Benchmark Runner

- **Script**: `research/translation-eval/scripts/run_benchmark.py`
- **Analyzer**: `research/translation-eval/scripts/analyze_benchmark.py`
- **BLEU calculator**: `research/lib/bleu_calculator.py`
- **Similarity calculator**: `research/lib/similarity_calculator.py`
- **Embedding model**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`

Each translation task records:

- Candidate translation text
- BLEU score against the human reference
- Semantic similarity against the human reference
- Translation latency in milliseconds
- Engine, language pair, run number, sentence id, and category metadata

### 2.3 Executed Run

- **Result file**: `research/translation-eval/results/translation_benchmark_20260617_132336.json`
- **Experiment log**: `research/logs/translation_benchmark_20260617_132336.json`
- **Engine**: `marian`
- **Sentence sets**: 100
- **Directions**: 6
- **Runs per configuration**: 3
- **Total rows**: 1800
- **Errors**: 0

---

## 3. Results

### 3.1 BLEU

| Language Pair | Mean BLEU | Std. Dev. | Samples |
|---------------|-----------|-----------|---------|
| en-ta | 0.0051 | 0.0506 | 300 |
| ta-en | 0.0419 | 0.1486 | 300 |
| en-si | 0.0108 | 0.0623 | 300 |
| si-en | 0.0782 | 0.1875 | 300 |
| ta-si | 0.0037 | 0.0364 | 300 |
| si-ta | 0.0000 | 0.0000 | 300 |

BLEU is very low across most directions. This is expected to some degree for short academic sentences and morphologically rich target languages, where valid translations can differ substantially from the reference at the token level. BLEU should therefore be interpreted alongside semantic similarity and later human evaluation.

### 3.2 Semantic Similarity

| Language Pair | Mean Similarity | Std. Dev. | Samples |
|---------------|-----------------|-----------|---------|
| en-ta | 0.8612 | 0.1231 | 300 |
| ta-en | 0.5083 | 0.2502 | 300 |
| en-si | 0.8749 | 0.1283 | 300 |
| si-en | 0.6722 | 0.1830 | 300 |
| ta-si | 0.8433 | 0.1630 | 300 |
| si-ta | 0.3430 | 0.1947 | 300 |

Semantic similarity is strongest for English-to-Tamil, English-to-Sinhala, and Tamil-to-Sinhala directions. Sinhala-to-Tamil is the weakest direction and should be prioritized for manual inspection during Phase 9.4.

### 3.3 Latency

| Language Pair | Mean Latency (ms) | Std. Dev. | Samples |
|---------------|-------------------|-----------|---------|
| en-ta | 1589.1 | 901.5 | 300 |
| ta-en | 2817.5 | 6017.1 | 300 |
| en-si | 1401.6 | 3552.9 | 300 |
| si-en | 1114.2 | 2954.7 | 300 |
| ta-si | 2252.4 | 4985.3 | 300 |
| si-ta | 2862.2 | 5405.7 | 300 |

Latency is usable for asynchronous translation and chatbot response translation, but the high standard deviation suggests model warm-up, pivot translation, or local hardware effects. Phase 9.5 should report median and outlier behavior alongside mean latency.

---

## 4. Interpretation

The automated benchmark confirms that the Phase 9 translation evaluation pipeline is operational and reproducible. The local Marian-based transformer engine completed all 1800 benchmark rows with zero runtime errors.

The most important quality signal is the gap between BLEU and semantic similarity. BLEU scores are near zero for several directions, while embedding similarity is strong for three directions. This suggests lexical overlap alone is not enough for evaluating English-Tamil-Sinhala academic translations. Human adequacy and fluency scoring in Phase 9.4 is needed before accepting or rejecting H3.

Cloud-vs-transformer comparison is not yet statistically answerable because the cloud benchmark was not run. The runner supports `--engine google` and the same metric pipeline, so adding cloud results requires credentials rather than new benchmark code.

---

## 5. Phase 9.3 Status

Phase 9.3 is complete for the automated benchmark implementation and the available local transformer run:

- Benchmark runner implemented
- BLEU, semantic similarity, and latency captured
- Three repetitions per transformer configuration completed
- Raw result JSON and structured research log generated
- Analysis script verified against the latest result file

Remaining dependency for Phase 9.5:

- Execute the cloud API benchmark when Google/Azure credentials are available, or document credential unavailability as a study limitation in the final translation comparative report.
