// ============================================================
// PAWEN — /api/emails/generate — Email Sequence Generator
//
// Generates email sequences (welcome, abandon cart, post-purchase,
// winback, browse abandonment, VIP nurture, launch) using the
// project's Brand DNA, hooks, and voice profile.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const EMAIL_MODEL = 'claude-sonnet-4-6';

const SEQUENCE_SPECS: Record<string, { label: string; count: number; description: string }> = {
  welcome:             { label: 'Welcome Series',       count: 5, description: 'Post-purchase onboarding: welcome, education, social proof, optimization tips, check-in' },
  abandon_cart:        { label: 'Abandon Cart',         count: 4, description: 'Cart recovery: gentle reminder, objection handling, urgency, final discount offer' },
  post_purchase:       { label: 'Post-Purchase',        count: 4, description: 'Retention: shipping/tracking, week 1 check-in, 30-day upsell, review request' },
  winback:             { label: 'Winback',              count: 3, description: 'Re-engagement: soft check-in, discount incentive, last chance' },
  browse_abandonment:  { label: 'Browse Abandonment',   count: 3, description: 'Browse recovery: education, comparison, cost of inaction' },
  vip_nurture:         { label: 'VIP Nurture',          count: 4, description: 'Loyalty: VIP welcome, insider access, progress report, referral/gift offer' },
  launch:              { label: 'Launch Sequence',      count: 5, description: 'Product launch: problem reveal, mechanism education, social proof, launch day, urgency close' },
};

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { sequenceType, brandDNA, hooks, voiceProfile, funnelType, productName } = body;

  if (!sequenceType || !SEQUENCE_SPECS[sequenceType]) {
    return NextResponse.json({ message: `Invalid sequenceType. Use: ${Object.keys(SEQUENCE_SPECS).join(', ')}` }, { status: 400 });
  }

  const spec = SEQUENCE_SPECS[sequenceType];

  // Build the prompt
  const systemPrompt = buildSystemPrompt(brandDNA, voiceProfile);
  const userMessage = buildUserMessage(sequenceType, spec, brandDNA, hooks, funnelType, productName);

  const requestBody = {
    model: EMAIL_MODEL,
    max_tokens: 16384,
    temperature: 0.7,
    system: [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
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

    // Parse the JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ message: 'Failed to parse email sequence from AI response' }, { status: 500 });
    }

    const sequence = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      sequence,
      tokensUsed: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

function buildSystemPrompt(brandDNA: Record<string, unknown> | null, voiceProfile: Record<string, unknown> | null): string {
  let prompt = `You are an elite e-commerce email copywriter. You write emails that convert — short, punchy, emotionally resonant, mechanism-driven copy. No fluff. No filler. Every sentence earns its place.

You specialize in email sequences for DTC (direct-to-consumer) brands that sell physical products online.

RULES:
- Write in the brand's voice (provided below)
- Use the brand's locked terms (mechanism name, root cause, belief error) naturally — never forced
- Use customer language (pain quotes, desire quotes) — weave them in as if you KNOW the reader
- Never use words from the "never_use" list
- Always use words from the "always_use" list where natural
- Subject lines must be under 60 characters, curiosity-driven, and avoid spam triggers
- Preview text should complement (not repeat) the subject line
- Body copy should be HTML-ready with <p>, <strong>, <em>, <ul>/<li> tags
- CTA text should be action-oriented, specific, and under 8 words
- Each email should have a clear single purpose and ONE CTA
- Vary emotional arcs across the sequence (don't start every email the same way)`;

  if (brandDNA) {
    const dna = brandDNA as Record<string, unknown>;
    const locked = dna.locked_terms as Record<string, unknown> | undefined;
    const lang = dna.customer_language as Record<string, unknown> | undefined;

    if (locked) {
      prompt += `\n\n=== BRAND DNA (LOCKED TERMS) ===
Product: ${dna.product_name || 'Unknown'}
Mechanism: ${locked.mechanism_name || 'N/A'}
Root Cause: ${locked.root_cause_one_sentence || 'N/A'}
Belief Error: ${locked.belief_error || 'N/A'}
Product Descriptor: ${locked.product_descriptor || 'N/A'}
Key Proof Points: ${JSON.stringify(locked.key_proof_points || [])}
Guarantee: ${locked.guarantee_wording || 'N/A'}`;
    }

    if (lang) {
      prompt += `\n\n=== CUSTOMER LANGUAGE ===
Pain Quotes: ${JSON.stringify(lang.pain_quotes || [])}
Desire Quotes: ${JSON.stringify(lang.desire_quotes || [])}
Always Use: ${JSON.stringify(lang.always_use || [])}
Never Use: ${JSON.stringify(lang.never_use || [])}`;
    }
  }

  if (voiceProfile) {
    const vp = voiceProfile as Record<string, unknown>;
    prompt += `\n\n=== VOICE PROFILE ===
Vocabulary: ${JSON.stringify(vp.vocabulary || [])}
Sentence Style: ${vp.sentence_style || 'Conversational'}
Formality Level: ${vp.formality_level || 3}/5
Emotional Tone: ${vp.emotional_tone || 'Empathetic authority'}
Phrases to Use: ${JSON.stringify(vp.phrases_to_use || [])}
Phrases to Avoid: ${JSON.stringify(vp.phrases_to_avoid || [])}
Sample Paragraph: ${vp.sample_paragraph || 'N/A'}`;
  }

  return prompt;
}

function buildUserMessage(
  sequenceType: string,
  spec: { label: string; count: number; description: string },
  brandDNA: Record<string, unknown> | null,
  hooks: string[] | null,
  funnelType: string | null,
  productName: string | null,
): string {
  let msg = `Generate a complete "${spec.label}" email sequence with exactly ${spec.count} emails.

SEQUENCE TYPE: ${spec.label}
PURPOSE: ${spec.description}
PRODUCT: ${productName || (brandDNA as Record<string, unknown>)?.product_name || 'Unknown'}`;

  if (funnelType) {
    msg += `\nFUNNEL POSITION: ${funnelType}`;
  }

  if (hooks && hooks.length > 0) {
    msg += `\n\nTOP HOOKS TO DRAW FROM:\n${hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;
  }

  msg += `

Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):
{
  "type": "${sequenceType}",
  "label": "${spec.label}",
  "emails": [
    {
      "id": "${sequenceType}-1",
      "position": 1,
      "subject_lines": [
        { "variant": "A", "text": "subject line A" },
        { "variant": "B", "text": "subject line B" },
        { "variant": "C", "text": "subject line C" }
      ],
      "preview_text": "preview text here",
      "body": "<p>HTML body here</p>",
      "cta_text": "CTA Button Text",
      "send_timing": "Immediately / +1 hour / +24 hours / etc."
    }
  ]
}

Generate exactly ${spec.count} emails. Each email MUST have exactly 3 subject line variants (A, B, C).
Body must be valid HTML with <p>, <strong>, <em>, <ul>/<li>, <br/> tags.
Make each email distinct in purpose and emotional arc.
Use the brand's mechanism, proof points, and customer language throughout.`;

  return msg;
}
