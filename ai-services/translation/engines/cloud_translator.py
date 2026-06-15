"""
Cloud translation engine — Google Translate / Azure Translator.
Requires API credentials via environment variables.
"""
import os
import time
from typing import Optional

# Supported pairs: en↔ta, en↔si, ta↔si
SUPPORTED_PAIRS = {
    ("en", "ta"), ("ta", "en"),
    ("en", "si"), ("si", "en"),
    ("ta", "si"), ("si", "ta"),
}


def _normalize_lang(code: str) -> str:
    """Map LECSTU codes to cloud API codes."""
    m = {"en": "en", "ta": "ta", "si": "si"}
    return m.get(code.lower()[:2], "en")


def translate_google(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate via Google Cloud Translation API.
    Returns: { translated_text, latency_ms, engine [, error] }
    Requires: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_TRANSLATE_API_KEY
    """
    src = _normalize_lang(src_lang)
    tgt = _normalize_lang(tgt_lang)
    if (src, tgt) not in SUPPORTED_PAIRS:
        return {"translated_text": "", "latency_ms": 0, "engine": "google", "error": f"Unsupported pair: {src}->{tgt}"}

    start = time.perf_counter()
    try:
        # Try v2 (simpler) first; v3 requires project ID
        from google.cloud import translate_v2 as translate

        client = translate.Client()
        result = client.translate(text, source_language=src, target_language=tgt)
        if isinstance(result, dict):
            translated = result.get("translatedText", "")
        elif isinstance(result, list) and result:
            translated = result[0].get("translatedText", "")
        else:
            translated = ""
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            "translated_text": translated,
            "latency_ms": round(latency_ms, 2),
            "engine": "google",
        }
    except ImportError:
        return {"translated_text": "", "latency_ms": 0, "engine": "google", "error": "google-cloud-translate not installed"}
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return {"translated_text": "", "latency_ms": round(latency_ms, 2), "engine": "google", "error": str(e)}


def translate_azure(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate via Azure Translator.
    Returns: { translated_text, latency_ms, engine [, error] }
    Requires: AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION
    """
    src = _normalize_lang(src_lang)
    tgt = _normalize_lang(tgt_lang)
    if (src, tgt) not in SUPPORTED_PAIRS:
        return {"translated_text": "", "latency_ms": 0, "engine": "azure", "error": f"Unsupported pair: {src}->{tgt}"}

    key = os.environ.get("AZURE_TRANSLATOR_KEY") or os.environ.get("AZURE_TRANSLATION_KEY")
    region = os.environ.get("AZURE_TRANSLATOR_REGION") or os.environ.get("AZURE_TRANSLATION_REGION")
    if not key or not region:
        return {"translated_text": "", "latency_ms": 0, "engine": "azure", "error": "AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION required"}

    start = time.perf_counter()
    try:
        from azure.ai.translation.text import TextTranslationClient, TextTranslationInput
        from azure.core.credentials import AzureKeyCredential

        credential = AzureKeyCredential(key)
        client = TextTranslationClient(endpoint=f"https://api.cognitive.microsofttranslator.com", credential=credential)
        response = client.translate(
            body=[TextTranslationInput(text=text)],
            to_languages=[tgt],
            from_language=src,
        )
        result = response[0]
        if result.translations:
            translated = result.translations[0].text
        else:
            translated = ""
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            "translated_text": translated,
            "latency_ms": round(latency_ms, 2),
            "engine": "azure",
        }
    except ImportError:
        return {"translated_text": "", "latency_ms": 0, "engine": "azure", "error": "azure-ai-translation-text not installed"}
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return {"translated_text": "", "latency_ms": round(latency_ms, 2), "engine": "azure", "error": str(e)}
