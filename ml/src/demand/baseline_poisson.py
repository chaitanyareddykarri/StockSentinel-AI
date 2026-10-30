"""
Demand estimation and Poisson probability modeling for retail sales series.
"""

import math
from datetime import datetime
from typing import List, Dict, Union

# Day of week demand multipliers (0 = Sun, 1 = Mon, ..., 6 = Sat)
DOW_MULTIPLIERS: Dict[int, float] = {
    0: 1.35,  # Sunday peak
    1: 0.85,  # Monday slump
    2: 0.90,  # Tuesday
    3: 0.95,  # Wednesday
    4: 1.05,  # Thursday
    5: 1.30,  # Friday peak
    6: 1.45,  # Saturday peak
}


def calculate_dow_multiplier(date_input: Union[str, int]) -> float:
    """
    Returns the demand multiplier for a given date or integer day-of-week index.
    """
    if isinstance(date_input, int):
        return DOW_MULTIPLIERS.get(date_input % 7, 1.0)
    
    try:
        # Handles YYYY-MM-DD
        dt = datetime.strptime(str(date_input)[:10], "%Y-%m-%d")
        # Python datetime.weekday(): Monday=0, Sunday=6
        # DOW_MULTIPLIERS: Sunday=0, Monday=1, ..., Saturday=6
        dow_idx = (dt.weekday() + 1) % 7
        return DOW_MULTIPLIERS.get(dow_idx, 1.0)
    except Exception:
        return 1.0


def calculate_cumulative_lambda(
    base_demand: float,
    zero_streak_dates: List[str],
    is_promo: bool = False,
    promo_multiplier: float = 1.6,
) -> float:
    """
    Computes cumulative expected demand (Lambda) across a sequence of zero-sales days,
    integrating day-of-week seasonality and active promotional lift.
    """
    if not zero_streak_dates:
        return 0.0

    p_mult = promo_multiplier if is_promo else 1.0
    cumulative_lambda = 0.0

    for d_str in zero_streak_dates:
        dow_mult = calculate_dow_multiplier(d_str)
        cumulative_lambda += base_demand * dow_mult * p_mult

    return max(0.0, cumulative_lambda)


def compute_poisson_zero_probability(cumulative_lambda: float) -> float:
    """
    Computes Poisson probability of observing zero sales given expected rate Lambda:
    P(X = 0) = exp(-Lambda)
    """
    # Clamp lambda to 50 to avoid math overflow underflow issues
    clamped_lambda = min(cumulative_lambda, 50.0)
    return math.exp(-clamped_lambda)

