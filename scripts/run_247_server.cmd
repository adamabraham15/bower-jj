@echo off
setlocal
cd /d "C:\Users\adama\bower-jj"
set "PATH=C:\Program Files\nodejs;%PATH%"

:: Ensure server.stop is cleared on initial startup
if exist "server.stop" del /f /q "server.stop" >nul 2>&1

:: Check if already running on port 3001
netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [%date% %time%] [WATCHDOG] Port 3001 is already actively listening. Aborting duplicate launch. >> server.log
    exit /b 0
)

:server_loop
if exist "server.stop" (
    echo [%date% %time%] [WATCHDOG] Stop signal detected. Watchdog terminating cleanly. >> server.log
    del /f /q "server.stop" >nul 2>&1
    exit /b 0
)

echo [%date% %time%] [WATCHDOG] Starting BOWER JJ Authoritative Multiplayer Server... >> server.log
"C:\Program Files\nodejs\node.exe" --env-file=.env "node_modules\tsx\dist\cli.mjs" server/index.ts >> server.log 2>&1
set EXIT_CODE=%ERRORLEVEL%
echo [%date% %time%] [WATCHDOG] Server process terminated with exit code %EXIT_CODE%. >> server.log

if exist "server.stop" (
    echo [%date% %time%] [WATCHDOG] Stop signal detected. Exiting without restart. >> server.log
    del /f /q "server.stop" >nul 2>&1
    exit /b 0
)

echo [%date% %time%] [WATCHDOG] Automatically restarting server in 5 seconds... >> server.log
ping 127.0.0.1 -n 6 >nul
goto server_loop
