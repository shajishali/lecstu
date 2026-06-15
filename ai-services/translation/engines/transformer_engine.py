"""
Transformer translation engine — MarianMT.
Uses Helsinki-NLP models for En↔Si, En↔Ta; Ta↔Si uses pivot via English.
"""
import time
from typing import Optional

# Model mapping: (src, tgt) -> (model_name, optional prefix for multilingual)
EN_SI_MODEL = "Helsinki-NLP/opus-mt-en-inc"
SI_EN_MODEL = "Helsinki-NLP/opus-mt-inc-en"
EN_TA_MODEL = "Helsinki-NLP/opus-mt-en-mul"  # prefix >>tam<< for Tamil
TA_EN_MODEL = "Helsinki-NLP/opus-mt-mul-en"


def _get_device() -> str:
    """Auto-detect GPU/CPU."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def _load_pipeline(model_name: str):
    """Lazy-load translation pipeline."""
    from transformers import pipeline
    device_id = 0 if _get_device() == "cuda" else -1
    return pipeline("translation", model=model_name, device=device_id)


_pipeline_cache: dict[str, object] = {}


def _translate_with_model(model_name: str, text: str, prefix: Optional[str] = None) -> tuple[str, float]:
    """Run translation. Returns (translated_text, latency_ms)."""
    if model_name not in _pipeline_cache:
        _pipeline_cache[model_name] = _load_pipeline(model_name)
    pipe = _pipeline_cache[model_name]
    input_text = (prefix or "") + text
    start = time.perf_counter()
    out = pipe(input_text, max_length=512)
    latency_ms = (time.perf_counter() - start) * 1000
    translated = out[0]["translation_text"] if out else ""
    return translated, latency_ms


def translate_marian(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate via MarianMT.
    Returns: { translated_text, latency_ms, engine [, error] }
    """
    src = src_lang.lower()[:2]
    tgt = tgt_lang.lower()[:2]
    pair = (src, tgt)

    supported = {("en", "si"), ("si", "en"), ("en", "ta"), ("ta", "en"), ("ta", "si"), ("si", "ta")}
    if pair not in supported:
        return {"translated_text": "", "latency_ms": 0, "engine": "marian", "error": f"Unsupported pair: {src}->{tgt}"}

    total_latency = 0.0

    try:
        if pair == ("en", "si"):
            translated, lat = _translate_with_model(EN_SI_MODEL, text, ">>sin<< ")
        elif pair == ("si", "en"):
            translated, lat = _translate_with_model(SI_EN_MODEL, text, None)
        elif pair == ("en", "ta"):
            translated, lat = _translate_with_model(EN_TA_MODEL, text, ">>tam<< ")
        elif pair == ("ta", "en"):
            translated, lat = _translate_with_model(TA_EN_MODEL, text, ">>tam<< ")
        elif pair == ("ta", "si"):
            # Pivot: Ta -> En -> Si
            t1, lat1 = _translate_with_model(TA_EN_MODEL, text, None)
            t2, lat2 = _translate_with_model(EN_SI_MODEL, t1, ">>sin<< ")
            translated, lat = t2, lat1 + lat2
        else:  # ("si", "ta")
            # Pivot: Si -> En -> Ta
            t1, lat1 = _translate_with_model(SI_EN_MODEL, text, None)
            t2, lat2 = _translate_with_model(EN_TA_MODEL, t1, None)
            translated, lat = t2, lat1 + lat2

        return {"translated_text": translated, "latency_ms": round(lat, 2), "engine": "marian"}
    except Exception as e:
        return {"translated_text": "", "latency_ms": 0, "engine": "marian", "error": str(e)}
