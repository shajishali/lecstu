# ASR Benchmark (Phase 7.3)

Runs WER/CER and latency experiments for Whisper, Google Speech, and Azure Speech on the Phase 7.2 dataset.

## Prerequisites

- **Python** with ai-services/asr deps installed (`pip install -r ai-services/asr/requirements.txt`)
- **ffmpeg** on PATH (required by Whisper for audio loading)
- **Dataset** with audio files (run `create_sample_audio.py` in datasets/asr/scripts/ for test data)

## Usage

```bash
# From project root
cd D:\Reasearch\lecstu

# Full benchmark (150 utterances × 5 Whisper configs + Google × 3 runs = long)
python research/asr-benchmark/scripts/run_benchmark.py

# Quick test (2 utterances, tiny model, 1 run)
python research/asr-benchmark/scripts/run_benchmark.py --limit 2 --model tiny --runs 1 --engine whisper

# Whisper only, base model
python research/asr-benchmark/scripts/run_benchmark.py --engine whisper --model base

# English only
python research/asr-benchmark/scripts/run_benchmark.py --language en

# Azure Speech only (requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)
python research/asr-benchmark/scripts/run_benchmark.py --engine azure
```

## Output

- **Results:** `research/asr-benchmark/results/asr_benchmark_YYYYMMDD_HHMMSS.json`
- **Log:** `research/logs/asr_benchmark_YYYYMMDD_HHMMSS.json`

## Phase 7.4 — Statistical Analysis

After running the benchmark:

```bash
python research/asr-benchmark/scripts/analyze_benchmark.py
```

Uses the latest result by default. Options:
- `--result PATH` — Analyze specific result file
- Produces: `research/reports/asr_benchmark_report.md` + plots in `results/`

## ffmpeg on Windows

Whisper needs ffmpeg to load audio. Install via:
- [ffmpeg releases](https://github.com/BtbN/FFmpeg-Builds/releases) — extract and add `bin/` to PATH
- Or: `winget install ffmpeg`
