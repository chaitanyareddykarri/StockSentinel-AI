"""
Phantom stock-out anomaly score computation and categorization.
"""

from typing import Dict, Any, List
from ..demand.baseline_poisson import (
    calculate_cumulative_lambda,
    compute_poisson_zero_probability,
    calculate_dow_multiplier,
)


def calculate_risk_score(
    poisson_p: float,
    consecutive_zero_days: int,
    base_demand: float,
    recorded_stock: int,
    is_promo: bool,
    slow_mover_threshold: float = 0.6,
    fast_mover_threshold: float = 2.5,
) -> int:
    """
    Computes bounded anomaly confidence score between 1 and 99.
    Combines:
    - Poisson Anomaly component (0-50 pts)
    - Consecutive streak length relative to cycle (0-25 pts)
    - Recorded stock confidence (0-15 pts)
    - Promotional boost (0 or 10 pts)
    With velocity dampening and fast-mover floors.
    """
    # 1. Poisson anomaly score (0 to 50 pts)
    p_score = max(0.0, min(50.0, (1.0 - min(poisson_p, 1.0)) * 50.0))

    # 2. Consecutive zero days vs demand (0 to 25 pts)
    expected_cycle = max(1.0, 1.0 / max(base_demand, 0.05))
    day_factor = min(25.0, (consecutive_zero_days / expected_cycle) * 12.0)

    # 3. Stock confidence (0 to 15 pts)
    stock_health = min(15.0, min(float(recorded_stock), 20.0) * 0.75)

    # 4. Promo lift (0 or 10 pts)
    promo_boost = 10.0 if is_promo else 0.0

    raw_score = p_score + day_factor + stock_health + promo_boost

    # Velocity adjustments
    is_slow_mover = base_demand < slow_mover_threshold
    is_fast_mover = base_demand >= fast_mover_threshold

    if is_slow_mover:
        raw_score = raw_score * 0.65

    if is_fast_mover and consecutive_zero_days >= 3 and recorded_stock >= 5:
        raw_score = max(raw_score, 78.0)

    return max(1, min(99, int(round(raw_score))))


def detect_streak_anomaly(
    sales_history: List[Dict[str, Any]],
    on_hand_stock: int,
    base_demand: float,
    unit_price: float,
    is_promo: bool = False,
    min_consecutive_zero_days: int = 2,
    slow_mover_threshold: float = 0.6,
    fast_mover_threshold: float = 2.5,
) -> Dict[str, Any]:
    """
    Evaluates a sales history sequence for a phantom stock-out anomaly.
    Returns anomaly metrics dictionary or empty dict if non-qualifying.
    """
    if on_hand_stock <= 0 or not sales_history:
        return {}

    # Sort sales history by date ascending
    sorted_sales = sorted(sales_history, key=lambda x: str(x.get("date", "")))

    # Inspect the most recent 14 days
    recent = sorted_sales[-14:]
    consecutive_zeros = 0
    zero_dates: List[str] = []

    for row in reversed(recent):
        if int(row.get("units_sold", 0)) == 0:
            consecutive_zeros += 1
            zero_dates.insert(0, str(row.get("date", "")))
        else:
            break

    if consecutive_zeros < min_consecutive_zero_days:
        return {}

    # Calculate cumulative expected demand
    cum_lambda = calculate_cumulative_lambda(base_demand, zero_dates, is_promo)
    poisson_p = compute_poisson_zero_probability(cum_lambda)

    # Slow mover filtering
    is_slow_mover = base_demand < slow_mover_threshold
    if is_slow_mover and poisson_p > 0.15:
        return {}

    risk_score = calculate_risk_score(
        poisson_p=poisson_p,
        consecutive_zero_days=consecutive_zeros,
        base_demand=base_demand,
        recorded_stock=on_hand_stock,
        is_promo=is_promo,
        slow_mover_threshold=slow_mover_threshold,
        fast_mover_threshold=fast_mover_threshold,
    )

    category = "LOW"
    if risk_score >= 75:
        category = "CRITICAL"
    elif risk_score >= 55:
        category = "HIGH"
    elif risk_score >= 35:
        category = "MEDIUM"

    # Average DoW multiplier
    avg_dow = 1.0
    if zero_dates:
        dow_sum = sum(calculate_dow_multiplier(d) for d in zero_dates)
        avg_dow = round(dow_sum / len(zero_dates), 2)

    promo_mult = 1.6 if is_promo else 1.0
    expected_daily_units = round(base_demand * avg_dow * promo_mult, 1)
    est_lost_revenue_daily = round(expected_daily_units * unit_price, 2)

    return {
        "is_anomaly": True,
        "risk_score": risk_score,
        "risk_category": category,
        "consecutive_zero_days": consecutive_zeros,
        "recorded_stock": on_hand_stock,
        "expected_daily_units": expected_daily_units,
        "est_lost_revenue_daily": est_lost_revenue_daily,
        "poisson_anomaly_p": round(poisson_p, 5),
        "is_on_promotion": is_promo,
        "zero_dates": zero_dates,
    }

