import { NextResponse } from 'next/server';
import { getAuditLogs, getDetectionRuns } from '@/lib/storage';

export async function GET() {
  try {
    const [auditLogs, runs] = await Promise.all([
      getAuditLogs(),
      getDetectionRuns(),
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
