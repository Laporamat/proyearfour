"""
mt5_bridge.py — Lightweight Windows Bridge for MetaTrader 5.
Run this script on your Windows host machine to allow Docker containers
to execute real trades through your local MetaTrader 5 desktop terminal.

Usage:
  python mt5_bridge.py
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import logging
import os
import sys
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("mt5_bridge")

if sys.platform != "win32":
    log.error("mt5_bridge must be run on Windows where MetaTrader 5 desktop is installed.")
    sys.exit(1)

try:
    import MetaTrader5 as mt5
except ImportError:
    log.error("MetaTrader5 package not found. Run: pip install MetaTrader5")
    sys.exit(1)

app = FastAPI(title="Quantix MT5 Windows Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="bridge-mt5")
DEFAULT_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"

_state = {
    "connected": False,
    "login": None,
    "server": None,
    "last_error": None,
}


class ConnectRequest(BaseModel):
    login: Optional[int] = None
    password: Optional[str] = None
    server: Optional[str] = None
    path: Optional[str] = None


class OrderRequest(BaseModel):
    symbol: str
    action: str
    volume: float
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0
    deviation: Optional[int] = 20
    comment: Optional[str] = "Quantix Bridge"


class CloseRequest(BaseModel):
    ticket: int


def _format_account(acc: Any) -> dict[str, Any]:
    if acc is None:
        return {}
    return {
        "login": acc.login,
        "trade_mode": "Demo" if acc.trade_mode == 0 else "Contest" if acc.trade_mode == 1 else "Real",
        "name": acc.name,
        "server": acc.server,
        "currency": acc.currency,
        "company": acc.company,
        "balance": round(float(acc.balance), 2),
        "equity": round(float(acc.equity), 2),
        "profit": round(float(acc.profit), 2),
        "margin": round(float(acc.margin), 2),
        "margin_free": round(float(acc.margin_free), 2),
        "margin_level": round(float(acc.margin_level), 2) if acc.margin > 0 else 0.0,
        "leverage": int(acc.leverage),
    }


def _sync_init_and_login(login=None, password=None, server=None, path=None):
    target_path = path or DEFAULT_PATH
    if not os.path.exists(target_path):
        target_path = None

    init_kwargs = {"timeout": 15000}
    if target_path:
        init_kwargs["path"] = target_path

    if not mt5.initialize(**init_kwargs):
        err = mt5.last_error()
        _state["connected"] = False
        _state["last_error"] = str(err)
        raise RuntimeError(f"MT5 initialize failed: {err}")

    if login and password and server:
        if not mt5.login(login=int(login), password=str(password), server=str(server)):
            err = mt5.last_error()
            _state["connected"] = False
            _state["last_error"] = str(err)
            raise RuntimeError(f"MT5 login failed: {err}")
        _state["login"] = login
        _state["server"] = server

    acc = mt5.account_info()
    if not acc:
        raise RuntimeError(f"Failed to get account info: {mt5.last_error()}")

    _state["connected"] = True
    _state["login"] = acc.login
    _state["server"] = acc.server
    return _format_account(acc)


def _sync_get_account():
    if not _state["connected"]:
        try:
            mt5.initialize(timeout=5000)
            acc = mt5.account_info()
            if acc:
                _state["connected"] = True
                _state["login"] = acc.login
                _state["server"] = acc.server
                return _format_account(acc)
        except Exception:
            pass
        return {}
    acc = mt5.account_info()
    return _format_account(acc) if acc else {}


def _sync_get_positions():
    if not _state["connected"]:
        return []
    raw = mt5.positions_get()
    if not raw:
        return []
    res = []
    for pos in raw:
        t_dt = datetime.fromtimestamp(pos.time, tz=timezone.utc)
        res.append({
            "ticket": int(pos.ticket),
            "symbol": str(pos.symbol),
            "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
            "volume": round(float(pos.volume), 2),
            "price_open": float(pos.price_open),
            "price_current": float(pos.price_current),
            "sl": float(pos.sl),
            "tp": float(pos.tp),
            "profit": round(float(pos.profit), 2),
            "swap": round(float(pos.swap), 2),
            "time": t_dt.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "comment": str(pos.comment or ""),
        })
    return res


def _sync_order(req: OrderRequest):
    if not _state["connected"]:
        raise RuntimeError("MT5 is not connected.")

    symbol = req.symbol.strip().upper()
    sym_info = mt5.symbol_info(symbol)
    if not sym_info:
        raise RuntimeError(f"Symbol '{symbol}' not found.")
    if not sym_info.visible:
        mt5.symbol_select(symbol, True)

    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        raise RuntimeError(f"Cannot get tick price for '{symbol}'.")

    action = req.action.upper()
    order_type = mt5.ORDER_TYPE_BUY if action == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if action == "BUY" else tick.bid

    filling = mt5.ORDER_FILLING_IOC if (sym_info.filling_mode & 2) else mt5.ORDER_FILLING_FOK if (sym_info.filling_mode & 1) else mt5.ORDER_FILLING_RETURN

    trade_req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(req.volume),
        "type": order_type,
        "price": float(price),
        "sl": float(req.sl) if req.sl else 0.0,
        "tp": float(req.tp) if req.tp else 0.0,
        "deviation": int(req.deviation or 20),
        "magic": 202611,
        "comment": req.comment or "Quantix Trade",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }

    result = mt5.order_send(trade_req)
    if result is None:
        raise RuntimeError(f"Order send failed: {mt5.last_error()}")

    if result.retcode == 10030:
        for alt in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]:
            trade_req["type_filling"] = alt
            result = mt5.order_send(trade_req)
            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                break

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise RuntimeError(f"Trade rejected: {result.comment} (code {result.retcode})")

    return {
        "success": True,
        "order": int(result.order),
        "deal": int(result.deal),
        "volume": float(result.volume),
        "price": float(result.price),
        "retcode": int(result.retcode),
        "comment": str(result.comment),
        "symbol": symbol,
        "action": action,
    }


def _sync_close(ticket: int):
    positions = mt5.positions_get(ticket=ticket)
    if not positions:
        raise RuntimeError(f"Position #{ticket} not found.")
    pos = positions[0]
    symbol = pos.symbol
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        raise RuntimeError(f"Cannot get tick for '{symbol}'.")

    close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask

    sym_info = mt5.symbol_info(symbol)
    filling = mt5.ORDER_FILLING_IOC if (sym_info.filling_mode & 2) else mt5.ORDER_FILLING_FOK if (sym_info.filling_mode & 1) else mt5.ORDER_FILLING_RETURN

    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "position": int(pos.ticket),
        "symbol": symbol,
        "volume": float(pos.volume),
        "type": close_type,
        "price": float(price),
        "deviation": 20,
        "magic": 202611,
        "comment": "Quantix Close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": filling,
    }

    result = mt5.order_send(req)
    if result is None:
        raise RuntimeError(f"Close failed: {mt5.last_error()}")

    if result.retcode == 10030:
        for alt in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]:
            req["type_filling"] = alt
            result = mt5.order_send(req)
            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                break

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise RuntimeError(f"Close rejected: {result.comment} (code {result.retcode})")

    return {
        "success": True,
        "ticket": ticket,
        "deal": int(result.deal),
        "price": float(result.price),
        "volume": float(result.volume),
        "comment": str(result.comment),
    }


@app.get("/health")
def health():
    return {"status": "ok", "bridge": "active", "platform": sys.platform}


@app.get("/api/mt5/status")
async def status():
    loop = asyncio.get_running_loop()
    acc = await loop.run_in_executor(_executor, _sync_get_account)
    return {
        "available": True,
        "connected": _state["connected"],
        "login": _state.get("login"),
        "server": _state.get("server"),
        "last_error": _state.get("last_error"),
        "account": acc,
        "is_bridge": True,
    }


@app.post("/api/mt5/connect")
async def connect(req: ConnectRequest):
    loop = asyncio.get_running_loop()
    try:
        acc = await loop.run_in_executor(
            _executor, _sync_init_and_login, req.login, req.password, req.server, req.path
        )
        return {"status": "connected", "account": acc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/mt5/disconnect")
async def disconnect():
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_executor, mt5.shutdown)
    _state["connected"] = False
    return {"status": "disconnected"}


@app.get("/api/mt5/account")
async def account():
    loop = asyncio.get_running_loop()
    acc = await loop.run_in_executor(_executor, _sync_get_account)
    if not acc:
        raise HTTPException(status_code=400, detail="MT5 is not connected.")
    return acc


@app.get("/api/mt5/positions")
async def positions():
    loop = asyncio.get_running_loop()
    pos = await loop.run_in_executor(_executor, _sync_get_positions)
    return {"positions": pos, "total": len(pos)}


@app.get("/api/mt5/tick")
async def tick(symbol: str):
    def _get_tick():
        t = mt5.symbol_info_tick(symbol.strip().upper())
        if not t:
            raise RuntimeError(f"No tick for {symbol}")
        return {
            "symbol": symbol.strip().upper(),
            "bid": t.bid,
            "ask": t.ask,
            "last": t.last,
            "spread": round(t.ask - t.bid, 5),
            "volume": t.volume,
            "time": t.time,
        }
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(_executor, _get_tick)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/mt5/order")
async def order(req: OrderRequest):
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(_executor, _sync_order, req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/mt5/close")
async def close(req: CloseRequest):
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(_executor, _sync_close, req.ticket)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/mt5/close-all")
async def close_all():
    loop = asyncio.get_running_loop()
    positions = await loop.run_in_executor(_executor, _sync_get_positions)
    results = []
    for p in positions:
        try:
            res = await loop.run_in_executor(_executor, _sync_close, p["ticket"])
            results.append({"ticket": p["ticket"], "status": "closed", **res})
        except Exception as e:
            results.append({"ticket": p["ticket"], "status": "error", "error": str(e)})
    return {"results": results, "total_closed": len(results)}


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Quantix MT5 Windows Bridge Starting on http://127.0.0.1:8002")
    print("Allows Docker backend to communicate with Windows MT5 terminal.")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8002)



