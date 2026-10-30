import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getConversations, createConversation } from '@/lib/storage';

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

    const conversations = await getConversations(auth.user.id);

    return NextResponse.json({
      success: true,
      conversations,
      authMode: auth.user.authMode,
      isDurable: auth.user.isDurable,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve conversations';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const title = typeof body.title === 'string' ? body.title : undefined;

    const conversation = await createConversation(auth.user.id, title, auth.user.companyId);

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create conversation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
