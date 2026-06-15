# Finetuning Datasets (Phase 7.6)

Sources, licenses, and preparation instructions for Whisper finetuning on English, Tamil, and Sinhala.

---

## 1. Dataset Sources

### English

| Dataset | URL | Size | License | Notes |
|---------|-----|------|---------|-------|
| **LibriSpeech** | [openslr.org/12](https://www.openslr.org/12) | train-clean-100: 6.3 GB (100 hrs) | CC BY 4.0 | Read speech, 16 kHz FLAC. Use `train-clean-100` or `dev-clean` for smaller footprint. |
| **Mozilla Common Voice** | [commonvoice.mozilla.org](https://commonvoice.mozilla.org) / [Mozilla Data Collective](https://datacollective.mozillafoundation.org) | Variable (e.g. 87 GB for CV 24.0) | CC0 (Public Domain) | Crowdsourced, MP3. Convert to 16 kHz WAV for Whisper. |

### Tamil

| Dataset | URL | Size | License | Notes |
|---------|-----|------|---------|-------|
| **IISc-MILE Tamil (SLR127)** | [openslr.org/127](https://www.openslr.org/127) | ~13 GB (~150 hrs) | CC BY 2.0 | Read speech, 16 kHz WAV. 531 speakers. |
| **Crowdsourced Tamil (SLR65)** | [openslr.org/65](https://www.openslr.org/65) | ~2.5 GB | CC BY 4.0 | Alternative; smaller. |

### Sinhala

| Dataset | URL | Size | License | Notes |
|---------|-----|------|---------|-------|
| **Large Sinhala ASR (SLR52)** | [openslr.org/52](https://www.openslr.org/52) | ~8 GB (9 zip files) | CC BY-SA 4.0 | ~185k utterances. TSV: `utt_spk_text.tsv`. |
| **sinscribe-sinhala-stt** | [Hugging Face](https://huggingface.co/datasets) | Variable | Check HF card | Community dataset. |

---

## 2. Academic Dataset (Phase 7.2)

- **Source**: LECSTU Phase 7.2 benchmark dataset
- **Utterances**: 150 (50 per language: en, ta, si)
- **Categories**: Timetable, Halls, Appointments, Directions, General
- **Format**: 16 kHz WAV mono
- **Path**: `../audio/` (relative to finetuning dir)
- **License**: Project-internal; see `METHODOLOGY.md`

---

## 3. Manifest Format

Unified format per utterance:

```json
{
  "audio_path": "path/relative/to/finetuning/dir",
  "text": "transcription text",
  "language": "en"
}
```

- **audio_path**: Relative to `research/datasets/asr/finetuning/`
- **text**: Normalized transcription
- **language**: `en`, `ta`, or `si`

---

## 4. Preparation Workflow

### 4.1 Academic Data (Always Included)

```bash
cd research/datasets/asr
python scripts/prepare_finetuning_manifests.py
```

This merges the 150 academic utterances and produces `train_manifest.json` and `val_manifest.json` (90/10 split).

### 4.2 Adding Public Datasets

1. **Download** the dataset to a local directory.
2. **Extract** and optionally copy/symlink into `finetuning/audio/public_<lang>/`.
3. **Convert** to manifest format:

   **LibriSpeech:**
   ```bash
   python scripts/convert_public_to_manifest.py librispeech \
     -i /path/to/LibriSpeech \
     -l en \
     -p audio/public_en
   ```

   **Common Voice:**
   ```bash
   python scripts/convert_public_to_manifest.py common_voice \
     -i /path/to/cv-corpus-*/en/train.tsv \
     -l en \
     -p audio/public_en
   ```

   **OpenSLR (Tamil SLR127 / Sinhala SLR52):**
   ```bash
   python scripts/convert_public_to_manifest.py openslr_tsv \
     -i /path/to/utt_spk_text.tsv \
     --audio-dir /path/to/audio_files \
     -l ta \
     -p audio/public_ta
   ```

4. **Re-run** `prepare_finetuning_manifests.py` to merge public manifests into train/val.

---

## 5. Directory Layout

```
finetuning/
  train_manifest.json      # Training utterances
  val_manifest.json        # Validation utterances
  audio/                   # Symlinks or copies to datasets
    (academic uses ../audio/ from parent asr dir)
    public_en/             # LibriSpeech, Common Voice, etc.
    public_ta/             # SLR127, SLR65, etc.
    public_si/             # SLR52, sinscribe, etc.
  public_manifests/        # Converted public dataset manifests
    public_en_librispeech.json
    public_ta_openslr_tsv.json
    public_si_openslr_tsv.json
  FINETUNING_DATASETS.md   # This file
```

---

## 6. Audio Requirements

- **Sample rate**: 16 kHz (Whisper expects 16 kHz)
- **Channels**: Mono
- **Format**: WAV (PCM) or FLAC. MP3 (Common Voice) should be converted to WAV before training.

---

## 7. Licenses Summary

| Dataset | License |
|---------|---------|
| LibriSpeech | CC BY 4.0 |
| Mozilla Common Voice | CC0 (Public Domain) |
| IISc-MILE Tamil (SLR127) | CC BY 2.0 |
| SLR65 Tamil | CC BY 4.0 |
| Large Sinhala ASR (SLR52) | CC BY-SA 4.0 |

Ensure compliance with each license when using and redistributing models trained on these datasets.

---

*LECSTU Phase 7.6 — Finetuning Dataset Acquisition & Preparation*
