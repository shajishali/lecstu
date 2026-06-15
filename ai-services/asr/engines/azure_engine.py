"""
Azure Speech Services ASR engine wrapper.
Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.

Activation guide: see ai-services/asr/README.md
"""
import os
import time

# Language code mapping (Azure uses BCP-47)
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
    Transcribe audio using Azure Speech Services.
    Returns: { "text": str, "confidence": float, "latency_ms": float }
    """
    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")

    if not key or not region:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": (
                "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION not set. "
                "See ai-services/asr/README.md for activation guide."
            ),
        }

    start = time.perf_counter()

    try:
        import azure.cognitiveservices.speech as speechsdk
    except ImportError:
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": 0,
            "error": (
                "azure-cognitiveservices-speech not installed. "
                "Run: pip install azure-cognitiveservices-speech"
            ),
        }

    lang_code = LANG_MAP.get(language.lower(), "en-US")
    if language.lower() in ("ta", "tamil", "si", "sinhala") and lang_code == "en-US":
        lang_code = f"{language[:2].lower()}-{language[:2].upper()}"

    speech_config = speechsdk.SpeechConfig(subscription=key, region=region)
    speech_config.speech_recognition_language = lang_code
    speech_config.set_profanity(speechsdk.ProfanityOption.Raw)

    audio_config = speechsdk.audio.AudioConfig(filename=audio_path)
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )

    try:
        result = recognizer.recognize_once()

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text = result.text or ""
            # Azure doesn't expose confidence in single-shot result; use 0.9 default
            confidence = 0.9
        elif result.reason == speechsdk.ResultReason.NoMatch:
            text = ""
            confidence = 0.0
        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation = result.cancellation_details
            raise RuntimeError(f"Azure recognition canceled: {cancellation.reason} - {cancellation.error_details}")
        else:
            text = ""
            confidence = 0.0

    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return {
            "text": "",
            "confidence": 0.0,
            "latency_ms": round(latency_ms, 1),
            "error": str(e),
        }

    latency_ms = (time.perf_counter() - start) * 1000

    return {
        "text": text,
        "confidence": round(float(confidence), 2),
        "latency_ms": round(latency_ms, 1),
    }
