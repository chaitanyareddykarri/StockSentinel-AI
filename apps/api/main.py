"""
StockSentinel AI — Python ML / Statistical Microservice (FastAPI)
Deployable to Modal, Render, Railway, Fly.io, or AWS Lambda.
Can be hooked into the Next.js frontend via DETECTION_SERVICE_URL.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import math
from datetime import datetime

app = FastAPI(
    title="StockSentinel AI Detection Service",
    description="Statistical & Machine Learning Engine for Phantom Stock-Out Detection in Retail",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StoreModel(BaseModel):
    id: str
    code: str
    name: str
    location: Optional[str] = ""
    store_type: Optional[str] = "Supercenter"

class ProductModel(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    unit_price: float
    avg_daily_demand: float
    min_stock_threshold: Optional[int] = 5

class DailySaleModel(BaseModel):
    store_id: str
    sku: str
    date: str
    units_sold: int
    revenue: Optional[float] = 0.0

class InventoryModel(BaseModel):
    store_id: str
    sku: str
    date: str
    on_hand_stock: int

class PromotionModel(BaseModel):
    store_id: str
    sku: str
    start_date: str
    end_date: str
    discount_pct: Optional[float] = 0.0

class DetectionConfigRequest(BaseModel):
    minConsecutiveZeroDays: Optional[int] = 2
    fastMoverThreshold: Optional[float] = 2.5
    slowMoverThreshold: Optional[float] = 0.6
    significanceThreshold: Optional[float] = 0.05
    maxRankPerStore: Optional[int] = 20

class DetectRequest(BaseModel):
    stores: List[StoreModel]
    products: List[ProductModel]
    sales: List[DailySaleModel]
    inventory: List[InventoryModel]
    promotions: Optional[List[PromotionModel]] = []
    config: Optional[DetectionConfigRequest] = Field(default_factory=DetectionConfigRequest)

DOW_WEIGHTS = {0: 1.35, 1: 0.85, 2: 0.90, 3: 0.95, 4: 1.05, 5: 1.30, 6: 1.45}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "StockSentinel AI Python Detection Engine",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@app.post("/detect")
def detect_phantom_stockouts(payload: DetectRequest):
    try:
        config = payload.config or DetectionConfigRequest()
        min_zeros = config.minConsecutiveZeroDays or 2
        max_rank = config.maxRankPerStore or 20
        fast_mover = config.fastMoverThreshold or 2.5
        slow_mover = config.slowMoverThreshold or 0.6

        # Index latest inventory by (store_id, sku)
        latest_inv = {}
        for inv in payload.inventory:
            k = (inv.store_id, inv.sku)
            if k not in latest_inv or inv.date > latest_inv[k].date:
                latest_inv[k] = inv

        # Group sales by (store_id, sku) sorted by date
        sales_by_pair = {}
        for sale in payload.sales:
            k = (sale.store_id, sale.sku)
            if k not in sales_by_pair:
                sales_by_pair[k] = []
            sales_by_pair[k].append(sale)
        
        for k in sales_by_pair:
            sales_by_pair[k].sort(key=lambda x: x.date)

        all_alerts = []

        for store in payload.stores:
            store_alerts = []
            for prod in payload.products:
                k = (store.id, prod.sku)
                inv_snapshot = latest_inv.get(k)
                if not inv_snapshot or inv_snapshot.on_hand_stock <= 0:
                    continue

                stock = inv_snapshot.on_hand_stock
                history = sales_by_pair.get(k, [])
                if not history:
                    continue

                # Count consecutive zero days
                consecutive_zeros = 0
                zero_dates = []
                for s in reversed(history[-14:]):
                    if s.units_sold == 0:
                        consecutive_zeros += 1
                        zero_dates.append(s.date)
                    else:
                        break

                if consecutive_zeros < min_zeros:
                    continue

                # Check promo
                is_promo = any(
                    (p.store_id == store.id or p.store_id == "ALL") and p.sku == prod.sku
                    for p in (payload.promotions or [])
                )
                promo_mult = 1.6 if is_promo else 1.0

                base_demand = prod.avg_daily_demand
                streak_expected = base_demand * consecutive_zeros * promo_mult
                clamped_lambda = min(streak_expected, 40)
                poisson_p = math.exp(-clamped_lambda)

                is_slow = base_demand < slow_mover
                is_fast = base_demand >= fast_mover

                if is_slow and poisson_p > 0.15:
                    continue

                # Scoring
                p_score = max(0, min(50, round((1.0 - min(poisson_p, 1.0)) * 50)))
                day_score = min(25, round((consecutive_zeros / max(1.0, 1.0 / base_demand)) * 12))
                stock_score = min(15, round(min(stock, 20) * 0.75))
                promo_score = 10 if is_promo else 0

                raw_score = p_score + day_score + stock_score + promo_score
                if is_slow:
                    raw_score = round(raw_score * 0.65)
                if is_fast and consecutive_zeros >= 3 and stock >= 5:
                    raw_score = max(raw_score, 78)

                risk_score = max(1, min(99, raw_score))

                if risk_score >= 75:
                    cat = "CRITICAL"
                elif risk_score >= 55:
                    cat = "HIGH"
                elif risk_score >= 35:
                    cat = "MEDIUM"
                else:
                    cat = "LOW"

                daily_lost_rev = round(base_demand * promo_mult * prod.unit_price, 2)
                p_str = "<0.01%" if poisson_p < 0.0001 else f"{round(poisson_p * 100, 1)}%"

                reason = (
                    f"Python ML: Positive inventory of {stock} units with {consecutive_zeros} zero-sales days "
                    f"(expected {round(base_demand, 1)} units/day, Poisson p={p_str})."
                )

                now_str = datetime.utcnow().isoformat()
                alert_obj = {
                    "id": f"ALT-PY-{store.code}-{prod.sku}-{int(datetime.utcnow().timestamp())}",
                    "run_id": "",
                    "store_id": store.id,
                    "store_name": store.name,
                    "product_id": prod.id,
                    "sku": prod.sku,
                    "product_name": prod.name,
                    "category": prod.category,
                    "unit_price": prod.unit_price,
                    "risk_score": risk_score,
                    "risk_category": cat,
                    "consecutive_zero_days": consecutive_zeros,
                    "recorded_stock": stock,
                    "expected_daily_sales": round(base_demand * promo_mult, 1),
                    "est_lost_revenue_daily": daily_lost_rev,
                    "poisson_anomaly_p": round(poisson_p, 5),
                    "is_on_promotion": is_promo,
                    "primary_reason": reason,
                    "signals": {
                        "consecutiveZeroDays": consecutive_zeros,
                        "recordedStock": stock,
                        "expectedDailyDemand": prod.avg_daily_demand,
                        "poissonPValue": round(poisson_p, 5),
                        "isPromotionActive": is_promo,
                        "stockToDemandRatio": round(stock / max(0.1, base_demand), 1),
                        "estimatedLostSalesDaily": round(base_demand * promo_mult, 1),
                    },
                    "status": "OPEN",
                    "created_at": now_str,
                    "updated_at": now_str,
                }
                store_alerts.append(alert_obj)

            store_alerts.sort(key=lambda x: x["risk_score"], reverse=True)
            all_alerts.extend(store_alerts[:max_rank])

        all_alerts.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "success": True,
            "engine": "PYTHON_FASTAPI",
            "alerts": all_alerts,
            "count": len(all_alerts),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
