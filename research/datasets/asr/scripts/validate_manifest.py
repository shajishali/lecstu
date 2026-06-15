#!/usr/bin/env python3
"""
Validate dataset_manifest.json:
- Schema and required fields
- Audio file existence
- Language/category consistency
"""
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
VALID_LANGS = {"en", "ta", "si"}
VALID_CATEGORIES = {"timetable", "halls", "appointments", "directions", "general"}
VALID_NOISE = {"clean", "moderate"}


def validate():
    manifest_path = ASR_DIR / "dataset_manifest.json"
    if not manifest_path.exists():
        print("ERROR: dataset_manifest.json not found")
        return 1

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    utterances = data.get("utterances", [])
    if not utterances:
        print("WARNING: No utterances in manifest")

    errors = []
    missing_audio = []
    ids_seen = set()

    for i, u in enumerate(utterances):
        uid = u.get("id", f"#{i}")
        if uid in ids_seen:
            errors.append(f"{uid}: duplicate id")
        ids_seen.add(uid)

        for field in ["id", "speaker_id", "language", "category", "text", "audio_path"]:
            if field not in u:
                errors.append(f"{uid}: missing field '{field}'")

        if u.get("language") not in VALID_LANGS:
            errors.append(f"{uid}: invalid language '{u.get('language')}'")
        if u.get("category") not in VALID_CATEGORIES:
            errors.append(f"{uid}: invalid category '{u.get('category')}'")
        if u.get("noise_level") and u["noise_level"] not in VALID_NOISE:
            errors.append(f"{uid}: invalid noise_level '{u.get('noise_level')}'")

        audio_path = ASR_DIR / u.get("audio_path", "")
        if u.get("audio_path") and not audio_path.exists():
            missing_audio.append(u["audio_path"])

    if errors:
        for e in errors:
            print(f"ERROR: {e}")
    if missing_audio:
        print(f"\nWARNING: {len(missing_audio)} audio files not found (expected before full benchmark):")
        for p in missing_audio[:5]:
            print(f"  - {p}")
        if len(missing_audio) > 5:
            print(f"  ... and {len(missing_audio) - 5} more")

    by_lang = {}
    for u in utterances:
        lang = u.get("language", "?")
        by_lang[lang] = by_lang.get(lang, 0) + 1

    print(f"\nManifest: {len(utterances)} utterances")
    for lang, count in sorted(by_lang.items()):
        print(f"  {lang}: {count}")

    if errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(validate())
