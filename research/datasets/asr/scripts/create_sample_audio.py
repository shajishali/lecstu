#!/usr/bin/env python3
"""
Create minimal sample WAV files for testing the benchmark (Phase 7.3).
Generates 1-second silence or sine-tone files so the pipeline can run
before real recordings are available.
"""
import json
import wave
import struct
import math
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
SAMPLE_RATE = 16000


def create_silence_wav(path: Path, duration_sec: float = 1.0):
    """Create a WAV file of silence."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n_samples = int(SAMPLE_RATE * duration_sec)
    with wave.open(str(path), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = struct.pack(f"<{n_samples}h", *([0] * n_samples))
        wav.writeframes(frames)


def main():
    manifest_path = ASR_DIR / "dataset_manifest.json"
    if not manifest_path.exists():
        print("Run generate_manifest_template.py first")
        return 1

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    created = 0
    for u in data.get("utterances", []):
        audio_path = ASR_DIR / u["audio_path"]
        if not audio_path.exists():
            create_silence_wav(audio_path, duration_sec=1.0)
            created += 1

    print(f"Created {created} sample audio files (1s silence each)")
    print("Replace with real recordings for actual benchmark.")
    return 0


if __name__ == "__main__":
    exit(main())
