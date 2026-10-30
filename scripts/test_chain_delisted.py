#!/usr/bin/env python3
import sys
from pathlib import Path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import numpy as np
import pandas as pd
import evaluate

truth = evaluate.load_truth("data/dev_truth.csv")
df = pd.read_parquet("data/daily_sales_inventory.parquet", columns=["date", "store_id", "sku_id", "units_sold"])

# Compute chain-wide sales per SKU per day
chain_daily = df.groupby(["sku_id", "date"], observed=True)["units_sold"].sum().unstack(level=1, fill_value=0)
dates = chain_daily.columns.values
# Rolling 7-day sum of chain sales up to day t
chain_7d = chain_daily.T.rolling(window=7).sum().T

print("Chain rolling 7d computed. Shape:", chain_7d.shape)

# Let's inspect delisted SKUs in dev window
dev_labels = pd.read_csv("data/dev_labels.csv")
delisted_skus = set(dev_labels[dev_labels["label_type"] == "delisted"]["sku_id"])
print("Delisted SKUs in dev:", delisted_skus)

for sku in delisted_skus:
    # Check chain sales around June 2026
    s = chain_7d.loc[sku, "2026-06-20":"2026-07-05"]
    print(f"SKU {sku} rolling 7d chain sales:\n", s.to_dict())
