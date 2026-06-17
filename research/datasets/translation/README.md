# Parallel Translation Corpus (Phase 9.2)

Human reference parallel corpus for translation evaluation (RO-3). Used by Phase 9.3 benchmark experiments.

## Quick Start

1. **Extension sentences** are in `extra_sentences.yaml` (ids 051–100).
2. **ASR-aligned sentences** (ids 001–050) are loaded from `../asr/utterances.yaml`.
3. **Build manifest:** `python scripts/build_corpus_manifest.py`
4. **Validate:** `python scripts/validate_manifest.py`
5. **Review sign-off:** update `review_log.json` as native speakers verify translations.

## Corpus Summary

| Metric | Value |
|--------|-------|
| Unique sentences | 100 (trilingual aligned) |
| Language pairs | En–Ta, En–Si, Ta–Si |
| Pairs per direction | 100 |
| Total pairs | 300 |
| Categories | timetable, appointment, navigation, notification, general |

## File Layout

| File | Purpose |
|------|---------|
| `corpus_manifest.json` | 300 parallel pairs with metadata |
| `extra_sentences.yaml` | 50 platform-specific trilingual sentences |
| `METHODOLOGY.md` | Corpus creation and review methodology |
| `review_log.json` | Translator/reviewer sign-off tracking |
| `scripts/build_corpus_manifest.py` | Generate manifest from YAML sources |
| `scripts/validate_manifest.py` | Validate schema and counts |

## Minimum for Benchmark (9.3)

The benchmark runner expects:
- `corpus_manifest.json` with 300 pairs (100 per language pair)
- All required fields populated (`source_text`, `target_text`, `language_pair`, etc.)

## Human Review

Sentences 001–050 are aligned from the Phase 7.2 ASR corpus (`review_status: asr_aligned`).
Sentences 051–100 are primary drafts (`review_status: primary_draft`) and should be double-checked by native Tamil and Sinhala speakers before thesis submission.
