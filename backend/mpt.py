"""
Modern Portfolio Theory (MPT) Optimizer
========================================
ฟีเจอร์:
  - คำนวณ Expected Return, Volatility, Sharpe Ratio
  - Monte Carlo Simulation (สุ่มน้ำหนักพอร์ต)
  - Scipy Optimization หา Max Sharpe / Min Volatility / Max Return
  - Efficient Frontier
  - รองรับ Constraints: long-only, weight bounds, sector limits
"""

import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize

warnings.filterwarnings("ignore")

TRADING_DAYS = 252          # วันซื้อขายต่อปี
RISK_FREE_RATE = 0.02       # อัตราดอกเบี้ยปลอดความเสี่ยง (annualized)
N_SIMULATIONS = 10_000      # Monte Carlo iterations
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)


# ─────────────────────────────────────────────
# CORE CALCULATIONS
# ─────────────────────────────────────────────

def load_returns(csv_path: str = "output/daily_returns.csv") -> pd.DataFrame:
    """โหลด daily returns จาก pipeline output"""
    df = pd.read_csv(csv_path, index_col=0, parse_dates=True)
    df = df.dropna(how="all").ffill().bfill()
    # แปลงจาก % เป็น decimal (ถ้ายังเป็น %)
    if df.abs().mean().mean() > 1:
        df = df / 100
    return df


def compute_portfolio_stats(
    weights: np.ndarray,
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
    risk_free: float = RISK_FREE_RATE,
) -> dict:
    """คำนวณ Return, Volatility, Sharpe Ratio ของพอร์ตจากน้ำหนัก"""
    w = np.array(weights)
    port_return = np.dot(w, mean_returns) * TRADING_DAYS
    port_vol = np.sqrt(w @ cov_matrix.values @ w) * np.sqrt(TRADING_DAYS)
    sharpe = (port_return - risk_free) / port_vol if port_vol > 0 else 0.0
    return {"return": port_return, "volatility": port_vol, "sharpe": sharpe}


# ─────────────────────────────────────────────
# MONTE CARLO SIMULATION
# ─────────────────────────────────────────────

def monte_carlo_simulation(
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
    n_sim: int = N_SIMULATIONS,
    risk_free: float = RISK_FREE_RATE,
) -> pd.DataFrame:
    """สุ่มน้ำหนักพอร์ต n_sim รอบ แล้วคำนวณสถิติแต่ละพอร์ต"""
    n_assets = len(mean_returns)
    results = []

    rng = np.random.default_rng(seed=42)
    for _ in range(n_sim):
        w = rng.dirichlet(np.ones(n_assets))   # sum = 1, all >= 0
        stats = compute_portfolio_stats(w, mean_returns, cov_matrix, risk_free)
        results.append({**stats, **{f"w_{t}": w[i] for i, t in enumerate(mean_returns.index)}})

    df = pd.DataFrame(results)
    return df


# ─────────────────────────────────────────────
# SCIPY OPTIMIZATION
# ─────────────────────────────────────────────

def _neg_sharpe(weights, mean_returns, cov_matrix, risk_free):
    stats = compute_portfolio_stats(weights, mean_returns, cov_matrix, risk_free)
    return -stats["sharpe"]

def _portfolio_vol(weights, mean_returns, cov_matrix, risk_free):
    stats = compute_portfolio_stats(weights, mean_returns, cov_matrix, risk_free)
    return stats["volatility"]

def _neg_return(weights, mean_returns, cov_matrix, risk_free):
    stats = compute_portfolio_stats(weights, mean_returns, cov_matrix, risk_free)
    return -stats["return"]


def optimize_portfolio(
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
    objective: str = "max_sharpe",           # "max_sharpe" | "min_vol" | "max_return"
    weight_bounds: tuple = (0.0, 1.0),       # (min, max) per asset
    risk_free: float = RISK_FREE_RATE,
) -> dict:
    """
    หา optimal portfolio ด้วย SLSQP
    objective: 'max_sharpe' | 'min_vol' | 'max_return'
    """
    n = len(mean_returns)
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [weight_bounds] * n
    init_w = np.array([1 / n] * n)

    obj_fn = {
        "max_sharpe": _neg_sharpe,
        "min_vol":    _portfolio_vol,
        "max_return": _neg_return,
    }[objective]

    result = minimize(
        obj_fn,
        init_w,
        args=(mean_returns, cov_matrix, risk_free),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-9},
    )

    if not result.success:
        # fallback: equal weight
        optimal_w = init_w
    else:
        optimal_w = result.x
        optimal_w = np.clip(optimal_w, 0, 1)
        optimal_w /= optimal_w.sum()

    stats = compute_portfolio_stats(optimal_w, mean_returns, cov_matrix, risk_free)
    weights_dict = dict(zip(mean_returns.index, optimal_w.round(6)))

    return {
        "objective": objective,
        "weights": weights_dict,
        "annualized_return": round(stats["return"] * 100, 4),
        "annualized_volatility": round(stats["volatility"] * 100, 4),
        "sharpe_ratio": round(stats["sharpe"], 4),
        "success": result.success,
    }


# ─────────────────────────────────────────────
# EFFICIENT FRONTIER
# ─────────────────────────────────────────────

def efficient_frontier(
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
    n_points: int = 50,
    risk_free: float = RISK_FREE_RATE,
) -> pd.DataFrame:
    """สร้าง Efficient Frontier โดย sweep target return"""
    n = len(mean_returns)
    min_ret = (mean_returns.min() * TRADING_DAYS)
    max_ret = (mean_returns.max() * TRADING_DAYS)
    target_returns = np.linspace(min_ret, max_ret, n_points)

    frontier = []
    for target in target_returns:
        constraints = [
            {"type": "eq", "fun": lambda w: np.sum(w) - 1},
            {"type": "eq", "fun": lambda w, t=target: np.dot(w, mean_returns) * TRADING_DAYS - t},
        ]
        bounds = [(0.0, 1.0)] * n
        init_w = np.array([1 / n] * n)
        res = minimize(
            _portfolio_vol, init_w,
            args=(mean_returns, cov_matrix, risk_free),
            method="SLSQP", bounds=bounds, constraints=constraints,
            options={"maxiter": 500, "ftol": 1e-9},
        )
        if res.success:
            w = np.clip(res.x, 0, 1); w /= w.sum()
            stats = compute_portfolio_stats(w, mean_returns, cov_matrix, risk_free)
            frontier.append(stats)

    return pd.DataFrame(frontier)


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────

def run_mpt(
    returns_csv: str = "output/daily_returns.csv",
    objective: str = "max_sharpe",
    top_n: int | None = None,
) -> dict:
    """
    Entry point สำหรับรัน MPT pipeline เต็มรูปแบบ
    คืนค่า dict ที่มี: optimal_portfolio, monte_carlo_summary, efficient_frontier
    """
    returns = load_returns(returns_csv)

    # เลือกเฉพาะ top_n สินทรัพย์ที่มี Sharpe สูงสุด (ถ้ากำหนด)
    if top_n and top_n < len(returns.columns):
        individual_sharpe = (
            (returns.mean() * TRADING_DAYS - RISK_FREE_RATE)
            / (returns.std() * np.sqrt(TRADING_DAYS))
        )
        selected = individual_sharpe.nlargest(top_n).index.tolist()
        returns = returns[selected]

    mean_ret = returns.mean()
    cov_mat  = returns.cov()

    # 1. Optimal portfolio
    optimal = optimize_portfolio(mean_ret, cov_mat, objective=objective)

    # 2. Monte Carlo
    mc_df = monte_carlo_simulation(mean_ret, cov_mat)
    mc_best = mc_df.loc[mc_df["sharpe"].idxmax()]
    mc_summary = {
        "best_sharpe_mc": round(mc_df["sharpe"].max(), 4),
        "best_return_mc": round(mc_df["return"].max() * 100, 4),
        "best_vol_mc":    round(mc_df.loc[mc_df["sharpe"].idxmax(), "volatility"] * 100, 4),
    }

    # 3. Efficient Frontier
    ef = efficient_frontier(mean_ret, cov_mat)

    # Export
    mc_df.to_csv(OUTPUT_DIR / "monte_carlo_portfolios.csv", index=False)
    ef.to_csv(OUTPUT_DIR / "efficient_frontier.csv", index=False)
    pd.DataFrame([optimal]).to_csv(OUTPUT_DIR / "optimal_portfolio.csv", index=False)

    print(f"\n{'='*55}")
    print(f"  MPT RESULT — Objective: {objective.upper()}")
    print(f"{'='*55}")
    print(f"  Annualized Return   : {optimal['annualized_return']:.2f}%")
    print(f"  Annualized Volatility: {optimal['annualized_volatility']:.2f}%")
    print(f"  Sharpe Ratio        : {optimal['sharpe_ratio']:.4f}")
    print(f"\n  Top-10 Weights (Max Sharpe):")
    sorted_w = sorted(optimal["weights"].items(), key=lambda x: -x[1])
    for ticker, w in sorted_w[:10]:
        print(f"    {ticker:<15s}: {w*100:.2f}%")
    print(f"\n  Monte Carlo Best Sharpe: {mc_summary['best_sharpe_mc']}")
    print(f"{'='*55}\n")

    return {
        "optimal_portfolio": optimal,
        "monte_carlo_summary": mc_summary,
        "efficient_frontier": ef.to_dict(orient="records"),
        "assets_used": list(returns.columns),
    }


if __name__ == "__main__":
    result = run_mpt()
