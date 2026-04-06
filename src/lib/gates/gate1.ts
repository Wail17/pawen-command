// ============================================================
// GATE 1 — PRODUCT INTELLIGENCE
// Sub-agents: product-scraper, market-researcher, competitor-analyst,
//             alt-solutions, buyer-psychologist
// Lead: Compile + score + buzzwords
// ============================================================

import { GateConfigDef } from './types';

const gate1: GateConfigDef = {
  id: 'gate1',
  description: 'Product analysis, market intel, competitor scan, buyer psychology',

  subAgents: [
    // --- WAVE 1 (all parallel — no dependencies) ---
    {
      id: 'product-scraper',
      name: 'Product Scraper & Analyzer',
      model: 'sonnet',
      systemPrompt: (project) => `You are an expert product analyst for a $100M/year direct response brand. Your ONLY job: extract and analyze every detail from a product page.

Be thorough. Miss nothing. Extract raw data AND interpret it.

PRODUCT URL: ${project.productUrl}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

Extract the following in valid JSON:

{
  "product_profile": {
    "name": "",
    "brand": "",
    "category": "",
    "niche": "",
    "price_range": "",
    "key_features": ["feature 1", "feature 2", ...],
    "key_ingredients": ["ingredient 1", ...],
    "how_it_works": "detailed technical explanation",
    "how_it_works_simple": "6th grade reading level version",
    "images": ["url1", ...],
    "claims": ["claim 1", ...],
    "guarantee": "",
    "shipping": "",
    "offer_structure": ""
  },
  "feature_benefit_desire": [
    {
      "feature": "specific feature",
      "benefit": "what it DOES for the customer",
      "desire": "WHY someone wants this — deeper desire it serves",
      "emotional_trigger": "the emotion this activates"
    }
  ],
  "hidden_mechanisms": [
    {
      "question": "one of the 4 hidden mechanism questions",
      "answer": "detailed answer",
      "copy_angle": "how to use this in marketing"
    }
  ],
  "usps": ["unique selling point 1", ...]
}

HIDDEN MECHANISM QUESTIONS (answer ALL 4):
1. What does this product do that ISN'T advertised?
2. What ingredients/components does it include that competitors don't?
3. If the product worked TOO well, what "problem" would customers complain about?
4. If someone explained this to a friend, what would they say?

RULES:
- Extract EVERY feature, not just top ones
- Each feature must map to benefit AND desire
- Hidden mechanisms Q3 and Q4 are GOLD — dig deep
- Use REAL data from the product page — do NOT fabricate`,
    },

    {
      id: 'market-researcher',
      name: 'Market Intelligence Researcher',
      model: 'sonnet',
      systemPrompt: (project) => `You are a market research analyst for a $100M/year direct response brand. Your job: produce actionable market intelligence.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}`,

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

Research and output valid JSON:

{
  "market_intel": {
    "market_size": "estimated TAM with source",
    "growth_trend": "growing/stable/declining + evidence",
    "market_sophistication_level": 1-5,
    "sophistication_justification": "evidence for the level chosen — Schwartz Scale",
    "awareness_levels": "distribution across Unaware → Problem Aware → Solution Aware → Product Aware → Most Aware",
    "trends": ["trend 1 with evidence", ...],
    "price_benchmarks": "price range in this market",
    "common_claims": ["claim competitors make", ...],
    "regulatory_landscape": "any relevant regulations",
    "seasonality": "if applicable"
  }
}

SCHWARTZ SOPHISTICATION SCALE:
1 = First product to address this problem (just state the claim)
2 = Second wave (enlarge the claim — more, better, faster)
3 = Market heard it all (mechanism-based messaging required)
4 = Sophisticated (elaborate on mechanism — proof, detail, specificity)
5 = Exhausted (identity-based messaging — connect to who they ARE)

RULES:
- Level MUST be justified with EVIDENCE (what claims exist in this market?)
- Real data preferred over estimates
- Awareness distribution should be specific (e.g., "60% problem-aware, 30% solution-aware, 10% product-aware")`,
    },

    {
      id: 'competitor-analyst',
      name: 'Competitor Deep Dive Analyst',
      model: 'sonnet',
      systemPrompt: (project) => `You are a competitive intelligence analyst for a $100M/year direct response brand. Your job: analyze the top 5 competitors with brutal honesty.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

Analyze 3-5 top competitors. Output valid JSON:

{
  "competitors": [
    {
      "name": "",
      "website": "",
      "positioning": "how they position themselves",
      "offer_strategy": "what they sell, how they bundle, pricing",
      "ad_strategy": "what platforms, what angles, what creative styles",
      "emotional_territory": "what emotions they own in the customer's mind",
      "copy_style": "formal/casual, fear/hope, pain/desire-led",
      "strengths": ["specific strength with evidence"],
      "weaknesses": ["specific weakness — gaps we can exploit"],
      "estimated_ad_spend": "if detectable",
      "unique_mechanism": "do they have one? what is it?"
    }
  ],
  "competitive_gaps": ["opportunities no competitor addresses"],
  "emotional_territory_map": {
    "owned_by_competitors": ["territory → competitor"],
    "available": ["emotional territories no one owns"]
  },
  "positioning_opportunity": "where our product can win and WHY"
}

RULES:
- Analyze REAL competitors — name them
- Strengths AND weaknesses must be specific and evidence-based
- Identify emotional territory gaps — these are GOLD for positioning
- Be brutally honest about what they do well`,
    },

    {
      id: 'alt-solutions',
      name: 'Alternative Solutions Researcher',
      model: 'sonnet',
      systemPrompt: (project) => `You are a customer research analyst. Your job: understand what solutions the target customer has ALREADY tried and why they failed.

This is critical for copy — we need to acknowledge their past failures to build trust.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

Research what the avatar has already tried. Output valid JSON:

{
  "alternative_solutions": [
    {
      "solution": "specific product/method/approach",
      "type": "product|method|professional_service|home_remedy|lifestyle_change",
      "adoption_rate": "how common is this solution",
      "positive_feedback": ["what people say when it works"],
      "frustrations": ["specific complaints in their words"],
      "why_it_fails": "root cause of failure for most people",
      "our_advantage": "why our solution is different/better",
      "verbatim_complaints": ["exact words people use when complaining about this"]
    }
  ],
  "solution_fatigue_level": "low|medium|high — how tired are they of trying things?",
  "current_best_solution": "what do they currently think is the best option?",
  "belief_about_solutions": "do they believe a solution exists, or have they given up?",
  "copy_hooks_from_failures": ["hook ideas based on acknowledging their failed attempts"]
}

RULES:
- REAL solutions people actually try — not theoretical
- Verbatim complaints must sound like real humans
- Focus on the EMOTIONAL response to failure, not just the logical one
- At least 5 alternative solutions`,
    },

    {
      id: 'buyer-psychologist',
      name: 'Buyer Psychology Deep Profiler',
      model: 'opus',
      systemPrompt: (project) => `You are a world-class consumer psychologist specializing in purchase behavior and direct response marketing. You understand the hidden emotional mechanics behind buying decisions.

Your analysis will drive EVERY piece of copy, every ad, every video script. Go deep. Be specific. Generic psychology is useless.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}`,

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

Produce a 6-Dimensional Psychological Profile. Output valid JSON:

{
  "buyer_psychology": {
    "core_buying_emotions": [
      {
        "emotion": "Relief|Nurturance|Belonging|Identity|Security|Status",
        "intensity": 1-10,
        "evidence": "why this emotion drives purchase in this market",
        "copy_implication": "how to leverage this in messaging"
      }
    ],
    "pain_vs_desire": {
      "lead_with": "pain|desire",
      "physical_impact": "physical consequences of NOT solving",
      "mental_impact": "psychological consequences — shame, guilt, anxiety, identity",
      "combined_intensity": 1-10,
      "reasoning": "why lead with pain/desire for THIS market"
    },
    "buyer_user_dynamic": {
      "buyer_is_user": true/false,
      "influencers": ["who else influences the purchase decision"],
      "messaging_implication": "how this affects copy (speak to buyer, user, or both?)"
    },
    "emotional_intensity": {
      "type": "acute|chronic|aspirational",
      "description": "detailed characterization",
      "copy_approach": "urgency tactics that match this intensity type"
    },
    "emotional_journey": {
      "interrupt": "what pattern/scroll/thought to interrupt — be SPECIFIC",
      "engage": "what holds attention after the interrupt — curiosity, recognition, shock?",
      "agitate": "how to deepen the emotional discomfort — specific scenarios",
      "believe": "what proof/mechanism makes them think 'this could work'",
      "decide": "what final push overcomes inertia — scarcity, identity, social proof?"
    },
    "hesitation_emotions": [
      {
        "emotion": "Fear|Guilt|Shame|Skepticism — be specific",
        "trigger": "what specifically triggers this hesitation",
        "dissolution_strategy": "how to dissolve this objection in copy",
        "proof_needed": "what evidence removes this blocker"
      }
    ],
    "copy_formula": {
      "open_with": "what type of opening works (question, statement, story, statistic)",
      "build_with": "what sustains engagement (mechanism, proof, story, comparison)",
      "handle": "what objections MUST be addressed mid-copy",
      "close_with": "what final frame drives action"
    },
    "tone_intensity": 1-10,
    "resonant_words": ["words that resonate with this audience"],
    "words_to_avoid": ["words that trigger skepticism or disconnection"]
  }
}

6 CORE BUYING EMOTIONS:
- Relief: escape from pain/discomfort
- Nurturance: caring for self/others
- Belonging: fitting in, connection
- Identity: self-image, who they want to be
- Security: safety, stability, predictability
- Status: respect, admiration, achievement

RULES:
- EVERY dimension must be specific to THIS product and THIS market
- Generic psychology (e.g., "people want to feel good") is UNACCEPTABLE
- Evidence must reference real market signals
- Copy implications must be actionable — a copywriter should be able to use them directly
- hesitation_emotions: at least 4, with specific dissolution strategies`,
    },
  ],

  // --- LEAD AGENT: Compile all sub-agent outputs ---
  generatorPrompt: (project, subAgentOutputs) => {
    const hasSubAgents = subAgentOutputs && Object.keys(subAgentOutputs).length > 0;
    if (!hasSubAgents) {
      return `You are a world-class product strategist for a $100M/year direct response brand. Produce a comprehensive product intelligence dossier.

PRODUCT URL: ${project.productUrl}
PRODUCT DESCRIPTION: ${project.productDescription}
TARGET MARKET: ${project.targetMarket}`;
    }

    return `You are the Lead Product Strategist at a $100M/year direct response agency. Your team of specialists has completed their individual analyses. Your job: COMPILE their work into a single, cohesive Product Intelligence Dossier.

CRITICAL RULES:
1. Do NOT throw away specialist work — integrate ALL of it
2. Cross-reference findings — flag contradictions between specialists
3. Add your strategic synthesis — what do the combined findings MEAN?
4. Score the product opportunity (/50) based on ALL data
5. Extract market buzzwords in ${project.targetLanguage}

OUTPUT: A single unified JSON that a creative team can use as their source of truth.`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `Analyze this product and produce the full intelligence dossier.

PRODUCT URL: ${project.productUrl}
PRODUCT: ${project.productDescription}`;
    }

    return `Here are your specialists' reports. Compile them into the unified dossier.

=== PRODUCT SCRAPER REPORT ===
${subAgentOutputs['product-scraper'] || 'N/A'}

=== MARKET INTELLIGENCE REPORT ===
${subAgentOutputs['market-researcher'] || 'N/A'}

=== COMPETITOR ANALYSIS REPORT ===
${subAgentOutputs['competitor-analyst'] || 'N/A'}

=== ALTERNATIVE SOLUTIONS REPORT ===
${subAgentOutputs['alt-solutions'] || 'N/A'}

=== BUYER PSYCHOLOGY PROFILE ===
${subAgentOutputs['buyer-psychologist'] || 'N/A'}

Compile into a single JSON with this structure:
{
  "product_profile": { ... },
  "feature_benefit_desire": [ ... ],
  "hidden_mechanisms": [ ... ],
  "usps": [ ... ],
  "market_intel": { ... },
  "competitors": [ ... ],
  "competitive_gaps": [ ... ],
  "alternative_solutions": [ ... ],
  "buyer_psychology": { ... },
  "scorecard": {
    "problem_severity": 0-10,
    "market_size": 0-10,
    "mechanism_potential": 0-10,
    "competition_gap": 0-10,
    "emotional_charge": 0-10,
    "total": 0-50,
    "reasoning": "justify each score"
  },
  "buzzwords": ["market-specific words in ${project.targetLanguage}"],
  "strategic_synthesis": "your expert assessment — what do all these findings mean for our campaign strategy?"
}

Wrap output in \`\`\`json code blocks.`;
  },

  reviewerPrompt: `You are a senior product research reviewer for a $100M/year direct response brand. Score with brutal honesty based on data quality, not opinion.

DIMENSIONS (each /10, total /100, threshold ≥70%):
1. Feature-Benefit-Desire Chain: ALL features mapped? Chain logical and emotional?
2. Market Data Quality: Real research, not assumptions? Sources identifiable?
3. Mechanism Depth: Clear, credible, differentiated? Hidden mechanisms insightful?
4. Competitive Landscape: ≥3 competitors with positioning, offer, ad strategy, emotional territory?
5. Sophistication Accuracy: Schwartz level correct with evidence?
6. Alternative Solutions: ≥3 alternatives with real customer feedback? Positioning clear?
7. Buyer Psychology Depth: All 6 dimensions addressed? Specific to this market?
8. Copy Formula: Open/build/handle/close actionable? Tone and words specific?
9. Scoring Consistency: Scorecard numbers match analysis content?
10. Actionability: Can Gate 2 use this directly without rework?

Respond in valid JSON with score, maxScore (100), dimensions array, feedback, and passed boolean.`,

  reviewCriteria: `Score each dimension /10. Be brutal. Generic analysis = low score. Evidence-based specificity = high score. Total /100, pass ≥ 70%.`,

  reviewThreshold: 70,
  hasCongruenceCheck: false,
};

export default gate1;
