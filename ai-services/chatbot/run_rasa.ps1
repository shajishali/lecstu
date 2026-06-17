# LECSTU Chatbot — Run Rasa server and action server
# Requires Python 3.10 or 3.11 (Rasa 3.x does not support 3.12+)
# Install: https://www.python.org/downloads/ or: winget install Python.Python.3.11

$ErrorActionPreference = "Stop"
$chatbotDir = $PSScriptRoot
Set-Location $chatbotDir

# Rasa 3.x requires Python 3.8–3.10 (not 3.11+)
$pyVer = $null
try { $null = & py -3.10 -c "pass" 2>$null; if ($?) { $pyVer = "3.10" } } catch { }
if (-not $pyVer) {
    try { $null = & py -3.9 -c "pass" 2>$null; if ($?) { $pyVer = "3.9" } } catch { }
}

if (-not $pyVer) {
    Write-Host "ERROR: Rasa 3.x requires Python 3.8, 3.9, or 3.10." -ForegroundColor Red
    Write-Host "Python 3.11+ is not supported." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Install Python 3.10:" -ForegroundColor Cyan
    Write-Host "  winget install Python.Python.3.10" -ForegroundColor White
    Write-Host "  or download from https://www.python.org/downloads/release/python-31011/" -ForegroundColor White
    exit 1
}

# Create venv if needed
if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment with Python $pyVer..." -ForegroundColor Cyan
    & py -$pyVer -m venv .venv
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

$activate = ".\.venv\Scripts\Activate.ps1"
if (-not (Test-Path $activate)) { exit 1 }

. $activate

# Install if needed
$rasaInstalled = $false
$ErrorActionPreference = "SilentlyContinue"
$rasaOut = & python -c "import rasa; print(rasa.__version__)" 2>&1
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -eq 0) { $rasaInstalled = $true }
if (-not $rasaInstalled) {
    Write-Host "Installing Rasa and dependencies..." -ForegroundColor Cyan
    pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

function Get-PortListenerPid([int]$Port) {
    $match = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s"
    if (-not $match) { return $null }
    $parts = ($match[0].Line -split '\s+') | Where-Object { $_ -ne '' }
    return [int]$parts[-1]
}

$forceTrain = $args -contains "-Train"
$stopExisting = $args -contains "-StopExisting"

foreach ($port in @(5005, 5055)) {
    $listenerPid = Get-PortListenerPid $port
    if (-not $listenerPid) { continue }
    if ($stopExisting) {
        Write-Host "Stopping PID $listenerPid on port $port..." -ForegroundColor Yellow
        Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "ERROR: Port $port is already in use (PID $listenerPid)." -ForegroundColor Red
        Write-Host "Another Rasa instance is probably still running." -ForegroundColor Yellow
        Write-Host "  Stop it:  Stop-Process -Id $listenerPid -Force" -ForegroundColor White
        Write-Host "  Or rerun: .\run_rasa.ps1 -StopExisting" -ForegroundColor White
        exit 1
    }
}

# Train if no model (or run with -Train to force retrain: .\run_rasa.ps1 -Train)
$modelDir = "models"
$hasModel = (Test-Path $modelDir) -and (Get-ChildItem $modelDir -Filter "*.tar.gz" -ErrorAction SilentlyContinue)
if (-not $hasModel -or $forceTrain) {
    Write-Host "Training Rasa model..." -ForegroundColor Cyan
    rasa train
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

function Wait-ForPortListener([int]$Port, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Get-PortListenerPid $Port) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

Write-Host ""
Write-Host "Starting Rasa server (port 5005) and action server (port 5055)..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both." -ForegroundColor Gray
Write-Host ""

# Custom actions call the platform API (lecturers, availability). Defaults (10s) cause rest.message.received.timeout.
$env:RASA_REST_WEBHOOK_TIMEOUT = "90"
$env:ACTION_ENDPOINT_TIMEOUT = "60"
$env:ACTION_SERVER_REQUEST_TIMEOUT = "60"
$env:LECSTU_API_URL = if ($env:LECSTU_API_URL) { $env:LECSTU_API_URL } else { "http://localhost:5000/api" }
$env:CHATBOT_API_KEY = if ($env:CHATBOT_API_KEY) { $env:CHATBOT_API_KEY } else { "lecstu-chatbot-dev-key" }

# Start-Job is unreliable on Windows (venv path / no listener on 5055). Use a real process.
$rasaExe = Join-Path $chatbotDir ".venv\Scripts\rasa.exe"
if (-not (Test-Path $rasaExe)) {
    $rasaExe = "rasa"
}

$actionProc = Start-Process `
    -FilePath $rasaExe `
    -ArgumentList @("run", "actions") `
    -WorkingDirectory $chatbotDir `
    -PassThru `
    -WindowStyle Hidden

Write-Host "Action server starting (PID $($actionProc.Id))..." -ForegroundColor Cyan
if (-not (Wait-ForPortListener 5055 90)) {
    Write-Host "ERROR: Action server did not bind to port 5055." -ForegroundColor Red
    Write-Host "Check actions/actions.py and run: rasa run actions" -ForegroundColor Yellow
    if ($actionProc -and -not $actionProc.HasExited) {
        Stop-Process -Id $actionProc.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
Write-Host "Action server listening on http://localhost:5055" -ForegroundColor Green

try {
    & $rasaExe run --enable-api --cors "*"
} finally {
    if ($actionProc -and -not $actionProc.HasExited) {
        Write-Host "Stopping action server (PID $($actionProc.Id))..." -ForegroundColor Gray
        Stop-Process -Id $actionProc.Id -Force -ErrorAction SilentlyContinue
    }
}
