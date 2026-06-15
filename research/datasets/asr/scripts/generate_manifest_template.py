#!/usr/bin/env python3
"""
Generate dataset_manifest.json template from utterances.yaml.
Creates 150 placeholder entries (50 per language) with expected audio paths.
Researchers fill in speaker_id, duration_sec, noise_level after recording.
"""
import json
import yaml
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent


def main():
    utterances_path = ASR_DIR / "utterances.yaml"
    manifest_path = ASR_DIR / "dataset_manifest.json"

    with open(utterances_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    utterances = []
    idx = 1
    for lang, categories in data.items():
        for category, texts in categories.items():
            for i, text in enumerate(texts):
                uid = f"{lang}_{category}_{i+1:03d}"
                # Placeholder: researchers assign speaker after recording
                speaker_id = "S01"  # Replace with actual S01..S05
                audio_path = f"audio/{lang}/{speaker_id}/{uid}.wav"
                utterances.append({
                    "id": uid,
                    "speaker_id": speaker_id,
                    "language": lang,
                    "category": category,
                    "text": text,
                    "audio_path": audio_path,
                    "noise_level": "clean",
                    "duration_sec": 0.0,
                    "notes": "",
                })
                idx += 1

    manifest = {
        "$schema": "Dataset manifest for LECSTU ASR benchmark (Phase 7.2)",
        "version": "1.0",
        "recording": {
            "format": "wav",
            "sample_rate": 16000,
            "channels": 1,
            "encoding": "PCM_16",
        },
        "utterances": utterances,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(utterances)} entries -> {manifest_path}")
    print(f"  English: {sum(1 for u in utterances if u['language']=='en')}")
    print(f"  Tamil:   {sum(1 for u in utterances if u['language']=='ta')}")
    print(f"  Sinhala: {sum(1 for u in utterances if u['language']=='si')}")


if __name__ == "__main__":
    main()
