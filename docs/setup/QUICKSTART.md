# Quickstart & Setup Guide: StockSentinel AI

**Platform**: StockSentinel AI  
**Prerequisites**: Node.js v18+ (tested on Node v20/v24), Python 3.10+ (optional for ML service).

---

## 1. Quick Local Start (Zero-Config Demo Mode)

StockSentinel AI boots out of the box in Demo Mode without requiring any database setup or external services.

```bash
# 1. Clone repository
git clone https://github.com/your-org/stocksentinel-ai.git
cd stocksentinel-ai

# 2. Install dependencies
npm install

# 3. Configure local environment
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Running Automated Tests

```bash
# Run all TypeScript tests
npm test

# Run linter
npm run lint

# Run production build check
npm run build
```

---

## 3. Running the Benchmark Evaluation

```bash
# Run evaluation benchmark
npm run evaluate
# or
python scripts/run_evaluation.py
```

---

## 4. Supabase PostgreSQL Setup (Optional Production Persistence)

To connect to a live Supabase PostgreSQL database:

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase Dashboard.
3. Run the migrations in `database/migrations/` sequentially:
   - `20261018000000_init_schema.sql`
   - `20261018000001_secure_schema.sql`
   - `20261028000000_chat_schema.sql`
   - `20261029000000_multi_tenant_rbac_schema.sql`
   - `20261029000001_invitations_declined_state.sql`
   - `20261029000002_fix_accept_invitation_ambiguity.sql`
4. Set credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

## 5. Running the Python ML Microservice (Optional)

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set in `.env.local`:
```env
DETECTION_SERVICE_URL=http://localhost:8000
```

