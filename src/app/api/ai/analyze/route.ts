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

    // Check if any AI provider key is configured
    if (!geminiKey && !openAiKey) {
      return NextResponse.json({
        success: true,
        aiAvailable: false,
        provider: 'NONE',
        message:
          'AI-Enhanced Root-Cause Reasoning is unavailable because neither GEMINI_API_KEY nor OPENAI_API_KEY is configured in server environment variables. Baseline Statistical Analysis is active. Configure GEMINI_API_KEY in your Vercel Project Settings > Environment Variables, then redeploy.',
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
      const geminiModels = [
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-flash-lite-latest',
      ];

      let lastError = '';

      for (const model of geminiModels) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
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
              const cleaned = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
              const parsed = JSON.parse(cleaned);
              return NextResponse.json({
                success: true,
                aiAvailable: true,
                provider: `GEMINI (${model})`,
                diagnostic: {
                  hypothesis: parsed.hypothesis || 'Phantom stock anomaly identified.',
                  actionSteps: Array.isArray(parsed.actionSteps)
                    ? parsed.actionSteps
                    : [parsed.actionSteps || 'Inspect physical shelf location.'],
                  revenueImpact: parsed.revenueImpact || 'Elevated risk of stock-out revenue loss.',
                },
              });
            }
          } else {
            const errText = await response.text();
            lastError = `HTTP ${response.status}: ${errText}`;
            console.warn(`Gemini model ${model} failed:`, lastError);
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(`Gemini model ${model} request error:`, lastError);
        }
      }

      if (!openAiKey) {
        return NextResponse.json({
          success: true,
          aiAvailable: false,
          provider: 'GEMINI',
          message: `Gemini API call failed across all attempted models (${lastError.substring(0, 150)}). Please check that your GEMINI_API_KEY is valid.`,
          diagnostic: null,
        });
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
                content:
                  'You are an expert retail loss-prevention and inventory analyst. You diagnose phantom stock-out causes based on sales streaks and on-hand inventory.',
              },
              { role: 'user', content: promptContext },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
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
              provider: 'OPENAI (gpt-4o-mini)',
              diagnostic: parsed,
            });
          }
        }
      } catch (err: unknown) {
        console.warn('OpenAI analysis failed:', err instanceof Error ? err.message : err);
      }
    }

    // Fallback if providers were reached but failed
    return NextResponse.json({
      success: true,
      aiAvailable: false,
      provider: 'NONE',
      message: 'AI providers did not return diagnostics. Baseline Statistical Analysis is active.',
      diagnostic: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI diagnostic failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
