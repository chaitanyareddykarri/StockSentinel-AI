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
  - **Deterministic Baseline Engine**: Explainable Poisson anomaly formulation, day-of-week multipliers, promotion lift, and velocity tier dampening (`src/lib/detector.ts` and `ml/src/`).
  - **Optional External Python Service**: FastAPI microservice (`apps/api/main.py`) deployable separately with automatic server-side fallback.
  - **Benchmark Evaluation**: Precision@20 and Recall benchmark script (`scripts/run_evaluation.py`) with strict label isolation.
- **Database & Persistence**:
  - **Supabase (PostgreSQL)**: Full schema with DDL, foreign keys, cascade deletes, indexes, and Row Level Security (`supabase/migrations/` and `supabase/schema/complete_schema_v3.5.sql`).
  - **Zero-Config Demo Mode**: Live persistent in-memory/session fallback allowing immediate testing and exploration without requiring database credentials upfront.
- **Deployment**: Vercel-Ready and Docker Compose multi-container orchestration.

---

## 3. Project Directory Structure

```text
StockSentinel-AI/
├── apps/
│   └── api/                    # Python FastAPI microservice (main.py, requirements.txt)
├── data/
│   ├── raw/                    # Immutable raw input datasets
│   ├── interim/                # Intermediate transformed datasets
│   ├── processed/              # Preprocessed features and export outputs
│   └── sample/                 # Verified sample retail CSVs (stores, products, sales, etc.)
├── database/
│   ├── migrations/             # Chronological PostgreSQL migrations (v1.0 to v3.5)
│   ├── schema/                 # Base database schema (init_schema.sql)
│   └── tests/                  # SQL transactional isolation test harness
├── deployment/
│   ├── docker/                 # Production Dockerfiles for web and api
│   └── README.md               # Container and cloud deployment instructions
├── docs/                       # Complete architectural and technical documentation
│   ├── architecture/           # System architecture and restructure plan
│   ├── setup/                  # Quickstart and local setup guide
│   ├── data-dictionary/        # Full retail data dictionary and schemas
│   ├── model/                  # Mathematical anomaly detection formulation
│   ├── evaluation/             # Precision@20 benchmark protocol
│   ├── api/                    # REST API reference
│   ├── PROJECT_AUDIT_AND_GAP_ANALYSIS.md
│   └── REMAINING_WORK_AND_IMPLEMENTATION_PLAN.md
├── ml/                         # Modular Python ML & detection package
│   ├── src/                    # Demand, detection, ranking, explanations, evaluation
│   └── tests/                  # ML pipeline unit tests
├── scripts/                    # CLI tools (validate_data.py, run_detection.py, run_evaluation.py)
├── src/                        # Next.js 16 core web application (app, components, lib, types)
├── tests/                      # 11 comprehensive TypeScript test suites
└── docker-compose.yml          # Local multi-container orchestration
```

---

## 4. Local Development Quickstart

### Prerequisites
- **Node.js**: v18.17.0+ or v20+ (tested on Node v20/v24)
- **Package Manager**: npm (v10+ or v11+)
- **Python (Optional)**: 3.10+ (for running ML scripts or `apps/api/`)

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

## 5. Verification & Testing

```bash
# Run all TypeScript unit and integration tests
npm test

# Run Python ML pipeline unit tests
npm run test:ml

# Run benchmark evaluation
npm run evaluate

# Validate sample retail CSV datasets
npm run validate:data

# Run standalone offline detection
npm run detect:batch

# Run production build check
npm run build
```

---

## 6. Database Setup (Supabase PostgreSQL)

To enable permanent database persistence:

1. Create a free project at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor** in the Supabase dashboard.
3. Open and run `supabase/schema/complete_schema_v3.5.sql` (or apply migrations from `supabase/migrations/` sequentially).
4. Obtain your API credentials from **Project Settings > API**:
   - Project URL
   - Anonymous (`anon`, public) key
   - Service Role (`service_role`, secret) key
5. Update your `.env.local` or Vercel Environment Variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```

---

## 7. Optional Python ML Microservice

StockSentinel AI includes a production-ready Python FastAPI microservice in `apps/api/`:

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- Endpoint docs available at `http://localhost:8000/docs`
- Health check: `GET http://localhost:8000/health`
- Set in `.env.local`:
  ```env
  DETECTION_SERVICE_URL=http://localhost:8000
  ```
- **Fallback Reliability**: If `DETECTION_SERVICE_URL` is unset or fails, Next.js server-side routes automatically fall back to the built-in TypeScript baseline engine.

---

## 8. Multi-Container Deployment with Docker Compose

```bash
docker-compose up --build -d
```
- Web Application: `http://localhost:3000`
- API Microservice: `http://localhost:8000`

---

## 9. License
StockSentinel AI is open-source under the MIT License.

