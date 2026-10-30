"""
Evaluation metrics calculation: Precision@K, Recall, F1-Score, and Financial Impact Modeling.
Conforms to TalentAP Mega Hackathon 2026 (Saffron Retail Group) evaluation standards.
"""
from __future__ import annotations

from typing import List, Dict, Any, Tuple


def calculate_precision_at_k(ranked_alerts: List[Dict[str, Any]], ground_truth: Dict[Tuple[str, str], bool], k: int = 20) -> float:
    """Computes Precision@K on top K items."""
    top_k = ranked_alerts[:k]
    if not top_k:
        return 0.0

    true_positives = sum(
        1 for alert in top_k
        if ground_truth.get((alert["store_id"], alert["sku"]), False)
    )
    return (true_positives / len(top_k)) * 100.0


def calculate_recall(ranked_alerts: List[Dict[str, Any]], ground_truth: Dict[Tuple[str, str], bool], k: int = 20) -> float:
    """Computes Recall against total ground truth phantoms within top K alerts."""
    total_true_phantoms = sum(1 for is_true in ground_truth.values() if is_true)
    if total_true_phantoms == 0:
        return 100.0

    top_k = ranked_alerts[:k]
    true_positives = sum(
        1 for alert in top_k
        if ground_truth.get((alert["store_id"], alert["sku"]), False)
    )
    return (true_positives / total_true_phantoms) * 100.0


def calculate_f1_score(precision: float, recall: float) -> float:
    """Computes harmonic mean F1-Score from precision and recall percentages."""
    if precision + recall == 0.0:
        return 0.0
    return (2.0 * precision * recall) / (precision + recall)


def evaluate_benchmark(
    ranked_alerts_by_store: Dict[str, List[Dict[str, Any]]],
    ground_truth: Dict[Tuple[str, str], bool],
) -> Dict[str, Any]:
    """Evaluates store alert queues against ground truth labels."""
    total_p10 = 0.0
    total_p20 = 0.0
    total_detected = 0
    ranks: List[int] = []

    store_count = len(ranked_alerts_by_store)
    if store_count == 0:
        return {
            "precision_at_10": 0.0,
            "precision_at_20": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "avg_rank": 0.0,
        }

    for store_id, alerts in ranked_alerts_by_store.items():
        p10 = calculate_precision_at_k(alerts, ground_truth, k=10)
        p20 = calculate_precision_at_k(alerts, ground_truth, k=20)
        total_p10 += p10
        total_p20 += p20

        for idx, alert in enumerate(alerts[:20], start=1):
            if ground_truth.get((store_id, alert["sku"]), False):
                total_detected += 1
                ranks.append(idx)

    total_phantoms = sum(1 for is_true in ground_truth.values() if is_true)
    mean_p10 = round(total_p10 / store_count, 2)
    mean_p20 = round(total_p20 / store_count, 2)
    recall = round((total_detected / total_phantoms * 100.0), 2) if total_phantoms > 0 else 0.0
    f1 = round(calculate_f1_score(mean_p20, recall), 2)
    avg_rank = round(sum(ranks) / len(ranks), 2) if ranks else 0.0

    return {
        "precision_at_10": mean_p10,
        "precision_at_20": mean_p20,
        "recall": recall,
        "f1_score": f1,
        "avg_rank": avg_rank,
        "detected_true_phantoms": total_detected,
        "total_phantoms": total_phantoms,
    }


def estimate_annual_recovery_rupees(
    precision_at_20: float,
    num_stores: int = 25,
    daily_walks_per_store: int = 20,
    avg_lost_per_phantom_rupees: float = 3850.0,
    resolution_rate: float = 0.85,
    operational_days_per_year: int = 365,
    avg_unit_price_inr: float = 179.64,
    avg_unit_margin_inr: float = 32.16,
    avg_daily_velocity: float = 2.8,
    days_saved_per_detection: float = 7.0,
) -> Dict[str, Any]:
    """
    Transparent Annual Financial Opportunity Model.
    Supports both legacy aggregate formula and granular official SKU-margin breakdown.
    Clearly separates measured empirical data from operational assumptions.
    """
    precision_factor = precision_at_20 / 100.0 if precision_at_20 > 1.0 else precision_at_20
    
    # 1. Daily Store Audits
    daily_investigations = num_stores * daily_walks_per_store
    
    # 2. Daily True Phantoms Found
    daily_true_phantoms = daily_investigations * precision_factor
    
    # 3. Daily Phantoms Restocked
    daily_phantoms_restocked = daily_true_phantoms * resolution_rate
    
    # 4. Daily and Annual Revenue Recovered (Aggregate)
    daily_rupees_recovered = daily_phantoms_restocked * avg_lost_per_phantom_rupees
    annual_rupees_recovered = daily_rupees_recovered * operational_days_per_year
    
    in_lakhs = round(annual_rupees_recovered / 100_000, 2)
    in_crores = round(annual_rupees_recovered / 10_000_000, 2)
    
    # Granular SKU-margin opportunity
    lost_revenue_per_episode = avg_daily_velocity * avg_unit_price_inr * days_saved_per_detection
    lost_margin_per_episode = avg_daily_velocity * avg_unit_margin_inr * days_saved_per_detection
    annual_gross_margin_opportunity = daily_phantoms_restocked * lost_margin_per_episode * (operational_days_per_year / days_saved_per_detection)
    
    return {
        "model_type": "Potential Gross Recovery & Margin Opportunity Model (Not Realized Cash)",
        "num_stores": num_stores,
        "daily_walks_per_store": daily_walks_per_store,
        "precision_at_20_percent": round(precision_factor * 100, 2),
        "resolution_rate_percent": round(resolution_rate * 100, 1),
        "avg_lost_per_phantom_rupees": avg_lost_per_phantom_rupees,
        "operational_days_per_year": operational_days_per_year,
        "daily_rupees_recovered": round(daily_rupees_recovered, 2),
        "annual_rupees_recovered": round(annual_rupees_recovered, 2),
        "annual_gross_margin_opportunity_inr": round(annual_gross_margin_opportunity, 2),
        "formatted_lakhs": f"INR {in_lakhs:,.2f} Lakhs",
        "formatted_crores": f"INR {in_crores:,.2f} Crores",
        "formatted_margin_crores": f"₹{annual_gross_margin_opportunity / 10_000_000:.2f} Cr",
        "measured_metrics": {
            "avg_unit_price_inr": avg_unit_price_inr,
            "avg_unit_margin_inr": avg_unit_margin_inr,
            "avg_daily_velocity_units": avg_daily_velocity,
        },
        "calculation_steps": [
            f"1. Store network audits: {num_stores} stores * {daily_walks_per_store} walks = {daily_investigations} total investigations/day",
            f"2. Model Precision@20 ({precision_factor * 100:.1f}%): {daily_true_phantoms:.2f} true phantom stock-outs identified/day",
            f"3. Associate resolution rate ({round(resolution_rate * 100)}%): {daily_phantoms_restocked:.2f} phantoms physically restocked/day",
            f"4. Daily revenue saved: {daily_phantoms_restocked:.2f} * INR {avg_lost_per_phantom_rupees:,.2f} = INR {daily_rupees_recovered:,.2f}/day",
            f"5. Annual Rupees Recovered: INR {daily_rupees_recovered:,.2f}/day * {operational_days_per_year} days = INR {annual_rupees_recovered:,.2f} (INR {in_crores:.2f} Crores)",
        ],
    }
