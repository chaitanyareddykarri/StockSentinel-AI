import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryGrounding } from '../src/lib/assistant/grounding';
import { generateChatCompletion } from '../src/lib/assistant/aiProvider';
import { createUser, createSession } from '../src/lib/auth/userStore';
import { createConversation, getConversationById, getMessages, saveMessage } from '../src/lib/storage';
import { POST as postMessageRoute, GET as getMessagesRoute } from '../src/app/api/assistant/conversations/[id]/messages/route';

test('1. Grounding context retrieves real store and alert data', async () => {
  const testUserId = `usr_test_grounding_${Date.now()}`;
  const context = await buildInventoryGrounding(testUserId, 'What are the top phantom stock-outs today?');

  assert.ok(context.formattedContext);
  assert.ok(context.formattedContext.includes('VERIFIED RETAIL INVENTORY CONTEXT'));
  assert.ok(context.formattedContext.includes('WORKSPACE PORTFOLIO METRICS'));
  assert.ok(context.formattedContext.includes('TOP PRIORITY SUSPICIOUS SKU-STORE ALERTS'));
  assert.equal(typeof context.hasAlerts, 'boolean');
});

test('2. Grounding context deep-dives into referenced SKU without fabricating values', async () => {
  const testUserId = `usr_test_sku_${Date.now()}`;
  // Query specifically for SKU-104
  const context = await buildInventoryGrounding(testUserId, 'Why is SKU-104 flagged as a phantom stock-out?');

  assert.ok(context.formattedContext.includes('SKU-104'));
  assert.equal(context.matchedSku, 'SKU-104');
  assert.ok(context.formattedContext.includes('Recorded System On-Hand Stock'));
  assert.ok(context.formattedContext.includes('Recent Consecutive Zero-Sales Days'));
  assert.ok(context.formattedContext.includes('Statistical Poisson Zero Probability'));
});

test('3. Enforce conversation ownership and reject unauthorized access', async () => {
  const user1 = await createUser({
    email: `owner_${Date.now()}@walmart-ops.com`,
    name: 'Owner Associate',
    storeName: 'Store #101',
    role: 'STORE_MANAGER',
  });

  const user2 = await createUser({
    email: `attacker_${Date.now()}@walmart-ops.com`,
    name: 'Attacker Associate',
    storeName: 'Store #102',
    role: 'ASSOCIATE',
  });

  // User 1 creates conversation
  const conv1 = await createConversation(user1.id, 'Confidential Stock Audit');

  // User 2 tries to access User 1's conversation
  const unauthorizedAccess = await getConversationById(conv1.id, user2.id);
  assert.equal(unauthorizedAccess, null);

  // User 2 tries to read messages
  const unauthorizedMessages = await getMessages(conv1.id, user2.id);
  assert.equal(unauthorizedMessages.length, 0);

  // User 2 tries to save message into User 1's conversation
  const unauthorizedSave = await saveMessage({
    conversationId: conv1.id,
    userId: user2.id,
    role: 'user',
    content: 'Malicious injection into user 1 chat',
  });
  assert.equal(unauthorizedSave, null);
});

test('4. Gracefully reject AI completion when provider keys are missing without fabricating answers', async () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAI = process.env.OPENAI_API_KEY;

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_KEY;

    const result = await generateChatCompletion({
      userMessage: 'What is the stock level for SKU-101?',
      history: [],
      groundingContext: 'Test context with no providers',
    });

    assert.equal(result.success, false);
    assert.equal(result.isConfigError, true);
    assert.equal(result.content, '');
    assert.match(result.error || '', /GEMINI_API_KEY is not configured/i);
  } finally {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
  }
});

test('5. Avoid fabricated values when dataset is empty', async () => {
  const emptyContext = await buildInventoryGrounding('non-existent-user-id-999', 'Tell me about promotions');
  assert.ok(emptyContext.formattedContext.includes('OPERATIONAL GUIDANCE RULES'));
  assert.ok(emptyContext.formattedContext.includes('Recorded On-Hand Stock'));
  assert.ok(emptyContext.formattedContext.includes('Physically Verified Stock'));
});

test('6. Route Handler: Unauthenticated message request rejected with 401', async () => {
  const req = new Request('http://localhost:3000/api/assistant/conversations/conv-123/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Hello' }),
  });

  const res = await postMessageRoute(req, { params: Promise.resolve({ id: 'conv-123' }) });
  const data = await res.json();

  assert.equal(res.status, 401);
  assert.equal(data.success, false);
  assert.match(data.error, /Authentication required/i);
});

test('7. Route Handler: Reject access to another user conversation with 404', async () => {
  const user1 = await createUser({
    email: `route_user1_${Date.now()}@walmart-ops.com`,
    name: 'User One',
    storeName: 'Store 1',
    role: 'STORE_MANAGER',
  });

  const user2 = await createUser({
    email: `route_user2_${Date.now()}@walmart-ops.com`,
    name: 'User Two',
    storeName: 'Store 2',
    role: 'ASSOCIATE',
  });

  const conv1 = await createConversation(user1.id, 'User 1 Private Audit');
  const token2 = await createSession(user2);

  const req = new Request(`http://localhost:3000/api/assistant/conversations/${conv1.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `stocksentinel_session=${token2}`,
    },
    body: JSON.stringify({ content: 'Attempt to inject into user 1 chat' }),
  });

  const res = await postMessageRoute(req, { params: Promise.resolve({ id: conv1.id }) });
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.success, false);
  assert.match(data.error, /Conversation not found or access denied/i);
});

test('8. Route Handler: Provider failure saves user message but avoids fabricated assistant response', async () => {
  const user = await createUser({
    email: `route_err_${Date.now()}@walmart-ops.com`,
    name: 'Test Associate',
    storeName: 'Store 101',
    role: 'STORE_MANAGER',
  });

  const conv = await createConversation(user.id, 'Test Provider Failure');
  const token = await createSession(user);

  // Temporarily unset AI keys to trigger provider config failure
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAI = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;

  try {
    const req = new Request(`http://localhost:3000/api/assistant/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `stocksentinel_session=${token}`,
      },
      body: JSON.stringify({ content: 'Why is SKU-104 missing?' }),
    });

    const res = await postMessageRoute(req, { params: Promise.resolve({ id: conv.id }) });
    const data = await res.json();

    assert.equal(res.status, 400); // isConfigError returns 400
    assert.equal(data.success, false);
    assert.ok(data.userMessage); // User message was recorded
    assert.equal(data.assistantMessage, undefined); // NO fabricated assistant message was saved!

    // Verify in storage that only the user message was saved
    const messages = await getMessages(conv.id, user.id);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'user');
  } finally {
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
  }
});

test('9. Route Handler: Chat persistence across new requests', async () => {
  const user = await createUser({
    email: `route_persist_${Date.now()}@walmart-ops.com`,
    name: 'Persist Associate',
    storeName: 'Store 101',
    role: 'STORE_MANAGER',
  });

  const conv = await createConversation(user.id, 'Persist Test');
  const token = await createSession(user);

  // Manually save a user and assistant message
  await saveMessage({
    conversationId: conv.id,
    userId: user.id,
    role: 'user',
    content: 'Initial walk query',
  });
  await saveMessage({
    conversationId: conv.id,
    userId: user.id,
    role: 'assistant',
    content: 'Verified shelf walk advice',
  });

  // Call GET route
  const getReq = new Request(`http://localhost:3000/api/assistant/conversations/${conv.id}/messages`, {
    headers: {
      Cookie: `stocksentinel_session=${token}`,
    },
  });

  const getRes = await getMessagesRoute(getReq, { params: Promise.resolve({ id: conv.id }) });
  const getData = await getRes.json();

  assert.equal(getRes.status, 200);
  assert.equal(getData.success, true);
  assert.equal(getData.messages.length, 2);
  assert.equal(getData.messages[0].role, 'user');
  assert.equal(getData.messages[1].role, 'assistant');
});

