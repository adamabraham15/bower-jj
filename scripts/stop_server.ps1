# Stop BOWER JJ Server, Cloudflared Tunnel, and Watchdogs
Set-Location "C:\Users\adama\bower-jj"
New-Item -ItemType File -Path "C:\Users\adama\bower-jj\server.stop" -Force | Out-Null

Write-Host "Signaling watchdog supervisor to exit..."
$watchdogs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*watchdog.ps1*" }
foreach ($w in $watchdogs) {
    Stop-Process -Id $w.ProcessId -Force -ErrorAction SilentlyContinue
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

Write-Host "BOWER JJ server stopped successfully."
