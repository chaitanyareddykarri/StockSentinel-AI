import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { findCompanyById, updateCompanyName } from '@/lib/auth/userStore';

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState === 'PENDING_ASSIGNMENT' || auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized to view company details.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetCompanyId =
      auth.user.accessState === 'PLATFORM_ADMIN' && searchParams.get('companyId')
        ? searchParams.get('companyId')!
        : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'No company identified for this request.' }, { status: 400 });
    }

    const company = await findCompanyById(targetCompanyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        maxStores: company.maxStores,
        status: company.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve company.';
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
      return NextResponse.json(
        { error: 'Only Company Managers or Platform Admins can update company settings.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { name, companyId } = body;

    const targetCompanyId =
      auth.user.accessState === 'PLATFORM_ADMIN' && companyId
        ? companyId
        : auth.user.companyId;

    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Company ID required.' }, { status: 400 });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 100) {
      return NextResponse.json(
        { error: 'Company name must be between 2 and 100 characters.' },
        { status: 400 }
      );
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

