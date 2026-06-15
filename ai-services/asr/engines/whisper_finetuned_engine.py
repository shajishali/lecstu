"""
Finetuned Whisper ASR engine (Phase 7.8).

Loads LECSTU finetuned model from research/asr-finetuning/models/.
Uses Hugging Face transformers (not openai-whisper).
Same interface: transcribe(audio_path, language) -> { text, confidence, latency_ms }
"""
import os
import time
from pathlib import Path
from typing import Optional

# Default model path (relative to project root)
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_MODEL_PATH = _PROJECT_ROOT / "research" / "asr-finetuning" / "models" / "lecstu-whisper-tiny-en-ta-si"

# HF WhisperProcessor uses full language names
LANG_MAP = {
    "en": "English",
    "english": "English",
    "ta": "Tamil",
    "tamil": "Tamil",
    "si": "Sinhala",
    "sinhala": "Sinhala",
}

_model_cache = None
_processor_cache = None


def _get_model_path() -> Path:
    """Resolve model path from env or default."""
    path = os.environ.get("LECSTU_WHISPER_FINETUNED_PATH")
    if path:
        return Path(path)
    return _DEFAULT_MODEL_PATH


def transcribe(
    audio_path: str,
    language: str = "en",
    model_path: Optional[str] = None,
) -> dict:
    """
    Transcribe audio using finetuned Whisper (HF transformers).
    Returns: { "text": str, "confidence": float, "latency_ms": float }
    """
    global _model_cache, _processor_cache

    start = time.perf_counter()

    try:
        import torch
        from transformers import AutoProcessor, WhisperForConditionalGeneration
    except ImportError:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": "transformers not installed. Run: pip install transformers torch",
        }

    path = Path(model_path) if model_path else _get_model_path()
    if not path.exists():
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": f"Finetuned model not found at {path}. Run Phase 7.7 finetuning first.",
        }

    lang_name = LANG_MAP.get(language.lower(), "English")
    device = "cuda" if torch.cuda.is_available() else "cpu"

    try:
        if _model_cache is None or _processor_cache is None:
            _processor_cache = AutoProcessor.from_pretrained(str(path))
            _model_cache = WhisperForConditionalGeneration.from_pretrained(str(path))
            _model_cache = _model_cache.to(device)

        processor = _processor_cache
        model = _model_cache

        import soundfile as sf
        audio_data, sr = sf.read(audio_path)
        if sr != 16000:
            import librosa
            audio_data = librosa.resample(audio_data.astype(float), orig_sr=sr, target_sr=16000)

        inputs = processor(audio_data, sampling_rate=16000, return_tensors="pt")
        input_features = inputs.input_features.to(device)

        forced_decoder_ids = processor.get_decoder_prompt_ids(language=lang_name, task="transcribe")

        with torch.no_grad():
            generated_ids = model.generate(
                input_features,
                forced_decoder_ids=forced_decoder_ids,
                max_new_tokens=255,
            )

        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

        latency_ms = (time.perf_counter() - start) * 1000

        return {
            "text": text,
            "confidence": 0.9,
            "latency_ms": round(latency_ms, 1),
        }

    except Exception as e:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": round((time.perf_counter() - start) * 1000, 1),
            "error": str(e),
        }
