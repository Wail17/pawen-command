// ============================================================
// PAWEN — /api/video/script
// Generates a scene-by-scene animated-video-ad script from the
// project context (sub-avatar + Gate 4 hooks + Brand DNA + funnel).
// Returns a VideoAdScript draft with 5-10s scenes, starting-image
// prompts and animation prompts ready to feed to fal.ai Kling/Veo.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';

export const maxDuration = 180;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-6';

function buildSystem(): string {
  return `You are a senior direct-response video strategist specializing in AI "animated object" ads (Pixar-style objects talking, reacting, moving) that dominate Meta / TikTok 2026.

Your job: turn a product + sub-avatar + hook into a scene-by-scene shootable video ad script that Kling/Veo can animate.

HARD CONSTRAINTS:
- Each scene is EXACTLY 5 or 10 seconds (AI video models cap at 10s per clip).
- Total ad duration between 20 and 60 seconds (prefer 25-45s).
- One consistent main character (an animated object) appears in every scene.
- Vertical 9:16 format.
- Every scene has: a starting_image_prompt (describes the opening frame), an animation_prompt (tells the video model what moves / how the character acts / camera motion), a dialogue line (what the character says).
- Use the target language for dialogue. Keep dialogue tight — one short sentence per 5s scene, up to two for 10s.
- Image prompts must describe: subject / pose / expression / environment / lighting / camera angle / color palette / "pixar-style 3D, cinematic, 9:16".
- Animation prompts must describe: movement + emotion + camera motion (e.g. "slow push-in, subject shakes head in frustration, steam rises from cup").

STRUCTURE (adapt to funnel stage):
- TOF: hook (5s) → problem (10s) → agitation (5s) → mechanism tease (10s) → soft CTA (5s)
- MOF: pattern-interrupt (5s) → mechanism explained (10s) → proof (10s) → hard CTA (5s)
- BOF: identity/transformation (5s) → offer (10s) → guarantee/urgency (5s) → final CTA (5s)

RULES:
- The main character EMBODIES the product (the product is alive). Not a human holding the product.
- Use verbatim customer language from the sub-avatar quotes when writing dialogue.
- Use the brand's locked mechanism name (if present).
- End on a CTA that matches funnel_position.

STRICT OUTPUT — return ONLY valid JSON, no prose, no fences:

{
  "title": "short title for the ad",
  "hook_angle": "which angle this leans on",
  "total_duration_s": number,
  "aspect_ratio": "9:16",
  "character": {
    "name": "The ___",
    "object_type": "pineapple | protein bar | sneaker | ...",
    "visual_style": "pixar-style 3D, ...",
    "wardrobe": "optional accessories",
    "voice_tone": "...",
    "reference_image_url": null
  },
  "scenes": [
    {
      "order": 1,
      "role": "hook | problem | agitation | mechanism | proof | cta | transition",
      "duration": 5,
      "personality": "confident | playful | angry | desperate | curious | authoritative | empathetic | excited | skeptical | shocked",
      "environment": "where the scene takes place",
      "dialogue": "what the character says (target language)",
      "action": "what the character does",
      "companion_object": "optional second object",
      "starting_image_prompt": "full image-gen prompt for the 9:16 opening frame",
      "ending_image_prompt": null,
      "animation_prompt": "prompt for Kling/Veo img2video"
    }
  ],
  "notes": "anything the user should know"
}`;
}

function buildUser(ctx: Record<string, unknown>, guardrails?: string): string {
  return `Generate an animated-object video ad script using this context. Match the target language EXACTLY in dialogue.

${guardrails ? guardrails + '\n\n' : ''}=== CONTEXT ===
${JSON.stringify(ctx, null, 2)}

Return ONLY the JSON object.`;
}

async function callClaude(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.7,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(170_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude ${res.status}: ${err?.error?.message || 'script gen failed'}`);
  }
  const data = await res.json();
  return (
    data.content
      ?.filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('') ?? ''
  );
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      subAvatar?: unknown;
      brandDNA?: unknown;
      hook?: string;
      bodyAngle?: string;
      cta?: string;
      character?: { name: string; object_type: string; rationale?: string };
      proofPoint?: string;
      verbatim?: string;
      funnelPosition?: 'TOF' | 'MOF' | 'BOF';
      targetLanguage?: string;
      targetMarket?: string;
      productContext?: unknown;
      extraNotes?: string;
      targetDurationS?: number;
      guardrails?: string;              // serialized congruence block
      batch?: boolean;                  // if true → returns 3 scripts (TOF/MOF/BOF)
      mode?: 'architect' | 'factory';
    };

    if (!body.subAvatar || !body.hook) {
      return NextResponse.json(
        { ok: false, message: 'subAvatar and hook are required' },
        { status: 400 },
      );
    }

    const makeCtx = (stage: 'TOF' | 'MOF' | 'BOF') => ({
      sub_avatar: body.subAvatar,
      brand_dna: body.brandDNA ?? null,
      hook: body.hook,
      body_angle: body.bodyAngle ?? null,
      cta: body.cta ?? null,
      character_suggestion: body.character ?? null,
      proof_point: body.proofPoint ?? null,
      customer_verbatim: body.verbatim ?? null,
      funnel_position: stage,
      target_language: body.targetLanguage ?? 'en-US',
      target_market: body.targetMarket ?? 'US',
      product_context: body.productContext ?? null,
      target_duration_s: body.targetDurationS ?? 35,
      notes: body.extraNotes ?? '',
      mode: body.mode ?? 'architect',
    });

    const runOne = async (stage: 'TOF' | 'MOF' | 'BOF') => {
      const ctx = makeCtx(stage);
      const raw = await callClaude(buildSystem(), buildUser(ctx, body.guardrails));
      const parsed = extractJSON<Record<string, unknown>>(raw);
      if (!parsed) return { ok: false, stage, rawSample: raw.slice(0, 600) };
      return { ok: true, stage, script: parsed };
    };

    if (body.batch) {
      const results = await Promise.all([runOne('TOF'), runOne('MOF'), runOne('BOF')]);
      await writeAudit(req, session.user, 'context.import', {
        action_detail: 'video.script.batch',
        scripts: results.filter(r => r.ok).length,
      });
      return NextResponse.json({ ok: true, batch: true, results });
    }

    const result = await runOne(body.funnelPosition ?? 'TOF');
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON', rawSample: result.rawSample },
        { status: 502 },
      );
    }

    await writeAudit(req, session.user, 'context.import', {
      action_detail: 'video.script.generate',
      hook: body.hook,
      mode: body.mode,
      scenes: Array.isArray((result.script as Record<string, unknown>).scenes)
        ? ((result.script as Record<string, unknown>).scenes as unknown[]).length
        : 0,
    });

    return NextResponse.json({ ok: true, script: result.script });
  } catch (err) {
    console.error('[video:script] error:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'script gen failed' },
      { status: 500 },
    );
  }
}
