# StockSentinel AI — Retail Inventory Intelligence Platform
> **Detect Hidden Stock Loss. Recover Missed Sales.**
> AI Frontier Challenge 2026 • Problem Statement: *The Phantom Stock-Out Detector*

---

## 1. Overview

**StockSentinel AI** is an AI-powered retail inventory intelligence web application built to identify potential **phantom stock-outs**: retail products that appear as available in inventory database records but are physically missing, misplaced, or depleted from store shelves.

When an inventory management system believes a SKU is in stock, automated replenishment orders are blocked, shelves stay empty, and customers walk away without buying. StockSentinel AI continuously analyzes daily sales velocities, on-hand inventory snapshots, and promotion calendars to detect anomalies, rank the top 20 suspicious candidates per store each morning, and guide store associates through physical shelf walks to verify and resolve the root cause.

---

## 2. Architecture & Tech Stack

- **Frontend & App Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, custom glassmorphism tokens, accessible mobile-first responsive layout
- **Icons & Animation**: Lucide React, Canvas Confetti
- **Analytics & Detection Engine**:
  - **Deterministic Baseline Engine**: Explainable Poisson anomaly formulation, day-of-week multipliers, promotion lift, and velocity tier dampening (`src/lib/detector.ts`).
  - **Optional External Python Service**: FastAPI microservice (`python-service/main.py`) deployable separately with automatic server-side fallback.
  - **Benchmark Evaluation**: Precision@20 and Recall benchmark script (`evaluate.py`) with strict label isolation.
- **Database & Persistence**:
  - **Supabase (PostgreSQL)**: Full schema with DDL, foreign keys, cascade deletes, indexes, and Row Level Security (`supabase/migrations/20261018000000_init_schema.sql` and `schema.sql`).
  - **Zero-Config Demo Mode**: Live persistent in-memory/session fallback allowing immediate testing and exploration without requiring database credentials upfront.
- **Deployment**: Vercel-Ready (serverless API routes, zero persistent filesystem dependencies, edge/serverless compatibility).

---

## 3. Core Features

### 3.1 Live Dashboard (`/`)
- Real-time KPIs: Monitored SKUs, Active Stores, Flagged Phantoms, Est. Revenue at Risk ($/day), Physical Verification Rate (%), and Precision@20 benchmark.
- Live store filtering across individual retail locations or network-wide.
- Top 20 daily investigation list ranked by statistical anomaly risk score (0–100).
- Risk severity distribution bar (Critical, High, Medium, Low).
- Chronological detection run history and live verification activity timeline.

### 3.2 Explainable Baseline Detection Algorithm
- Evaluates consecutive zero-sales days ($k \ge 2$) when recorded stock is strictly positive ($S > 0$).
- Computes cumulative expected demand $\Lambda = \sum \lambda_t$ incorporating day-of-week demand multipliers (weekend vs. weekday) and active promotional discount lift.
- Calculates Poisson zero-sales probability $P(X=0) = e^{-\Lambda}$.
- Slow-mover protection: products with low baseline demand ($\lambda < 0.6$ units/day) are shielded from false alarms.
- Generates transparent, human-readable explanations (e.g. *"System records 26 units in inventory, but 0 sales occurred over 5 days during an active promotion (expected 5.5 units/day, anomaly chance <0.01%)"*).
- Bounded risk score (0–100) and categorization (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

### 3.3 Prioritized Alerts & Physical Shelf Walk (`/alerts`)
- Full prioritized list of alerts with search, store filter, risk severity filter, and status filter (`Open`, `Under Review`, `Verified`, `False Positive`, `Resolved`).
- Interactive modal with deep-dive signal metrics (consecutive 0s, on-hand count, anomaly chance, daily lost revenue).
- Shelf Walk verification recorder: associates enter observed physical count, select root cause outcome, add investigation notes, and log their auditor ID:
  - *Confirmed Phantom Stock-Out (Shelf empty, tag present)*
  - *Backroom Displaced Stock (Palletized in warehouse, unworked)*
  - *Misplaced / Cross-Shelved (Found in incorrect aisle)*
  - *Theft / Shrinkage Adjustment (Adjust count to 0)*
  - *In-Stock False Alarm (Product was available on shelf)*
- Full timestamped audit trail tracking every status change and auditor note.

### 3.4 Retail Data Ingestion & CSV Import (`/import`)
- Multi-entity tabs: **Stores**, **Products / SKUs**, **Daily Sales**, **Inventory Snapshots**, and **Promotions**.
- One-click downloadable CSV sample templates for each entity.
- Drag-and-drop file upload with client-side parsing (PapaParse).
- Row-level validation checking column headers, missing values, non-negative integers, and date formats.
- Live preview showing the first 10 rows and summary statistics before committing to the database.

### 3.5 Benchmark Evaluation & Revenue Intelligence (`/analytics`)
- Precision@20 and Recall benchmark results comparing predictions against competition standards.
- Strict evaluation protocol: ground-truth labels are excluded from inference features.
- Department vulnerability rankings (Beverages, Dairy, Bakery, Snacks, Household).
- Interactive Revenue Recovery Simulator: calculate estimated monthly recovered sales from daily shelf walks.

### 3.6 Settings & Integrations (`/settings`)
- Configurable algorithm parameters (minimum zero days, fast mover velocity, slow mover threshold, max ranked alerts).
- Supabase PostgreSQL persistence connection status and migration guide.
- Optional Python ML microservice health endpoint configuration (`DETECTION_SERVICE_URL`).
- Factory reset and reload buttons for the realistic 60-day demo dataset.

---

## 4. Local Development Quickstart

### Prerequisites
- **Node.js**: v18.17.0+ or v20+ (tested on Node v24)
- **Package Manager**: npm (v10+ or v11+)
- **Python (Optional)**: 3.10+ (for running `evaluate.py` or `python-service/`)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/stocksentinel-ai.git
cd stocksentinel-ai
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
*Note: If no Supabase credentials are configured, the application automatically boots in Demo Mode using an in-memory session store pre-populated with 3 stores, 30 products, and 60 days of retail telemetry.*

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Database Setup (Supabase PostgreSQL)

To enable permanent database persistence:

1. Create a free project at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor** in the Supabase dashboard.
3. Open `schema.sql` (or `supabase/migrations/20261018000000_init_schema.sql`) from this repository.
4. Copy and run the entire SQL script. It creates:
   - `stores`, `products`, `daily_sales`, `inventory_snapshots`, `promotions`
   - `detection_runs`, `alerts`, `verification_audit_log`
   - Performance indexes on `(store_id, date)`, `(sku, date)`, `(run_id)`
   - Row Level Security (RLS) policies allowing application reads and updates
5. Obtain your API credentials from **Project Settings > API**:
   - Project URL
   - Anonymous (`anon`, public) key
   - Service Role (`service_role`, secret) key
6. Update your `.env.local` or Vercel Environment Variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```

---

## 6. Optional Python ML Microservice

StockSentinel AI includes a production-ready Python FastAPI microservice in `python-service/`:

```bash
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- Endpoint docs available at `http://localhost:8000/docs`
- Health check: `GET http://localhost:8000/health`
- Deploy to Render, Railway, Modal, or Fly.io, and set:
  ```env
  DETECTION_SERVICE_URL=https://your-python-service.onrender.com
  ```
- **Fallback Reliability**: If `DETECTION_SERVICE_URL` is unset or fails, Next.js server-side routes automatically fall back to the built-in TypeScript baseline engine.

---

## 7. Running Benchmark Evaluation

To evaluate detection quality against ground-truth labels:
```bash
python evaluate.py
```
Outputs Precision@10, Precision@20, Recall, and Average Rank of true phantoms without passing ground-truth labels into inference.

---

## 8. Deployment Guide for Vercel

### Option A: Deploy via Vercel Git Integration (Recommended)
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Go to the [Vercel Dashboard](https://vercel.com/new).
3. Import your `stocksentinel-ai` repository.
4. Framework Preset will be automatically detected as **Next.js**.
5. In **Environment Variables**, add:
   - `NEXT_PUBLIC_APP_URL`: Your Vercel production domain (e.g. `https://stocksentinel-ai.vercel.app`)
   - *(Optional for Supabase)*: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - *(Optional for Python)*: `DETECTION_SERVICE_URL`
6. Click **Deploy**.

### Option B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

---

## 9. Troubleshooting & FAQ

- **Port in use error during local start**: If port 3000 is occupied, run `npm run start -- -p 3001`.
- **Demo Mode vs. Supabase Mode**: If the navbar displays `Demo Mode`, check that `NEXT_PUBLIC_SUPABASE_URL` starts with `https://` and is not the placeholder text.
- **CSV Import skips rows**: The import tool enforces data integrity. Ensure date columns follow `YYYY-MM-DD` and numerical values are non-negative.
- **Build verification**: Always run `npm run lint` and `npm run build` prior to committing to ensure strict type compliance.

---

## 10. License
StockSentinel AI is open-source under the MIT License.
