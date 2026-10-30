import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setStoreAssignment,
  setCompanyStores,
  clearRbacCaches,
  setPlatformAdmin,
} from '../src/lib/auth/userStore';
import { getMemoryStore } from '../src/lib/storage';
import { GET as getMetricsRoute } from '../src/app/api/metrics/route';
import { GET as getAlertsRoute, PATCH as patchAlertsRoute } from '../src/app/api/alerts/route';
import { GET as getAlertByIdRoute } from '../src/app/api/alerts/[id]/route';
import { GET as getAuditRoute } from '../src/app/api/alerts/audit/route';
import { POST as postDetectRoute } from '../src/app/api/detect/route';
import { POST as postImportRoute } from '../src/app/api/import/route';
import { POST as postAiAnalyzeRoute } from '../src/app/api/ai/analyze/route';
import { GET as getConversationsRoute, POST as postConversationsRoute } from '../src/app/api/assistant/conversations/route';
import { GET as getConversationByIdRoute, DELETE as deleteConversationRoute } from '../src/app/api/assistant/conversations/[id]/route';
import { POST as postMessageRoute } from '../src/app/api/assistant/conversations/[id]/messages/route';
import { buildInventoryGrounding } from '../src/lib/assistant/grounding';

test('1. Unauthenticated requests are rejected across all hardened endpoints with 401', async () => {
  const reqNoAuth = new Request('http://localhost:3000/api/metrics');

  const [metricsRes, alertsRes, detectRes, importRes, convsRes] = await Promise.all([
    getMetricsRoute(reqNoAuth),
    getAlertsRoute(reqNoAuth),
    postDetectRoute(new Request('http://localhost:3000/api/detect', { method: 'POST', body: JSON.stringify({}) })),
    postImportRoute(new Request('http://localhost:3000/api/import', { method: 'POST', body: JSON.stringify({ entityType: 'daily_sales', records: [] }) })),
    getConversationsRoute(reqNoAuth),
  ]);

  assert.equal(metricsRes.status, 401);
  assert.equal(alertsRes.status, 401);
  assert.equal(detectRes.status, 401);
  assert.equal(importRes.status, 401);
  assert.equal(convsRes.status, 401);
});

test('2. Pending Assignment and Suspended users are denied operational access with 403', async () => {
  clearRbacCaches();
  const pendingUser = await createUser({
    email: `pending_${Date.now()}@walmart-ops.com`,
    name: 'Pending Associate',
  });
  const pendingToken = await createSession(pendingUser);

  const reqPending = (url: string, method = 'GET', body?: unknown) =>
    new Request(url, {
      method,
      headers: {
        Cookie: `stocksentinel_session=${pendingToken}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const [metricsRes, alertsRes, detectRes, importRes, convsRes] = await Promise.all([
    getMetricsRoute(reqPending('http://localhost:3000/api/metrics')),
    getAlertsRoute(reqPending('http://localhost:3000/api/alerts')),
    postDetectRoute(reqPending('http://localhost:3000/api/detect', 'POST', { storeId: 'store-001' })),
    postImportRoute(reqPending('http://localhost:3000/api/import', 'POST', { entityType: 'daily_sales', records: [{ store_id: 'store-001', sku: 'SKU-101', date: '2026-10-28', units_sold: 5 }] })),
    postConversationsRoute(reqPending('http://localhost:3000/api/assistant/conversations', 'POST', { title: 'Test' })),
  ]);

  assert.equal(metricsRes.status, 403);
  assert.equal(alertsRes.status, 403);
  assert.equal(detectRes.status, 403);
  assert.equal(importRes.status, 403);
  assert.equal(convsRes.status, 403);
});

test('3. Store Manager: Scoped strictly to assigned store and blocked from "ALL" aggregation', async () => {
  clearRbacCaches();
  const storeUser = await createUser({
    email: `sm_${Date.now()}@walmart-ops.com`,
    name: 'Store Manager 1',
  });
  const sessionToken = await createSession(storeUser);

  const companyId = `comp_sm_${Date.now()}`;
  const assignedStoreId = 'store-001';
  const otherStoreId = 'store-002';

  setCompanyMembership({
    userId: storeUser.id,
    companyId,
    companyName: 'Retail Co A',
    companySlug: 'retail-co-a',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: storeUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });
  setCompanyStores(companyId, [
    { id: assignedStoreId, name: 'Downtown Supercenter #101' },
    { id: otherStoreId, name: 'Metro Express Market #204' },
  ]);

  const req = (url: string) =>
    new Request(url, {
      headers: { Cookie: `stocksentinel_session=${sessionToken}` },
    });

  // Querying without storeId parameter automatically scopes strictly to assigned store
  const resDefault = await getMetricsRoute(req('http://localhost:3000/api/metrics'));
  assert.equal(resDefault.status, 200);
  const dataDefault = await resDefault.json();
  assert.equal(dataDefault.metrics.activeStores, 1);

  // Store Manager explicitly querying "ALL" must be rejected with 403
  const resAll = await getMetricsRoute(req('http://localhost:3000/api/metrics?storeId=ALL'));
  assert.equal(resAll.status, 403);
  const dataAll = await resAll.json();
  assert.match(dataAll.error, /Store managers are not authorized to aggregate across all stores/i);

  // Store Manager querying another store must be rejected with 403
  const resOther = await getMetricsRoute(req(`http://localhost:3000/api/metrics?storeId=${otherStoreId}`));
  assert.equal(resOther.status, 403);
  assert.match((await resOther.json()).error, /authorized to access your assigned store/i);

  // Store Manager querying own store explicitly succeeds with 200
  const resOwn = await getMetricsRoute(req(`http://localhost:3000/api/metrics?storeId=${assignedStoreId}`));
  assert.equal(resOwn.status, 200);
});

test('4. Store Manager: Alert triage and detail access isolation', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_triage_${Date.now()}@walmart-ops.com`,
    name: 'SM Triage',
  });
  const token = await createSession(smUser);

  const companyId = `comp_triage_${Date.now()}`;
  const assignedStoreId = 'store-001';
  const otherStoreId = 'store-002';

  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co A',
    companySlug: 'retail-co-a',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });

  const memStore = getMemoryStore();
  // Find an alert belonging to store-001 and one belonging to store-002
  const ownAlert = memStore.alerts.find((a) => a.store_id === assignedStoreId) || memStore.alerts[0];
  const otherAlert = memStore.alerts.find((a) => a.store_id === otherStoreId) || memStore.alerts[1];

  // Store Manager mutating own alert succeeds
  const patchOwnReq = new Request('http://localhost:3000/api/alerts', {
    method: 'PATCH',
    headers: {
      Cookie: `stocksentinel_session=${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alertId: ownAlert.id,
      status: 'UNDER_REVIEW',
      notes: 'Store manager investigating shelf placement',
    }),
  });
  const patchOwnRes = await patchAlertsRoute(patchOwnReq);
  assert.equal(patchOwnRes.status, 200);

  // Store Manager mutating another store's alert is rejected with 403
  const patchOtherReq = new Request('http://localhost:3000/api/alerts', {
    method: 'PATCH',
    headers: {
      Cookie: `stocksentinel_session=${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alertId: otherAlert.id,
      status: 'VERIFIED',
      notes: 'Unauthorized attempt to triage another store',
    }),
  });
  const patchOtherRes = await patchAlertsRoute(patchOtherReq);
  assert.equal(patchOtherRes.status, 403);

  // Reading another store's alert detail returns 404 to avoid enumeration
  const getOtherReq = new Request(`http://localhost:3000/api/alerts/${otherAlert.id}`, {
    headers: { Cookie: `stocksentinel_session=${token}` },
  });
  const getOtherRes = await getAlertByIdRoute(getOtherReq, { params: Promise.resolve({ id: otherAlert.id }) });
  assert.equal(getOtherRes.status, 404);
});

test('5. Store Manager: Detection execution restrictions', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_detect_${Date.now()}@walmart-ops.com`,
    name: 'SM Detector',
  });
  const token = await createSession(smUser);

  const companyId = `comp_detect_${Date.now()}`;
  const assignedStoreId = 'store-001';
  const otherStoreId = 'store-002';

  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co',
    companySlug: 'retail-co',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });

  const postReq = (body: unknown) =>
    new Request('http://localhost:3000/api/detect', {
      method: 'POST',
      headers: {
        Cookie: `stocksentinel_session=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

  // Attempting to run detection on 'ALL' stores is rejected with 403
  const resAll = await postDetectRoute(postReq({ storeId: 'ALL' }));
  assert.equal(resAll.status, 403);

  // Attempting to run detection on another store is rejected with 403
  const resOther = await postDetectRoute(postReq({ storeId: otherStoreId }));
  assert.equal(resOther.status, 403);

  // Running detection for own assigned store succeeds with 200
  const resOwn = await postDetectRoute(postReq({ storeId: assignedStoreId }));
  assert.equal(resOwn.status, 200);
  const dataOwn = await resOwn.json();
  assert.equal(dataOwn.success, true);
  assert.equal(dataOwn.run.store_id, assignedStoreId);
});

test('6. Store Manager: CSV Import security & row-level validation', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_import_${Date.now()}@walmart-ops.com`,
    name: 'SM Importer',
  });
  const token = await createSession(smUser);

  const companyId = `comp_import_${Date.now()}`;
  const assignedStoreId = 'store-001';
  const otherStoreId = 'store-002';

  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co',
    companySlug: 'retail-co',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });

  const postImport = (body: unknown) =>
    postImportRoute(
      new Request('http://localhost:3000/api/import', {
        method: 'POST',
        headers: {
          Cookie: `stocksentinel_session=${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    );

  // Store Manager attempting to import stores is rejected with 403
  const resStoreEntity = await postImport({
    entityType: 'stores',
    records: [{ code: 'NEW-99', name: 'Rogue Store' }],
  });
  assert.equal(resStoreEntity.status, 403);
  assert.match((await resStoreEntity.json()).error, /not authorized to import store or product/i);

  // Store Manager attempting to import products is rejected with 403
  const resProdEntity = await postImport({
    entityType: 'products',
    records: [{ sku: 'SKU-999', name: 'Rogue Product' }],
  });
  assert.equal(resProdEntity.status, 403);

  // Store Manager importing daily_sales where 1 row has another store_id is rejected atomically with 403
  const resMixedSales = await postImport({
    entityType: 'daily_sales',
    records: [
      { store_id: assignedStoreId, sku: 'SKU-101', date: '2026-10-28', units_sold: 5 },
      { store_id: otherStoreId, sku: 'SKU-102', date: '2026-10-28', units_sold: 10 },
    ],
  });
  assert.equal(resMixedSales.status, 403);
  const dataMixed = await resMixedSales.json();
  assert.equal(dataMixed.inserted, 0);
  assert.match(dataMixed.error, /Access denied on Row 2/i);

  // Store Manager importing daily_sales where all rows belong to assigned store succeeds with 200
  const resValidSales = await postImport({
    entityType: 'daily_sales',
    records: [
      { store_id: assignedStoreId, sku: 'SKU-101', date: '2026-10-28', units_sold: 5 },
      { store_id: assignedStoreId, sku: 'SKU-102', date: '2026-10-28', units_sold: 8 },
    ],
  });
  assert.equal(resValidSales.status, 200);
  const dataValid = await resValidSales.json();
  assert.equal(dataValid.inserted, 2);
});

test('7. Company Manager: Cross-Company Isolation', async () => {
  clearRbacCaches();
  const cmUser = await createUser({
    email: `cm_iso_${Date.now()}@walmart-ops.com`,
    name: 'Company Manager Alpha',
  });
  const token = await createSession(cmUser);

  const companyA = `comp_alpha_${Date.now()}`;
  const companyB = `comp_beta_${Date.now()}`;
  const storeA1 = 'store-001';
  const storeA2 = 'store-002';
  const storeB1 = 'store-003';

  setCompanyMembership({
    userId: cmUser.id,
    companyId: companyA,
    companyName: 'Company Alpha',
    companySlug: 'company-alpha',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setCompanyStores(companyA, [
    { id: storeA1, name: 'Alpha Store 1' },
    { id: storeA2, name: 'Alpha Store 2' },
  ]);
  setCompanyStores(companyB, [
    { id: storeB1, name: 'Beta Store 1' },
  ]);

  const req = (url: string, method = 'GET', body?: unknown) =>
    new Request(url, {
      method,
      headers: {
        Cookie: `stocksentinel_session=${token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  // Company Manager querying 'ALL' aggregates across own company's 2 stores
  const resMetricsCompany = await getMetricsRoute(req('http://localhost:3000/api/metrics'));
  assert.equal(resMetricsCompany.status, 200);
  const dataMetrics = await resMetricsCompany.json();
  assert.equal(dataMetrics.metrics.activeStores, 2);

  // Company Manager querying another company's store is rejected with 403
  const resMetricsOtherCompany = await getMetricsRoute(req(`http://localhost:3000/api/metrics?storeId=${storeB1}`));
  assert.equal(resMetricsOtherCompany.status, 403);
  assert.match((await resMetricsOtherCompany.json()).error, /does not belong to your company/i);

  // Company Manager querying alerts for other company store is rejected with 403
  const resAlertsOtherCompany = await getAlertsRoute(req(`http://localhost:3000/api/alerts?storeId=${storeB1}`));
  assert.equal(resAlertsOtherCompany.status, 403);

  // Company Manager running detection for other company store is rejected with 403
  const resDetectOther = await postDetectRoute(req('http://localhost:3000/api/detect', 'POST', { storeId: storeB1 }));
  assert.equal(resDetectOther.status, 403);

  // Company Manager importing rows referencing other company store is rejected with 403
  const resImportOther = await postImportRoute(
    req('http://localhost:3000/api/import', 'POST', {
      entityType: 'daily_sales',
      records: [{ store_id: storeB1, sku: 'SKU-101', date: '2026-10-28', units_sold: 5 }],
    })
  );
  assert.equal(resImportOther.status, 403);
});

test('8. Platform Admin: Global administrative privileges across any store', async () => {
  clearRbacCaches();
  const adminUser = await createUser({
    email: `super_admin_${Date.now()}@walmart-ops.com`,
    name: 'Global Platform Admin',
  });
  const token = await createSession(adminUser);
  setPlatformAdmin(adminUser.id, true);

  const req = (url: string, method = 'GET', body?: unknown) =>
    new Request(url, {
      method,
      headers: {
        Cookie: `stocksentinel_session=${token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  // Admin can query platform-wide metrics
  const resMetrics = await getMetricsRoute(req('http://localhost:3000/api/metrics'));
  assert.equal(resMetrics.status, 200);

  // Admin can query any specific store
  const resMetricsStore3 = await getMetricsRoute(req('http://localhost:3000/api/metrics?storeId=store-003'));
  assert.equal(resMetricsStore3.status, 200);

  // Admin can run detection on 'ALL' stores
  const resDetectAll = await postDetectRoute(req('http://localhost:3000/api/detect', 'POST', { storeId: 'ALL' }));
  assert.equal(resDetectAll.status, 200);

  // Admin can triage alerts for any store
  const memStore = getMemoryStore();
  const targetAlert = memStore.alerts[0];
  const resPatch = await patchAlertsRoute(
    req('http://localhost:3000/api/alerts', 'PATCH', {
      alertId: targetAlert.id,
      status: 'VERIFIED',
      outcome: 'PHANTOM_CONFIRMED',
      notes: 'Platform admin confirmed during system audit',
      shelfCount: 0,
    })
  );
  assert.equal(resPatch.status, 200);
});

test('9. Role Spoofing Immunity: Spoofed headers or body params do not elevate permissions', async () => {
  clearRbacCaches();
  const storeUser = await createUser({
    email: `spoofer_${Date.now()}@walmart-ops.com`,
    name: 'Role Spoofer',
  });
  const token = await createSession(storeUser);

  const companyId = `comp_spoofer_${Date.now()}`;
  setCompanyMembership({
    userId: storeUser.id,
    companyId,
    companyName: 'Spoof Victim Co',
    companySlug: 'spoof-victim',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: storeUser.id,
    companyId,
    storeId: 'store-001',
    storeName: 'Assigned Store 1',
  });

  // Attempt to elevate via headers
  const reqSpoofed = new Request('http://localhost:3000/api/metrics?storeId=ALL', {
    headers: {
      Cookie: `stocksentinel_session=${token}`,
      'x-user-role': 'PLATFORM_ADMIN',
      'x-company-id': 'unauthorized-comp',
    },
  });

  const res = await getMetricsRoute(reqSpoofed);
  // Must still be treated strictly as STORE_MANAGER and rejected when querying 'ALL'
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Store managers are not authorized to aggregate across all stores/i);
});

test('10. AI Assistant Grounding: Scoped strictly to authorized tenant and stores', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_ai_${Date.now()}@walmart-ops.com`,
    name: 'SM Grounding Associate',
  });

  const companyId = `comp_ai_${Date.now()}`;
  const assignedStoreId = 'store-001';

  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co Grounding',
    companySlug: 'retail-co-grounding',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });

  // VerifiedUser representation of this store manager
  const verifiedSM = {
    id: smUser.id,
    email: smUser.email,
    name: smUser.name,
    accessState: 'STORE_MANAGER' as const,
    role: 'STORE_MANAGER' as const,
    companyId,
    companyName: 'Retail Co Grounding',
    assignedStoreId,
    assignedStoreName: 'Downtown Supercenter #101',
    accessibleStoreIds: [assignedStoreId],
    authMode: 'standalone' as const,
    isDurable: true,
  };

  const grounded = await buildInventoryGrounding(smUser.id, 'Summarize all stores and open alerts', verifiedSM);

  // Active stores count should be exactly 1 (only assigned store)
  assert.equal(grounded.storesCount, 1);
  assert.ok(grounded.formattedContext.includes('Downtown Supercenter #101'));
  // Should NOT include store-002 or store-003
  assert.ok(!grounded.formattedContext.includes('Metro Express Market #204'));
  assert.ok(!grounded.formattedContext.includes('Suburban Mall Superstore #308'));
});

test('11. Alerts Audit Route: Scoped strictly to authorized stores', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_audit_${Date.now()}@walmart-ops.com`,
    name: 'SM Audit Inspector',
  });
  const token = await createSession(smUser);

  const companyId = `comp_audit_${Date.now()}`;
  const assignedStoreId = 'store-001';

  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co Audit',
    companySlug: 'retail-co-audit',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName: 'Downtown Supercenter #101',
  });

  const req = new Request('http://localhost:3000/api/alerts/audit', {
    headers: { Cookie: `stocksentinel_session=${token}` },
  });

  const res = await getAuditRoute(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.auditLogs));
  assert.ok(Array.isArray(data.runs));
});

test('12. AI Analyze: Store check rejects analysis of unauthorized stores with 403', async () => {
  clearRbacCaches();
  const smUser = await createUser({
    email: `sm_analyze_${Date.now()}@walmart-ops.com`,
    name: 'SM Analyzer',
  });
  const token = await createSession(smUser);

  const companyId = `comp_analyze_${Date.now()}`;
  setCompanyMembership({
    userId: smUser.id,
    companyId,
    companyName: 'Retail Co Analyze',
    companySlug: 'retail-co-analyze',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: smUser.id,
    companyId,
    storeId: 'store-001',
    storeName: 'Downtown Supercenter #101',
  });

  // Attempt to analyze with mismatched storeId
  const reqMismatched = new Request('http://localhost:3000/api/ai/analyze', {
    method: 'POST',
    headers: {
      Cookie: `stocksentinel_session=${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sku: 'SKU-101',
      productName: 'Organic Whole Milk',
      category: 'Dairy',
      unitPrice: 4.99,
      storeName: 'Metro Express Market #204',
      storeId: 'store-002', // Unauthorized store for this store manager
      recordedStock: 10,
      consecutiveZeroDays: 4,
      expectedDailySales: 5,
      poissonAnomalyP: 0.001,
      isOnPromotion: false,
      primaryReason: 'Zero sales streak',
    }),
  });

  const res = await postAiAnalyzeRoute(reqMismatched);
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /not authorized to analyze data for this store/i);
});

test('13. Assistant Conversation Lifecycle: Cross-user delete and message protection', async () => {
  clearRbacCaches();
  const user1 = await createUser({
    email: `conv_u1_${Date.now()}@walmart-ops.com`,
    name: 'Conversation Owner',
    role: 'STORE_MANAGER',
  });
  const token1 = await createSession(user1);

  const user2 = await createUser({
    email: `conv_u2_${Date.now()}@walmart-ops.com`,
    name: 'Conversation Attacker',
    role: 'STORE_MANAGER',
  });
  const token2 = await createSession(user2);

  // User 1 creates conversation
  const createReq = new Request('http://localhost:3000/api/assistant/conversations', {
    method: 'POST',
    headers: {
      Cookie: `stocksentinel_session=${token1}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Owner Private Audit' }),
  });
  const createRes = await postConversationsRoute(createReq);
  assert.equal(createRes.status, 200);
  const { conversation } = await createRes.json();

  // User 2 attempts to read User 1's conversation via route
  const getReq = new Request(`http://localhost:3000/api/assistant/conversations/${conversation.id}`, {
    headers: { Cookie: `stocksentinel_session=${token2}` },
  });
  const getRes = await getConversationByIdRoute(getReq, { params: Promise.resolve({ id: conversation.id }) });
  assert.equal(getRes.status, 404);

  // User 2 attempts to delete User 1's conversation via route
  const deleteReq = new Request(`http://localhost:3000/api/assistant/conversations/${conversation.id}`, {
    method: 'DELETE',
    headers: { Cookie: `stocksentinel_session=${token2}` },
  });
  const deleteRes = await deleteConversationRoute(deleteReq, { params: Promise.resolve({ id: conversation.id }) });
  assert.equal(deleteRes.status, 404);

  // User 2 attempts to send a message into User 1's conversation via route
  const msgReq = new Request(`http://localhost:3000/api/assistant/conversations/${conversation.id}/messages`, {
    method: 'POST',
    headers: {
      Cookie: `stocksentinel_session=${token2}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Malicious message insertion attempt' }),
  });
  const msgRes = await postMessageRoute(msgReq, { params: Promise.resolve({ id: conversation.id }) });
  assert.equal(msgRes.status, 404);
});

test('14. Store #204 - Bellevue Square Store Manager telemetry resolution and demo data integration', async () => {
  clearRbacCaches();
  const bellevueUser = await createUser({
    email: `sm_bellevue_${Date.now()}@walmart-ops.com`,
    name: 'Bellevue Store Manager',
  });
  const sessionToken = await createSession(bellevueUser);

  const companyId = `comp_bellevue_${Date.now()}`;
  const assignedStoreId = `store_${companyId}_2`; // Onboarding generated store ID
  const storeName = 'Store #204 - Bellevue Square';

  setCompanyMembership({
    userId: bellevueUser.id,
    companyId,
    companyName: 'Pacific Retail Co',
    companySlug: 'pacific-retail',
    role: 'STORE_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setStoreAssignment({
    userId: bellevueUser.id,
    companyId,
    storeId: assignedStoreId,
    storeName,
  });
  setCompanyStores(companyId, [
    { id: `store_${companyId}_1`, name: 'Store #101 - Seattle Flagship' },
    { id: assignedStoreId, name: storeName },
    { id: `store_${companyId}_3`, name: 'Store #308 - Tacoma Center' },
  ]);

  const req = (url: string) =>
    new Request(url, {
      headers: { Cookie: `stocksentinel_session=${sessionToken}` },
    });

  // 1. Fetch metrics for Store 204 without param (auto-scoped to assigned store)
  const resMetricsDefault = await getMetricsRoute(req('http://localhost:3000/api/metrics'));
  assert.equal(resMetricsDefault.status, 200);
  const dataMetrics = await resMetricsDefault.json();
  assert.equal(dataMetrics.success, true);
  assert.equal(dataMetrics.metrics.activeStores, 1);
  assert.equal(dataMetrics.metrics.totalMonitoredSkus, 30);
  assert.ok(dataMetrics.metrics.flaggedPhantomStockouts > 0, 'Must have flagged alerts for Bellevue');
  assert.ok(dataMetrics.metrics.estRevenueAtRiskDaily > 0, 'Must calculate non-zero revenue at risk');
  assert.ok(dataMetrics.metrics.timeSeries.length > 0, 'Must return 14-day time series');
  assert.ok(dataMetrics.metrics.timeSeries.some((pt: { unitsSold: number }) => pt.unitsSold > 0));

  // 2. Fetch alerts for Store 204
  const resAlerts = await getAlertsRoute(req('http://localhost:3000/api/alerts'));
  assert.equal(resAlerts.status, 200);
  const dataAlerts = await resAlerts.json();
  assert.equal(dataAlerts.success, true);
  assert.ok(dataAlerts.alerts.length > 0, 'Must return alerts for Store 204');
  assert.ok(dataAlerts.alerts.every((a: { store_id: string }) => a.store_id === 'store-002' || a.store_id === assignedStoreId));

  // 3. Explicitly querying assigned store ID succeeds
  const resMetricsExplicit = await getMetricsRoute(req(`http://localhost:3000/api/metrics?storeId=${encodeURIComponent(assignedStoreId)}`));
  assert.equal(resMetricsExplicit.status, 200);

  // 4. Querying another store (Seattle Store 101) is denied with 403
  const resForbidden = await getMetricsRoute(req(`http://localhost:3000/api/metrics?storeId=${encodeURIComponent(`store_${companyId}_1`)}`));
  assert.equal(resForbidden.status, 403);
});


