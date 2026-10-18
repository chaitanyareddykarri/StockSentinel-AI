import { NextResponse } from 'next/server';
import { isUsingSupabase, resetDemoData } from '@/lib/storage';

export async function GET() {
  const isPostgres = isUsingSupabase();
  return NextResponse.json({
    success: true,
    storageType: isPostgres ? 'SUPABASE_POSTGRESQL' : 'DEMO_IN_MEMORY',
    isSupabaseConfigured: isPostgres,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'reset') {
      resetDemoData();
      return NextResponse.json({
        success: true,
        message: 'Demo dataset successfully reset to baseline initial state.',
      });
    }

    return NextResponse.json({ success: true, message: 'Demo endpoint ready' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Demo operation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
