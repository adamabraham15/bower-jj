# ==============================================================================
# BOWER JJ — 24/7 Dedicated Server Watchdog & Self-Healing Supervisor
# ==============================================================================
$ErrorActionPreference = "SilentlyContinue"
Set-Location "C:\Users\adama\bower-jj"
$stopFile = "C:\Users\adama\bower-jj\server.stop"
$logFile = "C:\Users\adama\bower-jj\server.log"

function Log-Message([string]$msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}

if (Test-Path $stopFile) {
    Remove-Item -Path $stopFile -Force -ErrorAction SilentlyContinue
}

Log-Message "[WATCHDOG] 24/7 Server Watchdog started."

while ($true) {
    if (Test-Path $stopFile) {
        Log-Message "[WATCHDOG] Stop signal detected. Exiting watchdog."
        Remove-Item -Path $stopFile -Force -ErrorAction SilentlyContinue
        break
    }

    # Verify if port 3001 is already listening
    $active = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
    if ($active) {
        Log-Message "[WATCHDOG] Port 3001 already in use (PID: $($active.OwningProcess)). Waiting 10s..."
        Start-Sleep -Seconds 10
        continue
    }

    Log-Message "[WATCHDOG] Launching BOWER JJ Multiplayer Server..."

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "C:\Program Files\nodejs\node.exe"
    $psi.Arguments = "--env-file=.env node_modules\tsx\dist\cli.mjs server/index.ts"
    $psi.WorkingDirectory = "C:\Users\adama\bower-jj"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    $outAction = {
        if (![string]::IsNullOrEmpty($EventArgs.Data)) {
            $EventArgs.Data | Out-File -FilePath "C:\Users\adama\bower-jj\server.log" -Append -Encoding utf8
        }
    }

    $jobOut = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action $outAction
    $jobErr = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action $outAction

    [void]$proc.Start()
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    Unregister-Event -SourceIdentifier $jobOut.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $jobErr.Name -ErrorAction SilentlyContinue

    Log-Message "[WATCHDOG] Server process terminated with exit code $exitCode."

    if (Test-Path $stopFile) {
        Log-Message "[WATCHDOG] Stop signal confirmed. Watchdog terminating cleanly."
        Remove-Item -Path $stopFile -Force -ErrorAction SilentlyContinue
        break
    }

    Log-Message "[WATCHDOG] Self-healing supervisor restarting server in 5 seconds..."
    Start-Sleep -Seconds 5
}
