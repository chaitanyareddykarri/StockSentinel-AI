import { NextResponse } from 'next/server';
import { getAuditLogs, getDetectionRuns } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

export async function GET(request: Request) {
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

    const allowedStoreIds = auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds;

    const [auditLogs, runs] = await Promise.all([
      getAuditLogs(undefined, auth.user.id, allowedStoreIds, auth.user.companyId),
      getDetectionRuns(auth.user.id, allowedStoreIds, auth.user.companyId),
    ]);

    return NextResponse.json({
      success: true,
      auditLogs,
      runs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit records';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
