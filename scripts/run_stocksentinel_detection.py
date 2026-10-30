#!/usr/bin/env python3
"""
StockSentinel AI — Official R1 Phantom Stock-Out Detector
Generates reproducible daily Top-20 prioritized shelf-audit recommendations
for the TalentAP Mega Hackathon 2026 (Saffron Retail Group).

Pipeline:
1. No-look-ahead feature extraction: 8-week lookback baseline sales velocity per SKU-store.
2. Promotional demand scaling (empirical 1.2x on-promo lift).
3. Fast/medium/slow mover adaptive streak thresholds.
4. Network-wide delisted decoy suppression (5-day zero chain sales filter).
5. Poisson zero-sales cumulative anomaly confidence.
6. Stretch-goal diagnostic categorization (phantom vs misplaced).

Outputs:
  submission/R1_predictions.csv       (Test window: 2026-09-03 to 2026-09-30, 25 stores, 14,000 rows)
  submission/R1_predictions_dev.csv   (Dev window:  2026-06-04 to 2026-09-02, 25 stores, 45,500 rows)
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Add project root to sys.path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import numpy as np
import pandas as pd

DEV_WINDOW = ("2026-06-04", "2026-09-02")
TEST_WINDOW = ("2026-09-03", "2026-09-30")
K = 20
LOOKBACK = 56           # 8 full weeks for robust weekly seasonality baseline
CHAIN_DELIST_DAYS = 5   # Suppress network-wide delisted decoys
PROMO_BOOST = 1.2       # Expected promotional demand lift


def _codes(col: pd.Series):
    if isinstance(col.dtype, pd.CategoricalDtype):
        return col.cat.codes.to_numpy(), np.asarray(col.cat.categories, dtype=str)
    codes, uniq = pd.factorize(col, sort=True)
    return codes, np.asarray(uniq, dtype=str)


def load_dataset(data_dir: Path):
    t0 = time.time()
    df = pd.read_parquet(
        data_dir / "daily_sales_inventory.parquet",
        columns=["date", "store_id", "sku_id", "units_sold", "on_hand_eod", "on_promo"],
    )
    dates = np.sort(df["date"].unique())
    t = np.searchsorted(dates, df["date"].to_numpy())
    st_codes, st_names = _codes(df["store_id"])
    sk_codes, sk_names = _codes(df["sku_id"])

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

    # Forward-fill missing on-hand readings
    onhand = pd.DataFrame(onhand).ffill().to_numpy(dtype=np.float32)
    store = st_names[uniq // n_skus]
    sku = sk_names[uniq % n_skus]

    # Precompute consecutive zero-sales streak per series
    run = np.zeros((T, N), dtype=np.int32)
    r = np.zeros(N, dtype=np.int32)
    for t_idx in range(T):
        r = np.where(sales[t_idx] == 0, r + 1, 0)
        run[t_idx] = r

    # Rolling baseline sales velocity (LOOKBACK days before the zero streak began)
    cs = np.vstack([np.zeros((1, N), np.float64), np.cumsum(sales, axis=0, dtype=np.float64)])
    rate = np.full((T, N), np.nan, dtype=np.float32)
    cols = np.arange(N)
    for t_idx in range(T):
        s_idx = np.clip(t_idx - run[t_idx] + 1, 0, T)
        lo = np.clip(s_idx - LOOKBACK, 0, None)
        span = s_idx - lo
        rt = (cs[s_idx, cols] - cs[lo, cols]) / np.maximum(span, 1)
        rate[t_idx] = np.where(span >= 7, rt, np.nan)

    # Precompute chain-wide sales per SKU per day for delisted decoy suppression
    chain_sales = np.zeros((T, n_skus), dtype=np.float32)
    sku_idx_in_uniq = uniq % n_skus
    for t_idx in range(T):
        np.add.at(chain_sales[t_idx], sku_idx_in_uniq, sales[t_idx])
    cs_chain = np.vstack([np.zeros((1, n_skus), np.float64), np.cumsum(chain_sales, axis=0, dtype=np.float64)])

    print(f"Loaded {N:,} SKU-store series across {T} days in {time.time() - t0:.1f}s")
    return pd.DatetimeIndex(dates), sales, onhand, promo, store, sku, run, rate, cs_chain, sku_idx_in_uniq, st_names


def generate_predictions(
    dates: pd.DatetimeIndex,
    run: np.ndarray,
    rate: np.ndarray,
    onhand: np.ndarray,
    promo: np.ndarray,
    store: np.ndarray,
    sku: np.ndarray,
    cs_chain: np.ndarray,
    sku_idx_in_uniq: np.ndarray,
    st_names: np.ndarray,
    window: tuple[str, str],
) -> pd.DataFrame:
    out = []
    stores = np.unique(store)

    for D in pd.date_range(*window, freq="D"):
        # No look-ahead: As of D-1 end of day
        t_idx = int(np.searchsorted(dates.values, np.datetime64(D - pd.Timedelta(days=1))))
        if t_idx >= len(dates) or dates[t_idx] != D - pd.Timedelta(days=1):
            continue

        r_t = run[t_idx]
        rate_t = rate[t_idx]
        oh_t = onhand[t_idx]
        promo_t = promo[t_idx]

        # Effective baseline demand rate with promotional lift
        eff_rate = rate_t * np.where(promo_t == 1, PROMO_BOOST, 1.0)
        expected_missing = eff_rate * r_t
        score = expected_missing.copy()

        # Multi-tier velocity qualification (StockSentinel fast/slow mover adaptation)
        is_fast = (rate_t >= 1.5) & (r_t >= 4) & (expected_missing >= 6.0)
        is_med = (rate_t >= 0.8) & (r_t >= 5) & (expected_missing >= 5.0)
        is_std = (r_t >= 7)

        # Baseline qualification: positive stock and non-zero score
        ok = (is_fast | is_med | is_std) & (oh_t > 0) & np.isfinite(score) & (score > 0)

        # Network-wide delisted decoy suppression: if 0 units sold chain-wide over CHAIN_DELIST_DAYS
        if CHAIN_DELIST_DAYS > 0:
            lo_c = max(0, t_idx - CHAIN_DELIST_DAYS + 1)
            chain_window_sales = cs_chain[t_idx + 1] - cs_chain[lo_c]
            is_delisted = chain_window_sales[sku_idx_in_uniq] == 0
            ok = ok & (~is_delisted)

        for s in stores:
            idx = np.where(ok & (store == s))[0]
            if len(idx) == 0:
                continue

            top = idx[np.argsort(-score[idx], kind="stable")[:K]]
            sc = score[top]

            # Stretch goal: Predict 'phantom' vs 'misplaced' based on episode streak length
            pred_types = ["phantom" if r_t[i] >= 6 else "misplaced" for i in top]

            # Clear, professional plain-English reasons
            reasons = [
                f"No sales for {int(r_t[i])}d with {int(oh_t[i])} recorded units; "
                f"normal rate ~{rate_t[i]:.1f}/d" + (" (promo active)" if promo_t[i] == 1 else "")
                for i in top
            ]

            out.append(pd.DataFrame({
                "date": D.strftime("%Y-%m-%d"),
                "store_id": s,
                "sku_id": sku[top],
                "rank": np.arange(1, len(top) + 1),
                "confidence": np.round(1 - np.exp(-np.clip(sc, 0, 50)), 4),
                "reason": reasons,
                "predicted_type": pred_types,
            }))

    cols = ["date", "store_id", "sku_id", "rank", "confidence", "reason", "predicted_type"]
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=cols)


def main():
    parser = argparse.ArgumentParser(description="StockSentinel AI Phantom Stock-Out Detector")
    parser.add_argument("--data", default="data", help="Directory containing official R1 data files")
    parser.add_argument("--out-dir", default="submission", help="Output directory for predictions")
    args = parser.parse_args()

    data_dir = Path(args.data)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    dates, sales, onhand, promo, store, sku, run, rate, cs_chain, sku_idx_in_uniq, st_names = load_dataset(data_dir)

    # 1. Dev Window predictions (for verification)
    print("Generating development window predictions (2026-06-04 to 2026-09-02)...")
    dev_sub = generate_predictions(
        dates, run, rate, onhand, promo, store, sku, cs_chain, sku_idx_in_uniq, st_names, DEV_WINDOW
    )
    dev_file = out_dir / "R1_predictions_dev.csv"
    dev_sub.to_csv(dev_file, index=False)
    print(f"Dev : wrote {len(dev_sub):,} rows -> {dev_file}")

    # 2. Test Window predictions (required submission)
    print("Generating test window predictions (2026-09-03 to 2026-09-30)...")
    test_sub = generate_predictions(
        dates, run, rate, onhand, promo, store, sku, cs_chain, sku_idx_in_uniq, st_names, TEST_WINDOW
    )
    test_file = out_dir / "R1_predictions.csv"
    test_sub.to_csv(test_file, index=False)
    print(f"Test: wrote {len(test_sub):,} rows -> {test_file}")

    print(f"StockSentinel AI detection pipeline completed successfully in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()

