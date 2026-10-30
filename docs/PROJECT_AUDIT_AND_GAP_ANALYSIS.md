# Project Audit & Gap Analysis: StockSentinel AI

**Event**: Talentap Mega Hackathon  
**Track**: Retail Problem R1: *The Phantom Stock-Out Detector*  
**Date**: October 30, 2026  
**Auditor**: Lead Software Architect & ML Systems Engineer  

---

## 1. Hackathon Objective & Problem Definition

A **phantom stock-out** occurs when an inventory management system reports positive available stock ($S > 0$) for a SKU at a retail store, but the product is physically unavailable to customers (depleted, misplaced on another aisle, stuck in unworked backroom pallets, or stolen). 

### Operational Constraints & Evaluation Rules
1. **Target Scale**:
   - ~25 retail stores.
   - ~800 distinct SKUs per store.
   - ~18 months of historical telemetry.
   - ~10,950,000 potential store-SKU-day observation points.
2. **Actionable Output**:
   - Output an **investigation list of at most 20 candidates per store-day** (Top-20 Daily Shelf Walk).
   - Associates can realistically walk only 15–20 high-priority items per shift.
3. **Primary Metric**:
   - **Precision@20**: Proportion of recommended items that are genuine phantom stock-outs.
   - **Recall**: Percentage of all actual phantom stock-outs captured within the Top-20 queue.
4. **Explainability & Financial Impact**:
   - Every flagged alert must provide a transparent, human-readable rationale.
   - Clear financial quantification of lost revenue per day ($/day) and potential annual recovery.

---

## 2. Comprehensive Codebase Audit

### 2.1 Core Detection Engine (`src/lib/detector.ts`)
- **Strengths**:
  - Implements an explainable Poisson zero-sales anomaly formulation $P(X=0) = e^{-\Lambda}$.
  - Includes calibrated Day-of-Week multipliers ($1.45\times$ Saturday peak, $0.85\times$ Monday slump).
  - Includes promotional discount demand lift ($1.60\times$).
  - Features slow-mover dampening ($\lambda < 0.6$) and fast-mover boost ($\lambda \ge 2.5$).
  - Produces human-readable explanations (e.g., *"Positive inventory of 26 units with 5 days of 0 sales..."*).
- **Gaps / Areas for Improvement**:
  - The TypeScript engine runs in-memory. For 25 stores $\times$ 800 SKUs $\times$ 540 days, processing all data in a single serverless function could exceed execution timeouts (10s on Vercel).
  - Needs modular, standalone Python processing pipeline to batch-process 18 months of data offline or in worker queues.

### 2.2 Microservice Layer (`python-service/main.py`)
- **Strengths**:
  - FastAPI service providing `/health` and `/detect` endpoints.
  - Next.js server routes automatically fall back to TypeScript if the Python microservice is offline.
- **Gaps**:
  - Contained detection logic inside a single monolithic `main.py` file without modular sub-packages for demand estimation, streak analysis, ranking, and feature validation.
  - Needed restructuring into `apps/api/` and `ml/src/`.

### 2.3 Evaluation Pipeline (`evaluate.py`)
- **Strengths**:
  - Implements strict label isolation (synthetic ground-truth labels are never fed to inference).
  - Computes Precision@10, Precision@20, Recall, F1-Score, and Average Rank.
  - Reported metrics: Precision@20 = 40.28%, Recall = 96.67%, Average Rank = #5.45.
- **Gaps**:
  - Sat in the root directory without CLI arguments for input file paths.
  - Needs integration with `scripts/run_evaluation.py` accepting arbitrary input datasets.

### 2.4 Data Ingestion & Sample Management
- **Strengths**:
  - `/import` UI supports CSV ingestion for 5 entities: Stores, Products, Daily Sales, Inventory Snapshots, Promotions.
  - Client-side validation with PapaParse and server-side RBAC validation.
- **Gaps**:
  - Sample files were placed in a flat `samples/` folder without standard `data/raw/`, `data/interim/`, `data/processed/` structure.
  - Missing standalone CLI script `scripts/validate_data.py` to validate large hackathon CSV files before importing into the application.

### 2.5 Database & Multi-Tenant RBAC
- **Strengths**:
  - Complete Supabase PostgreSQL schema with 7 migrations.
  - Implements Platform Admin, Company Manager, and Store Manager access states.
  - Cryptographically secure single-use invitation tokens (SHA-256).
  - Zero-config in-memory fallback for rapid local testing.
- **Gaps**:
  - `schema.sql` at root was a partial duplicate of `supabase/migrations/`.
  - Database artifacts should be organized in `database/migrations/`, `database/schema/`, and `database/tests/`.

---

## 3. Gap Analysis Matrix

| Feature / Requirement | Current Status | Target State for Hackathon | Gap Severity | Action Plan |
| :--- | :---: | :---: | :---: | :--- |
| **Modular ML Architecture** | Monolithic `main.py` + `detector.ts` | Separated `ml/src/` with demand, detection, ranking, explanations, evaluation | High | Create modular Python ML package with unit tests in `ml/tests/`. |
| **Data Directory Hierarchy** | Flat `samples/` directory | Standardized `data/raw/`, `data/interim/`, `data/processed/`, `data/sample/` | Medium | Move CSVs to `data/sample/`, create directory tiers with `.gitkeep` and README. |
| **CLI Tools for Large Datasets** | UI import only | `scripts/validate_data.py` and `scripts/run_detection.py` | High | Implement CLI scripts capable of processing multi-gigabyte hackathon datasets. |
| **Database Directory Structure** | Root `schema.sql` + `supabase/` | Canonical `database/` directory with `migrations/`, `schema/`, and `tests/` | Medium | Restructure into `database/`, maintaining `supabase/` mirror for test compatibility. |
| **Containerization & Deployment** | No Docker configuration | `docker-compose.yml` + `Dockerfile.web` + `Dockerfile.api` | Medium | Provide Docker Compose and Dockerfile specifications in `deployment/docker/`. |
| **Technical Documentation** | Root `README.md` only | Dedicated `docs/` with architecture, data dictionary, algorithm, and setup | Low | Author exhaustive documentation suite under `docs/`. |
| **Large Dataset Optimization** | 3 stores $\times$ 30 SKUs demo | Scalable pipeline for 25 stores $\times$ 800 SKUs $\times$ 540 days | High | Architect batch processing and indexing for 18-month historical data. |

---

## 4. Architectural Readiness Scorecard

- **Frontend & Dashboard UI**: 95/100 (Clean Next.js 16 App Router, responsive, accessible, interactive charts)
- **Backend API & RBAC**: 95/100 (Hardened server-side authorization, cryptographic tokens, store-level isolation)
- **Deterministic Detection Engine**: 90/100 (Transparent Poisson algorithm, explainable, fast mover floors)
- **Repository Organization**: 65/100 $\rightarrow$ Target: 98/100 (Restructuring to modular monorepo-friendly hierarchy)
- **CLI & Batch Pipeline**: 50/100 $\rightarrow$ Target: 95/100 (Add CLI validation, batch detection runner, modular ML scripts)

