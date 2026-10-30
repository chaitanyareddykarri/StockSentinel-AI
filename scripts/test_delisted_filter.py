#!/usr/bin/env python3
"""
Test Delisted Suppression and Stretch Goal Detection
Evaluates the impact of chain-wide delisted filtering on the dev set.
"""
from __future__ import annotations

import sys
from pathlib import Path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import numpy as np
import pandas as pd
import evaluate

DEV_WINDOW = ("2026-06-04", "2026-09-02")
K = 20
LOOKBACK = 28


def main():
    data_dir = Path("data")
    truth = evaluate.load_truth("data/dev_truth.csv")
    
    df = pd.read_parquet(data_dir / "daily_sales_inventory.parquet",
                         columns=["date", "store_id", "sku_id", "units_sold", "on_hand_eod"])
    
    dates = np.sort(df["date"].unique())
    t = np.searchsorted(dates, df["date"].to_numpy())
    st_codes, st_names = pd.factorize(df["store_id"], sort=True)
    sk_codes, sk_names = pd.factorize(df["sku_id"], sort=True)
    
    n_stores = len(st_names)
    n_skus = len(sk_names)
    pair = st_codes.astype(np.int64) * n_skus + sk_codes
    codes, uniq = pd.factorize(pair, sort=True)
    T, N = len(dates), len(uniq)
    
    sales = np.zeros((T, N), dtype=np.float32)
    onhand = np.full((T, N), np.nan, dtype=np.float32)
    sales[t, codes] = df["units_sold"].to_numpy(dtype=np.float32)
    onhand[t, codes] = df["on_hand_eod"].to_numpy(dtype=np.float32, na_value=np.nan)
    del df, t, pair, codes
    
    onhand = pd.DataFrame(onhand).ffill().to_numpy(dtype=np.float32)
    store = st_names[uniq // n_skus]
    sku = sk_names[uniq % n_skus]
    
    # Compute run and rate
    run = np.zeros((T, N), dtype=np.int32)
    r = np.zeros(N, dtype=np.int32)
    for t_idx in range(T):
        r = np.where(sales[t_idx] == 0, r + 1, 0)
        run[t_idx] = r
        
    cs = np.vstack([np.zeros((1, N), np.float64), np.cumsum(sales, axis=0, dtype=np.float64)])
    rate = np.full((T, N), np.nan, dtype=np.float32)
    cols = np.arange(N)
    for t_idx in range(T):
        s_idx = np.clip(t_idx - run[t_idx] + 1, 0, T)
        lo = np.clip(s_idx - LOOKBACK, 0, None)
        span = s_idx - lo
        rt = (cs[s_idx, cols] - cs[lo, cols]) / np.maximum(span, 1)
        rate[t_idx] = np.where(span >= 7, rt, np.nan)

    # Compute chain-wide sales per SKU per day: shape (T, n_skus)
    chain_sales = np.zeros((T, n_skus), dtype=np.float32)
    sku_idx_in_uniq = uniq % n_skus
    for t_idx in range(T):
        np.add.at(chain_sales[t_idx], sku_idx_in_uniq, sales[t_idx])
        
    # Cumulative sum of chain sales for rolling window
    cs_chain = np.vstack([np.zeros((1, n_skus), np.float64), np.cumsum(chain_sales, axis=0, dtype=np.float64)])
    
    # Test different chain delisted lookback thresholds
    for chain_lookback in [0, 5, 7, 10, 14]:
        out = []
        for D in pd.date_range(*DEV_WINDOW, freq="D"):
            t_idx = int(np.searchsorted(dates, np.datetime64(D - pd.Timedelta(days=1))))
            if t_idx >= len(dates) or dates[t_idx] != D - pd.Timedelta(days=1):
                continue
                
            r_t = run[t_idx]
            rate_t = rate[t_idx]
            oh_t = onhand[t_idx]
            
            score = rate_t * r_t
            
            # Fast mover adaptive minimum run (StockSentinel principle)
            # Fast movers (rate >= 1.5) qualify at run >= 4 with expected missing >= 6
            # Medium movers (rate >= 0.8) qualify at run >= 5 with expected missing >= 5
            # Others qualify at run >= 7
            is_fast = (rate_t >= 1.5) & (r_t >= 4) & (score >= 6.0)
            is_med = (rate_t >= 0.8) & (r_t >= 5) & (score >= 5.0)
            is_std = (r_t >= 7)
            ok = (is_fast | is_med | is_std) & (oh_t > 0) & np.isfinite(score) & (score > 0)
            
            # Chain-wide delisted check
            if chain_lookback > 0:
                lo_c = max(0, t_idx - chain_lookback + 1)
                chain_window_sales = cs_chain[t_idx + 1] - cs_chain[lo_c]
                # If chain sales == 0 and had prior sales, mark as delisted
                is_delisted_chain = chain_window_sales[sku_idx_in_uniq] == 0
                ok = ok & (~is_delisted_chain)
                
            for s in st_names:
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
                    "reason": [f"No sales for {int(r_t[i])}d; expected {rate_t[i]:.1f}/d" for i in top],
                }))
                
        sub = pd.concat(out, ignore_index=True)
        res = evaluate.score(sub, truth)
        print(f"Chain lookback={chain_lookback:2d}d -> P@20: {res['primary_score']:.4f} | RowRec: {res['row_recall']:.4f} | EpRec: {res['episode_recall']:.4f} | Delisted%: {res['share_of_flags_on_delisted_decoys']:.4f}")


if __name__ == "__main__":
    main()

