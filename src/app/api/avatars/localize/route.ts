// ============================================================
// PAWEN — /api/avatars/localize
// Strategic cultural adaptation (NOT translation) of a reverse-engineered
// avatar from one market to another. Claude Sonnet acts as a cultural
// localization analyst: keeps what transfers (mechanism, copy frames, funnel
// structure), swaps what doesn't (competitors, medical/institutional refs,
// cultural touchpoints, behavior patterns).
//
// Also performs a cultural-fit assessment — if the archetype simply does
// NOT transfer (e.g. "masters athlete with Garmin" → Italy, where the
// quantified-self running culture is marginal for 45+ women), the output
// flags this and recommends reverting to a target-market-native sub-avatar
// instead of forcing an adaptation.
//
// The caller (lib/avatars/localizeReverseEngineered.ts) handles the Tavily
// search + Firecrawl scrape client-side via /api/search and /api/scrape.
// This route is ONLY the analysis step.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

export const maxDuration = 180;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// Existing target-market VOC the user has already mined. If present, it
// becomes the GROUND TRUTH — the model cross-references the source avatar
// against it rather than inventing cultural anchors from scratch.
type ExistingVoc = {
  verbatims?: string[];          // raw quotes from target market
  sub_avatar_names?: string[];   // names of sub-avatars already built for target
};

type LocalizedBundle = {
  // Cultural fit verdict — drives whether to use this adaptation or pivot
  cultural_fit: {
    score: number;                      // 0-100
    verdict: 'use_as_is' | 'adapt_deeply' | 'do_not_localize';
    reason: string;                     // 2-3 lines on why
    recommendation: string;             // what to do next ("Use La Delusa Cronica instead", etc.)
  };

  // Localized avatar identity
  localized_name: string;               // e.g. "La Delusa Cronica"
  localized_nickname: string;
  localized_description: string;        // 3-4 lines in target language
  localized_demographics: string[];     // age, income bracket (in local currency), education, family, location type

  // Localized psychology
  pain_points: string[];
  desires: string[];
  fears: string[];
  objections: string[];
  trigger_moments: string[];
  identity_statements: string[];

  // Verbatims (in target language, first-person, grounded in scraped content)
  verbatim_quotes: string[];
  emotional_triggers: string[];

  // Cultural/market swaps — THIS is the whole point
  competitor_swaps: Array<{ source: string; target: string; note?: string }>;
  medical_system_refs: string[];        // e.g. "ginecologo", "medico di base", "SSN", "farmacia"
  cultural_anchors: string[];           // local brands, pop-culture, institutions that resonate
  behavior_adaptations: Array<{ source_behavior: string; target_behavior: string }>;
  price_anchor: string;                 // local currency + typical price points for category

  // What DOESN'T transfer — explicit so downstream gates know
  non_transferable: string[];

  notes: string;
};

function buildSystemPrompt(targetLanguage: string, targetMarket: string): string {
  return `You are a senior cultural localization strategist for direct-response marketing. You receive:
  1. A reverse-engineered avatar + funnel from the SOURCE market (usually US/UK)
  2. Fresh scraped content from the TARGET market (${targetMarket}) — forums, reviews, articles
  3. Optionally: existing target-market VOC the user already mined (treat this as GROUND TRUTH)

Your job is strategic cultural ADAPTATION, not translation.

PRINCIPLES:
- Mechanisms, copy frames, funnel structure, emotional hooks, invalidation-of-alternatives patterns — these TRANSFER. Keep them.
- Competitors, medical/institutional references, cultural touchpoints, behavior patterns, price anchors — these DO NOT transfer. Swap them.
- Some archetypes DO NOT EXIST at scale in the target market. If the source avatar is e.g. "masters runner with Garmin/Strava" and you're adapting to Italy (where quantified-self running culture is marginal for 45+ women), say so. Flag cultural_fit.verdict = "do_not_localize" and recommend what to do instead.
- The target market has local competitors (not Estroven/Amberen — Ymea/Femal/Estromineral for IT menopause), local medical system (ginecologo/medico di base/SSN/farmacia, not GP/insurance/drugstore), local behavior ("ho provato 3 integratori in farmacia senza risultato", not "tracked on my Oura").
- If existing target-market VOC is provided, your verbatims and cultural anchors MUST be drawn from or match it. Don't invent anchors that contradict real user voices.
- Verbatims: short, first-person, emotionally loaded, in natural ${targetLanguage} (not translated English).
- Cultural anchors: specific brands/institutions/habits that make sense ONLY in ${targetMarket}.
- Be honest about what doesn't transfer. Put it in non_transferable[].

OUTPUT STRICT JSON matching the schema. No markdown, no prose outside JSON.`;
}

function buildUserMessage(
  reverse: ReverseEngineeredFunnel,
  scrapedContent: string,
  targetLanguage: string,
  targetMarket: string,
  existingVoc: ExistingVoc | null,
): string {
  const vocBlock = existingVoc && ((existingVoc.verbatims?.length ?? 0) > 0 || (existingVoc.sub_avatar_names?.length ?? 0) > 0)
    ? `=== EXISTING ${targetMarket.toUpperCase()} VOC (GROUND TRUTH — cross-reference your output against this) ===
Sub-avatars already built for ${targetMarket}: ${(existingVoc.sub_avatar_names ?? []).join(', ') || 'none'}

Target-market verbatims (${(existingVoc.verbatims ?? []).length} quotes):
${(existingVoc.verbatims ?? []).slice(0, 60).map(v => `- ${v}`).join('\n')}
`
    : `=== EXISTING ${targetMarket.toUpperCase()} VOC ===\n(none — base your adaptation on the scraped content only)\n`;

  return `=== SOURCE REVERSE-ENGINEERED AVATAR ===
Source brand:       ${reverse.competitor_brand}
Source market:      implied US/UK unless otherwise obvious from brand
Avatar:             ${reverse.sub_avatar.name} — ${reverse.sub_avatar.nickname}
Description:        ${reverse.sub_avatar.description}
Pain points:        ${(reverse.sub_avatar.pain_points || []).join(' | ')}
Desires:            ${(reverse.sub_avatar.desires || []).join(' | ')}
Fears:              ${(reverse.sub_avatar.fears || []).join(' | ')}
Trigger moments:    ${(reverse.sub_avatar.trigger_moments || []).join(' | ')}
Mechanism:          ${reverse.mechanism.name} — ${reverse.mechanism.description}

=== TARGET MARKET ===
Market:   ${targetMarket}
Language: ${targetLanguage}

=== FRESH SCRAPED CONTENT from ${targetMarket} (forums, reviews, articles) ===
${scrapedContent.slice(0, 70_000)}

${vocBlock}

=== TASK ===
1. Assess cultural fit of this source archetype for ${targetMarket}. If it doesn't transfer, say so.
2. If it partially transfers, build a localized adaptation: swap competitors, medical refs, cultural anchors, behaviors, price.
3. Draw verbatims from the scraped content and (if present) from the existing VOC — never invent.
4. Be explicit about what does NOT transfer.

Output JSON schema:
{
  "cultural_fit": {
    "score": 0-100,
    "verdict": "use_as_is" | "adapt_deeply" | "do_not_localize",
    "reason": "2-3 lines on why this archetype does/doesn't fit ${targetMarket}",
    "recommendation": "what to do next — use as-is, adapt, or use a native target-market avatar instead (name it if possible)"
  },
  "localized_name": "avatar name in ${targetLanguage}",
  "localized_nickname": "short nickname in ${targetLanguage}",
  "localized_description": "3-4 lines in ${targetLanguage}",
  "localized_demographics": ["age range", "income bracket in local currency", "education", "family structure", "urban/rural"],
  "pain_points": ["pain in ${targetLanguage}", ...],
  "desires": ["desire in ${targetLanguage}", ...],
  "fears": ["fear in ${targetLanguage}", ...],
  "objections": ["objection in ${targetLanguage}", ...],
  "trigger_moments": ["trigger in ${targetLanguage}", ...],
  "identity_statements": ["I am / I am not statements in ${targetLanguage}", ...],
  "verbatim_quotes": ["first-person quote in ${targetLanguage}", ...],
  "emotional_triggers": ["trigger in ${targetLanguage}", ...],
  "competitor_swaps": [{"source": "US competitor name", "target": "${targetMarket} equivalent", "note": "optional"}],
  "medical_system_refs": ["local medical/institutional terms actually used by people in ${targetMarket}"],
  "cultural_anchors": ["brand, institution, habit specific to ${targetMarket}"],
  "behavior_adaptations": [{"source_behavior": "what the US avatar does", "target_behavior": "what the ${targetMarket} avatar does instead"}],
  "price_anchor": "typical price point for this category in local currency",
  "non_transferable": ["aspect of source avatar that doesn't transfer and was dropped"],
  "notes": "strategic notes for the copywriter in ${targetLanguage}"
}`;
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const advisorEnabled = shouldUseAdvisor(MODEL);

  const requestBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 10000,
    temperature: 0.5,
    system: [
      {
        type: 'text',
        text: withAdvisorHint(systemPrompt, MODEL),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };

  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const beta = composeBetaHeader({ caching: true, advisor: advisorEnabled });
  if (beta) headers['anthropic-beta'] = beta;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(170_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude ${response.status}: ${err?.error?.message || 'localize call failed'}`,
    );
  }

  const data = await response.json();
  return (
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? ''
  );
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x)).filter(x => x.length > 0);
}

function asSwapArray(v: unknown): Array<{ source: string; target: string; note?: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ source: string; target: string; note?: string }> = [];
  for (const x of v) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const source = typeof o.source === 'string' ? o.source : '';
    const target = typeof o.target === 'string' ? o.target : '';
    if (!source || !target) continue;
    const entry: { source: string; target: string; note?: string } = { source, target };
    if (typeof o.note === 'string' && o.note.length > 0) entry.note = o.note;
    out.push(entry);
  }
  return out;
}

function asBehaviorArray(v: unknown): Array<{ source_behavior: string; target_behavior: string }> {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => {
      if (typeof x !== 'object' || x === null) return null;
      const o = x as Record<string, unknown>;
      const sb = typeof o.source_behavior === 'string' ? o.source_behavior : '';
      const tb = typeof o.target_behavior === 'string' ? o.target_behavior : '';
      if (!sb || !tb) return null;
      return { source_behavior: sb, target_behavior: tb };
    })
    .filter((x): x is { source_behavior: string; target_behavior: string } => x !== null);
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      reverse?: ReverseEngineeredFunnel;
      scrapedContent?: string;
      targetLanguage?: string;
      targetMarket?: string;
      existingVoc?: ExistingVoc;
    };

    const { reverse, scrapedContent, targetLanguage, targetMarket, existingVoc } = body;

    if (!reverse || !targetLanguage || !targetMarket) {
      return NextResponse.json(
        { ok: false, message: 'Missing reverse, targetLanguage or targetMarket' },
        { status: 400 },
      );
    }

    const effectiveContent =
      scrapedContent && scrapedContent.trim().length > 0
        ? scrapedContent
        : `[NO FRESH ${targetMarket.toUpperCase()} SCRAPE AVAILABLE — base your adaptation on the source avatar, general cultural knowledge of ${targetMarket}, and the existing VOC block below if present. If you lack grounded evidence for cultural anchors or competitors, mark them as empty rather than inventing.]`;

    const systemPrompt = buildSystemPrompt(targetLanguage, targetMarket);
    const userMessage = buildUserMessage(reverse, effectiveContent, targetLanguage, targetMarket, existingVoc ?? null);

    const raw = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<Record<string, unknown>>(raw);
    if (!parsed) {
      console.error('[avatars:localize] JSON parse failed — raw:', raw.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const cf = (parsed.cultural_fit ?? {}) as Record<string, unknown>;
    const bundle: LocalizedBundle = {
      cultural_fit: {
        score: typeof cf.score === 'number' ? cf.score : 50,
        verdict:
          cf.verdict === 'use_as_is' || cf.verdict === 'do_not_localize'
            ? cf.verdict
            : 'adapt_deeply',
        reason: typeof cf.reason === 'string' ? cf.reason : '',
        recommendation: typeof cf.recommendation === 'string' ? cf.recommendation : '',
      },
      localized_name: typeof parsed.localized_name === 'string' ? parsed.localized_name : '',
      localized_nickname: typeof parsed.localized_nickname === 'string' ? parsed.localized_nickname : '',
      localized_description: typeof parsed.localized_description === 'string' ? parsed.localized_description : '',
      localized_demographics: asStringArray(parsed.localized_demographics),
      pain_points: asStringArray(parsed.pain_points),
      desires: asStringArray(parsed.desires),
      fears: asStringArray(parsed.fears),
      objections: asStringArray(parsed.objections),
      trigger_moments: asStringArray(parsed.trigger_moments),
      identity_statements: asStringArray(parsed.identity_statements),
      verbatim_quotes: asStringArray(parsed.verbatim_quotes),
      emotional_triggers: asStringArray(parsed.emotional_triggers),
      competitor_swaps: asSwapArray(parsed.competitor_swaps),
      medical_system_refs: asStringArray(parsed.medical_system_refs),
      cultural_anchors: asStringArray(parsed.cultural_anchors),
      behavior_adaptations: asBehaviorArray(parsed.behavior_adaptations),
      price_anchor: typeof parsed.price_anchor === 'string' ? parsed.price_anchor : '',
      non_transferable: asStringArray(parsed.non_transferable),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };

    await writeAudit(req, session.user, 'avatar.localize.generate', {
      competitor_brand: reverse.competitor_brand,
      targetLanguage,
      targetMarket,
      verbatim_count: bundle.verbatim_quotes.length,
      cultural_fit_verdict: bundle.cultural_fit.verdict,
      cultural_fit_score: bundle.cultural_fit.score,
    });

    return NextResponse.json({ ok: true, bundle });
  } catch (err) {
    console.error('[avatars:localize] error:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'localize failed' },
      { status: 500 },
    );
  }
}
