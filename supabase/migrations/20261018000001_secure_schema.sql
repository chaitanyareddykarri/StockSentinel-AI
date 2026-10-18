-- ====================================================================
-- StockSentinel AI — PostgreSQL / Supabase Enterprise Schema
-- Version: 2.0.0 (Multi-Tenant, Row-Level-Security Enforced)
-- Description: Full production schema with UUID primary keys,
-- user isolation via auth.uid(), strictly enforced RLS policies,
-- audit trails, and automated user profile sync.
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. User Profiles Table (Linked to auth.users)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    store_name TEXT DEFAULT 'Retail Store #101',
    role TEXT NOT NULL DEFAULT 'STORE_MANAGER' CHECK (role IN ('STORE_MANAGER', 'INVENTORY_LEAD', 'ASSOCIATE', 'EVALUATOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create a profile whenever a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, store_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'store_name', 'Retail Supercenter'),
        COALESCE((NEW.raw_user_meta_data->>'role'), 'STORE_MANAGER')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- 2. Stores Table (Scoped to User / Workspace)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'Supercenter',
    total_skus INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stores_user_code UNIQUE (user_id, code)
);

-- --------------------------------------------------------------------
-- 3. Products Table (Scoped to User / Workspace)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    avg_daily_demand NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    min_stock_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_user_sku UNIQUE (user_id, sku)
);

-- --------------------------------------------------------------------
-- 4. Daily Sales Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    date DATE NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    day_of_week SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_user_store_sku_date UNIQUE (user_id, store_id, sku, date)
);

-- --------------------------------------------------------------------
-- 5. Inventory Snapshots Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    date DATE NOT NULL,
    on_hand_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_user_store_sku_date UNIQUE (user_id, store_id, sku, date)
);

-- --------------------------------------------------------------------
-- 6. Promotions Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    promo_type TEXT NOT NULL DEFAULT 'DISCOUNT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 7. Detection Runs Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.detection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    store_id TEXT NOT NULL DEFAULT 'ALL',
    total_skus_analyzed INTEGER NOT NULL DEFAULT 0,
    flagged_count INTEGER NOT NULL DEFAULT 0,
    critical_count INTEGER NOT NULL DEFAULT 0,
    engine_type TEXT NOT NULL DEFAULT 'BASELINE_POISSON',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 8. Alerts Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id UUID REFERENCES public.detection_runs(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_category TEXT NOT NULL CHECK (risk_category IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    consecutive_zero_days INTEGER NOT NULL DEFAULT 0,
    recorded_stock INTEGER NOT NULL DEFAULT 0,
    expected_daily_sales NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    est_lost_revenue_daily NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    poisson_anomaly_p NUMERIC(8, 6) NOT NULL DEFAULT 1.000000,
    is_on_promotion BOOLEAN NOT NULL DEFAULT FALSE,
    primary_reason TEXT NOT NULL,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'VERIFIED', 'FALSE_POSITIVE', 'RESOLVED')),
    verification_outcome TEXT CHECK (verification_outcome IN ('PHANTOM_CONFIRMED', 'BACKROOM_DISPLACED', 'MISPLACED_SHELF', 'THEFT_SHRINKAGE', 'IN_STOCK_FALSE_ALARM')),
    shelf_count INTEGER,
    investigation_notes TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 9. Verification Audit Log Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    outcome TEXT,
    shelf_count INTEGER,
    notes TEXT,
    changed_by TEXT NOT NULL DEFAULT 'Store Associate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 10. Import Jobs Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('stores', 'products', 'daily_sales', 'inventory_snapshots', 'promotions')),
    filename TEXT NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- Query Optimization Indexes
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON public.daily_sales(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_store_sku ON public.daily_sales(store_id, sku);
CREATE INDEX IF NOT EXISTS idx_inv_user_date ON public.inventory_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_inv_store_sku ON public.inventory_snapshots(store_id, sku);
CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON public.alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_risk_score ON public.alerts(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_run_id ON public.alerts(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_alert_id ON public.verification_audit_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.verification_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_imports_user_id ON public.import_jobs(user_id);

-- --------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- Enforce strict data isolation: Users can ONLY access their own records
-- --------------------------------------------------------------------

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Stores RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own stores" ON public.stores
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Products RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own products" ON public.products
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily Sales RLS
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own sales" ON public.daily_sales
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inventory Snapshots RLS
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own inventory" ON public.inventory_snapshots
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Promotions RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own promotions" ON public.promotions
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Detection Runs RLS
ALTER TABLE public.detection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own detection runs" ON public.detection_runs
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Alerts RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own alerts" ON public.alerts
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Verification Audit Log RLS
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own audit logs" ON public.verification_audit_log
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Import Jobs RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own import jobs" ON public.import_jobs
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- Safe Workspace Demo Seed Function (Clearly marked is_demo = TRUE)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_demo_workspace(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    store1_id UUID;
    store2_id UUID;
    prod1_id UUID;
    prod2_id UUID;
    run1_id UUID;
BEGIN
    -- 1. Create Demo Stores
    INSERT INTO public.stores (user_id, code, name, location, store_type, total_skus)
    VALUES 
        (target_user_id, 'STR-101', 'Downtown Supercenter #101', 'Metro District 4', 'Supercenter', 30),
        (target_user_id, 'STR-102', 'Westside Plaza Express #102', 'West Commercial Zone', 'Express', 25)
    ON CONFLICT (user_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO store1_id;

    SELECT id INTO store2_id FROM public.stores WHERE user_id = target_user_id AND code = 'STR-102';

    -- 2. Create Demo Products
    INSERT INTO public.products (user_id, sku, name, category, unit_price, avg_daily_demand, min_stock_threshold)
    VALUES
        (target_user_id, 'SKU-104', 'Electrolyte Citrus Rush 16oz', 'Beverages', 2.89, 4.60, 8),
        (target_user_id, 'SKU-112', 'Artisan Sourdough Boule 500g', 'Bakery', 4.49, 3.20, 5)
    ON CONFLICT (user_id, sku) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO prod1_id;

    SELECT id INTO prod2_id FROM public.products WHERE user_id = target_user_id AND sku = 'SKU-112';

    -- 3. Create Sample Detection Run
    INSERT INTO public.detection_runs (user_id, store_id, total_skus_analyzed, flagged_count, critical_count, engine_type, is_demo)
    VALUES (target_user_id, 'ALL', 55, 2, 1, 'BASELINE_POISSON', TRUE)
    RETURNING id INTO run1_id;

    -- 4. Create Sample Flagged Alerts
    INSERT INTO public.alerts (
        user_id, run_id, store_id, store_name, product_id, sku, product_name, category, unit_price,
        risk_score, risk_category, consecutive_zero_days, recorded_stock, expected_daily_sales,
        est_lost_revenue_daily, poisson_anomaly_p, is_on_promotion, primary_reason, status, is_demo
    ) VALUES (
        target_user_id, run1_id, store1_id, 'Downtown Supercenter #101', prod1_id, 'SKU-104',
        'Electrolyte Citrus Rush 16oz', 'Beverages', 2.89, 99, 'CRITICAL', 3, 18, 4.60,
        13.29, 0.000001, FALSE, 'Fast runner with 3 consecutive days of 0 sales despite 18 units recorded on hand.',
        'OPEN', TRUE
    ), (
        target_user_id, run1_id, store1_id, 'Downtown Supercenter #101', prod2_id, 'SKU-112',
        'Artisan Sourdough Boule 500g', 'Bakery', 4.49, 88, 'HIGH', 2, 12, 3.20,
        14.37, 0.001600, FALSE, 'Consecutive 0-sales streak indicates shelf phantom stock-out.',
        'OPEN', TRUE
    );

    RETURN jsonb_build_object('success', true, 'message', 'Demo workspace records seeded with is_demo = true');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
