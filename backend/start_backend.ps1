# Starts the Todo App backend.
# If something is already listening on port 8000 (an old server instance),
# it is stopped first so you never see WinError 10013 / "address in use".

$port = 8000
$line = netstat -ano | findstr ":$port " | findstr LISTENING | Select-Object -First 1
if ($line) {
    $oldPid = ($line -split '\s+')[-1]
    Write-Host "Port $port is held by PID $oldPid (old server instance) - stopping it..." -ForegroundColor Yellow
    Stop-Process -Id $oldPid -Force
    Start-Sleep -Seconds 1
}

Set-Location $PSScriptRoot
& "$PSScriptRoot\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port $port
