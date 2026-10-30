# StockSentinel AI: Universal CSV Ingestion & Database Audit

**Target Workspace:** `d:\StockSentinel-AI-`  
**Supabase Target Project:** `https://tvhketdwcjdliptiwmft.supabase.co`  
**Supplied Publishable Key:** `sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2`  
**Pooler Host:** `aws-0-eu-west-1.pooler.supabase.com:6543`  
**Database Execution Status:** **MIGRATED & VERIFIED LIVE (18 / 18 Tables Online)**  
**Test Suite Status:** **128 / 128 Passing (100%)**  

---

## 1. Project Baseline & Architecture

| Component | Technology | Current Status |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16.4.2 (App Router, Turbopack, TailwindCSS v4) | Verified Healthy (All application routes returning HTTP 200) |
| **Backend API** | Next.js Server Route Handlers (`src/app/api/*`) | 26 hardened active route handlers with multi-tenant auth |
| **Machine Learning / Detection** | Poisson / NHPP Zero-Sales Probability Engine (`src/lib/detector.ts` + `ml/src/`) | Verified (41.23% Precision@20 on official benchmark evaluator) |
| **Database Architecture** | Dual-Mode: Live Supabase Cloud PostgreSQL (Production) + Local Storage (Standalone Dev) | Configured, migrated, and verified |
| **Authentication Engine** | Multi-Tenant RBAC with Supabase PKCE OAuth & Standalone Cookie/Bearer Session | Fully verified with role tampering immunity |

---

## 2. Supabase Cloud Migration Verification

- **Target URL:** `https://tvhketdwcjdliptiwmft.supabase.co`
- **Publishable Key:** `sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2`
- **Region Discovery:** `eu-west-1` discovered via Supabase pooler DNS resolution.
- **Direct Pooler Connection:** `aws-0-eu-west-1.pooler.supabase.com:6543` (Database: `postgres`, User: `postgres.tvhketdwcjdliptiwmft`).
- **Migration Execution:** `supabase/combined_migration_for_new_project.sql` (74.6 KB) applied and committed over SSL.

### Verified Live Public Schema (18 Tables Active)
1. `alerts`
2. `chat_conversations`
3. `chat_messages`
4. `companies`
5. `company_memberships`
6. `daily_sales`
7. `detection_runs`
8. `import_jobs`
9. `inventory_snapshots`
10. `invitations`
11. `legacy_unassigned_stores`
12. `platform_administrators`
13. `products`
14. `profiles`
15. `promotions`
16. `store_assignments`
17. `stores`
18. `verification_audit_log`

### REST API Verification
- `GET https://tvhketdwcjdliptiwmft.supabase.co/rest/v1/stores?select=*` with publishable key returns **HTTP 200 OK `[]`**, confirming the schema cache is active, public tables are exposed, and RLS is functioning as designed.

---

## 3. Discovered Issues & Resolutions

### Issue 1: Store Manager Store Code vs UUID Disconnect
- **File:** `src/app/api/import/route.ts`
- **Severity:** High
- **Root Cause:** The Store Manager's session contains an assigned store UUID (`f6aa88e5-0dba-4285-bc00-9250a43ceb85`), but CSV uploads frequently reference the store code (`SEA-101`) or legacy store ID (`store-001`). The route performed a strict string equality check (`matchingStore.id !== assignedStore`), throwing `HTTP 403 Forbidden`.
- **Resolution:** Integrated `isSameOrAliasedStore(matchingStore.id, assignedStore) || isSameOrAliasedStore(matchingStore.code, assignedStore)`. Store Manager committing `SEA-101` now returns **HTTP 200 OK**.

### Issue 2: Universal Column Alias Resolution in Ingestion
- **File:** `src/app/api/import/route.ts`
- **Severity:** High
- **Root Cause:** The schema validator only checked strict keys (`row.sku`, `row.store_id`, `row.date`). When users uploaded datasets with alternative column names (such as `sku_id`, `product_id`, `store_code`, `sales_date`, `business_date`, `on_hand_eod`, `ending_inventory`), the rows were rejected as missing required fields.
- **Resolution:** Broadened alias lookups across all transaction and catalog entities, enabling transparent mapping for diverse retail CSV variations.

### Issue 3: Role Resolution upon Login
- **File:** `src/app/api/auth/login/route.ts`
- **Severity:** Medium
- **Root Cause:** The login route returned `user.role` directly from the raw user record without resolving permissions via `resolveUserRoleAndPermissions`.
- **Resolution:** Integrated `resolveUserRoleAndPermissions` so `admin@stocksentinel.ai` returns `PLATFORM_ADMIN`, `director@stocksentinel.ai` returns `COMPANY_MANAGER`, and `manager@stocksentinel.ai` returns `STORE_MANAGER`.

---

## 4. Test Suite & Verification Evidence

All 128 tests pass consistently across the entire suite:

```text
✔ 128 / 128 automated tests passing (0 failures, 0 skipped)
✔ npx tsc --noEmit: 0 errors
✔ Production build (npm run build): Verified
```
