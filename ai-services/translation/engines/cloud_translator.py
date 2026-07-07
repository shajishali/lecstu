"""
Cloud translation engine — Google Translate / Azure Translator.
Requires API credentials via environment variables.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
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


def _translate_google_api_key(text: str, src: str, tgt: str, api_key: str) -> dict:
    """Translate via the Google Translation v2 REST endpoint using an API key."""
    start = time.perf_counter()
    url = "https://translation.googleapis.com/language/translate/v2?" + urllib.parse.urlencode({"key": api_key})
    payload = json.dumps({"q": text, "source": src, "target": tgt, "format": "text"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        translations = body.get("data", {}).get("translations", [])
        translated = translations[0].get("translatedText", "") if translations else ""
        latency_ms = (time.perf_counter() - start) * 1000
        return {"translated_text": translated, "latency_ms": round(latency_ms, 2), "engine": "google"}
    except urllib.error.HTTPError as e:
        latency_ms = (time.perf_counter() - start) * 1000
        detail = ""
        try:
            detail = e.read().decode("utf-8")[:300]
        except Exception:
            pass
        return {
            "translated_text": "",
            "latency_ms": round(latency_ms, 2),
            "engine": "google",
            "error": f"{e.code} {e.reason}: {detail}".strip(),
        }
    except Exception as e:  # noqa: BLE001
        latency_ms = (time.perf_counter() - start) * 1000
        return {"translated_text": "", "latency_ms": round(latency_ms, 2), "engine": "google", "error": str(e)}


def translate_google(text: str, src_lang: str, tgt_lang: str) -> dict:
    """
    Translate via Google Cloud Translation API.
    Returns: { translated_text, latency_ms, engine [, error] }
    Requires: GOOGLE_TRANSLATE_API_KEY / GOOGLE_API_KEY (API key), or
              GOOGLE_APPLICATION_CREDENTIALS (service account JSON).
    """
    src = _normalize_lang(src_lang)
    tgt = _normalize_lang(tgt_lang)
    if (src, tgt) not in SUPPORTED_PAIRS:
        return {"translated_text": "", "latency_ms": 0, "engine": "google", "error": f"Unsupported pair: {src}->{tgt}"}

    # Prefer API key path when a key is provided (no google-cloud-translate needed).
    api_key = os.environ.get("GOOGLE_TRANSLATE_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        return _translate_google_api_key(text, src, tgt, api_key)

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
