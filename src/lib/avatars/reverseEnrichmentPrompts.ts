// ============================================================
// PAWEN — Reverse Enrichment Prompts
// Single Opus call that takes a reverse-engineered sub-avatar and
// produces the deep structural enrichment a raw shape-transform
// can't: localized hooks, 3-5 distinct angles, sensory triggers,
// structured past attempts, buying behavior, scored hooks,
// localized demographics, narrator persona.
//
// Runs AFTER convertReverseEngineeredToAvatarRunResult (and ideally
// after localizeReverseEngineered, so the raw material is already
// in the target language where possible).
// ============================================================

import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type { CoreAvatarInput, SubAvatarV2 } from './types';

export function buildReverseEnrichmentSystemPrompt(): string {
  return `You are Marcus, Senior Voice-of-Customer Enrichment Agent at Pawen Agency.

You are handed an avatar that was SYNTHETICALLY built from a competitor's funnel — not scraped from real VOC. Your job is to make it ad-ready for a specific target market by producing deep, structured, localized enrichment.

NON-NEGOTIABLE RULES:

1. LOCALIZATION IS ABSOLUTE.
   Every string you output that will be READ BY A CUSTOMER (hooks, headlines, story_arc fields, CTAs) MUST be in the target language. Not "translated from English" — rewritten in the register, idioms, and emotional vocabulary that a native of the target market would actually use. If the target is Italian, it is ITALIAN, not Google-translate-Italian. If French, it is native French. If the competitor's English said "YOUR SYMPTOMS ARE NOT YOUR FAULT", you do NOT output "I TUOI SINTOMI NON SONO COLPA TUA" — you output "E se non fosse un problema di volontà?" or whatever an Italian copywriter steeped in the niche would write.

2. PRODUCE 3-5 DISTINCT ANGLES, NEVER ONE.
   The base avatar only has a "new_mechanism" angle (copied from the competitor's mechanism). You must produce 2-4 ADDITIONAL angles that explore different positioning frameworks:
     - new_mechanism   → keep the competitor's angle as angle #1 (primary)
     - new_identity    → "you are not X, you are Y" (identity shift)
     - new_information → "here's what no one told you" (contrarian data)
     - elevation       → "you deserve more than X" (aspiration shift)
   Each additional angle MUST have its own hooks (3-5), its own story_angle (problem/agitation/bridge/solution/mechanism/cta), and a clear rationale for why it would convert a DIFFERENT slice of the target audience.

3. SENSORY TRIGGERS.
   A "trigger" is NEVER a category. It is a specific moment with at least one sensory anchor. Bad: "feeling tired all the time". Good: "3:47am, you see the blue glow of your phone on the ceiling and feel the tight knot in your solar plexus". Every sensory_trigger MUST include: the trigger text, the dominant sense (visual/touch/sound/smell/taste/interoceptive), intensity 1-10, frequency 1-10, context (1 line). Produce 6-10 of these.

4. STRUCTURED PAST ATTEMPTS.
   The raw past_attempts_failures list mixes fears, symptoms, and failed attempts. You must UN-MIX it. Output ONLY true past attempts as {what_tried, why_failed, residual_emotion}. Residual emotion is critical — it's the emotional debt the customer carries into their next purchase decision (shame, anger, resignation, distrust, hope). Produce 4-8.

5. BUYING BEHAVIOR IS NON-OPTIONAL.
   Even if it requires educated inference from the competitor's funnel structure + the core avatar + the niche, you MUST produce a buying_behavior block: decision cycle, price sensitivity, preferred social proof type, preferred channel, and 3-5 top objections with severity and counter-argument.

6. LOCALIZED DEMOGRAPHICS.
   Do not copy-paste the competitor's demographic block. Re-infer it for the TARGET MARKET: age range, income range in the LOCAL currency (€ for Italy/France/Spain, $ for US, etc.), geographic concentration inside the target country, cultural references native to the target market (not US references), and the language register to use.

7. SCORING IS MANDATORY.
   Every hook you produce gets scored 1-10 on curiosity, intensity, relevance. Every sensory_trigger gets intensity + frequency. This lets the downstream agents prioritize instead of treating everything at the same level.

8. NARRATOR PERSONA + BRIDGE MOMENT.
   Define who tells this story (first-person sufferer / recovered friend / expert researcher / trusted peer) and the specific awareness-shift "bridge moment" that moves the reader from agitation to receptivity.

9. OUTPUT IS STRICT JSON. No markdown preamble. No explanations. No refusal. No commentary.`;
}

export function buildReverseEnrichmentUserMessage(
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  baseSubAvatar: SubAvatarV2,
  targetLanguage: string,
  targetMarket: string,
): string {
  const competitorJSON = JSON.stringify(
    {
      competitor_brand: reverse.competitor_brand,
      competitor_url: reverse.competitor_url,
      mechanism: reverse.mechanism,
      sub_avatar_raw: reverse.sub_avatar,
      copy_arsenal: reverse.copy_arsenal,
      creative_strategy: reverse.creative_strategy,
      insights: reverse.insights,
    },
    null,
    2,
  );

  const baseSubAvatarJSON = JSON.stringify(
    {
      name: baseSubAvatar.name,
      nickname: baseSubAvatar.nickname,
      description: baseSubAvatar.description,
      surface_desire: baseSubAvatar.surface_desire,
      existing_verbatim_quotes: baseSubAvatar.verbatim_quotes?.slice(0, 10).map((v) => v.quote) ?? [],
      existing_emotional_triggers: baseSubAvatar.emotional_triggers ?? [],
      existing_past_attempts: baseSubAvatar.past_attempts_failures ?? [],
      existing_demographics: baseSubAvatar.implicit_demographics ?? [],
      existing_primary_angle: baseSubAvatar.angles?.positioning ?? null,
    },
    null,
    2,
  );

  return `=== TARGET MARKET ===
Language: ${targetLanguage}
Market:   ${targetMarket}
Niche:    ${core.niche}
Product:  ${core.product}
Surface desire: ${core.surface_desire}

=== SOURCE (COMPETITOR REVERSE-ENGINEER — usually US/English, do NOT copy-paste) ===
\`\`\`json
${competitorJSON}
\`\`\`

=== CURRENT BASE SUB-AVATAR (synthetic shape transform — we need to enrich) ===
\`\`\`json
${baseSubAvatarJSON}
\`\`\`

=== TASK ===
Produce the enrichment JSON for this sub-avatar, adapted to ${targetMarket}, written in native ${targetLanguage}.

REQUIRED OUTPUT SCHEMA (strict JSON — no markdown, no commentary):

\`\`\`json
{
  "additional_angles": [
    {
      "positioning": {
        "framework": "new_identity | new_information | elevation",
        "description": "1-2 sentence description of this angle's core premise (in ${targetLanguage})",
        "rationale": "why this angle would convert a different slice of the avatar (in English, for the operator)"
      },
      "hooks": ["hook 1 in ${targetLanguage}", "hook 2 in ${targetLanguage}", "...", "hook 5 in ${targetLanguage}"],
      "story_angle": {
        "problem": "specific problem framing in ${targetLanguage}",
        "agitation": "agitation in ${targetLanguage}",
        "solution": "the solution framing in ${targetLanguage}",
        "mechanism": "the mechanism in ${targetLanguage}",
        "cta": "the call to action in ${targetLanguage}"
      }
    }
  ],
  "structured_past_attempts": [
    {
      "what_tried": "specific attempt (in ${targetLanguage} if the attempt names a product/category native to the market)",
      "why_failed": "why it didn't work",
      "residual_emotion": "the feeling it left behind — shame | anger | resignation | distrust | hope | exhaustion | ..."
    }
  ],
  "sensory_triggers": [
    {
      "trigger": "specific sensory-anchored trigger in ${targetLanguage}",
      "sensory_anchor": "visual | touch | sound | smell | taste | interoceptive",
      "intensity_score": 1-10,
      "frequency_score": 1-10,
      "context": "1-line situational hook in ${targetLanguage}"
    }
  ],
  "scored_hooks": [
    {
      "hook": "hook in ${targetLanguage}",
      "curiosity_score": 1-10,
      "intensity_score": 1-10,
      "relevance_score": 1-10,
      "target_language": "${targetLanguage}"
    }
  ],
  "buying_behavior": {
    "decision_cycle": "impulsive | researcher | long_deliberation — with 1-line rationale",
    "price_sensitivity": "high | medium | low — with 1-line rationale",
    "preferred_social_proof": "reviews | studies | before_after | testimonials | experts — with 1-line rationale",
    "preferred_channel": "Meta feed | Stories | Reels | TikTok | email | retargeting — with 1-line rationale",
    "top_objections": [
      {
        "objection": "specific objection in ${targetLanguage}",
        "severity": "deal_breaker | hesitation | minor",
        "counter_argument": "how to counter it in ${targetLanguage}"
      }
    ]
  },
  "localized_demographics": {
    "age_range": "e.g. 35-55",
    "income_range": "local currency range — e.g. '1500-2800€/mois' for France",
    "income_currency": "EUR | USD | GBP | CHF | ...",
    "geographic_concentration": ["e.g. 'Nord Italia', 'Roma metropolitana'"],
    "cultural_references": ["brands/figures/events native to ${targetMarket}"],
    "language_register": "e.g. 'informal italian', 'tu form french', 'castellano neutro'"
  },
  "narrator_persona": "who tells the story (first-person sufferer | recovered friend | expert researcher | trusted peer) — 1-2 sentences",
  "bridge_moment": "the specific awareness-shift moment that moves the reader from agitation to receptivity (in ${targetLanguage})"
}
\`\`\`

REQUIREMENTS:
- additional_angles: 2-4 angles (each with 3-5 hooks and a full story_angle).
- structured_past_attempts: 4-8 items.
- sensory_triggers: 6-10 items.
- scored_hooks: 8-15 items total across all angles.
- buying_behavior.top_objections: 3-5 items.
- localized_demographics: all fields populated with ${targetMarket}-native data.
- Every customer-facing string in ${targetLanguage}.

Return ONLY the JSON (inside a \`\`\`json block).`;
}
