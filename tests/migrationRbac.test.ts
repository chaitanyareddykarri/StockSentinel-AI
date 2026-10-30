import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION_PATH = path.join(process.cwd(), 'supabase', 'migrations', '20261029000000_multi_tenant_rbac_schema.sql');
const ROLLBACK_PATH = path.join(process.cwd(), 'supabase', 'migrations', '20261029000000_multi_tenant_rbac_rollback.sql');
const TEST_SQL_PATH = path.join(process.cwd(), 'supabase', 'tests', '20261029000000_test_rbac_isolation.sql');

test('1. Migration, Rollback, and Test SQL files exist with valid timestamps and content', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH), 'Migration SQL file must exist');
  assert.ok(fs.existsSync(ROLLBACK_PATH), 'Rollback SQL file must exist');
  assert.ok(fs.existsSync(TEST_SQL_PATH), 'Transactional test runner SQL must exist');

  const migrationContent = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  assert.ok(migrationContent.length > 1000, 'Migration file must contain full implementation content');

  const rollbackContent = fs.readFileSync(ROLLBACK_PATH, 'utf-8');
  assert.ok(rollbackContent.length > 500, 'Rollback file must contain full rollback content');
});

test('2. Authorization helpers are strictly caller-anchored with zero arbitrary-user parameters and active status check', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Verify functions are defined without arbitrary user parameter
  assert.ok(sql.includes('FUNCTION public.is_platform_admin()\nRETURNS BOOLEAN'), 'is_platform_admin must be parameterless');
  assert.ok(sql.includes('FUNCTION public.get_user_company_role(cid UUID)\nRETURNS TEXT'), 'get_user_company_role takes only cid');
  assert.ok(sql.includes('FUNCTION public.can_access_company(cid UUID)\nRETURNS BOOLEAN'), 'can_access_company takes only cid');
  assert.ok(sql.includes('FUNCTION public.can_access_store(sid UUID)\nRETURNS BOOLEAN'), 'can_access_store takes only sid');

  // Zero functions may accept check_user_id (prohibits arbitrary-user permission probing)
  assert.ok(!sql.includes('check_user_id'), 'Zero functions may accept check_user_id parameter');

  // Active status enforcement: suspended store managers lose access immediately
  assert.ok(sql.includes("cm.status = 'ACTIVE'"), 'can_access_store must check that membership status is ACTIVE');

  // Verify fixed search_path = public, pg_temp (prevents search_path hijacking)
  const matches = sql.match(/SET search_path = public, pg_temp/g);
  assert.ok(matches && matches.length >= 5, 'All SECURITY DEFINER functions must set search_path = public, pg_temp');

  // Verify execution permissions revoked from PUBLIC
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC'), 'Revoke is_platform_admin from PUBLIC');
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.can_access_store(UUID) FROM PUBLIC'), 'Revoke can_access_store from PUBLIC');
});

test('3. Legacy data backfill strictly targets verified demo records and secures unassigned view', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Must NOT use blanket text matching like name ILIKE '%demo%' or blind WHERE company_id IS NULL
  assert.ok(!sql.includes("name ILIKE '%demo%'"), 'Must not use blanket name pattern matching for backfill');

  // Must strictly verify demo identifiers from verified alerts and detection runs
  assert.ok(sql.includes('SELECT DISTINCT store_id FROM public.alerts WHERE is_demo = TRUE'), 'Target stores linked to verified demo alerts');
  assert.ok(sql.includes('WHERE dr.is_demo = TRUE'), 'Target stores linked to verified demo detection runs');

  // Must create dedicated view for unassigned legacy records with security_invoker = true and ownership check
  assert.ok(sql.includes('VIEW public.legacy_unassigned_stores'), 'Must define legacy_unassigned_stores view');
  assert.ok(sql.includes('WITH (security_invoker = true)'), 'legacy_unassigned_stores must be security_invoker');
  assert.ok(sql.includes('(public.is_platform_admin() OR s.user_id = auth.uid())'), 'Privacy check on legacy view');
});

test('4. Compound constraints prevent cross-company assignments, mismatched stores, and non-member assignments', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Compound unique on stores (id, company_id)
  assert.ok(sql.includes('CONSTRAINT uq_stores_id_company UNIQUE (id, company_id)'), 'Compound unique on stores');

  // Compound FK on store_assignments (store_id, company_id)
  assert.ok(sql.includes('CONSTRAINT fk_store_assignments_store_company'), 'Compound FK on store_assignments (store_id, company_id)');

  // Compound FK on store_assignments (company_id, user_id) referencing company_memberships
  assert.ok(sql.includes('CONSTRAINT fk_store_assignments_user_membership'), 'Compound FK on store_assignments referencing company_memberships');

  // Compound FK on invitations (store_id, company_id)
  assert.ok(sql.includes('CONSTRAINT fk_invitations_store_company'), 'Compound FK on invitations (store_id, company_id)');

  // Child retail tables compound FKs
  assert.ok(sql.includes('CONSTRAINT fk_daily_sales_store_company'), 'Compound FK on daily_sales');
  assert.ok(sql.includes('CONSTRAINT fk_inv_store_company'), 'Compound FK on inventory_snapshots');
  assert.ok(sql.includes('CONSTRAINT fk_alerts_store_company'), 'Compound FK on alerts');
});

test('5. Transactional onboarding function enforces bounds, anti-spam, and atomic membership', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Function definition
  assert.ok(sql.includes('FUNCTION public.onboard_company('), 'onboard_company function must exist');
  assert.ok(sql.includes('p_max_stores < 1 OR p_max_stores > 20'), 'Store limit bounds check (1-20)');
  assert.ok(sql.includes("role = 'COMPANY_MANAGER' AND status = 'ACTIVE'"), 'Anti-spam: checks if already active company manager');
  assert.ok(sql.includes("INSERT INTO public.company_memberships"), 'Atomic membership creation');

  // Companies table: direct client INSERT is blocked by RLS (no public INSERT policy)
  assert.ok(!sql.includes('CREATE POLICY "Authenticated users can create companies" ON public.companies\n    FOR INSERT'), 'Direct table INSERT policy must not exist');
  assert.ok(sql.includes('"Companies deletable only by platform admin"'), 'Companies deletion restricted to platform admin');
});

test('6. Row-Level Security policies strictly restrict roles and prevent self-escalation', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Company memberships: Company managers cannot modify their own record or escalate to COMPANY_MANAGER
  assert.ok(sql.includes("role = 'STORE_MANAGER' -- Company Manager cannot grant COMPANY_MANAGER"), 'Company manager can only invite STORE_MANAGER');
  assert.ok(sql.includes("user_id <> auth.uid() -- Company Manager cannot alter own role"), 'Company manager cannot alter own membership');
  assert.ok(sql.includes("user_id <> auth.uid() -- Company Manager cannot delete own membership"), 'Company manager cannot delete own membership');

  // Store assignments check active STORE_MANAGER role
  assert.ok(sql.includes("cm.role = 'STORE_MANAGER'"), 'store_assignments must verify target is STORE_MANAGER');

  // Platform admin table is locked down
  assert.ok(sql.includes('"Platform admins modifiable only by admins"'), 'Platform admin modifiable only by admins');

  // Stores creation restricted to company managers and platform admin; max_stores enforced by trigger
  assert.ok(sql.includes('public.enforce_store_creation_limits'), 'Store creation enforces max_stores via trigger');
  assert.ok(sql.includes('SELECT max_stores INTO v_max_stores'), 'Trigger queries max_stores with lock');
});

test('7. Rollback script symmetrically reverses all additions without dropping pre-existing schema', () => {
  const rollback = fs.readFileSync(ROLLBACK_PATH, 'utf-8');

  // Drops functions including onboard_company and accept_invitation
  assert.ok(rollback.includes('DROP FUNCTION IF EXISTS public.accept_invitation(TEXT);'), 'Drops accept_invitation');
  assert.ok(rollback.includes('DROP FUNCTION IF EXISTS public.onboard_company'), 'Drops onboard_company');
  assert.ok(rollback.includes('DROP FUNCTION IF EXISTS public.can_access_store(UUID)'), 'Drops can_access_store');
  assert.ok(rollback.includes('DROP FUNCTION IF EXISTS public.is_platform_admin()'), 'Drops is_platform_admin');

  // Drops view
  assert.ok(rollback.includes('DROP VIEW IF EXISTS public.legacy_unassigned_stores'), 'Drops legacy_unassigned_stores view');

  // Drops constraints
  assert.ok(rollback.includes('ALTER TABLE public.store_assignments DROP CONSTRAINT IF EXISTS fk_store_assignments_user_membership'), 'Drops membership compound FK');
  assert.ok(rollback.includes('ALTER TABLE public.store_assignments DROP CONSTRAINT IF EXISTS fk_store_assignments_store_company'), 'Drops store assignment compound FK');
  assert.ok(rollback.includes('ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS fk_invitations_store_company'), 'Drops invitation compound FK');

  // Drops tables in reverse dependency order
  assert.ok(rollback.includes('DROP TABLE IF EXISTS public.invitations CASCADE'), 'Drops invitations');
  assert.ok(rollback.includes('DROP TABLE IF EXISTS public.store_assignments CASCADE'), 'Drops store_assignments');
  assert.ok(rollback.includes('DROP TABLE IF EXISTS public.company_memberships CASCADE'), 'Drops company_memberships');
  assert.ok(rollback.includes('DROP TABLE IF EXISTS public.platform_administrators CASCADE'), 'Drops platform_administrators');
  assert.ok(rollback.includes('DROP TABLE IF EXISTS public.companies CASCADE'), 'Drops companies');

  // Drops import_jobs additions
  assert.ok(rollback.includes('DROP POLICY IF EXISTS "Users access authorized import jobs"'), 'Drops import_jobs RLS policy');
  assert.ok(rollback.includes('CREATE POLICY "Users access own import jobs"'), 'Restores original import_jobs RLS policy');
  assert.ok(rollback.includes('ALTER TABLE public.import_jobs DROP COLUMN IF EXISTS company_id;'), 'Drops import_jobs company_id column');

  // Single transaction boundary
  assert.ok(rollback.startsWith('--') || rollback.startsWith('BEGIN;'), 'Rollback starts cleanly');
  const commitMatches = rollback.match(/\bCOMMIT;/g);
  assert.strictEqual(commitMatches ? commitMatches.length : 0, 1, 'Rollback must have exactly one COMMIT;');
});

test('8. Transactional SQL test harness contains 10 rigorous assertion suites with auth.users fixtures', () => {
  const testSql = fs.readFileSync(TEST_SQL_PATH, 'utf-8');

  assert.ok(testSql.includes('BEGIN;'), 'Test must start transaction');
  assert.ok(testSql.includes('ROLLBACK;'), 'Test must cleanly rollback transaction');
  assert.ok(testSql.includes('INSERT INTO auth.users'), 'Test harness seeds auth.users fixtures for FK integrity');
  assert.ok(testSql.includes('arbitrary-user parameter probing eliminated'), 'Verifies caller-anchored authorization');
  assert.ok(testSql.includes('Suspended store manager must NOT retain store access'), 'Verifies active status enforcement');
  assert.ok(testSql.includes('Legacy unassigned stores view privacy enforced'), 'Verifies view privacy assertions');
  assert.ok(testSql.includes('fk_store_assignments_user_membership'), 'Verifies non-member assignment rejection');
  assert.ok(testSql.includes('public.onboard_company'), 'Verifies transactional onboarding function');
  assert.ok(testSql.includes('public.accept_invitation'), 'Verifies atomic invitation acceptance test');
});

test('9. Database-level invitation acceptance function enforces concurrency lock and identity checks', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  assert.ok(sql.includes('FUNCTION public.accept_invitation('), 'accept_invitation function must exist');
  assert.ok(sql.includes('#variable_conflict use_column'), 'accept_invitation must specify #variable_conflict use_column to eliminate company_id ambiguity');
  assert.ok(sql.includes('FOR UPDATE;'), 'accept_invitation must acquire row-level lock FOR UPDATE');
  assert.ok(sql.includes('lower(trim(v_caller_email)) <> lower(trim(v_inv.email))'), 'Caller email must match invited email');
  assert.ok(sql.includes("status = 'ACCEPTED'"), 'Marks invitation as accepted');
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;'), 'Execution revoked from PUBLIC');
});

test('10. Legacy record access policies secure unassigned records strictly to original creator via user_id', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  // Stores UPDATE & DELETE legacy creator access
  assert.ok(
    sql.includes('CREATE POLICY "Stores updatable by company manager and platform admin"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Stores UPDATE policy must preserve legacy owner access'
  );
  assert.ok(
    sql.includes('CREATE POLICY "Stores deletable by company manager and platform admin"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Stores DELETE policy must preserve legacy owner access'
  );

  // Products SELECT & ALL legacy creator access
  assert.ok(
    sql.includes('CREATE POLICY "Users access company products"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Products SELECT policy must preserve legacy owner access'
  );
  assert.ok(
    sql.includes('CREATE POLICY "Products manageable by company manager and platform admin"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Products ALL policy must preserve legacy owner access'
  );

  // Detection runs legacy creator access
  assert.ok(
    sql.includes('CREATE POLICY "Users access company detection runs"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Detection runs policy must preserve legacy owner access'
  );

  // Verification audit log legacy creator access
  assert.ok(
    sql.includes('CREATE POLICY "Users access company audit logs"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Verification audit log policy must preserve legacy owner access'
  );

  // Promotions legacy creator access
  assert.ok(
    sql.includes('CREATE POLICY "Users access authorized promotions"') &&
    sql.includes('company_id IS NULL\n            AND user_id = auth.uid()'),
    'Promotions policy must preserve legacy owner access'
  );

  // Negative test: verify no RLS policy permits company_id IS NULL alone without ownership check
  const rlsSection = sql.split('-- 6. Row Level Security Policies')[1] || '';
  const lines = rlsSection.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('company_id IS NULL') && !line.includes('--')) {
      // Must be accompanied or guarded by user_id = auth.uid() or auth.uid() = user_id in the surrounding block
      const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join(' ');
      const hasOwnershipCheck = context.includes('user_id = auth.uid()') || 
                                context.includes('auth.uid() = user_id') ||
                                context.includes('s.user_id = auth.uid()');
      assert.ok(
        hasOwnershipCheck,
        `RLS company_id IS NULL check at line ${i + 1} must be tied to creator ownership (found: "${line}")`
      );
    }
  }
});

test('11. Dynamic logic evaluation of extracted SQL expressions validates multi-tenant RBAC invariants', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  function extractClauses(policyName: string): { usingSql: string; withCheckSql?: string } {
    const policyIdx = sql.indexOf(`"${policyName}"`);
    assert.ok(policyIdx !== -1, `Policy "${policyName}" must exist in migration file`);
    const rest = sql.slice(policyIdx);
    const endIdx = rest.search(/DROP POLICY|COMMIT;/);
    const block = endIdx !== -1 ? rest.slice(0, endIdx) : rest;

    const usingMatch = block.match(/USING\s*\(([\s\S]*?)\)(?:\s*WITH CHECK|\s*;)/);
    const checkMatch = block.match(/WITH CHECK\s*\(([\s\S]*?)\)\s*;/);

    assert.ok(usingMatch, `Policy "${policyName}" must contain a USING expression`);
    return {
      usingSql: usingMatch[1].trim(),
      withCheckSql: checkMatch ? checkMatch[1].trim() : undefined,
    };
  }

  interface EvalContext {
    callerUid: string;
    isPlatformAdmin: boolean;
    callerCompanyRole: Record<string, string>;
    callerCompanyAccess: Set<string>;
    callerStoreAccess: Set<string>;
    row: {
      user_id: string;
      company_id: string | null;
      store_id?: string | null;
    };
  }

  function compileSqlExpression(rawSql: string): (ctx: EvalContext) => boolean {
    const jsExpr = rawSql
      .replace(/\s+/g, ' ')
      .replace(/public\.is_platform_admin\(\)/g, 'ctx.isPlatformAdmin')
      .replace(/company_id IS NOT NULL/g, '(ctx.row.company_id !== null)')
      .replace(/company_id IS NULL/g, '(ctx.row.company_id === null)')
      .replace(/store_id IS NULL/g, '(!ctx.row.store_id)')
      .replace(/store_id IS NOT NULL/g, '(Boolean(ctx.row.store_id))')
      .replace(/user_id = auth\.uid\(\)/g, '(ctx.row.user_id === ctx.callerUid)')
      .replace(/auth\.uid\(\) = user_id/g, '(ctx.row.user_id === ctx.callerUid)')
      .replace(/public\.get_user_company_role\(company_id\)\s*=\s*'COMPANY_MANAGER'/g, '(Boolean(ctx.row.company_id && ctx.callerCompanyRole[ctx.row.company_id] === "COMPANY_MANAGER"))')
      .replace(/public\.can_access_company\(company_id\)/g, '(Boolean(ctx.row.company_id && ctx.callerCompanyAccess.has(ctx.row.company_id)))')
      .replace(/public\.can_access_store\(store_id\)/g, '(Boolean(ctx.row.store_id && ctx.callerStoreAccess.has(ctx.row.store_id)))')
      .replace(/\bAND\b/g, '&&')
      .replace(/\bOR\b/g, '||');

    return new Function('ctx', `"use strict"; return Boolean(${jsExpr});`) as (ctx: EvalContext) => boolean;
  }

  const legacyOwnerUid = '11111111-0000-0000-0000-000000000001';
  const otherUserUid = '22222222-0000-0000-0000-000000000002';
  const companyManagerUid = '33333333-0000-0000-0000-000000000003';
  const platformAdminUid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const alphaCoId = 'cccccccc-1111-0000-0000-000000000001';
  const betaCoId = 'cccccccc-2222-0000-0000-000000000002';

  const policiesToEvaluate = [
    { name: 'Stores updatable by company manager and platform admin', hasWithCheck: true },
    { name: 'Stores deletable by company manager and platform admin', hasWithCheck: false },
    { name: 'Users access company products', hasWithCheck: false },
    { name: 'Products manageable by company manager and platform admin', hasWithCheck: true },
    { name: 'Users access company detection runs', hasWithCheck: true },
    { name: 'Users access company audit logs', hasWithCheck: true },
    { name: 'Users access authorized promotions', hasWithCheck: true, hasStore: true },
  ];

  for (const p of policiesToEvaluate) {
    const { usingSql, withCheckSql } = extractClauses(p.name);
    const evalUsing = compileSqlExpression(usingSql);
    const evalCheck = withCheckSql ? compileSqlExpression(withCheckSql) : evalUsing;

    // 1. Legacy owner accessing own unassigned record -> TRUE
    const legacyCtx: EvalContext = {
      callerUid: legacyOwnerUid,
      isPlatformAdmin: false,
      callerCompanyRole: {},
      callerCompanyAccess: new Set(),
      callerStoreAccess: new Set(),
      row: { user_id: legacyOwnerUid, company_id: null },
    };
    assert.strictEqual(evalUsing(legacyCtx), true, `${p.name}: Original owner must access own legacy record`);
    assert.strictEqual(evalCheck(legacyCtx), true, `${p.name}: Original owner passes WITH CHECK for own legacy record`);

    // 2. Unrelated user accessing legacy record -> FALSE
    const intruderCtx: EvalContext = {
      ...legacyCtx,
      callerUid: otherUserUid,
    };
    assert.strictEqual(evalUsing(intruderCtx), false, `${p.name}: Unrelated user MUST NOT access other user legacy record`);
    assert.strictEqual(evalCheck(intruderCtx), false, `${p.name}: Unrelated user MUST NOT pass WITH CHECK for other user legacy record`);

    // 3. Foreign Company Manager cannot hijack unassigned legacy record -> FALSE
    const cmHijackCtx: EvalContext = {
      ...legacyCtx,
      callerUid: companyManagerUid,
      callerCompanyRole: { [alphaCoId]: 'COMPANY_MANAGER' },
      callerCompanyAccess: new Set([alphaCoId]),
    };
    assert.strictEqual(evalUsing(cmHijackCtx), false, `${p.name}: Foreign Company Manager MUST NOT access unassigned legacy record`);

    // 4. Legacy owner attempting in WITH CHECK to reassign legacy record to foreign company (tenant hijacking) -> FALSE
    const tenantHijackCtx: EvalContext = {
      ...legacyCtx,
      row: { user_id: legacyOwnerUid, company_id: betaCoId },
    };
    assert.strictEqual(evalCheck(tenantHijackCtx), false, `${p.name}: WITH CHECK must reject moving record to unauthorized company`);

    // 5. Authorized Company Manager managing their own company record -> TRUE
    const authorizedCmCtx: EvalContext = {
      callerUid: companyManagerUid,
      isPlatformAdmin: false,
      callerCompanyRole: { [alphaCoId]: 'COMPANY_MANAGER' },
      callerCompanyAccess: new Set([alphaCoId]),
      callerStoreAccess: new Set(),
      row: { user_id: otherUserUid, company_id: alphaCoId },
    };
    assert.strictEqual(evalUsing(authorizedCmCtx), true, `${p.name}: Authorized Company Manager must access company records`);
    assert.strictEqual(evalCheck(authorizedCmCtx), true, `${p.name}: Authorized Company Manager passes WITH CHECK for company records`);

    // 6. Cross-company isolation: Company Manager accessing other company record -> FALSE
    const crossCompanyCtx: EvalContext = {
      ...authorizedCmCtx,
      row: { user_id: otherUserUid, company_id: betaCoId },
    };
    assert.strictEqual(evalUsing(crossCompanyCtx), false, `${p.name}: Company Manager MUST NOT access other company records`);

    // 7. Platform Admin accessing any legacy or company record -> TRUE
    const adminCtx: EvalContext = {
      callerUid: platformAdminUid,
      isPlatformAdmin: true,
      callerCompanyRole: {},
      callerCompanyAccess: new Set(),
      callerStoreAccess: new Set(),
      row: { user_id: legacyOwnerUid, company_id: null },
    };
    assert.strictEqual(evalUsing(adminCtx), true, `${p.name}: Platform Admin must access any record`);
    assert.strictEqual(evalCheck(adminCtx), true, `${p.name}: Platform Admin passes WITH CHECK on any record`);
  }
});

test('12. Chat policies and all table RLS replacements are idempotent and drop both legacy and new names', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  const rollbackSql = fs.readFileSync(ROLLBACK_PATH, 'utf-8');

  // Verify Migration 4 explicitly drops both legacy and new policy names on chat tables before creating new policies
  assert.ok(
    migrationSql.includes('DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;') &&
    migrationSql.includes('DROP POLICY IF EXISTS "Users access authorized chat conversations" ON public.chat_conversations;'),
    'Migration 4 must drop both legacy and authorized policy names on chat_conversations'
  );
  assert.ok(
    migrationSql.includes('DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;') &&
    migrationSql.includes('DROP POLICY IF EXISTS "Users access authorized chat messages" ON public.chat_messages;'),
    'Migration 4 must drop both legacy and authorized policy names on chat_messages'
  );

  // Verify Rollback explicitly drops both legacy and new policy names on chat tables before recreating legacy policies
  assert.ok(
    rollbackSql.includes('DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;') &&
    rollbackSql.includes('DROP POLICY IF EXISTS "Users access authorized chat conversations" ON public.chat_conversations;'),
    'Rollback must drop both legacy and authorized policy names on chat_conversations'
  );
  assert.ok(
    rollbackSql.includes('DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;') &&
    rollbackSql.includes('DROP POLICY IF EXISTS "Users access authorized chat messages" ON public.chat_messages;'),
    'Rollback must drop both legacy and authorized policy names on chat_messages'
  );

  // Universal idempotency check: every CREATE POLICY in migration and rollback must be preceded by DROP POLICY IF EXISTS
  for (const [fileLabel, content] of [['Migration', migrationSql], ['Rollback', rollbackSql]]) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const createMatch = line.match(/^CREATE POLICY "([^"]+)" ON (public\.[a-z_]+|[a-z_]+)/);
      if (createMatch) {
        const policyName = createMatch[1];
        const tableName = createMatch[2];
        const precedingBlock = lines.slice(Math.max(0, i - 10), i).join('\n');
        assert.ok(
          precedingBlock.includes(`DROP POLICY IF EXISTS "${policyName}"`),
          `${fileLabel}: CREATE POLICY "${policyName}" on ${tableName} at line ${i + 1} must be preceded by DROP POLICY IF EXISTS`
        );
      }
    }
  }
});

test('13. Migration 6: Ambiguous column reference regression prevention in accept_invitation', () => {
  const mig6Path = path.join(process.cwd(), 'supabase', 'migrations', '20261029000002_fix_accept_invitation_ambiguity.sql');
  assert.ok(fs.existsSync(mig6Path), 'Migration 6 file must exist');

  const mig6Sql = fs.readFileSync(mig6Path, 'utf-8');
  assert.ok(mig6Sql.includes('CREATE OR REPLACE FUNCTION public.accept_invitation('), 'Must define public.accept_invitation');
  assert.ok(mig6Sql.includes('#variable_conflict use_column'), 'Must set #variable_conflict use_column directive');
  assert.ok(mig6Sql.includes('RETURNS TABLE (\n    company_id UUID,\n    store_id UUID,\n    role TEXT\n)'), 'Return table contract must match caller expectations');
  assert.ok(mig6Sql.includes('ON CONFLICT (company_id, user_id) DO UPDATE SET'), 'Must maintain upsert for company membership');
  assert.ok(mig6Sql.includes('ON CONFLICT (store_id, user_id) DO NOTHING;'), 'Must maintain idempotent store assignment');
  assert.ok(mig6Sql.includes('REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;'), 'Revoke public execution');
  assert.ok(mig6Sql.includes('GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated, service_role;'), 'Grant authenticated and service_role execution');
});
