#!/bin/bash
# start-all.sh — Linux/Termux version of tools\start-all.bat
# Starts all 3 backends (memory mode) and 3 frontends (dev servers)

cd "$(dirname "$0")/.." || exit 1

echo "Starting Malik Usman Farms (Termux/Linux)..."

# Start backends in background
echo "[1/6] Starting Dairy backend on :3000..."
MEMORY_MODE=1 PORT=3000 node dairy_farm/backend/server.js &
DAIRY_BE_PID=$!

echo "[2/6] Starting Flock backend on :3001..."
MEMORY_MODE=1 PORT=3001 node flock_farm/backend/server.js &
FLOCK_BE_PID=$!

echo "[3/6] Starting Agri backend on :8000..."
MEMORY_MODE=1 PORT=8000 node agri_farm/backend/server.js &
AGRI_BE_PID=$!

# Wait a moment for backends to boot
sleep 2

# Start frontends in background
echo "[4/6] Starting Dairy frontend on :5000..."
cd dairy_farm/client
npm run dev -- --host &
DAIRY_FE_PID=$!
cd ../..

echo "[5/6] Starting Flock frontend on :5173..."
cd flock_farm/client
npm run dev -- --host &
FLOCK_FE_PID=$!
cd ../..

echo "[6/6] Starting Agri frontend on :3030..."
cd agri_farm/frontend
npm run dev -- --host &
AGRI_FE_PID=$!
cd ../..

echo ""
echo "========================================"
echo "All servers started!"
echo "  Dairy:  http://localhost:5000"
echo "  Flock:  http://localhost:5173"
echo "  Agri:   http://localhost:3030"
echo "========================================"
echo "Login: admin / admin123"
echo "Press Ctrl+C to stop all servers."
echo ""

# Wait for all background processes
wait
