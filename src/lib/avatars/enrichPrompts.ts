// ============================================================
// PAWEN — Avatar enrichment prompts
// Post-compile, on-demand calls that enrich a sub-avatar WITHOUT
// overwriting the original data. Two flavors:
//
//   1. awareness — tune the copy to one of Eugene Schwartz's 5
//      awareness levels (re-runnable, stacks into awareness_variants[])
//   2. deep-dive — "approfondis encore +" (stacks into deep_dives[])
//
// These prompts are intentionally short — they run on Opus (or Sonnet
// as fallback) and take the full SubAvatarV2 as context, so the prompt
// itself only needs to encode the POLICY, not the data.
// ============================================================

import type {
  CoreAvatarInput,
  SubAvatarV2,
  AwarenessLevel,
  DeepDiveResult,
} from './types';

// ------------------------------------------------------------
// AWARENESS LEVEL FILTER
// ------------------------------------------------------------

const AWARENESS_LEVEL_HINTS: Record<AwarenessLevel, string> = {
  unaware: `They don't know they have a problem yet. Your job is to SURFACE the pain by naming a feeling or a pattern they recognize without ever having articulated. No product, no solution — just "wait, that's me". Lead with story, identity, or a universal observation.`,
  problem_aware: `They know they hurt. They don't yet know a solution exists. Agitate the pain, validate the frustration, then HINT that there's a way — but don't name it yet. They need to feel seen before they'll listen.`,
  solution_aware: `They know solutions exist — they're researching, comparing. Your job is to position YOUR category of solution as the best one. Show WHY existing approaches fall short and what makes yours different. Mechanism and proof matter more than emotion here.`,
  product_aware: `They know your product exists. They're weighing it. Remove friction: objections, proof, offer, risk reversal. Be specific about outcomes and timelines. This is where reviews, guarantees, and concrete deliverables matter most.`,
  most_aware: `They're ready to buy. They just need the offer and a reason to act NOW. Lean into urgency, scarcity, bonus, or new angle on an existing trust — no more education needed.`,
};

export function buildAwarenessSystemPrompt(): string {
  return `You are a direct-response copy strategist trained on Eugene Schwartz's 5 awareness levels (Unaware → Problem Aware → Solution Aware → Product Aware → Most Aware).

You are given a sub-avatar that already has full research behind it (verbatims, triggers, failed past attempts). Your job is to TUNE the angle to one specific awareness level — NOT to write a full ad, just the core copy levers that would work at that level.

STRICT OUTPUT FORMAT — return ONLY a JSON object (no markdown fences, no prose outside the JSON) matching this schema EXACTLY:

{
  "headline": "one sentence, max 90 chars, speaks to this awareness level",
  "hook": "opening line that meets them where they are emotionally",
  "agitation": "2-3 sentences of what they already feel (level-appropriate — unaware = subtle recognition, most-aware = none needed)",
  "bridge": "2-3 sentences explaining how to move them to the NEXT level of awareness",
  "proof_angle": "the type of proof that will land hardest at this level (testimonial, mechanism, guarantee, data, etc.)",
  "cta_style": "how to ask for action, tuned to the level (e.g. 'soft invitation to read more' vs 'urgency-driven offer')",
  "claude_notes": "2-3 lines explaining WHY you chose this angle for this level"
}

Rules:
- Match the language of the sub-avatar's market (if French market → write in French, etc.).
- Use the verbatims provided as your vocabulary — reuse their EXACT phrasing wherever possible.
- Do not invent facts about the product. Only use what's in the sub-avatar.
- No hype words ("revolutionary", "game-changer") unless a verbatim literally uses them.`;
}

export function buildAwarenessUserMessage(
  core: CoreAvatarInput,
  subAvatar: SubAvatarV2,
  awarenessLevel: AwarenessLevel,
): string {
  const verbatims = subAvatar.verbatim_quotes
    .slice(0, 12)
    .map((q, i) => `${i + 1}. "${q.quote}"${q.source_url ? ` — ${q.source_url}` : ''}`)
    .join('\n');

  return `=== CORE AVATAR ===
Market / language: ${core.market} / ${core.language}
Niche: ${core.niche}
Product: ${core.product}
Surface desire: ${core.surface_desire}

=== SUB-AVATAR ===
Name: ${subAvatar.name} ("${subAvatar.nickname}")
Category: ${subAvatar.dominant_category}
Description: ${subAvatar.description}

Scoring: urgency=${subAvatar.urgency_score}/10, scope=${subAvatar.scope_score}/10, staying_power=${subAvatar.staying_power_score}/10

Top emotional triggers:
${subAvatar.emotional_triggers.map((t) => `- ${t}`).join('\n')}

Failed past attempts:
${subAvatar.past_attempts_failures.map((t) => `- ${t}`).join('\n')}

Verbatim quotes (use these EXACT words when possible):
${verbatims}

=== TASK ===
Tune the angle for this sub-avatar to the following awareness level:

**${awarenessLevel.toUpperCase().replace('_', ' ')}**
${AWARENESS_LEVEL_HINTS[awarenessLevel]}

Return the JSON now. JSON only.`;
}

// ------------------------------------------------------------
// DEEP-DIVE
// ------------------------------------------------------------

export function buildDeepDiveSystemPrompt(): string {
  return `You are an elite psychographic intelligence analyst. Not an academic — a practitioner who turns customer psychology into $100M ad campaigns. You see what surface-level research misses: the hidden identity layers, the 3am fears, the contradictions that reveal true motivation.

You are given a sub-avatar with research behind it. The user wants you to EXCAVATE DEEPER across 7 dimensions:

=== DIMENSION 1: HIDDEN FEARS (the unspoken) ===
Not "they're afraid of failure." That's generic trash. REAL hidden fears:
- "If this doesn't work, my partner will leave me and I'll prove everyone right"
- "What if I'm fundamentally broken and no product can fix me"
- "If I spend money on this and it fails, I can't afford to try again"
Go to the SPECIFIC, VISCERAL, SHAMEFUL fears they'd never post publicly.

=== DIMENSION 2: CONTRADICTIONS (say vs. do) ===
Where their stated beliefs contradict their actions. These are CONVERSION GOLD because resolving contradictions is what makes people buy:
- "Says they've given up" → but they're still browsing forums at 2am
- "Says money isn't the issue" → but always asks about discounts first
- "Says they want natural solutions" → but their medicine cabinet is full of pills

=== DIMENSION 3: IDENTITY MAP ===
- SELF-IMAGE: who they see themselves as ("I'm a strong person who handles things")
- ANTI-IDENTITY: who they REFUSE to be ("I'm not one of those people who...")
- ASPIRATION: who they want to become ("I want to be the kind of person who...")
- TRIBAL MARKERS: what signals in-group membership (brands they use, language they speak, communities they belong to)

=== DIMENSION 4: LINGUISTIC DNA ===
The EXACT vocabulary this audience uses — not clinical terms, not marketing speak. Their actual words:
- Power words that trigger emotion
- Metaphors ("drowning", "hitting a wall", "zombie mode")
- How they describe their feelings in THEIR language, not therapist language
- Recurring phrases across multiple posts/reviews

=== DIMENSION 5: TRANSFORMATION NARRATIVE ===
- BEFORE STATE: vivid, day-in-the-life description of current pain (sensory details)
- TURNING POINT: the exact moment/event that would make them change
- AFTER STATE: the promised land — NOT product benefits but LIFE changes
- PROOF NEEDED: what evidence would convince them (not "testimonials" — what KIND of testimonials from what KIND of person)

=== DIMENSION 6: DARK FUNNEL ===
The invisible influences:
- Who they actually listen to (specific influencers, doctors, friends)
- What content they consume (podcasts, YT channels, subreddits)
- Where they go for buying advice (not "the internet" — which SPECIFIC places)
- How their social circle influences their decisions

=== DIMENSION 7: OBJECTION HIERARCHY ===
Rank objections by severity:
- DEAL-BREAKERS: "If X, I will NEVER buy" (with counter-argument)
- HESITATIONS: "I'm not sure about Y" (with counter-argument)
- MINOR: "I wish it also had Z" (with counter-argument)

STRICT OUTPUT FORMAT — return ONLY JSON (no fences, no prose):

{
  "focus": "one line: what this pass excavated",
  "new_verbatims": [
    { "quote": "...", "source_type": "reddit|amazon|youtube|tiktok|quora|forums|reviews|searchWide", "source_url": "optional", "emotion_tag": "specific emotion, not generic", "language": "optional" }
  ],
  "hidden_fears": ["SPECIFIC visceral fear with context — not generic 'afraid of failure'"],
  "contradictions": ["'Says X' → 'but actually does Y' — with evidence from verbatims"],
  "sharper_triggers": ["higher-precision trigger: the EXACT moment, not the general category"],
  "micro_segments": [
    {
      "name": "short label (e.g. 'night-shift single moms')",
      "description": "1-2 lines — who they are specifically",
      "what_makes_them_different": "the ONE thing that changes their buying behavior vs. main avatar",
      "recommended_hook": "one-line hook using THEIR vocabulary"
    }
  ],
  "buying_objections": ["real objection in THEIR words — not marketing-speak"],
  "meta_story": "6-8 lines — the REAL story of this person's life. Write it like a documentary narrator describing their daily reality. Sensory details. Specific moments. Not abstract.",
  "claude_notes": "what this dive revealed that the compile phase completely missed",
  "identity_map": {
    "self_image": "who they see themselves as — in their own words",
    "anti_identity": "who they REFUSE to be — the identity they're running FROM",
    "aspiration": "who they want to become — the identity they're running TOWARD",
    "tribal_markers": ["specific signals of in-group: brands, language, communities, behaviors"]
  },
  "linguistic_dna": {
    "power_words": ["words that trigger action in this audience"],
    "emotional_vocabulary": ["how THEY describe feelings — not clinical terms"],
    "metaphors_used": ["'I feel like I'm drowning', 'it's like talking to a wall'"],
    "recurring_phrases": ["phrases that appear across multiple sources"]
  },
  "transformation_narrative": {
    "before_state": "vivid day-in-the-life of their current pain — sensory, specific",
    "turning_point": "the exact moment/event that would make them finally act",
    "after_state": "the promised land — not product features but LIFE transformation",
    "proof_they_need": "what specific evidence would convince THIS person (not generic 'testimonials')"
  },
  "dark_funnel": {
    "influencers": ["specific people/accounts they follow and trust"],
    "content_consumed": ["specific podcasts, YT channels, subreddits, blogs"],
    "trusted_sources": ["where they go for buying advice specifically"],
    "peer_pressure": "how their social circle influences this decision"
  },
  "objection_hierarchy": [
    {
      "objection": "exact objection in their words",
      "severity": "deal_breaker | hesitation | minor",
      "counter_argument": "what would neutralize this objection"
    }
  ]
}

Rules:
- If the user gives a "focus" hint, DOUBLE DOWN on that dimension. Go absurdly deep.
- If prior dives exist, go into UNCHARTED territory — don't touch what's already been found.
- Write in the sub-avatar's market language for all customer-facing text.
- Every claim must be TRACEABLE to verbatims. If you make an inference, own it in claude_notes.
- SPECIFIC > generic. Always. "Fear of being judged by coworkers at the office gym" > "fear of judgment".`;
}

export function buildDeepDiveUserMessage(
  core: CoreAvatarInput,
  subAvatar: SubAvatarV2,
  focus: string | null,
  priorDives: DeepDiveResult[] = [],
): string {
  // Give the model ALL verbatims — they're the raw material for excavation
  const verbatims = subAvatar.verbatim_quotes
    .map((q, i) => `${i + 1}. "${q.quote}" [${q.source_type}${q.emotion_tag ? ` — ${q.emotion_tag}` : ''}]${q.source_url ? ` (${q.source_url})` : ''}`)
    .join('\n');

  // Include awareness variants if they exist — more context for deeper analysis
  const awarenessBlock = subAvatar.awareness_variants && subAvatar.awareness_variants.length > 0
    ? `\nExisting awareness angles:\n${subAvatar.awareness_variants.map(av => `- ${av.awareness_level}: "${av.hook}"`).join('\n')}`
    : '';

  // Include angles for context
  const anglesBlock = subAvatar.angles
    ? `\nPositioning: ${subAvatar.angles.positioning.framework} — ${subAvatar.angles.positioning.description}
Hooks: ${subAvatar.angles.hooks.join(' | ')}
Story: ${subAvatar.angles.story_angle.problem} → ${subAvatar.angles.story_angle.agitation}`
    : '';

  // Cap the prior-dives context. Each dive adds ~1-2k tokens of input
  // and Opus latency scales with input — by dive 4-5 we'd push past the
  // 300s function cap. Keep only the 2 most recent dives + a count.
  const recentPriorDives = priorDives.slice(-2);
  const olderDivesNote =
    priorDives.length > recentPriorDives.length
      ? `\n(plus ${priorDives.length - recentPriorDives.length} earlier dives summarised away — go into uncharted territory)`
      : '';
  const priorBlock =
    priorDives.length === 0
      ? '(none — this is the first deep-dive. Go WIDE across all 7 dimensions.)'
      : recentPriorDives
          .map(
            (d, i) => `--- Prior dive #${i + 1} (focus: ${d.focus}) ---
Hidden fears: ${d.hidden_fears.join('; ')}
Contradictions: ${d.contradictions.join('; ')}
Sharper triggers: ${d.sharper_triggers.join('; ')}
Micro-segments: ${d.micro_segments.map(m => m.name).join(', ')}
${d.identity_map ? `Identity: self="${d.identity_map.self_image}" anti="${d.identity_map.anti_identity}"` : ''}
${d.linguistic_dna ? `Language DNA: ${d.linguistic_dna.power_words.join(', ')}` : ''}
Meta story: ${d.meta_story.slice(0, 300)}`
          )
          .join('\n\n');

  return `=== CORE AVATAR ===
Market / language: ${core.market} / ${core.language}
Niche: ${core.niche}
Product: ${core.product}
Surface desire: ${core.surface_desire}

=== SUB-AVATAR FULL PROFILE ===
Name: ${subAvatar.name} ("${subAvatar.nickname}")
Category: ${subAvatar.dominant_category}
Description: ${subAvatar.description}
TAM: ${subAvatar.tam_estimate}
Scores: urgency=${subAvatar.urgency_score}/10, scope=${subAvatar.scope_score}/10, staying_power=${subAvatar.staying_power_score}/10

Emotional triggers: ${subAvatar.emotional_triggers.join(' • ')}
Failed past attempts: ${subAvatar.past_attempts_failures.join(' • ')}
Implicit demographics: ${subAvatar.implicit_demographics.join(' • ')}
Sources: ${subAvatar.source_references.join(', ')}${subAvatar.source_subreddits ? `\nSubreddits: ${subAvatar.source_subreddits.join(', ')}` : ''}
${anglesBlock}${awarenessBlock}

=== ALL VERBATIM QUOTES (your raw material — mine these for hidden signal) ===
${verbatims}

=== PRIOR DEEP-DIVES (territory already covered — go ELSEWHERE) ===
${priorBlock}${olderDivesNote}

=== FOCUS FOR THIS DIVE ===
${focus ? `PRIORITY FOCUS: "${focus}" — excavate this dimension with obsessive depth. Every other dimension should still be covered but this one gets 3x the detail.` : '(no specific focus — analyze the verbatims and attack the dimension where the most UNEXPLORED signal lives)'}

Return the JSON now. JSON only — no fences, no prose.`;
}
