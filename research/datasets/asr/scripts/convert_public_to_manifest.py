#!/usr/bin/env python3
"""
Convert public ASR datasets to LECSTU finetuning manifest format.

Supported formats:
  - librispeech: LibriSpeech (transcript + FLAC structure)
  - common_voice: Mozilla Common Voice (TSV with path, sentence)
  - openslr_tsv: OpenSLR-style (utt_spk_text.tsv or similar)

Output: JSON manifest with { audio_path, text, language } per utterance.
Place output in finetuning/public_manifests/ then run prepare_finetuning_manifests.py.
"""
import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ASR_DIR = SCRIPT_DIR.parent
FINETUNING_DIR = ASR_DIR / "finetuning"
PUBLIC_MANIFESTS = FINETUNING_DIR / "public_manifests"


def convert_librispeech(data_dir: Path, output_path: Path, lang: str = "en", max_utterances: int = 0, audio_prefix: str = ""):
    """
    LibriSpeech: data_dir contains e.g. train-clean-100/ with speaker/chapter/segment.flac
    and .trans.txt files.
    """
    utterances = []
    for trans_file in data_dir.rglob("*.trans.txt"):
        trans_file = Path(trans_file)
        audio_dir = trans_file.parent
        with open(trans_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split(" ", 1)
                if len(parts) != 2:
                    continue
                uid, text = parts[0], parts[1]
                audio_path = audio_dir / f"{uid}.flac"
                if not audio_path.exists():
                    continue
                rel_path = str(audio_path.relative_to(data_dir)).replace("\\", "/")
                if audio_prefix:
                    rel_path = f"{audio_prefix.rstrip('/')}/{rel_path}"
                utterances.append({"audio_path": rel_path, "text": text, "language": lang})
                if max_utterances and len(utterances) >= max_utterances:
                    break
        if max_utterances and len(utterances) >= max_utterances:
            break

    _write_manifest(utterances, output_path)
    return len(utterances)


def convert_common_voice(tsv_path: Path, clips_dir: Path, output_path: Path, lang: str = "en", max_utterances: int = 0, audio_prefix: str = ""):
    """
    Common Voice: tsv_path has columns path, sentence (or text).
    clips_dir is the folder containing the audio clips.
    """
    utterances = []
    with open(tsv_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    if not lines:
        return 0
    header = lines[0].strip().split("\t")
    path_idx = header.index("path") if "path" in header else 0
    text_idx = header.index("sentence") if "sentence" in header else (header.index("text") if "text" in header else 1)
    for line in lines[1:]:
        parts = line.strip().split("\t")
        if len(parts) <= max(path_idx, text_idx):
            continue
        rel_path = parts[path_idx]
        text = parts[text_idx].strip()
        if not text:
            continue
        full_audio = clips_dir / rel_path
        if not full_audio.exists():
            continue
        path_for_manifest = f"{audio_prefix.rstrip('/')}/{rel_path}" if audio_prefix else rel_path
        utterances.append({"audio_path": path_for_manifest, "text": text, "language": lang})
        if max_utterances and len(utterances) >= max_utterances:
            break

    _write_manifest(utterances, output_path)
    return len(utterances)


def convert_openslr_tsv(tsv_path: Path, audio_dir: Path, output_path: Path, lang: str, max_utterances: int = 0, audio_prefix: str = ""):
    """
    OpenSLR TSV: utt_spk_text.tsv with columns utterance_id, speaker_id, text.
    Audio files typically in audio_dir with structure from dataset.
    """
    utterances = []
    with open(tsv_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 3:
                continue
            utt_id, spk_id, text = parts[0], parts[1], parts[2]
            if not text:
                continue
            # Try common patterns: audio_dir/utt_id.wav or audio_dir/spk_id/utt_id.wav
            for candidate in [audio_dir / f"{utt_id}.wav", audio_dir / spk_id / f"{utt_id}.wav"]:
                if candidate.exists():
                    rel = str(candidate.relative_to(audio_dir)).replace("\\", "/")
                    if audio_prefix:
                        rel = f"{audio_prefix.rstrip('/')}/{rel}"
                    utterances.append({"audio_path": rel, "text": text, "language": lang})
                    break
            if max_utterances and len(utterances) >= max_utterances:
                break

    _write_manifest(utterances, output_path)
    return len(utterances)


def _write_manifest(utterances, output_path: Path, base_dir: Path = None):
    """Write manifest. audio_path is relative to finetuning directory."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out = [{"audio_path": u["audio_path"], "text": u["text"], "language": u["language"]} for u in utterances]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"utterances": out, "version": "1.0"}, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Convert public ASR datasets to finetuning manifest")
    parser.add_argument("format", choices=["librispeech", "common_voice", "openslr_tsv"])
    parser.add_argument("--input", "-i", required=True, help="Path to data (dir or TSV)")
    parser.add_argument("--clips-dir", help="For common_voice: path to clips folder")
    parser.add_argument("--audio-dir", help="For openslr_tsv: path to audio folder")
    parser.add_argument("--output", "-o", help="Output manifest path (default: finetuning/public_manifests/<name>.json)")
    parser.add_argument("--lang", "-l", default="en", help="Language code (en, ta, si)")
    parser.add_argument("--max", "-n", type=int, default=0, help="Max utterances (0 = all)")
    parser.add_argument("--audio-prefix", "-p", default="", help="Prefix for audio paths (e.g. audio/public_en for finetuning dir)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input not found: {input_path}")
        return 1

    PUBLIC_MANIFESTS.mkdir(parents=True, exist_ok=True)
    out_name = f"public_{args.lang}_{args.format}.json"
    output_path = Path(args.output) if args.output else PUBLIC_MANIFESTS / out_name

    prefix = args.audio_prefix
    count = 0
    if args.format == "librispeech":
        count = convert_librispeech(input_path, output_path, args.lang, args.max, prefix)
    elif args.format == "common_voice":
        clips = Path(args.clips_dir) if args.clips_dir else input_path.parent / "clips"
        if not clips.exists():
            print(f"ERROR: Clips dir not found: {clips}")
            return 1
        count = convert_common_voice(input_path, clips, output_path, args.lang, args.max, prefix)
    elif args.format == "openslr_tsv":
        audio_dir = Path(args.audio_dir) if args.audio_dir else input_path.parent
        count = convert_openslr_tsv(input_path, audio_dir, output_path, args.lang, args.max, prefix)

    print(f"Converted {count} utterances -> {output_path}")
    print("Run prepare_finetuning_manifests.py to merge into train/val.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
