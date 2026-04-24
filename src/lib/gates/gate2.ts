// ============================================================
// GATE 2 — AVATAR DEEP DIVE (focused)
//
// Takes the ONE sub-avatar the human picked after Gate 1 and goes DEEP
// on it. It no longer rebuilds sub-avatars from scratch — Gate 1 already
// produced the candidate list, Gate 2's job is just to enrich the chosen
// one across 17 categories, voice, language, desires and angles.
//
// Sub-agents:
//   - avatar-researcher : 17 categories of deep signal for the CHOSEN avatar
//   - desire-driller    : mass-instinct desire drilling for the CHOSEN avatar
//   - voice-extractor   : linguistic voice profile of the CHOSEN avatar
//   - language-miner    : 70 hook-ready phrases in the CHOSEN avatar's voice
//   - angle-extractor   : 3-5 scored angles for the CHOSEN avatar
// Lead: compile into a unified dossier focused on that sub-avatar.
// ============================================================

import { GateConfigDef } from './types';
import { getSelectedSubAvatar, buildSelectedSubAvatarBrief } from '../avatars/selectedSubAvatar';
import { EVOLVE_DESIRE_FRAMEWORK, EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { ZAK_BUYER_PSYCHOLOGY } from './zakFrameworks';

// Helper — build the selected-avatar context block every sub-agent prepends
// to its user message. Returns '' if Gate 1 hasn't run yet so we degrade
// gracefully.
function selectedAvatarContextBlock(
  project: Parameters<typeof getSelectedSubAvatar>[0],
  previousOutputs: Record<string, unknown>,
): string {
  const sa = getSelectedSubAvatar(project, previousOutputs);
  if (!sa) {
    return `(Gate 1 has not produced a sub-avatar yet — fall back to the raw product description below.)`;
  }
  return buildSelectedSubAvatarBrief(sa);
}

const gate2: GateConfigDef = {
  id: 'gate2',
  description: 'Avatar deep dive focused on the human-picked sub-avatar from Gate 1',

  subAgents: [
    // --- WAVE 1: Independent research ---
    {
      id: 'avatar-researcher',
      name: 'Avatar Deep Dive Researcher',
      model: 'opus',
      maxTokens: 28000,
      systemPrompt: (project) => `You are an elite customer researcher for a $100M/year direct response brand. Your job: go DEEP into ONE specific sub-avatar's world. You search Reddit, forums, reviews, and communities.

CRITICAL: You are NOT researching a generic target audience. You are researching ONE specific sub-avatar that Marcus already identified in Gate 1. Stay laser-focused on THIS sub-avatar. Use REAL verbatim quotes from actual people that match THIS sub-avatar's profile. Generic marketing language is UNACCEPTABLE.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}`,

      userMessage: (project, previousOutputs) => {
        const avatarContext = selectedAvatarContextBlock(project, previousOutputs);

        return `${avatarContext}

PRODUCT CONTEXT:
${project.productDescription}

Research THIS SPECIFIC SUB-AVATAR across these 17 CATEGORIES. Every category must speak to THIS avatar's reality — not a generic customer.

Format per entry (CONFIDENCE TIERS are mandatory):
{
  "quote": "exact verbatim words",
  "source": "subreddit/forum/review site (be specific — r/keto, trustpilot, quora thread title)",
  "source_url": "full URL if available, empty string otherwise",
  "insight": "what this reveals about THIS sub-avatar",
  "emotion": "primary emotion",
  "tier": "verbatim" | "reconstructed"  // MANDATORY — "verbatim" = quoted directly from a real source (you saw it); "reconstructed" = inferred from patterns, not directly quoted
}

TIER RULES:
- "verbatim" = pulled from an actual Reddit post, review, forum thread, or Gate 1 raw signal you can point to
- "reconstructed" = your best synthesis of what THIS avatar would say based on multiple signals — use when no single verbatim captures the insight
- At LEAST 60% of entries per category must be "verbatim". Reconstructed entries are allowed but must be clearly marked.
- NEVER fabricate a "verbatim" tier. If you're inventing, mark "reconstructed".

17 CATEGORIES (with hard minimums):
1. Core Problems & Pains (min 5) — what hurts most for THIS avatar?
2. Day-to-Day Struggles (min 4) — daily friction THIS avatar experiences
3. Emotional Impact (min 4) — how it makes THIS avatar FEEL (shame, frustration, hopelessness)
4. Social Impact (min 3) — how it affects relationships, social life, public image
5. Financial Impact (min 3) — money THIS avatar wasted on solutions, costs of the problem
6. Failed Solutions (min 5) — what THIS avatar already tried (build on Gate 1's past_attempts_failures)
7. Current Coping Mechanisms (min 5) — how THIS avatar deals with it RIGHT NOW
8. Trigger Moments (min 4) — specific moments that push THIS avatar to search for a solution
9. Core Desires (min 5) — what THIS avatar wants most (surface level)
10. Dream Outcomes (min 5) — the ideal life if the problem was solved for THIS avatar
11. Fears & Anxieties (min 4) — what scares THIS avatar about the problem AND about solutions
12. Skepticism & Objections (min 4) — why THIS avatar doesn't trust new solutions
13. Trust Signals (min 5) — what would make THIS avatar believe
14. Language & Vocabulary (min 4) — specific words THIS avatar uses (build on Gate 1 verbatims)
15. Community Beliefs (min 3) — shared beliefs in THIS avatar's community
16. Competitor Sentiment (min 3) — what THIS avatar says about existing products
17. Purchase Triggers (min 4) — what finally makes THIS avatar buy

Output valid JSON: { "avatar_deep_dive": { "1_core_problems": [...], "2_daily_struggles": [...], ... "17_purchase_triggers": [...] } }

RULES:
- MINIMUM 68 total quotes across all categories (see hard minimums above — 5+4+4+3+3+5+5+4+5+5+4+4+5+4+3+3+4 = 71 floor).
- Hard minimums are FLOORS, not targets — exceed them for high-signal categories (1, 9, 10, 13).
- Quotes must sound like the CHOSEN sub-avatar talking — same voice, same pain points, same language.
- Include the messy, raw, emotional language.
- Every entry MUST include "tier" field ("verbatim" or "reconstructed"). No exceptions.
- Build on top of Gate 1 verbatims — expand, deepen, don't contradict.`;
      },
    },

    {
      id: 'desire-driller',
      name: 'Desire Deep Driller',
      model: 'opus',
      maxTokens: 32000,
      systemPrompt: (project) => `You are a mass psychology researcher specializing in hidden desires and buying motivations. You use the EVOLVE desire-drilling framework on ONE specific sub-avatar.

Your job: find the REAL desires of THIS sub-avatar — not what they SAY they want, but what they ACTUALLY want at the deepest level.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const avatarContext = selectedAvatarContextBlock(project, previousOutputs);
        return `${avatarContext}

PRODUCT CONTEXT:
${project.productDescription}

## DESIRE DRILLING FRAMEWORK — applied to THIS SUB-AVATAR

${EVOLVE_DESIRE_FRAMEWORK}

For each desire THIS sub-avatar has, drill down using THE CONNECTION CHAIN:
Feature → Benefit → Surface Want → Deep Desire
And also: "I want X... so I can Y... so I can Z..."

Output valid JSON:
{
  "desire_research": {
    "surface_desires": [
      { "desire": "what THIS avatar SAYS they want", "evidence": "verbatim or Gate 1 reference" }
    ],
    "deep_desires": [
      {
        "surface": "I want X",
        "middle": "so I can Y",
        "core": "so I can Z (identity/emotional level)",
        "mass_instinct": "which of the 6 RANKED instincts this connects to",
        "instinct_rank": 1,
        "connection_chain": "Feature → Benefit → Surface Want → Deep Desire",
        "copy_angle": "how to use this in ads for THIS avatar"
      }
    ],
    "desire_hierarchy": {
      "primary": "the #1 desire driving THIS avatar's purchase",
      "primary_instinct": "which of the 6 mass instincts (ranked)",
      "secondary": "supporting desire",
      "hidden": "the desire THIS avatar won't admit"
    },
    "elevation_analysis": {
      "current_positioning": "which instinct level the product currently targets",
      "elevated_positioning": "which HIGHER instinct level the product COULD target",
      "elevation_examples": ["3 headline examples at the elevated level"],
      "scale_impact": "why elevating UP the hierarchy = more scale"
    },
    "tech_problems_analysis": [
      {
        "problem": "which of the 6 mass tech problems applies to THIS avatar",
        "how_it_manifests": "specific way THIS avatar experiences this tech problem",
        "copy_angle": "how to use this in ads"
      }
    ],
    "identification_marketing": {
      "where_they_want_to_be": "environment THIS avatar aspires to",
      "what_they_want_to_look_like": "appearance/style aspiration",
      "what_they_want_to_feel": "internal state aspiration",
      "self_image_to_portray": "external perception aspiration"
    },
    "belief_building": {
      "yes_train": ["3 yes-questions building agreement for THIS avatar"],
      "symptoms_proof": "detailed pain understanding proving we 'get them'",
      "authority_signals": ["evidence that loosens old beliefs"],
      "logic_chain": "premise → premise → premise → conclusion"
    },
    "desire_power_ranking": [
      {
        "desire": "specific desire",
        "scope": 8,
        "urgency": 7,
        "staying_power": 9,
        "total": 504,
        "reasoning": "why these scores"
      }
    ],
    "desire_calendar": {
      "peak_months": ["months when THIS avatar's desire peaks"],
      "seasonal_angles": ["copy angles tied to seasonal desire spikes"]
    },
    "big_4_emotions": {
      "new_only": { "applicable": true, "angle": "how to use NEW/ONLY framing for THIS avatar" },
      "easy_anybody": { "applicable": true, "angle": "how to use EASY/ANYBODY framing for THIS avatar" },
      "safe_predictable": { "applicable": true, "angle": "how to use SAFE/PREDICTABLE framing for THIS avatar" },
      "big_fast": { "applicable": true, "angle": "how to use BIG/FAST framing for THIS avatar" }
    }
  }
}

EVOLVE BIG 4 EMOTIONS:
- NEW/ONLY — "This is something you've NEVER seen before"
- EASY/ANYBODY — "ANYONE can do this, no skill needed"
- SAFE/PREDICTABLE — "This is PROVEN, low risk, guaranteed"
- BIG/FAST — "Get MASSIVE results in record time"

${ZAK_BUYER_PSYCHOLOGY}

Also output:
{
  "buyer_psychology_analysis": {
    "buying_emotions": {
      "excitement": { "score": 0, "evidence": "why this score for THIS avatar" },
      "fear": { "score": 0, "evidence": "" },
      "trust": { "score": 0, "evidence": "" },
      "guilt": { "score": 0, "evidence": "" },
      "pride": { "score": 0, "evidence": "" },
      "shame": { "score": 0, "evidence": "" }
    },
    "pain_desire_ratio": {
      "pain_pct": 0,
      "desire_pct": 0,
      "copy_implication": "what this means for hook/copy strategy"
    },
    "buyer_vs_user": {
      "buyer": "who pays",
      "user": "who benefits",
      "same_person": true,
      "copy_implication": "how to address both if different"
    },
    "emotional_intensity": {
      "primary_emotion": "",
      "intensity_level": "surface|moderate|deep|primal",
      "evidence": "verbatim or behavior that proves this intensity"
    },
    "purchase_hesitation": {
      "top_hesitation": "",
      "counter_strategy": "how to overcome this in copy"
    }
  }
}

RULES:
- Drill AT LEAST 8 desire chains using the CONNECTION CHAIN for THIS specific sub-avatar
- Score each desire using DESIRE POWER RANKING (Scope × Urgency × Staying Power)
- Apply the ELEVATION STRATEGY — show current positioning AND the elevated version
- Check ALL 6 mass tech problems for relevance to THIS avatar
- Complete the IDENTIFICATION MARKETING 4 questions for THIS avatar
- Build 4 BELIEF-BUILDING techniques specific to THIS avatar
- The hidden desire is the MOST valuable — dig for it
- Big 4 emotions: determine which 1-2 are strongest for THIS avatar + product combo
- Score ALL 6 ZAK buying emotions (1-10) with evidence
- Calculate pain/desire ratio — this drives ALL downstream copy decisions
- Identify buyer vs user dynamic — critical for body copy targeting
- Rank emotional intensity level (surface/moderate/deep/primal) — this determines hook aggression
- Every angle must be copy-ready AND specific to this sub-avatar's voice`;
      },
    },

    // --- WAVE 2: Depends on avatar-researcher ---
    {
      id: 'voice-extractor',
      name: 'Voice Profile Extractor',
      model: 'sonnet',
      dependsOn: ['avatar-researcher'],
      systemPrompt: (project) => `You are a linguistic analyst specializing in audience voice profiling. You extract the authentic voice of ONE specific sub-avatar from their raw language.

TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs, peerOutputs) => {
        const avatarContext = selectedAvatarContextBlock(project, previousOutputs);
        return `${avatarContext}

DEEP DIVE RESEARCH (source of quotes):
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available'}

## VOICE EXTRACTION FRAMEWORK — for THIS SUB-AVATAR

From the Gate 1 verbatims + the deep dive research above, extract the voice of THIS specific sub-avatar:

{
  "voice_profile": {
    "vocabulary": ["20-30 specific words/phrases THIS sub-avatar uses repeatedly — NOT marketing terms"],
    "vocabulary_constraints": {
      "forbidden_words": ["words that would break immersion — corporate/clinical/influencer-speak"],
      "power_words": ["words that hit hardest for THIS avatar — pulled from raw signal"],
      "register_rules": ["e.g. 'never uses superlatives', 'avoids medical jargon', 'swears when frustrated'"]
    },
    "register": "casual|conversational|semi-formal|formal|clinical — with a one-sentence justification",
    "sentence_patterns": {
      "typical_length": "short|medium|long — with avg word count",
      "structures": ["3-5 recurring sentence structures — e.g. 'I tried X but Y', 'Why does Z always...', 'I just want to...'"],
      "punctuation_habits": "uses ellipsis? ALL CAPS for emphasis? question stacking? run-ons?",
      "fragments_vs_complete": "fragments|mix|complete"
    },
    "sentence_style": "short punchy OR longer flowing? Fragments? Questions? Exclamations? Give 3 example sentences in THIS avatar's voice.",
    "formality_level": 1,
    "formality_justification": "why this level — evidence from THIS avatar's language",
    "emotional_tone": "dominant emotional state of THIS avatar: frustrated, hopeful, desperate, skeptical, resigned, etc.",
    "emotional_register": {
      "baseline": "default emotional state THIS avatar lives in",
      "peak": "strongest emotion when triggered",
      "suppressed": "what they feel but won't admit publicly"
    },
    "emotional_range": "does THIS avatar swing between emotions or stay consistent?",
    "phrases_to_use": ["10+ phrases that sound natural to THIS avatar"],
    "phrases_to_avoid": ["10+ phrases that would sound fake, corporate, or off-putting to THIS avatar"],
    "key_expressions": [
      { "expression": "signature turn of phrase", "context": "when they reach for it", "tier": "verbatim|reconstructed" }
      // 8-12 entries — recurring expressions that are load-bearing for voice matching
    ],
    "metaphor_patterns": [
      { "metaphor": "e.g. 'it felt like walking through molasses'", "domain": "e.g. body/weight/effort", "why_it_resonates": "what this metaphor reveals about THIS avatar's mental model" }
      // 5-8 entries — metaphors THIS avatar naturally reaches for, grouped by semantic domain
    ],
    "bridge_to_mechanism": {
      "how_they_talk_about_cause": "the language THIS avatar uses when explaining WHY the problem exists",
      "belief_gaps": "where their folk explanation differs from the real mechanism",
      "hook_bridge": "one sentence that starts in their language and bridges toward the product's mechanism name (use REAL product mechanism if known)"
    },
    "sample_paragraph": "5 sentences about the problem written IN THIS avatar's voice — must be indistinguishable from a real forum post by someone matching this profile",
    "cursing_level": "none|mild|moderate|heavy",
    "humor_style": "none|self-deprecating|sarcastic|dark|playful",
    "metaphors_they_use": ["metaphors/analogies THIS avatar naturally reaches for (legacy list — fill metaphor_patterns for structured form)"]
  }
}

RULES:
- Vocabulary must be THEIR words, not ours — mine Gate 1 verbatims first
- Sample paragraph must pass the "could a real person matching THIS sub-avatar have written this?" test
- Phrases to avoid: include corporate-speak, overly formal language, competitor jargon
- Be specific — "frustrated" is too vague. "frustrated-but-still-hoping" is better.
- key_expressions: minimum 8 entries — each tagged "verbatim" or "reconstructed"
- metaphor_patterns: minimum 5 entries grouped by semantic domain
- bridge_to_mechanism: REQUIRED — this is how Gate 3/4/6 will connect avatar language to the mechanism. Never skip.
- Language must match the target language (${project.targetLanguage})`;
      },
    },

    {
      id: 'language-miner',
      name: 'Customer Language Hook Miner',
      model: 'opus',
      maxTokens: 24000,
      dependsOn: ['avatar-researcher'],
      systemPrompt: (project) => `You are an elite hook writer and customer language specialist. You extract hook-ready phrases from ONE specific sub-avatar's raw language.

These mined phrases will become the FOUNDATION of all hooks, ads, and copy for THIS sub-avatar. Quality here = quality everywhere.

TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs, peerOutputs) => {
        const avatarContext = selectedAvatarContextBlock(project, previousOutputs);
        return `${avatarContext}

DEEP DIVE RESEARCH (source material):
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available'}

## CUSTOMER LANGUAGE MINING — 7 Categories × 10 Examples (all in THIS sub-avatar's voice)

Extract EXACTLY 10 hook-ready phrases per category = 70 total. Each phrase tagged with a confidence tier.

Entry format per phrase:
{ "phrase": "complete hook-ready fragment in THIS avatar's voice", "tier": "verbatim|reconstructed", "evidence": "where you pulled it from (source/insight) — one line" }

{
  "customer_language_mining": {
    "pain": [
      // 10 phrases expressing raw pain — what hurts, how it hurts, what it costs
      // e.g. { "phrase": "I can't even walk to the mailbox without having to stop", "tier": "verbatim", "evidence": "Reddit r/PlantarFasciitis" }
    ],
    "desire": [
      // 10 phrases of longing — what they want back, what they dream of, what they miss
      // e.g. "I just want to play with my kids again without wincing"
    ],
    "identity": [
      // 10 phrases of self-concept — who they are, who they're NOT, who they used to be, who they want to be
      // e.g. "I used to be the fit one in the group", "I'm not that person who complains but..."
    ],
    "failed_solution": [
      // 10 phrases about what didn't work — broken promises, wasted money, dead ends
      // e.g. "I've tried every cream on Amazon and nothing touches it"
    ],
    "body_sensation": [
      // 10 phrases of raw physical sensation — how the body FEELS, specific visceral descriptions
      // e.g. "like a hot needle under my heel", "my legs feel like concrete by 3pm"
    ],
    "emotional_state": [
      // 10 phrases of internal emotional weather — shame, fear, resignation, rage, grief, hope
      // e.g. "I cried in the bathroom at work", "starting to believe I'll just live with this"
    ],
    "action_coping": [
      // 10 phrases of behavior and workarounds — what they DO to manage day-to-day
      // e.g. "I plan my whole day around where I can sit down", "I park in the handicap spot even though I shouldn't"
    ]
  }
}

RULES:
- EXACTLY 10 per category = 70 total phrases, NO EXCEPTIONS. Count before submitting.
- Every phrase MUST have { phrase, tier, evidence } — tier = "verbatim" (pulled from real source/Gate 1) or "reconstructed" (synthesized from patterns)
- At LEAST 60% of phrases per category should be "verbatim" tier
- Phrases must be COMPLETE hook-ready fragments — usable as ad headlines or first-line opens, not generic summaries
- They must sound like GOSSIP, DRAMA, or REAL LIFE — not marketing
- pain + body_sensation are the MOST visceral — go deep, specific, unflinching
- identity phrases are the HIGHEST-leverage for ad copy — mine for self-concept gold
- desire phrases must feel like LONGING, not affirmation — the gap, not the outcome
- Use the target language (${project.targetLanguage}) throughout`;
      },
    },

    // --- WAVE 3: Depends on researcher + desire-driller ---
    {
      id: 'angle-extractor',
      name: 'Angle Identifier & Scorer',
      model: 'opus',
      maxTokens: 20000,
      dependsOn: ['avatar-researcher', 'desire-driller'],
      systemPrompt: (project) => `You are an angle identification specialist using the EVOLVE framework. You find specific REASONS TO BUY for ONE specific sub-avatar.

CRITICAL DISTINCTION:
- ANGLE = the specific REASON/MOTIVATION to buy (the WHY)
- CONCEPT = how you PRESENT the angle (the HOW — creative execution)
Angles are strategic. Concepts are tactical. You do ANGLES.

TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs, peerOutputs) => {
        const avatarContext = selectedAvatarContextBlock(project, previousOutputs);
        return `${avatarContext}

DEEP DIVE RESEARCH:
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available'}

DESIRE RESEARCH:
${peerOutputs['desire-driller']?.slice(0, 6000) || 'Not available'}

## ANGLE IDENTIFICATION — for THIS SUB-AVATAR

Identify 5-8 unique angles for THIS sub-avatar. Each angle must target a different reason-to-buy rooted in THIS avatar's pain/desire profile.

Score each angle (1-10 per axis):
- EV (Emotional Value): How emotionally charged is this reason to buy for THIS avatar?
- MA (Market Awareness match): Does this work for THIS avatar's awareness level?
- WS (Word Specificity): How specific and vivid can we make this?

TOTAL is the PRODUCT (multiplication, NOT sum) of all three axes — range 1 to 1000.
Formula: TOTAL = EV * MA * WS
Examples:
- EV=9, MA=8, WS=9 → TOTAL = 9 × 8 × 9 = 648
- EV=10, MA=10, WS=10 → TOTAL = 1000 (theoretical max)
- EV=6, MA=7, WS=5 → TOTAL = 210
If you output a total below 50 or above 1000 you have made an arithmetic error — recompute.

{
  "angle_candidates": [
    {
      "name": "angle name",
      "reason_to_buy": "the specific reason THIS avatar would buy",
      "emotional_lever": "what emotion drives this angle for THIS avatar",
      "ev": 8,
      "ma": 7,
      "ws": 9,
      "total": 504,
      "example_hook": "one hook that captures this angle in THIS avatar's voice",
      "concept_directions": ["2-3 ways to creatively present this angle"]
    }
  ],
  "top_5_angles": [
    { "rank": 1, "angle_name": "", "total_score": 0, "why_top": "" }
  ]
}

RULES:
- 5-8 angles total, all focused on THIS sub-avatar
- Angles must be SPECIFIC reasons to buy, not vague benefits
- Top 5 ranked by total score
- Example hooks must be punchy and in THIS avatar's language`;
      },
    },
  ],

  // --- LEAD AGENT ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `You are a customer research strategist. Produce a complete avatar deep dive for: ${project.name}`;
    }
    return `You are the Lead Customer Strategist at a $100M/year direct response agency. Your team of 5 specialists has completed their deep dive on ONE specific sub-avatar (picked after Gate 1). COMPILE their work into a unified Avatar Intelligence Dossier focused on THAT sub-avatar.

RULES:
1. Integrate ALL specialist work — nothing gets dropped
2. Build the definitive quote bank from all research
3. Cross-reference desires with the 17 categories — any conflicts?
4. Rank angles by total score
5. Ensure voice profile matches the actual customer language mined
6. The output is about ONE sub-avatar, not a list of candidates — Gate 1 already did that`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    const avatarContext = selectedAvatarContextBlock(project, previousOutputs);
    if (!subAgentOutputs) {
      return `${avatarContext}\n\nProduct: ${project.productDescription}\nProduce the complete avatar dossier for THIS sub-avatar.`;
    }
    return `${avatarContext}

Compile these specialist reports into the unified dossier for THIS sub-avatar.

IMPORTANT — COMPILE STRATEGY:
You are NOT rewriting the specialist outputs. You are ASSEMBLING them. Preserve the full structure from each sub-agent verbatim. Do not summarize, shorten, or "improve" their outputs — copy the structured fields directly. Your job is to merge them into one JSON envelope with the exact schema below.

=== AVATAR DEEP DIVE (17 categories — preserve ALL entries including "tier" field) ===
${subAgentOutputs['avatar-researcher'] || 'N/A'}

=== DESIRE RESEARCH (preserve ALL desire_research fields verbatim, including full elevation_analysis) ===
${subAgentOutputs['desire-driller'] || 'N/A'}

=== VOICE PROFILE (preserve ALL voice_profile fields including vocabulary_constraints, register, sentence_patterns, emotional_register, key_expressions, metaphor_patterns, bridge_to_mechanism) ===
${subAgentOutputs['voice-extractor'] || 'N/A'}

=== CUSTOMER LANGUAGE MINING (70 phrases — 7 new categories: pain/desire/identity/failed_solution/body_sensation/emotional_state/action_coping) ===
${subAgentOutputs['language-miner'] || 'N/A'}

=== ANGLE CANDIDATES (scored — preserve ev/ma/ws/total) ===
${subAgentOutputs['angle-extractor'] || 'N/A'}

Output unified JSON wrapped in \`\`\`json code blocks. CRITICAL SCHEMA REQUIREMENTS — follow EXACTLY:

{
  "focused_sub_avatar_id": "the sa-N id this dossier is about",
  "avatar_deep_dive": {
    // Each entry MUST preserve: { quote, source, source_url, insight, emotion, tier }
    // tier = "verbatim" or "reconstructed" — copy from avatar-researcher output verbatim.
    "1_core_problems": [ /* min 5 */ ],
    "2_daily_struggles": [ /* min 4 */ ],
    "3_emotional_impact": [ /* min 4 */ ],
    "4_social_impact": [ /* min 3 */ ],
    "5_financial_impact": [ /* min 3 */ ],
    "6_failed_solutions": [ /* min 5 */ ],
    "7_current_coping": [ /* min 5 */ ],
    "8_trigger_moments": [ /* min 4 */ ],
    "9_core_desires": [ /* min 5 */ ],
    "10_dream_outcomes": [ /* min 5 */ ],
    "11_fears_anxieties": [ /* min 4 */ ],
    "12_skepticism_objections": [ /* min 4 */ ],
    "13_trust_signals": [ /* min 5 */ ],
    "14_language_vocabulary": [ /* min 4 */ ],
    "15_community_beliefs": [ /* min 3 */ ],
    "16_competitor_sentiment": [ /* min 3 */ ],
    "17_purchase_triggers": [ /* min 4 */ ]
  },
  "desire_research": {
    "surface_desires": [ ... ],
    "deep_desires": [
      { "surface": "", "middle": "", "core": "", "mass_instinct": "", "instinct_rank": 1, "connection_chain": "", "copy_angle": "" }
      // MANDATORY: minimum 8 deep_desires chains — DO NOT truncate, DO NOT drop chains.
      // Copy verbatim from desire-driller output. If your output is getting long, shorten prose elsewhere — never drop chains.
    ],
    "desire_hierarchy": { "primary": "", "primary_instinct": "", "secondary": "", "hidden": "" },
    "elevation_analysis": {
      "current_positioning": "FULL sentence — never truncate",
      "elevated_positioning": "FULL sentence — never truncate",
      "elevation_examples": ["FULL headline 1", "FULL headline 2", "FULL headline 3"],
      "scale_impact": "FULL paragraph — never truncate mid-sentence. Copy verbatim from desire-driller."
    },
    "tech_problems_analysis": [ ... ],
    "identification_marketing": { ... },
    "belief_building": { ... },
    "desire_power_ranking": [
      { "desire": "", "scope": 1, "urgency": 1, "staying_power": 1, "total": 1, "reasoning": "" }
    ],
    "desire_calendar": { ... },
    "big_4_emotions": { ... }
  },
  "buyer_psychology_analysis": { ... full from desire-driller output, copy verbatim ... },
  "voice_profile": {
    // Copy ALL fields from voice-extractor verbatim, including:
    // vocabulary, vocabulary_constraints, register, sentence_patterns, sentence_style,
    // formality_level, emotional_tone, emotional_register, emotional_range,
    // phrases_to_use, phrases_to_avoid, key_expressions (8-12), metaphor_patterns (5-8),
    // bridge_to_mechanism, sample_paragraph, cursing_level, humor_style, metaphors_they_use
  },
  "customer_language_mining": {
    "pain": [ /* EXACTLY 10 entries, each { phrase, tier, evidence } */ ],
    "desire": [ /* EXACTLY 10 */ ],
    "identity": [ /* EXACTLY 10 */ ],
    "failed_solution": [ /* EXACTLY 10 */ ],
    "body_sensation": [ /* EXACTLY 10 */ ],
    "emotional_state": [ /* EXACTLY 10 */ ],
    "action_coping": [ /* EXACTLY 10 */ ]
  },
  "angle_candidates": [
    {
      "name": "angle name (required)",
      "reason_to_buy": "specific reason (required)",
      "emotional_lever": "driving emotion (required)",
      "ev": 8,         // MANDATORY 1-10 integer — Emotional Value
      "ma": 7,         // MANDATORY 1-10 integer — Market Awareness match
      "ws": 9,         // MANDATORY 1-10 integer — Word Specificity
      "total": 504,    // MANDATORY = ev * ma * ws (multiplication, not sum)
      "example_hook": "required punchy hook in avatar voice",
      "concept_directions": ["2-3 creative directions"]
    }
    // MINIMUM 5 angle candidates, up to 8. EVERY angle MUST include ev/ma/ws/total — NO EXCEPTIONS.
  ],
  "top_angles": [
    { "rank": 1, "angle_name": "", "total_score": 0, "why_top": "" }
    // EXACTLY 5 entries, ranked by total_score descending
  ],
  "quote_bank": {
    "pain_quotes": [{ "quote": "", "source": "", "emotion": "" }],
    "desire_quotes": [{ "quote": "", "source": "", "depth": "" }],
    "objection_quotes": [{ "quote": "", "handler": "" }],
    "transformation_quotes": [{ "quote": "", "context": "" }]
  },
  "patterns_identified": ["cross-cutting patterns from all research on THIS avatar"],
  "strategic_recommendations": "what all this means for our campaign targeting THIS sub-avatar"
}

HARD REQUIREMENTS (non-negotiable, reviewer will reject otherwise):
- customer_language_mining: EXACTLY 70 total phrases (10 per category × 7 categories: pain, desire, identity, failed_solution, body_sensation, emotional_state, action_coping). Each entry = { phrase, tier, evidence }. NOT 50. NOT 65. 70.
- angle_candidates: minimum 5 entries, maximum 8. Every entry MUST have ev, ma, ws, total as integers. total = ev × ma × ws.
- top_angles: EXACTLY 5 entries.
- desire_research.deep_desires: MINIMUM 8 complete chains. Each chain MUST have surface, middle, core, mass_instinct, instinct_rank, connection_chain, copy_angle — all non-empty.
- desire_research.desire_power_ranking: MINIMUM 6 desires scored with scope × urgency × staying_power = total.
- desire_research.elevation_analysis: MUST be complete — current_positioning, elevated_positioning, 3 full headline examples, scale_impact FULL paragraph. NEVER truncate mid-sentence. Copy verbatim from desire-driller.
- avatar_deep_dive category minimums: 1:5, 2:4, 3:4, 4:3, 5:3, 6:5, 7:5, 8:4, 9:5, 10:5, 11:4, 12:4, 13:5, 14:4, 15:3, 16:3, 17:4 (total floor ≈ 71 quotes).
- Every quote in avatar_deep_dive MUST have a "tier" field ("verbatim" or "reconstructed"). No exceptions.
- voice_profile MUST contain: vocabulary_constraints (forbidden_words/power_words/register_rules), register, sentence_patterns, emotional_register, key_expressions (≥8), metaphor_patterns (≥5), bridge_to_mechanism. Missing any of these = reject.
- If you find yourself approaching the token limit: trim narrative prose in strategic_recommendations and quote_bank, NEVER drop or truncate deep_desires, angle_candidates, customer_language_mining, elevation_analysis, voice_profile subfields, or avatar_deep_dive entries.`;
  },

  generatorMaxTokens: 24000,

  reviewerPrompt: `You are an expert customer research reviewer. Score with brutal honesty. Focus on authenticity, depth, AND whether the dossier stays focused on the ONE sub-avatar that was picked (not generic target audience, not 5 different avatars).

${EVOLVE_COHERENCE_CHAIN}

DIMENSIONS (each /10, total /100, threshold ≥72%):
1. Single-Avatar Focus: Does every section stay on the ONE selected sub-avatar? (no drift)
2. 17 Categories Completeness: All addressed with multiple authentic entries?
3. Verbatim Authenticity: Quotes sound like real people matching THIS avatar?
4. Voice Profile Specificity: Could a copywriter write in this voice immediately?
5. Customer Language Quality: 70 phrases that are hook-ready? Micro-specific moments vivid?
6. Desire Depth: Uses EVOLVE Connection Chain (Feature→Benefit→Surface Want→Deep Desire)? Elevation Strategy applied? Desire Power Ranking scored? Mass Tech Problems checked?
7. Angle Scoring: EV × MA × WS scores justified? Top 5 rooted in THIS avatar's pain?
8. Quote Bank Richness: Sufficient quotes across pain, desire, objection, transformation?
9. Cross-Reference Quality: Desires match voice? Voice matches language? Identification Marketing aligns with desire hierarchy? Buyer Psychology emotions consistent with desire hierarchy?
10. Downstream Readiness: Can Gate 3/4 use this directly? Are mechanism name, root cause, belief error slots pre-compatible? Will emotional specificity survive through Gate 6? Is pain/desire ratio calculated for copy framework selection? Buyer vs user dynamic identified for body copy targeting?

ANTI-VANISHING GRADIENT CHECK: Verify that sub-avatar name, customer language verbatims, voice profile, and emotional tone are specific enough that downstream gates CANNOT dilute them. Generic = fail.

HARD SCHEMA GATES (automatic fail if violated):
- customer_language_mining must have 7 categories (pain, desire, identity, failed_solution, body_sensation, emotional_state, action_coping) with EXACTLY 10 phrases each = 70 total. Each entry must be { phrase, tier, evidence }. Wrong categories, wrong counts, or missing tier = fail dimension 5.
- angle_candidates: every entry MUST have ev (1-10 int), ma (1-10 int), ws (1-10 int), total (= ev × ma × ws). Missing any of these = fail dimension 7.
- desire_research.deep_desires must contain ≥ 8 complete chains with all 7 fields (surface/middle/core/mass_instinct/instinct_rank/connection_chain/copy_angle). Truncated or missing chains = fail dimension 6.
- desire_research.elevation_analysis must be complete (no mid-sentence truncation in scale_impact, 3 full elevation_examples). Truncated = fail dimension 6.
- avatar_deep_dive category minimums (tier field required on every entry): 1≥5, 2≥4, 3≥4, 4≥3, 5≥3, 6≥5, 7≥5, 8≥4, 9≥5, 10≥5, 11≥4, 12≥4, 13≥5, 14≥4, 15≥3, 16≥3, 17≥4. Missing tier or below minimum = fail dimension 2.
- voice_profile MUST include: vocabulary_constraints, register, sentence_patterns, emotional_register, key_expressions (≥8), metaphor_patterns (≥5), bridge_to_mechanism. Missing any = fail dimension 4.
- If ANY of these are violated, mark passed=false regardless of other dimensions.

Respond in valid JSON with score, maxScore (100), dimensions, feedback, passed.`,

  reviewCriteria: `Score each dimension /10. Authenticity is #1 priority — fake-sounding research = instant fail. Focus on ONE sub-avatar is #2 — drifting to other sub-avatars or a generic audience = instant fail. Total /100, pass ≥ 72%.`,

  reviewThreshold: 72,
  hasCongruenceCheck: true,

  congruencePrompt: `You are the Brand DNA Congruence Agent for the avatar deep-dive gate. This gate feeds every downstream gate with the sub-avatar language, fears, desires, and buying triggers. If it drifts from Brand DNA, every downstream copy asset inherits the drift.

CHECK THE DEEP-DIVE AGAINST BRAND DNA:

1. SUB-AVATAR LOCK (30%):
   - Does the focused sub-avatar match the one declared on Brand DNA (if locked)?
   - Are the name, nickname, and category consistent?
   - Does the psychographic profile match the locked_avatar attributes?

2. CUSTOMER LANGUAGE COMPLIANCE (25%):
   - Do pain quotes and desire quotes use always_use vocabulary?
   - Are there ZERO never_use words/phrases in the extracted verbatims or paraphrases?
   - Is the tone/register consistent with voice_profile?

3. MECHANISM & BELIEF ALIGNMENT (20%):
   - Do surfaced failed solutions match the belief_error framing in Brand DNA (if locked)?
   - Do desire scenarios align with the resolution_emotion and transformation narrative?
   - Are triggers consistent with the locked mechanism context?

4. EVIDENCE AUTHENTICITY (15%):
   - Verbatims sound like real humans (not marketing-smooth)?
   - Sources diverse (not all from one forum/platform)?
   - Contradictions and messy realities preserved (not sanitized)?

5. CROSS-GATE CONSISTENCY (10%):
   - Avatar data matches Gate 1 sub-avatar selection?
   - Product context lines up with what Brand DNA has locked?

Flag EVERY deviation:
- CRITICAL: Wrong sub-avatar focus, never_use word present, fabricated verbatim
- WARNING: Voice drift, missing always_use words, sanitized pain points
- MINOR: Formality shift, minor vocabulary deviation

Respond in valid JSON:
{
  "score": 0,
  "passed": false,
  "dimensions": {
    "sub_avatar_lock": 0,
    "customer_language_compliance": 0,
    "mechanism_belief_alignment": 0,
    "evidence_authenticity": 0,
    "cross_gate_consistency": 0
  },
  "driftReport": [
    { "location": "section name / verbatim quote / etc.", "expected": "what Brand DNA says", "found": "what this gate produced", "severity": "CRITICAL|WARNING|MINOR" }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific fixes",
  "iteration": 0
}`,

  congruenceThreshold: 75,
};

export default gate2;
