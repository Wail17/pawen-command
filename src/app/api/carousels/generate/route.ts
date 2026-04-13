// ============================================================
// PAWEN — /api/carousels/generate
// Generates carousel ad sequences using Claude Sonnet 4.6
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const CAROUSEL_STRUCTURES: Record<string, { name: string; slides: string[] }> = {
  story: {
    name: 'Story Carousel',
    slides: ['Hook / Pain Point', 'Agitation / Stakes', 'Solution Reveal', 'Mechanism / Proof', 'CTA / Offer'],
  },
  feature: {
    name: 'Feature Carousel',
    slides: ['Hero / Main Benefit', 'Feature 1', 'Feature 2', 'Feature 3', 'CTA / Guarantee'],
  },
  testimonial: {
    name: 'Testimonial Carousel',
    slides: ['Bold Claim / Hook', 'Testimonial 1', 'Testimonial 2', 'Testimonial 3', 'CTA / Join Them'],
  },
  before_after: {
    name: 'Before / After',
    slides: ['Before (Pain)', 'After (Desire)', 'How (Mechanism)', 'CTA / Try It'],
  },
  product_range: {
    name: 'Product Range',
    slides: ['Range Overview', 'Product/Variant 1', 'Product/Variant 2', 'Product/Variant 3', 'Bundle CTA'],
  },
};

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    templateId,
    brandDNA,
    gate4Data,
    gate6Data,
    gate3Data,
    selectedFunnel,
    targetLanguage,
  } = body;

  const template = CAROUSEL_STRUCTURES[templateId];
  if (!template) {
    return NextResponse.json({ message: 'Unknown template type' }, { status: 400 });
  }

  // Build context from upstream gates
  let context = '';

  if (brandDNA) {
    context += `\n=== BRAND DNA ===
Product: ${brandDNA.product_name}
Brand: ${brandDNA.brand_name}
Mechanism: ${brandDNA.locked_terms?.mechanism_name || 'N/A'}
Root Cause: ${brandDNA.locked_terms?.root_cause_one_sentence || 'N/A'}
Guarantee: ${brandDNA.locked_terms?.guarantee_wording || 'N/A'}
Voice: ${brandDNA.voice_profile?.emotional_tone || 'N/A'}
Always Use: ${brandDNA.customer_language?.always_use?.join(', ') || 'N/A'}
Never Use: ${brandDNA.customer_language?.never_use?.join(', ') || 'N/A'}
`;
  }

  if (gate3Data) {
    const mechanism = gate3Data.mechanism as Record<string, unknown> | undefined;
    if (mechanism) {
      context += `\n=== MECHANISM ===
Name: ${mechanism.name || 'N/A'}
Tagline: ${mechanism.tagline || 'N/A'}
Positioning: ${mechanism.positioning || 'N/A'}
`;
    }
  }

  if (gate4Data) {
    const hooks = gate4Data.hook_matrix as Record<string, unknown> | undefined;
    if (hooks) {
      const topHooks = (hooks.top_20_hooks as Array<{ hook: string }> || []).slice(0, 7);
      context += `\n=== TOP HOOKS (Gate 4) ===\n${topHooks.map((h: { hook: string }) => `- ${h.hook}`).join('\n')}\n`;
    }
  }

  if (gate6Data) {
    const headlines = gate6Data.headlines as Array<{ primary: string; secondary: string }> | undefined;
    if (headlines) {
      context += `\n=== HEADLINES (Gate 6) ===\n${headlines.map((h: { primary: string; secondary: string }) => `- ${h.primary} ${h.secondary}`).join('\n')}\n`;
    }
  }

  const systemPrompt = `You are an expert Meta Ads carousel copywriter. You create high-converting carousel ads for e-commerce brands.

Your task: Generate 2 carousel ads using the "${template.name}" format.

CAROUSEL STRUCTURE (${template.slides.length} slides):
${template.slides.map((s, i) => `Slide ${i + 1}: ${s}`).join('\n')}

${context}

LANGUAGE: ${targetLanguage || 'en-US'}
FUNNEL: ${selectedFunnel || 'problem_aware'}

RULES:
- Each slide MUST have: headline (max 8 words), body (max 40 words), visual_brief (detailed scene description for AI image generation), emotional_beat (the emotion this slide triggers)
- Last slide MUST have a cta_text field (clear call-to-action button text)
- Headlines must stop the scroll — use the hooks and voice from the Brand DNA
- Visual briefs must be specific enough for AI image generation (describe scene, lighting, colors, composition)
- The emotional arc must flow logically slide to slide
- Use customer language from the Brand DNA, never use forbidden words

Return ONLY valid JSON in this exact format:
{
  "carousels": [
    {
      "id": "generated-{templateId}-1",
      "templateId": "${templateId}",
      "templateName": "${template.name}",
      "headline": "The carousel's main concept headline",
      "targetSubAvatar": "Target persona name",
      "emotionalArc": "Emotion1 → Emotion2 → Emotion3 → ...",
      "format": "feed_1x1",
      "slides": [
        {
          "position": 1,
          "headline": "Slide headline",
          "body": "Slide body copy",
          "visualBrief": "Detailed visual description",
          "emotionalBeat": "Emotion name"
        }
      ]
    }
  ]
}`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 8192,
        temperature: 0.8,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Generate 2 ${template.name} carousel ads. Make them different in angle and emotional approach.` }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ message: `Anthropic API error: ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ message: 'Failed to parse carousel JSON', raw: text }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ message: `Generation error: ${error}` }, { status: 500 });
  }
}
