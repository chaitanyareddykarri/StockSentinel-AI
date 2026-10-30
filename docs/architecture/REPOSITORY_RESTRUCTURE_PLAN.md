# Repository Restructure Plan: StockSentinel AI

**Target Competition**: Talentap Mega Hackathon — Problem R1: *The Phantom Stock-Out Detector*  
**Date**: October 30, 2026  
**Document Version**: 1.0.0  
**Status**: APPROVED FOR EXECUTION  

---

## 1. Executive Summary & Purpose

StockSentinel AI is an inventory intelligence platform designed to detect phantom stock-outs (items with recorded stock > 0 in store inventory databases, but physically missing or depleted on shelves). 

This plan details the audit and structured reorganization of the repository to transition from a prototype structure to a modular, scalable architecture. It establishes clean boundaries between:
- **Web Frontend & UI Components** (`src/app/`, `src/components/`, `src/features/`)
- **Backend API & Middleware** (`src/app/api/`, `apps/api/`)
- **Modular Machine Learning & Analytics Engine** (`ml/`, `src/lib/detector.ts`)
- **Data Tiers** (`data/sample/`, `data/raw/`, `data/interim/`, `data/processed/`)
- **Database Architecture** (`database/migrations/`, `database/schema/`, `database/tests/`)
- **CLI & Automation Scripts** (`scripts/`)
- **Deployment & Orchestration** (`deployment/docker/`, `docker-compose.yml`)
- **Formal Technical Documentation** (`docs/`)

---

## 2. Current Directory Structure (Baseline)

```text
StockSentinel-AI/
├── .env.example
├── .gitignore
├── AGENTS.md
├── eslint.config.mjs
├── evaluate.py
├── next.config.ts
├── package.json
├── package-lock.json
├── README.md
├── schema.sql
├── tsconfig.json
├── public/
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
│   └── images/ (stocksentinel-logo.png, etc.)
├── python-service/
│   ├── main.py
│   └── requirements.txt
├── samples/
│   ├── daily_sales.csv
│   ├── inventory_snapshots.csv
│   ├── products.csv
│   ├── promotions.csv
│   └── stores.csv
├── src/
│   ├── app/ (13 pages, 23 API routes)
│   ├── components/ (11 React components)
│   ├── context/ (AuthContext.tsx)
│   ├── lib/ (detector, storage, analytics, auth, assistant, db, email)
│   └── types/ (index.ts)
├── supabase/
│   ├── migrations/ (7 SQL migrations)
│   └── tests/ (1 SQL test file)
└── tests/
    ├── ts-resolver.mjs
    └── 11 test suites (*.test.ts)
```

---

## 3. Proposed Target Structure

```text
StockSentinel-AI/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── AGENTS.md
│
├── docs/
│   ├── architecture/
│   │   ├── REPOSITORY_RESTRUCTURE_PLAN.md
│   │   └── SYSTEM_ARCHITECTURE.md
│   ├── setup/
│   │   └── QUICKSTART.md
│   ├── data-dictionary/
│   │   └── DATA_DICTIONARY.md
│   ├── model/
│   │   └── DETECTION_ALGORITHM.md
│   ├── evaluation/
│   │   └── BENCHMARK_EVALUATION.md
│   ├── api/
│   │   └── API_REFERENCE.md
│   ├── PROJECT_AUDIT_AND_GAP_ANALYSIS.md
│   └── REMAINING_WORK_AND_IMPLEMENTATION_PLAN.md
│
├── apps/
│   └── api/ (FastAPI Microservice)
│       ├── main.py
│       └── requirements.txt
│
├── ml/
│   ├── src/
│   │   ├── demand/
│   │   │   └── baseline_poisson.py
│   │   ├── detection/
│   │   │   └── anomaly_detector.py
│   │   ├── ranking/
│   │   │   └── store_ranker.py
│   │   ├── explanations/
│   │   │   └── reason_generator.py
│   │   └── evaluation/
│   │       └── metrics.py
│   ├── tests/
│   │   └── test_ml_pipeline.py
│   └── README.md
│
├── data/
│   ├── raw/
│   │   └── .gitkeep
│   ├── interim/
│   │   └── .gitkeep
│   ├── processed/
│   │   └── .gitkeep
│   ├── sample/
│   │   ├── daily_sales.csv
│   │   ├── inventory_snapshots.csv
│   │   ├── products.csv
│   │   ├── promotions.csv
│   │   └── stores.csv
│   └── README.md
│
├── database/
│   ├── migrations/
│   │   ├── 20261018000000_init_schema.sql
│   │   ├── 20261018000001_secure_schema.sql
│   │   ├── 20261028000000_chat_schema.sql
│   │   ├── 20261029000000_multi_tenant_rbac_rollback.sql
│   │   ├── 20261029000000_multi_tenant_rbac_schema.sql
│   │   ├── 20261029000001_invitations_declined_state.sql
│   │   └── 20261029000002_fix_accept_invitation_ambiguity.sql
│   ├── schema/
│   │   └── init_schema.sql
│   ├── tests/
│   │   └── 20261029000000_test_rbac_isolation.sql
│   └── README.md
│
├── scripts/
│   ├── run_evaluation.py
│   ├── validate_data.py
│   └── run_detection.py
│
├── deployment/
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   └── Dockerfile.api
│   └── README.md
│
├── src/
│   ├── app/ (Pages & API routes)
│   ├── components/ (Atomic and layout components)
│   ├── context/ (AuthContext)
│   ├── lib/ (Runtime utilities, detector, storage, auth, assistant)
│   └── types/ (TypeScript interfaces)
│
├── supabase/ (Maintained as mirrored configuration for Supabase CLI & tests)
│   ├── migrations/
│   └── tests/
│
└── tests/
    ├── ts-resolver.mjs
    └── *.test.ts (11 comprehensive TypeScript test suites)
```

---

## 4. Current-to-Target File Mapping

| Source File / Directory | Target Location | Action | Reason |
| :--- | :--- | :--- | :--- |
| `schema.sql` (root) | `database/schema/init_schema.sql` | Move | Belongs in database schemas, not repository root. |
| `evaluate.py` (root) | `scripts/run_evaluation.py` | Move + Shim | Belongs in scripts directory. Keep root shim forwarding to `scripts/run_evaluation.py`. |
| `samples/*.csv` | `data/sample/*.csv` | Move | Consolidates sample datasets in the standardized `data/` tree. |
| `python-service/` | `apps/api/` | Copy/Move | Establishes `apps/api/` as the formal FastAPI detection microservice. |
| `supabase/migrations/*` | `database/migrations/*` | Mirror/Organize | Establishes the database canonical directory while preserving compatibility. |
| `supabase/tests/*` | `database/tests/*` | Mirror/Organize | Organizes SQL isolation tests with database scripts. |
| *(New)* `docker-compose.yml` | `docker-compose.yml` | Create | Container orchestration for Next.js web + FastAPI microservice. |
| *(New)* `deployment/docker/*` | `deployment/docker/*` | Create | Production Dockerfiles for web and api. |
| *(New)* `ml/src/*` | `ml/src/*` | Create | Modular Python implementation of demand, detection, ranking, and evaluation. |
| *(New)* `scripts/validate_data.py` | `scripts/validate_data.py` | Create | CLI tool to validate retail CSVs against schema rules. |
| *(New)* `scripts/run_detection.py` | `scripts/run_detection.py` | Create | Standalone CLI runner for phantom stock-out inference. |
| *(New)* `docs/*` | `docs/*` | Create | Exhaustive architectural, operational, and algorithmic documentation. |

---

## 5. Directory Actions

### Directories to Retain:
- `src/`: Core Next.js 16 application (App Router, components, lib, types). Preserved to ensure zero disruption to Next.js Turbopack build and Vercel serverless functions.
- `public/`: Static branding and vector icons.
- `tests/`: 11 robust TypeScript tests and the module loader `ts-resolver.mjs`.
- `supabase/`: Preserved to guarantee backwards compatibility with Supabase CLI commands and `tests/migrationRbac.test.ts`.

### Directories to Merge & Standardize:
- `samples/` $\rightarrow$ merged into `data/sample/`.
- `schema.sql` (root) $\rightarrow$ merged into `database/schema/init_schema.sql`.
- `python-service/` $\rightarrow$ standardized into `apps/api/`.

### Directories Created:
- `data/raw/`, `data/interim/`, `data/processed/`, `data/sample/`: Structured data pipeline tiers.
- `database/schema/`, `database/migrations/`, `database/tests/`: Consolidated database management.
- `ml/src/demand/`, `ml/src/detection/`, `ml/src/ranking/`, `ml/src/explanations/`, `ml/src/evaluation/`, `ml/tests/`: Modular ML modules.
- `scripts/`: Production command-line scripts.
- `deployment/docker/`: Container build files.
- `docs/architecture/`, `docs/setup/`, `docs/data-dictionary/`, `docs/model/`, `docs/evaluation/`, `docs/api/`: Comprehensive documentation suite.

---

## 6. Import and Path Changes Required

1. **`tests/csvImportPipeline.test.ts`**:
   - Update file path resolution to check `data/sample/` with fallback to `samples/` so both paths succeed unconditionally.
2. **`package.json`**:
   - Update package name from `"anits"` to `"stocksentinel-ai"`.
   - Add `"test"` script: `"node --loader ./tests/ts-resolver.mjs --test tests/*.test.ts"`.
   - Add `"test:ml"` script: `"python -m unittest discover -s ml/tests"`.
   - Add `"evaluate"` script: `"python scripts/run_evaluation.py"`.
3. **`.gitignore`**:
   - Adjust `data/` rule to ignore runtime JSON databases (`/data/*.json`) and data caches (`/data/raw/*`, `/data/interim/*`, `/data/processed/*`), but explicitly track `!data/sample/`, `!data/README.md`, and `.gitkeep` files.
4. **`evaluate.py`** (root):
   - Replace with a backward-compatible proxy forwarding execution to `scripts/run_evaluation.py`.

---

## 7. Risks and Mitigation Steps

| Identified Risk | Severity | Mitigation Strategy |
| :--- | :---: | :--- |
| **Next.js App Router Breaking** | High | Do NOT relocate `src/` to `apps/web/` without monorepo tooling; keep `src/` at the root of the web project so Next.js Turbopack and Vercel builds remain 100% stable. |
| **Test Suite Breakage** | High | Update `tests/csvImportPipeline.test.ts` to locate CSV samples in `data/sample/` and `samples/`. Keep `supabase/` intact so `tests/migrationRbac.test.ts` passes without modification. |
| **Python Service Breakage** | Medium | Maintain `python-service/` or forward to `apps/api/` so existing environment variable `DETECTION_SERVICE_URL` remains valid in all deployment scripts. |
| **Data Loss or Overwrite** | Critical | Raw data directories are read-only during processing. Sample CSVs are committed as static fixtures under `data/sample/`. |

---

## 8. Verification Commands

1. `npm run lint` (ESLint verification)
2. `npm run build` (Next.js Turbopack compilation & TypeScript check)
3. `node --loader ./tests/ts-resolver.mjs --test tests/*.test.ts` (All 11 TypeScript tests)
4. `python scripts/run_evaluation.py` (Evaluation benchmark verification)
5. `python scripts/validate_data.py --data-dir data/sample` (CSV schema validation)
6. `python -m unittest discover -s ml/tests` (Python ML pipeline tests)

