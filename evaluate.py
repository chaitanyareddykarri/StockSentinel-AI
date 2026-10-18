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
from typing import Dict, List, Tuple

# Day of week demand multipliers (0 = Sun, 1 = Mon, ..., 6 = Sat)
DOW_MULTIPLIERS = {
    0: 1.35, # Sun peak
    1: 0.85, # Mon
    2: 0.90, # Tue
    3: 0.95, # Wed
    4: 1.05, # Thu
    5: 1.30, # Fri peak
    6: 1.45, # Sat peak
}

def generate_evaluation_benchmark_data(num_stores=5, num_skus=100, days=60, phantom_rate=0.03):
    """
    Generates realistic synthetic evaluation dataset with hidden ground-truth labels.
    """
    random.seed(2026)
    
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
        
    sales_history = {} # (store_id, sku) -> list of units_sold
    inventory_snapshots = {} # (store_id, sku) -> on_hand_stock
    promotions = {} # (store_id, sku) -> bool is_promo
    
    # Hidden ground-truth labels for evaluation only!
    ground_truth_labels = {} # (store_id, sku) -> bool (is_phantom_stockout)
    
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
    Runs the Baseline Explainable Detection Algorithm WITHOUT access to ground_truth_labels!
    Returns ranked alerts per store.
    """
    ranked_alerts_per_store = {}
    
    for s in stores:
        store_alerts = []
        for p in products:
            key = (s['id'], p['sku'])
            on_hand = inventory_snapshots.get(key, 0)
            
            # Phantom stockout requires positive recorded on-hand stock
            if on_hand <= 0:
                continue
                
            series = sales_history.get(key, [])
            if not series:
                continue
                
            # Count consecutive zero sales days at the end of the series
            consecutive_zeros = 0
            for val in reversed(series):
                if val == 0:
                    consecutive_zeros += 1
                else:
                    break
                    
            if consecutive_zeros < 2:
                continue
                
            is_promo = promotions.get(key, False)
            promo_mult = 1.6 if is_promo else 1.0
            base_demand = p['avg_daily_demand']
            
            # Calculate cumulative expected demand over the zero streak
            streak_expected = base_demand * consecutive_zeros * promo_mult
            clamped_lambda = min(streak_expected, 40)
            poisson_zero_p = math.exp(-clamped_lambda)
            
            # Fast/slow mover logic
            is_slow = base_demand < 0.6
            is_fast = base_demand >= 2.5
            
            if is_slow and poisson_zero_p > 0.15:
                continue
                
            # Risk scoring
            p_score = max(0, min(50, round((1.0 - min(poisson_zero_p, 1.0)) * 50)))
            day_score = min(25, round((consecutive_zeros / max(1.0, 1.0 / base_demand)) * 12))
            stock_score = min(15, round(min(on_hand, 20) * 0.75))
            promo_boost = 10 if is_promo else 0
            
            raw_score = p_score + day_score + stock_score + promo_boost
            if is_slow:
                raw_score = round(raw_score * 0.65)
            if is_fast and consecutive_zeros >= 3 and on_hand >= 5:
                raw_score = max(raw_score, 78)
                
            score = max(1, min(99, raw_score))
            
            store_alerts.append({
                'store_id': s['id'],
                'sku': p['sku'],
                'risk_score': score,
                'consecutive_zeros': consecutive_zeros,
                'on_hand': on_hand,
                'poisson_p': poisson_zero_p,
            })
            
        # Sort descending by risk score
        store_alerts.sort(key=lambda x: x['risk_score'], reverse=True)
        ranked_alerts_per_store[s['id']] = store_alerts

    return ranked_alerts_per_store


def evaluate_results(ranked_alerts_per_store, ground_truth_labels):
    """
    Calculates Precision@K, Recall, and Ranking metrics against ground-truth labels.
    """
    total_true_positives_at_10 = 0
    total_true_positives_at_20 = 0
    total_predictions_at_10 = 0
    total_predictions_at_20 = 0
    
    total_phantoms_in_dataset = sum(1 for v in ground_truth_labels.values() if v)
    total_detected_phantoms = 0
    
    ranks_of_true_phantoms = []
    
    for store_id, alerts in ranked_alerts_per_store.items():
        # Precision@10
        top_10 = alerts[:10]
        total_predictions_at_10 += len(top_10)
        for a in top_10:
            if ground_truth_labels.get((store_id, a['sku']), False):
                total_true_positives_at_10 += 1
                
        # Precision@20
        top_20 = alerts[:20]
        total_predictions_at_20 += len(top_20)
        for rank_idx, a in enumerate(top_20):
            if ground_truth_labels.get((store_id, a['sku']), False):
                total_true_positives_at_20 += 1
                total_detected_phantoms += 1
                ranks_of_true_phantoms.append(rank_idx + 1)
                
    p_at_10 = (total_true_positives_at_10 / total_predictions_at_10 * 100) if total_predictions_at_10 else 0
    p_at_20 = (total_true_positives_at_20 / total_predictions_at_20 * 100) if total_predictions_at_20 else 0
    recall = (total_detected_phantoms / total_phantoms_in_dataset * 100) if total_phantoms_in_dataset else 0
    f1 = (2 * p_at_20 * recall / (p_at_20 + recall)) if (p_at_20 + recall) > 0 else 0
    avg_rank = (sum(ranks_of_true_phantoms) / len(ranks_of_true_phantoms)) if ranks_of_true_phantoms else 0
    
    return {
        'precision_at_10': round(p_at_10, 2),
        'precision_at_20': round(p_at_20, 2),
        'recall': round(recall, 2),
        'f1_score': round(f1, 2),
        'total_phantoms_in_dataset': total_phantoms_in_dataset,
        'detected_in_top_20': total_detected_phantoms,
        'avg_rank_in_top_20': round(avg_rank, 2),
    }


def main():
    print("=" * 65)
    print("  StockSentinel AI — Phantom Stock-Out Baseline Benchmark")
    print("  Evaluation Protocol: Top-20 Daily Investigation List")
    print("=" * 65)
    print("Generating benchmark dataset (5 stores, 100 SKUs, 60 days)...")
    stores, products, sales_history, inventory_snapshots, promotions, ground_truth = \
        generate_evaluation_benchmark_data(num_stores=5, num_skus=100, days=60, phantom_rate=0.035)
        
    print(f"Total SKU-Store pairs evaluated: {len(stores) * len(products)}")
    total_phantoms = sum(1 for v in ground_truth.values() if v)
    print(f"Total Ground-Truth Hidden Phantoms: {total_phantoms} (~{round(total_phantoms / (len(stores)*len(products))*100, 1)}%)")
    print("\nRunning inference detection (without ground-truth labels)...")
    
    ranked_alerts = run_inference_detection(stores, products, sales_history, inventory_snapshots, promotions)
    
    print("Evaluating Top-K precision and recall...")
    metrics = evaluate_results(ranked_alerts, ground_truth)
    
    print("-" * 65)
    print(f"  Precision@10:             {metrics['precision_at_10']}%")
    print(f"  Precision@20:             {metrics['precision_at_20']}%  (Competition Standard)")
    print(f"  Recall (Top 20):          {metrics['recall']}%")
    print(f"  F1-Score:                 {metrics['f1_score']}")
    print(f"  Average Rank of Phantoms: #{metrics['avg_rank_in_top_20']}")
    print(f"  Detected True Phantoms:   {metrics['detected_in_top_20']} / {metrics['total_phantoms_in_dataset']}")
    print("-" * 65)
    print("Evaluation successfully completed.")

if __name__ == '__main__':
    main()
