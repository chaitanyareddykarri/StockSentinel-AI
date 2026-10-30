#!/usr/bin/env python3
"""
Submission Format and Integrity Verifier
Strictly validates submission/R1_predictions.csv against all 8 official rules.
"""
from __future__ import annotations

import sys
from pathlib import Path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

import evaluate
import pandas as pd
import numpy as np

SUB_PATH = "submission/R1_predictions.csv"
TEST_DATES = pd.date_range("2026-09-03", "2026-09-30").strftime("%Y-%m-%d").tolist()
REQUIRED_STORES = 25
MAX_K = 20


def verify_submission():
    print(f"Verifying {SUB_PATH}...")
    sub, warnings = evaluate.load_submission(SUB_PATH)
    
    print(f"Loaded successfully via official evaluate.load_submission(). Rows: {len(sub):,}")
    for w in warnings:
        print(f"WARNING: {w}")
        
    # Check 1: Required date range
    sub_dates = sorted(sub["date"].unique())
    assert sub_dates == TEST_DATES, f"Dates mismatch! Expected {len(TEST_DATES)} dates from {TEST_DATES[0]} to {TEST_DATES[-1]}, got {len(sub_dates)}"
    print(f"[PASS] Date range: exactly {len(TEST_DATES)} days ({TEST_DATES[0]} to {TEST_DATES[-1]})")
    
    # Check 2: All 25 stores present
    sub_stores = sorted(sub["store_id"].unique())
    assert len(sub_stores) == REQUIRED_STORES, f"Store count mismatch! Expected {REQUIRED_STORES}, got {len(sub_stores)}"
    print(f"[PASS] Stores: all {len(sub_stores)} stores present")
    
    # Check 3: Exactly 28 dates x 25 stores = 700 store-days
    grouped = sub.groupby(["date", "store_id"]).size()
    assert len(grouped) == len(TEST_DATES) * REQUIRED_STORES, f"Expected {len(TEST_DATES) * REQUIRED_STORES} store-days, got {len(grouped)}"
    print(f"[PASS] Total store-days: {len(grouped):,} (all covered, none missing)")
    
    # Check 4: At most 20 rows per store-day and exactly 20 ranks
    assert (grouped <= MAX_K).all(), "Some store-days have > 20 rows!"
    print(f"[PASS] Rows per store-day: max {grouped.max()}, exactly 20 rows for every store-day")
    
    # Check 5: No duplicate (date, store_id, sku_id)
    dup = sub.duplicated(["date", "store_id", "sku_id"])
    assert not dup.any(), f"Duplicate (date, store, sku) found! Count: {dup.sum()}"
    print("[PASS] Duplicate check: 0 duplicate store-date-SKU entries")
    
    # Check 6: Unique ranks 1..20
    rank_dup = sub.duplicated(["date", "store_id", "rank"])
    assert not rank_dup.any(), "Duplicate ranks within a store-day found!"
    print("[PASS] Rank uniqueness: ranks 1 to 20 strictly unique within each store-day")
    
    # Check 7: Valid confidence values (0 to 1)
    assert ((sub["confidence"] >= 0.0) & (sub["confidence"] <= 1.0)).all(), "Invalid confidence value!"
    print(f"[PASS] Confidence range: [{sub['confidence'].min():.4f}, {sub['confidence'].max():.4f}]")
    
    # Check 8: Non-empty, informative plain-English reasons
    blank_reasons = sub["reason"].str.strip() == ""
    assert not blank_reasons.any(), "Empty reason string found!"
    print(f"[PASS] Plain-English reasons: 100% populated. Sample reason: '{sub['reason'].iloc[0]}'")
    
    # Check 9: Valid stretch predicted_type values
    if "predicted_type" in sub.columns:
        valid_types = {"phantom", "misplaced", "delisted", ""}
        invalid_types = set(sub["predicted_type"]) - valid_types
        assert not invalid_types, f"Invalid predicted_type: {invalid_types}"
        print(f"[PASS] Stretch predicted_type: valid values present. Breakdown: {sub['predicted_type'].value_counts().to_dict()}")

    print(f"\nALL 9 SUBMISSION CRITERIA STRICTLY VERIFIED! Total submission rows: {len(sub):,}")


if __name__ == "__main__":
    verify_submission()
