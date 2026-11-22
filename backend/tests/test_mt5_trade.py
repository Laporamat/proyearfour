"""
test_mt5_trade.py — Unit tests for MetaTrader 5 trading module.
"""
import pytest
from mt5_trade import (
    OrderRequest,
    CloseRequest,
    ConnectRequest,
    RebalanceTradeRequest,
    _format_account,
    _state,
)


def test_order_request_validation():
    req = OrderRequest(symbol="XAUUSD", action="BUY", volume=0.01, sl=2650.0, tp=2750.0)
    assert req.symbol == "XAUUSD"
    assert req.action == "BUY"
    assert req.volume == 0.01
    assert req.sl == 2650.0
    assert req.tp == 2750.0


def test_order_request_invalid_volume():
    with pytest.raises(Exception):
        OrderRequest(symbol="EURUSD", action="BUY", volume=-0.1)


def test_close_request():
    req = CloseRequest(ticket=987654321)
    assert req.ticket == 987654321


def test_rebalance_request():
    req = RebalanceTradeRequest(
        allocations={"AAPL": 0.3, "NVDA": 0.4, "XAUUSD": 0.3},
        total_risk_equity=5000.0,
    )
    assert req.allocations["AAPL"] == 0.3
    assert req.total_risk_equity == 5000.0


def test_format_account_none():
    assert _format_account(None) == {}


def test_format_account_mock():
    class MockAccount:
        login = 12345678
        trade_mode = 0  # Demo
        name = "Test Investor"
        server = "MetaQuotes-Demo"
        currency = "USD"
        company = "MetaQuotes Software Corp."
        balance = 10000.55
        equity = 10250.80
        profit = 250.25
        margin = 150.00
        margin_free = 10100.80
        margin_level = 6833.86
        leverage = 500

    formatted = _format_account(MockAccount())
    assert formatted["login"] == 12345678
    assert formatted["trade_mode"] == "Demo"
    assert formatted["balance"] == 10000.55
    assert formatted["equity"] == 10250.80
    assert formatted["profit"] == 250.25
    assert formatted["leverage"] == 500
