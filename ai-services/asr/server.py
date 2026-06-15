"""
Optional FastAPI ASR HTTP service.
Run: uvicorn server:app --host 0.0.0.0 --port 8001
Then Node can POST to http://localhost:8001/transcribe
"""
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Add parent to path
import sys
_script_dir = Path(__file__).resolve().parent
if str(_script_dir) not in sys.path:
    sys.path.insert(0, str(_script_dir))

from asr_service import transcribe

app = FastAPI(title="LECSTU ASR Service", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/transcribe")
async def transcribe_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("en"),
    engine: str = Form("whisper"),
    model: str = Form("base"),
):
    """Transcribe uploaded audio file."""
    suffix = Path(audio.filename or "audio").suffix or ".wav"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        content = await audio.read()
        with open(path, "wb") as f:
            f.write(content)
        result = transcribe(
            audio_path=path,
            language=language,
            engine_name=engine,
            model_size=model if engine == "whisper" else None,
        )
        return result
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "asr"}
