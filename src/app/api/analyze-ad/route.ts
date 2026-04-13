// ============================================================
// PAWEN — /api/analyze-ad — Claude Vision analysis of static ads
// Receives a base64 image, returns structured creative analysis.
// Used by Gate 7 to let users upload their own winning ads.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';

export const maxDuration = 60;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANALYZE_MODEL = 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { imageBase64, mediaType = 'image/png', targetLanguage = 'en' } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ message: 'imageBase64 required' }, { status: 400 });
  }

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  const advisorEnabled = shouldUseAdvisor(ANALYZE_MODEL);
  const requestBody: Record<string, unknown> = {
    model: ANALYZE_MODEL,
    max_tokens: 4096,
    temperature: 0.3,
    system: [{
      type: 'text',
      text: withAdvisorHint(
        'You are a world-class direct response ad analyst. Output strict JSON only.',
        ANALYZE_MODEL,
      ),
    }],
    ...(advisorEnabled ? { tools: [ADVISOR_TOOL] } : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `You are a world-class direct response ad analyst. Analyze this static ad image in detail.

Extract the following and return ONLY valid JSON (no markdown, no explanation):

{
  "headline": "the main headline text visible in the ad (exact words)",
  "visual_description": "detailed description of what the viewer SEES — background, layout, subjects, objects, lighting, composition, product placement (80+ words)",
  "layout_structure": "how visual elements are arranged (e.g. 'centered product with headline top-left', 'split-screen comparison', 'full-bleed image with text overlay')",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "mood": "the overall emotional feeling (e.g. 'urgent and dark', 'warm and aspirational', 'playful and casual')",
  "format_type": "static_graphic|product_photo|infographic|native_style|quote_text|collage|ugc_image|meme_style|before_after|comparison",
  "why_it_works": "psychological analysis of why this ad stops the scroll and converts — what specific techniques are used (2-3 sentences)",
  "pattern_name": "the reusable creative pattern (e.g. 'transformation', 'comparison', 'subversion', 'problem_solution', 'social_proof', 'specificity', 'wordplay', 'contrast', 'authority', 'curiosity_gap')",
  "target_emotion": "the primary emotion this ad targets in the viewer",
  "copywriting_elements": "headline style (question/statement/command), CTA text and style, any subtext or body copy visible, font choices"
}

Analyze in ${targetLanguage}. Be specific and detailed — this analysis will be used as a creative template for generating new ads.`,
          },
        ],
      },
    ],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const beta = composeBetaHeader({ caching: false, advisor: advisorEnabled });
  if (beta) headers['anthropic-beta'] = beta;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Vision analysis failed', details: error },
        { status: response.status },
      );
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Extract JSON from response
    let analysis: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json(
        { message: 'Failed to parse vision analysis', raw: text },
        { status: 500 },
      );
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
