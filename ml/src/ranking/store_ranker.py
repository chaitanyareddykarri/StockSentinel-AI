"""
Top-K ranking and truncation per store-day.
"""

from typing import List, Dict, Any


def rank_store_alerts(
    alerts: List[Dict[str, Any]],
    max_rank: int = 20,
) -> List[Dict[str, Any]]:
    """
    Ranks candidate alerts descending by anomaly risk score, resolving ties by estimated lost revenue,
    and returns at most max_rank (default 20) items per store.
    """
    if not alerts:
        return []

    # Sort descending by risk_score, then est_lost_revenue_daily
    sorted_alerts = sorted(
        alerts,
        key=lambda x: (
            int(x.get("risk_score", 0)),
            float(x.get("est_lost_revenue_daily", 0.0)),
        ),
        reverse=True,
    )

    ranked: List[Dict[str, Any]] = []
    for rank_idx, alert in enumerate(sorted_alerts[:max_rank], start=1):
        alert_copy = dict(alert)
        alert_copy["rank"] = rank_idx
        ranked.append(alert_copy)

    return ranked

