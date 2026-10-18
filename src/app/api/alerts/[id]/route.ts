import { NextResponse } from 'next/server';
import { getAlertById, getAuditLogs } from '@/lib/storage';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const alert = await getAlertById(id);

    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    const auditLogs = await getAuditLogs(id);

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
