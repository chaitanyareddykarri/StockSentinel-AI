-- ====================================================================
-- StockSentinel AI — PostgreSQL / Supabase Complete Schema
-- Version: 3.5.0 (Consolidated Multi-Tenant Production Baseline)
-- Description: Consolidated DDL combining all chronological migrations:
-- 1. PostgreSQL extensions (uuid-ossp, pgcrypto)
-- 2. User profiles & trigger on auth.users
-- 3. Multi-tenant company hierarchy (companies, platform_administrators, company_memberships)
-- 4. Retail master tables (stores, products, store_assignments, invitations)
-- 5. Operational telemetry (daily_sales, inventory_snapshots, promotions)
-- 6. Detection engine (detection_runs, alerts, verification_audit_log, import_jobs)
-- 7. Conversational AI persistence (chat_conversations, chat_messages)
-- 8. Hardened security definer authorization functions & RLS policies
-- 9. Transactional stored procedures (onboard_company_transaction, accept_invitation)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Enable Required Extensions
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 2. User Profiles Table (Linked to auth.users)
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

-- Trigger to automatically create or update a profile on auth.users activity
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
-- 3. Multi-Tenant Enterprise Hierarchy
-- --------------------------------------------------------------------

-- 3.1 Companies Table (Enterprise Tenant Root)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 100),
    slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$' AND char_length(slug) >= 3 AND char_length(slug) <= 60),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED')),
    max_stores INTEGER NOT NULL DEFAULT 5 CHECK (max_stores >= 1 AND max_stores <= 50),
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- 3.2 Platform Administrators Table
CREATE TABLE IF NOT EXISTS public.platform_administrators (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Company Memberships Table
CREATE TABLE IF NOT EXISTS public.company_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('COMPANY_MANAGER', 'STORE_MANAGER')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_membership_user UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_memberships_user ON public.company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_company_memberships_company_role ON public.company_memberships(company_id, role);

-- --------------------------------------------------------------------
-- 4. Retail Master Tables
-- --------------------------------------------------------------------

-- 4.1 Stores Table
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'Supercenter',
    total_skus INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stores_user_code UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);

-- 4.2 Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    avg_daily_demand NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    min_stock_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_user_sku UNIQUE (user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- 4.3 Store Assignments Table (Strict Store Manager binding)
CREATE TABLE IF NOT EXISTS public.store_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_user_assignment UNIQUE (store_id, user_id),
    CONSTRAINT fk_store_assignments_user_membership
        FOREIGN KEY (company_id, user_id) REFERENCES public.company_memberships(company_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_store_assignments_user ON public.store_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_store_assignments_store ON public.store_assignments(store_id);

-- 4.4 Invitations Table (Hashed Tokens, Single-Use)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    role TEXT NOT NULL CHECK (role IN ('COMPANY_MANAGER', 'STORE_MANAGER')),
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_store_invite_consistency CHECK (role <> 'STORE_MANAGER' OR store_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_company_status ON public.invitations(company_id, status);

-- --------------------------------------------------------------------
-- 5. Operational Telemetry Tables
-- --------------------------------------------------------------------

-- 5.1 Daily Sales Table
CREATE TABLE IF NOT EXISTS public.daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_sales_company_store_date ON public.daily_sales(company_id, store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON public.daily_sales(store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON public.daily_sales(sku, date);

-- 5.2 Inventory Snapshots Table
CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    date DATE NOT NULL,
    on_hand_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_user_store_sku_date UNIQUE (user_id, store_id, sku, date)
);

CREATE INDEX IF NOT EXISTS idx_inv_company_store_date ON public.inventory_snapshots(company_id, store_id, date);
CREATE INDEX IF NOT EXISTS idx_inv_store_date ON public.inventory_snapshots(store_id, date);
CREATE INDEX IF NOT EXISTS idx_inv_sku_date ON public.inventory_snapshots(sku, date);

-- 5.3 Promotions Table
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    promo_type TEXT NOT NULL DEFAULT 'DISCOUNT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_company_id ON public.promotions(company_id);
CREATE INDEX IF NOT EXISTS idx_promotions_store_sku ON public.promotions(store_id, sku);

-- --------------------------------------------------------------------
-- 6. Detection Runs & Alerts Tables
-- --------------------------------------------------------------------

-- 6.1 Detection Runs Table
CREATE TABLE IF NOT EXISTS public.detection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_runs_company_date ON public.detection_runs(company_id, run_date DESC);

-- 6.2 Alerts Table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    run_id UUID REFERENCES public.detection_runs(id) ON DELETE SET NULL,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
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
    poisson_anomaly_p NUMERIC(8, 5) NOT NULL DEFAULT 1.00000,
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

CREATE INDEX IF NOT EXISTS idx_alerts_company_store ON public.alerts(company_id, store_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status_risk ON public.alerts(status, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- 6.3 Verification Audit Log Table
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    outcome TEXT,
    shelf_count INTEGER,
    notes TEXT,
    changed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_alert_id ON public.verification_audit_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_audit_company_date ON public.verification_audit_log(company_id, created_at DESC);

-- 6.4 Import Jobs Table
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    records_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 7. Conversational AI Persistence Tables
-- --------------------------------------------------------------------

-- 7.1 Chat Conversations Table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
    ON public.chat_conversations(user_id, updated_at DESC);

-- 7.2 Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
    ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
    ON public.chat_messages(user_id);

-- --------------------------------------------------------------------
-- 8. Hardened Authorization Functions
-- --------------------------------------------------------------------

-- 8.1 Is Platform Administrator
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_administrators
        WHERE user_id = auth.uid()
    );
$$;

-- 8.2 Get User Company Role
CREATE OR REPLACE FUNCTION public.get_user_company_role(cid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.company_memberships
    WHERE company_id = cid
      AND user_id = auth.uid()
      AND status = 'ACTIVE'
    LIMIT 1;
$$;

-- 8.3 Can Access Company
CREATE OR REPLACE FUNCTION public.can_access_company(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.company_memberships
            WHERE company_id = cid
              AND user_id = auth.uid()
              AND status = 'ACTIVE'
        );
$$;

-- 8.4 Can Access Store
CREATE OR REPLACE FUNCTION public.can_access_store(sid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.stores s
            JOIN public.company_memberships cm ON cm.company_id = s.company_id
            WHERE s.id = sid
              AND cm.user_id = auth.uid()
              AND cm.status = 'ACTIVE'
              AND cm.role = 'COMPANY_MANAGER'
        )
        OR EXISTS (
            SELECT 1 FROM public.store_assignments sa
            JOIN public.company_memberships cm ON cm.company_id = sa.company_id AND cm.user_id = sa.user_id
            WHERE sa.store_id = sid
              AND sa.user_id = auth.uid()
              AND cm.status = 'ACTIVE'
        );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_company_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_company_role(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_company(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_company(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_store(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_store(UUID) TO authenticated, service_role;

-- --------------------------------------------------------------------
-- 9. Transactional Stored Procedures
-- --------------------------------------------------------------------

-- 9.1 Onboard Company Transaction
CREATE OR REPLACE FUNCTION public.onboard_company_transaction(
    p_company_name TEXT,
    p_company_slug TEXT,
    p_store_name TEXT,
    p_store_code TEXT,
    p_store_location TEXT,
    p_store_type TEXT DEFAULT 'Supercenter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_clean_name TEXT := trim(p_company_name);
    v_clean_slug TEXT := lower(trim(p_company_slug));
    v_clean_store_name TEXT := trim(p_store_name);
    v_clean_store_code TEXT := upper(trim(p_store_code));
    v_clean_location TEXT := trim(p_store_location);
    v_new_company_id UUID;
    v_new_store_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to onboard a company.' USING ERRCODE = '42501';
    END IF;

    IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 100 THEN
        RAISE EXCEPTION 'Company name must be between 2 and 100 characters.' USING ERRCODE = '22023';
    END IF;

    IF NOT (v_clean_slug ~ '^[a-z0-9-]+$') OR char_length(v_clean_slug) < 3 OR char_length(v_clean_slug) > 60 THEN
        RAISE EXCEPTION 'Company slug must contain only lowercase alphanumeric characters and hyphens (3-60 chars).' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = v_caller_id) THEN
        RAISE EXCEPTION 'User is already associated with an existing company.' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (SELECT 1 FROM public.companies WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'Company identifier slug is already registered. Please choose another.' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.companies (name, slug, status, created_by)
    VALUES (v_clean_name, v_clean_slug, 'ACTIVE', v_caller_id)
    RETURNING id INTO v_new_company_id;

    INSERT INTO public.company_memberships (company_id, user_id, role, status)
    VALUES (v_new_company_id, v_caller_id, 'COMPANY_MANAGER', 'ACTIVE');

    INSERT INTO public.stores (user_id, company_id, code, name, location, store_type, total_skus)
    VALUES (v_caller_id, v_new_company_id, v_clean_store_code, v_clean_store_name, v_clean_location, p_store_type, 30)
    RETURNING id INTO v_new_store_id;

    INSERT INTO public.store_assignments (company_id, store_id, user_id, assigned_by)
    VALUES (v_new_company_id, v_new_store_id, v_caller_id, v_caller_id);

    RETURN jsonb_build_object(
        'success', true,
        'company_id', v_new_company_id,
        'company_name', v_clean_name,
        'company_slug', v_clean_slug,
        'store_id', v_new_store_id,
        'store_name', v_clean_store_name,
        'role', 'COMPANY_MANAGER'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_company_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboard_company_transaction(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 9.2 Accept Invitation Stored Procedure
CREATE OR REPLACE FUNCTION public.accept_invitation(
    p_token_hash TEXT
)
RETURNS TABLE (
    company_id UUID,
    store_id UUID,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
#variable_conflict use_column
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_email TEXT := (SELECT email FROM auth.users WHERE id = v_caller_id);
    v_inv RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to accept an invitation.' USING ERRCODE = '42501';
    END IF;

    SELECT id, company_id, store_id, email, role, status, expires_at
    INTO v_inv
    FROM public.invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found or invalid token.' USING ERRCODE = 'P0002';
    END IF;

    IF v_inv.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Invitation is no longer active (status: %).', v_inv.status USING ERRCODE = '22023';
    END IF;

    IF v_inv.expires_at < NOW() THEN
        UPDATE public.invitations SET status = 'EXPIRED' WHERE id = v_inv.id;
        RAISE EXCEPTION 'Invitation has expired.' USING ERRCODE = '22023';
    END IF;

    IF lower(trim(v_caller_email)) <> lower(trim(v_inv.email)) THEN
        RAISE EXCEPTION 'This invitation was addressed to %, not %.', v_inv.email, v_caller_email USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.company_memberships (company_id, user_id, role, status)
    VALUES (v_inv.company_id, v_caller_id, v_inv.role, 'ACTIVE')
    ON CONFLICT (company_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'ACTIVE',
        updated_at = NOW();

    IF v_inv.role = 'STORE_MANAGER' AND v_inv.store_id IS NOT NULL THEN
        INSERT INTO public.store_assignments (company_id, store_id, user_id, assigned_by)
        VALUES (v_inv.company_id, v_inv.store_id, v_caller_id, v_caller_id)
        ON CONFLICT (store_id, user_id) DO NOTHING;
    END IF;

    UPDATE public.invitations
    SET status = 'ACCEPTED', accepted_at = NOW()
    WHERE id = v_inv.id;

    RETURN QUERY
    SELECT v_inv.company_id, v_inv.store_id, v_inv.role;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated, service_role;

-- --------------------------------------------------------------------
-- 10. Row-Level Security (RLS) Policies
-- --------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Users manage own profile; Admins see all
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Companies: Members see their own company; Admins see all
DROP POLICY IF EXISTS "Users view accessible companies" ON public.companies;
CREATE POLICY "Users view accessible companies" ON public.companies
    FOR SELECT TO authenticated
    USING (public.can_access_company(id));

-- Stores: Scoped by can_access_store
DROP POLICY IF EXISTS "Users access stores" ON public.stores;
CREATE POLICY "Users access stores" ON public.stores
    FOR SELECT TO authenticated
    USING (public.can_access_store(id) OR (company_id IS NULL AND user_id = auth.uid()));

-- Products: Scoped by can_access_company
DROP POLICY IF EXISTS "Users access products" ON public.products;
CREATE POLICY "Users access products" ON public.products
    FOR ALL TO authenticated
    USING (public.can_access_company(company_id) OR (company_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (public.can_access_company(company_id) OR (company_id IS NULL AND user_id = auth.uid()));

-- Daily Sales & Inventory: Scoped strictly by can_access_store
DROP POLICY IF EXISTS "Users access daily sales" ON public.daily_sales;
CREATE POLICY "Users access daily sales" ON public.daily_sales
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users access inventory snapshots" ON public.inventory_snapshots;
CREATE POLICY "Users access inventory snapshots" ON public.inventory_snapshots
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()));

-- Alerts & Audit Log: Scoped strictly by can_access_store
DROP POLICY IF EXISTS "Users access alerts" ON public.alerts;
CREATE POLICY "Users access alerts" ON public.alerts
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (public.can_access_store(store_id) OR (company_id IS NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users access audit logs" ON public.verification_audit_log;
CREATE POLICY "Users access audit logs" ON public.verification_audit_log
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = verification_audit_log.alert_id AND public.can_access_store(a.store_id))
        OR (company_id IS NULL AND user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = verification_audit_log.alert_id AND public.can_access_store(a.store_id))
        OR (company_id IS NULL AND user_id = auth.uid())
    );

-- Chat: Strictly scoped by auth.uid() = user_id
DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;
CREATE POLICY "Users access own chat conversations" ON public.chat_conversations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;
CREATE POLICY "Users access own chat messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()));

