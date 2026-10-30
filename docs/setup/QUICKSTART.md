# Quickstart & Setup Guide: StockSentinel AI

**Platform**: StockSentinel AI  
**Prerequisites**: Node.js v18.17.0+ (tested on Node v20 & v24), npm v10+, Python 3.10+ (optional for ML service).

---

## 1. Quick Local Start (Zero-Config Demo Mode)

StockSentinel AI boots out of the box in Demo Mode without requiring any external database credentials.

```bash
# 1. Clone repository
git clone https://github.com/chaitanyareddykarri/StockSentinel-AI.git
cd StockSentinel-AI

# 2. Install dependencies
npm install

# 3. Configure local environment
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Pre-Configured Test Accounts

The platform comes with pre-seeded accounts configured for each enterprise role:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Platform Admin** | `admin@stocksentinel.ai` | `admin1234` | Full platform-wide audit access across all companies and stores |
| **Company Director** | `director@stocksentinel.ai` | `demo1234` | Company-wide multi-store operational management |
| **Store Manager** | `manager@stocksentinel.ai` | `demo1234` | Strictly scoped to Downtown Supercenter #101 (`SEA-101`) |

---

## 3. Automated Verification & Testing

```bash
# 1. Run all 128 automated TypeScript unit & integration tests
npm test

# 2. Verify TypeScript compilation (0 errors)
npx tsc --noEmit

# 3. Test production Next.js build (compiles all 43 routes)
npm run build

# 4. Generate dev and test submissions (~3.6s)
py scripts/run_stocksentinel_detection.py

# 5. Score predictions against public ground truth (Precision@20: 0.4301)
py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv --out score.json

# 6. Verify all 9 official competition submission criteria
py scripts/verify_submission.py
```

---

## 4. Connecting to Supabase Cloud PostgreSQL

To connect the application to the new Supabase Cloud project:

### 1. Update Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://tvhketdwcjdliptiwmft.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wg1yRwWPOdj8gxvxgRjkIw_BE4dhzZ2
DATABASE_URL=postgresql://postgres.tvhketdwcjdliptiwmft:YOUR-DATABASE-PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

### 2. Apply Complete Database Migration
If setting up a fresh database, run the all-in-one consolidated migration script:
`supabase/combined_migration_for_new_project.sql`

This script creates and verifies all 18 tables:
- `companies`, `company_memberships`, `stores`, `products`, `store_assignments`, `profiles`
- `daily_sales`, `inventory_snapshots`, `promotions`
- `import_jobs`, `detection_runs`, `alerts`
- `chat_conversations`, `chat_messages`
- `invitations`, `legacy_unassigned_stores`, `platform_administrators`, `verification_audit_log`

---

## 5. Running the Python ML Microservice (Optional)

An optional Python FastAPI service is available in `apps/api/`:

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set in `.env.local`:
```env
DETECTION_SERVICE_URL=http://localhost:8000
```
*(If unset or unavailable, StockSentinel automatically uses the high-performance built-in TypeScript detection engine with zero downtime).*
