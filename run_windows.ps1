# Quantix Portfolio — Windows Native Mode (MT5 Live)
$Host.UI.RawUI.WindowTitle = "Quantix MT5 Native Launcher"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  🚀 Quantix Portfolio — Windows Native Mode (MT5 Live)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] กำลังเตรียมฐานข้อมูล MongoDB..." -ForegroundColor Yellow
docker compose -f docker-compose.base44.yml up -d mongo | Out-Null
Write-Host "      ✓ MongoDB พร้อมทำงานที่พอร์ต 27017" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] กำลังปิด Backend/Frontend ใน Docker เพื่อรันบน Windows โดยตรง..." -ForegroundColor Yellow
docker stop proyearfour-backend-1 proyearfour-frontend-1 | Out-Null
Write-Host "      ✓ พอร์ต 8001 และ 3000 ปลดล็อคเรียบร้อย" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] กำลังเปิด Backend (FastAPI + MT5) และ Frontend (React)..." -ForegroundColor Yellow

# Start backend in a separate window
$backendCmd = "cd '$PSScriptRoot\backend'; `$env:MONGO_URL='mongodb://quantix:quantixpass@localhost:27017/'; `$env:DB_NAME='quantix'; python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Start frontend in a separate window
$frontendCmd = "cd '$PSScriptRoot\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  ✅ ระบบเริ่มทำงานบน Windows เรียบร้อยแล้ว!" -ForegroundColor Green
Write-Host "  * Backend:  http://127.0.0.1:8001"
Write-Host "  * Frontend: http://localhost:3000"
Write-Host "  * MT5 Page: http://localhost:3000/mt5"
Write-Host ""
Write-Host "  💡 ตอนนี้คุณสามารถเปิดโปรแกรม MetaTrader 5 บนเครื่อง"
Write-Host "     แล้วกดปุ่ม 'เชื่อมต่อ MT5 จริง' เพื่อเริ่มเทรดได้เลย!"
Write-Host "=======================================================" -ForegroundColor Green

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000/mt5"
