# LECSTU Indoor Navigation Engine — EasyOCR + OpenCV + NetworkX (port 8004)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python venv..."
    py -3.10 -m venv .venv
}

$py = Join-Path $here ".venv\Scripts\python.exe"
$pip = Join-Path $here ".venv\Scripts\pip.exe"

Write-Host "Upgrading pip..."
& $pip install -q --upgrade pip

Write-Host "Installing core dependencies (EasyOCR + FastAPI; first run may take a few minutes)..."
& $pip install --default-timeout=300 -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: pip install failed. Check your internet connection and retry:" -ForegroundColor Red
    Write-Host "  cd $here"
    Write-Host "  .\.venv\Scripts\pip install --default-timeout=300 -r requirements.txt"
    exit 1
}

& $py -c "import uvicorn" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: uvicorn not installed. Re-run pip install above." -ForegroundColor Red
    exit 1
}

$port = 8004
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $existing) {
    if ($procId -and $procId -ne $PID) {
        Write-Host "Stopping old process on port $port (PID $procId)..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

Write-Host ""
Write-Host "Starting Indoor Navigation Engine on http://localhost:$port"
Write-Host "OCR: EasyOCR (default). For PaddleOCR: pip install -r requirements-paddle.txt then `$env:NAV_USE_PADDLE='true'"
Write-Host "Optional: `$env:NAV_USE_YOLO='true' for YOLOv8, `$env:NAV_USE_LLM='true' for Ollama polish"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

& $py -m uvicorn server:app --host 0.0.0.0 --port $port --reload
