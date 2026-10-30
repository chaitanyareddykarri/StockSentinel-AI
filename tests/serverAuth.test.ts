import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthenticatedUser } from '../src/lib/auth/serverAuth';
import {
  createSession,
  createUser,
  findUserByEmail,
  setPlatformAdmin,
  setCompanyMembership,
  setStoreAssignment,
  setCompanyStores,
  clearRbacCaches,
  createOrUpdateGoogleUser,
} from '../src/lib/auth/userStore';

test('1. Reject request with completely missing credentials', async () => {
  const req = new Request('http://localhost:3000/api/assistant/conversations');
  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, false);
  assert.equal(result.user, null);
  assert.equal(result.status, 401);
  assert.match(result.error || '', /No credentials found/i);
});

test('2. Reject request with invalid bearer token', async () => {
  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    headers: {
      Authorization: 'Bearer invalid_mock_token_12345',
    },
  });
  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, false);
  assert.equal(result.user, null);
  assert.equal(result.status, 401);
});

test('3. Reject request with invalid standalone session cookie', async () => {
  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    headers: {
      Cookie: 'stocksentinel_session=ses_non_existent_fake_token',
    },
  });
  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, false);
  assert.equal(result.user, null);
  assert.equal(result.status, 401);
  assert.match(result.error || '', /expired or invalid/i);
});

test('4. Ignore spoofed user IDs and client-supplied roles in request body or headers (Role Tampering Immunity)', async () => {
  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'usr_spoofed_admin',
      'x-user-role': 'PLATFORM_ADMIN',
      'x-company-id': 'comp_spoofed_123',
      'X-Forwarded-User': 'admin@company.com',
    },
    body: JSON.stringify({
      userId: 'usr_spoofed_admin',
      role: 'PLATFORM_ADMIN',
      companyId: 'comp_spoofed_123',
    }),
  });
  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, false);
  assert.equal(result.user, null);
  assert.equal(result.status, 401);
});

test('5. Verify valid standalone session via stocksentinel_session cookie', async () => {
  const testEmail = `test_associate_${Date.now()}@walmart-ops.com`;
  let user = await findUserByEmail(testEmail);
  if (!user) {
    user = await createUser({
      email: testEmail,
      name: 'Test Associate',
      storeName: 'Test Store #99',
      role: 'ASSOCIATE',
    });
  }

  const sessionToken = await createSession(user);

  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    headers: {
      Cookie: `stocksentinel_session=${sessionToken}; other_cookie=xyz`,
    },
  });

  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.id, user.id);
  assert.equal(result.user.email, testEmail);
  assert.equal(result.user.authMode, 'standalone');
  assert.equal(result.status, 200);

  // Sensitive fields must NOT be exposed
  assert.equal((result.user as unknown as Record<string, unknown>).passwordHash, undefined);
  assert.equal((result.user as unknown as Record<string, unknown>).salt, undefined);
});

test('6. Verify valid standalone session via Bearer ses_ token', async () => {
  const testEmail = `test_lead_${Date.now()}@walmart-ops.com`;
  const user = await createUser({
    email: testEmail,
    name: 'Test Lead',
    storeName: 'Test Store #101',
    role: 'INVENTORY_LEAD',
  });

  const sessionToken = await createSession(user);

  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  const result = await getAuthenticatedUser(req);

  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.id, user.id);
  assert.equal(result.user.authMode, 'standalone');
});

test('7. Reject expired session tokens', async () => {
  const testEmail = `test_expired_${Date.now()}@walmart-ops.com`;
  const user = await createUser({
    email: testEmail,
    name: 'Expired User',
    storeName: 'Test Store #102',
    role: 'ASSOCIATE',
  });

  const sessionToken = await createSession(user);

  const req = new Request('http://localhost:3000/api/assistant/conversations', {
    headers: {
      Authorization: `Bearer ${sessionToken}_corrupted`,
    },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, false);
  assert.equal(result.user, null);
  assert.equal(result.status, 401);
});

// ====================================================================
// Stage 2 Multi-Tenant RBAC Resolution Tests
// ====================================================================

test('8. Platform Admin Protection: Verified admin attains PLATFORM_ADMIN state with platform-wide scope', async () => {
  clearRbacCaches();
  const testEmail = `admin_${Date.now()}@platform.local`;
  const adminUser = await createUser({
    email: testEmail,
    name: 'Platform Developer',
  });

  // Explicitly provision in platform admin whitelist
  setPlatformAdmin(adminUser.id, true);

  const token = await createSession(adminUser);
  const req = new Request('http://localhost:3000/api/admin/companies', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.accessState, 'PLATFORM_ADMIN');
  assert.equal(result.user.role, 'PLATFORM_ADMIN');
  assert.deepEqual(result.user.accessibleStoreIds, ['*']);
});

test('9. Role Tampering: Ordinary user cannot elevate to PLATFORM_ADMIN via headers, metadata, or body', async () => {
  clearRbacCaches();
  const testEmail = `user_tamper_${Date.now()}@attacker.com`;
  const user = await createUser({
    email: testEmail,
    name: 'Sneaky User',
  });

  // User is NOT in platform admin whitelist
  const token = await createSession(user);

  const req = new Request('http://localhost:3000/api/admin/companies', {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-user-role': 'PLATFORM_ADMIN',
      'X-Role': 'PLATFORM_ADMIN',
    },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  // Must NOT be PLATFORM_ADMIN; resolves to PENDING_ASSIGNMENT
  assert.notEqual(result.user.accessState, 'PLATFORM_ADMIN');
  assert.equal(result.user.accessState, 'PENDING_ASSIGNMENT');
  assert.deepEqual(result.user.accessibleStoreIds, []);
});

test('10. Pending User State: Newly created Google OAuth user remains PENDING_ASSIGNMENT without store access', async () => {
  clearRbacCaches();
  const googleEmail = `google_pilot_${Date.now()}@retailer.com`;
  const googleUser = await createOrUpdateGoogleUser({
    email: googleEmail,
    name: 'Google User',
    avatarUrl: 'https://example.com/avatar.jpg',
  });

  const token = await createSession(googleUser);
  const req = new Request('http://localhost:3000/api/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.accessState, 'PENDING_ASSIGNMENT');
  assert.equal(result.user.companyId, undefined);
  assert.equal(result.user.assignedStoreId, undefined);
  assert.deepEqual(result.user.accessibleStoreIds, []);
});

test('11. Company Manager Resolution: Access all active stores in own company only (Cross-Company Isolation)', async () => {
  clearRbacCaches();
  const cmEmail = `cm_${Date.now()}@alpha-corp.com`;
  const cmUser = await createUser({ email: cmEmail, name: 'Alpha Executive' });

  const companyAId = 'comp-alpha-111';
  const companyBId = 'comp-beta-222';

  // Configure Company A stores and Company B stores
  setCompanyStores(companyAId, [
    { id: 'store-alpha-01', name: 'Alpha Store 1' },
    { id: 'store-alpha-02', name: 'Alpha Store 2' },
  ]);
  setCompanyStores(companyBId, [
    { id: 'store-beta-01', name: 'Beta Store 1' },
  ]);

  // Assign user as COMPANY_MANAGER for Company A
  setCompanyMembership({
    companyId: companyAId,
    companyName: 'Alpha Retail Corp',
    companySlug: 'alpha-retail',
    companyStatus: 'ACTIVE',
    userId: cmUser.id,
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
  });

  const token = await createSession(cmUser);
  const req = new Request('http://localhost:3000/api/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.accessState, 'COMPANY_MANAGER');
  assert.equal(result.user.companyId, companyAId);
  assert.deepEqual(result.user.accessibleStoreIds, ['store-alpha-01', 'store-alpha-02']);

  // Cross-Company Isolation: Must NOT contain Beta store
  assert.equal(result.user.accessibleStoreIds.includes('store-beta-01'), false);
});

test('12. Store Manager Resolution: Access strictly to assigned store (Store Assignment Restriction)', async () => {
  clearRbacCaches();
  const smEmail = `sm_${Date.now()}@alpha-corp.com`;
  const smUser = await createUser({ email: smEmail, name: 'Store Manager 1' });

  const companyAId = 'comp-alpha-111';
  const assignedStoreId = 'store-alpha-01';

  // Membership in Company A as STORE_MANAGER
  setCompanyMembership({
    companyId: companyAId,
    companyName: 'Alpha Retail Corp',
    companySlug: 'alpha-retail',
    companyStatus: 'ACTIVE',
    userId: smUser.id,
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
  });

  // Assigned to Store 1 only
  setStoreAssignment({
    companyId: companyAId,
    storeId: assignedStoreId,
    storeName: 'Alpha Store 1',
    userId: smUser.id,
  });

  const token = await createSession(smUser);
  const req = new Request('http://localhost:3000/api/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.accessState, 'STORE_MANAGER');
  assert.equal(result.user.assignedStoreId, assignedStoreId);
  assert.deepEqual(result.user.accessibleStoreIds, [assignedStoreId]);

  // Same-Company Cross-Store Isolation: Must NOT contain Store 2
  assert.equal(result.user.accessibleStoreIds.includes('store-alpha-02'), false);
});

test('13. Suspended Membership: Suspended user has all store access revoked immediately', async () => {
  clearRbacCaches();
  const smEmail = `suspended_sm_${Date.now()}@alpha-corp.com`;
  const smUser = await createUser({ email: smEmail, name: 'Suspended Manager' });

  const companyAId = 'comp-alpha-111';

  // Membership marked SUSPENDED
  setCompanyMembership({
    companyId: companyAId,
    companyName: 'Alpha Retail Corp',
    companySlug: 'alpha-retail',
    companyStatus: 'ACTIVE',
    userId: smUser.id,
    role: 'STORE_MANAGER',
    status: 'SUSPENDED',
  });

  setStoreAssignment({
    companyId: companyAId,
    storeId: 'store-alpha-01',
    userId: smUser.id,
  });

  const token = await createSession(smUser);
  const req = new Request('http://localhost:3000/api/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await getAuthenticatedUser(req);
  assert.equal(result.success, true);
  assert.ok(result.user);
  assert.equal(result.user.accessState, 'SUSPENDED');
  // Must have ZERO accessible stores
  assert.deepEqual(result.user.accessibleStoreIds, []);
});

test('14. Vercel Production Safety: Standalone in-memory session rejected in production serverless environments', async () => {
  const originalVercel = process.env.VERCEL;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.VERCEL = '1';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const testEmail = `prod_test_${Date.now()}@walmart-ops.com`;
    const user = await createUser({ email: testEmail, name: 'Prod User' });
    const sessionToken = await createSession(user);

    const req = new Request('http://localhost:3000/api/assistant/conversations', {
      headers: {
        Cookie: `stocksentinel_session=${sessionToken}`,
      },
    });

    const result = await getAuthenticatedUser(req);
    // In production Vercel without Supabase, standalone sessions must be rejected
    assert.equal(result.success, false);
    assert.equal(result.status, 503);
    assert.match(result.error || '', /Production deployment on Vercel requires Supabase/i);
  } finally {
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  }
});
