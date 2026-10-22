@echo off
setlocal
cd /d "%~dp0.."
title Send Monorepo Changes to Project Repositories

node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js was not found. Install Node.js and reopen this window.
    pause
    exit /b 1
)

node tools\send-to-projects.js
set "SYNC_EXIT=%ERRORLEVEL%"

if not "%SYNC_EXIT%"=="0" (
    echo.
    echo [FAIL] Project sync failed with exit code %SYNC_EXIT%.
) else (
    echo.
    echo [OK] Project sync completed.
)

pause
exit /b %SYNC_EXIT%
