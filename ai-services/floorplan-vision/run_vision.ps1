# LECSTU Floor Plan Vision — EasyOCR + OpenCV (port 8003)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python venv..."
    py -3.10 -m venv .venv
}

$py = Join-Path $here ".venv\Scripts\python.exe"
$pip = Join-Path $here ".venv\Scripts\pip.exe"

Write-Host "Installing dependencies (first run may take several minutes)..."
& $pip install -q -r requirements.txt

$port = 8003
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
Write-Host "Starting Floor Plan Vision on http://localhost:$port (auto-reload on code changes)"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

& $py -m uvicorn server:app --host 0.0.0.0 --port $port --reload
