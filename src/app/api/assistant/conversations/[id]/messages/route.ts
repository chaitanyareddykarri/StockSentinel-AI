import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';
import { getConversationById, getMessages, saveMessage } from '@/lib/storage';
import { buildInventoryGrounding } from '@/lib/assistant/grounding';
import { generateChatCompletion } from '@/lib/assistant/aiProvider';

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
    return NextResponse.json({ success: true, messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve messages';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce Server-Side Authentication
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    // 2. Validate Conversation Ownership and Tenant Isolation First (Avoid Leaking Existence)
    const { id } = await props.params;
    const conversation = await getConversationById(id, auth.user.id, auth.user.companyId);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied.' },
        { status: 404 }
      );
    }

    // 3. Reject Pending or Suspended Accounts
    if (auth.user.accessState === 'PENDING_ASSIGNMENT' || auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account or company access is suspended or unassigned.' },
        { status: 403 }
      );
    }

    // 4. Validate Input Payload
    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Message content cannot be empty.' },
        { status: 400 }
      );
    }

    if (content.length > 2500) {
      return NextResponse.json(
        { success: false, error: 'Message exceeds the maximum length of 2,500 characters.' },
        { status: 400 }
      );
    }

    // 5. Retrieve Existing Chronological Messages for Conversation Continuity
    const priorMessages = await getMessages(id, auth.user.id);

    // 6. Persist the User's Message First
    const userMessage = await saveMessage({
      conversationId: id,
      userId: auth.user.id,
      role: 'user',
      content,
    });

    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: 'Failed to record user message.' },
        { status: 500 }
      );
    }

    // 7. Build Server-Side Grounding Context from Verified Inventory Records Scoped to Tenant/Store
    const { formattedContext } = await buildInventoryGrounding(auth.user.id, content, auth.user);

    // 8. Invoke AI Reasoning Engine
    const aiResult = await generateChatCompletion({
      userMessage: content,
      history: priorMessages,
      groundingContext: formattedContext,
      userName: auth.user.name,
      storeName: auth.user.assignedStoreName || auth.user.storeName,
    });

    // 9. Handle Provider Failures Honestly (Never Fabricate Answers)
    if (!aiResult.success) {
      return NextResponse.json(
        {
          success: false,
          userMessage,
          error: aiResult.error || 'AI provider failed to generate a response.',
          isConfigError: aiResult.isConfigError,
        },
        { status: aiResult.isConfigError ? 400 : 503 }
      );
    }

    // 10. Save Real Assistant Response to Conversation History
    const assistantMessage = await saveMessage({
      conversationId: id,
      userId: auth.user.id,
      role: 'assistant',
      content: aiResult.content,
    });

    return NextResponse.json({
      success: true,
      userMessage,
      assistantMessage,
      provider: aiResult.provider,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process assistant message';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
