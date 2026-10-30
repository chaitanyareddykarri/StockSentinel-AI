#!/usr/bin/env python3
"""
Hyperparameter Sweep on Development Window
Finds the optimal configuration for StockSentinel AI on the official evaluation.
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


def load_dataset():
    df = pd.read_parquet("data/daily_sales_inventory.parquet",
                         columns=["date", "store_id", "sku_id", "units_sold", "on_hand_eod", "on_promo"])
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
    promo = np.zeros((T, N), dtype=np.int8)
    
    sales[t, codes] = df["units_sold"].to_numpy(dtype=np.float32)
    onhand[t, codes] = df["on_hand_eod"].to_numpy(dtype=np.float32, na_value=np.nan)
    promo[t, codes] = df["on_promo"].to_numpy(dtype=np.int8)
    del df, t, pair, codes
    
    onhand = pd.DataFrame(onhand).ffill().to_numpy(dtype=np.float32)
    store = st_names[uniq // n_skus]
    sku = sk_names[uniq % n_skus]
    
    # Compute run
    run = np.zeros((T, N), dtype=np.int32)
    r = np.zeros(N, dtype=np.int32)
    for t_idx in range(T):
        r = np.where(sales[t_idx] == 0, r + 1, 0)
        run[t_idx] = r
        
    # Chain-wide sales per SKU per day
    chain_sales = np.zeros((T, n_skus), dtype=np.float32)
    sku_idx_in_uniq = uniq % n_skus
    for t_idx in range(T):
        np.add.at(chain_sales[t_idx], sku_idx_in_uniq, sales[t_idx])
    cs_chain = np.vstack([np.zeros((1, n_skus), np.float64), np.cumsum(chain_sales, axis=0, dtype=np.float64)])
    
    return dates, sales, onhand, promo, store, sku, run, cs_chain, sku_idx_in_uniq, st_names


def compute_rates(sales: np.ndarray, run: np.ndarray, lookback: int):
    T, N = sales.shape
    cs = np.vstack([np.zeros((1, N), np.float64), np.cumsum(sales, axis=0, dtype=np.float64)])
    rate = np.full((T, N), np.nan, dtype=np.float32)
    cols = np.arange(N)
    for t_idx in range(T):
        s_idx = np.clip(t_idx - run[t_idx] + 1, 0, T)
        lo = np.clip(s_idx - lookback, 0, None)
        span = s_idx - lo
        rt = (cs[s_idx, cols] - cs[lo, cols]) / np.maximum(span, 1)
        rate[t_idx] = np.where(span >= 7, rt, np.nan)
    return rate


def evaluate_config(dates, run, rate, onhand, promo, store, sku, cs_chain, sku_idx_in_uniq, st_names, truth, cfg):
    name = cfg["name"]
    n_min_run = cfg.get("n_min_run", 7)
    chain_delist_days = cfg.get("chain_delist_days", 5)
    promo_boost = cfg.get("promo_boost", 1.0)
    fast_mover_min_rate = cfg.get("fast_mover_min_rate", 1.5)
    fast_mover_min_run = cfg.get("fast_mover_min_run", 4)
    fast_mover_min_missing = cfg.get("fast_mover_min_missing", 6.0)
    
    out = []
    for D in pd.date_range(*DEV_WINDOW, freq="D"):
        t_idx = int(np.searchsorted(dates, np.datetime64(D - pd.Timedelta(days=1))))
        if t_idx >= len(dates) or dates[t_idx] != D - pd.Timedelta(days=1):
            continue
            
        r_t = run[t_idx]
        rate_t = rate[t_idx]
        oh_t = onhand[t_idx]
        promo_t = promo[t_idx]
        
        # Effective rate with promotional lift
        eff_rate = rate_t * np.where(promo_t == 1, promo_boost, 1.0)
        expected_missing = eff_rate * r_t
        score = expected_missing.copy()
        
        # Fast mover adaptive qualification
        is_fast = (rate_t >= fast_mover_min_rate) & (r_t >= fast_mover_min_run) & (expected_missing >= fast_mover_min_missing)
        is_med = (rate_t >= 0.8) & (r_t >= 5) & (expected_missing >= 5.0)
        is_std = (r_t >= n_min_run)
        
        ok = (is_fast | is_med | is_std) & (oh_t > 0) & np.isfinite(score) & (score > 0)
        
        # Chain delisted check at D-1
        if chain_delist_days > 0:
            lo_c = max(0, t_idx - chain_delist_days + 1)
            chain_window_sales = cs_chain[t_idx + 1] - cs_chain[lo_c]
            is_delisted = chain_window_sales[sku_idx_in_uniq] == 0
            ok = ok & (~is_delisted)
            
        for s in st_names:
            idx = np.where(ok & (store == s))[0]
            if len(idx) == 0:
                continue
            top = idx[np.argsort(-score[idx], kind="stable")[:K]]
            sc = score[top]
            
            # Predict stretch type: delisted items handled, phantom vs misplaced based on run length
            # Phantoms persist longer (median 6-10d), misplaced resolve faster
            pred_types = ["phantom" if r_t[i] >= 6 else "misplaced" for i in top]
            
            out.append(pd.DataFrame({
                "date": D.strftime("%Y-%m-%d"),
                "store_id": s,
                "sku_id": sku[top],
                "rank": np.arange(1, len(top) + 1),
                "confidence": np.round(1 - np.exp(-np.clip(sc, 0, 50)), 4),
                "reason": [f"No sales for {int(r_t[i])} days while system shows {int(oh_t[i])} units; expected ~{rate_t[i]:.1f}/day" for i in top],
                "predicted_type": pred_types,
            }))
            
    sub = pd.concat(out, ignore_index=True)
    res = evaluate.score(sub, truth)
    print(f"[{name:35s}] P@20: {res['primary_score']:.4f} | RowRec: {res['row_recall']:.4f} | EpRec: {res['episode_recall']:.4f} | Delist%: {res['share_of_flags_on_delisted_decoys']:.4f} | TypeAcc: {res.get('type_accuracy', 0):.4f}")
    return res, sub


def main():
    truth = evaluate.load_truth("data/dev_truth.csv")
    dates, sales, onhand, promo, store, sku, run, cs_chain, sku_idx_in_uniq, st_names = load_dataset()
    
    # Try different lookback windows
    for lb in [21, 28, 35]:
        rate = compute_rates(sales, run, lb)
        for p_boost in [1.0, 1.2, 1.4]:
            name = f"LB={lb}d, PromoBoost={p_boost:.1f}"
            cfg = {
                "name": name,
                "promo_boost": p_boost,
                "chain_delist_days": 5,
            }
            evaluate_config(dates, run, rate, onhand, promo, store, sku, cs_chain, sku_idx_in_uniq, st_names, truth, cfg)


if __name__ == "__main__":
    main()

