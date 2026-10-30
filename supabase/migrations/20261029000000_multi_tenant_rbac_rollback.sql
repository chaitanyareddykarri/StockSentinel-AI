-- ====================================================================
-- StockSentinel AI — PostgreSQL / Supabase Schema Rollback Script
-- Rollback for: 20261029000000_multi_tenant_rbac_schema.sql (v3.3.0)
-- Description: Cleanly reverses all additions from Stage 1 multi-tenant RBAC migration,
-- restoring original single-user RLS policies, schemas, and constraints without
-- corrupting pre-existing user data.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. Revert RLS Policies to Original Single-User State
-- --------------------------------------------------------------------

-- 1.1 Chat Messages
DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users access authorized chat messages" ON public.chat_messages;
CREATE POLICY "Users access own chat messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    );

-- 1.2 Chat Conversations
DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users access authorized chat conversations" ON public.chat_conversations;
CREATE POLICY "Users access own chat conversations" ON public.chat_conversations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.3 Promotions
DROP POLICY IF EXISTS "Users access own promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users access authorized promotions" ON public.promotions;
CREATE POLICY "Users access own promotions" ON public.promotions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.4 Verification Audit Log
DROP POLICY IF EXISTS "Users access own audit logs" ON public.verification_audit_log;
DROP POLICY IF EXISTS "Users access company audit logs" ON public.verification_audit_log;
CREATE POLICY "Users access own audit logs" ON public.verification_audit_log
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.5 Detection Runs
DROP POLICY IF EXISTS "Users access own detection runs" ON public.detection_runs;
DROP POLICY IF EXISTS "Users access company detection runs" ON public.detection_runs;
CREATE POLICY "Users access own detection runs" ON public.detection_runs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.6 Alerts
DROP POLICY IF EXISTS "Users access own alerts" ON public.alerts;
DROP POLICY IF EXISTS "Users access authorized store alerts" ON public.alerts;
CREATE POLICY "Users access own alerts" ON public.alerts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.7 Inventory Snapshots
DROP POLICY IF EXISTS "Users access own inventory" ON public.inventory_snapshots;
DROP POLICY IF EXISTS "Users access authorized store inventory" ON public.inventory_snapshots;
CREATE POLICY "Users access own inventory" ON public.inventory_snapshots
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.8 Daily Sales
DROP POLICY IF EXISTS "Users access own sales" ON public.daily_sales;
DROP POLICY IF EXISTS "Users access authorized store sales" ON public.daily_sales;
CREATE POLICY "Users access own sales" ON public.daily_sales
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.9 Products
DROP POLICY IF EXISTS "Users access own products" ON public.products;
DROP POLICY IF EXISTS "Users access company products" ON public.products;
DROP POLICY IF EXISTS "Products manageable by company manager and platform admin" ON public.products;
CREATE POLICY "Users access own products" ON public.products
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.10 Stores
DROP POLICY IF EXISTS "Users access own stores" ON public.stores;
DROP POLICY IF EXISTS "Users access authorized stores" ON public.stores;
DROP POLICY IF EXISTS "Stores insertable by company manager within store limit" ON public.stores;
DROP POLICY IF EXISTS "Stores insertable by company manager and platform admin" ON public.stores;
DROP POLICY IF EXISTS "Stores updatable by company manager and platform admin" ON public.stores;
DROP POLICY IF EXISTS "Stores deletable by company manager and platform admin" ON public.stores;
CREATE POLICY "Users access own stores" ON public.stores
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1.11 Import Jobs
DROP POLICY IF EXISTS "Users access own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users access authorized import jobs" ON public.import_jobs;
CREATE POLICY "Users access own import jobs" ON public.import_jobs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 2. Drop Multi-Tenant RLS Policies on Added Tables
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Invitations viewable by company manager and platform admin" ON public.invitations;
DROP POLICY IF EXISTS "Invitations insertable by company manager and platform admin" ON public.invitations;
DROP POLICY IF EXISTS "Invitations modifiable by company manager and platform admin" ON public.invitations;
DROP POLICY IF EXISTS "Invitations deletable by company manager and platform admin" ON public.invitations;

DROP POLICY IF EXISTS "Assignments viewable by assignee, company manager, and platform admin" ON public.store_assignments;
DROP POLICY IF EXISTS "Assignments manageable by company manager and platform admin" ON public.store_assignments;

DROP POLICY IF EXISTS "Memberships viewable by member, company manager, and platform admin" ON public.company_memberships;
DROP POLICY IF EXISTS "Memberships insertable by company manager and platform admin" ON public.company_memberships;
DROP POLICY IF EXISTS "Memberships updatable by company manager and platform admin" ON public.company_memberships;
DROP POLICY IF EXISTS "Memberships deletable by company manager and platform admin" ON public.company_memberships;

DROP POLICY IF EXISTS "Platform admins viewable only by admins" ON public.platform_administrators;
DROP POLICY IF EXISTS "Platform admins modifiable only by admins" ON public.platform_administrators;

DROP POLICY IF EXISTS "Companies viewable by authorized members and admins" ON public.companies;
DROP POLICY IF EXISTS "Companies modifiable by company manager and platform admin" ON public.companies;
DROP POLICY IF EXISTS "Companies deletable only by platform admin" ON public.companies;

-- --------------------------------------------------------------------
-- 3. Drop Triggers on Base Tables
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_company_update ON public.companies;
DROP TRIGGER IF EXISTS trg_enforce_store_limit ON public.stores;

-- --------------------------------------------------------------------
-- 4. Drop Compound Foreign Keys & Constraints
-- --------------------------------------------------------------------
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS fk_promotions_store_company;
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS fk_invitations_store_company;
ALTER TABLE public.store_assignments DROP CONSTRAINT IF EXISTS fk_store_assignments_user_membership;
ALTER TABLE public.store_assignments DROP CONSTRAINT IF EXISTS fk_store_assignments_store_company;
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS fk_alerts_store_company;
ALTER TABLE public.inventory_snapshots DROP CONSTRAINT IF EXISTS fk_inv_store_company;
ALTER TABLE public.daily_sales DROP CONSTRAINT IF EXISTS fk_daily_sales_store_company;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS uq_stores_id_company;

-- --------------------------------------------------------------------
-- 5. Drop Added Views & Indexes
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.legacy_unassigned_stores;

DROP INDEX IF EXISTS public.idx_chat_conv_store;
DROP INDEX IF EXISTS public.idx_chat_conv_company;
DROP INDEX IF EXISTS public.idx_promotions_company_store;
DROP INDEX IF EXISTS public.idx_audit_company;
DROP INDEX IF EXISTS public.idx_detection_runs_company;
DROP INDEX IF EXISTS public.idx_alerts_company_store_status;
DROP INDEX IF EXISTS public.idx_inv_company_store_date;
DROP INDEX IF EXISTS public.idx_sales_company_store_date;
DROP INDEX IF EXISTS public.idx_products_company_id;
DROP INDEX IF EXISTS public.idx_stores_company_id;
DROP INDEX IF EXISTS public.idx_import_jobs_company;

-- --------------------------------------------------------------------
-- 6. Drop Added Columns on Retail Tables
-- --------------------------------------------------------------------
ALTER TABLE public.import_jobs DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS store_id;
ALTER TABLE public.chat_conversations DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.promotions DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.verification_audit_log DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.detection_runs DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.alerts DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.inventory_snapshots DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.daily_sales DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.products DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.stores DROP COLUMN IF EXISTS status;
ALTER TABLE public.stores DROP COLUMN IF EXISTS company_id;

-- --------------------------------------------------------------------
-- 7. Drop Functions
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.enforce_store_creation_limits();
DROP FUNCTION IF EXISTS public.enforce_company_update_permissions();
DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);
DROP FUNCTION IF EXISTS public.onboard_company(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.can_access_store(UUID);
DROP FUNCTION IF EXISTS public.can_access_company(UUID);
DROP FUNCTION IF EXISTS public.get_user_company_role(UUID);
DROP FUNCTION IF EXISTS public.is_platform_admin();

-- --------------------------------------------------------------------
-- 8. Drop Multi-Tenant Core Tables (in reverse dependency order)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.store_assignments CASCADE;
DROP TABLE IF EXISTS public.company_memberships CASCADE;
DROP TABLE IF EXISTS public.platform_administrators CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

COMMIT;

