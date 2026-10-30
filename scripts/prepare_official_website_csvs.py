#!/usr/bin/env python3
"""
StockSentinel AI — Official Challenge Data Adapter for Web UI Testing
Extracts and converts official Saffron Retail Group dataset files into the exact
CSV formats required by the StockSentinel AI web import interface (/import).

Outputs (in data/official_web_sample/):
  1. stores.csv              (All 25 Saffron stores -> code, name, location, store_type, total_skus)
  2. products.csv            (All 800 Saffron SKUs   -> sku, name, category, unit_price, avg_daily_demand, min_stock_threshold)
  3. daily_sales.csv         (Recent 14-day sales    -> store_id, sku, date, units_sold, revenue)
  4. inventory_snapshots.csv (Recorded system stock  -> store_id, sku, date, on_hand_stock)
  5. promotions.csv          (Active promotions      -> store_id, sku, start_date, end_date, discount_pct, promo_type)
"""
from __future__ import annotations

import os
from pathlib import Path
import pandas as pd
import numpy as np

DATA_DIR = Path("data")
OUT_DIR = Path("data/official_web_sample")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def adapt_stores():
    src = DATA_DIR / "store_master.csv"
    if not src.exists():
        print(f"[SKIP] {src} not found.")
        return
    df = pd.read_csv(src)
    # Target: code, name, location, store_type, total_skus
    out = pd.DataFrame({
        "code": df["store_id"],
        "name": df["store_name"],
        "location": df["city"] + ", " + df["state"],
        "store_type": df["format"],
        "total_skus": 800,
    })
    out_file = OUT_DIR / "stores.csv"
    out.to_csv(out_file, index=False)
    print(f"[OK] Wrote {len(out)} stores -> {out_file}")


def adapt_products():
    src = DATA_DIR / "sku_master.csv"
    if not src.exists():
        print(f"[SKIP] {src} not found.")
        return
    df = pd.read_csv(src)
    # Target: sku, name, category, unit_price, avg_daily_demand, min_stock_threshold
    out = pd.DataFrame({
        "sku": df["sku_id"],
        "name": df["sku_name"],
        "category": df["category"],
        "unit_price": df["unit_price_inr"],
        "avg_daily_demand": 2.5,  # Baseline default velocity
        "min_stock_threshold": df["case_pack"],
    })
    out_file = OUT_DIR / "products.csv"
    out.to_csv(out_file, index=False)
    print(f"[OK] Wrote {len(out)} products -> {out_file}")


def adapt_telemetry(num_days: int = 14):
    sample_file = DATA_DIR / "daily_sales_inventory_sample_2stores.csv"
    if not sample_file.exists():
        print(f"[SKIP] {sample_file} not found.")
        return
    df = pd.read_csv(sample_file)
    # Take the latest num_days of data
    dates = sorted(df["date"].unique())
    recent_dates = dates[-num_days:]
    df_recent = df[df["date"].isin(recent_dates)].copy()

    # Join SKU price for revenue calculation
    sku_master_file = DATA_DIR / "sku_master.csv"
    price_map = {}
    if sku_master_file.exists():
        skus = pd.read_csv(sku_master_file)
        price_map = dict(zip(skus["sku_id"], skus["unit_price_inr"]))

    df_recent["unit_price"] = df_recent["sku_id"].map(price_map).fillna(100.0)
    df_recent["revenue"] = np.round(df_recent["units_sold"] * df_recent["unit_price"], 2)

    # 1. Daily Sales: store_id, sku, date, units_sold, revenue
    sales_df = pd.DataFrame({
        "store_id": df_recent["store_id"],
        "sku": df_recent["sku_id"],
        "date": df_recent["date"],
        "units_sold": df_recent["units_sold"],
        "revenue": df_recent["revenue"],
    })
    sales_out = OUT_DIR / "daily_sales.csv"
    sales_df.to_csv(sales_out, index=False)
    print(f"[OK] Wrote {len(sales_df):,} sales rows -> {sales_out}")

    # 2. Inventory Snapshots: store_id, sku, date, on_hand_stock
    inv_df = pd.DataFrame({
        "store_id": df_recent["store_id"],
        "sku": df_recent["sku_id"],
        "date": df_recent["date"],
        "on_hand_stock": df_recent["on_hand_eod"].fillna(0).astype(int),
    })
    inv_out = OUT_DIR / "inventory_snapshots.csv"
    inv_df.to_csv(inv_out, index=False)
    print(f"[OK] Wrote {len(inv_df):,} inventory rows -> {inv_out}")


def adapt_promotions():
    src = DATA_DIR / "promotion_calendar.csv"
    if not src.exists():
        print(f"[SKIP] {src} not found.")
        return
    df = pd.read_csv(src)
    # Target: store_id, sku, start_date, end_date, discount_pct, promo_type
    sku_promos = df[df["scope_level"] == "sku"].copy()
    out = pd.DataFrame({
        "store_id": "ALL",
        "sku": sku_promos["scope_value"],
        "start_date": sku_promos["start_date"],
        "end_date": sku_promos["end_date"],
        "discount_pct": sku_promos["discount_pct"],
        "promo_type": sku_promos["promo_type"],
    })
    out_file = OUT_DIR / "promotions.csv"
    out.to_csv(out_file, index=False)
    print(f"[OK] Wrote {len(out)} promotions -> {out_file}")


def main():
    print("Preparing official Saffron Retail Group datasets for Web UI testing...")
    adapt_stores()
    adapt_products()
    adapt_telemetry()
    adapt_promotions()
    print("\nAll Web UI test datasets prepared successfully in data/official_web_sample/!")


if __name__ == "__main__":
    main()

