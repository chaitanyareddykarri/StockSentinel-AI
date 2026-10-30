import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getConversationById, getMessages, deleteConversation } from '@/lib/storage';

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

    const { id } = await props.params;
    const conversation = await getConversationById(id, auth.user.id, auth.user.companyId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied.' },
        { status: 404 }
      );
    }

    if (auth.user.accessState === 'PENDING_ASSIGNMENT' || auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account or company access is suspended or unassigned.' },
        { status: 403 }
      );
    }

    const messages = await getMessages(id, auth.user.id);

    return NextResponse.json({
      success: true,
      conversation,
      messages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve conversation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const success = await deleteConversation(id, auth.user.id, auth.user.companyId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete conversation';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
