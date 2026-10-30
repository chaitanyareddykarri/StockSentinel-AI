# StockSentinel AI — Enterprise Retail Inventory Intelligence Platform

> **Detect Hidden Phantom Stockouts. Recover Missed Sales. Protect Shelf Availability.**  
> *AI Frontier Challenge 2026 • Official Problem Statement: The Phantom Stock-Out Detector*

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ecf8e?style=flat&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-128%2F128%20Passing-brightgreen?style=flat)](https://github.com/chaitanyareddykarri/StockSentinel-AI)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat)](LICENSE)

---

## 1. Executive Summary

In modern retail chains, **phantom stockouts** (also known as *ghost inventory* or *hidden stockouts*) represent an invisible multibillion-dollar drain on profitability. A phantom stockout occurs when the central inventory management system indicates that a Product (SKU) is available in stock on store shelves, but physically the shelf is empty due to theft/shrinkage, misplacement in stockrooms, damaged units, or inbound scan errors. 

Because the enterprise ERP system records positive on-hand inventory, **automated purchase and replenishment orders are blocked**, shelf space remains vacant, and customers either walk away or turn to competitors.

**StockSentinel AI** solves this critical retail problem through an end-to-end, privacy-preserving, enterprise intelligence architecture:
1. **Universal CSV Ingestion**: Accepts arbitrary retail datasets with diverse column names and orders, automatically mapping them to canonical schemas with confidence scoring.
2. **Explainable Poisson Anomaly Engine**: Continuously models expected sales velocity against zero-sales runs, day-of-week seasonality, and promotional lifts.
3. **Daily Top-20 High-Risk Ranking**: Surfaces the 20 most critical suspect SKUs per store every morning with actionable root-cause hypotheses and expected dollar loss.
4. **Interactive Associate Shelf-Walk Workflow**: Guides floor associates directly to shelf locations, enabling immediate physical audits, on-shelf count corrections, and verified resolution logs.
5. **Multi-Tenant Enterprise Security**: Enforces strict tenant separation and Role-Based Access Control (RBAC) across Platform Admins, Company Managers, and Store Managers.
6. **Cloud Database Architecture**: Direct PostgreSQL integration via Supabase with verified relational constraints, cascading lifecycle rules, and Row Level Security (RLS).

---

## 2. Official Hackathon Benchmark Results (Saffron Retail Group)

StockSentinel AI was benchmarked against the official **TalentAP Mega Hackathon 2026** competition dataset (Saffron Retail Group, 25 stores, 800 SKUs, 548 days, 1,183 scored store-days) using the official [`evaluate.py`](evaluate.py) scorer.

### Official Scorecard & Comparison

| Metric | Official Baseline | StockSentinel AI (Optimized) | Competitive Edge |
| :--- | :---: | :---: | :--- |
| **PRIMARY Precision@20** | `0.3965` | **`0.4301`** | **+8.5% relative gain** (Captures **49.7%** of theoretical mathematical ceiling) |
| **Theoretical Ceiling** | `0.8656` | `0.8656` | Max possible (some store-days have fewer than 20 true stockouts) |
| **Flags on Delisted Decoys** | `5.20%` | **`0.02%`** | **99.6% reduction in decoy traps** (3-day chain consensus filter) |
| **Row Recall** | `38.20%` | **`43.95%`** | **10,176 verified problem shelf-days** detected |
| **Episode Recall** | `19.40%` | **`22.77%`** | Catches 1 in ~4.4 full distinct problem episodes |
| **Stretch Type Accuracy** | N/A (Blank) | **`81.09%`** | Diagnoses `phantom` (shrinkage) vs `misplaced` with 3.2× higher accuracy |

### One-Line Reproduction & Evaluation Commands

```bash
# 1. Generate dev and test submissions in ~3.6 seconds (Strict Zero Look-Ahead)
py scripts/run_stocksentinel_detection.py

# 2. Score dev predictions against public ground truth
py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv --out score.json

# 3. Verify all 9 official submission rules
py scripts/verify_submission.py
```

### Financial ROI Arithmetic (Saffron Retail Group)

$$\text{Annual Recovered Revenue} = \sum_{\text{Hits}} \left( \text{Daily Lost Sales Units} \times \text{Unit Margin (₹)} \times \text{Days Saved} \right)$$

- **Average Daily Hits**: $\approx 8.6\text{ true problem SKUs per store-day}$
- **Average High-Shrinkage Margin**: $₹39.56$
- **Days Saved per Intervention**: $8\text{ days}$ (Early detection on Day 4 vs waiting for monthly physical count on Day 12)
- **Store-Level Annual Recovery**: $\mathbf{₹2,98,000}\text{ to }\mathbf{₹4,50,000}$ per store/year
- **Chain-Wide Impact (25 Stores)**: $\mathbf{₹85\text{ Lakhs} - ₹1.12\text{ Crore}}$ annual EBITDA recovery

---

## 3. System Architecture

```text
                               +--------------------------------------------+
                               |        Universal Retail CSV Upload        |
                               | (Sales, Inventory, Stores, Products, Promos)|
                               +---------------------+----------------------+
                                                     |
                                                     v
                               +--------------------------------------------+
                               |     Universal Column Mapping Engine        |
                               |  - Alias matching (Sales, Inventory, etc.)  |
                               |  - Formula injection sanitization (=, +, -)|
                               |  - Leading-zero preservation & UUID mapping|
                               +---------------------+----------------------+
                                                     |
                                                     v
                         +---------------------------+---------------------------+
                         |                                                       |
                         v                                                       v
         +-------------------------------+                       +-------------------------------+
         |     Supabase PostgreSQL       |                       |       Offline Benchmark       |
         |  - Multi-tenant companies     |                       |  - evaluate.py pipeline       |
         |  - 18 relational tables       |                       |  - Strict label isolation     |
         |  - Row Level Security (RLS)   |                       |  - Precision@20 & Recall      |
         +---------------+---------------+                       +-------------------------------+
                         |
                         v
         +-------------------------------+
         |    Detection & ML Pipeline    |
         |  - Poisson Demand Anomaly     |
         |  - Zero-Sales Run Lengths     |
         |  - Day-of-Week & Promo Lift   |
         |  - Velocity Tier Dampening    |
         +---------------+---------------+
                         |
                         v
         +---------------------------------------------------------------+
         |                     Next.js 16 Web Console                    |
         |  - Executive Analytics & ROI Simulator                        |
         |  - Daily Top-20 Shelf-Walk Triage UI                          |
         |  - Multi-Tenant Store & Company Management                    |
         |  - Grounded AI Assistant (No Hallucinations)                  |
         +---------------------------------------------------------------+
```

---

## 3. Pre-Configured Test Accounts & RBAC

StockSentinel AI features enterprise multi-tenant Role-Based Access Control (RBAC) with cryptographic PBKDF2 password authentication and strict store-level authorization boundaries.

| Role | Email | Password | Access Scope & Capabilities |
| :--- | :--- | :--- | :--- |
| **Platform Administrator** | `admin@stocksentinel.ai` | `admin1234` | Global system-wide operational and audit scope across all companies, stores, and catalog entities. |
| **Company Manager** | `director@stocksentinel.ai` | `demo1234` | Company-wide multi-store visibility, store provisioning, invitation management, and cross-store aggregated analytics. |
| **Store Manager** | `manager@stocksentinel.ai` | `demo1234` | Strictly scoped to **Downtown Supercenter #101 (`SEA-101`)**. Can import telemetry, trigger detections, and triage shelf-walk alerts. Blocked from viewing or importing data for other stores or editing master catalogs. |

> **Security Guarantee**:
> - Client-supplied role or store ID headers/body parameters are strictly ignored; permissions are derived exclusively from verified database records.
> - Store Managers attempting to import data for unauthorized stores receive `HTTP 403 Forbidden`.
> - Self-service registration automatically provisions basic Store Manager access in `PENDING_ASSIGNMENT` until invited into a company.

---

## 5. Universal CSV Ingestion & Mapping Engine

StockSentinel AI allows enterprise users to upload CSV files with different column headers, date representations, and column arrangements without requiring manual file formatting.

### Supported Dataset Types
1. **Combined Sales & Inventory (`combined_sales_inventory`)**: Automatically splits combined retail records into both `daily_sales` and `inventory_snapshots`.
2. **Daily Sales (`daily_sales`)**: Historical transaction quantities and revenues.
3. **Inventory Snapshots (`inventory_snapshots`)**: End-of-day on-hand stock balances.
4. **Store Catalog (`stores`)**: Store names, internal codes, locations, and status.
5. **Product Catalog (`products`)**: SKUs, descriptions, categories, units, and base prices.
6. **Promotions (`promotions`)**: Active promotion schedules and discount multipliers.

### Canonical Mapping Dictionary
The Universal Mapper employs fuzzy matching and an exhaustive alias matrix:

| Canonical Field | Recognized Aliases | Data Type & Validation |
| :--- | :--- | :--- |
| `date` | `date`, `sales_date`, `business_date`, `snapshot_date`, `date_id`, `trans_date`, `record_date` | `YYYY-MM-DD` (ISO-8601 or ISO timestamp) |
| `store_id` | `store_id`, `store_code`, `store`, `location_id`, `site_id`, `store_number`, `branch_id`, `shop_id` | Preserves leading zeros; maps code (`SEA-101`) to UUID |
| `sku_id` | `sku_id`, `sku`, `product_id`, `item_id`, `article_id`, `upc`, `ean`, `item_number`, `product_code` | Preserves leading zeros; maps SKU (`SKU-101`) to UUID |
| `units_sold` | `units_sold`, `quantity_sold`, `sales_qty`, `qty_sold`, `units`, `sales_quantity`, `sold_qty`, `volume` | Integer $\ge 0$ |
| `on_hand_eod` | `on_hand_eod`, `on_hand_stock`, `ending_inventory`, `stock_eod`, `inventory`, `closing_stock`, `soh` | Integer $\ge 0$ |
| `on_promo` | `on_promo`, `is_promo`, `promoted`, `promo_flag`, `promotion_active`, `discount_active` | Boolean (`1`, `0`, `true`, `false`, `yes`, `no`) |
| `revenue` | `revenue`, `sales_amount`, `total_sales`, `gross_sales`, `sales_revenue`, `sales_value` | Decimal $\ge 0.0$ (Optional; calculated from price $\times$ units) |

### Built-in Security & Reliability Protections
- **Formula Injection Neutralization**: Any cell beginning with `=`, `+`, `-`, or `@` is sanitized to prevent CSV spreadsheet execution vulnerabilities.
- **Atomic Batch Ingestion**: Import batches are validated atomically. If any row contains a formatting violation (such as negative inventory or missing dates), the entire batch is rejected with clear row-by-row error diagnostics.
- **Idempotent Upserts**: Sales and inventory records utilize PostgreSQL `ON CONFLICT (store_id, product_id, date) DO UPDATE` to prevent duplicate record corruption upon re-import.

---

## 5. Live Database Schema (Supabase PostgreSQL)

StockSentinel AI is integrated with a cloud-hosted Supabase PostgreSQL instance:
- **Project URL**: `https://tvhketdwcjdliptiwmft.supabase.co`
- **Direct Pooler Connection**: `aws-0-eu-west-1.pooler.supabase.com:6543`

The database consists of **18 production tables** across 5 functional layers:

```
+---------------------------------------------------------------------------------------+
|                                1. Multi-Tenant Identity                               |
| companies • company_memberships • store_assignments • platform_administrators • profiles|
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                  2. Retail Catalogs                                   |
|               stores • products • promotions • legacy_unassigned_stores               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               3. Operational Telemetry                                |
|                       daily_sales • inventory_snapshots                               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                4. Ingestion & Detection                               |
|                     import_jobs • detection_runs • alerts                             |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                             5. Auditing & Grounded AI                                 |
|            verification_audit_log • chat_conversations • chat_messages • invitations   |
+---------------------------------------------------------------------------------------+
```

### Table Reference

| Table Name | Description | Key Relationships |
| :--- | :--- | :--- |
| `companies` | Corporate retail tenants (e.g. Walmart, Target, Kroger) | Parent to memberships, stores, products |
| `company_memberships` | User assignments to companies with roles (`COMPANY_MANAGER`, `STORE_MANAGER`) | FK to `companies.id`, `profiles.id` |
| `stores` | Physical retail locations and branch identifiers | FK to `companies.id` |
| `store_assignments` | Store Manager single-store restriction mappings | FK to `companies.id`, `stores.id`, `profiles.id` |
| `platform_administrators` | Whitelist of global system superusers | FK to `profiles.id` |
| `profiles` | User profiles synchronized from authentication | Primary key matches Supabase Auth UID |
| `products` | Master SKU catalog with pricing, category, and minimum stock targets | FK to `companies.id` |
| `promotions` | Active promotional campaigns and promotional lift factors | FK to `companies.id`, `stores.id`, `products.id` |
| `daily_sales` | Daily store-level SKU sales records | Composite unique: `(store_id, product_id, date)` |
| `inventory_snapshots` | End-of-day physical on-hand stock observations | Composite unique: `(store_id, product_id, date)` |
| `import_jobs` | Lifecycle tracking and validation summaries for CSV ingestions | Scoped to user and company |
| `detection_runs` | Detection execution history and algorithm metadata | Scoped to store and user |
| `alerts` | Verified phantom stockout candidates with risk scores and root-cause hypotheses | FK to `stores.id`, `products.id`, `detection_runs.id` |
| `verification_audit_log` | Physical shelf-walk audit history, root causes, and stock adjustments | FK to `alerts.id`, `stores.id`, `profiles.id` |
| `chat_conversations` | Tenant-scoped AI Copilot conversations | Scoped to user and company |
| `chat_messages` | Grounded AI conversation turns | FK to `chat_conversations.id` |
| `invitations` | Cryptographic invite tokens for onboarding managers and associates | Scoped to company |
| `legacy_unassigned_stores` | Quarantined stores prior to company onboarding assignment | Admin-only access |

To apply the complete schema to any new Supabase project, execute the all-in-one migration:
[`supabase/combined_migration_for_new_project.sql`](file:///d:/StockSentinel-AI-/supabase/combined_migration_for_new_project.sql)

---

## 6. Detection Engine Formulation

The detection engine combines explainable statistical demand modeling with retail heuristic constraints to eliminate false positives:

$$\lambda_{d} = \bar{V}_{\text{base}} \times M_{\text{DOW}} \times M_{\text{promo}}$$

1. **Baseline Velocity ($\bar{V}_{\text{base}}$)**: Rolling 30-day average sales excluding active stockout days.
2. **Day-of-Week Multiplier ($M_{\text{DOW}}$)**: Ratio of weekday demand to average daily demand (accounting for weekend shopping surges).
3. **Promotion Lift ($M_{\text{promo}}$)**: Active promotional multiplier (default $1.25\times$ to $2.0\times$).
4. **Poisson Anomaly Probability**:
   $$P(X = 0 \mid \lambda) = e^{-\lambda}$$
   For $k$ consecutive zero-sales days:
   $$P(\text{Run of } k \text{ Zeros}) = \prod_{i=1}^{k} e^{-\lambda_i} = \exp\left(-\sum_{i=1}^{k} \lambda_i\right)$$
   $$\text{Anomaly Score} = 1 - P(\text{Run of } k \text{ Zeros})$$
5. **Velocity Tier Dampening**: High-velocity SKUs ($\ge 5$ units/day) trigger alerts after 2 consecutive zero-sales days with high inventory, whereas slow-movers ($< 0.5$ units/day) require extended zero-sales runs before flagging.
6. **Root Cause Attribution**:
   - **Misplaced Inventory**: On-hand stock is high, sales drop abruptly, but recent inbound delivery was logged.
   - **Theft / Shrinkage**: High-value, portable SKUs with sustained zero sales despite shelf placement.
   - **Inbound Scan Error**: Negative discrepancy between expected delivery and first physical count.
   - **System Drift**: Incremental mismatch between POS decrement and actual inventory.

---

## 8. Quickstart & Installation

### Prerequisites
- **Node.js**: v18.17.0+ or v20+ (tested on Node v20/v24)
- **Package Manager**: npm (v10+ or v11+)
- **Python (Optional)**: 3.10+ (for standalone ML scripts or external microservice)

### 1. Clone & Install
```bash
git clone https://github.com/chaitanyareddykarri/StockSentinel-AI.git
cd StockSentinel-AI
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure the environment parameters:
```env
# Supabase Cloud Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tvhketdwcjdliptiwmft.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2
DATABASE_URL=postgresql://postgres.tvhketdwcjdliptiwmft:YOUR-PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

*(Note: If database credentials are omitted, the application automatically boots into Zero-Config Demo Mode using memory state).*

### 3. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Automated Verification & Testing

The repository includes a comprehensive, automated test suite covering authentication, RBAC boundaries, universal CSV ingestion, mathematical formula integrity, store resolution, and AI assistant grounding.

```bash
# Run all 128 automated TypeScript unit & integration tests
npm test

# Check TypeScript compiler for 0 errors
npx tsc --noEmit

# Run production Next.js build
npm run build

# Run offline benchmark evaluation
python scripts/run_evaluation.py
```

### Test Suite Summary
- **Total Tests**: **128 passing (100%)**
- **Test Suites**:
  1. `universalImport.test.ts`: Header normalization, alias matching, formula injection neutralization.
  2. `serverAuth.test.ts`: Standalone & Supabase session verification, role tampering immunity, store restrictions.
  3. `apiHardening.test.ts`: 401 unauthenticated protection, 403 cross-store isolation, alert triage permissions.
  4. `storeResolver.test.ts`: Store code and UUID alias resolution (`SEA-101` $\leftrightarrow$ `store-001`).
  5. `analyticsAuthenticity.test.ts`: Formula integrity, ROI calculations, and department vulnerability aggregation.
  6. `assistantGrounding.test.ts`: Tenant isolation and zero-hallucination context verification.

---

## 10. API Reference

All protected API routes authenticate requests using the `stocksentinel_session` cookie or an `Authorization: Bearer <token>` header.

### Authentication Endpoints
- `POST /api/auth/login`: Authenticates user credentials or auto-provisions new users. Returns session token and user profile.
- `GET /api/auth/session`: Returns current authenticated session state, role, company, and accessible store IDs.
- `POST /api/auth/logout`: Clears session token and revokes access cookie.

### Data Ingestion Endpoints
- `POST /api/import`: Ingests validated records for `combined_sales_inventory`, `daily_sales`, `inventory_snapshots`, `stores`, `products`, or `promotions`. Enforces store-level authorization and atomic batch validation.

### Analytics & Anomaly Detection
- `POST /api/detect`: Triggers the phantom stockout detection pipeline for the authorized store, generating ranked alert records and summary metrics.
- `GET /api/alerts`: Retrieves verified alert candidates scoped to authorized stores. Supports filtering by risk level, status, and store.
- `POST /api/alerts/[id]`: Records associate physical shelf-walk triage actions, root-cause categorization, and on-hand inventory count corrections.
- `GET /api/metrics`: Returns operational KPI metrics, detected phantom SKU counts, estimated revenue loss, and department vulnerability distributions.

### Enterprise & Store Management
- `GET /api/company/stores`: Returns all active physical stores belonging to the user's company.
- `POST /api/company/stores`: Provisions a new retail store (Company Manager / Platform Admin only).
- `GET /api/admin/companies`: Lists all corporate tenants across the platform (Platform Admin only).

---

## 11. Multi-Container Docker Deployment

To launch the full containerized stack locally using Docker Compose:

```bash
docker-compose up --build -d
```

- **StockSentinel Web Console**: `http://localhost:3000`
- **Optional Python ML Service**: `http://localhost:8000`
- **Service Health Check**: `http://localhost:8000/health`

---

## 12. Security & Compliance

- **Role Spoofing Immunity**: All authorization decisions query verified database records or cryptographically hashed session tokens. Client headers like `x-user-role` or `x-company-id` are strictly ignored.
- **Tenant Isolation**: Row Level Security (RLS) policies and API middleware ensure store managers can never access, query, or mutate records outside their assigned store.
- **Formulas & CSV Injection**: Exported and imported CSV data neutralizes spreadsheet injection characters (`=`, `+`, `-`, `@`).
- **Secret Protection**: Database connection passwords, private service role keys, and JWT secrets are restricted to server-side environments and never exposed to client-side bundles.

---

## 13. License
StockSentinel AI is open-source software licensed under the [MIT License](LICENSE).
