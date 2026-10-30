#!/usr/bin/env python3
"""
StockSentinel AI — Standalone Offline Detection Script
Runs phantom stock-out inference directly on local CSV datasets and outputs
ranked daily investigation lists (Top-20 per store).
"""

import os
import sys
import csv
import json
import argparse
from typing import Dict, List, Any

# Add project root to sys.path so ml module can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.src.detection.anomaly_detector import detect_streak_anomaly
from ml.src.ranking.store_ranker import rank_store_alerts
from ml.src.explanations.reason_generator import generate_alert_explanation


def load_csv(file_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def run_detection(data_dir: str, output_path: str = None) -> List[Dict[str, Any]]:
    stores_raw = load_csv(os.path.join(data_dir, "stores.csv"))
    products_raw = load_csv(os.path.join(data_dir, "products.csv"))
    sales_raw = load_csv(os.path.join(data_dir, "daily_sales.csv"))
    inventory_raw = load_csv(os.path.join(data_dir, "inventory_snapshots.csv"))
    promos_raw = load_csv(os.path.join(data_dir, "promotions.csv"))

    if not stores_raw or not products_raw or not sales_raw or not inventory_raw:
        print("[ERROR] Required CSV files missing in data directory.")
        return []

    # Map products
    product_map = {}
    for p in products_raw:
        sku = p.get("sku") or p.get("id")
        product_map[sku] = {
            "sku": sku,
            "name": p.get("name", sku),
            "category": p.get("category", "General"),
            "unit_price": float(p.get("unit_price", 10.0)),
            "avg_daily_demand": float(p.get("avg_daily_demand", 1.0)),
        }

    # Latest inventory by (store_id, sku)
    latest_inv = {}
    for inv in inventory_raw:
        k = (inv.get("store_id"), inv.get("sku"))
        date = inv.get("date", "")
        if k not in latest_inv or date > latest_inv[k]["date"]:
            latest_inv[k] = {
                "date": date,
                "on_hand": int(float(inv.get("on_hand_stock", 0))),
            }

    # Sales history by (store_id, sku)
    sales_by_pair: Dict[tuple, List[Dict[str, Any]]] = {}
    for s in sales_raw:
        k = (s.get("store_id"), s.get("sku"))
        if k not in sales_by_pair:
            sales_by_pair[k] = []
        sales_by_pair[k].append({
            "date": s.get("date", ""),
            "units_sold": int(float(s.get("units_sold", 0))),
        })

    all_ranked_alerts: List[Dict[str, Any]] = []

    for store in stores_raw:
        store_id = store.get("code") or store.get("id")
        store_name = store.get("name", store_id)
        store_candidates = []

        for sku, prod in product_map.items():
            k = (store_id, sku)
            inv_info = latest_inv.get(k)
            if not inv_info or inv_info["on_hand"] <= 0:
                continue

            history = sales_by_pair.get(k, [])
            if not history:
                continue

            # Check promotion
            is_promo = any(
                (p.get("store_id") in [store_id, "ALL"]) and p.get("sku") == sku
                for p in promos_raw
            )

            anomaly = detect_streak_anomaly(
                sales_history=history,
                on_hand_stock=inv_info["on_hand"],
                base_demand=prod["avg_daily_demand"],
                unit_price=prod["unit_price"],
                is_promo=is_promo,
            )

            if anomaly.get("is_anomaly"):
                reason = generate_alert_explanation(
                    recorded_stock=inv_info["on_hand"],
                    consecutive_zero_days=anomaly["consecutive_zero_days"],
                    expected_daily_sales=anomaly["expected_daily_units"],
                    poisson_p=anomaly["poisson_anomaly_p"],
                    is_promo=is_promo,
                    base_demand=prod["avg_daily_demand"],
                )
                store_candidates.append({
                    "store_id": store_id,
                    "store_name": store_name,
                    "sku": sku,
                    "product_name": prod["name"],
                    "category": prod["category"],
                    "unit_price": prod["unit_price"],
                    "risk_score": anomaly["risk_score"],
                    "risk_category": anomaly["risk_category"],
                    "consecutive_zero_days": anomaly["consecutive_zero_days"],
                    "recorded_stock": anomaly["recorded_stock"],
                    "expected_daily_sales": anomaly["expected_daily_units"],
                    "est_lost_revenue_daily": anomaly["est_lost_revenue_daily"],
                    "poisson_anomaly_p": anomaly["poisson_anomaly_p"],
                    "primary_reason": reason,
                })

        ranked = rank_store_alerts(store_candidates, max_rank=20)
        all_ranked_alerts.extend(ranked)

    print(f"\nDetection complete: Generated {len(all_ranked_alerts)} prioritized alerts across {len(stores_raw)} stores.")
    for store in stores_raw:
        s_id = store.get("code") or store.get("id")
        s_alerts = [a for a in all_ranked_alerts if a["store_id"] == s_id]
        print(f"  Store '{s_id}': {len(s_alerts)} alerts (Top score: {s_alerts[0]['risk_score'] if s_alerts else 'N/A'})")

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_ranked_alerts, f, indent=2)
        print(f"\nExported alerts to: {output_path}")

    return all_ranked_alerts


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="StockSentinel AI Standalone Offline Detection")
    parser.add_argument("--data-dir", type=str, default="data/sample", help="Directory containing retail CSVs")
    parser.add_argument("--output", type=str, default="data/processed/alerts.json", help="Output file path")
    args = parser.parse_args()

    print("=================================================================")
    print("  StockSentinel AI -- Standalone Offline Detection Pipeline")
    print("=================================================================")
    run_detection(data_dir=args.data_dir, output_path=args.output)


if __name__ == "__main__":
    main()

