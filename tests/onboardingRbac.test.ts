import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createUser,
  createSession,
  clearRbacCaches,
  setPlatformAdmin,
  createStandaloneInvitation,
  hashInvitationToken,
} from '../src/lib/auth/userStore';
import { POST as postCompanyOnboardRoute } from '../src/app/api/company/onboard/route';
import {
  GET as getCompanyStoresRoute,
  POST as postCompanyStoresRoute,
} from '../src/app/api/company/stores/route';
import {
  GET as getCompanyInvitationsRoute,
  POST as postCompanyInvitationsRoute,
} from '../src/app/api/company/invitations/route';
import { GET as getInvitationByTokenRoute } from '../src/app/api/invitations/[token]/route';
import { POST as postAcceptInvitationRoute } from '../src/app/api/invitations/accept/route';
import { GET as getAdminCompaniesRoute } from '../src/app/api/admin/companies/route';
import { PATCH as patchAdminCompanyRoute } from '../src/app/api/admin/companies/[id]/route';
import { GET as getAdminPlatformAdminsRoute } from '../src/app/api/admin/platform-admins/route';
import { GET as getSessionRoute } from '../src/app/api/auth/session/route';

test('1. Company Onboarding: Validation and security bounds', async () => {
  clearRbacCaches();

  // A. Unauthenticated request rejected with 401
  const reqNoAuth = new Request('http://localhost:3000/api/company/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Corp', slug: 'test-corp' }),
  });
  const resNoAuth = await postCompanyOnboardRoute(reqNoAuth);
  assert.equal(resNoAuth.status, 401);

  // Authenticated user (pending assignment)
  const user = await createUser({
    email: `founder_${Date.now()}@apexretail.com`,
    name: 'Founder User',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  // B. Enforce company name length
  const reqShortName = new Request('http://localhost:3000/api/company/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'A', slug: 'apex-retail', maxStores: 3 }),
  });
  const resShortName = await postCompanyOnboardRoute(reqShortName);
  assert.equal(resShortName.status, 400);

  // C. Enforce slug format (invalid characters)
  const reqBadSlug = new Request('http://localhost:3000/api/company/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Apex Retail', slug: 'Apex Retail!', maxStores: 3 }),
  });
  const resBadSlug = await postCompanyOnboardRoute(reqBadSlug);
  assert.equal(resBadSlug.status, 400);

  // D. Enforce store capacity limit (1 to 20)
  const reqOverLimit = new Request('http://localhost:3000/api/company/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Apex Retail', slug: 'apex-retail', maxStores: 25 }),
  });
  const resOverLimit = await postCompanyOnboardRoute(reqOverLimit);
  assert.equal(resOverLimit.status, 400);
});

test('2. Atomic Onboarding: Company creation, manager elevation, and invitation token generation', async () => {
  clearRbacCaches();

  const user = await createUser({
    email: `founder2_${Date.now()}@apexretail.com`,
    name: 'Executive Manager',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  const reqOnboard = new Request('http://localhost:3000/api/company/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Apex Retail Group',
      slug: `apex-retail-${Date.now()}`,
      maxStores: 3,
      stores: [
        { name: 'Seattle Flagship #101', location: 'Seattle, WA', managerEmail: 'sarah.chen@apexretail.com' },
        { name: 'Bellevue Center #204', location: 'Bellevue, WA', managerEmail: 'alex.m@apexretail.com' },
        { name: 'Tacoma Square #308', location: 'Tacoma, WA' },
      ],
    }),
  });

  const resOnboard = await postCompanyOnboardRoute(reqOnboard);
  assert.equal(resOnboard.status, 200);

  const data = await resOnboard.json();
  assert.equal(data.success, true);
  assert.equal(data.company.name, 'Apex Retail Group');
  assert.equal(data.stores.length, 3);
  assert.equal(data.invitations.length, 2);

  // Verify single-use token structure
  const inv1 = data.invitations[0];
  assert.ok(inv1.rawToken && inv1.rawToken.length >= 32);
  assert.ok(inv1.inviteUrl.includes('/invite/accept?token='));
  assert.equal(inv1.managerEmail, 'sarah.chen@apexretail.com');

  // Verify caller is elevated to COMPANY_MANAGER in session resolution
  const sessionReq = new Request('http://localhost:3000/api/auth/session', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sessionRes = await getSessionRoute(sessionReq);
  const sessionData = await sessionRes.json();

  assert.equal(sessionData.user.accessState, 'COMPANY_MANAGER');
  assert.equal(sessionData.user.companyId, data.company.id);
  assert.equal(sessionData.user.companyName, 'Apex Retail Group');
  assert.equal(sessionData.user.accessibleStoreIds.length, 3);
});

test('3. Duplicate Slug Protection: Cannot hijack existing company slug', async () => {
  const user = await createUser({
    email: `founder3_${Date.now()}@competitor.com`,
    name: 'Competitor Founder',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  const fixedSlug = `fixed-slug-${Date.now()}`;

  // First creation succeeds
  const res1 = await postCompanyOnboardRoute(
    new Request('http://localhost:3000/api/company/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'First Company',
        slug: fixedSlug,
        maxStores: 2,
        stores: [{ name: 'Store 1' }],
      }),
    })
  );
  assert.equal(res1.status, 200);

  // Second user attempts to register with duplicate slug
  const user2 = await createUser({
    email: `founder4_${Date.now()}@other.com`,
    name: 'Impostor User',
    role: 'PENDING_ASSIGNMENT',
  });
  const token2 = await createSession(user2);

  const res2 = await postCompanyOnboardRoute(
    new Request('http://localhost:3000/api/company/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({
        name: 'Impostor Company',
        slug: fixedSlug,
        maxStores: 2,
        stores: [{ name: 'Store 1' }],
      }),
    })
  );
  assert.equal(res2.status, 409);
  const data2 = await res2.json();
  assert.match(data2.error, /already in use/i);
});

test('4. Store Management: Quota enforcement and Store Manager isolation', async () => {
  clearRbacCaches();

  const user = await createUser({
    email: `manager_${Date.now()}@storesco.com`,
    name: 'Retail Ops VP',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  // Onboard with maxStores = 2
  const onboardRes = await postCompanyOnboardRoute(
    new Request('http://localhost:3000/api/company/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Two Store Chain',
        slug: `chain-${Date.now()}`,
        maxStores: 2,
        stores: [{ name: 'Store A' }, { name: 'Store B' }],
      }),
    })
  );
  assert.equal(onboardRes.status, 200);

  // Retrieve stores as Company Manager
  const getStoresReq = new Request('http://localhost:3000/api/company/stores', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const getStoresRes = await getCompanyStoresRoute(getStoresReq);
  assert.equal(getStoresRes.status, 200);
  const storesData = await getStoresRes.json();
  assert.equal(storesData.stores.length, 2);
  assert.equal(storesData.maxStores, 2);

  // Attempt to add a 3rd store beyond maxStores quota
  const addStoreOverQuota = new Request('http://localhost:3000/api/company/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Store C (Exceeds limit)' }),
  });
  const addStoreRes = await postCompanyStoresRoute(addStoreOverQuota);
  assert.equal(addStoreRes.status, 400);
  const errData = await addStoreRes.json();
  assert.match(errData.error, /Store limit reached/i);

  // Unauthorized user (e.g. standard store manager) cannot access company stores API
  const smUser = await createUser({
    email: `sm_${Date.now()}@storesco.com`,
    name: 'Store Manager User',
    role: 'STORE_MANAGER',
  });
  const smToken = await createSession(smUser);

  const smGetRes = await getCompanyStoresRoute(
    new Request('http://localhost:3000/api/company/stores', {
      headers: { Authorization: `Bearer ${smToken}` },
    })
  );
  assert.equal(smGetRes.status, 403);
});

test('5. Single-Use Invitation Validation & Cryptographic Hash Security', async () => {
  clearRbacCaches();

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);

  createStandaloneInvitation({
    companyId: 'comp_test_inv',
    companyName: 'Invited Corp',
    storeId: 'store_101',
    storeName: 'Northgate Supercenter',
    email: 'newmanager@invitedcorp.com',
    role: 'STORE_MANAGER',
    tokenHash,
    invitedBy: 'usr_founder',
    expiresInDays: 7,
  });

  // A. Valid token lookup returns safe metadata (tokenHash is never leaked)
  const reqValid = new Request(`http://localhost:3000/api/invitations/${rawToken}`);
  const resValid = await getInvitationByTokenRoute(reqValid, { params: Promise.resolve({ token: rawToken }) });
  assert.equal(resValid.status, 200);
  const validData = await resValid.json();
  assert.equal(validData.valid, true);
  assert.equal(validData.invitation.email, 'newmanager@invitedcorp.com');
  assert.equal(validData.invitation.companyName, 'Invited Corp');
  assert.equal(validData.invitation.storeName, 'Northgate Supercenter');
  assert.equal(validData.invitation.tokenHash, undefined);

  // B. Invalid raw token lookup returns 404
  const reqBadToken = new Request('http://localhost:3000/api/invitations/invalid_random_token_12345');
  const resBadToken = await getInvitationByTokenRoute(reqBadToken, { params: Promise.resolve({ token: 'invalid_random_token_12345' }) });
  assert.equal(resBadToken.status, 404);

  // C. Expired token lookup returns 410
  const expiredRawToken = crypto.randomBytes(32).toString('hex');
  const expiredTokenHash = hashInvitationToken(expiredRawToken);
  createStandaloneInvitation({
    companyId: 'comp_test_inv',
    companyName: 'Invited Corp',
    email: 'expired@invitedcorp.com',
    role: 'STORE_MANAGER',
    tokenHash: expiredTokenHash,
    invitedBy: 'usr_founder',
    expiresInDays: -1, // Expired yesterday
  });

  const resExpired = await getInvitationByTokenRoute(
    new Request(`http://localhost:3000/api/invitations/${expiredRawToken}`),
    { params: Promise.resolve({ token: expiredRawToken }) }
  );
  assert.equal(resExpired.status, 410);
});

test('6. Invitation Acceptance: Email verification and single-use exhaustion', async () => {
  clearRbacCaches();

  const uniqueId = Date.now();
  const intendedEmail = `intended.manager_${uniqueId}@globalretail.com`;
  const wrongEmail = `impostor_${uniqueId}@hacker.com`;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);

  createStandaloneInvitation({
    companyId: 'comp_retail_inv',
    companyName: 'Global Retail',
    storeId: 'store_gr_101',
    storeName: 'Downtown Store #101',
    email: intendedEmail,
    role: 'STORE_MANAGER',
    tokenHash,
    invitedBy: 'usr_company_vp',
  });

  // A. Unauthenticated acceptance rejected with 401
  const reqNoAuth = new Request('http://localhost:3000/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawToken }),
  });
  const resNoAuth = await postAcceptInvitationRoute(reqNoAuth);
  assert.equal(resNoAuth.status, 401);

  // B. Different email user acceptance rejected with 403 (Email mismatch protection)
  const wrongUser = await createUser({
    email: wrongEmail,
    name: 'Wrong Email User',
    role: 'PENDING_ASSIGNMENT',
  });
  const wrongToken = await createSession(wrongUser);

  const reqWrongEmail = new Request('http://localhost:3000/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wrongToken}` },
    body: JSON.stringify({ token: rawToken }),
  });
  const resWrongEmail = await postAcceptInvitationRoute(reqWrongEmail);
  assert.equal(resWrongEmail.status, 403);
  const wrongEmailData = await resWrongEmail.json();
  assert.match(wrongEmailData.error, new RegExp(intendedEmail, 'i'));

  // C. Matching email user successfully accepts and is elevated to STORE_MANAGER
  const intendedUser = await createUser({
    email: intendedEmail,
    name: 'Intended Store Manager',
    role: 'PENDING_ASSIGNMENT',
  });
  const intendedToken = await createSession(intendedUser);

  const reqAccept = new Request('http://localhost:3000/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intendedToken}` },
    body: JSON.stringify({ token: rawToken }),
  });
  const resAccept = await postAcceptInvitationRoute(reqAccept);
  assert.equal(resAccept.status, 200);
  const acceptData = await resAccept.json();
  assert.equal(acceptData.success, true);
  assert.equal(acceptData.storeId, 'store_gr_101');

  // Verify session elevation
  const sessionReq = new Request('http://localhost:3000/api/auth/session', {
    headers: { Authorization: `Bearer ${intendedToken}` },
  });
  const sessionRes = await getSessionRoute(sessionReq);
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.user.accessState, 'STORE_MANAGER');
  assert.equal(sessionData.user.assignedStoreId, 'store_gr_101');
  assert.equal(sessionData.user.accessibleStoreIds.length, 1);
  assert.equal(sessionData.user.accessibleStoreIds[0], 'store_gr_101');

  // D. Single-Use Re-Attempt: Same token is immediately rejected with 410 (Already accepted)
  const reqReplay = new Request('http://localhost:3000/api/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intendedToken}` },
    body: JSON.stringify({ token: rawToken }),
  });
  const resReplay = await postAcceptInvitationRoute(reqReplay);
  assert.equal(resReplay.status, 410);
  const replayData = await resReplay.json();
  assert.match(replayData.error, /already been accepted/i);
});

test('7. Platform Administration: Cross-tenant visibility and company suspension', async () => {
  clearRbacCaches();

  // Non-admin user cannot access admin APIs
  const regularUser = await createUser({
    email: `regular_${Date.now()}@tenant.com`,
    name: 'Regular User',
    role: 'PENDING_ASSIGNMENT',
  });
  const regularToken = await createSession(regularUser);

  const resAdminDenied = await getAdminCompaniesRoute(
    new Request('http://localhost:3000/api/admin/companies', {
      headers: { Authorization: `Bearer ${regularToken}` },
    })
  );
  assert.equal(resAdminDenied.status, 403);

  // Platform admin user attains access
  const adminUser = await createUser({
    email: `sysadmin_${Date.now()}@stocksentinel.internal`,
    name: 'Platform Operator',
    role: 'PLATFORM_ADMIN',
  });
  setPlatformAdmin(adminUser.id, true);
  const adminToken = await createSession(adminUser);

  // Admin lists companies
  const resAdmin = await getAdminCompaniesRoute(
    new Request('http://localhost:3000/api/admin/companies', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
  );
  assert.equal(resAdmin.status, 200);

  // Create a company to suspend
  const cmUser = await createUser({
    email: `target_cm_${Date.now()}@targetcompany.com`,
    name: 'Target Company Manager',
    role: 'PENDING_ASSIGNMENT',
  });
  const cmToken = await createSession(cmUser);

  const onboardRes = await postCompanyOnboardRoute(
    new Request('http://localhost:3000/api/company/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cmToken}` },
      body: JSON.stringify({
        name: 'Target Company',
        slug: `target-${Date.now()}`,
        maxStores: 2,
        stores: [{ name: 'Target Store 1' }],
      }),
    })
  );
  const onboardData = await onboardRes.json();
  const targetCompanyId = onboardData.company.id;

  // Platform Admin suspends the company
  const suspendRes = await patchAdminCompanyRoute(
    new Request(`http://localhost:3000/api/admin/companies/${targetCompanyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    }),
    { params: Promise.resolve({ id: targetCompanyId }) }
  );
  assert.equal(suspendRes.status, 200);

  // Suspended company manager session immediately reflects SUSPENDED access state
  const cmSessionRes = await getSessionRoute(
    new Request('http://localhost:3000/api/auth/session', {
      headers: { Authorization: `Bearer ${cmToken}` },
    })
  );
  const cmSessionData = await cmSessionRes.json();
  assert.equal(cmSessionData.user.accessState, 'SUSPENDED');
  assert.equal(cmSessionData.user.companyStatus, 'SUSPENDED');

  // Suspended company manager cannot add stores
  const blockedStoreRes = await postCompanyStoresRoute(
    new Request('http://localhost:3000/api/company/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cmToken}` },
      body: JSON.stringify({ name: 'Blocked Store' }),
    })
  );
  assert.equal(blockedStoreRes.status, 403);
});

test('8. Invitations API: Scoped access and token secrecy', async () => {
  clearRbacCaches();

  const user = await createUser({
    email: `cm_inv_${Date.now()}@retail.com`,
    name: 'Company Manager',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  const onboardRes = await postCompanyOnboardRoute(
    new Request('http://localhost:3000/api/company/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Retail Inv Corp',
        slug: `invcorp-${Date.now()}`,
        maxStores: 3,
        stores: [{ name: 'Store 1' }],
      }),
    })
  );
  const data = await onboardRes.json();
  const storeId = data.stores[0].id;

  // Issue invitation via POST /api/company/invitations
  const createInvRes = await postCompanyInvitationsRoute(
    new Request('http://localhost:3000/api/company/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: 'store1.lead@retail.com',
        storeId,
      }),
    })
  );
  assert.equal(createInvRes.status, 200);
  const invData = await createInvRes.json();
  assert.equal(invData.success, true);
  assert.ok(invData.invitation.rawToken);
  assert.equal(invData.invitation.email, 'store1.lead@retail.com');

  // List invitations via GET /api/company/invitations
  const listInvRes = await getCompanyInvitationsRoute(
    new Request('http://localhost:3000/api/company/invitations', {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  assert.equal(listInvRes.status, 200);
  const listData = await listInvRes.json();
  assert.equal(listData.invitations.length, 1);
  // Guarantee: Raw tokens and hashes are never exposed in bulk list
  assert.equal(listData.invitations[0].rawToken, undefined);
  assert.equal(listData.invitations[0].tokenHash, undefined);
});

test('9. Platform Admins Route: Verification and security listing', async () => {
  clearRbacCaches();

  // Non-admin rejected with 403
  const user = await createUser({
    email: `nonadmin_${Date.now()}@example.com`,
    name: 'Non Admin',
    role: 'PENDING_ASSIGNMENT',
  });
  const token = await createSession(user);

  const deniedRes = await getAdminPlatformAdminsRoute(
    new Request('http://localhost:3000/api/admin/platform-admins', {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  assert.equal(deniedRes.status, 403);

  // Verified admin attains listing
  const admin = await createUser({
    email: `verified_operator_${Date.now()}@stocksentinel.internal`,
    name: 'Verified Admin Operator',
    role: 'PLATFORM_ADMIN',
  });
  setPlatformAdmin(admin.id, true);
  const adminToken = await createSession(admin);

  const adminRes = await getAdminPlatformAdminsRoute(
    new Request('http://localhost:3000/api/admin/platform-admins', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
  );
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.ok(adminData.admins.length >= 1);
  assert.ok(adminData.admins.some((a: { id: string }) => a.id === admin.id));
});
