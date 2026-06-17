# Parallel Translation Corpus Curation Methodology (Phase 9.2)

## Overview

This document describes the methodology for curating the LECSTU parallel translation benchmark corpus used in RO-3 (Phase 9) experiments. The corpus supports automated BLEU and semantic similarity evaluation of cloud and transformer translation engines for English, Tamil, and Sinhala academic content.

---

## 1. Dataset Requirements

| Requirement | Specification |
|-------------|---------------|
| **Language pairs** | En–Ta, En–Si, Ta–Si |
| **Pairs per direction** | 100 sentence pairs per language pair |
| **Total pairs** | 300 |
| **Aligned sentences** | 100 unique trilingual sentence sets |
| **Categories** | Timetable, appointment, navigation, notification, general |
| **Complexity** | Simple, moderate, complex |

---

## 2. Content Categories

### 2.1 Timetable
Queries and responses about lecture schedules, weekly timetables, and class times.

### 2.2 Appointment
Booking, cancelling, rescheduling, and status messages for lecturer meetings.

### 2.3 Navigation
Indoor and campus direction instructions, building transitions, and QR positioning prompts.

### 2.4 Notification
Platform notification messages (confirmations, reminders, updates, cancellations).

### 2.5 General
Hall availability, platform UI strings, faculty information, and other academic phrases.

---

## 3. Sentence Sources

| IDs | Source | Count | Review status |
|-----|--------|-------|---------------|
| 001–050 | Phase 7.2 ASR `utterances.yaml` (trilingual ground truth) | 50 | `asr_aligned` |
| 051–100 | Platform extension (`extra_sentences.yaml`) | 50 | `primary_draft` |

The first 50 sentences reuse the same academic domain content as the ASR benchmark, ensuring cross-modality consistency between RO-1 and RO-3. ASR category `halls` is mapped to `general` for translation taxonomy; `directions` maps to `navigation`; `appointments` maps to `appointment`.

---

## 4. Translation & Review Methodology

### 4.1 Primary translation
1. **ASR-aligned set (001–050):** Tamil and Sinhala reference text taken from the Phase 7.2 corpus (same semantic content used for ASR ground truth).
2. **Extension set (051–100):** Primary draft translations produced by bilingual researchers familiar with the LECSTU platform domain.

### 4.2 Secondary review (double-check)
1. A second native speaker reviewer checks each target sentence for:
   - Fluency and naturalness in the target language
   - Semantic adequacy (meaning preserved from source)
   - Domain terminology consistency (hall names, building codes, academic terms)
2. Discrepancies are resolved by discussion or a third reviewer.
3. Sign-off is recorded in `review_log.json` (translator ID, reviewer ID, date, status).

### 4.3 Review status values

| Status | Meaning |
|--------|---------|
| `asr_aligned` | Aligned from verified ASR trilingual corpus |
| `primary_draft` | Primary translation complete; pending secondary review |
| `reviewed` | Secondary reviewer approved |
| `disputed` | Requires third-party resolution |

---

## 5. Complexity Levels

Assigned per sentence based on English source length and structure:

| Level | Rule (English) | Target distribution |
|-------|----------------|---------------------|
| **simple** | ≤ 7 words | ~34% |
| **moderate** | 8–14 words | ~33% |
| **complex** | ≥ 15 words | ~33% |

Extension sentences (051–100) have explicit complexity tags in `extra_sentences.yaml`.

---

## 6. Manifest Schema

Each entry in `corpus_manifest.json` → `pairs[]`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique pair ID (e.g. `en_ta_timetable_001`) |
| `source_text` | string | Source language sentence |
| `target_text` | string | Human reference translation |
| `source_lang` | string | `en`, `ta`, or `si` |
| `target_lang` | string | `en`, `ta`, or `si` |
| `language_pair` | string | `en-ta`, `en-si`, or `ta-si` |
| `category` | string | Content category |
| `complexity` | string | `simple`, `moderate`, or `complex` |
| `sentence_id` | string | Shared alignment ID (`001`–`100`) |
| `corpus_source` | string | `asr_corpus` or `platform_extension` |
| `review_status` | string | Review workflow status |

---

## 7. Directory Structure

```
research/datasets/translation/
├── corpus_manifest.json       # 300 parallel pairs (generated)
├── extra_sentences.yaml       # 50 extension trilingual sentences
├── METHODOLOGY.md             # This document
├── README.md                  # Quick start
├── review_log.json            # Human reviewer sign-off tracking
├── scripts/
│   ├── build_corpus_manifest.py
│   └── validate_manifest.py
└── human-eval/                # Phase 9.4 human evaluation scores
```

---

## 8. Ethics & Data Use

- Corpus text is synthetic/platform-domain content; no personal data.
- Human reviewers provide informed consent before participating in translation review or evaluation (see `research/usability-study/instruments/ethics_plan.md`).
- Corpus is for research use within the LECSTU project; cite in thesis methodology section.

---

## 9. Regenerating the Manifest

```bash
cd research/datasets/translation/scripts
python build_corpus_manifest.py
python validate_manifest.py
```

---

## 10. Next Steps (Phase 9.3)

Use `corpus_manifest.json` as input to `/research/translation-eval/scripts/run_benchmark.py` for BLEU and semantic similarity benchmarks across cloud and transformer engines.
