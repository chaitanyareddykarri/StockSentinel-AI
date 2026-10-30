# API Reference: StockSentinel AI

This document specifies the REST API endpoints provided by the Next.js serverless layer and the Python FastAPI microservice.

---

## 1. Authentication & Session Endpoints

### `POST /api/auth/login`
Authenticates a user via email and password or demo credentials.
- **Request Body**: `{ "email": string, "password": string }`
- **Response**: `{ "success": boolean, "user": User, "token": string }`
- **Status Codes**: `200 OK`, `401 Unauthorized`.

### `POST /api/auth/google`
Exchanges a Google OAuth ID token for an authenticated application session.
- **Request Body**: `{ "credential": string }`
- **Response**: `{ "success": boolean, "user": User, "token": string }`

### `POST /api/auth/logout`
Terminates the current session and clears authorization cookies.

---

## 2. Detection & Analytics Endpoints

### `POST /api/detect`
Triggers an anomaly detection run across specified or authorized stores.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**: `{ "storeId"?: string, "config"?: Partial<DetectionConfig> }`
- **Response**:
  ```json
  {
    "success": true,
    "run": {
      "id": "uuid",
      "run_date": "ISO-8601",
      "total_skus_analyzed": 90,
      "flagged_count": 18,
      "critical_count": 6,
      "engine_type": "BASELINE_POISSON"
    },
    "alerts": [ ... ]
  }
  ```

### `GET /api/metrics`
Returns real-time dashboard KPIs and 14-day aggregated sales vs on-hand inventory time-series.
- **Query Params**: `?storeId=<store-uuid-or-ALL>`
- **Response**:
  ```json
  {
    "success": true,
    "metrics": {
      "totalMonitoredSkus": 90,
      "activeStores": 3,
      "flaggedPhantomStockouts": 14,
      "criticalAlerts": 4,
      "estRevenueAtRiskDaily": 412.50,
      "verificationRate": 78,
      "precisionAt20": 40.3,
      "timeSeries": [ ... ]
    }
  }
  ```

---

## 3. Alerts & Shelf Walk Verification Endpoints

### `GET /api/alerts`
Returns prioritized alerts filtered by store, risk category, and status.
- **Query Params**: `?storeId=...&risk=CRITICAL&status=OPEN&search=milk`
- **Response**: `{ "success": true, "alerts": Alert[] }`

### `PATCH /api/alerts`
Updates an alert's status following an in-store physical shelf walk.
- **Request Body**:
  ```json
  {
    "alertId": "uuid",
    "status": "VERIFIED",
    "outcome": "PHANTOM_CONFIRMED",
    "notes": "Tag found, shelf empty.",
    "shelfCount": 0,
    "auditor": "Marcus Chen"
  }
  ```
- **Response**: `{ "success": true, "alert": Alert }`

---

## 4. Retail Data Ingestion Endpoints

### `POST /api/import`
Ingests batches of retail records (Stores, Products, Daily Sales, Inventory Snapshots, Promotions).
- **Request Body**:
  ```json
  {
    "entityType": "daily_sales",
    "records": [
      {
        "store_id": "STORE-101",
        "sku": "SKU-00101",
        "date": "2026-10-29",
        "units_sold": 0,
        "revenue": 0.00
      }
    ]
  }
  ```
- **Response**: `{ "success": true, "inserted": 1, "errors": [] }`

---

## 5. Python FastAPI Microservice (`apps/api/main.py`)

### `GET /health`
Returns microservice health status.

### `POST /detect`
Accepts store master, product catalog, sales telemetry, inventory snapshots, and promotion calendars, returning scored and ranked alerts.

