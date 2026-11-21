# Stop BOWER JJ Server, Cloudflared Tunnel, and Watchdogs
Set-Location "C:\Users\adama\bower-jj"
New-Item -ItemType File -Path "C:\Users\adama\bower-jj\server.stop" -Force | Out-Null

Write-Host "Signaling watchdog supervisor to exit..."
$supervisors = Get-CimInstance Win32_Process | Where-Object { 
    $_.CommandLine -like "*run_247_server.cmd*" -or 
    $_.CommandLine -like "*watchdog.ps1*" -or
    $_.CommandLine -like "*server/index.ts*"
}
foreach ($s in $supervisors) {
    Stop-Process -Id $s.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopping server processes on port 3001..."
$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
foreach ($conn in $connections) {
    if ($conn.OwningProcess -gt 0) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Stopping Cloudflare edge tunnel..."
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2
if (Test-Path "C:\Users\adama\bower-jj\server.stop") {
    Remove-Item -Path "C:\Users\adama\bower-jj\server.stop" -Force -ErrorAction SilentlyContinue
}

Write-Host "BOWER JJ server stopped successfully."
