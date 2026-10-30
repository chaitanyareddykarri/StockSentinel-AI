import { NextResponse } from 'next/server';
import { getAlertById, getAuditLogs } from '@/lib/storage';
import { getAuthenticatedUser, validateStoreAccess } from '@/lib/auth/serverAuth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    if (auth.user.accessState === 'PENDING_ASSIGNMENT' || auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account or company access is suspended or unassigned.' },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    const allowedStoreIds = auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds;
    const alert = await getAlertById(id, auth.user.id, allowedStoreIds);

    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    const storeCheck = validateStoreAccess(auth.user, alert.store_id);
    if (!storeCheck.authorized) {
      // Avoid revealing whether another tenant's resource exists
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    const auditLogs = await getAuditLogs(id, auth.user.id, allowedStoreIds);

    return NextResponse.json({
      success: true,
      alert,
      auditLogs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch alert details';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
