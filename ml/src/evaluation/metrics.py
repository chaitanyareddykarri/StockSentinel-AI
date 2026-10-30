"""
Evaluation metrics calculation: Precision@K, Recall, F1-Score, and Average Rank.
"""

from typing import List, Dict, Any, Tuple


def calculate_precision_at_k(ranked_alerts: List[Dict[str, Any]], ground_truth: Dict[Tuple[str, str], bool], k: int = 20) -> float:
    """
    Computes Precision@K on top K items.
    """
    top_k = ranked_alerts[:k]
    if not top_k:
        return 0.0

    true_positives = sum(
        1 for alert in top_k
        if ground_truth.get((alert["store_id"], alert["sku"]), False)
    )
    return (true_positives / len(top_k)) * 100.0


def calculate_recall(ranked_alerts: List[Dict[str, Any]], ground_truth: Dict[Tuple[str, str], bool], k: int = 20) -> float:
    """
    Computes Recall against total ground truth phantoms within top K alerts.
    """
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
    """
    Computes harmonic mean F1-Score from precision and recall percentages.
    """
    if precision + recall == 0.0:
        return 0.0
    return (2.0 * precision * recall) / (precision + recall)


def evaluate_benchmark(
    ranked_alerts_by_store: Dict[str, List[Dict[str, Any]]],
    ground_truth: Dict[Tuple[str, str], bool],
) -> Dict[str, Any]:
    """
    Evaluates store alert queues against ground truth labels.
    """
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
) -> Dict[str, Any]:
    """
    Transparent annual rupees recovered calculation adhering to Talentap R1 requirements.
    
    Formula:
    Annual Recovery (INR) = num_stores * daily_walks_per_store * (precision_at_20 / 100) * resolution_rate * avg_lost_per_phantom_rupees * operational_days_per_year
    """
    precision_factor = precision_at_20 / 100.0
    daily_true_phantoms_found = num_stores * daily_walks_per_store * precision_factor
    daily_phantoms_restocked = daily_true_phantoms_found * resolution_rate
    daily_rupees_recovered = daily_phantoms_restocked * avg_lost_per_phantom_rupees
    annual_rupees_recovered = daily_rupees_recovered * operational_days_per_year
    
    in_lakhs = round(annual_rupees_recovered / 100_000, 2)
    in_crores = round(annual_rupees_recovered / 10_000_000, 2)
    
    return {
        "num_stores": num_stores,
        "daily_walks_per_store": daily_walks_per_store,
        "precision_at_20_percent": precision_at_20,
        "resolution_rate_percent": round(resolution_rate * 100, 1),
        "avg_lost_per_phantom_rupees": avg_lost_per_phantom_rupees,
        "operational_days_per_year": operational_days_per_year,
        "daily_rupees_recovered": round(daily_rupees_recovered, 2),
        "annual_rupees_recovered": round(annual_rupees_recovered, 2),
        "formatted_lakhs": f"INR {in_lakhs:,.2f} Lakhs",
        "formatted_crores": f"INR {in_crores:,.2f} Crores",
        "calculation_steps": [
            f"1. Store network audits: {num_stores} stores * {daily_walks_per_store} walks = {num_stores * daily_walks_per_store} total investigations/day",
            f"2. Model Precision@20 ({precision_at_20}%): {daily_true_phantoms_found:.2f} true phantom stock-outs identified/day",
            f"3. Associate resolution rate ({round(resolution_rate * 100)}%): {daily_phantoms_restocked:.2f} phantoms physically restocked/day",
            f"4. Daily revenue saved: {daily_phantoms_restocked:.2f} * INR {avg_lost_per_phantom_rupees:,.2f} = INR {daily_rupees_recovered:,.2f}/day",
            f"5. Annual Rupees Recovered: INR {daily_rupees_recovered:,.2f}/day * {operational_days_per_year} days = INR {annual_rupees_recovered:,.2f} (INR {in_crores:.2f} Crores)",
        ],
    }


