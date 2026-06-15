# ASR Benchmark Dataset (Phase 7.2)

Ground truth dataset for ASR evaluation (RO-1). Used by Phase 7.3 benchmark experiments.

## Quick Start

1. **Utterance prompts** are in `utterances.yaml` (50 per language).
2. **Generate manifest template:** `python scripts/generate_manifest_template.py` (creates 150 entries).
3. **Record audio** following `METHODOLOGY.md`.
4. **Transcribe** manually (double-verified by native speakers).
5. **Update** `dataset_manifest.json` with speaker_id, duration_sec, noise_level.
6. **Validate:** `python scripts/validate_manifest.py`
7. **Sample audio (testing):** `python scripts/create_sample_audio.py` — creates 1s silence WAVs so benchmark (7.3) can run before real recordings.

## File Layout

| File | Purpose |
|------|---------|
| `utterances.yaml` | 150 prompt texts (50 × 3 languages) by category |
| `dataset_manifest.json` | Manifest with ground truth, paths, metadata |
| `METHODOLOGY.md` | Recording and transcription methodology |
| `audio/` | WAV files (16 kHz mono) |

## Minimum for Benchmark (7.3)

The benchmark runner expects:
- `dataset_manifest.json` with at least one utterance per language
- Audio files at paths specified in `audio_path`

For testing, you can add a few sample recordings; full 150-utterance dataset is required for complete evaluation.

## Finetuning (Phase 7.6)

The `finetuning/` folder contains manifests and scripts for Whisper finetuning:

1. **Academic data** (150 utterances) is merged automatically.
2. **Public datasets** (LibriSpeech, Common Voice, SLR127, SLR52) can be added via `scripts/convert_public_to_manifest.py`.
3. Run `python scripts/prepare_finetuning_manifests.py` to generate `train_manifest.json` and `val_manifest.json`.

See `finetuning/FINETUNING_DATASETS.md` for dataset sources, licenses, and preparation workflow.
