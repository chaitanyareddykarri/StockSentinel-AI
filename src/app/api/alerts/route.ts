import { NextResponse } from 'next/server';
import { getAlerts, getAlertById, updateAlertStatus } from '@/lib/storage';
import { authorizeRequest, getAuthenticatedUser, validateStoreAccess } from '@/lib/auth/serverAuth';
import type { AlertStatus, VerificationOutcome } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const risk = searchParams.get('risk') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const auth = await authorizeRequest(request, storeId);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    const alerts = await getAlerts({
      storeId: auth.targetStoreId,
      risk,
      status,
      search,
      userId: auth.user.id,
      allowedStoreIds: auth.effectiveStoreIds,
      companyId: auth.user.companyId,
    });

    return NextResponse.json({ success: true, alerts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch alerts';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json().catch(() => ({}));
    const { alertId, status, outcome, notes, shelfCount, auditor } = body;

    if (!alertId || !status) {
      return NextResponse.json(
        { success: false, error: 'alertId and status are required' },
        { status: 400 }
      );
    }

    // Retrieve existing alert to verify store/company isolation
    const existingAlert = await getAlertById(alertId);
    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Verify user has permission to mutate this alert's store
    const storeCheck = validateStoreAccess(auth.user, existingAlert.store_id);
    if (!storeCheck.authorized) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You are not authorized to update alerts for this store.' },
        { status: 403 }
      );
    }

    const allowedStoreIds = auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds;
    const updated = await updateAlertStatus(
      alertId,
      status as AlertStatus,
      outcome as VerificationOutcome,
      notes,
      shelfCount,
      auditor || auth.user.name,
      auth.user.id,
      allowedStoreIds
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, alert: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update alert';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return PATCH(request);
}
