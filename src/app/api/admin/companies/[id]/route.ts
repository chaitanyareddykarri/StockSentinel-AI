import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import {
  getStandaloneCompany,
  updateStandaloneCompanyStatus,
} from '@/lib/auth/userStore';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (auth.user.accessState !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'Platform Administrator privileges required to modify company status.' },
        { status: 403 }
      );
    }

    const resolvedParams = 'then' in props.params ? await props.params : props.params;
    const companyId = resolvedParams?.id;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing company ID.' }, { status: 400 });
    }

    const company = getStandaloneCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body;

    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Invalid status. Permitted values are "ACTIVE" or "SUSPENDED".' },
        { status: 400 }
      );
    }

    const updated = updateStandaloneCompanyStatus(companyId, status);

    return NextResponse.json({
      success: true,
      message: `Company status successfully updated to ${status}.`,
      company: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update company status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

