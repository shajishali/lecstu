# LECSTU Phase 8.3 — NLP Evaluation Script
# Runs 5-fold cross-validation and held-out test set evaluation
# Usage: Run from project root or ai-services/chatbot

$ErrorActionPreference = "Stop"
$ChatbotDir = Join-Path $PSScriptRoot "..\..\..\ai-services\chatbot"
$ResultsDir = Join-Path $PSScriptRoot "..\results"
$TestDataPath = Join-Path $PSScriptRoot "..\..\datasets\nlp\test_data.yml"

# Resolve paths
$ChatbotDir = Resolve-Path $ChatbotDir
if (-not (Test-Path $ResultsDir)) { New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null }
$ResultsDir = Resolve-Path $ResultsDir
$TestDataPath = Resolve-Path $TestDataPath

New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

Write-Host "=== LECSTU NLP Evaluation (Phase 8.3) ===" -ForegroundColor Cyan
Write-Host "Chatbot dir: $ChatbotDir"
Write-Host "Results dir: $ResultsDir"
Write-Host ""

Push-Location $ChatbotDir

# Activate venv if it exists (Rasa requires Python 3.10/3.11)
$venvActivate = Join-Path $ChatbotDir ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    . $venvActivate
}

try {
    # 1. 5-fold cross-validation
    Write-Host "1. Running 5-fold cross-validation..." -ForegroundColor Yellow
    rasa test nlu --cross-validation --folds 5 --out (Join-Path $ResultsDir "cv-5fold")
    if ($LASTEXITCODE -ne 0) { throw "Cross-validation failed" }

    # 2. Held-out test set evaluation (use latest model)
    $LatestModel = Get-ChildItem -Path (Join-Path $ChatbotDir "models") -Filter "*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($LatestModel) {
        Write-Host "`n2. Running held-out test (model: $($LatestModel.Name))..." -ForegroundColor Yellow
        rasa test nlu --model $LatestModel.FullName --nlu $TestDataPath --out (Join-Path $ResultsDir "heldout")
        if ($LASTEXITCODE -ne 0) { throw "Held-out test failed" }
    } else {
        Write-Host "`n2. No trained model found, skipping held-out test." -ForegroundColor Red
    }

    Write-Host "`n=== Evaluation complete ===" -ForegroundColor Green
    Write-Host "Results saved to: $ResultsDir"
} finally {
    Pop-Location
}
