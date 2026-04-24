// ============================================================
// PAWEN — /api/context/import
// "Start from copy" mode — user has already done their own research
// (avatar, VOC, angles, mechanism, brand positioning) in external docs
// and wants to skip Gates 1-3 + Brand DNA to land directly on Gate 4.
//
// 2-PASS PARALLEL EXTRACTION:
//   pass 1 → core + sub_avatars (Sonnet 4.6, 16k out)
//   pass 2 → Brand DNA (Sonnet 4.6, 16k out, dedicated prompt)
// This stops the single-pass from running out of tokens and leaving
// Brand DNA (mechanism, root cause, proof points) empty.
//
// Post-processing:
//   - Drops sub-avatars with 0 verbatims AND 0 hooks AND 0 triggers
//   - Surfaces what was dropped in import_notes for user visibility
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';

export const maxDuration = 240;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// === PASS 1: CORE + SUB-AVATARS ===

function buildAvatarSystemPrompt(): string {
  return `You are a senior direct-response strategist parsing a marketer's research bundle into structured sub-avatars.

RULES:
- Extract only what the documents support. If a field is not in the source, leave it empty.
- Preserve verbatim quotes EXACTLY — do not paraphrase or translate.
- Keep source language (Italian, French, Spanish, etc.). NEVER translate to English.
- If multiple sub-avatars are described, output ALL of them.
- EVERY sub-avatar MUST have at least 3 verbatim_quotes, 3 emotional_triggers, 3 hooks. If the source lacks evidence for a candidate sub-avatar, DROP IT rather than outputting a skeleton — empty sub-avatars poison downstream gates.
- Prefer 3-4 RICH sub-avatars over 6 thin ones.

STRICT OUTPUT — return ONLY valid JSON (no prose, no fences):

{
  "core": {
    "surface_desire": "",
    "niche": "",
    "product": "",
    "language": "BCP-47 like it-IT",
    "market": "",
    "notes": ""
  },
  "sub_avatars": [
    {
      "name": "",
      "nickname": "",
      "dominant_category": "experience | emotion | behavior | demographic",
      "description": "3-4 lines in source language",
      "surface_desire": "",
      "tam_estimate": "",
      "urgency_score": 0,
      "scope_score": 0,
      "staying_power_score": 0,
      "verbatim_quotes": [{"quote": "", "source_url": "", "source_type": "searchWide", "context": "", "emotion_tag": ""}],
      "emotional_triggers": [],
      "past_attempts_failures": [],
      "implicit_demographics": [],
      "angles": {
        "positioning": {"framework": "new_mechanism | new_information | new_identity | elevation", "description": "", "rationale": ""},
        "hooks": [],
        "story_angle": {"problem": "", "agitation": "", "solution": "", "mechanism": "", "cta": ""}
      },
      "source_references": ["imported-context"],
      "launch_order": 1,
      "recommended_for_test": true,
      "recommendation_reason": ""
    }
  ],
  "dropped_avatars": [
    {"name": "", "reason": "why this candidate was dropped (e.g. no verbatims found)"}
  ],
  "import_notes": "what was found vs. missing"
}`;
}

// === PASS 2: BRAND DNA (dedicated, gets full token budget) ===

function buildBrandDNASystemPrompt(): string {
  return `You are a senior brand strategist extracting a COMPLETE Brand DNA from a marketer's research documents.

CRITICAL RULES:
- This is the SINGLE SOURCE OF TRUTH for all downstream copy generation. Empty fields = broken pipeline.
- If the documents mention a mechanism/protocol/method name (e.g. "Ripristino dell'Estroboloma", "Sleep Reset Protocol"), extract it EXACTLY as written into mechanism_name.
- Root cause: find the ONE-SENTENCE scientific/physiological/psychological explanation the marketer uses.
- Belief error: what OLD belief does the mechanism overturn?
- Mechanism 3-steps: if the docs describe a multi-step protocol, name each step and describe what it does.
- Product descriptor: one-line "what it is" (e.g. "a probiotic capsule with 5 estrobolome strains").
- Key proof points: extract EVERY study, statistic, clinical result, expert citation mentioned (target 5-15 proof points).
- Customer language: pain_quotes, desire_quotes, objection_quotes — pull EXACT verbatims from the docs.
- Voice profile: infer from the docs' actual writing style (formality level 1-10, emotional tone, sentence style, sample paragraph).
- Metaphors: if the docs use one (e.g. "the abandoned factory", "the broken bridge"), capture it in visual_identity.metaphor.
- Keep source language. NEVER translate to English.

ABSOLUTE FAILURE MODE: returning "" or "—" for mechanism_name, root_cause_one_sentence, or key_proof_points when the docs contain that info. Re-read the docs before giving up on any field.

STRICT OUTPUT — return ONLY valid JSON (no prose, no fences):

{
  "brand_dna": {
    "product_name": "",
    "brand_name": "",
    "target_market": "",
    "target_language": "",
    "locked_terms": {
      "mechanism_name": "",
      "root_cause_one_sentence": "",
      "belief_error": "",
      "mechanism_3_steps": [
        {"step": 1, "name": "", "description": ""},
        {"step": 2, "name": "", "description": ""},
        {"step": 3, "name": "", "description": ""}
      ],
      "product_descriptor": "",
      "key_proof_points": [],
      "guarantee_wording": ""
    },
    "customer_language": {
      "pain_quotes": [{"quote": "", "source": "", "emotion": "", "sub_avatar_id": ""}],
      "desire_quotes": [{"quote": "", "source": "", "depth": "surface | real | hidden"}],
      "objection_quotes": [{"quote": "", "handler": ""}],
      "always_use": [],
      "never_use": [],
      "conditional_use": []
    },
    "emotional_arc": {
      "primary_emotion": "",
      "secondary_emotion": "",
      "resolution_emotion": "",
      "funnel_arc": [],
      "awareness_progression": {"ad_level": "", "advertorial_journey": "", "lp_level": ""}
    },
    "voice_profile": {
      "vocabulary": [],
      "sentence_style": "short punchy | conversational | long-form",
      "formality_level": 5,
      "emotional_tone": "",
      "phrases_to_use": [],
      "phrases_to_avoid": [],
      "sample_paragraph": ""
    },
    "visual_identity": {
      "metaphor": null,
      "color_associations": {"problem": "", "solution": "", "brand": ""},
      "product_image_rules": []
    }
  },
  "brand_dna_completeness": {
    "mechanism_found": true,
    "root_cause_found": true,
    "proof_points_count": 0,
    "voice_confidence": "high | medium | low",
    "missing_fields": []
  }
}`;
}

function buildUserMessage(bundle: string, hints: { market?: string; language?: string; product?: string }, intent: 'avatars' | 'brand_dna'): string {
  const hintBlock = Object.entries(hints).filter(([, v]) => v).length > 0
    ? `\n=== USER HINTS (override any guessing) ===\n${Object.entries(hints).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}\n`
    : '';

  const focus = intent === 'brand_dna'
    ? 'FOCUS: Extract the COMPLETE Brand DNA — mechanism name, root cause, belief error, 3-step protocol, proof points (ALL of them, target 10+), voice profile. Do NOT skip fields that have source evidence.'
    : 'FOCUS: Extract core input + all well-evidenced sub-avatars. Drop skeletons.';

  return `${hintBlock}
=== RAW DOCUMENT BUNDLE ===
${bundle.slice(0, 200_000)}

=== TASK ===
${focus}
Return ONLY the JSON object defined in the system prompt.`;
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16384,
      temperature: 0.3,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(220_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude ${response.status}: ${err?.error?.message || 'context import failed'}`);
  }

  const data = await response.json();
  return (
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? ''
  );
}

// === POST-PROCESS: filter skeleton sub-avatars ===

type SubAvatarLite = {
  name?: string;
  verbatim_quotes?: unknown[];
  emotional_triggers?: unknown[];
  angles?: { hooks?: unknown[] };
};

function filterEmptySubAvatars(subs: SubAvatarLite[]): { kept: SubAvatarLite[]; dropped: Array<{ name: string; reason: string }> } {
  const kept: SubAvatarLite[] = [];
  const dropped: Array<{ name: string; reason: string }> = [];
  for (const sa of subs) {
    const vCount = Array.isArray(sa.verbatim_quotes) ? sa.verbatim_quotes.length : 0;
    const tCount = Array.isArray(sa.emotional_triggers) ? sa.emotional_triggers.length : 0;
    const hCount = Array.isArray(sa.angles?.hooks) ? (sa.angles!.hooks as unknown[]).length : 0;
    if (vCount === 0 && tCount === 0 && hCount === 0) {
      dropped.push({
        name: sa.name || 'unnamed',
        reason: 'Empty skeleton — 0 verbatims + 0 triggers + 0 hooks. Dropped to protect downstream gates.',
      });
      continue;
    }
    if (vCount < 2 && tCount < 2) {
      dropped.push({
        name: sa.name || 'unnamed',
        reason: `Too thin (${vCount} verbatims, ${tCount} triggers). Dropped — would pollute downstream copy.`,
      });
      continue;
    }
    kept.push(sa);
  }
  return { kept, dropped };
}

// === ROUTE ===

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      bundle?: string;
      hints?: { market?: string; language?: string; product?: string };
    };

    const bundle = (body.bundle ?? '').trim();
    if (!bundle || bundle.length < 100) {
      return NextResponse.json(
        { ok: false, message: 'Bundle is empty or too short (need at least 100 chars of context)' },
        { status: 400 },
      );
    }

    const hints = body.hints ?? {};

    // 2-pass PARALLEL extraction
    const [avatarRaw, brandRaw] = await Promise.all([
      callClaude(buildAvatarSystemPrompt(), buildUserMessage(bundle, hints, 'avatars')),
      callClaude(buildBrandDNASystemPrompt(), buildUserMessage(bundle, hints, 'brand_dna')),
    ]);

    const avatarParsed = extractJSON<Record<string, unknown>>(avatarRaw);
    const brandParsed = extractJSON<Record<string, unknown>>(brandRaw);

    if (!avatarParsed || !brandParsed) {
      console.error('[context:import] parse failed', {
        avatarOk: !!avatarParsed,
        brandOk: !!brandParsed,
        avatarSample: avatarRaw.slice(0, 400),
        brandSample: brandRaw.slice(0, 400),
      });
      return NextResponse.json(
        {
          ok: false,
          message: `Claude returned invalid JSON (avatars: ${!!avatarParsed}, brand_dna: ${!!brandParsed})`,
          avatarSample: avatarRaw.slice(0, 600),
          brandSample: brandRaw.slice(0, 600),
        },
        { status: 502 },
      );
    }

    // Filter empty sub-avatars
    const rawSubs = (avatarParsed.sub_avatars as SubAvatarLite[] | undefined) ?? [];
    const { kept, dropped } = filterEmptySubAvatars(rawSubs);
    avatarParsed.sub_avatars = kept;

    // Merge dropped list from model + server-side filter
    const modelDropped = (avatarParsed.dropped_avatars as Array<{ name: string; reason: string }> | undefined) ?? [];
    avatarParsed.dropped_avatars = [...modelDropped, ...dropped];

    // Stitch: model returned brand_dna separately; merge into single object
    const parsed = {
      core: avatarParsed.core,
      sub_avatars: avatarParsed.sub_avatars,
      dropped_avatars: avatarParsed.dropped_avatars,
      brand_dna: brandParsed.brand_dna,
      brand_dna_completeness: brandParsed.brand_dna_completeness,
      import_notes: avatarParsed.import_notes,
    };

    await writeAudit(req, session.user, 'context.import', {
      bundle_length: bundle.length,
      sub_avatar_count: kept.length,
      sub_avatars_dropped: dropped.length,
      brand_dna_mechanism: Boolean(
        (brandParsed.brand_dna as Record<string, unknown> | undefined)?.locked_terms &&
        ((brandParsed.brand_dna as { locked_terms: { mechanism_name?: string } }).locked_terms.mechanism_name?.length ?? 0) > 0,
      ),
    });

    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    console.error('[context:import] error:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'context import failed' },
      { status: 500 },
    );
  }
}
