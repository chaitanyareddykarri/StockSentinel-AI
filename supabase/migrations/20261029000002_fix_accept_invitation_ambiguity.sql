-- ==============================================================================
-- StockSentinel AI — Migration 6: Fix Ambiguous Column References in accept_invitation
-- File: supabase/migrations/20261029000002_fix_accept_invitation_ambiguity.sql
-- Date: 2026-10-29
--
-- Description:
-- Resolves PostgreSQL error: column reference "company_id" is ambiguous (SQLSTATE 42702)
-- when accepting an invitation via public.accept_invitation(p_token_hash).
--
-- Root Cause:
-- The function signature `RETURNS TABLE (company_id UUID, store_id UUID, role TEXT)`
-- defines output variables in PL/pgSQL scope named `company_id`, `store_id`, and `role`.
-- In default PL/pgSQL variable conflict mode (#variable_conflict error), evaluating
-- `ON CONFLICT (company_id, user_id)` on public.company_memberships and
-- `ON CONFLICT (store_id, user_id)` on public.store_assignments encounters an ambiguity
-- between the table column names and the function output variables.
--
-- Resolution:
-- Adds `#variable_conflict use_column` to direct the PL/pgSQL compiler to resolve
-- unqualified column references in SQL statements to the table columns. Preserves the
-- exact return contract (company_id, store_id, role), single-use row lock (FOR UPDATE),
-- verified email match, active company status check, and single-store scoping.
--
-- Execution:
-- Safe to execute idempotently in the Supabase staging / production SQL Editor.
-- Does not alter table schemas, delete records, or modify existing memberships.
-- ==============================================================================

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

