import { NextResponse } from 'next/server';

interface AIAnalysisRequest {
  sku: string;
  productName: string;
  category: string;
  unitPrice: number;
  storeName: string;
  recordedStock: number;
  consecutiveZeroDays: number;
  expectedDailySales: number;
  poissonAnomalyP: number;
  isOnPromotion: boolean;
  primaryReason: string;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AIAnalysisRequest;

    if (!payload.sku || !payload.productName) {
      return NextResponse.json(
        { success: false, error: 'SKU and productName are required' },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    // Check if any AI provider key is configured
    if (!geminiKey && !openAiKey) {
      return NextResponse.json({
        success: true,
        aiAvailable: false,
        provider: 'NONE',
        message:
          'AI-Enhanced Root-Cause Reasoning is unavailable because neither GEMINI_API_KEY nor OPENAI_API_KEY is configured in server environment variables. Baseline Statistical Analysis is active.',
        diagnostic: null,
      });
    }

    const promptContext = `
You are the StockSentinel AI retail intelligence agent. Analyze this suspicious phantom stock-out case:
- Store: ${payload.storeName}
- SKU: ${payload.sku} - ${payload.productName} (${payload.category})
- Unit Price: $${payload.unitPrice.toFixed(2)}
- Recorded System Stock: ${payload.recordedStock} units
- Consecutive 0-Sales Days: ${payload.consecutiveZeroDays} days
- Expected Daily Demand: ${payload.expectedDailySales} units/day
- Statistical Poisson Zero Probability: ${payload.poissonAnomalyP}
- Active Promotion: ${payload.isOnPromotion ? 'Yes (elevated sales expected)' : 'No'}
- Baseline Signal: ${payload.primaryReason}

Provide a concise, professional retail diagnostic with:
1. "hypothesis": What is the most plausible operational root-cause? (e.g. unworked backroom pallet, misplaced into adjacent aisle, barcode scan failure, customer theft/shrinkage)
2. "actionSteps": 3 specific inspection steps for the store associate during the morning shelf walk.
3. "revenueImpact": Estimated lost revenue and customer impact summary.

Format your response as valid JSON matching this schema:
{
  "hypothesis": "string",
  "actionSteps": ["step 1", "step 2", "step 3"],
  "revenueImpact": "string"
}
`;

    // 1. Try Google Gemini if configured
    if (geminiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptContext }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json({
              success: true,
              aiAvailable: true,
              provider: 'GEMINI',
              diagnostic: parsed,
            });
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error('Gemini API call returned error:', errData);
        }
      } catch (err: unknown) {
        console.error('Gemini API request failed:', err instanceof Error ? err.message : err);
      }
    }

    // 2. Try OpenAI if configured
    if (openAiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a retail inventory AI specialist. Always respond with valid JSON.',
              },
              { role: 'user', content: promptContext },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return NextResponse.json({
              success: true,
              aiAvailable: true,
              provider: 'OPENAI',
              diagnostic: parsed,
            });
          }
        }
      } catch (err: unknown) {
        console.error('OpenAI API request failed:', err instanceof Error ? err.message : err);
      }
    }

    // If both failed or timed out
    return NextResponse.json({
      success: true,
      aiAvailable: false,
      provider: 'ERROR',
      message:
        'The configured AI provider was unreachable or timed out. Falling back to the deterministic Baseline Statistical Analysis.',
      diagnostic: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI diagnostic failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
