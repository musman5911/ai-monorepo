@echo off
rem ══════════════════════════════════════════════════════════════
rem  Malik Usman Farms — start all three apps (PC + mobile access)
rem  Servers already listen on the whole network; this script also
rem  shows your PC's network address so you can open the apps on
rem  your phone (phone must be on the SAME Wi-Fi as this PC).
rem ══════════════════════════════════════════════════════════════

rem ── find this PC's IPv4 address (first one found) ──
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined IP set "IP=%%a"
)
if defined IP (set "IP=%IP: =%") else (set "IP=YOUR-PC-IP")

start "AGRI  :8000" cmd /k "cd /d %~dp0agri_farm\backend && node server.js"
start "DAIRY :3000" cmd /k "cd /d %~dp0dairy_farm\backend && node server.js"
start "FLOCK :3001" cmd /k "cd /d %~dp0flock_farm\backend && node server.js"

echo.
echo  All three starting...
echo.
echo  ── On this PC ─────────────────────────────
echo    Agri:   http://localhost:8000
echo    Dairy:  http://localhost:3000
echo    Flock:  http://localhost:3001
echo.
echo  ── On your mobile (same Wi-Fi) ────────────
echo    Agri:   http://%IP%:8000
echo    Dairy:  http://%IP%:3000
echo    Flock:  http://%IP%:3001
echo.
echo  If the phone cannot open these links:
echo   1. Make sure the phone is on the SAME Wi-Fi as this PC.
echo   2. The FIRST time Windows asks "Allow access?" for
echo      Node.js - click ALLOW (Private networks).
echo   3. If it still fails, allow ports once (Run as Administrator):
echo      netsh advfirewall firewall add rule name="Farm Apps" dir=in action=allow protocol=TCP localport=3000,3001,8000
echo.
pause
