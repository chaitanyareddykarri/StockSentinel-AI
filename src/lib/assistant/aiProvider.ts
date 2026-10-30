import type { ChatMessage } from '@/types';

export interface GenerateChatParams {
  userMessage: string;
  history: ChatMessage[];
  groundingContext: string;
  userName?: string;
  storeName?: string;
}

export interface GenerateChatResult {
  success: boolean;
  content: string;
  provider: string;
  error?: string;
  isConfigError?: boolean;
}

const RETAIL_SYSTEM_INSTRUCTIONS = `
You are StockSentinel AI, an expert retail inventory intelligence copilot.
Your mission is to help store managers, inventory leads, and retail associates detect and resolve "phantom stock-outs" — items that show as in-stock in store inventory databases but are physically depleted, displaced, or missing from the store shelf.

Core Operating Principles:
1. Grounding in Real Data: You must strictly base your findings, SKUs, dollar impacts, zero-sales streaks, and probabilities on the verified retail inventory context provided below.
2. Honest Boundaries: Never fabricate inventory counts, prices, demand rates, or phantom stock-out causes. If a SKU or data point is not in the context, explicitly state that it is not present in store records.
3. Terminology Accuracy:
   - "Recorded Inventory" = System computer balance.
   - "Physical Shelf Stock" = What an associate counts in person during a walk.
   - "Zero Sales" = A statistical anomaly indicator, not conclusive proof of theft.
4. Operational Guidance: For any suspicious product, provide practical retail walk actions (e.g., check adjacent facings, scan shelf tag barcode, inspect backroom staging risers, update shelf count to 0 to trigger automatic warehouse replenishment).
5. Format: Clear, professional, readable markdown with bold key figures and concise action bullets.
`.trim();

export async function generateChatCompletion(
  params: GenerateChatParams
): Promise<GenerateChatResult> {
  const { userMessage, history, groundingContext, userName, storeName } = params;

  const rawGeminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const geminiKey = rawGeminiKey?.trim().replace(/^["']|["']$/g, '');

  const rawOpenAiKey =
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  const openAiKey = rawOpenAiKey?.trim().replace(/^["']|["']$/g, '');

  // 1. Check if any provider key is configured
  if (!geminiKey && !openAiKey) {
    return {
      success: false,
      content: '',
      provider: 'NONE',
      error:
        'AI reasoning engine is unavailable because GEMINI_API_KEY is not configured in server environment variables. Baseline statistical detection remains active.',
      isConfigError: true,
    };
  }

  // Construct complete system instructions with live inventory context
  const fullSystemPrompt = `
${RETAIL_SYSTEM_INSTRUCTIONS}

[ACTIVE USER & CONTEXT]
- Associate Name: ${userName || 'Store Associate'}
- Assigned Store: ${storeName || 'Retail Operations'}

${groundingContext}
`.trim();

  // 2. Primary Provider: Google Gemini
  if (geminiKey) {
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-pro-latest',
    ];

    // Build multi-turn message history for Gemini (last 8 messages max)
    const recentHistory = history.slice(-8);
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    let lastError = '';

    for (const model of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: fullSystemPrompt }],
            },
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1200,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (rawText && typeof rawText === 'string') {
            return {
              success: true,
              content: rawText.trim(),
              provider: `GEMINI (${model})`,
            };
          }
        } else {
          const errStatus = response.status;
          const errBody = await response.text();
          lastError = `HTTP ${errStatus}: ${errBody.substring(0, 120)}`;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // If Gemini failed across all candidate models, check if OpenAI can serve as fallback
    if (!openAiKey) {
      return {
        success: false,
        content: '',
        provider: 'GEMINI',
        error: `AI reasoning provider timed out or returned an error (${lastError.substring(0, 100)}). Please verify your GEMINI_API_KEY quota or retry in a few moments.`,
        isConfigError: false,
      };
    }
  }

  // 3. Secondary Fallback Provider: OpenAI
  if (openAiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const recentHistory = history.slice(-8);
      const openAiMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...recentHistory.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.2,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return {
            success: true,
            content: content.trim(),
            provider: 'OPENAI (gpt-4o-mini)',
          };
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        content: '',
        provider: 'OPENAI',
        error: `OpenAI provider request failed (${msg.substring(0, 100)}).`,
        isConfigError: false,
      };
    }
  }

  return {
    success: false,
    content: '',
    provider: 'NONE',
    error: 'AI reasoning engine could not process the request.',
    isConfigError: false,
  };
}
