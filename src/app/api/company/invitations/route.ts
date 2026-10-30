import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  findCompanyById,
  findCompanyStores,
  getCompanyInvitations,
  hashInvitationToken,
  createCompanyInvitation,
  revokeCompanyInvitation,
  resendCompanyInvitation,
} from '@/lib/auth/userStore';
import { sendStoreManagerInvitationEmail } from '@/lib/email/invitationEmail';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState !== 'COMPANY_MANAGER' && auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized to view invitations.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetCompanyId = auth.user.accessState === 'PLATFORM_ADMIN'
      ? (searchParams.get('companyId') || auth.user.companyId)
      : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
    }

    const invitations = await getCompanyInvitations(targetCompanyId);

    // Filter to safe client-facing payload (tokenHash is STRICTLY withheld)
    const safeInvitations = invitations.map((inv) => ({
      id: inv.id,
      companyId: inv.companyId,
      companyName: inv.companyName,
      storeId: inv.storeId,
      storeName: inv.storeName,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({ invitations: safeInvitations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve invitations.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState !== 'COMPANY_MANAGER' && auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized to issue invitations.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, storeId, companyId } = body;

    const targetCompanyId = auth.user.accessState === 'PLATFORM_ADMIN' && companyId
      ? companyId
      : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
    }

    const company = await findCompanyById(targetCompanyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    if (company.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Cannot issue invitations for a suspended company.' }, { status: 403 });
    }

    const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    let assignedStoreName = undefined;
    if (storeId) {
      const companyStores = await findCompanyStores(targetCompanyId);
      const store = companyStores.find((s) => s.id === storeId);
      if (!store) {
        return NextResponse.json({ error: 'Specified store does not belong to your company.' }, { status: 400 });
      }
      assignedStoreName = store.name;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashInvitationToken(rawToken);

    const inv = await createCompanyInvitation({
      companyId: targetCompanyId,
      companyName: company.name,
      storeId,
      storeName: assignedStoreName,
      email: cleanEmail,
      role: 'STORE_MANAGER',
      tokenHash,
      invitedBy: auth.user.id,
      expiresInDays: 7,
    });

    const emailResult = await sendStoreManagerInvitationEmail({
      recipientEmail: cleanEmail,
      companyName: company.name,
      storeName: assignedStoreName,
      rawToken,
      requestOrigin: request.headers.get('origin') || undefined,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: inv.id,
        email: inv.email,
        storeId: inv.storeId,
        storeName: inv.storeName,
        role: inv.role,
        rawToken,
        inviteUrl: emailResult.inviteUrl,
        expiresAt: inv.expiresAt,
        emailDelivered: emailResult.delivered,
        emailWarning: emailResult.warning,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create invitation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState !== 'COMPANY_MANAGER' && auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized to manage invitations.' }, { status: 403 });
    }

    const body = await request.json();
    const { invitationId, action, companyId } = body;

    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json({ error: 'Invitation ID required.' }, { status: 400 });
    }

    const targetCompanyId = auth.user.accessState === 'PLATFORM_ADMIN' && companyId
      ? companyId
      : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
    }

    if (action === 'revoke') {
      const revoked = await revokeCompanyInvitation(targetCompanyId, invitationId);
      if (!revoked) {
        return NextResponse.json({ error: 'Invitation not found or cannot be revoked.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Invitation revoked successfully.' });
    }

    if (action === 'resend') {
      const company = await findCompanyById(targetCompanyId);
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashInvitationToken(rawToken);

      const updatedInv = await resendCompanyInvitation(targetCompanyId, invitationId, tokenHash, 7);
      if (!updatedInv) {
        return NextResponse.json({ error: 'Invitation not found or cannot be resent.' }, { status: 404 });
      }

      const emailResult = await sendStoreManagerInvitationEmail({
        recipientEmail: updatedInv.email,
        companyName: company?.name || updatedInv.companyName || 'Retail Operations',
        storeName: updatedInv.storeName,
        rawToken,
        requestOrigin: request.headers.get('origin') || undefined,
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation resent successfully.',
        invitation: {
          id: updatedInv.id,
          email: updatedInv.email,
          storeId: updatedInv.storeId,
          storeName: updatedInv.storeName,
          role: updatedInv.role,
          rawToken,
          inviteUrl: emailResult.inviteUrl,
          expiresAt: updatedInv.expiresAt,
          emailDelivered: emailResult.delivered,
          emailWarning: emailResult.warning,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: revoke, resend.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update invitation.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

