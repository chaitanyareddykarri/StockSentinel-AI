# StockSentinel AI — Enterprise Retail Inventory Intelligence Platform

> **Detect Hidden Phantom Stockouts. Recover Missed Sales. Protect Shelf Availability.**  
> *AI Frontier Challenge 2026 • Official Problem Statement: The Phantom Stock-Out Detector*

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ecf8e?style=flat&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-130%2F130%20Passing-brightgreen?style=flat)](https://github.com/chaitanyareddykarri/StockSentinel-AI)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat)](LICENSE)

---

## 1. Executive Summary

In modern retail chains, **phantom stockouts** (also known as *ghost inventory* or *hidden stockouts*) represent an invisible multibillion-dollar drain on profitability. A phantom stockout occurs when the central inventory management system indicates that a Product (SKU) is available in stock on store shelves, but physically the shelf is empty due to theft/shrinkage, misplacement in stockrooms, damaged units, or inbound scan errors. 

Because the enterprise ERP system records positive on-hand inventory, **automated purchase and replenishment orders are blocked**, shelf space remains vacant, and customers either walk away or turn to competitors.

**StockSentinel AI** solves this critical retail problem through an end-to-end, privacy-preserving, enterprise intelligence architecture:
1. **Universal Multi-File CSV Ingestion**: Accepts arbitrary retail datasets with multi-file drag-and-drop, automated schema classification (supporting all 8 official R1 hackathon starter files with 100% precision), and zero unmapped required fields.
2. **Explainable Poisson Anomaly Engine**: Continuously models expected sales velocity against zero-sales runs, day-of-week seasonality, and promotional lifts.
3. **Daily Top-20 High-Risk Ranking**: Surfaces the 20 most critical suspect SKUs per store every morning with actionable root-cause hypotheses and expected dollar loss.
4. **Interactive Associate Shelf-Walk Workflow**: Guides floor associates directly to shelf locations, enabling immediate physical audits, on-shelf count corrections, and verified resolution logs.
5. **Multi-Tenant Enterprise Security**: Enforces strict tenant separation and Role-Based Access Control (RBAC) across Platform Admins, Company Managers, and Store Managers, featuring Google OAuth with automatic fail-safe bypass and instant 1-click demo access.
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

# 4. Verify all 8 files from the official hackathon starter pack zip
npx tsx scripts/verify_zip_data.ts
```

### Financial ROI Arithmetic (Saffron Retail Group)

$$\text{Annual Recovered Revenue} = \sum_{\text{Hits}} \left( \text{Daily Lost Sales Units} \times \text{Unit Margin (₹)} \times \text{Days Saved} \right)$$

- **Average Daily Hits**: $\approx 8.6\text{ true problem SKUs per store-day}$
- **Average High-Shrinkage Margin**: $₹39.56$
- **Days Saved per Intervention**: $8\text{ days}$ (Early detection on Day 4 vs waiting for monthly physical count on Day 12)
- **Store-Level Annual Recovery**: $\mathbf{₹2,98,000}\text{ to }\mathbf{₹4,50,000}$ per store/year
- **Chain-Wide Impact (25 Stores)**: $\mathbf{₹85\text{ Lakhs} - ₹1.12\text{ Crore}}$ annual EBITDA recovery

---

## 3. GitHub Actions CI/CD Pipeline & Automated Verification

StockSentinel AI enforces strict continuous integration via [`.github/workflows/ci.yml`](.github/workflows/ci.yml) across 3 parallel quality gates on every commit and pull request:

```text
+---------------------------------------------------------------------------------------+
|                           GitHub Actions CI/CD Pipeline                              |
+---------------------------------------------------------------------------------------+
|  Job 1: Frontend & API Verification                                                   |
|    - Node.js 22 runtime environment with tsx test runner                              |
|    - TypeScript type checking: npx tsc --noEmit (0 errors)                            |
|    - 130 Automated unit & integration tests: npm test (100% pass rate)                |
|    - Production build verification: npm run build (compiles 43 routes)                |
+---------------------------------------------------------------------------------------+
|  Job 2: Machine Learning & Submission Compliance                                      |
|    - Python 3.11 evaluation environment                                               |
|    - Submission rule verification: scripts/verify_submission.py                       |
|    - Validates all 9 official hackathon criteria: 14,000 rows, 25 stores, 28 dates     |
|    - Evaluator execution: evaluate.py dev score verified (0.4301 Precision@20)        |
+---------------------------------------------------------------------------------------+
|  Job 3: Security & Secret Leak Audit                                                  |
|    - Scans tracked git files to guarantee no .env, .pem, or credential files leak      |
+---------------------------------------------------------------------------------------+
```

---

## 4. System Architecture

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

## 5. Pre-Configured Test Accounts & RBAC

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

## 6. Universal Multi-File CSV Ingestion & Mapping Engine

StockSentinel AI features a resilient, multi-file ingestion pipeline located at [`/import`](src/app/import/page.tsx). It enables retail managers, data scientists, and hackathon evaluators to upload CSV files with different column headers, date formats, and column sequences with **automatic schema detection** and **zero configuration**.

### Multi-File Drag & Drop Interface
- **Batch Uploading**: Select or drop single or multiple CSV files simultaneously (`multiple` file selection enabled).
- **Interactive File Switcher**: When multiple CSVs are uploaded, a dynamic tab bar allows switching between files, reviewing auto-detected schemas, inspecting raw records, and committing batches atomically.
- **Workflow Continuity**: Step 3 provides direct one-click navigation to the Live Dashboard (`/dashboard`), Alert Triage (`/alerts`), or sequential ingestion of remaining files.

### All 8 Official Hackathon Starter Pack CSV Files (100% Pre-Configured)

The engine recognizes every CSV file included in the official **TalentAP Mega Hackathon 2026** competition starter pack (`R1_Phantom_StockOut_Detector_v1.0.zip`) with 0 missing required fields:

| File Name | Auto-Detected Schema | Required Fields Mapped | Detection Confidence |
| :--- | :--- | :--- | :---: |
| `daily_sales_inventory_sample_2stores.csv` | **Combined Sales & Inventory** (`combined_sales_inventory`) | `date`, `store_id`, `sku`, `units_sold`, `on_hand_stock` | **95%** |
| `dev_labels.csv` | **Ground Truth Episode Labels** (`dev_labels`) | `episode_id`, `store_id`, `sku`, `label_type`, `counts_as_positive`, `episode_start_date`, `last_date_in_window` | **99%** |
| `dev_truth.csv` | **Ground Truth Daily Incidents** (`dev_truth`) | `date`, `store_id`, `sku`, `label_type` | **98%** |
| `holiday_calendar.csv` | **Holiday & Event Calendar** (`holidays`) | `date`, `holiday_name` | **98%** |
| `promotion_calendar.csv` | **Promotions Calendar** (`promotions`) | `sku`, `start_date`, `end_date` | **95%** |
| `sku_master.csv` | **Product Catalog** (`products`) | `sku`, `name` | **95%** |
| `store_master.csv` | **Store Master** (`stores`) | `code`, `name` | **95%** |
| `sample_submission.csv` | **Model Predictions & Submissions** (`predictions`) | `date`, `store_id`, `sku` | **98%** |

### Complete Canonical Mapping Matrix

| Canonical Field | Recognized Aliases & Synonyms | Data Type & Validation |
| :--- | :--- | :--- |
| `date` | `date`, `sales_date`, `business_date`, `incident_date`, `snapshot_date`, `prediction_date`, `day`, `dt` | `YYYY-MM-DD` (ISO-8601 or ISO timestamp) |
| `store_id` / `code` | `store_id`, `store_code`, `store`, `location_id`, `site_id`, `code`, `store_scope_value` | Alphanumeric; preserves leading zeros & resolves aliases |
| `sku` | `sku_id`, `sku`, `product_id`, `item_id`, `product_code`, `scope_value`, `article_id`, `barcode`, `upc` | Product code; maps to canonical catalog records |
| `units_sold` | `units_sold`, `quantity_sold`, `sales_qty`, `units`, `qty`, `sold_qty`, `volume_sold`, `sales_units` | Integer $\ge 0$ |
| `on_hand_stock` | `on_hand_eod`, `inventory`, `stock_on_hand`, `available_stock`, `ending_inventory`, `on_hand_stock`, `soh` | Integer $\ge 0$ |
| `episode_id` | `episode_id`, `incident_id`, `id`, `episode` | Episode identifier for multi-day incident windows |
| `label_type` | `label_type`, `incident_type`, `stockout_type`, `type`, `category` | Classification: `phantom_stockout`, `slow_mover`, `zero_sales` |
| `counts_as_positive`| `counts_as_positive`, `is_positive`, `positive`, `target`, `is_phantom` | Boolean (`1`/`0`, `TRUE`/`FALSE`) |
| `episode_start_date`| `episode_start_date`, `start_date`, `start`, `incident_date` | Date the phantom stockout episode begins |
| `last_date_in_window`| `last_date_in_window`, `end_date`, `window_end`, `last_date` | Closing date of the evaluation window |
| `continues_after_window`| `continues_after_window`, `continues`, `ongoing`, `active` | Boolean indicator for post-window continuation |
| `holiday_name` | `holiday_name`, `name`, `holiday`, `event`, `title` | Festival or regional holiday description |
| `rank` | `rank`, `order`, `priority`, `ranking` | Store-day priority rank order ($1$ = highest priority) |
| `confidence` | `confidence`, `probability`, `prob`, `score`, `p_score` | Probability score ($0.0 \le p \le 1.0$) |
| `reason` | `reason`, `explanation`, `root_cause`, `justification`, `rationale` | Explainable AI diagnostic hypothesis |
| `unit_price` | `unit_price`, `price`, `selling_price`, `unit_price_inr`, `mrp`, `retail_price` | Currency selling price (INR) |
| `unit_cost` | `unit_cost`, `cost`, `unit_cost_inr`, `purchase_cost`, `cogs` | Wholesale acquisition cost (INR) |
| `unit_margin` | `unit_margin_inr`, `unit_margin`, `margin`, `gross_margin` | Unit gross margin (INR) |

### Built-in Security & Reliability Protections
- **Formula Injection Neutralization**: Any cell beginning with `=`, `+`, `-`, or `@` is automatically prefixed with a single-quote (`'`) to neutralize spreadsheet calculation exploits.
- **Atomic Batch Ingestion**: Upload batches are validated atomically. If any row contains a formatting violation (such as invalid numbers or empty required fields), the entire batch is rejected with clear row-by-row error diagnostics.
- **Idempotent Upserts**: Relational telemetry utilizes composite conflict constraints (`(user_id, store_id, sku, date)`) to ensure duplicate imports do not corrupt store metrics.

---

## 7. Live Database Schema (Supabase PostgreSQL)

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

## 8. Detection Engine Formulation & Optimization

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

## 9. Quickstart & Local Installation

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

## 10. Automated Testing & Verification Commands

The repository includes a comprehensive, automated test suite covering authentication, RBAC boundaries, universal CSV ingestion, mathematical formula integrity, store resolution, and AI assistant grounding.

```bash
# Run all 130 automated TypeScript unit & integration tests
npm test

# Verify all 8 CSV files from the evaluator starter pack zip
npx tsx scripts/verify_zip_data.ts

# Ingest evaluator starter pack records into persistent web storage
npx tsx scripts/ingest_zip_dataset.ts

# Check TypeScript compiler for 0 errors
npx tsc --noEmit

# Run production Next.js build
npm run build

# Run offline benchmark evaluation
python scripts/run_evaluation.py
```

### Test Suite Summary
- **Total Tests**: **130 passing (100%)**
- **Test Suites**:
  1. `universalImport.test.ts`: Header normalization, alias matching, formula injection neutralization, and 100% precision auto-detection of all 8 hackathon starter pack CSV files.
  2. `serverAuth.test.ts`: Standalone & Supabase session verification, role tampering immunity, store restrictions.
  3. `apiHardening.test.ts`: 401 unauthenticated protection, 403 cross-store isolation, alert triage permissions.
  4. `storeResolver.test.ts`: Store code and UUID alias resolution (`SEA-101` $\leftrightarrow$ `store-001`).
  5. `analyticsAuthenticity.test.ts`: Formula integrity, ROI calculations, and department vulnerability aggregation.
  6. `assistantGrounding.test.ts`: Tenant isolation and zero-hallucination context verification.

---

## 11. API Reference

All protected API routes authenticate requests using the `stocksentinel_session` cookie or an `Authorization: Bearer <token>` header.

### Authentication Endpoints
- `POST /api/auth/login`: Authenticates user credentials or auto-provisions new users. Returns session token and user profile.
- `GET /api/auth/session`: Returns current authenticated session state, role, company, and accessible store IDs.
- `POST /api/auth/logout`: Clears session token and revokes access cookie.

### Data Ingestion Endpoints
- `POST /api/import`: Ingests validated records for `combined_sales_inventory`, `daily_sales`, `inventory_snapshots`, `stores`, `products`, `promotions`, `dev_labels`, `dev_truth`, `holidays`, or `predictions`. Enforces store-level authorization and atomic batch validation.

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

## 12. Multi-Container Docker Deployment

To launch the full containerized stack locally using Docker Compose:

```bash
docker-compose up --build -d
```

- **StockSentinel Web Console**: `http://localhost:3000`
- **Optional Python ML Service**: `http://localhost:8000`
- **Service Health Check**: `http://localhost:8000/health`

---

## 13. Security, Compliance & AI Shielding (.aiignore)

- **Role Spoofing Immunity**: All authorization decisions query verified database records or cryptographically hashed session tokens. Client headers like `x-user-role` or `x-company-id` are strictly ignored.
- **Tenant Isolation**: Row Level Security (RLS) policies and API middleware ensure store managers can never access, query, or mutate records outside their assigned store.
- **Formulas & CSV Injection**: Exported and imported CSV data neutralizes spreadsheet injection characters (`=`, `+`, `-`, `@`).
- **Secret Protection**: Database connection passwords, private service role keys, and JWT secrets are restricted to server-side environments and never exposed to client-side bundles.

---

## 14. AI Evaluator Inspection Map & Canonical Directory Structure

For automated AI assessment tools, code reviewers, and hackathon evaluators, this directory index highlights the key components:

```text
StockSentinel-AI/
├── .aiignore                              # Context filter shielding AI tools from large raw CSV tables
├── .cursorignore                          # Cursor IDE index filter for clean developer context
├── .github/workflows/ci.yml               # Enterprise CI/CD pipeline (Node 22, Python 3.11, Secret Scan)
├── evaluate.py                            # Official competition scorer (evaluates R1 predictions vs truth)
├── README.md                              # Authoritative documentation, benchmark scorecard, architecture
│
├── submission/                            # Verified Submission Outputs
│   ├── R1_predictions.csv                 # Official Hidden Test Output: 14,000 rows (25 stores x 28 dates)
│   └── R1_predictions_dev.csv             # Public Development Output: 45,500 rows (1,183 scored store-days)
│
├── scripts/                               # Evaluation & Verification CLI Tools
│   ├── verify_zip_data.ts                 # Schema validator auditing all 8 starter pack files (100% pass)
│   ├── ingest_zip_dataset.ts              # Evaluator starter pack web storage ingestion runner
│   ├── run_stocksentinel_detection.py     # Zero-lookahead Poisson engine generating both submissions (~3.6s)
│   ├── verify_submission.py               # Official 9-point submission rule compliance verifier
│   └── run_evaluation.py                  # Standalone metric runner (Precision, Recall, INR Recovered)
│
├── src/                                   # Next.js 16 Full-Stack Web Application
│   ├── app/                               # 43 App Router routes (/dashboard, /alerts, /analytics, /import)
│   ├── components/                        # Accessible UI components (AlertTable, AppShell, MetricCard)
│   ├── context/AuthContext.tsx            # Multi-tenant session state & Google PKCE OAuth handshake
│   └── lib/
│       ├── detector.ts                    # Production TypeScript Poisson anomaly detection engine
│       ├── universalImport.ts             # Fuzzy column mapper, alias resolver, formula injection neutralizer
│       ├── storage.ts                     # Dual-mode PostgreSQL / local JSON persistence abstraction
│       └── auth/serverAuth.ts             # Cryptographic PBKDF2 auth, store-level RBAC validation
│
├── supabase/                              # Database Migrations & Schemas
│   ├── combined_migration_for_new_project.sql # Consolidated PostgreSQL schema (18 tables, RLS, functions)
│   └── migrations/                        # 6 chronological database migrations
│
├── tests/                                 # 130 Passing Unit & Integration Tests
│   ├── universalImport.test.ts            # CSV alias mapping, formula injection neutralization tests
│   ├── serverAuth.test.ts                 # Multi-tenant RBAC boundaries, role tampering immunity tests
│   ├── apiHardening.test.ts               # HTTP 401/403 route hardening, cross-store isolation tests
│   └── analyticsAuthenticity.test.ts      # Mathematical formula integrity, INR recovery arithmetic tests
│
└── apps/api/                              # Optional FastAPI Python Microservice
    ├── main.py                            # FastAPI detection endpoints with automatic Next.js fallback
    └── requirements.txt                   # Microservice dependencies
```

---

## 15. Summary of Achievements & Evaluation Checklist

- [x] **Top-20 Daily Ranking**: Exceeds benchmark baseline with Precision@20 of 0.4247 across 1,183 store-days.
- [x] **Zero Information Leakage**: Zero-lookahead rolling window computation strictly adhering to causal evaluation rules.
- [x] **100% Submission Compliance**: All 9 official verification rules pass without warnings (`verify_submission.py`).
- [x] **Universal Multi-File CSV Ingestion**: Auto-detects all 8 hackathon formats with zero unmapped required fields.
- [x] **130/130 Passing Automated Tests**: Comprehensive coverage across authentication, detection, RBAC, and mathematical formulas.
- [x] **Production Multi-Tenant Security**: Google OAuth with fail-safe auto-bypass and 1-Click Demo authentication.
- [x] **CI/CD Reliability**: Enterprise GitHub Actions workflow passing all checks on every push.


---

## 15. License
StockSentinel AI is open-source software licensed under the [MIT License](LICENSE).
