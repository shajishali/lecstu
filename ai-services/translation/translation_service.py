"""
Unified translation interface.
Dispatches to cloud (Google/Azure) or transformer (MarianMT, mBART) engine.
"""
from typing import Optional

SUPPORTED_LANGUAGES = ["en", "ta", "si"]
SUPPORTED_ENGINES = ["google", "azure", "marian", "mbart"]
LANGUAGE_PAIRS = [
    ("en", "ta"), ("ta", "en"),
    ("en", "si"), ("si", "en"),
    ("ta", "si"), ("si", "ta"),
]


def translate(
    text: str,
    src_lang: str = "en",
    tgt_lang: str = "ta",
    engine: str = "google",
) -> dict:
    """
    Unified translation.
    Returns: { translated_text, latency_ms, engine [, error] }
    """
    src = src_lang.lower()[:2] if src_lang else "en"
    tgt = tgt_lang.lower()[:2] if tgt_lang else "ta"
    eng = engine.lower() if engine else "google"

    if src == tgt:
        return {"translated_text": text, "latency_ms": 0, "engine": eng}

    if eng not in SUPPORTED_ENGINES:
        return {"translated_text": "", "latency_ms": 0, "engine": eng, "error": f"Unknown engine: {engine}"}

    if eng == "marian":
        from engines.transformer_engine import translate_marian
        return translate_marian(text, src, tgt)
    if eng == "mbart":
        from engines.mbart_engine import translate_mbart
        return translate_mbart(text, src, tgt)
    if eng == "google":
        from engines.cloud_translator import translate_google
        return translate_google(text, src, tgt)
    if eng == "azure":
        from engines.cloud_translator import translate_azure
        return translate_azure(text, src, tgt)

    return {"translated_text": "", "latency_ms": 0, "engine": eng, "error": "Unknown engine"}
