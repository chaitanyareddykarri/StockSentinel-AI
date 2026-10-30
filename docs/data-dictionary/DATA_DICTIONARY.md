# Data Dictionary: StockSentinel AI

This document defines the schema, types, constraints, and descriptions for all retail entities in StockSentinel AI.

---

## 1. Core Retail Master Data

### 1.1 `stores`
Represents physical retail locations.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique store identifier. |
| `company_id` | UUID | Foreign Key $\rightarrow$ `companies.id` | Multi-tenant company ownership. |
| `code` | TEXT | Unique per company | Human-readable store identifier (e.g. `STORE-101`). |
| `name` | TEXT | Not Null | Store name (e.g. `Walmart Supercenter #101`). |
| `location` | TEXT | Not Null | City, State or physical address. |
| `store_type` | TEXT | Not Null | Store format: `Supercenter`, `Metro Market`, `Express`. |
| `total_skus` | INTEGER | $\ge 0$ | Total number of monitored SKUs. |
| `created_at` | TIMESTAMPTZ | Default `NOW()` | Record creation timestamp. |

### 1.2 `products`
Represents retail SKUs monitored for phantom stock-outs.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Unique product identifier. |
| `company_id` | UUID | Foreign Key $\rightarrow$ `companies.id` | Multi-tenant company ownership. |
| `sku` | TEXT | Unique per company | Stock Keeping Unit code (e.g. `SKU-00101`). |
| `name` | TEXT | Not Null | Brand and item name (e.g. `Horizon Organic Whole Milk`). |
| `category` | TEXT | Not Null | Department: `Dairy`, `Beverages`, `Bakery`, `Snacks`, `Household`. |
| `unit_price` | NUMERIC(10,2) | $\ge 0.00$ | Retail selling price per unit ($). |
| `avg_daily_demand` | NUMERIC(8,2) | $> 0.00$ | Baseline average daily sales velocity ($\lambda$). |
| `min_stock_threshold` | INTEGER | $\ge 0$ | Safety stock target. |
| `created_at` | TIMESTAMPTZ | Default `NOW()` | Record creation timestamp. |

---

## 2. Retail Telemetry & Operations Data

### 2.1 `daily_sales`
Daily sales transaction summaries.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Transaction summary ID. |
| `store_id` | UUID | Foreign Key $\rightarrow$ `stores.id` | Store location. |
| `product_id` | UUID | Foreign Key $\rightarrow$ `products.id` | Product SKU. |
| `sku` | TEXT | Not Null | Denormalized SKU code. |
| `date` | DATE | Format `YYYY-MM-DD` | Date of sales activity. |
| `units_sold` | INTEGER | $\ge 0$ | Actual recorded units sold at register. |
| `revenue` | NUMERIC(12,2) | $\ge 0.00$ | Total gross revenue generated. |
| `day_of_week` | SMALLINT | 0 (Sun) to 6 (Sat) | Day of week index. |

### 2.2 `inventory_snapshots`
Daily recorded on-hand stock snapshots from ERP/POS.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Snapshot ID. |
| `store_id` | UUID | Foreign Key $\rightarrow$ `stores.id` | Store location. |
| `product_id` | UUID | Foreign Key $\rightarrow$ `products.id` | Product SKU. |
| `sku` | TEXT | Not Null | Denormalized SKU code. |
| `date` | DATE | Format `YYYY-MM-DD` | Snapshot date. |
| `on_hand_stock` | INTEGER | No negative values | Recorded on-hand inventory in system balance. |

### 2.3 `promotions`
Promotional calendar and feature discounts.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Promotion ID. |
| `store_id` | UUID | Foreign Key or `'ALL'` | Target store or network-wide. |
| `product_id` | UUID | Foreign Key $\rightarrow$ `products.id` | Target product. |
| `sku` | TEXT | Not Null | Product SKU. |
| `start_date` | DATE | $\le$ `end_date` | Promotion active start date. |
| `end_date` | DATE | $\ge$ `start_date` | Promotion active end date. |
| `discount_pct` | NUMERIC(5,2) | $0.00$ to $100.00$ | Percentage discount off retail price. |
| `promo_type` | TEXT | Check enum | Promo format: `FEATURE`, `DISCOUNT`, `ENDCAP`. |

---

## 3. Alerts & Audit Trail

### 3.1 `alerts`
Ranked phantom stock-out alerts.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique alert ID. |
| `store_id` | UUID | Store location. |
| `product_id` | UUID | Product SKU. |
| `risk_score` | INTEGER (0–100) | Anomaly confidence score. |
| `risk_category` | TEXT | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. |
| `consecutive_zero_days` | INTEGER | Consecutive days with 0 sales and stock > 0. |
| `recorded_stock` | INTEGER | On-hand balance in database. |
| `expected_daily_sales` | NUMERIC | Expected demand adjusted for Day-of-Week and promo. |
| `est_lost_revenue_daily` | NUMERIC | Lost revenue impact ($/day). |
| `poisson_anomaly_p` | NUMERIC | Probability of zero sales under Poisson process. |
| `status` | TEXT | `OPEN`, `UNDER_REVIEW`, `VERIFIED`, `FALSE_POSITIVE`, `RESOLVED`. |
| `verification_outcome` | TEXT | Observed physical shelf-walk root cause. |
| `shelf_count` | INTEGER | Physically observed units on shelf. |
| `verified_by` | TEXT | Store associate identifier. |
| `verified_at` | TIMESTAMPTZ | Verification timestamp. |

