// ============================================================
// PAWEN — /api/ugc-briefs/generate — UGC Creator Brief Generator
// Generates professional creator briefs using Claude Sonnet 4.6
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    format,        // 'talking_head' | 'grwm' | 'unboxing_review'
    projectContext, // { productName, targetAudience, brandDna, mechanism, hooks, scripts, tone }
  } = body;

  if (!format || !projectContext) {
    return NextResponse.json({ message: 'Missing format or projectContext' }, { status: 400 });
  }

  const formatLabels: Record<string, string> = {
    talking_head: 'Talking Head (30-60s)',
    grwm: 'Get Ready With Me (GRWM, 60-90s)',
    unboxing_review: 'Unboxing / Review (45-75s)',
  };

  const formatLabel = formatLabels[format] || format;

  const systemPrompt = `You are an elite UGC (User-Generated Content) creative director who writes briefs for content creators. You specialize in direct-response video ads for Meta (Facebook/Instagram), TikTok, and YouTube Shorts.

Your briefs are so detailed that a creator can film the entire video without any additional direction. You think in terms of emotional beats, specific timing, exact phrases, and visual composition.

You always output valid JSON matching the exact schema requested. No markdown, no code fences, just raw JSON.`;

  const userMessage = `Generate a complete UGC creator brief for the following:

FORMAT: ${formatLabel}
PRODUCT: ${projectContext.productName || 'Unknown product'}
TARGET AUDIENCE: ${projectContext.targetAudience || 'Not specified'}

=== BRAND DNA ===
${projectContext.brandDna || 'Not available'}

=== MECHANISM / ROOT CAUSE ===
${projectContext.mechanism || 'Not available'}

=== TOP HOOKS (from Gate 4) ===
${projectContext.hooks || 'Not available'}

=== VIDEO SCRIPTS (from Gate 6) ===
${projectContext.scripts || 'Not available'}

=== BRAND TONE ===
${projectContext.tone || 'Not specified'}

Generate a JSON object with this EXACT structure:
{
  "id": "ugc-brief-gen-${format}",
  "format": "${format}",
  "format_label": "${formatLabel}",
  "duration": "<appropriate duration range>",
  "brief": {
    "overview": {
      "product_name": "<product name>",
      "target_audience": "<detailed target audience>",
      "key_message": "<one compelling sentence>",
      "tone": "<tone description>"
    },
    "script_structure": [
      { "timing": "<e.g. 0-3s>", "beat": "<BEAT NAME>", "description": "<detailed direction>" }
    ],
    "talking_points": ["<exact phrase the creator should say>", ...],
    "emotional_beats": [
      { "timing": "<timing>", "emotion": "<emotion name>", "direction": "<acting direction>" }
    ],
    "broll_shot_list": [
      { "shot": "<shot description>", "duration": "<duration>", "notes": "<production notes>" }
    ],
    "dos_and_donts": {
      "dos": ["<do this>", ...],
      "donts": ["<don't do this>", ...]
    },
    "wardrobe_setting": {
      "wardrobe": "<wardrobe description>",
      "setting": "<setting description>",
      "props": ["<prop>", ...]
    },
    "cta_instructions": {
      "script": "<exact CTA script>",
      "delivery": "<how to deliver it>",
      "visual": "<what should be on screen>"
    },
    "technical_specs": {
      "aspect_ratio": "<ratio>",
      "min_duration": "<min>",
      "max_duration": "<max>",
      "lighting": "<lighting notes>",
      "audio": "<audio notes>"
    }
  }
}

Requirements:
- script_structure must have 6-8 beats with specific timing
- talking_points must have 6-10 exact phrases the creator can memorize
- emotional_beats must map to each major timing section
- broll_shot_list must have 6-10 specific shots with duration
- dos must have 5-7 items, donts must have 5-7 items
- All talking points should use the brand's hooks, mechanism, and voice from the data above
- Make it specific to the ${formatLabel} format — not generic
- Output ONLY the JSON object, no other text`;

  const requestBody = {
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 12000,
    temperature: 0.7,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'prompt-caching-2024-07-31',
  };

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(115_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Anthropic API error', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    const content = data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

    // Parse the JSON from the response
    let brief;
    try {
      // Strip potential markdown code fences
      const cleaned = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      brief = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { message: 'Failed to parse AI response as JSON', raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brief,
      tokensUsed: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
      cached: (data.usage?.cache_read_input_tokens ?? 0) > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
