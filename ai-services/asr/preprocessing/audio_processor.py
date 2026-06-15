"""
Audio preprocessing pipeline for ASR.
- Format normalization (convert to 16kHz WAV mono)
- Optional noise reduction
- Silence trimming
- Supports WAV, WebM, MP3, OGG (via pydub/soundfile)
"""
import os
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np


def _load_audio(input_path: str) -> tuple:
    """Load audio as (data, sample_rate). Handles WebM and other formats via pydub or ffmpeg."""
    path_lower = input_path.lower()
    if path_lower.endswith(('.webm', '.mp3', '.m4a', '.ogg')):
        try:
            from pydub import AudioSegment
            seg = AudioSegment.from_file(input_path)
            data = np.array(seg.get_array_of_samples(), dtype=np.float32) / 32768.0
            if seg.channels == 2:
                data = data.reshape(-1, 2).mean(axis=1)
            return data, seg.frame_rate
        except Exception:
            # Fallback: ffmpeg to convert WebM/Opus to WAV when pydub fails
            if path_lower.endswith('.webm'):
                import shutil
                import subprocess
                if shutil.which('ffmpeg'):
                    fd, wav_path = tempfile.mkstemp(suffix='.wav')
                    os.close(fd)
                    try:
                        subprocess.run(
                            ['ffmpeg', '-y', '-i', input_path, '-ar', '16000', '-ac', '1', wav_path],
                            check=True, capture_output=True, timeout=30
                        )
                        import soundfile as sf
                        data, sr = sf.read(wav_path)
                        if data.dtype != np.float32:
                            data = data.astype(np.float32) / (
                                np.iinfo(data.dtype).max if np.issubdtype(data.dtype, np.integer) else 1.0
                            )
                        return data, 16000
                    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
                        pass
                    finally:
                        try:
                            os.remove(wav_path)
                        except OSError:
                            pass
            raise RuntimeError(
                'WebM/Opus requires pydub+ffmpeg. Install: pip install pydub; ensure ffmpeg is on PATH.'
            )
    import soundfile as sf
    return sf.read(input_path)


def normalize_audio(
    input_path: str,
    output_path: Optional[str] = None,
    sample_rate: int = 16000,
    channels: int = 1,
    trim_silence: bool = True,
    noise_reduce: bool = False,
) -> str:
    """
    Normalize audio to 16kHz WAV mono. Optionally trim silence and reduce noise.
    Returns path to the processed audio file.
    """
    data, sr = _load_audio(input_path)

    # Convert to mono if stereo
    if len(data.shape) > 1:
        data = np.mean(data, axis=1)

    # Resample if needed (simple linear interpolation for basic support)
    if sr != sample_rate:
        from scipy import signal as scipy_signal
        num_samples = int(len(data) * sample_rate / sr)
        data = scipy_signal.resample(data, num_samples)

    # Optional noise reduction
    if noise_reduce:
        try:
            import noisereduce as nr
            data = nr.reduce_noise(y=data, sr=sample_rate)
        except ImportError:
            pass  # noisereduce not installed, skip

    # Optional silence trimming
    if trim_silence and len(data) > 0:
        data = _trim_silence(data, sample_rate)

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)

    import soundfile as sf
    sf.write(output_path, data, sample_rate, subtype="PCM_16")
    return output_path


def _trim_silence(audio: np.ndarray, sr: int, threshold: float = 0.01) -> np.ndarray:
    """Trim leading and trailing silence below threshold."""
    if len(audio) == 0:
        return audio
    abs_audio = np.abs(audio)
    mask = abs_audio > threshold
    indices = np.where(mask)[0]
    if len(indices) == 0:
        return audio
    return audio[indices[0] : indices[-1] + 1]
