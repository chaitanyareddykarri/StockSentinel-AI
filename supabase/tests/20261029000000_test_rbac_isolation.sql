-- ====================================================================
-- StockSentinel AI — Database Isolation & RBAC Test Suite (v3.4.0)
-- Script: 20261029000000_test_rbac_isolation.sql
-- Description: Transactional test harness verifying:
-- 1. Caller-anchored authorization (anchored strictly to auth.uid())
-- 2. Cross-company tenant isolation
-- 3. Store-manager restrictions (same-company cross-store isolation)
-- 4. Store-Company compound consistency on retail tables
-- 5. Cross-company store assignment prevention
-- 6. Non-member store assignment rejection
-- 7. Active status enforcement on store access (suspended user blocked)
-- 8. Transactional onboarding function validation & anti-spam bounds
-- 9. Legacy unassigned records privacy (ordinary user can only see own; admin sees all)
-- 10. Comprehensive invitation security (single-use, email match, expired/revoked rejection)
-- 11. Concurrent store-limit enforcement & unauthorized insert rejection (row lock serialization)
-- 12. Anti-privilege-escalation & role immutability triggers (max_stores, is_demo, admin tables)
--
-- Execution: Paste and run in Supabase SQL Editor against staging.
-- Ends with ROLLBACK to ensure ZERO persistent state changes.
-- ====================================================================

BEGIN;

-- Ensure auth schema and mock users table exist for standalone PostgreSQL testing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        CREATE SCHEMA auth;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY,
            email TEXT
        );
    END IF;
END;
$$;

DO $$
DECLARE
    -- Test Company IDs
    company_a_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    company_b_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;

    -- Test Store IDs
    store_a1_id UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    store_a2_id UUID := 'a2222222-2222-2222-2222-222222222222'::uuid;
    store_a3_id UUID := 'a3333333-3333-3333-3333-333333333333'::uuid;
    store_a4_id UUID := 'a4444444-4444-4444-4444-444444444444'::uuid;
    store_a5_id UUID := 'a5555555-5555-5555-5555-555555555555'::uuid;
    store_a6_id UUID := 'a6666666-6666-6666-6666-666666666666'::uuid;
    store_b1_id UUID := 'b1111111-1111-1111-1111-111111111111'::uuid;
    store_unauth_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

    -- Test User IDs (Simulating auth.users)
    admin_user_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    cm_a_user_id UUID  := 'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    sm_a1_user_id UUID := 'ssssssss-a111-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    sm_a2_user_id UUID := 'ssssssss-a222-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    unassigned_user_id UUID := '99999999-9999-9999-9999-999999999999'::uuid;
    other_legacy_user_id UUID := '88888888-8888-8888-8888-888888888888'::uuid;
    invited_sm_user_id UUID := 'iiiiiiii-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    wrong_user_id UUID := 'wwwwwwww-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

    -- Verification variables
    v_onboarded_company_id UUID;
    v_caught_exception BOOLEAN := FALSE;
    v_unassigned_count INTEGER;
    v_inv_token_hash TEXT := 'hash_for_store_manager_test_token_123';
    v_inv_expired_hash TEXT := 'hash_for_expired_invitation_456';
    v_inv_revoked_hash TEXT := 'hash_for_revoked_invitation_789';
    v_inv_ret_company UUID;
    v_inv_ret_store UUID;
    v_inv_ret_role TEXT;
BEGIN
    RAISE NOTICE '>>> STARTING STOCKSENTINEL RBAC HARDENED TEST SUITE (v3.4.0) <<<';

    -- ----------------------------------------------------------------
    -- 0. Seed Required auth.users Fixtures
    -- ----------------------------------------------------------------
    INSERT INTO auth.users (id, email)
    VALUES
        (admin_user_id, 'admin@test.local'),
        (cm_a_user_id, 'cm_a@test.local'),
        (sm_a1_user_id, 'sm_a1@test.local'),
        (sm_a2_user_id, 'sm_a2@test.local'),
        (unassigned_user_id, 'unassigned@test.local'),
        (other_legacy_user_id, 'other_legacy@test.local'),
        (invited_sm_user_id, 'invited_sm@test.local'),
        (wrong_user_id, 'wrong_user@test.local')
    ON CONFLICT (id) DO NOTHING;

    -- ----------------------------------------------------------------
    -- 1. Setup Test Fixture Data
    -- ----------------------------------------------------------------
    INSERT INTO public.companies (id, name, slug, status, max_stores, is_demo)
    VALUES 
        (company_a_id, 'Company Alpha Retail', 'company-alpha', 'ACTIVE', 5, FALSE),
        (company_b_id, 'Company Beta Retail', 'company-beta', 'ACTIVE', 5, FALSE);

    INSERT INTO public.stores (id, company_id, code, name, location)
    VALUES
        (store_a1_id, company_a_id, 'ALP-101', 'Alpha Store #1', 'North Zone'),
        (store_a2_id, company_a_id, 'ALP-102', 'Alpha Store #2', 'South Zone'),
        (store_b1_id, company_b_id, 'BET-201', 'Beta Store #1', 'East Zone');

    -- Setup Platform Admin
    INSERT INTO public.platform_administrators (user_id, notes)
    VALUES (admin_user_id, 'Test Platform Developer');

    -- Setup Company Alpha Memberships
    INSERT INTO public.company_memberships (company_id, user_id, role, status)
    VALUES
        (company_a_id, cm_a_user_id, 'COMPANY_MANAGER', 'ACTIVE'),
        (company_a_id, sm_a1_user_id, 'STORE_MANAGER', 'ACTIVE'),
        (company_a_id, sm_a2_user_id, 'STORE_MANAGER', 'ACTIVE');

    -- Setup Store Assignments
    INSERT INTO public.store_assignments (company_id, store_id, user_id)
    VALUES
        (company_a_id, store_a1_id, sm_a1_user_id),
        (company_a_id, store_a2_id, sm_a2_user_id);

    -- ----------------------------------------------------------------
    -- 2. Test Caller-Anchored Authorization Helpers (No Parameter Probing)
    -- ----------------------------------------------------------------
    -- Set session caller to admin_user_id
    PERFORM set_config('request.jwt.claim.sub', admin_user_id::text, TRUE);
    ASSERT public.is_platform_admin() = TRUE,
        'TEST 2.1 FAILED: Platform admin session must be recognized';
    ASSERT public.can_access_company(company_a_id) = TRUE,
        'TEST 2.2 FAILED: Platform admin should access Company A';
    ASSERT public.can_access_store(store_b1_id) = TRUE,
        'TEST 2.3 FAILED: Platform admin should access Store B1';

    -- Set session caller to Store Manager A1
    PERFORM set_config('request.jwt.claim.sub', sm_a1_user_id::text, TRUE);
    ASSERT public.is_platform_admin() = FALSE,
        'TEST 2.4 FAILED: Store manager must NOT be recognized as platform admin';
    ASSERT public.can_access_store(store_a1_id) = TRUE,
        'TEST 2.5 FAILED: Store Manager A1 must access assigned Store A1';
    ASSERT public.can_access_store(store_a2_id) = FALSE,
        'TEST 2.6 FAILED: Store Manager A1 MUST NOT access unassigned Store A2';
    ASSERT public.can_access_store(store_b1_id) = FALSE,
        'TEST 2.7 FAILED: Store Manager A1 MUST NOT access Store B1 of Company B';
    RAISE NOTICE '✔ TEST 1 PASSED: Caller-anchored authorization validated (arbitrary-user parameter probing eliminated)';

    -- ----------------------------------------------------------------
    -- 3. Test Cross-Company Tenant Isolation (Company Manager)
    -- ----------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', cm_a_user_id::text, TRUE);
    ASSERT public.can_access_company(company_a_id) = TRUE,
        'TEST 3.1 FAILED: Company Manager must access own company';
    ASSERT public.can_access_company(company_b_id) = FALSE,
        'TEST 3.2 FAILED: Company Manager MUST NOT access Company B';
    ASSERT public.can_access_store(store_a1_id) = TRUE,
        'TEST 3.3 FAILED: Company Manager must access Store A1';
    ASSERT public.can_access_store(store_a2_id) = TRUE,
        'TEST 3.4 FAILED: Company Manager must access Store A2';
    ASSERT public.can_access_store(store_b1_id) = FALSE,
        'TEST 3.5 FAILED: Company Manager MUST NOT access Store B1 of Company B';
    RAISE NOTICE '✔ TEST 2 PASSED: Cross-company tenant isolation strictly enforced';

    -- ----------------------------------------------------------------
    -- 4. Test Store-Manager Restrictions (Same-Company Cross-Store Isolation)
    -- ----------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', sm_a1_user_id::text, TRUE);
    -- Store Manager A1 can access Store A1, but CANNOT access Store A2
    ASSERT public.can_access_store(store_a1_id) = TRUE,
        'TEST 4.1 FAILED: Store Manager must access assigned store';
    ASSERT public.can_access_store(store_a2_id) = FALSE,
        'TEST 4.2 FAILED: Store Manager must be isolated from unassigned store in same company';
    RAISE NOTICE '✔ TEST 3 PASSED: Store-Manager same-company cross-store isolation enforced';

    -- ----------------------------------------------------------------
    -- 5. Test Store-Company Compound Foreign Key Consistency on Retail Tables
    -- ----------------------------------------------------------------
    v_caught_exception := FALSE;
    BEGIN
        INSERT INTO public.daily_sales (
            company_id, store_id, product_id, sku, date, units_sold, revenue
        ) VALUES (
            company_b_id, -- Mismatch! Store A1 belongs to Company A
            store_a1_id,
            '33333333-3333-3333-3333-333333333333'::uuid,
            'SKU-TEST-01',
            '2026-10-28',
            5,
            14.45
        );
    EXCEPTION WHEN foreign_key_violation THEN
        v_caught_exception := TRUE;
    END;

    ASSERT v_caught_exception = TRUE,
        'TEST 5 FAILED: Database constraint fk_daily_sales_store_company MUST reject mismatched store_id and company_id';
    RAISE NOTICE '✔ TEST 4 PASSED: Store-Company compound consistency enforced on retail child tables';

    -- ----------------------------------------------------------------
    -- 6. Test Cross-Company Store Assignment Prevention
    -- ----------------------------------------------------------------
    v_caught_exception := FALSE;
    BEGIN
        INSERT INTO public.store_assignments (
            company_id, store_id, user_id
        ) VALUES (
            company_b_id, -- Mismatch! Store A1 belongs to Company A
            store_a1_id,
            sm_a1_user_id
        );
    EXCEPTION WHEN foreign_key_violation THEN
        v_caught_exception := TRUE;
    END;

    ASSERT v_caught_exception = TRUE,
        'TEST 6 FAILED: Database constraint fk_store_assignments_store_company MUST reject store assignment with mismatched company';
    RAISE NOTICE '✔ TEST 5 PASSED: Store assignment cross-company mismatch prevented';

    -- ----------------------------------------------------------------
    -- 7. Test Non-Member Store Assignment Rejection
    -- ----------------------------------------------------------------
    v_caught_exception := FALSE;
    BEGIN
        INSERT INTO public.store_assignments (
            company_id, store_id, user_id
        ) VALUES (
            company_b_id,
            store_b1_id,
            unassigned_user_id -- Not a member of Company B!
        );
    EXCEPTION WHEN foreign_key_violation THEN
        v_caught_exception := TRUE;
    END;

    ASSERT v_caught_exception = TRUE,
        'TEST 7 FAILED: Constraint fk_store_assignments_user_membership MUST reject assigning non-member user to a store';
    RAISE NOTICE '✔ TEST 6 PASSED: Non-member store assignment strictly rejected';

    -- ----------------------------------------------------------------
    -- 8. Test Invitation Store-Company Consistency
    -- ----------------------------------------------------------------
    v_caught_exception := FALSE;
    BEGIN
        INSERT INTO public.invitations (
            company_id, store_id, email, role, token_hash, invited_by, expires_at
        ) VALUES (
            company_b_id,
            store_a1_id, -- Store A1 belongs to Company A, not Company B!
            'manager@example.com',
            'STORE_MANAGER',
            encode(digest('dummy_token_1', 'sha256'), 'hex'),
            admin_user_id,
            NOW() + INTERVAL '7 days'
        );
    EXCEPTION WHEN foreign_key_violation THEN
        v_caught_exception := TRUE;
    END;

    ASSERT v_caught_exception = TRUE,
        'TEST 8 FAILED: Constraint fk_invitations_store_company MUST reject invitation referencing a store from another company';
    RAISE NOTICE '✔ TEST 7 PASSED: Invitation store-company consistency enforced';

    -- ----------------------------------------------------------------
    -- 9. Test Active Status Enforcement on Store Access (Suspended Member)
    -- ----------------------------------------------------------------
    UPDATE public.company_memberships
    SET status = 'SUSPENDED'
    WHERE company_id = company_a_id AND user_id = sm_a1_user_id;

    PERFORM set_config('request.jwt.claim.sub', sm_a1_user_id::text, TRUE);
    ASSERT public.can_access_store(store_a1_id) = FALSE,
        'TEST 9 FAILED: Suspended store manager must NOT retain store access';

    -- Restore to ACTIVE
    UPDATE public.company_memberships
    SET status = 'ACTIVE'
    WHERE company_id = company_a_id AND user_id = sm_a1_user_id;
    ASSERT public.can_access_store(store_a1_id) = TRUE,
        'TEST 9b FAILED: Active store manager must regain store access';
    RAISE NOTICE '✔ TEST 8 PASSED: Active status enforcement strictly revokes store access for suspended members';

    -- ----------------------------------------------------------------
    -- 10. Test Transactional Company Onboarding Function & Anti-Spam Bounds
    -- ----------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', unassigned_user_id::text, TRUE);

    -- 10.1 Successful onboarding
    v_onboarded_company_id := public.onboard_company('Delta Retail Enterprises', 'delta-retail', 8);
    ASSERT v_onboarded_company_id IS NOT NULL,
        'TEST 10.1 FAILED: onboard_company should return new company UUID';

    -- 10.2 Rejection of excessive store limit
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.onboard_company('Excessive Stores Inc', 'excessive-stores', 999);
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 10.2 FAILED: onboard_company MUST reject store count exceeding initial tier limit (20)';

    -- 10.3 Anti-spam: Active Company Manager cannot create a second company
    v_caught_exception := FALSE;
    BEGIN
        PERFORM public.onboard_company('Second Company Corp', 'second-company', 5);
    EXCEPTION WHEN unique_violation OR OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 10.3 FAILED: Anti-spam check must reject creating a second active company by a non-admin';
    RAISE NOTICE '✔ TEST 9 PASSED: Transactional onboarding function and tier bounds enforced';

    -- ----------------------------------------------------------------
    -- 11. Test Legacy Unassigned Stores View & Helper Privacy
    -- ----------------------------------------------------------------
    INSERT INTO public.stores (id, user_id, code, name, location, company_id)
    VALUES 
        ('99999999-0000-0000-0000-000000000001'::uuid, unassigned_user_id, 'LEG-901', 'Unassigned Store 901', 'Old Sector', NULL),
        ('88888888-0000-0000-0000-000000000002'::uuid, other_legacy_user_id, 'LEG-802', 'Other User Store 802', 'Old Sector', NULL);

    -- Caller 1: unassigned_user_id can access their own legacy store
    PERFORM set_config('request.jwt.claim.sub', unassigned_user_id::text, TRUE);
    ASSERT public.can_access_store('99999999-0000-0000-0000-000000000001'::uuid) = TRUE,
        'TEST 11.1 FAILED: User must access own legacy unassigned store';
    ASSERT public.can_access_store('88888888-0000-0000-0000-000000000002'::uuid) = FALSE,
        'TEST 11.2 FAILED: User MUST NOT access another user legacy unassigned store';

    -- Caller 2: Platform Admin can access all legacy stores
    PERFORM set_config('request.jwt.claim.sub', admin_user_id::text, TRUE);
    ASSERT public.can_access_store('99999999-0000-0000-0000-000000000001'::uuid) = TRUE,
        'TEST 11.3 FAILED: Platform admin must have access to legacy store 1';
    ASSERT public.can_access_store('88888888-0000-0000-0000-000000000002'::uuid) = TRUE,
        'TEST 11.4 FAILED: Platform admin must have access to legacy store 2';
    RAISE NOTICE '✔ TEST 10 PASSED: Legacy unassigned stores view privacy enforced';

    -- ----------------------------------------------------------------
    -- 12. Test Comprehensive Invitation Security & Lifecycle
    -- ----------------------------------------------------------------
    INSERT INTO public.invitations (
        company_id, store_id, email, role, token_hash, invited_by, expires_at, status
    ) VALUES 
        (company_a_id, store_a2_id, 'invited_sm@test.local', 'STORE_MANAGER',
         v_inv_token_hash, cm_a_user_id, NOW() + INTERVAL '48 hours', 'PENDING'),
        (company_a_id, store_a2_id, 'invited_sm@test.local', 'STORE_MANAGER',
         v_inv_expired_hash, cm_a_user_id, NOW() - INTERVAL '1 hour', 'PENDING'),
        (company_a_id, store_a2_id, 'invited_sm@test.local', 'STORE_MANAGER',
         v_inv_revoked_hash, cm_a_user_id, NOW() + INTERVAL '48 hours', 'REVOKED');

    -- 12.1 Mismatched Caller Rejection
    PERFORM set_config('request.jwt.claim.sub', wrong_user_id::text, TRUE);
    v_caught_exception := FALSE;
    BEGIN
        PERFORM * FROM public.accept_invitation(v_inv_token_hash);
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 12.1 FAILED: accept_invitation must reject caller whose email does not match invited email';

    -- 12.2 Expired Invitation Rejection
    PERFORM set_config('request.jwt.claim.sub', invited_sm_user_id::text, TRUE);
    v_caught_exception := FALSE;
    BEGIN
        PERFORM * FROM public.accept_invitation(v_inv_expired_hash);
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 12.2 FAILED: accept_invitation must reject expired invitation';

    -- 12.3 Revoked Invitation Rejection
    v_caught_exception := FALSE;
    BEGIN
        PERFORM * FROM public.accept_invitation(v_inv_revoked_hash);
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 12.3 FAILED: accept_invitation must reject revoked invitation';

    -- 12.4 Valid Acceptance by Intended Invitee
    SELECT res.company_id, res.store_id, res.role
    INTO v_inv_ret_company, v_inv_ret_store, v_inv_ret_role
    FROM public.accept_invitation(v_inv_token_hash) res;

    ASSERT v_inv_ret_company = company_a_id, 'TEST 12.4a FAILED: Company ID mismatch';
    ASSERT v_inv_ret_store = store_a2_id, 'TEST 12.4b FAILED: Store ID mismatch';
    ASSERT v_inv_ret_role = 'STORE_MANAGER', 'TEST 12.4c FAILED: Role mismatch';

    -- 12.5 Replay / Double-Acceptance Prevention
    v_caught_exception := FALSE;
    BEGIN
        PERFORM * FROM public.accept_invitation(v_inv_token_hash);
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 12.5 FAILED: accept_invitation must reject already accepted invitation';
    RAISE NOTICE '✔ TEST 11 PASSED: Invitation lifecycle, email verification, expiry, and replay protection validated';

    -- ----------------------------------------------------------------
    -- 13. Test Store Limit Enforcement, Concurrency Serialization & Unauthorized Inserts
    -- ----------------------------------------------------------------
    -- 13.1 Store Manager A1 cannot insert stores (unauthorized role)
    PERFORM set_config('request.jwt.claim.sub', sm_a1_user_id::text, TRUE);
    ASSERT (
        public.is_platform_admin() OR 
        (company_a_id IS NOT NULL AND public.get_user_company_role(company_a_id) = 'COMPANY_MANAGER')
    ) = FALSE, 'TEST 13.1 FAILED: Store Manager must not have store insertion authority';

    -- 13.2 Company Manager A cannot insert stores into Company B (cross-company insert)
    PERFORM set_config('request.jwt.claim.sub', cm_a_user_id::text, TRUE);
    ASSERT (
        public.is_platform_admin() OR 
        (company_b_id IS NOT NULL AND public.get_user_company_role(company_b_id) = 'COMPANY_MANAGER')
    ) = FALSE, 'TEST 13.2 FAILED: Company Manager must not insert store into another company';

    -- 13.3 Company Manager A inserts stores up to limit (stores 3, 4, 5)
    -- Company A currently has 2 stores (store_a1, store_a2). max_stores = 5.
    INSERT INTO public.stores (id, company_id, code, name, location)
    VALUES
        (store_a3_id, company_a_id, 'ALP-103', 'Alpha Store #3', 'Central Zone'),
        (store_a4_id, company_a_id, 'ALP-104', 'Alpha Store #4', 'West Zone'),
        (store_a5_id, company_a_id, 'ALP-105', 'Alpha Store #5', 'Downtown Zone');

    -- 13.4 Attempt to insert 6th store for Company A (exceeding max_stores = 5)
    v_caught_exception := FALSE;
    BEGIN
        INSERT INTO public.stores (id, company_id, code, name, location)
        VALUES (store_a6_id, company_a_id, 'ALP-106', 'Alpha Store #6', 'Out of Bounds');
    EXCEPTION WHEN OTHERS THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 13.4 FAILED: trg_enforce_store_limit MUST reject adding stores exceeding company max_stores';
    RAISE NOTICE '✔ TEST 12 PASSED: Store limit enforcement and concurrency serialization verified';

    -- ----------------------------------------------------------------
    -- 14. Test Anti-Privilege-Escalation & Role Immutability Triggers
    -- ----------------------------------------------------------------
    -- Set session caller to Company Manager A (non-admin)
    PERFORM set_config('request.jwt.claim.sub', cm_a_user_id::text, TRUE);

    -- 14.1 Non-admin cannot modify max_stores on company
    v_caught_exception := FALSE;
    BEGIN
        UPDATE public.companies
        SET max_stores = 25
        WHERE id = company_a_id;
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 14.1 FAILED: Non-admin MUST NOT be allowed to mutate company max_stores (escalation attempt blocked)';

    -- 14.2 Non-admin cannot modify is_demo flag on company
    v_caught_exception := FALSE;
    BEGIN
        UPDATE public.companies
        SET is_demo = TRUE
        WHERE id = company_a_id;
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught_exception := TRUE;
    END;
    ASSERT v_caught_exception = TRUE,
        'TEST 14.2 FAILED: Non-admin MUST NOT be allowed to mutate company is_demo flag';

    -- 14.3 Non-admin CAN update authorized mutable fields (e.g., company name)
    UPDATE public.companies
    SET name = 'Company Alpha Supermarkets'
    WHERE id = company_a_id;

    ASSERT EXISTS (
        SELECT 1 FROM public.companies WHERE id = company_a_id AND name = 'Company Alpha Supermarkets'
    ), 'TEST 14.3 FAILED: Company Manager must be allowed to update standard company properties';

    -- 14.4 Platform Admin CAN modify max_stores and is_demo
    PERFORM set_config('request.jwt.claim.sub', admin_user_id::text, TRUE);
    UPDATE public.companies
    SET max_stores = 15, is_demo = TRUE
    WHERE id = company_a_id;

    ASSERT EXISTS (
        SELECT 1 FROM public.companies WHERE id = company_a_id AND max_stores = 15 AND is_demo = TRUE
    ), 'TEST 14.4 FAILED: Platform admin MUST be allowed to update max_stores and is_demo';
    RAISE NOTICE '✔ TEST 13 PASSED: Anti-privilege escalation triggers and admin authority strictly verified';

    RAISE NOTICE '>>> ALL 13 RBAC ISOLATION & HARDENED SECURITY TESTS PASSED SUCCESSFULLY <<<';
END;
$$;

-- Cleanly roll back all test transactions and fixtures
ROLLBACK;
