"""
Unified ASR interface.
Dispatches to Whisper or Google engine, with audio preprocessing.
"""
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional


def _ensure_ffmpeg_on_path() -> None:
    """Add ffmpeg to PATH if not found (needed for Whisper on Windows when launched from IDE)."""
    if shutil.which("ffmpeg"):
        return
    localappdata = os.environ.get("LOCALAPPDATA", "")
    if localappdata:
        winget_base = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
        if winget_base.exists():
            gyan = next(winget_base.glob("Gyan.FFmpeg_*"), None)
            if gyan:
                for bin_dir in gyan.glob("ffmpeg-*/bin"):
                    os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ.get("PATH", "")
                    return


_ensure_ffmpeg_on_path()

from preprocessing.audio_processor import normalize_audio

SUPPORTED_LANGUAGES = ["en", "ta", "si"]
WHISPER_MODELS = ["tiny", "base", "small", "medium"]


def transcribe(
    audio_path: str,
    language: str = "en",
    engine_name: str = "whisper",
    model_size: Optional[str] = None,
    preprocess: bool = True,
) -> dict:
    """
    Unified ASR transcription.
    Returns: { text, confidence, latency_ms, engine [, error] }
    """
    language = language.lower()[:2] if language else "en"
    if language not in SUPPORTED_LANGUAGES:
        language = "en"

    processed_path = audio_path
    temp_path = None

    try:
        if preprocess:
            try:
                temp_path = normalize_audio(
                    audio_path,
                    sample_rate=16000,
                    channels=1,
                    trim_silence=True,
                    noise_reduce=False,
                )
                processed_path = temp_path
            except Exception as e:
                return {
                    "text": "",
                    "confidence": 0.0,
                    "latency_ms": 0,
                    "engine": engine_name.lower(),
                    "error": str(e),
                }

        try:
            if engine_name.lower() == "azure":
                from engines.azure_engine import transcribe as azure_transcribe
                out = azure_transcribe(processed_path, language)
            elif engine_name.lower() == "google":
                from engines.google_engine import transcribe as google_transcribe
                out = google_transcribe(processed_path, language)
            elif engine_name.lower() in ("whisper-finetuned", "whisper_ft"):
                from engines.whisper_finetuned_engine import transcribe as whisper_ft_transcribe
                out = whisper_ft_transcribe(processed_path, language)
            else:
                from engines.whisper_engine import transcribe as whisper_transcribe
                model = model_size or "base"
                if model not in WHISPER_MODELS:
                    model = "base"
                out = whisper_transcribe(processed_path, language, model)

            out["engine"] = engine_name.lower()
            return out
        except Exception as e:
            return {
                "text": "",
                "confidence": 0.0,
                "latency_ms": 0,
                "engine": engine_name.lower(),
                "error": str(e),
            }

    finally:
        if temp_path and os.path.exists(temp_path) and temp_path != audio_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass
