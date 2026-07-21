#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host "=== LA Cheshire Homes ===" -ForegroundColor Green

if (-not (Test-Path ".env")) {
    Write-Host "No .env file found - creating one from .env.example."
    Copy-Item ".env.example" ".env"
    Write-Host "Edit .env to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ADMIN_EMAILS before using admin login." -ForegroundColor Yellow
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install failed. Aborting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Starting server..."
$serverProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "start" -PassThru

# Wait for the app to accept connections on port 5000 before starting ngrok.
$maxWaitSeconds = 60
$pollIntervalSeconds = 2
$serverReady = $false

for ($elapsed = 0; $elapsed -lt $maxWaitSeconds; $elapsed += $pollIntervalSeconds) {
    if ($serverProcess.HasExited) {
        Write-Host "Server process exited before becoming ready. Aborting." -ForegroundColor Red
        exit 1
    }

    $isListening = Test-NetConnection -ComputerName "127.0.0.1" -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($isListening) {
        $serverReady = $true
        break
    }

    Start-Sleep -Seconds $pollIntervalSeconds
}

if (-not $serverReady) {
    Write-Host "Server did not become ready on port 5000 within $maxWaitSeconds seconds. Aborting." -ForegroundColor Red
    Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Server is ready. Starting ngrok..." -ForegroundColor Green
Start-Process "ngrok" -ArgumentList "http 5000 --url https://ligative-hemicyclic-deloras.ngrok-free.dev"
