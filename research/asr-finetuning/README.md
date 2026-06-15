# Whisper Finetuning (Phase 7.7)

Finetune OpenAI Whisper for LECSTU academic domain (En/Ta/Si) using Phase 7.6 manifests.

## Quick Start

```bash
# 1. Install dependencies (GPU recommended)
pip install -r requirements.txt

# 2. Optional: Download LibriSpeech for more English data
cd research/datasets/asr
python scripts/download_and_prepare.py --max-samples 300

# 3. Prepare manifests (merges academic + any public data)
python scripts/prepare_finetuning_manifests.py

# 4. Run finetuning (LoRA by default for base/small)
cd ../../asr-finetuning
python train_whisper.py --model base --epochs 3 --batch-size 4
```

**One-liner (from project root):**
```powershell
.\research\run_download_and_finetune.ps1
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--model` | base | Whisper size: tiny, base, small, medium |
| `--use-lora` | auto | Use LoRA (default for base/small/tiny) |
| `--no-lora` | - | Full fine-tuning instead of LoRA |
| `--epochs` | 3 | Training epochs |
| `--batch-size` | 4 | Per-device batch size |
| `--lr` | 1e-5 | Learning rate |
| `--grad-accum` | 2 | Gradient accumulation steps |
| `--early-stopping` | 3 | Stop after N evals without WER improvement |

## Output

- **Models**: `models/lecstu-whisper-{base|small}-en-ta-si/`
- **Checkpoints**: Saved during training (last 2 kept)
- **TensorBoard**: `runs/` in output dir

## Requirements

- Python 3.9+
- CUDA GPU (recommended; CPU is slow)
- ~4–8 GB GPU VRAM for base with LoRA
