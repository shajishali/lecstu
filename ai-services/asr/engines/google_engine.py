"""
Google Cloud Speech-to-Text ASR engine wrapper.
Uses GOOGLE_APPLICATION_CREDENTIALS (service account JSON) or Application Default
Credentials (gcloud auth application-default login).
"""
import time
from typing import Optional

# Language code mapping (Google uses BCP-47)
LANG_MAP = {
    "en": "en-US",
    "english": "en-US",
    "ta": "ta-IN",
    "tamil": "ta-IN",
    "si": "si-LK",
    "sinhala": "si-LK",
}


def transcribe(audio_path: str, language: str = "en") -> dict:
    """
    Transcribe audio using Google Cloud Speech-to-Text (synchronous).
    Returns: { "text": str, "confidence": float, "latency_ms": float }
    Uses ADC (gcloud auth application-default login) when GOOGLE_APPLICATION_CREDENTIALS not set.
    """
    start = time.perf_counter()

    try:
        from google.cloud import speech
    except ImportError:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": "google-cloud-speech not installed. Run: pip install google-cloud-speech",
        }

    lang_code = LANG_MAP.get(language.lower(), "en-US")
    if language.lower() in ("ta", "tamil", "si", "sinhala") and lang_code == "en-US":
        lang_code = f"{language[:2].lower()}-{language[:2].upper()}"

    with open(audio_path, "rb") as f:
        content = f.read()

    client = speech.SpeechClient()
    audio = speech.RecognitionAudio(content=content)

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=lang_code,
        enable_automatic_punctuation=True,
    )

    try:
        response = client.recognize(config=config, audio=audio)
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": round(latency_ms, 1),
            "error": str(e),
        }

    latency_ms = (time.perf_counter() - start) * 1000

    text_parts = []
    confidence_sum = 0.0
    count = 0

    for result in response.results:
        alt = result.alternatives[0]
        text_parts.append(alt.transcript)
        if hasattr(alt, "confidence") and alt.confidence is not None:
            confidence_sum += alt.confidence
            count += 1

    text = " ".join(text_parts).strip()
    confidence = confidence_sum / count if count > 0 else 0.9

    return {
        "text": text,
        "confidence": round(float(confidence), 2),
        "latency_ms": round(latency_ms, 1),
    }
