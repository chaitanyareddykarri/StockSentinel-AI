import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setCompanyStores,
  clearRbacCaches,
  createCompanyInvitation,
  hashInvitationToken,
} from '../src/lib/auth/userStore';
import {
  extractInvitationToken,
  buildInvitationUrl,
} from '../src/lib/auth/invitationTokens';
import { POST as postRegisterRoute } from '../src/app/api/auth/register/route';
import { GET as getSessionRoute } from '../src/app/api/auth/session/route';
import {
  GET as getCompanyInvitationsRoute,
  POST as postCompanyInvitationsRoute,
  PATCH as patchCompanyInvitationsRoute,
} from '../src/app/api/company/invitations/route';
import {
  GET as getUserInvitationsRoute,
  POST as postUserInvitationsRoute,
} from '../src/app/api/invitations/route';
import { POST as postAcceptInvitationRoute } from '../src/app/api/invitations/accept/route';
import { GET as getAlertsRoute } from '../src/app/api/alerts/route';
import { GET as getMetricsRoute } from '../src/app/api/metrics/route';
import { POST as postCompanyStoresRoute } from '../src/app/api/company/stores/route';
import { sendStoreManagerInvitationEmail } from '../src/lib/email/invitationEmail';

test('Registration, Invitations & Store Manager Onboarding: Security, State Transitions & Tenant Boundaries', async (t) => {
  clearRbacCaches();

  const makeReq = (path: string, options: RequestInit = {}, token?: string) =>
    new Request(`http://localhost:3000${path}`, {
      ...options,
      headers: {
        ...(token ? { Cookie: `stocksentinel_session=${token}` } : {}),
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

  const companyAId = '00000000-0000-0000-0000-000000000001';
  const companyBId = '00000000-0000-0000-0000-000000000002';
  const storeA1Id = crypto.randomUUID();
  const storeA2Id = crypto.randomUUID();
  const storeB1Id = crypto.randomUUID();

  // Seed Company A and Company B
  setCompanyStores(companyAId, [
    { id: storeA1Id, name: 'Downtown Supercenter #101' },
    { id: storeA2Id, name: 'Bellevue Square Market #204' },
  ]);
  setCompanyStores(companyBId, [{ id: storeB1Id, name: 'Tacoma Center #308' }]);

  // Seed Company Manager A
  const cmUserA = await createUser({
    email: `cm_a_${Date.now()}@comp-a.com`,
    name: 'Executive CM A',
  });
  const cmTokenA = await createSession(cmUserA);
  setCompanyMembership({
    userId: cmUserA.id,
    companyId: companyAId,
    companyName: 'Company A Retail',
    companySlug: 'comp-a',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  // Seed Company Manager B
  const cmUserB = await createUser({
    email: `cm_b_${Date.now()}@comp-b.com`,
    name: 'Executive CM B',
  });
  const cmTokenB = await createSession(cmUserB);
  setCompanyMembership({
    userId: cmUserB.id,
    companyId: companyBId,
    companyName: 'Company B Retail',
    companySlug: 'comp-b',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  await t.test('1. Public registration creates no unauthorized company membership or store access', async () => {
    const regEmail = `newbie_${Date.now()}@external.org`;
    const regReq = makeReq('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: regEmail,
        password: 'SecurePassword123!',
        name: 'Unassigned Associate',
      }),
    });

    const regRes = await postRegisterRoute(regReq);
    assert.strictEqual(regRes.status, 200);
    const regData = await regRes.json();
    assert.strictEqual(regData.success, true);
    assert.ok(regData.token);
    assert.strictEqual(regData.user.role, 'PENDING_ASSIGNMENT');

    // Verify session
    const sessionRes = await getSessionRoute(makeReq('/api/auth/session', {}, regData.token));
    assert.strictEqual(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.strictEqual(sessionData.user.accessState, 'PENDING_ASSIGNMENT');
    assert.strictEqual(sessionData.user.companyId, undefined);
    assert.strictEqual(sessionData.user.assignedStoreId, undefined);
    assert.deepEqual(sessionData.user.accessibleStoreIds, []);

    // Verify that unassigned user cannot access operational alerts or metrics
    const alertsRes = await getAlertsRoute(makeReq('/api/alerts', {}, regData.token));
    assert.strictEqual(alertsRes.status, 403);

    const metricsRes = await getMetricsRoute(makeReq('/api/metrics', {}, regData.token));
    assert.strictEqual(metricsRes.status, 403);
  });

  await t.test('2. A pending invitation created before registration is visible after the user registers and signs in', async () => {
    const invitedEmail = `future_sm_${Date.now()}@target-retail.com`;

    // 1. Company Manager A issues invitation before recipient has an account
    const inviteReq = makeReq(
      '/api/company/invitations',
      {
        method: 'POST',
        body: JSON.stringify({
          email: invitedEmail,
          storeId: storeA1Id,
        }),
      },
      cmTokenA
    );
    const inviteRes = await postCompanyInvitationsRoute(inviteReq);
    assert.strictEqual(inviteRes.status, 200);
    const inviteData = await inviteRes.json();
    assert.strictEqual(inviteData.success, true);
    assert.ok(inviteData.invitation.id);
    assert.ok(inviteData.invitation.rawToken);

    // 2. Later, recipient registers with that exact email
    const regReq = makeReq('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: invitedEmail,
        password: 'Password999!',
        name: 'Future Store Manager',
      }),
    });
    const regRes = await postRegisterRoute(regReq);
    const regData = await regRes.json();
    assert.ok(regData.token);

    // 3. User queries their invitations
    const userInvRes = await getUserInvitationsRoute(makeReq('/api/invitations', {}, regData.token));
    assert.strictEqual(userInvRes.status, 200);
    const userInvData = await userInvRes.json();
    assert.strictEqual(userInvData.success, true);
    assert.strictEqual(userInvData.invitations.length, 1);
    assert.strictEqual(userInvData.invitations[0].email, invitedEmail.toLowerCase());
    assert.strictEqual(userInvData.invitations[0].storeId, storeA1Id);
    assert.strictEqual(userInvData.invitations[0].storeName, 'Downtown Supercenter #101');
    assert.strictEqual(userInvData.invitations[0].role, 'STORE_MANAGER');
    assert.strictEqual(userInvData.invitations[0].status, 'PENDING');

    // Token hash MUST NOT be exposed in user-facing response
    assert.strictEqual(userInvData.invitations[0].tokenHash, undefined);
  });

  await t.test('3. An existing user can accept an invitation securely and obtain Store Manager scope', async () => {
    const smEmail = `existing_sm_${Date.now()}@target-retail.com`;

    // 1. Existing registered user
    const smUser = await createUser({
      email: smEmail,
      name: 'Existing Associate',
      role: 'PENDING_ASSIGNMENT',
    });
    const smToken = await createSession(smUser);

    // 2. CM A invites this user
    const inviteReq = makeReq(
      '/api/company/invitations',
      {
        method: 'POST',
        body: JSON.stringify({
          email: smEmail,
          storeId: storeA1Id,
        }),
      },
      cmTokenA
    );
    const inviteRes = await postCompanyInvitationsRoute(inviteReq);
    const inviteData = await inviteRes.json();
    const invitationId = inviteData.invitation.id;

    // 3. User accepts using invitationId
    const acceptReq = makeReq(
      '/api/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify({ invitationId }),
      },
      smToken
    );
    const acceptRes = await postAcceptInvitationRoute(acceptReq);
    assert.strictEqual(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptData.success, true);
    assert.strictEqual(acceptData.role, 'STORE_MANAGER');
    assert.strictEqual(acceptData.storeId, storeA1Id);

    // 4. Verify session state is now STORE_MANAGER
    const sessionRes = await getSessionRoute(makeReq('/api/auth/session', {}, smToken));
    const sessionData = await sessionRes.json();
    assert.strictEqual(sessionData.user.accessState, 'STORE_MANAGER');
    assert.strictEqual(sessionData.user.companyId, companyAId);
    assert.strictEqual(sessionData.user.assignedStoreId, storeA1Id);
    assert.deepEqual(sessionData.user.accessibleStoreIds, [storeA1Id]);
  });

  await t.test('4. An incorrect email cannot accept an invitation', async () => {
    const intendedEmail = `intended_${Date.now()}@target.com`;
    const attackerEmail = `attacker_${Date.now()}@target.com`;

    const attackerUser = await createUser({ email: attackerEmail, name: 'Attacker' });
    const attackerToken = await createSession(attackerUser);

    // Invite intended recipient
    const inviteReq = makeReq(
      '/api/company/invitations',
      {
        method: 'POST',
        body: JSON.stringify({ email: intendedEmail, storeId: storeA1Id }),
      },
      cmTokenA
    );
    const inviteRes = await postCompanyInvitationsRoute(inviteReq);
    const inviteData = await inviteRes.json();
    const invitationId = inviteData.invitation.id;
    const rawToken = inviteData.invitation.rawToken;

    // Attacker tries to accept by invitationId -> 403 Mismatch
    const attackIdRes = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId }) }, attackerToken)
    );
    assert.strictEqual(attackIdRes.status, 403);

    // Attacker tries to accept by rawToken -> 403 Mismatch
    const attackTokenRes = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ token: rawToken }) }, attackerToken)
    );
    assert.strictEqual(attackTokenRes.status, 403);
  });

  await t.test('5. Expired, revoked, or already accepted invitations cannot be reused', async () => {
    const testEmail = `reuse_check_${Date.now()}@target.com`;
    const user = await createUser({ email: testEmail, name: 'Reuse User' });
    const userToken = await createSession(user);

    // A. Single-Use Check (Already Accepted)
    const invA = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      storeName: 'Downtown Supercenter #101',
      email: testEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('hex')),
      invitedBy: cmUserA.id,
    });
    // First accept -> succeeds
    const acc1 = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: invA.id }) }, userToken)
    );
    assert.strictEqual(acc1.status, 200);

    // Second accept on same invitation -> 410 Gone / Rejected
    const acc2 = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: invA.id }) }, userToken)
    );
    assert.strictEqual(acc2.status, 410);

    // B. Revoked Check
    const rawTokenB = crypto.randomBytes(32).toString('hex');
    const invB = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      email: testEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(rawTokenB),
      invitedBy: cmUserA.id,
    });

    // Revoke via Company Manager route
    const revRes = await patchCompanyInvitationsRoute(
      makeReq(
        '/api/company/invitations',
        { method: 'PATCH', body: JSON.stringify({ invitationId: invB.id, action: 'revoke' }) },
        cmTokenA
      )
    );
    assert.strictEqual(revRes.status, 200);

    // Recipient attempts to accept revoked invitation -> 410
    const accRev = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: invB.id }) }, userToken)
    );
    assert.strictEqual(accRev.status, 410);

    // C. Expired Check
    const rawTokenC = crypto.randomBytes(32).toString('hex');
    const invC = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      email: testEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(rawTokenC),
      invitedBy: cmUserA.id,
      expiresInDays: -1, // Expired yesterday
    });

    const accExp = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: invC.id }) }, userToken)
    );
    assert.strictEqual(accExp.status, 410);
  });

  await t.test('6. Concurrent acceptance cannot create duplicate memberships or store assignments', async () => {
    const concurrentEmail = `concur_${Date.now()}@target.com`;
    const user = await createUser({ email: concurrentEmail, name: 'Concurrent User' });
    const userToken = await createSession(user);

    const inv = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      storeName: 'Downtown Supercenter #101',
      email: concurrentEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('hex')),
      invitedBy: cmUserA.id,
    });

    // Fire 2 simultaneous acceptance requests
    const [res1, res2] = await Promise.all([
      postAcceptInvitationRoute(
        makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: inv.id }) }, userToken)
      ),
      postAcceptInvitationRoute(
        makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: inv.id }) }, userToken)
      ),
    ]);

    // Exactly one should return 200, the other should be rejected
    const statuses = [res1.status, res2.status].sort();
    assert.strictEqual(statuses[0], 200);
    assert.strictEqual(statuses[1], 410);
  });

  await t.test('7. Acceptance creates correct membership and only the intended single-store assignment', async () => {
    const smEmail = `scoped_sm_${Date.now()}@target.com`;
    const user = await createUser({ email: smEmail, name: 'Scoped SM' });
    const userToken = await createSession(user);

    const inv = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      storeName: 'Downtown Supercenter #101',
      email: smEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('hex')),
      invitedBy: cmUserA.id,
    });

    const accRes = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: inv.id }) }, userToken)
    );
    assert.strictEqual(accRes.status, 200);

    // Authorized store A1 queries succeed
    const alertsA1 = await getAlertsRoute(makeReq(`/api/alerts?storeId=${storeA1Id}`, {}, userToken));
    assert.strictEqual(alertsA1.status, 200);

    // Unauthorized store A2 queries in same company are blocked with 403
    const alertsA2 = await getAlertsRoute(makeReq(`/api/alerts?storeId=${storeA2Id}`, {}, userToken));
    assert.strictEqual(alertsA2.status, 403);
  });

  await t.test('8. A Store Manager cannot obtain Company Manager privileges', async () => {
    const smEmail = `priv_sm_${Date.now()}@target.com`;
    const smUser = await createUser({ email: smEmail, name: 'Priv Check SM' });
    const smToken = await createSession(smUser);

    const inv = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      email: smEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('hex')),
      invitedBy: cmUserA.id,
    });
    await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: inv.id }) }, smToken)
    );

    // SM cannot view company invitations
    const compInvRes = await getCompanyInvitationsRoute(makeReq('/api/company/invitations', {}, smToken));
    assert.strictEqual(compInvRes.status, 403);

    // SM cannot create stores
    const createStoreRes = await postCompanyStoresRoute(
      makeReq(
        '/api/company/stores',
        { method: 'POST', body: JSON.stringify({ name: 'Hacked Store', code: 'HCK' }) },
        smToken
      )
    );
    assert.strictEqual(createStoreRes.status, 403);

    // SM cannot invite other managers
    const issueInvRes = await postCompanyInvitationsRoute(
      makeReq(
        '/api/company/invitations',
        { method: 'POST', body: JSON.stringify({ email: 'other@retail.com', storeId: storeA1Id }) },
        smToken
      )
    );
    assert.strictEqual(issueInvRes.status, 403);
  });

  await t.test('9. Company Managers cannot invite into another company or assign unrelated stores', async () => {
    // CM A attempts to invite with store belonging to Company B -> 400
    const crossStoreRes = await postCompanyInvitationsRoute(
      makeReq(
        '/api/company/invitations',
        { method: 'POST', body: JSON.stringify({ email: 'victim@target.com', storeId: storeB1Id }) },
        cmTokenA
      )
    );
    assert.strictEqual(crossStoreRes.status, 400);

    // CM A attempts to specify companyId of Company B in request -> server ignores client companyId
    const crossCompRes = await postCompanyInvitationsRoute(
      makeReq(
        '/api/company/invitations',
        {
          method: 'POST',
          body: JSON.stringify({
            companyId: companyBId, // Spoofed company ID
            email: 'spoof_test@target.com',
            storeId: storeA1Id,
          }),
        },
        cmTokenA
      )
    );
    assert.strictEqual(crossCompRes.status, 200);
    // The created invitation is anchored strictly to CM A's authorized companyAId
    const listRes = await getCompanyInvitationsRoute(makeReq('/api/company/invitations', {}, cmTokenA));
    const listData = await listRes.json();
    const createdInv = listData.invitations.find((i: { email: string }) => i.email === 'spoof_test@target.com');
    assert.ok(createdInv);
    assert.strictEqual(createdInv.companyId, companyAId);
  });

  await t.test('10. Users cannot read or modify another user invitations or notifications', async () => {
    const user1Email = `user1_${Date.now()}@retail.com`;
    const user2Email = `user2_${Date.now()}@retail.com`;

    const user1 = await createUser({ email: user1Email, name: 'User 1' });
    const user1Token = await createSession(user1);

    const user2 = await createUser({ email: user2Email, name: 'User 2' });
    const user2Token = await createSession(user2);

    // Issue invitation for User 1
    const inv1 = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      email: user1Email,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(crypto.randomBytes(32).toString('hex')),
      invitedBy: cmUserA.id,
    });

    // User 2 queries invitations -> should see 0
    const u2ListRes = await getUserInvitationsRoute(makeReq('/api/invitations', {}, user2Token));
    const u2ListData = await u2ListRes.json();
    assert.strictEqual(u2ListData.invitations.length, 0);

    // User 2 attempts to decline User 1 invitation -> 404 / Unauthorized
    const u2DeclineRes = await postUserInvitationsRoute(
      makeReq(
        '/api/invitations',
        { method: 'POST', body: JSON.stringify({ action: 'decline', invitationId: inv1.id }) },
        user2Token
      )
    );
    assert.strictEqual(u2DeclineRes.status, 404);

    // User 1 can decline their own invitation
    const u1DeclineRes = await postUserInvitationsRoute(
      makeReq(
        '/api/invitations',
        { method: 'POST', body: JSON.stringify({ action: 'decline', invitationId: inv1.id }) },
        user1Token
      )
    );
    assert.strictEqual(u1DeclineRes.status, 200);
  });

  await t.test('11. Cross-company isolation is enforced across invitation management', async () => {
    // CM B cannot view Company A invitations
    const cmBListRes = await getCompanyInvitationsRoute(makeReq('/api/company/invitations', {}, cmTokenB));
    const cmBData = await cmBListRes.json();
    for (const inv of cmBData.invitations) {
      assert.strictEqual(inv.companyId, companyBId);
      assert.notStrictEqual(inv.companyId, companyAId);
    }
  });

  await t.test('12. Email provider failures are reported honestly and do not falsely claim delivery', async () => {
    // When RESEND_API_KEY is not configured
    delete process.env.RESEND_API_KEY;
    const emailResult = await sendStoreManagerInvitationEmail({
      recipientEmail: 'honest_report@retail.com',
      companyName: 'Acme Supermarkets',
      storeName: 'Acme #101',
      rawToken: 'token_123',
    });

    assert.strictEqual(emailResult.delivered, false);
    assert.strictEqual(emailResult.provider, 'none');
    assert.ok(emailResult.warning?.includes('RESEND_API_KEY is not set'));
    assert.ok(emailResult.inviteUrl.includes('/invite/accept?token=token_123'));
  });

  await t.test('13. Regression: Authenticated acceptance, missing sessions, malformed token URLs, wrong-email & already-used', async () => {
    // A. URL Construction & Token Extraction Normalization
    const raw64 = crypto.randomBytes(32).toString('hex');
    const malformed1 = `http://localhost:3000/invite/accept?tokenhttp://localhost:3000/invite/accept?token=${raw64}`;
    const malformed2 = `http://localhost:3000/invite/accept?token=${raw64}`;
    const malformed3 = `/invite/accept?token=${raw64}`;

    assert.strictEqual(extractInvitationToken(raw64), raw64);
    assert.strictEqual(extractInvitationToken(malformed1), raw64);
    assert.strictEqual(extractInvitationToken(malformed2), raw64);
    assert.strictEqual(extractInvitationToken(malformed3), raw64);

    const built1 = buildInvitationUrl('http://localhost:3000', malformed1);
    assert.strictEqual(built1, `http://localhost:3000/invite/accept?token=${raw64}`);

    const built2 = buildInvitationUrl('http://localhost:3000', raw64);
    assert.strictEqual(built2, `http://localhost:3000/invite/accept?token=${raw64}`);

    // B. Missing Session on Acceptance -> 401
    const unauthReq = makeReq('/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: raw64 }),
    });
    const unauthRes = await postAcceptInvitationRoute(unauthReq);
    assert.strictEqual(unauthRes.status, 401);

    // C. Create user and invitation
    const targetEmail = `manager_regress_${Date.now()}@stores.com`;
    const targetUser = await createUser({ email: targetEmail, name: 'Regression Manager' });
    const targetToken = await createSession(targetUser);

    const inv = await createCompanyInvitation({
      companyId: companyAId,
      companyName: 'Company A Retail',
      storeId: storeA1Id,
      email: targetEmail,
      role: 'STORE_MANAGER',
      tokenHash: hashInvitationToken(raw64),
      invitedBy: cmUserA.id,
      expiresInDays: 7,
    });

    // D. Wrong Email Attempt -> 403
    const imposterEmail = `imposter_${Date.now()}@stores.com`;
    const imposterUser = await createUser({ email: imposterEmail, name: 'Imposter' });
    const imposterToken = await createSession(imposterUser);

    const wrongEmailRes = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ invitationId: inv.id }) }, imposterToken)
    );
    assert.strictEqual(wrongEmailRes.status, 403);

    // E. Accept using malformed token URL with Bearer Authorization header -> 200
    const acceptReq = new Request('http://localhost:3000/api/invitations/accept', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${targetToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: malformed1 }),
    });
    const acceptRes = await postAcceptInvitationRoute(acceptReq);
    assert.strictEqual(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptData.success, true);
    assert.strictEqual(acceptData.role, 'STORE_MANAGER');

    // F. Replay / Already Used -> 410
    const replayRes = await postAcceptInvitationRoute(
      makeReq('/api/invitations/accept', { method: 'POST', body: JSON.stringify({ token: raw64 }) }, targetToken)
    );
    assert.strictEqual(replayRes.status, 410);
  });

  await t.test('14. Regression: accept_invitation contract guarantees company_id, store_id, role resolution without column ambiguity', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashInvitationToken(rawToken);
    const inviteeEmail = `store_manager_test_${Date.now()}@retailgroup.com`;

    const inviteeUser = await createUser({
      email: inviteeEmail,
      name: 'Test Store Manager',
    });
    const inviteeSession = await createSession(inviteeUser);

    const invitation = await createCompanyInvitation({
      companyId: companyBId,
      companyName: 'Company B Retail',
      storeId: storeB1Id,
      storeName: 'Tacoma Center #308',
      email: inviteeEmail,
      role: 'STORE_MANAGER',
      tokenHash,
      invitedBy: cmUserB.id,
      expiresInDays: 7,
    });

    // Accept via invitationId API pathway
    const req = makeReq(
      '/api/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify({ invitationId: invitation.id }),
      },
      inviteeSession
    );

    const res = await postAcceptInvitationRoute(req);
    assert.strictEqual(res.status, 200, 'Acceptance must succeed with 200 OK');
    const data = await res.json();

    assert.strictEqual(data.success, true);
    assert.strictEqual(data.companyId, companyBId, 'Must be scoped to invited company');
    assert.strictEqual(data.storeId, storeB1Id, 'Must be scoped to assigned store');
    assert.strictEqual(data.role, 'STORE_MANAGER', 'Must grant strictly STORE_MANAGER');
    assert.ok(data.companyName, 'Must include companyName');
    assert.ok(data.storeName, 'Must include storeName');
  });
});

