#!/usr/bin/env python3
"""
StockSentinel AI — Benchmark Evaluation Script
Evaluates Phantom Stock-Out Detection Performance on Synthetic & Historical Retail Datasets

Key Metrics:
- Precision@10
- Precision@20 (Primary Competition Metric)
- Recall
- Average Rank of True Phantom Cases

NOTE: Hidden evaluation labels are strictly isolated and never passed into inference features!
"""

import math
import random
import argparse
import sys
import os
from typing import Dict, List, Tuple

# Ensure repository root is on sys.path for ml imports
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from ml.src.evaluation.metrics import estimate_annual_recovery_rupees


# Day of week demand multipliers (0 = Sun, 1 = Mon, ..., 6 = Sat)
DOW_MULTIPLIERS = {
    0: 1.35,  # Sun peak
    1: 0.85,  # Mon
    2: 0.90,  # Tue
    3: 0.95,  # Wed
    4: 1.05,  # Thu
    5: 1.30,  # Fri peak
    6: 1.45,  # Sat peak
}


def generate_evaluation_benchmark_data(num_stores=5, num_skus=100, days=60, phantom_rate=0.03, seed=2026):
    """
    Generates realistic synthetic evaluation dataset with hidden ground-truth labels.
    """
    random.seed(seed)
    
    stores = [{'id': f'STORE-{i:03d}', 'name': f'Store #{i+1}'} for i in range(num_stores)]
    categories = ['Dairy', 'Beverages', 'Bakery', 'Snacks', 'Personal Care', 'Household']
    
    products = []
    for i in range(num_skus):
        base_demand = random.choice([0.25, 0.4, 0.8, 1.5, 2.2, 3.5, 5.0, 6.5])
        products.append({
            'sku': f'SKU-{i+1:04d}',
            'name': f'Product {i+1}',
            'category': random.choice(categories),
            'unit_price': round(random.uniform(2.5, 25.0), 2),
            'avg_daily_demand': base_demand,
        })
        
    sales_history = {}  # (store_id, sku) -> list of units_sold
    inventory_snapshots = {}  # (store_id, sku) -> on_hand_stock
    promotions = {}  # (store_id, sku) -> bool is_promo
    
    # Hidden ground-truth labels for evaluation only!
    ground_truth_labels = {}  # (store_id, sku) -> bool (is_phantom_stockout)
    
    for s in stores:
        for p in products:
            key = (s['id'], p['sku'])
            is_promo = random.random() < 0.15
            promotions[key] = is_promo
            promo_mult = 1.6 if is_promo else 1.0
            
            # Determine if this pair has a ground truth phantom stockout
            is_phantom = random.random() < phantom_rate
            # High demand items are more prone to shelf exhaustion / displaced backroom
            if p['avg_daily_demand'] >= 3.0 and random.random() < 0.08:
                is_phantom = True
            
            ground_truth_labels[key] = is_phantom
            
            # Generate sales sequence
            series = []
            on_hand = max(5, int(p['avg_daily_demand'] * 6 + random.randint(2, 15)))
            
            # If phantom stockout: zero sales over last 3-6 days while on_hand is positive
            phantom_streak = random.randint(3, 6) if is_phantom else 0
            
            for d in range(days):
                dow = d % 7
                dow_mult = DOW_MULTIPLIERS[dow]
                expected = p['avg_daily_demand'] * dow_mult * promo_mult
                
                days_from_end = days - 1 - d
                if is_phantom and days_from_end < phantom_streak:
                    sold = 0
                else:
                    if expected < 0.5:
                        sold = 1 if random.random() < expected else 0
                    else:
                        sold = max(0, int(random.gauss(expected, 1.2)))
                
                series.append(sold)
                
            sales_history[key] = series
            inventory_snapshots[key] = on_hand

    return stores, products, sales_history, inventory_snapshots, promotions, ground_truth_labels


def run_inference_detection(stores, products, sales_history, inventory_snapshots, promotions) -> Dict[str, List[Dict]]:
    """
    Simulates the explainable baseline detection engine on inference features only.
    """
    alerts_by_store = {}
    
    for s in stores:
        store_id = s['id']
        store_alerts = []
        
        for p in products:
            sku = p['sku']
            key = (store_id, sku)
            
            on_hand = inventory_snapshots.get(key, 0)
            if on_hand <= 0:
                continue
                
            sales = sales_history.get(key, [])
            if not sales:
                continue
                
            # Count consecutive zeros at end of window
            streak = 0
            for val in reversed(sales[-14:]):
                if val == 0:
                    streak += 1
                else:
                    break
                    
            if streak < 2:
                continue
                
            is_promo = promotions.get(key, False)
            promo_mult = 1.6 if is_promo else 1.0
            base_demand = p['avg_daily_demand']
            
            # Expected cumulative demand
            # Approximate average DOW factor over streak
            cum_lambda = base_demand * streak * 1.15 * promo_mult
            clamped_lambda = min(cum_lambda, 50.0)
            p_zero = math.exp(-clamped_lambda)
            
            # Slow mover protection
            is_slow = base_demand < 0.6
            is_fast = base_demand >= 2.5
            
            if is_slow and p_zero > 0.15:
                continue
                
            # Score formulation
            p_score = (1.0 - min(p_zero, 1.0)) * 50.0
            day_factor = min(25.0, (streak / max(1.0, 1.0 / base_demand)) * 12.0)
            stock_factor = min(15.0, min(on_hand, 20) * 0.75)
            promo_boost = 10.0 if is_promo else 0.0
            
            raw_score = p_score + day_factor + stock_factor + promo_boost
            if is_slow:
                raw_score *= 0.65
            if is_fast and streak >= 3 and on_hand >= 5:
                raw_score = max(raw_score, 78.0)
                
            risk_score = max(1, min(99, int(round(raw_score))))
            
            store_alerts.append({
                'store_id': store_id,
                'sku': sku,
                'risk_score': risk_score,
                'consecutive_zero_days': streak,
                'recorded_stock': on_hand,
            })
            
        store_alerts.sort(key=lambda x: x['risk_score'], reverse=True)
        alerts_by_store[store_id] = store_alerts[:20]
        
    return alerts_by_store


def evaluate_detection_results(alerts_by_store, ground_truth_labels):
    """
    Computes Precision@10, Precision@20, Recall, and Average Rank.
    """
    p10_list = []
    p20_list = []
    total_true_phantoms = sum(1 for v in ground_truth_labels.values() if v)
    detected_phantoms = 0
    ranks = []
    
    for store_id, alerts in alerts_by_store.items():
        top_10 = alerts[:10]
        tp_10 = sum(1 for a in top_10 if ground_truth_labels.get((store_id, a['sku']), False))
        p10_list.append(tp_10 / len(top_10) if top_10 else 0)
        
        top_20 = alerts[:20]
        tp_20 = sum(1 for a in top_20 if ground_truth_labels.get((store_id, a['sku']), False))
        p20_list.append(tp_20 / len(top_20) if top_20 else 0)
        
        for rank, a in enumerate(alerts, 1):
            if ground_truth_labels.get((store_id, a['sku']), False):
                detected_phantoms += 1
                ranks.append(rank)
                
    mean_p10 = (sum(p10_list) / len(p10_list)) * 100 if p10_list else 0
    mean_p20 = (sum(p20_list) / len(p20_list)) * 100 if p20_list else 0
    recall = (detected_phantoms / total_true_phantoms) * 100 if total_true_phantoms > 0 else 0
    avg_rank = sum(ranks) / len(ranks) if ranks else 0
    f1 = 2 * (mean_p20 * recall) / (mean_p20 + recall) if (mean_p20 + recall) > 0 else 0
    
    return {
        'precision_at_10': round(mean_p10, 2),
        'precision_at_20': round(mean_p20, 2),
        'recall': round(recall, 2),
        'f1_score': round(f1, 2),
        'average_rank': round(avg_rank, 2),
        'detected_phantoms': detected_phantoms,
        'total_true_phantoms': total_true_phantoms,
    }


def main():
    parser = argparse.ArgumentParser(description="StockSentinel AI Evaluation Benchmark")
    parser.add_argument("--stores", type=int, default=5, help="Number of stores to evaluate")
    parser.add_argument("--skus", type=int, default=100, help="Number of SKUs per store")
    parser.add_argument("--days", type=int, default=60, help="Days of sales history")
    parser.add_argument("--seed", type=int, default=2026, help="Random seed for reproducibility")
    args = parser.parse_args()

    print("=================================================================")
    print("  StockSentinel AI -- Phantom Stock-Out Baseline Benchmark")
    print("  Evaluation Protocol: Top-20 Daily Investigation List")
    print("=================================================================")
    print(f"Generating benchmark dataset ({args.stores} stores, {args.skus} SKUs, {args.days} days)...")
    
    stores, products, sales, inventory, promos, ground_truth = generate_evaluation_benchmark_data(
        num_stores=args.stores, num_skus=args.skus, days=args.days, seed=args.seed
    )
    
    total_pairs = len(stores) * len(products)
    true_phantoms = sum(1 for v in ground_truth.values() if v)
    print(f"Total SKU-Store pairs evaluated: {total_pairs}")
    print(f"Total Ground-Truth Hidden Phantoms: {true_phantoms} (~{(true_phantoms / total_pairs * 100):.1f}%)")
    print("\nRunning inference detection (without ground-truth labels)...")
    
    alerts_by_store = run_inference_detection(stores, products, sales, inventory, promos)
    results = evaluate_detection_results(alerts_by_store, ground_truth)
    
    print("Evaluating Top-K precision and recall...")
    print("-----------------------------------------------------------------")
    print(f"  Precision@10:             {results['precision_at_10']}%")
    print(f"  Precision@20:             {results['precision_at_20']}%  (Competition Standard)")
    print(f"  Recall (Top 20):          {results['recall']}%")
    print(f"  F1-Score:                 {results['f1_score']}")
    print(f"  Average Rank of Phantoms: #{results['average_rank']}")
    print(f"  Detected True Phantoms:   {results['detected_phantoms']} / {results['total_true_phantoms']}")
    print("-----------------------------------------------------------------")

    # Financial Recovery Estimation (Transparent Annual Rupees Recovered)
    recovery = estimate_annual_recovery_rupees(
        precision_at_20=results['precision_at_20'],
        num_stores=args.stores,
        daily_walks_per_store=20,
        avg_lost_per_phantom_rupees=3850.0,
        resolution_rate=0.85,
        operational_days_per_year=365,
    )
    print("\n=================================================================")
    print("  Financial Recovery Estimation (Annual Rupees Recovered)")
    print("  Problem R1 Outcome: Transparent Calculations")
    print("=================================================================")
    for step in recovery['calculation_steps']:
        print(f"  {step}")
    print("-----------------------------------------------------------------")
    print(f"  Estimated Daily Recovered:   INR {recovery['daily_rupees_recovered']:,.2f}")
    print(f"  Estimated Annual Recovered:  INR {recovery['annual_rupees_recovered']:,.2f} ({recovery['formatted_crores']})")
    print("=================================================================")
    print("Evaluation successfully completed.")



if __name__ == '__main__':
    main()

