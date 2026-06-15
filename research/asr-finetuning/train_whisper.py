#!/usr/bin/env python3
"""
Whisper finetuning for LECSTU (Phase 7.7).

Loads train/val manifests from research/datasets/asr/finetuning/,
fine-tunes Whisper base or small with LoRA (or full fine-tuning),
and saves the model to models/lecstu-whisper-{base|small}-en-ta-si/.

Usage:
  python train_whisper.py [--model base|small] [--use-lora] [--epochs 3] [--batch-size 4]

Requires: GPU (CUDA) recommended. Install: pip install -r requirements.txt
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Project paths
SCRIPT_DIR = Path(__file__).resolve().parent
RESEARCH_DIR = SCRIPT_DIR.parent
DATASETS_ASR = RESEARCH_DIR / "datasets" / "asr"
FINETUNING_DIR = DATASETS_ASR / "finetuning"
MODELS_DIR = SCRIPT_DIR / "models"

# Language mapping for Whisper tokenizer (HF uses full names)
LANG_MAP = {"en": "English", "ta": "Tamil", "si": "Sinhala"}


def load_manifest(path: Path) -> list:
    """Load manifest JSON with utterances."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("utterances", data) if isinstance(data, dict) else data


def load_audio(audio_path: str, base_dir: Path, target_sr: int = 16000) -> tuple:
    """Load audio file, return (array, sample_rate). Resamples to target_sr if needed."""
    import soundfile as sf

    full_path = (base_dir / audio_path).resolve()
    if not full_path.exists():
        raise FileNotFoundError(f"Audio not found: {full_path}")
    data, sr = sf.read(str(full_path))
    if sr != target_sr:
        import librosa
        data = librosa.resample(data.astype(float), orig_sr=sr, target_sr=target_sr)
        sr = target_sr
    return data, sr


def create_dataset_from_manifest(manifest_path: Path, base_dir: Path):
    """Create HuggingFace Dataset from manifest JSON."""
    from datasets import Dataset, Features, Value, Audio as AudioFeature

    utterances = load_manifest(manifest_path)
    rows = []
    for u in utterances:
        audio_path = u.get("audio_path", "")
        text = u.get("text", "")
        lang = u.get("language", "en")
        if not audio_path or not text:
            continue
        try:
            data, sr = load_audio(audio_path, base_dir)
            rows.append({"audio": {"array": data, "sampling_rate": sr}, "text": text, "language": lang})
        except Exception as e:
            print(f"WARNING: Skip {audio_path}: {e}")
            continue

    if not rows:
        raise ValueError(f"No valid utterances in {manifest_path}")

    return Dataset.from_list(rows)


def main():
    parser = argparse.ArgumentParser(description="Finetune Whisper for LECSTU (Phase 7.7)")
    parser.add_argument("--model", "-m", default="base", choices=["tiny", "base", "small", "medium"])
    parser.add_argument("--use-lora", action="store_true", help="Use LoRA (default: True for base/small)")
    parser.add_argument("--no-lora", action="store_true", help="Full fine-tuning (no LoRA)")
    parser.add_argument("--epochs", "-e", type=int, default=3)
    parser.add_argument("--batch-size", "-b", type=int, default=4)
    parser.add_argument("--lr", type=float, default=1e-5)
    parser.add_argument("--grad-accum", type=int, default=2)
    parser.add_argument("--output-dir", "-o", default=None)
    parser.add_argument("--train-manifest", default=None)
    parser.add_argument("--val-manifest", default=None)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--eval-steps", type=int, default=100)
    parser.add_argument("--save-steps", type=int, default=100)
    parser.add_argument("--early-stopping", type=int, default=3, help="Stop if no WER improvement for N evals")
    args = parser.parse_args()

    use_lora = not args.no_lora and (args.use_lora or args.model in ("base", "small", "tiny"))

    train_manifest = Path(args.train_manifest or str(FINETUNING_DIR / "train_manifest.json"))
    val_manifest = Path(args.val_manifest or str(FINETUNING_DIR / "val_manifest.json"))

    if not train_manifest.exists():
        print(f"ERROR: Train manifest not found: {train_manifest}")
        print("Run: python research/datasets/asr/scripts/prepare_finetuning_manifests.py")
        return 1

    if not val_manifest.exists():
        print(f"ERROR: Val manifest not found: {val_manifest}")
        return 1

    output_dir = args.output_dir or str(MODELS_DIR / f"lecstu-whisper-{args.model}-en-ta-si")
    os.makedirs(output_dir, exist_ok=True)

    # Import heavy deps after arg parsing
    import torch
    from transformers import (
        AutoProcessor,
        WhisperForConditionalGeneration,
        Seq2SeqTrainingArguments,
        Seq2SeqTrainer,
        TrainerCallback,
        EarlyStoppingCallback,
    )
    from transformers.trainer_utils import PREFIX_CHECKPOINT_DIR

    if use_lora:
        try:
            from peft import LoraConfig, get_peft_model
        except ImportError:
            print("WARNING: peft not installed. Falling back to full fine-tuning.")
            use_lora = False

    model_name = f"openai/whisper-{args.model}"
    print(f"Loading processor and model: {model_name}")
    processor = AutoProcessor.from_pretrained(model_name)
    model = WhisperForConditionalGeneration.from_pretrained(model_name)

    # Multilingual: no forced decoder, model learns from data
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("WARNING: No GPU found. Training will be slow.")

    model = model.to(device)

    if use_lora:
        from peft import LoraConfig, get_peft_model
        lora_config = LoraConfig(
            r=32,
            lora_alpha=64,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
        )
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()

    # Load datasets
    base_dir = FINETUNING_DIR
    print("Loading train dataset...")
    train_ds = create_dataset_from_manifest(train_manifest, base_dir)
    print("Loading val dataset...")
    val_ds = create_dataset_from_manifest(val_manifest, base_dir)

    # Data collator
    from dataclasses import dataclass
    from typing import Any, Dict, List, Union

    @dataclass
    class DataCollatorSpeechSeq2SeqWithPadding:
        processor: Any

        def __call__(self, features: List[Dict]) -> Dict[str, torch.Tensor]:
            input_features = [{"input_features": f["input_features"]} for f in features]
            batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")

            label_features = [{"input_ids": f["labels"]} for f in features]
            labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
            labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)

            if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]
            batch["labels"] = labels
            return batch

    # Precompute features for efficiency
    def map_prepare(example):
        audio = example["audio"]
        text = example["text"]
        lang = example["language"]
        feat = processor.feature_extractor(
            audio["array"],
            sampling_rate=audio["sampling_rate"],
            return_tensors="pt",
        )
        lang_name = LANG_MAP.get(lang, "English")
        prompt_ids = processor.get_decoder_prompt_ids(language=lang_name, task="transcribe")
        prompt_token_ids = [tid for _, tid in prompt_ids]
        transcript_ids = processor.tokenizer(text, add_special_tokens=False).input_ids
        labels = prompt_token_ids + transcript_ids + [processor.tokenizer.eos_token_id]
        return {"input_features": feat.input_features[0].numpy(), "labels": labels}

    train_ds = train_ds.map(map_prepare, remove_columns=train_ds.column_names, num_proc=1)
    val_ds = val_ds.map(map_prepare, remove_columns=val_ds.column_names, num_proc=1)

    data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    # Save PEFT adapter callback
    class SavePeftModelCallback(TrainerCallback):
        def on_save(self, args, state, control, **kwargs):
            if use_lora and "model" in kwargs:
                checkpoint_folder = os.path.join(args.output_dir, f"{PREFIX_CHECKPOINT_DIR}-{state.global_step}")
                peft_path = os.path.join(checkpoint_folder, "adapter_model")
                kwargs["model"].save_pretrained(peft_path)
                pytorch_path = os.path.join(checkpoint_folder, "pytorch_model.bin")
                if os.path.exists(pytorch_path):
                    os.remove(pytorch_path)
            return control

    # WER metric
    import evaluate
    metric = evaluate.load("wer")

    def compute_metrics(pred):
        pred_ids = pred.predictions
        label_ids = pred.label_ids
        label_ids = np.where(label_ids != -100, label_ids, processor.tokenizer.pad_token_id)
        pred_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
        label_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)
        wer = metric.compute(predictions=pred_str, references=label_str)
        return {"wer": wer}

    import numpy as np

    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_steps=50,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps > 0 else -1,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
        fp16=torch.cuda.is_available(),
        report_to=["tensorboard"],
        logging_steps=25,
        remove_unused_columns=False,
        label_names=["labels"],
        generation_max_length=225,
        predict_with_generate=True,
    )

    callbacks = [SavePeftModelCallback]
    if args.early_stopping > 0:
        try:
            callbacks.append(EarlyStoppingCallback(early_stopping_patience=args.early_stopping))
        except Exception:
            pass  # EarlyStoppingCallback may not exist in older transformers

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=data_collator,
        tokenizer=processor.feature_extractor,
        callbacks=callbacks,
        compute_metrics=compute_metrics,
    )
    model.config.use_cache = False

    print("Starting training...")
    trainer.train()

    # Save final model
    if use_lora:
        model.save_pretrained(os.path.join(output_dir, "adapter_final"))
        processor.save_pretrained(output_dir)
    else:
        trainer.save_model(output_dir)
        processor.save_pretrained(output_dir)

    print(f"Model saved to {output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
