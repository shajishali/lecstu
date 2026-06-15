#!/usr/bin/env python3
"""
Prepare finetuning manifests (Phase 7.6).

Merges Phase 7.2 academic dataset with optional public datasets,
produces unified format { audio_path, text, language } per utterance,
and creates train/val split (90/10) stratified by language.

Usage:
  python scripts/prepare_finetuning_manifests.py

Output:
  finetuning/train_manifest.json
  finetuning/val_manifest.json
"""
import json
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
FINETUNING_DIR = ASR_DIR / "finetuning"
VAL_RATIO = 0.1
SEED = 42


def load_academic_utterances():
    """Load Phase 7.2 academic dataset and convert to unified format."""
    manifest_path = ASR_DIR / "dataset_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"Phase 7.2 manifest not found: {manifest_path}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    utterances = []
    for u in data.get("utterances", []):
        # Path relative to finetuning dir: academic audio lives at ../audio/...
        audio_path = f"../{u['audio_path']}"
        utterances.append({
            "audio_path": audio_path,
            "text": u["text"],
            "language": u["language"],
            "source": "academic",
            "id": u.get("id", ""),
        })
    return utterances


def load_public_manifest(manifest_path: Path):
    """Load additional utterances from a public dataset manifest."""
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    utterances = []
    for u in data.get("utterances", data) if isinstance(data, dict) else data:
        if isinstance(u, dict) and "audio_path" in u and "text" in u:
            utterances.append({
                "audio_path": u["audio_path"],
                "text": u["text"],
                "language": u.get("language", "en"),
                "source": u.get("source", "public"),
            })
    return utterances


def stratified_split(utterances, val_ratio=VAL_RATIO, seed=SEED):
    """Split by language to preserve distribution in train/val."""
    random.seed(seed)
    by_lang = {}
    for u in utterances:
        lang = u["language"]
        by_lang.setdefault(lang, []).append(u)

    train, val = [], []
    for lang, items in by_lang.items():
        random.shuffle(items)
        n_val = max(1, int(len(items) * val_ratio))
        val.extend(items[:n_val])
        train.extend(items[n_val:])

    random.shuffle(train)
    random.shuffle(val)
    return train, val


def main():
    FINETUNING_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load academic dataset (Phase 7.2)
    academic = load_academic_utterances()
    print(f"Loaded {len(academic)} academic utterances from Phase 7.2")

    # 2. Optionally load public dataset manifests from finetuning/public/
    all_utterances = list(academic)
    public_dir = FINETUNING_DIR / "public_manifests"
    if public_dir.exists():
        for p in public_dir.glob("*.json"):
            try:
                extra = load_public_manifest(p)
                all_utterances.extend(extra)
                print(f"  + {len(extra)} from {p.name}")
            except Exception as e:
                print(f"  WARNING: Could not load {p}: {e}")

    if not all_utterances:
        print("ERROR: No utterances to process")
        return 1

    # 3. Stratified train/val split
    train, val = stratified_split(all_utterances)
    print(f"Split: {len(train)} train, {len(val)} val")

    # 4. Write manifests (unified format: audio_path, text, language)
    train_out = [{"audio_path": u["audio_path"], "text": u["text"], "language": u["language"]} for u in train]
    val_out = [{"audio_path": u["audio_path"], "text": u["text"], "language": u["language"]} for u in val]

    train_path = FINETUNING_DIR / "train_manifest.json"
    val_path = FINETUNING_DIR / "val_manifest.json"

    with open(train_path, "w", encoding="utf-8") as f:
        json.dump({"utterances": train_out, "version": "1.0", "source": "LECSTU Phase 7.6"}, f, ensure_ascii=False, indent=2)

    with open(val_path, "w", encoding="utf-8") as f:
        json.dump({"utterances": val_out, "version": "1.0", "source": "LECSTU Phase 7.6"}, f, ensure_ascii=False, indent=2)

    print(f"Wrote {train_path}")
    print(f"Wrote {val_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
