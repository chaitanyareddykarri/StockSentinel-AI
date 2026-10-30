import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  findCompanyById,
  updateCompanyName,
  findCompanyStores,
  addCompanyStore,
  getStoreAssignmentsForCompany,
  getCompanyInvitations,
  hashInvitationToken,
  createCompanyInvitation,
  findUserById,
} from '@/lib/auth/userStore';
import { getMemoryStore } from '@/lib/storage';
import { isSupabaseServerConfigured, getSupabaseServerClient } from '@/lib/db/supabaseServer';
import { sendStoreManagerInvitationEmail } from '@/lib/email/invitationEmail';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState === 'SUSPENDED' || auth.user.accessState === 'PENDING_ASSIGNMENT') {
      return NextResponse.json({ error: 'Unauthorized to view store management.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let targetCompanyId = auth.user.companyId;

    if (auth.user.accessState === 'PLATFORM_ADMIN') {
      targetCompanyId = searchParams.get('companyId') || targetCompanyId;
    } else if (auth.user.accessState !== 'COMPANY_MANAGER') {
      return NextResponse.json({ error: 'Only Company Managers can access store management.' }, { status: 403 });
    }

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'No company identified for this request.' }, { status: 400 });
    }

    const company = await findCompanyById(targetCompanyId);
    const rawStores = await findCompanyStores(targetCompanyId);
    const assignments = await getStoreAssignmentsForCompany(targetCompanyId);
    const invitations = await getCompanyInvitations(targetCompanyId);

    // Enrich stores with manager info
    const enrichedStores = await Promise.all(
      rawStores.map(async (s) => {
        const assignment = assignments.find((a) => a.storeId === s.id);
        let managerInfo = null;
        if (assignment) {
          const userRec = await findUserById(assignment.userId);
          managerInfo = {
            userId: assignment.userId,
            name: userRec?.name || 'Assigned Manager',
            email: userRec?.email || '',
          };
        }

        const pendingInv = invitations.find(
          (i) => i.storeId === s.id && i.status === 'PENDING'
        );

        return {
          id: s.id,
          name: s.name,
          manager: managerInfo,
          pendingInvitation: pendingInv
            ? {
                id: pendingInv.id,
                email: pendingInv.email,
                expiresAt: pendingInv.expiresAt,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      company: company
        ? {
            id: company.id,
            name: company.name,
            slug: company.slug,
            maxStores: company.maxStores,
            status: company.status,
          }
        : null,
      stores: enrichedStores,
      totalStores: enrichedStores.length,
      maxStores: company?.maxStores || 20,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve store management telemetry.';
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
      return NextResponse.json({ error: 'Unauthorized to create stores.' }, { status: 403 });
    }

    const body = await request.json();
    const { name, location = 'Retail Store', managerEmail, companyId, code } = body;

    const targetCompanyId = auth.user.accessState === 'PLATFORM_ADMIN' && companyId
      ? companyId
      : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Valid company context required.' }, { status: 400 });
    }

    const company = await findCompanyById(targetCompanyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found. Please verify your company membership.' }, { status: 404 });
    }

    if (company.status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Cannot add stores to a suspended company.' }, { status: 403 });
    }

    const currentStores = await findCompanyStores(targetCompanyId);
    if (currentStores.length >= company.maxStores) {
      return NextResponse.json(
        { error: `Store limit reached. Maximum allowed stores for this company is ${company.maxStores}.` },
        { status: 400 }
      );
    }

    const storeName = typeof name === 'string' ? name.trim() : '';
    if (storeName.length < 2 || storeName.length > 100) {
      return NextResponse.json({ error: 'Store name must be between 2 and 100 characters.' }, { status: 400 });
    }

    // Assign genuine RFC 4122 UUID and store code
    const storeId = crypto.randomUUID();
    const storeCode = (code && typeof code === 'string' && code.trim())
      ? code.trim().toUpperCase()
      : `${company.slug.toUpperCase().substring(0, 4)}-${currentStores.length + 101}`;

    // If Supabase is active, persist directly into public.stores table
    if (isSupabaseServerConfigured()) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { error: storeErr } = await supabase
          .from('stores')
          .insert({
            id: storeId,
            company_id: targetCompanyId,
            user_id: auth.user.id,
            code: storeCode,
            name: storeName,
            location: location.trim(),
            store_type: 'Supercenter',
            total_skus: 0,
            status: 'ACTIVE',
          });

        if (storeErr) {
          return NextResponse.json(
            { error: storeErr.message || 'Failed to save store to database.' },
            { status: 400 }
          );
        }
      }
    }

    addCompanyStore(targetCompanyId, { id: storeId, name: storeName, code: storeCode, location: location.trim() });

    // Ingest into storage layer for live operational telemetry
    const memStore = getMemoryStore();
    if (!memStore.stores.some((s) => s.id === storeId)) {
      memStore.stores.push({
        id: storeId,
        company_id: targetCompanyId,
        code: storeCode,
        name: storeName,
        location: location.trim(),
        store_type: 'Supercenter',
        total_skus: 0,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      });
    }

    let invitation = null;
    if (managerEmail && typeof managerEmail === 'string' && managerEmail.trim()) {
      const email = managerEmail.toLowerCase().trim();
      if (!email.includes('@')) {
        return NextResponse.json({ error: 'Invalid store manager email address.' }, { status: 400 });
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashInvitationToken(rawToken);

      const invRecord = await createCompanyInvitation({
        companyId: targetCompanyId,
        companyName: company.name,
        storeId,
        storeName,
        email,
        role: 'STORE_MANAGER',
        tokenHash,
        invitedBy: auth.user.id,
        expiresInDays: 7,
      });

      const emailResult = await sendStoreManagerInvitationEmail({
        recipientEmail: email,
        companyName: company.name,
        storeName,
        rawToken,
        requestOrigin: request.headers.get('origin') || undefined,
      });

      invitation = {
        id: invRecord.id,
        email: invRecord.email,
        storeId,
        storeName,
        rawToken,
        inviteUrl: emailResult.inviteUrl,
        expiresAt: invRecord.expiresAt,
        emailDelivered: emailResult.delivered,
        emailWarning: emailResult.warning,
      };
    }

    return NextResponse.json({
      success: true,
      store: {
        id: storeId,
        name: storeName,
        location,
        code: storeCode,
      },
      invitation,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create store.';
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
      return NextResponse.json({ error: 'Only Company Managers or Platform Admins can update company settings.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, companyId } = body;

    const targetCompanyId = auth.user.accessState === 'PLATFORM_ADMIN' && companyId
      ? companyId
      : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json({ error: 'Company name must be between 2 and 100 characters.' }, { status: 400 });
    }

    const updated = await updateCompanyName(targetCompanyId, cleanName);
    if (!updated) {
      return NextResponse.json({ error: 'Company not found or update failed.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Company name successfully updated.',
      company: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        maxStores: updated.maxStores,
        status: updated.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update company settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

