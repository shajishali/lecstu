"""LECSTU Timetable PDF extraction service (pdfplumber — position-aware)."""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from fet_parser import parse_fet_pdf

app = FastAPI(title="LECSTU Timetable Extract", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "engine": "pdfplumber-position"}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "PDF file required")
    data = await file.read()
    if len(data) < 100:
        raise HTTPException(400, "File too small or empty")
    try:
        result = parse_fet_pdf(data, file.filename or "")
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(500, f"PDF extraction failed: {e}") from e
