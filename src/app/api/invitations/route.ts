import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  getUserInvitations,
  declineInvitation,
  acceptInvitationById,
} from '@/lib/auth/userStore';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const invitations = await getUserInvitations(auth.user.email);

    // Sanitize payload: tokenHash is strictly omitted
    const safeInvitations = invitations.map((inv) => ({
      id: inv.id,
      companyId: inv.companyId,
      companyName: inv.companyName || 'Retail Operations',
      storeId: inv.storeId,
      storeName: inv.storeName || 'Assigned Store',
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({
      success: true,
      invitations: safeInvitations,
    });
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

    if (auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Suspended user accounts cannot manage invitations.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, invitationId } = body;

    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json({ error: 'Invitation ID required.' }, { status: 400 });
    }

    if (action === 'decline') {
      const declined = await declineInvitation(invitationId, auth.user.email);
      if (!declined) {
        return NextResponse.json(
          { error: 'Invitation not found, already finalized, or not addressed to your email.' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Invitation declined successfully.',
      });
    }

    if (action === 'accept') {
      const res = await acceptInvitationById(invitationId, auth.user.id, auth.user.email, auth.user.token);
      if (!res.success) {
        const status =
          res.error?.includes('expired') ||
          res.error?.includes('accepted') ||
          res.error?.includes('revoked') ||
          res.error?.includes('declined') ||
          res.error?.includes('no longer active')
            ? 410
            : res.error?.includes('issued to')
            ? 403
            : res.error?.includes('not found')
            ? 404
            : 400;
        return NextResponse.json({ error: res.error || 'Failed to accept invitation.' }, { status });
      }

      const resp = NextResponse.json({
        success: true,
        message: 'Invitation accepted successfully.',
        companyId: res.companyId,
        companyName: res.companyName,
        storeId: res.storeId,
        storeName: res.storeName,
        role: res.role,
      });

      if (auth.user.token) {
        resp.cookies.set({
          name: 'stocksentinel_session',
          value: auth.user.token,
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      }

      return resp;
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: accept, decline.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invitation operation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

