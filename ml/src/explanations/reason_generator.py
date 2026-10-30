"""
Human-readable rationale generation for flagged phantom stock-outs.
"""


def generate_alert_explanation(
    recorded_stock: int,
    consecutive_zero_days: int,
    expected_daily_sales: float,
    poisson_p: float,
    is_promo: bool,
    base_demand: float,
    fast_mover_threshold: float = 2.5,
    slow_mover_threshold: float = 0.6,
) -> str:
    """
    Generates a concise, transparent explanation for why an item was flagged.
    """
    p_percent_str = (
        "<0.01%" if poisson_p < 0.0001 else f"{(poisson_p * 100.0):.1f}%"
    )
    is_fast_mover = base_demand >= fast_mover_threshold
    is_slow_mover = base_demand < slow_mover_threshold

    if is_promo and is_fast_mover:
        return (
            f"System records {recorded_stock} units in inventory, but 0 sales occurred "
            f"over {consecutive_zero_days} days during an active promotion "
            f"(expected {expected_daily_sales:.1f} units/day, anomaly chance {p_percent_str})."
        )
    elif is_fast_mover:
        return (
            f"High-velocity product (avg {base_demand:.1f} units/day) with {recorded_stock} "
            f"recorded on-hand units has had {consecutive_zero_days} consecutive days with zero sales."
        )
    elif is_slow_mover:
        return (
            f"Slow-moving SKU with {recorded_stock} recorded units has shown an extended "
            f"zero-sales run of {consecutive_zero_days} days beyond its typical cycle."
        )
    else:
        return (
            f"Positive inventory of {recorded_stock} units with {consecutive_zero_days} "
            f"days of 0 sales despite expected demand of {expected_daily_sales:.1f} units/day "
            f"(Poisson anomaly p={p_percent_str})."
        )

