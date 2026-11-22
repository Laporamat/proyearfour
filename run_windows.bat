@echo off
chcp 65001 > nul
echo =======================================================
echo   🚀 Quantix Portfolio — Windows Native Mode (MT5 Live)
echo =======================================================
echo.

echo [1/3] กำลังเตรียมฐานข้อมูล MongoDB...
REM ตรวจสอบว่า Docker mongo รันอยู่หรือไม่ หรือรัน mongo container
docker compose -f docker-compose.base44.yml up -d mongo > nul 2>&1
echo       ✓ MongoDB พร้อมทำงานที่พอร์ต 27017

echo.
echo [2/3] กำลังปิด Backend/Frontend ใน Docker เพื่อรันบน Windows โดยตรง...
docker stop proyearfour-backend-1 proyearfour-frontend-1 > nul 2>&1
echo       ✓ พอร์ต 8001 และ 3000 ปลดล็อคเรียบร้อย

echo.
echo [3/3] กำลังเปิด Backend (FastAPI + MT5) และ Frontend (React)...
start "Quantix Backend (Windows Native MT5)" cmd /k "cd /d %~dp0backend && set MONGO_URL=mongodb://quantix:quantixpass@localhost:27017/&& set DB_NAME=quantix&& python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload"

start "Quantix Frontend (React 19)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo =======================================================
echo   ✅ ระบบเริ่มทำงานบน Windows เรียบร้อยแล้ว!
echo   * Backend:  http://127.0.0.1:8001
echo   * Frontend: http://localhost:3000
echo   * MT5 Page: http://localhost:3000/mt5
echo.
echo   💡 ตอนนี้คุณสามารถเปิดโปรแกรม MetaTrader 5 บนเครื่อง
echo      แล้วกดปุ่ม "เชื่อมต่อ MT5 จริง" เพื่อเริ่มเทรดได้เลย
echo =======================================================
timeout /t 3 > nul
start http://localhost:3000/mt5
