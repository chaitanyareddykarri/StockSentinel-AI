#!/usr/bin/env python3
"""
Benchmark Experiments for StockSentinel AI vs Baseline
Tests mathematical improvements on the official development split (2026-06-04 to 2026-09-02)
using the exact official evaluate.score function.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

# Add repo root to sys.path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import numpy as np
import pandas as pd
import evaluate

DEV_WINDOW = ("2026-06-04", "2026-09-02")
K = 20
LOOKBACK = 28


def _codes(col: pd.Series):
    if isinstance(col.dtype, pd.CategoricalDtype):
        return col.cat.codes.to_numpy(), np.asarray(col.cat.categories, dtype=str)
    codes, uniq = pd.factorize(col, sort=True)
    return codes, np.asarray(uniq, dtype=str)


def load_data(data_dir: Path):
    t0 = time.time()
    df = pd.read_parquet(data_dir / "daily_sales_inventory.parquet",
                         columns=["date", "store_id", "sku_id", "units_sold", "on_hand_eod", "on_promo"])
    dates = np.sort(df["date"].unique())
    t = np.searchsorted(dates, df["date"].to_numpy())
    st_c, st_u = _codes(df["store_id"])
    sk_c, sk_u = _codes(df["sku_id"])
    pair = st_c.astype(np.int64) * len(sk_u) + sk_c
    codes, uniq = pd.factorize(pair, sort=True)
    T, N = len(dates), len(uniq)
    
    sales = np.zeros((T, N), dtype=np.float32)
    onhand = np.full((T, N), np.nan, dtype=np.float32)
    promo = np.zeros((T, N), dtype=np.int8)
    
    sales[t, codes] = df["units_sold"].to_numpy(dtype=np.float32)
    onhand[t, codes] = df["on_hand_eod"].to_numpy(dtype=np.float32, na_value=np.nan)
    promo[t, codes] = df["on_promo"].to_numpy(dtype=np.int8)
    
    del df, t, pair, codes
    onhand = pd.DataFrame(onhand).ffill().to_numpy(dtype=np.float32)
    store = st_u[uniq // len(sk_u)]
    sku = sk_u[uniq % len(sk_u)]
    print(f"Loaded {N:,} SKU-store series x {T} days in {time.time() - t0:.1f}s")
    return pd.DatetimeIndex(dates), sales, onhand, promo, store, sku


def compute_features(sales: np.ndarray, dates: pd.DatetimeIndex):
    T, N = sales.shape
    run = np.zeros((T, N), dtype=np.int32)
    r = np.zeros(N, dtype=np.int32)
    for t in range(T):
        r = np.where(sales[t] == 0, r + 1, 0)
        run[t] = r
        
    cs = np.vstack([np.zeros((1, N), np.float64), np.cumsum(sales, axis=0, dtype=np.float64)])
    rate = np.full((T, N), np.nan, dtype=np.float32)
    cols = np.arange(N)
    for t in range(T):
        s_idx = np.clip(t - run[t] + 1, 0, T)
        lo = np.clip(s_idx - LOOKBACK, 0, None)
        span = s_idx - lo
        rt = (cs[s_idx, cols] - cs[lo, cols]) / np.maximum(span, 1)
        rate[t] = np.where(span >= 7, rt, np.nan)
        
    return run, rate


def run_experiment(dates, run, rate, onhand, promo, store, sku, truth, config):
    name = config.get("name", "experiment")
    n_min_run = config.get("n_min_run", 7)
    max_run = config.get("max_run", 999)
    min_rate = config.get("min_rate", 0.0)
    adaptive_min_run = config.get("adaptive_min_run", False)
    decay_long_runs = config.get("decay_long_runs", False)
    
    out = []
    stores = np.unique(store)
    
    for D in pd.date_range(*DEV_WINDOW, freq="D"):
        t = int(np.searchsorted(dates.values, np.datetime64(D - pd.Timedelta(days=1))))
        if t >= len(dates) or dates[t] != D - pd.Timedelta(days=1):
            continue
            
        r_t = run[t]
        rate_t = rate[t]
        oh_t = onhand[t]
        
        # Base expected missing units: rate * run
        expected_missing = rate_t * r_t
        
        score = expected_missing.copy()
        
        # Eligibility condition
        if adaptive_min_run:
            # Fast movers (rate >= 1.5) qualify at run >= 4 if expected_missing >= 6.0
            # Medium movers (rate >= 0.8) qualify at run >= 5 if expected_missing >= 5.0
            # Others require run >= n_min_run
            is_fast = (rate_t >= 1.5) & (r_t >= 4) & (expected_missing >= 6.0)
            is_medium = (rate_t >= 0.8) & (r_t >= 5) & (expected_missing >= 5.0)
            is_standard = (r_t >= n_min_run)
            run_ok = is_fast | is_medium | is_standard
        else:
            run_ok = (r_t >= n_min_run)
            
        if max_run < 999:
            run_ok = run_ok & (r_t <= max_run)
            
        if decay_long_runs:
            # Beyond 25 days, delisted items accumulate high scores; apply progressive penalty
            penalty = np.where(r_t > 25, np.maximum(0.1, 1.0 - (r_t - 25) * 0.035), 1.0)
            score = score * penalty

        ok = run_ok & (oh_t > 0) & np.isfinite(score) & (score > 0) & (rate_t >= min_rate)
        
        for s in stores:
            idx = np.where(ok & (store == s))[0]
            if len(idx) == 0:
                continue
            top = idx[np.argsort(-score[idx], kind="stable")[:K]]
            sc = score[top]
            out.append(pd.DataFrame({
                "date": D.strftime("%Y-%m-%d"),
                "store_id": s,
                "sku_id": sku[top],
                "rank": np.arange(1, len(top) + 1),
                "confidence": np.round(1 - np.exp(-np.clip(sc, 0, 50)), 4),
                "reason": [f"Zero sales for {int(r_t[i])}d; expected {rate_t[i]:.1f}/d" for i in top],
            }))
            
    cols = ["date", "store_id", "sku_id", "rank", "confidence", "reason"]
    sub = pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=cols)
    
    # Official evaluation
    res = evaluate.score(sub, truth)
    print(f"[{name:35s}] P@20: {res['primary_score']:.4f} | RowRec: {res['row_recall']:.4f} | EpRec: {res['episode_recall']:.4f} | Delisted%: {res['share_of_flags_on_delisted_decoys']:.4f}")
    return res


def main():
    data_dir = Path("data")
    truth = evaluate.load_truth("data/dev_truth.csv")
    dates, sales, onhand, promo, store, sku = load_data(data_dir)
    run, rate = compute_features(sales, dates)
    
    configs = [
        {"name": "1. Baseline (N=7)", "n_min_run": 7},
        {"name": "2. Baseline (N=6)", "n_min_run": 6},
        {"name": "3. Baseline (N=8)", "n_min_run": 8},
        {"name": "4. Baseline + Cap max_run=45", "n_min_run": 7, "max_run": 45},
        {"name": "5. Baseline + Cap max_run=35", "n_min_run": 7, "max_run": 35},
        {"name": "6. Baseline + Cap max_run=30", "n_min_run": 7, "max_run": 30},
        {"name": "7. Baseline + Long Run Decay", "n_min_run": 7, "decay_long_runs": True},
        {"name": "8. StockSentinel Adaptive (Fast/Slow)", "n_min_run": 7, "adaptive_min_run": True},
        {"name": "9. StockSentinel Adaptive + Cap=35", "n_min_run": 7, "adaptive_min_run": True, "max_run": 35},
        {"name": "10. StockSentinel Adaptive + Decay", "n_min_run": 7, "adaptive_min_run": True, "decay_long_runs": True},
    ]
    
    print("\nRunning comparative parameter benchmark...")
    for cfg in configs:
        run_experiment(dates, run, rate, onhand, promo, store, sku, truth, cfg)


if __name__ == "__main__":
    main()
