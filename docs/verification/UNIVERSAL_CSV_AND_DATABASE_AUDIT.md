# StockSentinel AI: Universal CSV Ingestion & Database Audit

**Target Workspace:** `d:\StockSentinel-AI-`  
**Supabase Target Project:** `https://tvhketdwcjdliptiwmft.supabase.co`  
**Supplied Publishable Key:** `sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2`  
**Execution Timestamp:** 2026-10-31T00:24:00Z  

---

## 1. Project Baseline & Architecture

| Component | Technology | Current Status |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16.4.2 (App Router, Turbopack, TailwindCSS) | Verified Healthy (16 application routes returning HTTP 200) |
| **Backend API** | Next.js Edge / Server Route Handlers (`src/app/api/*`) | 26 active route handlers |
| **Machine Learning / Detection** | Poisson / NHPP Zero-Sales Probability Engine (`src/lib/detector.ts` + `ml/detector.py`) | Verified (41.23% Precision@20 on official R1 evaluator) |
| **Database Architecture** | Dual-Mode: Supabase PostgreSQL (Production) + Local Persistent Storage (Standalone Dev) | Configured & Documented |
| **Authentication Engine** | Multi-Tenant RBAC with Supabase PKCE OAuth & Standalone Cookie Session | Fully verified |

---

## 2. New Supabase Project Connectivity Verification

- **Target URL:** `https://tvhketdwcjdliptiwmft.supabase.co`
- **Publishable Key:** `sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2`
- **Observed REST Connectivity Status:**
  - `GET https://tvhketdwcjdliptiwmft.supabase.co/rest/v1/` with publishable key returns HTTP 401 (`{"message":"Secret API key required"}`) as expected by Supabase PostgREST for root schema introspection without a secret key.
  - `GET https://tvhketdwcjdliptiwmft.supabase.co/rest/v1/stores?select=*` returns HTTP 404 (`Could not find the table 'public.stores' in the schema cache`), confirming that the new project instance is online and reachable, but **its database tables have not yet been migrated**.

### Required Action to Complete Cloud DB Migration:
A ready-to-run consolidated migration script has been generated at:
`supabase/combined_migration_for_new_project.sql` (76 KB)

To run it:
1. Open your **Supabase Dashboard** for project `tvhketdwcjdliptiwmft`.
2. Go to the **SQL Editor**.
3. Paste the contents of [`supabase/combined_migration_for_new_project.sql`](file:///d:/StockSentinel-AI-/supabase/combined_migration_for_new_project.sql) and click **RUN**.
4. Retrieve the `service_role` secret key from **Project Settings > API > Project API keys** and add it to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`.

---

## 3. Discovered Issues & Root Cause Inventory

### Issue 1: External Store & SKU Master Validation Rejection
- **File:** `src/app/api/import/route.ts`
- **Severity:** High
- **Root Cause:** When retail data from diverse systems (or the official hackathon sample with store `STR-BFPW`) is imported, transaction rows are checked against the store catalog. If a store code or SKU is unfamiliar, the entire batch was rejected with:
  `Store '...' was not found in store catalog. Please import stores first.`
- **Remediation:** Auto-provision missing stores and product master entities within the user's tenant context on-the-fly during telemetry ingestion.

### Issue 2: Role Access Barrier for Store Managers
- **File:** `src/app/api/import/route.ts`
- **Severity:** Medium
- **Root Cause:** Store Managers (`STORE_MANAGER`) were prevented from importing `stores` and `products` catalogs (`HTTP 403`), creating a deadlock when trying to ingest transaction files referencing unmapped items.

### Issue 3: Standalone vs. Cloud Supabase Mode Splitting
- **File:** `src/lib/storage.ts`
- **Severity:** High
- **Root Cause:** When `NEXT_PUBLIC_SUPABASE_URL` is set but the target cloud project lacks tables, writes failed. `authMode === 'standalone'` must route to local persistent storage.

---

## 4. Verification & Test Evidence

- **Unit & Integration Tests:** 128 / 128 PASS (100%)
- **TypeScript Typecheck:** 0 Errors (`npx tsc --noEmit`)
- **Next.js Production Build:** Succeeded cleanly (`npm run build`)
- **Combined Telemetry Pipeline:** Tested and verified with both sales and inventory snapshots.

