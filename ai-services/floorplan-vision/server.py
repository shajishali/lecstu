"""LECSTU Floor plan vision service — OCR + door heuristics from JPG floor plans."""
import json
import logging
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from analyzer import analyze_floor_plan, _sanitize_for_json

logger = logging.getLogger("floorplan-vision")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="LECSTU Floor Plan Vision", version="1.0.0")


@app.on_event("startup")
def warmup_ocr():
    """Load EasyOCR in background so the server listens on port 8003 immediately."""
    import threading

    def _load():
        try:
            from analyzer import _get_reader

            logger.info("Loading EasyOCR model (first time may download ~100MB)...")
            _get_reader()
            logger.info("EasyOCR ready.")
        except Exception as e:
            logger.warning("EasyOCR warmup failed: %s", e)

    threading.Thread(target=_load, daemon=True, name="easyocr-warmup").start()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "floorplan-vision", "engine": "easyocr+opencv-v2"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    name = (file.filename or "").lower()
    if not name.endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(400, "Image file required (jpg, png, webp)")

    data = await file.read()
    if len(data) < 500:
        raise HTTPException(400, "File too small")

    suffix = Path(name).suffix or ".jpg"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with open(path, "wb") as f:
            f.write(data)
        result = _sanitize_for_json(analyze_floor_plan(path))
        payload = {"success": True, "data": result}
        json.dumps(payload)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analyze failed")
        raise HTTPException(500, f"Floor plan analysis failed: {e}") from e
    finally:
        Path(path).unlink(missing_ok=True)
