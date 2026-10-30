-- ====================================================================
-- StockSentinel AI — PostgreSQL / Supabase Schema Migration
-- Migration: 20261029000000_multi_tenant_rbac_schema.sql
-- Version: 3.5.0 (Hardened Multi-Tenant Role-Based Architecture)
-- Description: Establishes company-level multi-tenancy, platform administration,
-- trusted company memberships, store assignments, single-use manager invitations,
-- caller-anchored authorization functions, active status enforcement, store-isolated RLS,
-- concurrent store limit serialization, non-recursive RLS policies, and anti-privilege-escalation triggers.
-- Transactional & Rerunnable Execution with Correct Object Dependency Ordering.
-- ====================================================================

BEGIN;

-- Enable necessary cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. Core Multi-Tenant Tables
-- ====================================================================

-- 1.1 Companies Table (Enterprise Tenant Root)
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
CREATE INDEX IF NOT EXISTS idx_companies_is_demo ON public.companies(is_demo);

-- 1.2 Platform Administrators Table
-- An account ONLY gains platform admin authority if explicitly inserted here.
-- Standard registration and OAuth NEVER insert into this table.
CREATE TABLE IF NOT EXISTS public.platform_administrators (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Company Memberships Table
-- Binds users to companies with trusted server-side roles (COMPANY_MANAGER, STORE_MANAGER).
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

-- 1.4 Store Assignments Table
-- Strictly assigns Store Managers to individual stores.
-- Enforces compound consistency: user must belong to company, and store must belong to company.
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

-- 1.5 Invitations Table
-- Secure pending invitations. Stores only SHA-256 token hashes, never raw tokens or passwords.
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    role TEXT NOT NULL CHECK (role IN ('COMPANY_MANAGER', 'STORE_MANAGER')),
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_store_invite_consistency CHECK (role <> 'STORE_MANAGER' OR store_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_company_status ON public.invitations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);

-- ====================================================================
-- 2. Demonstration Workspace & Retail Schema Evolution
-- ====================================================================

-- 2.1 Seed Default Demo Company
-- Isolates verified demonstration data under an explicit demo company.
INSERT INTO public.companies (
    id, name, slug, status, max_stores, is_demo, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'StockSentinel Demo Retail Group',
    'stocksentinel-demo',
    'ACTIVE',
    10,
    TRUE,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    is_demo = TRUE,
    updated_at = NOW();

-- 2.2 Stores Table Evolution & Backfill
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Backfill ONLY verified demo stores (stores explicitly linked to verified demo alerts or demo detection runs)
UPDATE public.stores
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE company_id IS NULL
  AND id IN (
      SELECT DISTINCT store_id FROM public.alerts WHERE is_demo = TRUE
      UNION
      SELECT DISTINCT s.id FROM public.stores s
      JOIN public.detection_runs dr ON dr.store_id = s.id::text OR dr.store_id = s.code
      WHERE dr.is_demo = TRUE
  );

-- Enforce compound uniqueness on (id, company_id) for multi-table foreign keys
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS uq_stores_id_company;
ALTER TABLE public.stores ADD CONSTRAINT uq_stores_id_company UNIQUE (id, company_id);

CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);

-- 2.3 Compound Foreign Keys on Added Tables (Depend on uq_stores_id_company)
ALTER TABLE public.store_assignments DROP CONSTRAINT IF EXISTS fk_store_assignments_store_company;
ALTER TABLE public.store_assignments ADD CONSTRAINT fk_store_assignments_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS fk_invitations_store_company;
ALTER TABLE public.invitations ADD CONSTRAINT fk_invitations_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

-- 2.4 Products Table Evolution
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Backfill products linked to verified demo stores
UPDATE public.products p
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE p.company_id IS NULL
  AND p.id IN (SELECT DISTINCT product_id FROM public.alerts WHERE is_demo = TRUE);

CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);

-- 2.5 Daily Sales Table Evolution
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.daily_sales ds
SET company_id = s.company_id
FROM public.stores s
WHERE ds.store_id = s.id AND s.company_id IS NOT NULL AND ds.company_id IS NULL;

ALTER TABLE public.daily_sales DROP CONSTRAINT IF EXISTS fk_daily_sales_store_company;
ALTER TABLE public.daily_sales ADD CONSTRAINT fk_daily_sales_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sales_company_store_date ON public.daily_sales(company_id, store_id, date);

-- 2.6 Inventory Snapshots Table Evolution
ALTER TABLE public.inventory_snapshots ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.inventory_snapshots inv
SET company_id = s.company_id
FROM public.stores s
WHERE inv.store_id = s.id AND s.company_id IS NOT NULL AND inv.company_id IS NULL;

ALTER TABLE public.inventory_snapshots DROP CONSTRAINT IF EXISTS fk_inv_store_company;
ALTER TABLE public.inventory_snapshots ADD CONSTRAINT fk_inv_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inv_company_store_date ON public.inventory_snapshots(company_id, store_id, date);

-- 2.7 Alerts Table Evolution
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.alerts a
SET company_id = s.company_id
FROM public.stores s
WHERE a.store_id = s.id AND s.company_id IS NOT NULL AND a.company_id IS NULL;

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS fk_alerts_store_company;
ALTER TABLE public.alerts ADD CONSTRAINT fk_alerts_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_alerts_company_store_status ON public.alerts(company_id, store_id, status);

-- 2.8 Detection Runs Table Evolution
ALTER TABLE public.detection_runs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.detection_runs
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE is_demo = TRUE AND company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_detection_runs_company ON public.detection_runs(company_id);

-- 2.9 Verification Audit Log Table Evolution
ALTER TABLE public.verification_audit_log ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.verification_audit_log val
SET company_id = a.company_id
FROM public.alerts a
WHERE val.alert_id = a.id AND a.company_id IS NOT NULL AND val.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_company ON public.verification_audit_log(company_id);

-- 2.10 Promotions Table Evolution
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.promotions p
SET company_id = s.company_id
FROM public.stores s
WHERE p.store_id = s.id AND s.company_id IS NOT NULL AND p.company_id IS NULL;

ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS fk_promotions_store_company;
ALTER TABLE public.promotions ADD CONSTRAINT fk_promotions_store_company
    FOREIGN KEY (store_id, company_id) REFERENCES public.stores(id, company_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_promotions_company_store ON public.promotions(company_id, store_id);

-- 2.11 Chat Conversations Table Evolution
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conv_company ON public.chat_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_store ON public.chat_conversations(store_id);

-- 2.12 Import Jobs Table Evolution
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_import_jobs_company ON public.import_jobs(company_id);

-- ====================================================================
-- 3. Caller-Anchored Authorization Helpers (Zero Arbitrary User Arguments)
-- MUST BE CREATED BEFORE VIEWS, FUNCTIONS, OR POLICIES THAT CALL THEM
-- ====================================================================

-- 3.1 Check Caller Platform Admin Status (Anchored strictly to auth.uid())
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT COALESCE(
        (SELECT TRUE FROM public.platform_administrators WHERE user_id = auth.uid()),
        FALSE
    );
$$;

-- 3.2 Retrieve Caller Company Role (Anchored strictly to auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_company_role(cid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT role FROM public.company_memberships
    WHERE company_id = cid
      AND user_id = auth.uid()
      AND status = 'ACTIVE'
    LIMIT 1;
$$;

-- 3.3 Validate Caller Company Access Authority (Anchored strictly to auth.uid())
CREATE OR REPLACE FUNCTION public.can_access_company(cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT (
        public.is_platform_admin()
        OR EXISTS (
            SELECT 1 FROM public.company_memberships
            WHERE company_id = cid
              AND user_id = auth.uid()
              AND status = 'ACTIVE'
        )
    );
$$;

-- 3.4 Validate Caller Store Access Authority (Anchored strictly to auth.uid())
-- Strictly verifies that membership is ACTIVE and supports legacy stores.
CREATE OR REPLACE FUNCTION public.can_access_store(sid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT (
        public.is_platform_admin()
        OR EXISTS (
            -- Company Manager has access to all stores under their company while membership is ACTIVE
            SELECT 1 FROM public.stores s
            JOIN public.company_memberships cm ON cm.company_id = s.company_id
            WHERE s.id = sid
              AND cm.user_id = auth.uid()
              AND cm.role = 'COMPANY_MANAGER'
              AND cm.status = 'ACTIVE'
        )
        OR EXISTS (
            -- Store Manager has access strictly to their assigned store while membership is ACTIVE
            SELECT 1 FROM public.store_assignments sa
            JOIN public.company_memberships cm ON cm.company_id = sa.company_id AND cm.user_id = sa.user_id
            WHERE sa.store_id = sid
              AND sa.user_id = auth.uid()
              AND cm.status = 'ACTIVE'
        )
        OR EXISTS (
            -- Legacy unassigned store access strictly for original creator
            SELECT 1 FROM public.stores s
            WHERE s.id = sid
              AND s.company_id IS NULL
              AND s.user_id = auth.uid()
        )
    );
$$;

-- Restrict execution permissions strictly to authenticated callers
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_company_role(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_company_role(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_company(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_company(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_store(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_store(UUID) TO authenticated, service_role;

-- ====================================================================
-- 4. Views for Legacy Data (Depends on public.is_platform_admin())
-- ====================================================================

-- 4.1 View for Unidentified Legacy Stores
-- Hardened with security_invoker = true and strict ownership restriction
CREATE OR REPLACE VIEW public.legacy_unassigned_stores
WITH (security_invoker = true)
AS
SELECT s.id, s.user_id, s.code, s.name, s.location, s.store_type, s.created_at
FROM public.stores s
WHERE s.company_id IS NULL
  AND (public.is_platform_admin() OR s.user_id = auth.uid());

REVOKE ALL ON public.legacy_unassigned_stores FROM PUBLIC;
GRANT SELECT ON public.legacy_unassigned_stores TO authenticated, service_role;

-- ====================================================================
-- 5. Business Operations Functions & Hardened Security Triggers
-- ====================================================================

-- 5.1 Anti-Privilege-Escalation Trigger on Companies
-- Prevents non-platform-admins from mutating max_stores, is_demo, or created_by.
-- Completely eliminates recursive RLS risks from the Companies UPDATE policy.
CREATE OR REPLACE FUNCTION public.enforce_company_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Platform administrators are authorized to update tier limits, demo status, etc.
    IF NOT public.is_platform_admin() THEN
        IF NEW.max_stores IS DISTINCT FROM OLD.max_stores THEN
            RAISE EXCEPTION 'Only platform administrators can modify company max_stores.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
            RAISE EXCEPTION 'Only platform administrators can modify company is_demo flag.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'Cannot modify company creator.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Cannot modify company identifier.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_company_update_permissions() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_company_update ON public.companies;
CREATE TRIGGER trg_enforce_company_update
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_company_update_permissions();

-- 5.2 Concurrent Store Limit Enforcement Trigger on Stores
-- Serializes store creation attempts per company by acquiring a row lock (FOR UPDATE)
-- on the parent company, guaranteeing that concurrent inserts cannot exceed max_stores.
-- Also enforces tenant integrity against direct database/API inserts.
CREATE OR REPLACE FUNCTION public.enforce_store_creation_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_max_stores INTEGER;
    v_current_stores INTEGER;
BEGIN
    -- Platform administrators bypass store limits
    IF public.is_platform_admin() THEN
        RETURN NEW;
    END IF;

    -- Legacy stores without company are allowed for backwards compatibility
    IF NEW.company_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- If user_id is not set, default to auth.uid()
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;

    -- Row-level lock on the parent company serializes concurrent additions for this tenant
    SELECT max_stores INTO v_max_stores
    FROM public.companies
    WHERE id = NEW.company_id
    FOR UPDATE;

    IF v_max_stores IS NULL THEN
        RAISE EXCEPTION 'Referenced company % does not exist.', NEW.company_id
            USING ERRCODE = '23503';
    END IF;

    SELECT COUNT(*) INTO v_current_stores
    FROM public.stores
    WHERE company_id = NEW.company_id;

    IF v_current_stores >= v_max_stores THEN
        RAISE EXCEPTION 'Company store limit of % has been reached. Upgrade subscription tier to add more stores.', v_max_stores
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_store_creation_limits() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_store_limit ON public.stores;
CREATE TRIGGER trg_enforce_store_limit
    BEFORE INSERT ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_store_creation_limits();

-- 5.3 Transactional Onboarding Database Function
CREATE OR REPLACE FUNCTION public.onboard_company(
    p_name TEXT,
    p_slug TEXT,
    p_max_stores INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_company_id UUID;
    v_clean_slug TEXT;
    v_clean_name TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to onboard a company.' USING ERRCODE = '28000';
    END IF;

    -- Clean and validate inputs
    v_clean_name := trim(p_name);
    v_clean_slug := lower(trim(p_slug));

    IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 100 THEN
        RAISE EXCEPTION 'Company name must be between 2 and 100 characters.' USING ERRCODE = '22023';
    END IF;

    IF v_clean_slug !~ '^[a-z0-9-]+$' OR char_length(v_clean_slug) < 3 OR char_length(v_clean_slug) > 60 THEN
        RAISE EXCEPTION 'Company slug must contain only lowercase letters, digits, and hyphens (3-60 chars).' USING ERRCODE = '22023';
    END IF;

    IF p_max_stores < 1 OR p_max_stores > 20 THEN
        RAISE EXCEPTION 'Standard tier store allocation must be between 1 and 20.' USING ERRCODE = '22023';
    END IF;

    -- Anti-Spam Safeguard: Prevent non-admin users from creating multiple active companies simultaneously
    IF NOT public.is_platform_admin() AND EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE user_id = v_caller_id AND role = 'COMPANY_MANAGER' AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'User is already an active Company Manager for an existing organization.' USING ERRCODE = '23505';
    END IF;

    -- Atomic insertion: Company record + Company Manager membership
    INSERT INTO public.companies (
        name, slug, max_stores, is_demo, created_by, status
    ) VALUES (
        v_clean_name, v_clean_slug, p_max_stores, FALSE, v_caller_id, 'ACTIVE'
    ) RETURNING id INTO v_company_id;

    INSERT INTO public.company_memberships (
        company_id, user_id, role, status
    ) VALUES (
        v_company_id, v_caller_id, 'COMPANY_MANAGER', 'ACTIVE'
    );

    RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.onboard_company(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboard_company(TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- 5.4 Transactional Invitation Acceptance Database Function
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
AS $$
#variable_conflict use_column
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_inv RECORD;
    v_comp_status TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to accept an invitation.' USING ERRCODE = '28000';
    END IF;

    -- Retrieve caller's verified email from auth.users
    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
    IF v_caller_email IS NULL THEN
        RAISE EXCEPTION 'Verified user email record not found.' USING ERRCODE = '28000';
    END IF;

    -- Row-level lock FOR UPDATE on invitation to guarantee single-use concurrency atomicity
    SELECT * INTO v_inv
    FROM public.invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found or invalid token.' USING ERRCODE = '02000';
    END IF;

    IF v_inv.status = 'ACCEPTED' THEN
        RAISE EXCEPTION 'This invitation has already been accepted.' USING ERRCODE = '23505';
    END IF;

    IF v_inv.status = 'EXPIRED' OR v_inv.expires_at < NOW() THEN
        UPDATE public.invitations SET status = 'EXPIRED' WHERE id = v_inv.id;
        RAISE EXCEPTION 'This invitation has expired.' USING ERRCODE = '22007';
    END IF;

    IF v_inv.status = 'REVOKED' THEN
        RAISE EXCEPTION 'This invitation has been revoked.' USING ERRCODE = '22023';
    END IF;

    -- Verify that caller email matches the invited email (case-insensitive)
    IF lower(trim(v_caller_email)) <> lower(trim(v_inv.email)) THEN
        RAISE EXCEPTION 'This invitation was issued to "%". Current user is "%".', v_inv.email, v_caller_email
            USING ERRCODE = '42501';
    END IF;

    -- Verify company is active
    SELECT status INTO v_comp_status FROM public.companies WHERE id = v_inv.company_id;
    IF v_comp_status IS NULL OR v_comp_status = 'SUSPENDED' THEN
        RAISE EXCEPTION 'The organization issuing this invitation is suspended or does not exist.' USING ERRCODE = '42501';
    END IF;

    -- Upsert company membership
    INSERT INTO public.company_memberships (
        company_id, user_id, role, status
    ) VALUES (
        v_inv.company_id, v_caller_id, v_inv.role, 'ACTIVE'
    )
    ON CONFLICT (company_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'ACTIVE',
        updated_at = NOW();

    -- Assign store if Store Manager
    IF v_inv.role = 'STORE_MANAGER' AND v_inv.store_id IS NOT NULL THEN
        INSERT INTO public.store_assignments (
            company_id, store_id, user_id, assigned_by
        ) VALUES (
            v_inv.company_id, v_inv.store_id, v_caller_id, v_inv.invited_by
        )
        ON CONFLICT (store_id, user_id) DO NOTHING;
    END IF;

    -- Mark invitation ACCEPTED atomically
    UPDATE public.invitations
    SET status = 'ACCEPTED',
        accepted_at = NOW()
    WHERE id = v_inv.id;

    RETURN QUERY
    SELECT v_inv.company_id, v_inv.store_id, v_inv.role;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated, service_role;

-- ====================================================================
-- 6. Row-Level Security (RLS) Policies
-- ====================================================================

-- 6.0 Clean Up Legacy Single-User Policies
-- Prevents boolean OR bypasses between legacy single-user rules and hardened multi-tenant RBAC
DROP POLICY IF EXISTS "Users access own stores" ON public.stores;
DROP POLICY IF EXISTS "Users access own products" ON public.products;
DROP POLICY IF EXISTS "Users access own sales" ON public.daily_sales;
DROP POLICY IF EXISTS "Users access own inventory" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Users access own promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users access own detection runs" ON public.detection_runs;
DROP POLICY IF EXISTS "Users access own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users access own audit logs" ON public.verification_audit_log;
DROP POLICY IF EXISTS "Users access own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;

-- 6.1 Companies RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies viewable by authorized members and admins" ON public.companies;
CREATE POLICY "Companies viewable by authorized members and admins" ON public.companies
    FOR SELECT TO authenticated
    USING (public.can_access_company(id));

-- Recursive RLS check eliminated: WITH CHECK strictly delegates to role helper;
-- Column-level restrictions (max_stores, is_demo) are enforced by trg_enforce_company_update
DROP POLICY IF EXISTS "Companies modifiable by company manager and platform admin" ON public.companies;
CREATE POLICY "Companies modifiable by company manager and platform admin" ON public.companies
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR public.get_user_company_role(id) = 'COMPANY_MANAGER'
    )
    WITH CHECK (
        public.is_platform_admin()
        OR public.get_user_company_role(id) = 'COMPANY_MANAGER'
    );

DROP POLICY IF EXISTS "Companies deletable only by platform admin" ON public.companies;
CREATE POLICY "Companies deletable only by platform admin" ON public.companies
    FOR DELETE TO authenticated
    USING (public.is_platform_admin());

-- 6.2 Platform Administrators RLS
ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins viewable only by admins" ON public.platform_administrators;
CREATE POLICY "Platform admins viewable only by admins" ON public.platform_administrators
    FOR SELECT TO authenticated
    USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins modifiable only by admins" ON public.platform_administrators;
CREATE POLICY "Platform admins modifiable only by admins" ON public.platform_administrators
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- 6.3 Company Memberships RLS
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Memberships viewable by member, company manager, and platform admin" ON public.company_memberships;
CREATE POLICY "Memberships viewable by member, company manager, and platform admin" ON public.company_memberships
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    );

DROP POLICY IF EXISTS "Memberships insertable by company manager and platform admin" ON public.company_memberships;
CREATE POLICY "Memberships insertable by company manager and platform admin" ON public.company_memberships
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND role = 'STORE_MANAGER' -- Company Manager cannot grant COMPANY_MANAGER or escalate roles
        )
    );

DROP POLICY IF EXISTS "Memberships updatable by company manager and platform admin" ON public.company_memberships;
CREATE POLICY "Memberships updatable by company manager and platform admin" ON public.company_memberships
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND user_id <> auth.uid() -- Company Manager cannot alter own role/membership
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND user_id <> auth.uid()
            AND role = 'STORE_MANAGER'
        )
    );

DROP POLICY IF EXISTS "Memberships deletable by company manager and platform admin" ON public.company_memberships;
CREATE POLICY "Memberships deletable by company manager and platform admin" ON public.company_memberships
    FOR DELETE TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND user_id <> auth.uid() -- Company Manager cannot delete own membership
        )
    );

-- 6.4 Store Assignments RLS
ALTER TABLE public.store_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assignments viewable by assignee, company manager, and platform admin" ON public.store_assignments;
CREATE POLICY "Assignments viewable by assignee, company manager, and platform admin" ON public.store_assignments
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    );

DROP POLICY IF EXISTS "Assignments manageable by company manager and platform admin" ON public.store_assignments;
CREATE POLICY "Assignments manageable by company manager and platform admin" ON public.store_assignments
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND EXISTS (
                SELECT 1 FROM public.company_memberships cm
                WHERE cm.company_id = store_assignments.company_id
                  AND cm.user_id = store_assignments.user_id
                  AND cm.role = 'STORE_MANAGER'
                  AND cm.status = 'ACTIVE'
            )
        )
    );

-- 6.5 Invitations RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitations viewable by company manager and platform admin" ON public.invitations;
CREATE POLICY "Invitations viewable by company manager and platform admin" ON public.invitations
    FOR SELECT TO authenticated
    USING (
        public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    );

DROP POLICY IF EXISTS "Invitations insertable by company manager and platform admin" ON public.invitations;
CREATE POLICY "Invitations insertable by company manager and platform admin" ON public.invitations
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_platform_admin()
        OR (
            public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
            AND role = 'STORE_MANAGER' -- Company Manager can only invite Store Managers
            AND invited_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Invitations modifiable by company manager and platform admin" ON public.invitations;
CREATE POLICY "Invitations modifiable by company manager and platform admin" ON public.invitations
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    )
    WITH CHECK (
        public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    );

DROP POLICY IF EXISTS "Invitations deletable by company manager and platform admin" ON public.invitations;
CREATE POLICY "Invitations deletable by company manager and platform admin" ON public.invitations
    FOR DELETE TO authenticated
    USING (
        public.is_platform_admin()
        OR public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
    );

-- 6.6 Stores RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access authorized stores" ON public.stores;
CREATE POLICY "Users access authorized stores" ON public.stores
    FOR SELECT TO authenticated
    USING (public.can_access_store(id));

-- Non-recursive Stores INSERT policy:
-- Replaces recursive COUNT(*) and subquery against public.stores.
-- Strict tenant boundary: Company Manager can only insert into their own company.
-- Quota enforcement and concurrency serialization are delegated to trg_enforce_store_limit.
DROP POLICY IF EXISTS "Stores insertable by company manager within store limit" ON public.stores;
DROP POLICY IF EXISTS "Stores insertable by company manager and platform admin" ON public.stores;
CREATE POLICY "Stores insertable by company manager and platform admin" ON public.stores
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
    );

DROP POLICY IF EXISTS "Stores updatable by company manager and platform admin" ON public.stores;
CREATE POLICY "Stores updatable by company manager and platform admin" ON public.stores
    FOR UPDATE TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Stores deletable by company manager and platform admin" ON public.stores;
CREATE POLICY "Stores deletable by company manager and platform admin" ON public.stores
    FOR DELETE TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

-- 6.7 Products RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access company products" ON public.products;
CREATE POLICY "Users access company products" ON public.products
    FOR SELECT TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Products manageable by company manager and platform admin" ON public.products;
CREATE POLICY "Products manageable by company manager and platform admin" ON public.products
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.get_user_company_role(company_id) = 'COMPANY_MANAGER'
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

-- 6.8 Daily Sales RLS
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access authorized store sales" ON public.daily_sales;
CREATE POLICY "Users access authorized store sales" ON public.daily_sales
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id))
    WITH CHECK (public.can_access_store(store_id));

-- 6.9 Inventory Snapshots RLS
ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access authorized store inventory" ON public.inventory_snapshots;
CREATE POLICY "Users access authorized store inventory" ON public.inventory_snapshots
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id))
    WITH CHECK (public.can_access_store(store_id));

-- 6.10 Alerts RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access authorized store alerts" ON public.alerts;
CREATE POLICY "Users access authorized store alerts" ON public.alerts
    FOR ALL TO authenticated
    USING (public.can_access_store(store_id))
    WITH CHECK (public.can_access_store(store_id));

-- 6.11 Detection Runs RLS
ALTER TABLE public.detection_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access company detection runs" ON public.detection_runs;
CREATE POLICY "Users access company detection runs" ON public.detection_runs
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

-- 6.12 Verification Audit Log RLS
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access company audit logs" ON public.verification_audit_log;
CREATE POLICY "Users access company audit logs" ON public.verification_audit_log
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
        )
    );

-- 6.13 Promotions RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access authorized promotions" ON public.promotions;
CREATE POLICY "Users access authorized promotions" ON public.promotions
    FOR ALL TO authenticated
    USING (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
            AND (store_id IS NULL OR public.can_access_store(store_id))
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
            AND (store_id IS NULL OR public.can_access_store(store_id))
        )
    )
    WITH CHECK (
        public.is_platform_admin()
        OR (
            company_id IS NOT NULL
            AND public.can_access_company(company_id)
            AND (store_id IS NULL OR public.can_access_store(store_id))
        )
        OR (
            company_id IS NULL
            AND user_id = auth.uid()
            AND (store_id IS NULL OR public.can_access_store(store_id))
        )
    );

-- 6.14 Chat Conversations RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users access authorized chat conversations" ON public.chat_conversations;
CREATE POLICY "Users access authorized chat conversations" ON public.chat_conversations
    FOR ALL TO authenticated
    USING (
        auth.uid() = user_id
        AND (company_id IS NULL OR public.can_access_company(company_id))
        AND (store_id IS NULL OR public.can_access_store(store_id))
    )
    WITH CHECK (
        auth.uid() = user_id
        AND (company_id IS NULL OR public.can_access_company(company_id))
        AND (store_id IS NULL OR public.can_access_store(store_id))
    );

-- 6.15 Chat Messages RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users access authorized chat messages" ON public.chat_messages;
CREATE POLICY "Users access authorized chat messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
              AND (c.company_id IS NULL OR public.can_access_company(c.company_id))
              AND (c.store_id IS NULL OR public.can_access_store(c.store_id))
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
              AND (c.company_id IS NULL OR public.can_access_company(c.company_id))
              AND (c.store_id IS NULL OR public.can_access_store(c.store_id))
        )
    );

-- 6.16 Import Jobs RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users access authorized import jobs" ON public.import_jobs;
CREATE POLICY "Users access authorized import jobs" ON public.import_jobs
    FOR ALL TO authenticated
    USING (
        auth.uid() = user_id
        AND (company_id IS NULL OR public.can_access_company(company_id))
    )
    WITH CHECK (
        auth.uid() = user_id
        AND (company_id IS NULL OR public.can_access_company(company_id))
    );

COMMIT;
