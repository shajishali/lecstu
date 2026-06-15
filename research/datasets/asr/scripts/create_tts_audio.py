#!/usr/bin/env python3
"""
Generate TTS (Text-to-Speech) audio from reference text for ASR benchmark.
Uses gTTS for English, Tamil, and Sinhala. Output: 16 kHz WAV mono.
Requires ffmpeg for mp3->wav conversion.

Usage:
  python create_tts_audio.py              # All utterances
  python create_tts_audio.py --limit 10    # First 10 only
  python create_tts_audio.py --overwrite  # Replace existing files
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
SAMPLE_RATE = 16000

# gTTS language codes
LANG_MAP = {"en": "en", "ta": "ta", "si": "si"}


def mp3_to_wav_ffmpeg(mp3_path: Path, wav_path: Path, sample_rate: int = 16000) -> bool:
    """Convert mp3 to 16kHz mono WAV using ffmpeg."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    cmd = [
        ffmpeg, "-y", "-i", str(mp3_path),
        "-ar", str(sample_rate), "-ac", "1",
        str(wav_path)
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True, timeout=30)
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def main():
    parser = argparse.ArgumentParser(description="Create TTS audio from manifest")
    parser.add_argument("--limit", type=int, default=None, help="Limit utterances (for quick test)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing audio files")
    args = parser.parse_args()

    try:
        from gtts import gTTS
    except ImportError:
        print("Install gTTS: pip install gtts")
        return 1

    if not shutil.which("ffmpeg"):
        print("ffmpeg not found. Install it (e.g. winget install Gyan.FFmpeg) for mp3->wav conversion.")
        return 1

    manifest_path = ASR_DIR / "dataset_manifest.json"
    if not manifest_path.exists():
        print("Run generate_manifest_template.py first")
        return 1

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    utterances = data.get("utterances", [])
    if args.limit:
        utterances = utterances[: args.limit]

    created = 0
    for i, u in enumerate(utterances):
        audio_path = ASR_DIR / u["audio_path"]
        if audio_path.exists() and not args.overwrite:
            continue

        text = u.get("text", "")
        lang = u.get("language", "en")
        if not text:
            continue

        gtts_lang = LANG_MAP.get(lang, "en")
        audio_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            tts = gTTS(text=text, lang=gtts_lang, slow=False)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            tts.save(str(tmp_path))

            if mp3_to_wav_ffmpeg(tmp_path, audio_path, SAMPLE_RATE):
                created += 1
                print(f"[{i + 1}/{len(utterances)}] {u['id']} -> {audio_path.name}")
            else:
                print(f"SKIP {u['id']}: ffmpeg conversion failed")
            tmp_path.unlink(missing_ok=True)
        except Exception as e:
            print(f"SKIP {u['id']}: {e}")

    print(f"\nCreated {created} TTS audio files. Run benchmark with real audio.")
    return 0


if __name__ == "__main__":
    exit(main())
