"""Deterministic unit tests for terminal.py — no live network (yf.download is monkeypatched)."""
import asyncio
import math
import time

import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import terminal


@pytest.fixture(autouse=True)
def _clear_caches():
    terminal._candle_cache.clear()
    terminal._quote_cache.clear()
    terminal._candle_locks.clear()
    terminal._quote_locks.clear()
    yield


def _fake_candle_frame():
    idx = pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"])
    return pd.DataFrame(
        {
            "Open":   [10.0, np.nan, 12.0],   # NaN must fall back to close, never serialize NaN
            "High":   [11.0, 12.0, 13.0],
            "Low":    [9.0, 10.0, 11.0],
            "Close":  [10.5, 11.5, 12.5],
            "Volume": [100.0, 200.0, 300.0],
        },
        index=idx,
    )


def _fake_quote_frame(symbols):
    idx = pd.to_datetime(["2024-01-02", "2024-01-03"])
    fields = ["Open", "High", "Low", "Close", "Volume"]
    cols = pd.MultiIndex.from_product([fields, symbols])
    data = {}
    for f in fields:
        for i, sym in enumerate(symbols):
            base = 100.0 + i
            data[(f, sym)] = [base, base + 1] if f != "Volume" else [1000.0, 2000.0]
    return pd.DataFrame(data, columns=cols, index=idx)


# ---- pure helpers ----
def test_num_handles_nan_none_and_invalid():
    assert terminal._num(float("nan"), 7.0) == 7.0
    assert terminal._num(None, 3.0) == 3.0
    assert terminal._num("x", 2.0) == 2.0
    assert terminal._num("5.5") == 5.5
    assert terminal._num(4) == 4.0


def test_series_flattens_multiindex():
    flat = _fake_candle_frame()
    assert terminal._series(flat, "Close").tolist() == [10.5, 11.5, 12.5]
    multi = _fake_quote_frame(["AAPL"])
    s = terminal._series(multi, "Close")
    assert isinstance(s, pd.Series)


# ---- candle building: NaN safety + shape ----
def test_download_candles_replaces_nan_and_is_json_safe(monkeypatch):
    monkeypatch.setattr(terminal.yf, "download", lambda *a, **k: _fake_candle_frame())
    out = terminal._download_candles("NVDA", "1d")
    assert out["symbol"] == "NVDA" and out["tf"] == "1d"
    candles = out["candles"]
    assert len(candles) == 3
    # The NaN Open on row 2 falls back to that row's close (11.5), not NaN.
    assert candles[1]["o"] == 11.5
    for c in candles:
        for k in ("o", "h", "l", "c", "v"):
            assert not math.isnan(c[k])
    ts = [c["t"] for c in candles]
    assert ts == sorted(ts)


def test_download_quotes_parses_change_and_dollar_vol(monkeypatch):
    syms = ["AAPL", "MSFT"]
    monkeypatch.setattr(terminal.yf, "download", lambda *a, **k: _fake_quote_frame(syms))
    out = terminal._download_quotes(syms)
    got = {q["symbol"]: q for q in out["quotes"]}
    assert set(got) == set(syms)
    aapl = got["AAPL"]
    assert aapl["price"] == 101.0 and aapl["prev"] == 100.0
    assert aapl["change"] == 1.0 and aapl["change_pct"] == 1.0
    assert aapl["dollar_vol"] == pytest.approx(101.0 * 2000.0)


# ---- stale fallback when Yahoo fails but a snapshot is cached ----
def test_get_candles_stale_fallback(monkeypatch):
    good = {
        "symbol": "NVDA", "tf": "1d",
        "candles": [{"t": 1, "o": 1, "h": 1, "l": 1, "c": 1, "v": 1}],
        "status": "live",
    }
    terminal._candle_cache["NVDA:1d"] = (time.time() - 10_000, good)   # expired entry

    def boom(*a, **k):
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(terminal, "_download_candles", boom)
    res = asyncio.run(terminal._get_candles("NVDA", "1d"))
    assert res["status"] == "stale"
    assert res["candles"] == good["candles"]


def test_get_candles_502_when_no_cache(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(terminal, "_download_candles", boom)
    with pytest.raises(HTTPException) as ei:
        asyncio.run(terminal._get_candles("ZZZZ", "1d"))
    assert ei.value.status_code == 502


# ---- route-level: invalid timeframe is rejected before any fetch ----
def test_invalid_timeframe_returns_400():
    app = FastAPI()
    terminal.register(app)
    client = TestClient(app)
    r = client.get("/api/terminal/candles", params={"symbol": "NVDA", "tf": "bogus"})
    assert r.status_code == 400


def test_quotes_cache_key_is_order_independent(monkeypatch):
    calls = {"n": 0}

    def fake(*a, **k):
        calls["n"] += 1
        return _fake_quote_frame(["AAPL", "MSFT"])

    monkeypatch.setattr(terminal.yf, "download", fake)
    asyncio.run(terminal._get_quotes(["AAPL", "MSFT"]))
    asyncio.run(terminal._get_quotes(["MSFT", "AAPL"]))   # same set, different order
    assert calls["n"] == 1   # second call served from cache
