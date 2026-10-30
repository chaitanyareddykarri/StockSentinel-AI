import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured, getSupabaseServerClient } from '@/lib/db/supabaseServer';
import {
  hashInvitationToken,
  getStandaloneInvitationByHash,
  getStandaloneCompany,
} from '@/lib/auth/userStore';

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const resolvedParams = 'then' in props.params ? await props.params : props.params;
    const token = resolvedParams?.token;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ valid: false, error: 'Missing invitation token.' }, { status: 400 });
    }

    const tokenHash = hashInvitationToken(token);

    // 1. Supabase Database Integration
    if (isSupabaseServerConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: invitation, error } = await supabase
          .from('invitations')
          .select('id, email, company_id, store_id, role, status, expires_at, companies(name, status), stores(name)')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        // If invitation is found in Supabase, validate its status and return
        if (invitation && !error) {
          if (invitation.status === 'ACCEPTED') {
            return NextResponse.json(
              { valid: false, error: 'This invitation has already been accepted.' },
              { status: 410 }
            );
          }

          if (invitation.status === 'EXPIRED' || new Date(invitation.expires_at).getTime() < Date.now()) {
            return NextResponse.json(
              { valid: false, error: 'This single-use invitation link has expired. Please request a new invitation.' },
              { status: 410 }
            );
          }

          if (invitation.status === 'REVOKED') {
            return NextResponse.json(
              { valid: false, error: 'This invitation has been revoked by the company manager.' },
              { status: 410 }
            );
          }

          const comp = Array.isArray(invitation.companies)
            ? invitation.companies[0]
            : (invitation.companies as { name: string; status: string } | null);
          const store = Array.isArray(invitation.stores)
            ? invitation.stores[0]
            : (invitation.stores as { name: string } | null);

          if (comp && comp.status === 'SUSPENDED') {
            return NextResponse.json(
              { valid: false, error: 'The issuing retail company is currently suspended by platform administration.' },
              { status: 403 }
            );
          }

          return NextResponse.json({
            valid: true,
            invitation: {
              id: invitation.id,
              email: invitation.email,
              companyId: invitation.company_id,
              companyName: comp?.name || 'Retail Operations',
              storeId: invitation.store_id,
              storeName: store?.name || 'Assigned Store',
              role: invitation.role,
              expiresAt: invitation.expires_at,
            },
          });
        }
      }
    }

    // 2. Standalone Fallback Store
    const invitation = getStandaloneInvitationByHash(tokenHash);

    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: 'Invitation not found or invalid token.' },
        { status: 404 }
      );
    }

    if (invitation.status === 'ACCEPTED') {
      return NextResponse.json(
        { valid: false, error: 'This invitation has already been accepted.' },
        { status: 410 }
      );
    }

    if (invitation.status === 'EXPIRED' || new Date(invitation.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { valid: false, error: 'This single-use invitation link has expired. Please request a new invitation.' },
        { status: 410 }
      );
    }

    if (invitation.status === 'REVOKED') {
      return NextResponse.json(
        { valid: false, error: 'This invitation has been revoked by the company manager.' },
        { status: 410 }
      );
    }

    const company = getStandaloneCompany(invitation.companyId);
    if (company && company.status === 'SUSPENDED') {
      return NextResponse.json(
        { valid: false, error: 'The issuing retail company is currently suspended by platform administration.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        companyId: invitation.companyId,
        companyName: company?.name || invitation.companyName || 'Retail Operations',
        storeId: invitation.storeId,
        storeName: invitation.storeName || 'Assigned Store',
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to validate invitation.';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}

