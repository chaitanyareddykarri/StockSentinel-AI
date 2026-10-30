import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { getRoleDashboardPath } from '../src/lib/auth/roleRouting';
import {
  createStandaloneCompany,
  createStandaloneInvitation,
  revokeStandaloneInvitation,
  resendStandaloneInvitation,
  getStandaloneInvitationByHash,
  acceptStandaloneInvitation,
  hashInvitationToken,
  clearRbacCaches,
  createUser,
  createSession,
  setCompanyMembership,
  setStoreAssignment,
  setCompanyStores,
  findCompanyById,
} from '../src/lib/auth/userStore';
import { isValidUuid, getMemoryStore } from '../src/lib/storage';
import { sendStoreManagerInvitationEmail } from '../src/lib/email/invitationEmail';
import { POST as postStoreRoute, PATCH as patchStoreRoute } from '../src/app/api/company/stores/route';
import { GET as getCompanyRoute, PATCH as patchCompanyRoute } from '../src/app/api/company/route';
import { POST as postImportRoute } from '../src/app/api/import/route';
import { PATCH as patchAlertRoute } from '../src/app/api/alerts/route';
import type { Alert } from '../src/types';

test('1. Role Dashboard Routing: Returns expected dashboard paths based on role and onboarding status', () => {
  // Platform Admin
  assert.equal(getRoleDashboardPath('PLATFORM_ADMIN'), '/admin');
  assert.equal(getRoleDashboardPath({ accessState: 'PLATFORM_ADMIN', isPlatformAdmin: true }), '/admin');

  // Company Manager
  assert.equal(getRoleDashboardPath('COMPANY_MANAGER', 'PENDING_ONBOARDING'), '/onboarding');
  assert.equal(getRoleDashboardPath({ accessState: 'COMPANY_MANAGER', companyStatus: 'PENDING_ONBOARDING' }), '/onboarding');
  assert.equal(getRoleDashboardPath('COMPANY_MANAGER', 'ACTIVE'), '/stores');
  assert.equal(getRoleDashboardPath({ accessState: 'COMPANY_MANAGER', companyStatus: 'ACTIVE' }), '/stores');

  // Store Manager and Operations Roles
  assert.equal(getRoleDashboardPath('STORE_MANAGER'), '/dashboard');
  assert.equal(getRoleDashboardPath('INVENTORY_LEAD'), '/dashboard');
  assert.equal(getRoleDashboardPath('ASSOCIATE'), '/dashboard');

  // Pending Assignment & Suspended
  assert.equal(getRoleDashboardPath('PENDING_ASSIGNMENT'), '/access-status?status=pending');
  assert.equal(getRoleDashboardPath('SUSPENDED'), '/access-status?status=suspended');

  // Fallback
  assert.equal(getRoleDashboardPath(null), '/dashboard');
  assert.equal(getRoleDashboardPath(undefined), '/dashboard');
});

test('2. Email Service Safety: Detects missing RESEND_API_KEY and returns honest delivery warning without throwing', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    const result = await sendStoreManagerInvitationEmail({
      recipientEmail: 'manager@retail-store.com',
      companyName: 'Apex Retail',
      storeName: 'Downtown Store #101',
      rawToken: 'mock_raw_token_xyz_12345',
      requestOrigin: 'http://localhost:3000',
    });

    assert.equal(result.delivered, false);
    assert.match(result.warning || '', /RESEND_API_KEY is not set/i);
    assert.match(result.inviteUrl, /\/invite\/accept\?token=mock_raw_token_xyz_12345/);
  } finally {
    if (originalKey) {
      process.env.RESEND_API_KEY = originalKey;
    }
  }
});

test('3. Store Quota & Standalone Invitation Lifecycle: Creation, Revocation, and Resend', async () => {
  clearRbacCaches();

  const company = createStandaloneCompany({
    name: 'Target Retail Group',
    slug: 'target-retail',
    maxStores: 2,
    createdBy: 'usr_company_mgr_1',
  });

  assert.equal(company.maxStores, 2);

  // Create an invitation
  const rawToken1 = 'test_raw_token_stage6_abc';
  const tokenHash1 = hashInvitationToken(rawToken1);

  const inv = createStandaloneInvitation({
    companyId: company.id,
    companyName: company.name,
    storeId: 'store_trg_01',
    storeName: 'Target Store #01',
    email: 'store1.lead@target-retail.com',
    role: 'STORE_MANAGER',
    tokenHash: tokenHash1,
    invitedBy: 'usr_company_mgr_1',
    expiresInDays: 7,
  });

  assert.equal(inv.status, 'PENDING');
  assert.equal(inv.tokenHash, tokenHash1);

  // Revoke the invitation
  const revoked = revokeStandaloneInvitation(company.id, inv.id);
  assert.equal(revoked, true);

  const retrievedAfterRevoke = getStandaloneInvitationByHash(tokenHash1);
  assert.ok(retrievedAfterRevoke);
  assert.equal(retrievedAfterRevoke.status, 'REVOKED');

  // Attempting to accept a revoked invitation must fail
  const acceptRevokedResult = acceptStandaloneInvitation(tokenHash1, 'usr_new_manager_1');
  assert.equal(acceptRevokedResult.success, false);
  assert.match(acceptRevokedResult.error || '', /revoked/i);

  // Resend the invitation with a new token
  const rawToken2 = 'test_raw_token_stage6_def';
  const tokenHash2 = hashInvitationToken(rawToken2);

  const resentInv = resendStandaloneInvitation(company.id, inv.id, tokenHash2, 7);
  assert.ok(resentInv);
  assert.equal(resentInv.status, 'PENDING');
  assert.equal(resentInv.tokenHash, tokenHash2);

  // Old token hash should now be invalid / not found
  const oldLookup = getStandaloneInvitationByHash(tokenHash1);
  assert.equal(oldLookup, null);

  // New token hash resolves successfully
  const newLookup = getStandaloneInvitationByHash(tokenHash2);
  assert.ok(newLookup);
  assert.equal(newLookup.status, 'PENDING');

  // Accept the resent invitation
  const acceptResentResult = acceptStandaloneInvitation(tokenHash2, 'usr_new_manager_1');
  assert.equal(acceptResentResult.success, true);
  assert.ok(acceptResentResult.invitation);
  assert.equal(acceptResentResult.invitation.status, 'ACCEPTED');

  // Accepting again fails (single-use exhaustion)
  const reAcceptResult = acceptStandaloneInvitation(tokenHash2, 'usr_new_manager_1');
  assert.equal(reAcceptResult.success, false);
  assert.match(reAcceptResult.error || '', /already been accepted/i);
});

test('4. Cross-Tenant Protection: Cannot revoke or resend invitations belonging to a different company', async () => {
  clearRbacCaches();

  const companyA = createStandaloneCompany({
    name: 'Company Alpha',
    slug: 'alpha-corp',
    maxStores: 5,
    createdBy: 'mgr_alpha',
  });

  const companyB = createStandaloneCompany({
    name: 'Company Beta',
    slug: 'beta-corp',
    maxStores: 5,
    createdBy: 'mgr_beta',
  });

  const rawToken = 'cross_tenant_token_xyz';
  const tokenHash = hashInvitationToken(rawToken);

  const invA = createStandaloneInvitation({
    companyId: companyA.id,
    companyName: companyA.name,
    storeId: 'store_a1',
    email: 'lead@alpha.com',
    role: 'STORE_MANAGER',
    tokenHash,
    invitedBy: 'mgr_alpha',
  });

  // Attempt to revoke Company A's invite using Company B's ID
  const revokeAttempt = revokeStandaloneInvitation(companyB.id, invA.id);
  assert.equal(revokeAttempt, false);

  // The invitation remains PENDING
  const lookup = getStandaloneInvitationByHash(tokenHash);
  assert.ok(lookup);
  assert.equal(lookup.status, 'PENDING');

  // Attempt to resend Company A's invite using Company B's ID
  const newHash = hashInvitationToken('another_token');
  const resendAttempt = resendStandaloneInvitation(companyB.id, invA.id, newHash);
  assert.equal(resendAttempt, null);
});

test('5. Store Creation: Resolves company, assigns valid UUIDs, and enforces quota limits', async () => {
  clearRbacCaches();

  const cmUser = await createUser({
    email: `cm_store_create_${Date.now()}@walmart-ops.com`,
    name: 'CM Store Creator',
  });
  const cmToken = await createSession(cmUser);

  const company = createStandaloneCompany({
    name: 'Pinnacle Retail Group',
    slug: 'pinnacle-retail',
    maxStores: 2,
    createdBy: cmUser.id,
  });

  setCompanyMembership({
    userId: cmUser.id,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  // 1. Company lookup finds company by ID
  const found = await findCompanyById(company.id);
  assert.ok(found);
  assert.equal(found.id, company.id);
  assert.equal(found.name, 'Pinnacle Retail Group');

  // 2. Company Manager creates Store 1
  const res1 = await postStoreRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'POST',
      headers: {
        Cookie: `stocksentinel_session=${cmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Downtown Supercenter #101',
        location: 'Seattle, WA',
        managerEmail: 'sm.downtown@pinnacle.com',
      }),
    })
  );

  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.ok(isValidUuid(data1.store.id), `Created store ID "${data1.store.id}" must be a valid RFC 4122 UUID`);
  assert.match(data1.store.code, /^PINN-101/);
  assert.ok(data1.invitation);
  assert.match(data1.invitation.inviteUrl, /\/invite\/accept\?token=/);

  // 3. Company Manager creates Store 2
  const res2 = await postStoreRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'POST',
      headers: {
        Cookie: `stocksentinel_session=${cmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Bellevue Market #102',
        location: 'Bellevue, WA',
      }),
    })
  );

  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.success, true);
  assert.ok(isValidUuid(data2.store.id));

  // 4. Quota Enforcement: Store 3 creation must be rejected (maxStores = 2)
  const res3 = await postStoreRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'POST',
      headers: {
        Cookie: `stocksentinel_session=${cmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Tacoma Superstore #103',
        location: 'Tacoma, WA',
      }),
    })
  );

  assert.equal(res3.status, 400);
  const data3 = await res3.json();
  assert.match(data3.error, /store limit reached/i);

  // 5. Unauthorized User: Store Manager cannot create stores
  const smUser = await createUser({
    email: `sm_forbidden_${Date.now()}@walmart-ops.com`,
    name: 'SM Forbidden Creator',
  });
  const smToken = await createSession(smUser);
  setCompanyMembership({
    userId: smUser.id,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  const resForbidden = await postStoreRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'POST',
      headers: {
        Cookie: `stocksentinel_session=${smToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Hacked Store' }),
    })
  );

  assert.equal(resForbidden.status, 403);
});

test('6. Company Profile: Viewing and updating company name via PATCH', async () => {
  clearRbacCaches();

  const cmUser = await createUser({
    email: `cm_profile_${Date.now()}@walmart-ops.com`,
    name: 'CM Profile Manager',
  });
  const cmToken = await createSession(cmUser);

  const company = createStandaloneCompany({
    name: 'Original Retail Name',
    slug: 'original-retail',
    maxStores: 5,
    createdBy: cmUser.id,
  });

  setCompanyMembership({
    userId: cmUser.id,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  // 1. GET /api/company returns current company
  const resGet = await getCompanyRoute(
    new Request('http://localhost:3000/api/company', {
      headers: { Cookie: `stocksentinel_session=${cmToken}` },
    })
  );
  assert.equal(resGet.status, 200);
  const dataGet = await resGet.json();
  assert.equal(dataGet.company.name, 'Original Retail Name');

  // 2. PATCH /api/company updates company name
  const resPatch = await patchCompanyRoute(
    new Request('http://localhost:3000/api/company', {
      method: 'PATCH',
      headers: {
        Cookie: `stocksentinel_session=${cmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Apex Omni-Channel Enterprises' }),
    })
  );
  assert.equal(resPatch.status, 200);
  const dataPatch = await resPatch.json();
  assert.equal(dataPatch.success, true);
  assert.equal(dataPatch.company.name, 'Apex Omni-Channel Enterprises');

  // 3. PATCH /api/company/stores also updates company name
  const resPatchStores = await patchStoreRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'PATCH',
      headers: {
        Cookie: `stocksentinel_session=${cmToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Apex Retail Global' }),
    })
  );
  assert.equal(resPatchStores.status, 200);
  const dataPatchStores = await resPatchStores.json();
  assert.equal(dataPatchStores.company.name, 'Apex Retail Global');

  // 4. Store Manager cannot update company name
  const smUser = await createUser({
    email: `sm_profile_${Date.now()}@walmart-ops.com`,
    name: 'SM Profile User',
  });
  const smToken = await createSession(smUser);
  setCompanyMembership({
    userId: smUser.id,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  const resSmPatch = await patchCompanyRoute(
    new Request('http://localhost:3000/api/company', {
      method: 'PATCH',
      headers: {
        Cookie: `stocksentinel_session=${smToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Unauthorized Name' }),
    })
  );
  assert.equal(resSmPatch.status, 403);
});

test('7. CSV Ingestion: Store Manager and Company Manager multi-tenant boundaries', async () => {
  clearRbacCaches();

  const mem = getMemoryStore();
  const targetStore1 = mem.stores[0];
  const targetStore2 = mem.stores[1];
  const targetProd = mem.products[0];
  const companyAId = '00000000-0000-0000-0000-000000000001';

  // Create Store Manager assigned strictly to Store 1
  const smUser = await createUser({
    email: `sm_csv_${Date.now()}@company-a.com`,
    name: 'Store Manager 1',
  });
  const smToken = await createSession(smUser);
  setCompanyMembership({
    userId: smUser.id,
    companyId: companyAId,
    companyName: 'StockSentinel Retail Group',
    companySlug: 'stocksentinel-retail',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId: companyAId,
    storeId: targetStore1.id,
    storeName: targetStore1.name,
  });
  setCompanyStores(companyAId, [
    { id: targetStore1.id, name: targetStore1.name },
    { id: targetStore2.id, name: targetStore2.name },
  ]);

  const postSmImport = (body: unknown) =>
    postImportRoute(
      new Request('http://localhost:3000/api/import', {
        method: 'POST',
        headers: {
          Cookie: `stocksentinel_session=${smToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    );

  // 1. Store Manager CANNOT import store or product catalog
  const resStoreCatalog = await postSmImport({
    entityType: 'stores',
    records: [{ code: 'NEW-999', name: 'New Store', location: 'Nowhere' }],
  });
  assert.equal(resStoreCatalog.status, 403);
  const dataStoreCatalog = await resStoreCatalog.json();
  assert.match(dataStoreCatalog.error, /Store managers are not authorized/i);

  const resProdCatalog = await postSmImport({
    entityType: 'products',
    records: [{ sku: 'SKU-NEW', name: 'New Product' }],
  });
  assert.equal(resProdCatalog.status, 403);

  // 2. Store Manager CANNOT import sales for unassigned Store 2
  const resSalesUnassigned = await postSmImport({
    entityType: 'daily_sales',
    records: [
      {
        store_id: targetStore2.code, // Store 2 code
        sku: targetProd.sku,
        date: '2026-10-28',
        units_sold: 5,
      },
    ],
  });
  assert.equal(resSalesUnassigned.status, 403);
  const dataSalesUnassigned = await resSalesUnassigned.json();
  assert.match(dataSalesUnassigned.error, /Store managers can only import records for their assigned store/i);

  // 3. Store Manager CAN import sales for assigned Store 1 using store code
  const resSalesCode = await postSmImport({
    entityType: 'daily_sales',
    records: [
      {
        store_id: targetStore1.code, // Store 1 code
        sku: targetProd.sku,
        date: '2026-10-28',
        units_sold: 7,
        revenue: 13.93,
      },
    ],
  });
  assert.equal(resSalesCode.status, 200);
  const dataSalesCode = await resSalesCode.json();
  assert.equal(dataSalesCode.success, true);
  assert.equal(dataSalesCode.inserted, 1);

  // 4. Store Manager CAN import sales for assigned Store 1 using store UUID
  const resSalesUuid = await postSmImport({
    entityType: 'daily_sales',
    records: [
      {
        store_id: targetStore1.id, // Store 1 UUID
        sku: targetProd.sku,
        date: '2026-10-29',
        units_sold: 4,
        revenue: 7.96,
      },
    ],
  });
  assert.equal(resSalesUuid.status, 200);
  const dataSalesUuid = await resSalesUuid.json();
  assert.equal(dataSalesUuid.success, true);
  assert.equal(dataSalesUuid.inserted, 1);
});

test('8. Alert Triage: Store Manager can verify alerts for assigned store only', async () => {
  clearRbacCaches();

  const mem = getMemoryStore();
  const ownAlert = mem.alerts[0];
  const otherAlert = mem.alerts.find((a) => a.store_id !== ownAlert.store_id) || {
    id: crypto.randomUUID(),
    run_id: crypto.randomUUID(),
    store_id: 'store-002',
    store_name: 'Metro Express Market #204',
    product_id: crypto.randomUUID(),
    sku: 'SKU-104',
    product_name: 'Electrolyte Citrus Rush 16oz',
    category: 'Beverages',
    unit_price: 2.99,
    risk_score: 95,
    risk_category: 'CRITICAL',
    consecutive_zero_days: 3,
    recorded_stock: 20,
    expected_daily_sales: 5.5,
    est_lost_revenue_daily: 16.45,
    poisson_anomaly_p: 0.0001,
    is_on_promotion: false,
    primary_reason: 'Zero sales streak',
    status: 'OPEN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!mem.alerts.some((a) => a.id === otherAlert.id)) {
    mem.alerts.push(otherAlert as Alert);
  }
  const companyId = '00000000-0000-0000-0000-000000000001';

  const smUser = await createUser({
    email: `sm_triage_${Date.now()}@company.com`,
    name: 'SM Triage Lead',
  });
  const smToken = await createSession(smUser);
  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Company Retail',
    companySlug: 'company-retail',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: ownAlert.store_id,
    storeName: ownAlert.store_name,
  });

  const patchAlert = (body: unknown) =>
    patchAlertRoute(
      new Request('http://localhost:3000/api/alerts', {
        method: 'PATCH',
        headers: {
          Cookie: `stocksentinel_session=${smToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    );

  // 1. Store Manager CAN update alert for assigned store
  const resA = await patchAlert({
    alertId: ownAlert.id,
    status: 'VERIFIED',
    outcome: 'PHANTOM_CONFIRMED',
    notes: 'Zero stock found on peg hook during audit walk.',
    shelfCount: 0,
  });
  assert.equal(resA.status, 200);
  const dataA = await resA.json();
  assert.equal(dataA.success, true);
  assert.equal(dataA.alert.status, 'VERIFIED');
  assert.equal(dataA.alert.verification_outcome, 'PHANTOM_CONFIRMED');

  // 2. Store Manager CANNOT update alert for unassigned other store
  const resB = await patchAlert({
    alertId: otherAlert.id,
    status: 'VERIFIED',
    outcome: 'FALSE_POSITIVE',
  });
  assert.equal(resB.status, 403);
  const dataB = await resB.json();
  assert.match(dataB.error, /You are not authorized to update alerts for this store/i);
});
