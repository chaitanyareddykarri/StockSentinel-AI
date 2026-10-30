import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { isSupabaseServerConfigured, getSupabaseServerClient } from '@/lib/db/supabaseServer';
import {
  hashInvitationToken,
  extractInvitationToken,
  getStandaloneInvitationByHash,
  acceptStandaloneInvitation,
  acceptInvitationById,
  getStandaloneCompany,
} from '@/lib/auth/userStore';

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { error: 'You must sign in or register before accepting this invitation.' },
        { status: 401 }
      );
    }

    if (auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Suspended user accounts cannot accept invitations.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { token, invitationId } = body;

    // Handle acceptance by in-app invitationId
    if (invitationId && typeof invitationId === 'string') {
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
        message: 'Invitation accepted successfully. Your store workspace has been provisioned.',
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

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid invitation token.' }, { status: 400 });
    }

    const cleanToken = extractInvitationToken(token);
    const tokenHash = hashInvitationToken(cleanToken);

    // 1. Supabase Database Integration: Atomic Stored Procedure Execution
    if (isSupabaseServerConfigured()) {
      const supabase = getSupabaseServerClient(auth.user.token);
      if (supabase) {
        const { data, error } = await supabase.rpc('accept_invitation', {
          p_token_hash: tokenHash,
        });

        if (!error && data) {
          const acceptedRow = Array.isArray(data) ? data[0] : data;
          let companyName = 'Retail Operations';
          let storeName = 'Assigned Store';

          if (acceptedRow?.company_id) {
            const { data: comp } = await supabase
              .from('companies')
              .select('name')
              .eq('id', acceptedRow.company_id)
              .maybeSingle();
            if (comp?.name) companyName = comp.name;
          }

          if (acceptedRow?.store_id) {
            const { data: store } = await supabase
              .from('stores')
              .select('name')
              .eq('id', acceptedRow.store_id)
              .maybeSingle();
            if (store?.name) storeName = store.name;
          }

          const resp = NextResponse.json({
            success: true,
            message: 'Invitation accepted successfully. Your store workspace has been provisioned.',
            companyId: acceptedRow?.company_id,
            companyName,
            storeId: acceptedRow?.store_id,
            storeName,
            role: acceptedRow?.role,
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

        if (error) {
          // If error indicates table or function does not exist (e.g. Migration 4 not applied, PostgREST PGRST202 schema cache error),
          // or token not found in Supabase DB, fall through to standalone acceptance
          const isMissingDbObject =
            error.code === '42883' ||
            error.code === '42P01' ||
            error.code === 'PGRST202' ||
            error.message?.toLowerCase().includes('schema cache') ||
            error.message?.toLowerCase().includes('could not find the function');
          const isNotFoundInDb =
            error.message?.toLowerCase().includes('not found') || error.code === 'P0001' || error.code === '02000';

          if (!isMissingDbObject && !isNotFoundInDb) {
            const status = error.code === '42501' ? 403 : (error.code === '23505' || error.code === '22007' || error.code === '22023') ? 410 : 400;
            return NextResponse.json({ error: error.message || 'Failed to accept invitation.' }, { status });
          }
        }
      }
    }

    // 2. Standalone Fallback Store
    const invitation = getStandaloneInvitationByHash(tokenHash);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found or invalid token.' },
        { status: 404 }
      );
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'This single-use invitation has already been accepted.' },
        { status: 410 }
      );
    }

    if (invitation.status === 'EXPIRED' || new Date(invitation.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please contact your company manager for a new link.' },
        { status: 410 }
      );
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'This invitation has been revoked.' },
        { status: 410 }
      );
    }

    // Security Guarantee: Ensure invited email matches verified logged-in user email
    const userEmail = auth.user.email.toLowerCase().trim();
    const invitedEmail = invitation.email.toLowerCase().trim();

    if (userEmail !== invitedEmail) {
      return NextResponse.json(
        {
          error: `This invitation was issued to "${invitedEmail}". You are currently signed in as "${userEmail}". Please sign in with the invited email address to proceed.`,
        },
        { status: 403 }
      );
    }

    const company = getStandaloneCompany(invitation.companyId);
    if (company && company.status === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'The company issuing this invitation has been suspended by platform administration.' },
        { status: 403 }
      );
    }

    // Atomically accept invitation and elevate user to assigned store manager
    const result = acceptStandaloneInvitation(tokenHash, auth.user.id, auth.user.email);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to accept invitation.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully. Your store workspace has been provisioned.',
      companyId: invitation.companyId,
      companyName: company?.name || invitation.companyName,
      storeId: invitation.storeId,
      storeName: invitation.storeName,
      role: invitation.role,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invitation acceptance failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

