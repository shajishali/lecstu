"""
OpenAI Whisper ASR engine wrapper.
Supports tiny, base, small, medium models. Auto-detects GPU/CPU.
"""
import time
from typing import Optional

# Language code mapping (Whisper uses ISO 639-1)
LANG_MAP = {
    "en": "en",
    "english": "en",
    "ta": "ta",
    "tamil": "ta",
    "si": "si",
    "sinhala": "si",
}


def _get_device() -> str:
    """Detect CUDA availability for GPU acceleration."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def transcribe(
    audio_path: str,
    language: str = "en",
    model_size: str = "base",
) -> dict:
    """
    Transcribe audio using Whisper.
    Returns: { "text": str, "confidence": float, "latency_ms": float }
    """
    start = time.perf_counter()

    try:
        import whisper
    except ImportError:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": "Whisper not installed. Run: pip install openai-whisper",
        }

    lang_code = LANG_MAP.get(language.lower(), language[:2] if len(language) >= 2 else "en")

    device = _get_device()
    model = whisper.load_model(model_size, device=device)

    result = model.transcribe(audio_path, language=lang_code, fp16=(device == "cuda"))

    latency_ms = (time.perf_counter() - start) * 1000

    text = (result.get("text") or "").strip()

    # Whisper doesn't provide per-word confidence; use heuristic from avg_logprob if available
    confidence = 0.9
    if result.get("segments"):
        avg_logprobs = [s.get("avg_logprob") for s in result["segments"] if s.get("avg_logprob") is not None]
        if avg_logprobs:
            import math
            avg_prob = math.exp(sum(avg_logprobs) / len(avg_logprobs))
            confidence = min(1.0, max(0.0, avg_prob))

    return {
        "text": text,
        "confidence": round(confidence, 2),
        "latency_ms": round(latency_ms, 1),
    }
