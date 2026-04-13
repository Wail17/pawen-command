// ============================================================
// PAWEN — /api/avatars/enrich-reverse
// Takes a sub-avatar that was reverse-engineered from a competitor
// funnel (pure shape transform, hardcoded defaults, English copy)
// and runs a single Opus pass that produces the deep structural
// enrichment the raw transform can't: localized hooks, 3-5 distinct
// angles, sensory triggers, structured past attempts, buying
// behavior, scored hooks, localized demographics, narrator persona.
//
// Stacks onto the sub-avatar — never overwrites base fields.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type {
  CoreAvatarInput,
  SubAvatarV2,
  SubAvatarAngles,
  StructuredPastAttempt,
  SensoryTrigger,
  SensoryAnchor,
  ScoredHook,
  BuyingBehavior,
  LocalizedDemographics,
  PositioningFramework,
} from '@/lib/avatars/types';
import {
  buildReverseEnrichmentSystemPrompt,
  buildReverseEnrichmentUserMessage,
} from '@/lib/avatars/reverseEnrichmentPrompts';

export const maxDuration = 180;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-6';

type EnrichmentPayload = {
  additional_angles?: unknown[];
  structured_past_attempts?: unknown[];
  sensory_triggers?: unknown[];
  scored_hooks?: unknown[];
  buying_behavior?: unknown;
  localized_demographics?: unknown;
  narrator_persona?: unknown;
  bridge_moment?: unknown;
};

export type ReverseEnrichment = {
  additional_angles: SubAvatarAngles[];
  structured_past_attempts: StructuredPastAttempt[];
  sensory_triggers: SensoryTrigger[];
  scored_hooks: ScoredHook[];
  buying_behavior?: BuyingBehavior;
  localized_demographics?: LocalizedDemographics;
  narrator_persona?: string;
  bridge_moment?: string;
  tokens_used: number;
  generated_at: string;
};

async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
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
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      temperature: 0.7,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(170_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude ${response.status}: ${err?.error?.message || 'enrich-reverse call failed'}`,
    );
  }

  const data = await response.json();
  const content =
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

  return {
    content,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

const ALLOWED_FRAMEWORKS: PositioningFramework[] = [
  'new_mechanism',
  'new_information',
  'new_identity',
  'elevation',
];

const ALLOWED_ANCHORS: SensoryAnchor[] = [
  'visual',
  'touch',
  'sound',
  'smell',
  'taste',
  'interoceptive',
];

function clamp(n: unknown, min = 1, max = 10): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function str(v: unknown, max = 600): string {
  return String(v ?? '').slice(0, max);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? '')).filter((x) => x.trim().length > 0);
}

function normalizeAngle(raw: unknown): SubAvatarAngles | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pos = (r.positioning ?? {}) as Record<string, unknown>;
  const story = (r.story_angle ?? {}) as Record<string, unknown>;
  const frameworkRaw = String(pos.framework ?? 'new_mechanism').toLowerCase();
  const framework = (ALLOWED_FRAMEWORKS.includes(frameworkRaw as PositioningFramework)
    ? frameworkRaw
    : 'new_mechanism') as PositioningFramework;
  const description = str(pos.description, 500);
  if (!description) return null;

  return {
    positioning: {
      framework,
      description,
      rationale: str(pos.rationale, 500),
    },
    hooks: asStringArray(r.hooks).slice(0, 5),
    story_angle: {
      problem: str(story.problem, 400),
      agitation: str(story.agitation, 400),
      solution: str(story.solution, 400),
      mechanism: str(story.mechanism, 400),
      cta: str(story.cta, 200),
    },
  };
}

function normalizePastAttempt(raw: unknown): StructuredPastAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const what = str(r.what_tried, 300);
  if (!what) return null;
  return {
    what_tried: what,
    why_failed: str(r.why_failed, 400),
    residual_emotion: str(r.residual_emotion, 100),
  };
}

function normalizeSensoryTrigger(raw: unknown): SensoryTrigger | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const trigger = str(r.trigger, 400);
  if (!trigger) return null;
  const anchorRaw = String(r.sensory_anchor ?? 'interoceptive').toLowerCase();
  const sensory_anchor = (ALLOWED_ANCHORS.includes(anchorRaw as SensoryAnchor)
    ? anchorRaw
    : 'interoceptive') as SensoryAnchor;
  return {
    trigger,
    sensory_anchor,
    intensity_score: clamp(r.intensity_score),
    frequency_score: clamp(r.frequency_score),
    context: str(r.context, 300),
  };
}

function normalizeScoredHook(raw: unknown, targetLanguage: string): ScoredHook | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const hook = str(r.hook, 300);
  if (!hook) return null;
  return {
    hook,
    curiosity_score: clamp(r.curiosity_score),
    intensity_score: clamp(r.intensity_score),
    relevance_score: clamp(r.relevance_score),
    target_language: str(r.target_language, 20) || targetLanguage,
  };
}

function normalizeBuyingBehavior(raw: unknown): BuyingBehavior | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const objectionsRaw = Array.isArray(r.top_objections) ? r.top_objections : [];
  const top_objections = objectionsRaw
    .map((o) => {
      if (!o || typeof o !== 'object') return null;
      const rec = o as Record<string, unknown>;
      const objection = str(rec.objection, 400);
      if (!objection) return null;
      const sevRaw = String(rec.severity ?? 'hesitation').toLowerCase();
      const severity = (['deal_breaker', 'hesitation', 'minor'].includes(sevRaw)
        ? sevRaw
        : 'hesitation') as 'deal_breaker' | 'hesitation' | 'minor';
      return {
        objection,
        severity,
        counter_argument: str(rec.counter_argument, 500),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 5);

  return {
    decision_cycle: str(r.decision_cycle, 300),
    price_sensitivity: str(r.price_sensitivity, 300),
    preferred_social_proof: str(r.preferred_social_proof, 300),
    preferred_channel: str(r.preferred_channel, 300),
    top_objections,
  };
}

function normalizeLocalizedDemographics(raw: unknown): LocalizedDemographics | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  return {
    age_range: str(r.age_range, 100),
    income_range: str(r.income_range, 200),
    income_currency: str(r.income_currency, 10),
    geographic_concentration: asStringArray(r.geographic_concentration).slice(0, 10),
    cultural_references: asStringArray(r.cultural_references).slice(0, 12),
    language_register: str(r.language_register, 200),
  };
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      reverse?: ReverseEngineeredFunnel;
      core?: CoreAvatarInput;
      subAvatar?: SubAvatarV2;
      targetLanguage?: string;
      targetMarket?: string;
    };

    const { reverse, core, subAvatar } = body;
    const targetLanguage = (body.targetLanguage || '').trim() || 'en';
    const targetMarket = (body.targetMarket || '').trim() || 'global';

    if (!reverse || !core || !subAvatar) {
      return NextResponse.json(
        { ok: false, message: 'Missing reverse, core, or subAvatar' },
        { status: 400 },
      );
    }

    const systemPrompt = buildReverseEnrichmentSystemPrompt();
    const userMessage = buildReverseEnrichmentUserMessage(
      reverse,
      core,
      subAvatar,
      targetLanguage,
      targetMarket,
    );

    const { content, tokensIn, tokensOut } = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<EnrichmentPayload>(content);
    if (!parsed) {
      console.error('[avatars:enrich-reverse] JSON parse failed — raw:', content.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const additional_angles = (Array.isArray(parsed.additional_angles) ? parsed.additional_angles : [])
      .map(normalizeAngle)
      .filter((a): a is SubAvatarAngles => a !== null)
      .slice(0, 4);

    const structured_past_attempts = (Array.isArray(parsed.structured_past_attempts)
      ? parsed.structured_past_attempts
      : [])
      .map(normalizePastAttempt)
      .filter((a): a is StructuredPastAttempt => a !== null)
      .slice(0, 8);

    const sensory_triggers = (Array.isArray(parsed.sensory_triggers) ? parsed.sensory_triggers : [])
      .map(normalizeSensoryTrigger)
      .filter((t): t is SensoryTrigger => t !== null)
      .slice(0, 10);

    const scored_hooks = (Array.isArray(parsed.scored_hooks) ? parsed.scored_hooks : [])
      .map((h) => normalizeScoredHook(h, targetLanguage))
      .filter((h): h is ScoredHook => h !== null)
      .slice(0, 15);

    const enrichment: ReverseEnrichment = {
      additional_angles,
      structured_past_attempts,
      sensory_triggers,
      scored_hooks,
      buying_behavior: normalizeBuyingBehavior(parsed.buying_behavior),
      localized_demographics: normalizeLocalizedDemographics(parsed.localized_demographics),
      narrator_persona: parsed.narrator_persona ? str(parsed.narrator_persona, 800) : undefined,
      bridge_moment: parsed.bridge_moment ? str(parsed.bridge_moment, 600) : undefined,
      tokens_used: tokensIn + tokensOut,
      generated_at: new Date().toISOString(),
    };

    await writeAudit(req, session.user, 'avatar.enrich_reverse.generate', {
      subAvatarId: subAvatar.id,
      targetLanguage,
      targetMarket,
      tokensUsed: enrichment.tokens_used,
      anglesProduced: additional_angles.length,
      triggersProduced: sensory_triggers.length,
    });

    return NextResponse.json({ ok: true, enrichment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[avatars:enrich-reverse] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
