// ============================================================
// GATE 2 — AVATAR DEEP DIVE
// Sub-agents: avatar-researcher, desire-driller, sub-avatar-builder,
//             voice-extractor, language-miner, angle-extractor
// Lead: Compile + cross-reference + quote bank
// ============================================================

import { GateConfigDef } from './types';

const gate2: GateConfigDef = {
  id: 'gate2',
  description: 'Avatar deep dive, voice extraction, customer language mining',

  subAgents: [
    // --- WAVE 1: Independent research ---
    {
      id: 'avatar-researcher',
      name: 'Avatar Deep Dive Researcher',
      model: 'opus',
      systemPrompt: (project) => `You are an elite customer researcher for a $100M/year direct response brand. Your job: go DEEP into the target customer's world. You search Reddit, forums, reviews, and communities.

CRITICAL: Use REAL verbatim quotes from actual people. Generic marketing language is UNACCEPTABLE.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}`,

      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const productProfile = g1 ? JSON.stringify(g1, null, 2).slice(0, 2000) : project.productDescription;

        return `PRODUCT CONTEXT:
${productProfile}

Research the target customer across these 17 CATEGORIES. For each, provide 3-5 entries with REAL quotes.

Format per entry:
{ "quote": "exact verbatim words", "source": "subreddit/forum/review site", "insight": "what this reveals about them", "emotion": "primary emotion" }

17 CATEGORIES:
1. Core Problems & Pains — what hurts most?
2. Day-to-Day Struggles — daily friction caused by the problem
3. Emotional Impact — how it makes them FEEL (shame, frustration, hopelessness)
4. Social Impact — how it affects relationships, social life, public image
5. Financial Impact — money wasted on solutions, costs of the problem
6. Failed Solutions — what they've tried and why it didn't work
7. Current Coping Mechanisms — how they deal with it RIGHT NOW
8. Trigger Moments — specific moments that push them to search for a solution
9. Core Desires — what they want most (surface level)
10. Dream Outcomes — the ideal life if the problem was solved
11. Fears & Anxieties — what scares them about the problem AND about solutions
12. Skepticism & Objections — why they don't trust new solutions
13. Trust Signals — what would make them believe
14. Language & Vocabulary — specific words they use
15. Community Beliefs — shared beliefs in their community
16. Competitor Sentiment — what they say about existing products
17. Purchase Triggers — what finally makes them buy

Output valid JSON: { "avatar_deep_dive": { "1_core_problems": [...], "2_daily_struggles": [...], ... } }

RULES:
- MINIMUM 50 unique quotes total across all categories
- Quotes must sound like REAL people talking to friends, not marketing copy
- Include the messy, raw, emotional language
- If a category doesn't apply strongly, say so — don't fabricate`;
      },
    },

    {
      id: 'desire-driller',
      name: 'Desire Deep Driller',
      model: 'opus',
      systemPrompt: (project) => `You are a mass psychology researcher specializing in hidden desires and buying motivations. You use the EVOLVE desire-drilling framework.

Your job: find the REAL desires — not what people SAY they want, but what they ACTUALLY want at the deepest level.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        return `PRODUCT CONTEXT:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 1500) : project.productDescription}

## DESIRE DRILLING FRAMEWORK

For each desire, drill down using: "I want X... so I can Y... so I can Z..."

MASS INSTINCTS TO CHECK:
- Self-preservation (survival, health, avoid pain)
- Sex appeal / attractiveness
- Social approval / belonging
- Power / dominance / control
- Curiosity / novelty
- Comfort / ease / convenience
- Independence / freedom
- Nurturing / protecting loved ones

Output valid JSON:
{
  "desire_research": {
    "surface_desires": [
      { "desire": "what they SAY they want", "evidence": "where you see this" }
    ],
    "deep_desires": [
      {
        "surface": "I want X",
        "middle": "so I can Y",
        "core": "so I can Z (identity/emotional level)",
        "mass_instinct": "which instinct this connects to",
        "copy_angle": "how to use this in ads"
      }
    ],
    "desire_hierarchy": {
      "primary": "the #1 desire driving purchase",
      "secondary": "supporting desire",
      "hidden": "the desire they won't admit"
    },
    "big_4_emotions": {
      "new_only": { "applicable": true/false, "angle": "how to use NEW/ONLY framing" },
      "easy_anybody": { "applicable": true/false, "angle": "how to use EASY/ANYBODY framing" },
      "safe_predictable": { "applicable": true/false, "angle": "how to use SAFE/PREDICTABLE framing" },
      "big_fast": { "applicable": true/false, "angle": "how to use BIG/FAST framing" }
    }
  }
}

EVOLVE BIG 4 EMOTIONS:
- NEW/ONLY — "This is something you've NEVER seen before"
- EASY/ANYBODY — "ANYONE can do this, no skill needed"
- SAFE/PREDICTABLE — "This is PROVEN, low risk, guaranteed"
- BIG/FAST — "Get MASSIVE results in record time"

RULES:
- Drill AT LEAST 8 desire chains
- The hidden desire is the MOST valuable — dig for it
- Big 4 emotions: determine which 1-2 are strongest for THIS product
- Every angle must be copy-ready`;
      },
    },

    // --- WAVE 2: Depends on avatar-researcher ---
    {
      id: 'sub-avatar-builder',
      name: 'Sub-Avatar Architect',
      model: 'opus',
      dependsOn: ['avatar-researcher'],
      systemPrompt: (project) => `You are a customer segmentation expert using the EVOLVE Core 5 framework. You build sub-avatars that are hyper-specific segments of the target audience.

CRITICAL: Sub-avatars are built from DESIRES first, not demographics. Demographics come LAST.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs, peerOutputs) => `AVATAR RESEARCH:
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available — build from product description'}

PRODUCT: ${project.productDescription}

## EVOLVE CORE 5 FRAMEWORK — Build 5 Sub-Avatars

Category priority (use in this ORDER):
1. DESIRES — "I want/need X" statements. Surface-level for specificity. Check: "I want X..." works?
2. EXPERIENCES — Situational or Product-based. Check: describes event/circumstance? Emotion removed?
3. EMOTIONS — How they FEEL. Use primary emotions (Fear/Anger/Sadness/Joy/Surprise/Disgust). Check: "feels X about Y"?
4. BEHAVIORS & HABITS — What they DO. Check: describes an action? More frequent = stronger signal.
5. DEMOGRAPHICS — Static facts. Use LAST. Only if genuinely differentiating.

RULES:
- Start with DESIRE — what they want drives everything
- Each sub-avatar should combine 2-3 categories (e.g., desire + experience + emotion)
- More categories combined = more specific = more relatable
- NEVER combine more than one desire per sub-avatar
- Each sub-avatar should be clearly DIFFERENT from the others

Output valid JSON:
{
  "sub_avatars": [
    {
      "id": "sa-1",
      "name": "descriptive name",
      "nickname": "one-word handle",
      "construction": {
        "primary_desire": "the specific desire",
        "experience": "the situation they're in",
        "emotion": "how they feel about it",
        "behavior": "what they do about it",
        "demographic": "only if relevant"
      },
      "one_liner": "I'm the person who [desire] because [experience] and I feel [emotion]",
      "urgency_score": 1-10,
      "tam_estimate": "total addressable market size for this segment",
      "ev_score": "estimated value — urgency × TAM",
      "trigger_moment": "the specific moment that pushes them to act",
      "launch_order": 1-5,
      "primary_angle": { "name": "angle name", "description": "the reason they'd buy" },
      "secondary_angles": [{ "name": "", "description": "" }],
      "messaging_do": ["what works for this avatar"],
      "messaging_dont": ["what turns them off"]
    }
  ]
}

SCORING:
- urgency_score = pain SEVERITY × trigger FREQUENCY
- launch_order: Start with highest EV (urgency × TAM)`,
    },

    {
      id: 'voice-extractor',
      name: 'Voice Profile Extractor',
      model: 'sonnet',
      dependsOn: ['avatar-researcher'],
      systemPrompt: (project) => `You are a linguistic analyst specializing in audience voice profiling. You extract the authentic voice of an audience from their raw language.

TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (_project, _previousOutputs, peerOutputs) => `AVATAR RESEARCH (source of quotes):
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available'}

## VOICE EXTRACTION FRAMEWORK

From all the collected quotes and language, extract:

{
  "voice_profile": {
    "vocabulary": ["20-30 specific words/phrases they use repeatedly — NOT marketing terms"],
    "sentence_style": "short punchy OR longer flowing? Fragments? Questions? Exclamations? Give 3 example sentences.",
    "formality_level": 1-10,
    "formality_justification": "why this level — evidence from their language",
    "emotional_tone": "dominant emotional state: frustrated, hopeful, desperate, skeptical, resigned, etc.",
    "emotional_range": "do they swing between emotions or stay consistent?",
    "phrases_to_use": ["10+ phrases that sound natural to this audience"],
    "phrases_to_avoid": ["10+ phrases that would sound fake, corporate, or off-putting"],
    "sample_paragraph": "5 sentences about their problem written IN THEIR VOICE — must be indistinguishable from a real forum post",
    "cursing_level": "none/mild/moderate/heavy",
    "humor_style": "none/self-deprecating/sarcastic/dark/playful",
    "metaphors_they_use": ["metaphors/analogies they naturally reach for"]
  }
}

RULES:
- Vocabulary must be THEIR words, not ours
- Sample paragraph must pass the "could a real person have written this?" test
- Phrases to avoid: include corporate-speak, overly formal language, competitor jargon
- Be specific — "frustrated" is too vague. "frustrated-but-still-hoping" is better.`,
    },

    {
      id: 'language-miner',
      name: 'Customer Language Hook Miner',
      model: 'opus',
      dependsOn: ['avatar-researcher'],
      systemPrompt: (project) => `You are an elite hook writer and customer language specialist. You extract hook-ready phrases from raw customer language.

These mined phrases will become the FOUNDATION of all hooks, ads, and copy. Quality here = quality everywhere.

TARGET MARKET: ${project.targetMarket}`,

      userMessage: (_project, _previousOutputs, peerOutputs) => `AVATAR RESEARCH (source material):
${peerOutputs['avatar-researcher']?.slice(0, 6000) || 'Not available'}

## CUSTOMER LANGUAGE MINING — 7 Categories × 10 Examples

For each category, extract 10 hook-ready phrases:

{
  "customer_language_mining": {
    "micro_specific_moments": [
      "That thing where you [specific action] because [specific reason]",
      "When you [tiny visceral moment only someone with this problem knows]"
    ],
    "internal_dialogue": [
      "I'm starting to think...",
      "Maybe I'm just...",
      "What if I never..."
    ],
    "relationship_moments": [
      "My [person] said...",
      "I caught my [person] looking at me like...",
      "I stopped telling [person] about..."
    ],
    "humiliation_moments": [
      "The moment when...",
      "I had to pretend that...",
      "Nobody knew but I..."
    ],
    "failed_solution_language": [
      "I tried [X] and it...",
      "Everyone said [X] would help but...",
      "I wasted [money/time] on..."
    ],
    "transformation_language": [
      "I just want to be able to...",
      "I miss when I could...",
      "Imagine if I could just..."
    ],
    "trigger_phrases": [
      "My husband thought...",
      "I almost...",
      "They found out..."
    ]
  }
}

RULES:
- EXACTLY 10 per category = 70 total phrases
- Each phrase must be a COMPLETE hook-ready fragment
- They must sound like GOSSIP, DRAMA, or REAL LIFE — not marketing
- Micro-specific moments are the HARDEST and MOST VALUABLE — go deep
- Internal dialogue must feel like eavesdropping on someone's thoughts
- Trigger phrases must create instant curiosity`,
    },

    // --- WAVE 3: Depends on sub-avatar-builder ---
    {
      id: 'angle-extractor',
      name: 'Angle Identifier & Scorer',
      model: 'opus',
      dependsOn: ['sub-avatar-builder', 'desire-driller'],
      systemPrompt: (project) => `You are an angle identification specialist using the EVOLVE framework. You find specific REASONS TO BUY for each sub-avatar.

CRITICAL DISTINCTION:
- ANGLE = the specific REASON/MOTIVATION to buy (the WHY)
- CONCEPT = how you PRESENT the angle (the HOW — creative execution)
Angles are strategic. Concepts are tactical. You do ANGLES.

TARGET MARKET: ${project.targetMarket}`,

      userMessage: (_project, _previousOutputs, peerOutputs) => `SUB-AVATARS:
${peerOutputs['sub-avatar-builder']?.slice(0, 4000) || 'Not available'}

DESIRE RESEARCH:
${peerOutputs['desire-driller']?.slice(0, 3000) || 'Not available'}

## ANGLE IDENTIFICATION

For each sub-avatar, identify 3-5 unique angles.

Score each angle:
- EV (Emotional Value, 1-10): How emotionally charged is this reason to buy?
- MA (Market Awareness match, 1-10): Does this work for the market's awareness level?
- WS (Word Specificity, 1-10): How specific and vivid can we make this?
- TOTAL = EV × MA × WS (max 1000)

{
  "angle_candidates": [
    {
      "sub_avatar_id": "sa-1",
      "sub_avatar_name": "",
      "angles": [
        {
          "name": "angle name",
          "reason_to_buy": "the specific reason this avatar would buy",
          "emotional_lever": "what emotion drives this angle",
          "ev": 1-10,
          "ma": 1-10,
          "ws": 1-10,
          "total": 0-1000,
          "example_hook": "one hook that captures this angle",
          "concept_directions": ["2-3 ways to creatively present this angle"]
        }
      ]
    }
  ],
  "top_5_angles": [
    { "rank": 1, "angle_name": "", "sub_avatar": "", "total_score": 0, "why_top": "" }
  ]
}

RULES:
- Angles must be SPECIFIC reasons to buy, not vague benefits
- Each sub-avatar must have at least 3 angles
- Top 5 angles should span at least 3 different sub-avatars
- Example hooks must be punchy and immediately compelling`,
    },
  ],

  // --- LEAD AGENT ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `You are a customer research strategist. Produce a complete avatar deep dive for: ${project.name}`;
    }
    return `You are the Lead Customer Strategist at a $100M/year direct response agency. Your team of 6 specialists has completed their analyses. COMPILE their work into a unified Avatar Intelligence Dossier.

RULES:
1. Integrate ALL specialist work — nothing gets dropped
2. Build the definitive quote bank from all research
3. Cross-reference sub-avatars with desire research — any conflicts?
4. Rank angles by total score
5. Ensure voice profile matches the actual customer language mined`;
  },

  userMessage: (project, _previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `Product: ${project.productDescription}\nProduce the complete avatar dossier.`;
    }
    return `Compile these specialist reports into the unified dossier.

=== AVATAR DEEP DIVE (17 categories) ===
${subAgentOutputs['avatar-researcher']?.slice(0, 5000) || 'N/A'}

=== DESIRE RESEARCH ===
${subAgentOutputs['desire-driller'] || 'N/A'}

=== SUB-AVATARS (Core 5) ===
${subAgentOutputs['sub-avatar-builder'] || 'N/A'}

=== VOICE PROFILE ===
${subAgentOutputs['voice-extractor'] || 'N/A'}

=== CUSTOMER LANGUAGE MINING (70 phrases) ===
${subAgentOutputs['language-miner'] || 'N/A'}

=== ANGLE CANDIDATES (scored) ===
${subAgentOutputs['angle-extractor'] || 'N/A'}

Output unified JSON wrapped in \`\`\`json code blocks:
{
  "avatar_deep_dive": { ... 17 categories ... },
  "desire_research": { ... },
  "sub_avatars": [ ... 5 sub-avatars ... ],
  "voice_profile": { ... },
  "customer_language_mining": { ... 7 categories × 10 ... },
  "angle_candidates": [ ... per sub-avatar ... ],
  "top_angles": [ ... top 5 ranked ... ],
  "quote_bank": {
    "pain_quotes": [{ "quote": "", "source": "", "emotion": "", "sub_avatar_id": "" }],
    "desire_quotes": [{ "quote": "", "source": "", "depth": "" }],
    "objection_quotes": [{ "quote": "", "handler": "" }],
    "transformation_quotes": [{ "quote": "", "context": "" }]
  },
  "patterns_identified": ["cross-cutting patterns from all research"],
  "strategic_recommendations": "what all this means for our campaign"
}`;
  },

  reviewerPrompt: `You are an expert customer research reviewer. Score with brutal honesty. Focus on authenticity and depth.

DIMENSIONS (each /10, total /100, threshold ≥72%):
1. 17 Categories Completeness: All addressed with multiple authentic entries?
2. Verbatim Authenticity: Quotes sound like real people? Specific details?
3. Sub-Avatar Differentiation: 5 clearly different segments? Built from desires, not demographics?
4. Voice Profile Specificity: Could a copywriter write in this voice immediately?
5. Customer Language Quality: 70 phrases that are hook-ready? Micro-specific moments vivid?
6. Desire Depth: Drilling goes to core identity/emotional level? Not surface?
7. Angle Scoring: EV × MA × WS scores justified? Top 5 span multiple avatars?
8. Quote Bank Richness: Sufficient quotes across pain, desire, objection, transformation?
9. Cross-Reference Quality: Sub-avatars match desires? Voice matches language?
10. Actionability: Can Gate 3 and Gate 4 use this directly?

Respond in valid JSON with score, maxScore (100), dimensions, feedback, passed.`,

  reviewCriteria: `Score each dimension /10. Authenticity is #1 priority — fake-sounding research = instant fail. Total /100, pass ≥ 72%.`,

  reviewThreshold: 72,
  hasCongruenceCheck: false,
};

export default gate2;
