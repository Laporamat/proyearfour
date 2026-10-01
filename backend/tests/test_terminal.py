"""Backend tests for /api/terminal/* endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://6bc5b9b5-c6f7-4c42-a3c7-5fae1f5f9e89.preview.emergentagent.com").rstrip("/")

DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "JPM", "XOM"]
VALID_TFS = ["1m", "5m", "15m", "1h", "1d", "1wk", "1mo"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- /api/terminal/symbols ----
class TestSymbols:
    def test_symbols_returns_lists(self, client):
        r = client.get(f"{BASE_URL}/api/terminal/symbols", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "symbols" in data and "timeframes" in data
        assert data["symbols"] == DEFAULT_WATCHLIST
        assert data["timeframes"] == VALID_TFS


# ---- /api/terminal/candles ----
class TestCandles:
    @pytest.mark.parametrize("tf", ["1m", "1h", "1d", "1wk", "1mo"])
    def test_candles_timeframes(self, client, tf):
        r = client.get(f"{BASE_URL}/api/terminal/candles", params={"symbol": "NVDA", "tf": tf}, timeout=60)
        if r.status_code == 502:
            pytest.skip(f"Yahoo upstream rate-limited for tf={tf}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["symbol"] == "NVDA"
        assert d["tf"] == tf
        assert d["status"] in ("live", "stale")
        candles = d["candles"]
        assert isinstance(candles, list) and len(candles) > 0
        # Check keys and numeric types on first & last
        for c in (candles[0], candles[-1]):
            for k in ("t", "o", "h", "l", "c", "v"):
                assert k in c
                assert isinstance(c[k], (int, float))
        # Ascending timestamps
        ts = [c["t"] for c in candles]
        assert ts == sorted(ts), f"timestamps not ascending for tf={tf}"

    def test_candles_invalid_tf(self, client):
        r = client.get(f"{BASE_URL}/api/terminal/candles", params={"symbol": "NVDA", "tf": "bogus"}, timeout=30)
        assert r.status_code == 400


# ---- /api/terminal/quotes ----
class TestQuotes:
    def test_quotes_with_symbols(self, client):
        r = client.get(f"{BASE_URL}/api/terminal/quotes", params={"symbols": "AAPL,MSFT,NVDA"}, timeout=60)
        if r.status_code == 502:
            pytest.skip("Yahoo upstream rate-limited for quotes")
        assert r.status_code == 200
        d = r.json()
        assert "quotes" in d
        syms = {q["symbol"] for q in d["quotes"]}
        assert syms == {"AAPL", "MSFT", "NVDA"}
        for q in d["quotes"]:
            for k in ("symbol", "price", "change_pct", "volume", "dollar_vol"):
                assert k in q
            assert isinstance(q["price"], (int, float)) and q["price"] > 0
            assert isinstance(q["change_pct"], (int, float))
            assert isinstance(q["volume"], (int, float))
            assert isinstance(q["dollar_vol"], (int, float))

    def test_quotes_default_watchlist(self, client):
        r = client.get(f"{BASE_URL}/api/terminal/quotes", timeout=60)
        if r.status_code == 502:
            pytest.skip("Yahoo upstream rate-limited for quotes")
        assert r.status_code == 200
        d = r.json()
        syms = {q["symbol"] for q in d["quotes"]}
        # Allow a couple to be missing due to Yahoo flakiness; ensure majority present.
        intersect = syms & set(DEFAULT_WATCHLIST)
        assert len(intersect) >= 8, f"Only got {syms}"
