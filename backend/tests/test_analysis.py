"""Backend tests for /api/analysis/mpt, /api/analysis/regime, /api/regime/latest."""
import requests
import pytest

BASE_URL = "https://wealth-monitor-256.preview.emergentagent.com"
API = f"{BASE_URL}/api"
TOKEN = "demo_session_persistent"


@pytest.fixture
def s():
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {TOKEN}"})
    return sess


# --- /api/regime/latest -----------------------------------------------------
class TestRegimeLatest:
    def test_returns_real_regime(self, s):
        r = s.get(f"{API}/regime/latest", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # must NOT be the "no data" fallback
        assert "ยังไม่มีข้อมูล" not in str(data)
        assert "date" in data
        assert data.get("regime") in ("Bull", "Neutral", "Bear")
        for k in ("prob_bull", "prob_neutral", "prob_bear"):
            assert k in data, f"missing {k}"
            assert isinstance(data[k], (int, float))
            assert 0 <= data[k] <= 100 or 0 <= data[k] <= 1


# --- /api/analysis/mpt ------------------------------------------------------
class TestAnalysisMPT:
    def test_mpt_shape(self, s):
        r = s.get(f"{API}/analysis/mpt", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        opt = d["optimal"]
        for k in ("ret", "vol", "sharpe"):
            assert k in opt and isinstance(opt[k], (int, float))
        assert isinstance(d["monte_carlo"], list) and len(d["monte_carlo"]) > 0
        assert isinstance(d["frontier"], list) and len(d["frontier"]) > 0
        assert isinstance(d["performance"], list) and len(d["performance"]) > 0
        assert isinstance(d["weights"], list) and len(d["weights"]) > 0
        # spot-check monte_carlo shape
        mc0 = d["monte_carlo"][0]
        for k in ("ret", "vol", "sharpe"):
            assert k in mc0


# --- /api/analysis/regime ---------------------------------------------------
class TestAnalysisRegime:
    def test_regime_shape(self, s):
        r = s.get(f"{API}/analysis/regime", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        cur = d["current"]
        assert cur["regime"] in ("Bull", "Neutral", "Bear")
        for k in ("bull", "neutral", "bear"):
            assert k in cur
        assert isinstance(d["timeline"], list) and len(d["timeline"]) > 0
        assert isinstance(d["distribution"], list)
        labels = {row["name"] for row in d["distribution"]}
        assert {"Bull", "Neutral", "Bear"}.issubset(labels)
        assert isinstance(d["importance"], list) and len(d["importance"]) > 0
        assert "feature" in d["importance"][0] and "importance" in d["importance"][0]
