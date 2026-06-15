# Download public datasets and run Whisper finetuning (Phase 7.6 + 7.7)
# Run from project root: .\research\run_download_and_finetune.ps1

$ErrorActionPreference = "Stop"
$env:TF_CPP_MIN_LOG_LEVEL = "3"

Write-Host "=== Step 1: Download LibriSpeech (English subset) ===" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\datasets\asr"
python scripts/download_and_prepare.py --max-samples 300
if ($LASTEXITCODE -ne 0) {
    Write-Host "Download failed. Continuing with academic data only." -ForegroundColor Yellow
}

Write-Host "`n=== Step 2: Merge manifests ===" -ForegroundColor Cyan
python scripts/prepare_finetuning_manifests.py

Write-Host "`n=== Step 3: Run finetuning ===" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\asr-finetuning"
python train_whisper.py --model base --epochs 3 --batch-size 4 --eval-steps 25 --save-steps 50

Write-Host "`nDone. Model saved to asr-finetuning/models/" -ForegroundColor Green
