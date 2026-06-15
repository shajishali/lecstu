#!/usr/bin/env python3
"""
Download public ASR datasets via Hugging Face and prepare for finetuning.

Uses HF datasets to avoid manual download; fetches on first run.
Supports: LibriSpeech (English), with optional max samples for quick testing.

Usage:
  python scripts/download_and_prepare.py [--max-samples 500] [--split validation]
"""
import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
FINETUNING_DIR = ASR_DIR / "finetuning"
AUDIO_PUBLIC = FINETUNING_DIR / "audio" / "public_en"
PUBLIC_MANIFESTS = FINETUNING_DIR / "public_manifests"


def download_librispeech(max_samples: int = 0, split: str = "validation"):
    """Download LibriSpeech via HF datasets, save to disk, return manifest entries."""
    from datasets import load_dataset, Audio
    import soundfile as sf

    print(f"Loading LibriSpeech ({split}) from Hugging Face...")
    try:
        ds = load_dataset("librispeech_asr", "clean", split=split)
    except Exception:
        ds = load_dataset("openslr/librispeech_asr", "clean", split=split)

    # Resample to 16 kHz
    ds = ds.cast_column("audio", Audio(sampling_rate=16000))

    AUDIO_PUBLIC.mkdir(parents=True, exist_ok=True)
    PUBLIC_MANIFESTS.mkdir(parents=True, exist_ok=True)

    utterances = []
    for i, ex in enumerate(ds):
        if max_samples and i >= max_samples:
            break
        uid = ex.get("id", f"ls_{i}")
        text = ex.get("text", "").strip()
        audio = ex["audio"]
        if not text or audio is None:
            continue
        # Save to audio/public_en/librispeech/{uid}.wav
        rel_path = f"librispeech/{uid}.wav"
        out_path = AUDIO_PUBLIC / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            sf.write(str(out_path), audio["array"], audio["sampling_rate"])
        except Exception as e:
            print(f"  Skip {uid}: {e}")
            continue
        # Path relative to finetuning dir
        manifest_path = f"audio/public_en/{rel_path}"
        utterances.append({"audio_path": manifest_path, "text": text, "language": "en"})

    return utterances


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-samples", "-n", type=int, default=500, help="Max LibriSpeech samples (0=all)")
    parser.add_argument("--split", default="validation", choices=["validation", "test.clean", "train.clean.100"])
    args = parser.parse_args()

    utterances = download_librispeech(max_samples=args.max_samples or 0, split=args.split)
    if not utterances:
        print("ERROR: No utterances downloaded")
        return 1

    manifest_path = PUBLIC_MANIFESTS / "public_en_librispeech.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"utterances": utterances, "version": "1.0"}, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(utterances)} utterances to {manifest_path}")
    print("Run: python scripts/prepare_finetuning_manifests.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
