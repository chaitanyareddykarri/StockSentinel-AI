import { NextResponse } from 'next/server';
import { getAlerts, updateAlertStatus } from '@/lib/storage';
import { AlertStatus, VerificationOutcome } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const risk = searchParams.get('risk') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const alerts = await getAlerts({ storeId, risk, status, search });
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
    const body = await request.json();
    const { alertId, status, outcome, notes, shelfCount, auditor } = body;

    if (!alertId || !status) {
      return NextResponse.json(
        { success: false, error: 'alertId and status are required' },
        { status: 400 }
      );
    }

    const updated = await updateAlertStatus(
      alertId,
      status as AlertStatus,
      outcome as VerificationOutcome,
      notes,
      shelfCount,
      auditor || 'Store Associate'
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
