// ============================================================
// PAWEN — /api/offer-stack/generate — Offer Stack AI Generation
// Uses Claude Sonnet 4.6 to generate offer components:
// bonuses, guarantee copy, urgency/scarcity, price anchoring.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

type GenerateType = 'bonuses' | 'guarantee' | 'urgency' | 'price-anchoring' | 'full-offer' | 'awareness-adapt';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    type,
    productName,
    productDescription,
    niche,
    retailValue,
    bonuses,
    guaranteeType,
    awarenessLevel,
    brandDNA,
    mechanism,
  } = body as {
    type: GenerateType;
    productName: string;
    productDescription: string;
    niche: string;
    retailValue?: number;
    bonuses?: Array<{ name: string; description: string; perceivedValue: number }>;
    guaranteeType?: string;
    awarenessLevel?: string;
    brandDNA?: string;
    mechanism?: string;
  };

  const contextBlock = [
    `Product: ${productName}`,
    `Description: ${productDescription}`,
    `Niche: ${niche}`,
    retailValue ? `Retail Value: $${retailValue}` : '',
    brandDNA ? `Brand DNA Summary: ${brandDNA}` : '',
    mechanism ? `Core Mechanism: ${mechanism}` : '',
  ].filter(Boolean).join('\n');

  let systemPrompt: string;
  let userMessage: string;

  switch (type) {
    case 'bonuses':
      systemPrompt = `You are a world-class direct response offer architect, trained in ZAK/Schwartz/Halbert principles. You create irresistible bonus stacks that dramatically increase perceived value while being CONGRUENT with the main product. Every bonus must solve a sub-problem the prospect already has. Never create fluff — each bonus must feel like it could be sold standalone.

Rules:
- Each bonus must be a DIFFERENT format (guide, audio, tracker, checklist, video series, template, etc.)
- Each bonus must address a specific pain point or desire of the target audience
- Perceived values should be believable but generous (2-5x what someone might actually pay)
- Names should be benefit-driven and curiosity-inducing
- Descriptions should be 2-3 sentences explaining the transformation the bonus delivers`;

      userMessage = `${contextBlock}

Generate 5 bonuses for this offer stack. Return valid JSON only, no markdown:
{
  "bonuses": [
    {
      "name": "string",
      "description": "string (2-3 sentences)",
      "perceivedValue": number,
      "format": "string (guide|audio|video|tracker|checklist|template|toolkit)",
      "painPointAddressed": "string"
    }
  ]
}`;
      break;

    case 'guarantee':
      systemPrompt = `You are a risk-reversal specialist. You write guarantees that eliminate ALL buying resistance. You understand that the guarantee is not just a refund promise — it's a STATEMENT about how confident you are in your product. The best guarantees make the prospect feel STUPID for not buying because the risk is entirely on the seller.

Use power phrases. Be bold. Be specific. Never use weak language like "we hope" or "we think."`;

      userMessage = `${contextBlock}
${guaranteeType ? `Guarantee Type: ${guaranteeType}` : '60-day money-back'}

Write guarantee copy for this offer. Return valid JSON only, no markdown:
{
  "headline": "string (bold guarantee headline)",
  "body": "string (3-5 sentences of guarantee copy)",
  "powerPhrase": "string (one-line risk reversal power phrase)",
  "badgeLine": "string (short line for a guarantee badge/seal)"
}`;
      break;

    case 'urgency':
      systemPrompt = `You are a scarcity and urgency copywriter who creates ETHICAL urgency. Real urgency comes from real constraints — limited production runs, seasonal ingredients, team capacity, first-mover advantages. Never fabricate false scarcity. The best urgency copy makes the prospect feel the COST OF INACTION.`;

      userMessage = `${contextBlock}

Generate urgency/scarcity copy for this offer. Return valid JSON only, no markdown:
{
  "headline": "string (urgency headline)",
  "body": "string (2-3 sentences explaining the constraint)",
  "countdownLabel": "string (what the countdown represents)",
  "ctaText": "string (urgency-driven CTA button text)",
  "fastActionBonus": {
    "name": "string",
    "description": "string",
    "perceivedValue": number
  }
}`;
      break;

    case 'price-anchoring':
      systemPrompt = `You are a pricing strategist who understands value framing. You create price anchoring copy that makes the actual price feel like an absolute steal. You stack perceived value methodically, showing each component's standalone worth before revealing the total — then dramatically slashing it.

The goal is a minimum 10:1 value-to-price ratio. Use comparisons, daily cost breakdowns, and opportunity cost framing.`;

      userMessage = `${contextBlock}
${bonuses ? `Current Bonuses: ${JSON.stringify(bonuses)}` : ''}

Write price anchoring copy for this offer. Return valid JSON only, no markdown:
{
  "valueStackIntro": "string (intro line before listing values)",
  "dailyCostComparison": "string (e.g., 'Less than your daily coffee')",
  "opportunityCostLine": "string (what NOT buying costs them)",
  "priceRevealLine": "string (the dramatic price reveal line)",
  "ctaWithPrice": "string (CTA that includes the price)"
}`;
      break;

    case 'awareness-adapt':
      systemPrompt = `You are a Eugene Schwartz awareness-level specialist. You adapt offer presentations based on where the prospect sits on the awareness spectrum:

- UNAWARE: Lead with story/pattern interrupt. Don't mention the product yet.
- PROBLEM AWARE: Lead with the problem. Show you understand. Then introduce the mechanism.
- SOLUTION AWARE: Lead with your unique mechanism. Differentiate from alternatives.
- PRODUCT AWARE: Lead with the offer stack, proof, and risk reversal.
- MOST AWARE: Lead with the deal. Price, bonuses, guarantee. Minimize friction.

You rewrite the ENTIRE offer presentation for each level.`;

      userMessage = `${contextBlock}
${bonuses ? `Bonuses: ${JSON.stringify(bonuses)}` : ''}
${guaranteeType ? `Guarantee: ${guaranteeType}` : ''}
${awarenessLevel ? `Target Level: ${awarenessLevel}` : 'All 5 levels'}

Adapt this offer for the ${awarenessLevel || 'specified'} awareness level. Return valid JSON only, no markdown:
{
  "awarenessLevel": "string",
  "headline": "string",
  "openingParagraph": "string (3-4 sentences)",
  "offerFraming": "string (how to present the offer at this level)",
  "primaryEmphasis": "string (what to emphasize most)",
  "bonusPresentation": "string (how to frame the bonuses)",
  "ctaStyle": "string (what the CTA should feel like)",
  "fullCopy": "string (complete offer copy block, 150-250 words)"
}`;
      break;

    case 'full-offer':
    default:
      systemPrompt = `You are a world-class direct response offer architect. You build complete, irresistible offer stacks following ZAK, Schwartz, Halbert, and Kern principles. An offer stack is NOT just a product — it's a carefully engineered value proposition that makes saying "no" feel irrational.

Components: main product value, 3-5 congruent bonuses, risk-reversing guarantee, ethical urgency, and masterful price anchoring.`;

      userMessage = `${contextBlock}

Generate a COMPLETE offer stack. Return valid JSON only, no markdown:
{
  "bonuses": [
    { "name": "string", "description": "string", "perceivedValue": number, "format": "string" }
  ],
  "guarantee": {
    "headline": "string",
    "body": "string",
    "powerPhrase": "string"
  },
  "urgency": {
    "headline": "string",
    "body": "string",
    "fastActionBonus": { "name": "string", "description": "string", "perceivedValue": number }
  },
  "priceAnchoring": {
    "valueStackIntro": "string",
    "dailyCostComparison": "string",
    "opportunityCostLine": "string",
    "priceRevealLine": "string"
  }
}`;
      break;
  }

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
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

    // Parse the JSON from the response
    let parsed: unknown;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw: content };
    }

    return NextResponse.json({
      result: parsed,
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
