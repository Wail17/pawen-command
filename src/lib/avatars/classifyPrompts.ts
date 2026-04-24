// ============================================================
// PAWEN — Awareness + Market Sophistication classification prompts
//
// Used to BACKFILL old sub-avatars that were generated before the
// Schwartz awareness-level + market-sophistication fields existed.
// Single Opus call, small input, small output.
//
// We deliberately reuse the same Schwartz definitions used in the
// main Gate 1 compile prompt — when the user re-runs Gate 1 the
// model assigns these natively, so a backfill must produce values
// that look identical in form and rigor.
// ============================================================

import type { CoreAvatarInput, SubAvatarV2 } from './types';

export function buildClassifySystemPrompt(): string {
  return `You are Marcus, the Customer Researcher at Pawen Agency.

You receive ONE existing sub-avatar that was generated before awareness/sophistication classification existed in the schema. Your job is to classify it using the verbatim signals already attached.

OUTPUT — return ONLY this JSON inside a \`\`\`json block:

\`\`\`json
{
  "recommended_awareness_level": "unaware | problem_aware | solution_aware | product_aware | most_aware",
  "recommended_awareness_reason": "1-2 sentences quoting or paraphrasing the verbatim signals that justify this awareness level",
  "market_sophistication": {
    "stage": 1,
    "stage_name": "virgin market | direct claim | bigger claim | unique mechanism | new mechanism / story",
    "reasoning": "2-3 sentences citing competitor density, ad fatigue signals, or claim escalation evidence inferred from the sub-avatar verbatims and triggers",
    "recommended_approach": "what copy strategy actually works at this stage for this avatar",
    "copy_implications": ["3-5 concrete, actionable copy rules downstream gates can apply directly"]
  }
}
\`\`\`

AWARENESS LADDER (Schwartz) — pick the DOMINANT level across the verbatims:
  • "unaware" = complain about symptoms without naming a problem ("I'm just exhausted all the time")
  • "problem_aware" = name the pain, no solution in mind ("I can't sleep and I don't know what to do")
  • "solution_aware" = researching categories ("melatonin, CBD, weighted blankets — tried them all")
  • "product_aware" = comparing specific products/brands ("Is X better than Y?")
  • "most_aware" = asking for discount/link/launch date — purchase intent verbs

If verbatims are mixed, anchor on the level where the STRONGEST emotional quotes sit.

MARKET SOPHISTICATION (Schwartz, INDEPENDENT of awareness):
  • Stage 1 "virgin market" = no real competition, direct benefit claim wins.
  • Stage 2 "direct claim" = competitors exist but use the same claim — yours must be louder.
  • Stage 3 "bigger claim" = audience is jaded, claims must escalate (specific numbers, dramatic before/after).
  • Stage 4 "unique mechanism" = direct claims fail, a unique mechanism is the wedge.
  • Stage 5 "new mechanism / story" = saturated market, only a NEW mechanism + story-driven angle cuts through.

ABSOLUTE: Always output the JSON. NEVER refuse, NEVER apologize for thin data. Output ONLY the JSON inside a \`\`\`json block.`;
}

export function buildClassifyUserMessage(
  core: CoreAvatarInput,
  subAvatar: SubAvatarV2,
): string {
  const verbatims = (subAvatar.verbatim_quotes ?? [])
    .slice(0, 12)
    .map(
      (v, i) =>
        `${i + 1}. "${v.quote}" — ${v.source_type ?? 'unknown'}${v.emotion_tag ? ` [${v.emotion_tag}]` : ''}`,
    )
    .join('\n');

  const triggers = (subAvatar.emotional_triggers ?? []).slice(0, 8).join(', ');
  const failures = (subAvatar.past_attempts_failures ?? []).slice(0, 8).join('; ');

  return `MARKET CONTEXT
- Product: ${core.product}
- Niche: ${core.niche}
- Surface desire: ${core.surface_desire}
- Language: ${core.language}
- Market: ${core.market}

SUB-AVATAR TO CLASSIFY
- Name: ${subAvatar.name}
- Nickname: ${subAvatar.nickname}
- Description: ${subAvatar.description}
- Dominant category: ${subAvatar.dominant_category}
- Urgency ${subAvatar.urgency_score}/10 · Scope ${subAvatar.scope_score}/10 · Staying power ${subAvatar.staying_power_score}/10

EMOTIONAL TRIGGERS
${triggers || '(none)'}

PAST ATTEMPTS / FAILURES
${failures || '(none)'}

VERBATIM QUOTES
${verbatims || '(none)'}

Classify recommended_awareness_level + market_sophistication. Output ONLY the JSON.`;
}
