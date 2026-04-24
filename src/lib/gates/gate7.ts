// ============================================================
// GATE 7 — STATIC AD STUDIO (Dual-Track: ZAK + EVOLVE)
//
// 5 sub-agents in 3 waves — TWO independent creative tracks:
//
//   Wave 1: angle-scorer (EVOLVE Angle Identifier) +
//           visual-inspiration-extractor (ZAK Visual Inspiration)
//
//   Wave 2 — DUAL TRACK (parallel, both depend on Wave 1):
//     Track ZAK:    zak-headline-creator (psychological headlines per angle)
//     Track EVOLVE: evolve-static-creator (11 world-class ad templates → 9+ concepts)
//
//   Wave 3: brief-writer (merges BOTH tracks → 24 execution-ready briefs)
//
// Lead: Compiles into StaticAdStudio-compatible 8-preset format
// ============================================================

import { GateConfigDef } from './types';
import { buildCreativeContext, serializeCreativeContext } from './creativeContextAggregator';
import { EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { ZAK_IMAGE_AD_FRAMEWORK } from './zakFrameworks';
import type { Project } from '../types';

// ── Serialize user-uploaded reference ads for prompt injection ──
function buildReferenceAdsBlock(project: Project): string {
  const ads = project.referenceAds;
  if (!ads || ads.length === 0) return '';

  return `
=== YOUR WINNING ADS (uploaded by the user — these are PROVEN performers) ===
The user uploaded ${ads.length} of their own winning static ads. Study each one and draw inspiration from their patterns. These are HIGHER priority than the 11 generic templates because they are PROVEN in this specific niche/market.

${ads.map((ad, i) => `--- Winning Ad #${i + 1} ---
Headline: "${ad.headline}"
Visual: ${ad.visual_description}
Layout: ${ad.layout_structure}
Colors: ${ad.color_palette.join(', ')}
Mood: ${ad.mood}
Format: ${ad.format_type}
Pattern: ${ad.pattern_name}
Emotion: ${ad.target_emotion}
Why it works: ${ad.why_it_works}
Copy elements: ${ad.copywriting_elements}
`).join('\n')}
=== END YOUR WINNING ADS ===
IMPORTANT: These are the user's OWN proven ads. Prioritize drawing from these patterns alongside the 11 EVOLVE templates. If a pattern from a winning ad conflicts with a generic template, prefer the winning ad pattern — it's already proven in this market.
`;
}

// ── Condensed EVOLVE example ads (from $100k Static Ads prompt) ──
// These 11 world-class ads serve as CREATIVE TEMPLATES — patterns to draw from.
const EVOLVE_EXAMPLE_ADS = `
=== 11 WORLD-CLASS STATIC AD TEMPLATES (EVOLVE) ===
Study these patterns. Each one won millions in ad spend. Use them as creative templates.

1. RYANAIR "Pizza vs Pisa" — COMPARISON PATTERN
   Headline: "The world's cheapest airline."
   Visual: Two identical pizza boxes side by side. Left: pizza $19.99. Right: Leaning Tower of Pisa drawing $19.99. "vs." in center. Bold blue background.
   WHY IT WORKS: Unexpected price comparison. Humor + shock value. Makes abstract (cheap flights) concrete (same price as pizza).

2. TESLA "3.1 seconds" — SPECIFICITY + DUAL MEANING PATTERN
   Headline: "It takes 3.1 seconds to read this ad."
   Visual: Minimalist white background. Black text top. Blurred Tesla Model S in motion center. "Same time it takes a Model S to go 0-60."
   WHY IT WORKS: Self-referential hook creates curiosity. Specific number (3.1, not 3). The ad IS the proof.

3. NUTELLA "Bread → Breakfast" — TRANSFORMATION PATTERN
   Headline: "This is bread. This is breakfast."
   Visual: Two toasts side by side. Left: plain toast = "bread." Right: toast + Nutella heart = "breakfast." White background.
   WHY IT WORKS: Simple A→B transformation. Shows product as the catalyst. Heart shape = emotional connection.

4. PATRÓN "Shots" — WORDPLAY PATTERN
   Headline: "You miss 100% of the shots you don't take."
   Visual: Premium bottle + shot glass + lime on white background. Double meaning: tequila shots + life opportunities.
   WHY IT WORKS: Hijacks famous quote. Double entendre. Premium product photography elevates humor.

5. BIBLE APP "Zero Stars" — SUBVERSION PATTERN
   Headline: "Zero stars. Would not recommend. — Satan"
   Visual: Black background. 5 empty stars. Review format. Subway ad placement.
   WHY IT WORKS: Borrows review format everyone recognizes. Unexpected reviewer. Humor disarms resistance.

6. CHIPOTLE "Roll" — INNUENDO PATTERN
   Headline: "Usually, when you roll something this good, it's illegal."
   Visual: Foil-wrapped burrito on white background. Hand-drawn font. Minimal design.
   WHY IT WORKS: Edgy wordplay grabs attention. Product IS the visual. Casual font = approachable brand.

7. CORONA "Lime" — PUN + LIFESTYLE PATTERN
   Headline: "Good things take lime."
   Visual: Corona bottle with lime on beach wooden surface. Blue sky + ocean background. Aspirational setting.
   WHY IT WORKS: Pun on "take time." Product feature (lime) IS the wordplay. Scene sells the lifestyle.

8. EVERCOOL "Stay Cool" — PROBLEM/SOLUTION PATTERN
   Headline: "Need better way to stay cool?"
   Visual: Woman sleeping on kitchen floor next to open fridge. Product (cooling comforter) in corner as the solution.
   WHY IT WORKS: Exaggerated problem = humor + relatability. Product as elegant alternative. Dark kitchen = mood lighting.

9. DAIHATSU "5x More" — ABSURD COMPARISON PATTERN
   Headline: "Picks up five times more women than a Lamborghini."
   Visual: Small van loaded with 6 laughing people. White background. Red brand banner.
   WHY IT WORKS: Turns weakness (small van) into strength. Humor from unexpected comparison. Social proof via group fun.

10. SURREAL "Dwayne Johnson" — FINE PRINT SUBVERSION PATTERN
    Headline: "We're Dwayne Johnson's favourite cereal."*
    Fine print: *"Dwayne is a bus driver from London."
    Visual: Billboard. Salmon-pink background. Cereal box + overflowing bowl.
    WHY IT WORKS: Celebrity association → subverted by fine print. Memorable, shareable. Anti-corporate humor.

11. HUEL "Bowls" — IDIOM HIJACK PATTERN
    Headline: "Grab life by the bowls."
    Visual: 5 colorful meal bowls on black background. Steam rising. Benefits called out around bowls (vegan, 27 vitamins, 25g protein, ready in 5 min).
    WHY IT WORKS: Wordplay on "grab life by the horns." Food photography sells appetite. Benefits surround the visual.

=== USE THESE AS TEMPLATES ===
For each ad you create, reference WHICH example pattern you drew from and WHY it fits this product/avatar.
`;

const gate7: GateConfigDef = {
  id: 'gate7',
  description: 'Static Ad Studio — Dual-track creative: ZAK psychological headlines + EVOLVE $100k static ads (3 waves, 5 sub-agents)',

  subAgents: [
    // ═══════════════════════════════════════════
    // WAVE 1: Foundation (parallel)
    // ═══════════════════════════════════════════

    // --- 1A: EVOLVE Angle Identifier ---
    {
      id: 'angle-scorer',
      name: 'Angle Identifier & Scorer (EVOLVE Framework)',
      model: 'sonnet',
      temperature: 0.7,
      maxTokens: 16000,

      systemPrompt: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `You are a direct response marketing strategist specializing in customer avatar analysis and angle development. You identify the most compelling marketing angles based on deep customer psychology, using sub-avatar frameworks.

## EVOLVE ANGLE FRAMEWORK

CRITICAL DISTINCTION:
- CONCEPT = The big idea you're testing (internally focused: "I want to test Us vs Them")
- ANGLE = How you choose to sell the product (externally focused: the customer's REASON TO BUY)
- HOOK/HEADLINE = How you communicate the angle (the words that grab attention)

If the concept doesn't give the customer a reason to buy, it's NOT an angle yet.

BAD "angles" (these are concepts, not angles):
- "Us vs Them" → Comparing WHAT? The "what" is the angle
- "Before & After" → Transformation of WHAT? The "what" is the angle
- "Problem-Aware Ads" → Of WHAT problem? The "what" is the angle

GOOD angles (give a reason to buy):
- "Stops tossing and turning" → solves their problem = angle
- "Brings back your energy" → gives a benefit = angle
- "14+ Hours. No Swelling" → specific outcome = angle

Angles exist on a SPECTRUM: broad ("Want better sleep?") → specific ("I flushed 19 pounds of hormonal weight"). More specific = more powerful.

The KEY: Extract angles from sub-avatars. Keep them ACTIONABLE.

## HOOK RULES (for each angle)
- Hooks should be DIRECT (not indirect) — directly communicate the angle
- Format: Angle → Hook that communicates it clearly
- Examples:
  • Angle: Stops swelling → Hook: "14+ Hours. No Swelling"
  • Angle: Keeps you full like a meal → Hook: "This is a meal. Not a protein shake"
  • Angle: Stops you from snapping → Hook: "5 minutes to install. No more snapping"

## AWARENESS: ${ctx.funnel.label}
${ctx.funnel.strategy}

## MECHANISM: "${ctx.brand.mechanism_name}"
Root cause: ${ctx.root_cause?.one_sentence || 'N/A'}

OUTPUT: Return ONLY valid JSON.`;
      },

      userMessage: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `## SUB-AVATAR DATA
Name: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname})
Category: ${ctx.sub_avatar.dominant_category}
Surface desire: ${ctx.sub_avatar.surface_desire}
Urgency: ${ctx.sub_avatar.urgency_score}/10

### Verbatim quotes
${ctx.sub_avatar.verbatim_quotes.slice(0, 15).map(q => `• "${q}"`).join('\n')}

### Emotional triggers
${ctx.sub_avatar.emotional_triggers.map(t => `• ${t}`).join('\n')}

### Past attempts
${ctx.sub_avatar.past_attempts.map(a => `• ${a}`).join('\n')}

### Sub-avatar hooks from research
${ctx.sub_avatar.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### Top scored hooks (Gate 4)
${(ctx.top_hooks || []).map((h, i) => `${i + 1}. [${h.score}] "${h.hook}" (${h.formula})`).join('\n')}

### Ad concepts (Gate 6)
${(ctx.ad_concepts || []).map((c, i) => `${i + 1}. "${c.name}" — ${c.angle}`).join('\n')}

### Competitor intelligence
${ctx.competitor_insights ? `Overused: ${ctx.competitor_insights.overused_angles.join(', ')}
Gaps: ${ctx.competitor_insights.unexploited_gaps.join(', ')}` : 'N/A'}

## YOUR TASK
Analyze this sub-avatar and extract the STRONGEST marketing angles.

For each angle:
- Identify the specific pain point, desire, or behavior it addresses
- Frame it as a PROBLEM from the customer's perspective
- Convert into a compelling "reason to buy" statement
- Write 3 hooks/headlines that directly communicate the angle

Score each angle on:
- Emotional Voltage (EV, 1-10): how intensely does this tap a mass emotion?
- Mechanism Alignment (MA, 1-10): how naturally does it lead to "${ctx.brand.mechanism_name}"?
- White Space (WS, 1-10): how unused is it vs competitors?
- Total = EV × MA × WS

Output JSON:
{
  "angles": [
    {
      "id": "angle-1",
      "rank": 1,
      "angle_name": "short name (e.g. 'Stops tossing and turning')",
      "reason_to_buy": "why a customer should buy based on this angle (1-2 sentences)",
      "sub_avatar_source": "which pain/desire/behavior this came from",
      "hooks": [
        {
          "text": "6-8 word headline",
          "inspired_by": "which pattern this follows (e.g. 'specificity + outcome')",
          "why_it_stops_scroll": "1 sentence"
        }
      ],
      "ev": 0, "ma": 0, "ws": 0, "total": 0,
      "best_concept_types": ["before_after", "ugly_native", "comparison", "transformation", "meme", "product_photo", "infographic", "native_style", "quote_text", "ugc_image"]
    }
  ],
  "priority_recommendation": "which angle to test FIRST and why",
  "multi_angle_concept": "how to combine top 2-3 angles in a single ad concept (Marksman Method)"
}

RULES:
- Extract 7-10 angles total, ranked by EV×MA×WS score
- Top 5 must span at least 3 different emotions
- 3 hooks per angle, strongest first
- Hooks max 8 words, DIRECT (not indirect)
- Use CUSTOMER LANGUAGE from verbatims
- ALL in ${project.targetLanguage}`;
      },
    },

    // --- 1B: ZAK Visual Inspiration Extractor ---
    {
      id: 'visual-inspiration-extractor',
      name: 'Visual Inspiration Extractor (ZAK Pain & Hope Scenes)',
      model: 'sonnet',
      temperature: 0.7,
      maxTokens: 12000,

      systemPrompt: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `You are a visual strategist who extracts VISUAL SCENES from customer research. You turn raw emotions, pain points, and desires into concrete, photographable visual moments.

## ZAK VISUAL INSPIRATION FRAMEWORK
- PAIN & TRIGGER MOMENTS: the exact visual scenes where the customer FEELS the problem
- HOPE & TRANSFORMATION MOMENTS: the exact visual scenes where the customer imagines life AFTER

These scenes become the visual foundation for ALL image ad creatives.

## SUB-AVATAR
Name: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname})
Surface desire: ${ctx.sub_avatar.surface_desire}
Urgency: ${ctx.sub_avatar.urgency_score}/10

## VERBATIM QUOTES
${ctx.sub_avatar.verbatim_quotes.slice(0, 15).map(q => `• "${q}"`).join('\n')}

## EMOTIONAL TRIGGERS
${ctx.sub_avatar.emotional_triggers.map(t => `• ${t}`).join('\n')}

## PAST ATTEMPTS
${ctx.sub_avatar.past_attempts.map(a => `• ${a}`).join('\n')}

## ROOT CAUSE & MECHANISM
${ctx.root_cause ? `Root cause: ${ctx.root_cause.one_sentence}
Villain: ${ctx.root_cause.villain || 'N/A'}
Aha moment: ${ctx.root_cause.aha_moment || 'N/A'}` : 'N/A'}

${ctx.sub_avatar.hidden_fears ? `Hidden fears: ${ctx.sub_avatar.hidden_fears.join(', ')}` : ''}
${ctx.sub_avatar.contradictions ? `Contradictions: ${ctx.sub_avatar.contradictions.join(', ')}` : ''}

## AWARENESS: ${ctx.funnel.label}

OUTPUT: Return ONLY valid JSON.`;
      },

      userMessage: (project) => {
        return `Extract visual scenes from this customer's world. Think like a photographer who needs to capture their reality.

For this sub-avatar, extract:

1. **8-12 PAIN SCENES** — WHERE are they, WHAT are they doing, what EXPRESSION, what OBJECT symbolizes the pain
2. **8-12 HOPE SCENES** — WHERE are they after the solution, WHAT are they doing, what shows TRANSFORMATION
3. **5 CONTRAST PAIRS** — same person/setting in pain vs. hope

Output JSON:
{
  "pain_scenes": [
    {
      "id": "pain-1",
      "setting": "specific location",
      "action": "what they're doing",
      "emotion": "primary visible emotion",
      "visual_details": "objects, lighting, body language (50+ words)",
      "verbatim_link": "which customer quote inspired this",
      "photo_direction": "angle, lighting, mood for a photographer",
      "ad_format_fit": "before_after|problem_agitation|social_proof|us_vs_them|lifestyle|ugly_native|product_photo"
    }
  ],
  "hope_scenes": [
    {
      "id": "hope-1",
      "setting": "specific location",
      "action": "what they're doing",
      "emotion": "primary visible emotion",
      "visual_details": "objects, lighting, body language (50+ words)",
      "transformation_marker": "what visually PROVES the change",
      "photo_direction": "angle, lighting, mood",
      "ad_format_fit": "format this works best for"
    }
  ],
  "contrast_pairs": [
    {
      "id": "pair-1",
      "pain_scene_id": "pain-X",
      "hope_scene_id": "hope-X",
      "visual_bridge": "what stays CONSTANT (same person, same room) to make contrast hit",
      "headline_direction": "headline that ties these two together"
    }
  ]
}

RULES:
- Every scene specific enough for a photographer to recreate
- Scenes from RESEARCH (verbatims, triggers) not generic stock ideas
- Pain: dark/moody lighting, muted colors, isolated subjects
- Hope: warm/bright lighting, vibrant colors, connected subjects
- ALL in ${project.targetLanguage}`;
      },
    },

    // ═══════════════════════════════════════════
    // WAVE 2: DUAL CREATIVE TRACKS (parallel, depend on Wave 1)
    // ═══════════════════════════════════════════

    // --- 2A: ZAK Headline Creator (Track ZAK) ---
    {
      id: 'zak-headline-creator',
      name: 'Psychological Headline Creator (ZAK Image Ads)',
      model: 'opus',
      temperature: 0.85,
      maxTokens: 12000,
      dependsOn: ['angle-scorer', 'visual-inspiration-extractor'],

      systemPrompt: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `You are an elite headline writer for static image ads following the ZAK Image Ads methodology. Every headline is grounded in PSYCHOLOGY, not clever wordplay.

## ZAK HEADLINE RULES
1. Max 8 words — RUTHLESSLY cut filler
2. "3-second phone test" — readable at thumb-scrolling speed
3. Each headline has a PSYCHOLOGICAL REASON for stopping the scroll
4. LAW OF UNIQUE NUMBERS: 12 (not 10), 47 (not 50), 83.2% (not 80%). Irregular = believable.
5. SHOW don't TELL: "Go the whole day without a Monster" > "Feel more energized"
6. Use CUSTOMER LANGUAGE — their words, not marketing words
7. Specificity types: micro-moment, number, identity, contrast, question, metaphor, timeframe

## AWARENESS: ${ctx.funnel.label}
${ctx.funnel.strategy}

## VOICE
- Tone: ${ctx.brand.emotional_tone} | Formality: ${ctx.brand.formality}/10
- USE: ${ctx.brand.phrases_to_use.slice(0, 12).join(', ')}
- NEVER: ${ctx.brand.phrases_to_avoid.slice(0, 10).join(', ')}

## CUSTOMER LANGUAGE
${ctx.sub_avatar.verbatim_quotes.slice(0, 10).map(q => `• "${q}"`).join('\n')}
${ctx.swipe ? `Power words: ${ctx.swipe.power_words.slice(0, 15).join(', ')}
Identity phrases: ${ctx.swipe.identity_phrases.slice(0, 8).join(', ')}` : ''}

## PRODUCT
Name: ${ctx.product.name} | Mechanism: "${ctx.brand.mechanism_name}"
Root cause: ${ctx.root_cause?.one_sentence || 'N/A'}

${buildReferenceAdsBlock(project)}

OUTPUT: Return ONLY valid JSON.`;
      },

      userMessage: (_project, _previousOutputs, peerOutputs) => {
        return `## WINNING ANGLES (from EVOLVE Angle Identifier — Wave 1)
${peerOutputs['angle-scorer'] || 'N/A'}

## VISUAL INSPIRATION SCENES (from ZAK Visual Extractor — Wave 1)
${peerOutputs['visual-inspiration-extractor'] || 'N/A'}

## YOUR TASK (Track ZAK)
Create 8 headlines PER top-5 winning angle = 40 headlines total.

Each headline:
- Psychological trigger explaining WHY it stops the scroll
- Which visual scene (pain/hope) it pairs with
- Specificity type used
- Score: Curiosity / Clarity / Emotional Punch (each 1-10)

Output JSON:
{
  "headline_sets": [
    {
      "angle_id": "angle-X",
      "angle_name": "name",
      "headlines": [
        {
          "id": "h-X-1",
          "text": "max 8 words",
          "psychological_trigger": "why this stops the scroll",
          "specificity_type": "micro-moment|number|identity|contrast|question|metaphor|timeframe",
          "pairs_with_scene": "pain-X or hope-X",
          "score": { "curiosity": 0, "clarity": 0, "punch": 0, "total": 0 }
        }
      ],
      "best_3": ["h-X-1", "h-X-3", "h-X-7"]
    }
  ],
  "cross_angle_top_10": [
    { "id": "h-X-Y", "text": "headline", "angle": "name", "why": "1 sentence" }
  ]
}

RULES:
- 8 headlines × 5 angles = 40 total
- Max 8 words per headline
- At least 2 per angle use CUSTOMER LANGUAGE (verbatim words)
- At least 1 per angle uses a UNIQUE NUMBER
- Pair every headline with a visual scene
- ALL in the target language`;
      },
    },

    // --- 2B: EVOLVE Static Ad Creator (Track EVOLVE) ---
    {
      id: 'evolve-static-creator',
      name: 'Static Ad Creator (EVOLVE $100k Prompt — 11 Templates)',
      model: 'opus',
      temperature: 0.85,
      maxTokens: 14000,
      dependsOn: ['angle-scorer', 'visual-inspiration-extractor'],

      systemPrompt: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `You are going to help create winning Facebook & Instagram image ads. A winning image ad is a bold, scroll-stopping image with a powerful headline that allows the company to acquire NEW CUSTOMERS profitably.

These ads are for attracting NEW CUSTOMERS who have NEVER heard of this brand and do NOT care who we are. They only care about themselves. The ad must appeal to THEM and show we understand THEM.

${EVOLVE_EXAMPLE_ADS}

## EVOLVE STATIC AD FORMAT TYPES
Pick the right format for each concept:
1. **Static Graphic/Design** — bold headline on branded background with product visual
2. **Product Photography + Headline** — clean product photo (white/lifestyle bg) + headline
3. **Infographic** — charts, step-by-step process, data visualization
4. **Native-Style** — looks organic/unbranded, mimics social media post (DO NOT fake press releases)
5. **Quote/Text-Heavy** — mostly text, quote-style layouts, text IS the visual
6. **Collage** — multiple images combined, grid layout, shows multiple uses
7. **UGC Image** — real customer photos/selfies, authentic unpolished look
8. **Meme-Style** — popular meme templates with custom text, recognizable format

## PRODUCT CONTEXT
Name: ${ctx.product.name}
${ctx.product.description ? `Description: ${ctx.product.description}` : ''}
${ctx.product.price ? `Price: ${ctx.product.price} ${ctx.product.currency || ''}` : ''}
Mechanism: "${ctx.brand.mechanism_name}"
Product descriptor: "${ctx.brand.product_descriptor}"
${ctx.product.features ? `Features: ${ctx.product.features.join(', ')}` : ''}

## SUB-AVATAR
Name: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname})
Surface desire: ${ctx.sub_avatar.surface_desire}
Demographics: ${ctx.sub_avatar.demographics.join(', ')}

## BRAND VOICE
Tone: ${ctx.brand.emotional_tone} | Formality: ${ctx.brand.formality}/10
USE: ${ctx.brand.phrases_to_use.slice(0, 10).join(', ')}
NEVER: ${ctx.brand.phrases_to_avoid.slice(0, 10).join(', ')}
Colors: Problem=${ctx.brand.color_problem} | Solution=${ctx.brand.color_solution} | Brand=${ctx.brand.color_brand}

## AWARENESS: ${ctx.funnel.label}

${buildReferenceAdsBlock(project)}

OUTPUT: Return ONLY valid JSON.`;
      },

      userMessage: (_project, _previousOutputs, peerOutputs) => {
        return `## WINNING ANGLES (from EVOLVE Angle Identifier — Wave 1)
${peerOutputs['angle-scorer'] || 'N/A'}

## VISUAL INSPIRATION SCENES (from ZAK Visual Extractor — Wave 1)
${peerOutputs['visual-inspiration-extractor'] || 'N/A'}

## YOUR TASK (Track EVOLVE)
Using the 11 world-class example ads AND your own winning ads (if provided) as CREATIVE TEMPLATES, create 9 ad concepts for the top winning angles.

For each ad concept:
1. State the ANGLE it serves
2. Write the core HEADLINE (6-8 words max, scroll-stopping)
3. Reference WHICH example ad pattern you drew from (e.g. "Nutella transformation pattern") and explain how it works for THIS product/avatar
4. Explain WHY this headline stops our target avatar's scroll
5. Provide 2 ALTERNATIVE headline iterations
6. Write the full IMAGE AD DESCRIPTION — a vivid, detailed description of what the ad looks like (background, layout, visual elements, text placement, product, tone). Specific enough for an editor to build it.
7. Assign a FORMAT TYPE from the 8 EVOLVE formats
8. Assign a PRESET CATEGORY (for StaticAdStudio compatibility)

Output JSON:
{
  "evolve_ads": [
    {
      "id": "evolve-1",
      "angle_id": "angle-X",
      "angle_name": "angle name",
      "core_headline": "6-8 words — the main headline",
      "headline_iterations": ["iteration A", "iteration B"],
      "template_reference": {
        "example_ad": "which of the 11 examples inspired this (e.g. 'Nutella Transformation')",
        "pattern_used": "comparison|specificity|transformation|wordplay|subversion|innuendo|pun_lifestyle|problem_solution|absurd_comparison|fine_print|idiom_hijack",
        "how_it_applies": "1-2 sentences on why this pattern works for THIS product and avatar"
      },
      "why_it_stops_scroll": "1-2 sentences — the psychological reason",
      "image_ad_description": {
        "background": "background color/setting/scene (detailed)",
        "layout": "how elements are arranged (symmetry, split, centered, etc.)",
        "main_visual": "the PRIMARY visual element — what the viewer sees first (80+ words, vivid and specific)",
        "text_elements": {
          "headline_placement": "where and how the headline appears",
          "headline_style": "font style, size, color, weight",
          "subtext": "any supporting text and where it appears",
          "cta": "call-to-action text and placement (if any)"
        },
        "product_integration": "how the product appears in the ad (if at all)",
        "tone_and_mood": "overall feeling the ad creates",
        "color_palette": ["#hex1", "#hex2", "#hex3"]
      },
      "format_type": "static_graphic|product_photo|infographic|native_style|quote_text|collage|ugc_image|meme_style",
      "preset_category": "before_after|problem_agitation|social_proof|us_vs_them|feature_highlight|lifestyle_context|statistique_data|unboxing_product",
      "visual_style": "ugly|polished|mixed"
    }
  ],
  "testing_strategy": {
    "marksman_test": "which 3 angles to test simultaneously (Marksman Method)",
    "first_test_ad": "which single ad to test FIRST and why",
    "multi_angle_concept": "how to combine 2-3 angles in one ad"
  }
}

RULES:
- 9 ad concepts total, covering at least 4 different winning angles
- Each concept references ONE of the 11 example ad templates
- Use at least 5 DIFFERENT template patterns (not all "transformation")
- Use at least 4 DIFFERENT format types
- Headlines: 6-8 words max, scroll-stopping, for NEW customers
- Image descriptions: detailed enough for an editor to BUILD the ad (not vague)
- Congruency: imagery must MATCH and EMPHASIZE the headline
- Make people FEEL something. Show you UNDERSTAND them.
- Clear, concise, simple language
- ALL in the target language
- At least 2 ads should use UGLY/native style (if awareness = problem_aware or solution_aware)`;
      },
    },

    // ═══════════════════════════════════════════
    // WAVE 3: Brief Writer (merges BOTH tracks)
    // ═══════════════════════════════════════════

    {
      id: 'brief-writer',
      name: 'Execution Brief Writer (Merges ZAK + EVOLVE → 24 Briefs)',
      model: 'opus',
      temperature: 0.75,
      maxTokens: 16000,
      dependsOn: ['zak-headline-creator', 'evolve-static-creator'],

      systemPrompt: (project, previousOutputs) => {
        const ctx = buildCreativeContext(project, previousOutputs);

        return `You are a senior art director who merges TWO independent creative tracks into PRODUCTION-READY execution briefs:

TRACK ZAK: 40 psychologically-grounded headlines with visual scene pairings
TRACK EVOLVE: 9 full ad concepts with detailed image descriptions inspired by world-class examples

Your job: take the BEST of both and produce 24 execution-ready briefs organized by 8 preset categories (3 per category).

## BRIEF COMPONENTS (every brief MUST have all of these)
1. HEADLINE OPTIONS — 3 options (A/B/C): mix ZAK headlines + EVOLVE headlines for the same angle
2. VISUAL DIRECTION — merge ZAK's visual scene with EVOLVE's image description (100+ words)
3. AI GENERATION PROMPT — fal.ai prompt (80-150 words), IMAGE ONLY, no text
4. LAYOUT — headline position, text alignment, background, Z-pattern
5. TYPOGRAPHY — font style, color, shadow
6. COLOR PALETTE — 3-5 hex colors with reasoning
7. CTA — text + style
8. SOURCE TRACKING — which ZAK headline + which EVOLVE concept fed this brief

## LAYOUT RULES
- Z-PATTERN: eye flows top-left → top-right → bottom-left → bottom-right
- Text overlay: max 20% of image area
- High contrast: readable on phone in sunlight

## COLOR PSYCHOLOGY
- Problem/pain: ${ctx.brand.color_problem} tones, dark/muted
- Solution/hope: ${ctx.brand.color_solution} tones, warm/bright
- Brand: ${ctx.brand.color_brand} as accent

## CONGRUENCE LOCK
- Mechanism: "${ctx.brand.mechanism_name}" (EXACT wording)
- Product: "${ctx.brand.product_descriptor}"
- Formality: ${ctx.brand.formality}/10 | Tone: ${ctx.brand.emotional_tone}
- USE: ${ctx.brand.phrases_to_use.slice(0, 10).join(', ')}
- NEVER: ${ctx.brand.phrases_to_avoid.slice(0, 10).join(', ')}
- Visual metaphor: ${ctx.brand.visual_metaphor}
- Image rules: ${ctx.brand.image_rules.join('; ')}

## AWARENESS: ${ctx.funnel.label}

OUTPUT: Return ONLY valid JSON.`;
      },

      userMessage: (project, _previousOutputs, peerOutputs) => {
        return `## TRACK ZAK — 40 PSYCHOLOGICAL HEADLINES (Wave 2A)
${peerOutputs['zak-headline-creator'] || 'N/A'}

## TRACK EVOLVE — 9 AD CONCEPTS WITH FULL DESCRIPTIONS (Wave 2B)
${peerOutputs['evolve-static-creator'] || 'N/A'}

## YOUR TASK
Merge BOTH tracks into 24 execution-ready briefs across 8 preset categories (3 per category).

### Merging strategy:
- EVOLVE ads already have image descriptions → use them as the visual direction base, expand to 100+ words
- ZAK headlines have psychological scores → use them for headline options, pick best matches per angle
- Each brief COMBINES: the strongest ZAK headline + the strongest EVOLVE visual description for the same angle
- If an EVOLVE ad and ZAK headline target the same angle → perfect match, merge them
- If not enough concepts for a category → create new briefs using ZAK headlines + new visual directions

Output JSON:
{
  "presets": {
    "before_after": {
      "briefs": [
        {
          "id": "ba-1",
          "name": "brief name",
          "source_zak_headlines": ["h-X-1", "h-X-3"],
          "source_evolve_concept": "evolve-X or null",
          "source_angle_id": "angle-X",
          "concept_type": "the EVOLVE concept type used",
          "format_type": "static_graphic|product_photo|infographic|native_style|quote_text|collage|ugc_image|meme_style",
          "visual_style": "ugly|polished",
          "headline_options": ["A (max 8 words)", "B", "C"],
          "recommended_headline": "A|B|C",
          "headline_scores": {
            "A": { "curiosity": 0, "clarity": 0, "punch": 0, "total": 0 },
            "B": { "curiosity": 0, "clarity": 0, "punch": 0, "total": 0 },
            "C": { "curiosity": 0, "clarity": 0, "punch": 0, "total": 0 }
          },
          "subheadline": "optional (max 15 words)",
          "cta_text": "CTA text",
          "body_text": "optional (max 30 words)",
          "visual_direction": {
            "scene_description": "MERGED ZAK scene + EVOLVE image description (100+ words)",
            "mood": "feeling",
            "lighting": "specific",
            "color_palette": ["#hex1", "#hex2", "#hex3"],
            "composition": "Z-pattern arrangement",
            "focal_point": "where eye lands first",
            "style": "photographic|illustration|3D|mixed|screenshot|ugc|meme",
            "camera_angle": "eye-level|low-angle|overhead|close-up|selfie"
          },
          "ai_generation_prompt": "80-150 words for fal.ai. IMAGE ONLY. Subject, composition, lighting, mood, colors, style, camera, background.",
          "negative_prompt": "text, watermark, logo, blurry, deformed, low quality, bad anatomy, extra limbs, cropped",
          "layout": {
            "headline_position": "top|center|bottom|overlay",
            "text_alignment": "left|center|right",
            "text_background": "none|solid|gradient|blur",
            "headline_size": "large|xlarge|medium",
            "max_text_coverage_pct": 20
          },
          "typography": {
            "font_style": "bold sans-serif|serif|handwritten|mono",
            "headline_color": "#FFFFFF",
            "headline_shadow": true
          },
          "template_reference": "which EVOLVE example ad pattern (if applicable)",
          "emotional_intent": "what emotion this triggers",
          "why_it_works": "1 sentence combining ZAK psychology + EVOLVE pattern logic",
          "awareness_fit": "how this matches the funnel level",
          "visual_scores": {
            "thumb_stop": 0, "brand_consistency": 0,
            "emotional_resonance": 0, "text_readability": 0,
            "product_visibility": 0, "total": 0
          }
        }
      ]
    },
    "problem_agitation": { "briefs": [] },
    "social_proof": { "briefs": [] },
    "us_vs_them": { "briefs": [] },
    "feature_highlight": { "briefs": [] },
    "lifestyle_context": { "briefs": [] },
    "statistique_data": { "briefs": [] },
    "unboxing_product": { "briefs": [] }
  }
}

RULES:
- 8 categories × 3 briefs = 24 total
- EVERY brief traces to: source angle + source ZAK headlines + source EVOLVE concept (or "original" if new)
- Headline options: mix BEST ZAK headlines + BEST EVOLVE headlines for the angle
- Visual direction: 100+ words, specific for fal.ai
- ai_generation_prompt: 80-150 words, NO text in image
- Before/After: split-screen | Problem/Agitation: dark palette | Social Proof: quote-card | Us vs Them: two-column
- Feature Highlight: show mechanism | Lifestyle: match demographics | Statistique: data point | Unboxing: product detail
- At least 3 briefs use UGLY/native style
- At least 3 briefs directly use EVOLVE template patterns
- ALL in ${project.targetLanguage}`;
      },
    },
  ],

  // --- LEAD AGENT: Compile dual-track outputs ---
  generatorPrompt: (project, subAgentOutputs, previousOutputs) => {
    const ctx = buildCreativeContext(project, previousOutputs || {});

    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `You are a senior creative director producing static ad briefs.
PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: ${project.targetLanguage}`;
    }

    return `You are the Lead Creative Director. Your team ran a DUAL-TRACK creative pipeline:

TRACK ZAK (psychological): Visual inspiration scenes → 40 psychologically-grounded headlines with specificity types + scores
TRACK EVOLVE (template-based): Angle identification → 9 ad concepts inspired by 11 world-class example ads with full visual descriptions

Both tracks were merged by the brief writer into 24 execution-ready briefs.

YOUR JOB: Final quality pass + compile into unified Static Ad Studio package.

CHECKS:
1. All 8 presets present, 3 briefs each = 24 total
2. Each brief traces to: angle + ZAK headline source + EVOLVE concept source
3. Headlines match awareness level (${ctx.funnel.label})
4. Visual directions specific enough for fal.ai (100+ words each)
5. Congruence: "${ctx.brand.mechanism_name}" exact, "${ctx.brand.product_descriptor}" exact
6. Dual-track balance: both ZAK and EVOLVE contributed meaningfully
7. Format type diversity: at least 4 different EVOLVE format types used
8. Template pattern diversity: at least 4 different example ad patterns referenced
9. Rank top 5 briefs by predicted scroll-stop × conversion potential
10. All text in ${project.targetLanguage}`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      const ctx = buildCreativeContext(project, previousOutputs);
      return `Produce static ad briefs.\n\n${serializeCreativeContext(ctx, project.selectedCopyFormat)}`;
    }

    return `Here are your 5 specialists' outputs from the dual-track pipeline.

=== WAVE 1A: ANGLE IDENTIFICATION (EVOLVE — Angles + Hooks) ===
${subAgentOutputs['angle-scorer'] || 'N/A'}

=== WAVE 1B: VISUAL INSPIRATION (ZAK — Pain & Hope Scenes) ===
${subAgentOutputs['visual-inspiration-extractor'] || 'N/A'}

=== WAVE 2A — TRACK ZAK: PSYCHOLOGICAL HEADLINES (40 headlines) ===
${subAgentOutputs['zak-headline-creator'] || 'N/A'}

=== WAVE 2B — TRACK EVOLVE: STATIC AD CONCEPTS (9 concepts from 11 templates) ===
${subAgentOutputs['evolve-static-creator'] || 'N/A'}

=== WAVE 3: MERGED EXECUTION BRIEFS (24 briefs) ===
${subAgentOutputs['brief-writer'] || 'N/A'}

## COMPILE INTO:
\`\`\`json
{
  "static_ad_studio": {
    "metadata": {
      "total_presets": 8,
      "total_briefs": 24,
      "zak_headlines_generated": 40,
      "evolve_concepts_generated": 9,
      "winning_angles": 0,
      "awareness_level": "${project.selectedFunnel || 'problem_aware'}",
      "sub_avatar": "${project.selectedSubAvatarId || 'default'}",
      "methodology": "Dual-track — ZAK psychological headlines + EVOLVE $100k static ads (11 templates)",
      "generated_at": "ISO timestamp"
    },
    "winning_angles": [
      {
        "id": "angle-X",
        "name": "angle name",
        "reason_to_buy": "why customers buy based on this angle",
        "score": { "ev": 0, "ma": 0, "ws": 0, "total": 0 },
        "zak_headlines_count": 0,
        "evolve_concepts_count": 0,
        "briefs_using_this_angle": ["ba-1", "pa-2"]
      }
    ],
    "creative_tracks": {
      "zak": { "total_headlines": 40, "top_10_headlines": [], "specificity_types_used": [] },
      "evolve": { "total_concepts": 9, "template_patterns_used": [], "format_types_used": [] }
    },
    "presets": {
      "before_after": {
        "preset_name": "Before / After", "preset_icon": "🔄", "quality": "high",
        "briefs": []
      },
      "problem_agitation": { "preset_name": "Problem / Agitation", "preset_icon": "😤", "quality": "high", "briefs": [] },
      "social_proof": { "preset_name": "Social Proof", "preset_icon": "⭐", "quality": "high", "briefs": [] },
      "us_vs_them": { "preset_name": "Us vs Them", "preset_icon": "⚔️", "quality": "high", "briefs": [] },
      "feature_highlight": { "preset_name": "Feature Highlight", "preset_icon": "💡", "quality": "high", "briefs": [] },
      "lifestyle_context": { "preset_name": "Lifestyle", "preset_icon": "🌅", "quality": "high", "briefs": [] },
      "statistique_data": { "preset_name": "Statistique", "preset_icon": "📊", "quality": "high", "briefs": [] },
      "unboxing_product": { "preset_name": "Unboxing", "preset_icon": "📦", "quality": "high", "briefs": [] }
    },
    "rankings": {
      "top_5_briefs": [
        { "brief_id": "", "preset": "", "headline": "", "source_track": "zak|evolve|merged", "template_pattern": "", "angle": "", "predicted_ctr_rank": 1, "reason": "" }
      ],
      "best_per_preset": {}
    },
    "creative_director_notes": {
      "zak_contribution": "what ZAK's psychological approach brought (specifics)",
      "evolve_contribution": "what EVOLVE's template-based approach brought (specifics)",
      "synergy_insights": "how the two tracks complemented each other",
      "testing_priority": ["order to test — Marksman method first"],
      "marksman_recommendation": "3 angles to test simultaneously with image ads",
      "variety_assessment": "",
      "awareness_consistency": "",
      "emotional_coverage": []
    }
  }
}
\`\`\`

RULES:
- ALL 8 presets, 3 briefs each = 24 briefs
- Each brief must include source_zak_headlines + source_evolve_concept traceability
- Headline options: scored (curiosity/clarity/punch)
- Top 5 ranking with specific reasoning
- Creative director notes MUST explain what each track brought and how they complemented
- Testing priority follows EVOLVE Marksman Method (test 3 angles via image ads)
- ALL text in ${project.targetLanguage}`;
  },

  reviewerPrompt: `You are a senior creative review director evaluating a Static Ad Studio package produced by a DUAL-TRACK pipeline (ZAK psychological + EVOLVE $100k templates).

${EVOLVE_COHERENCE_CHAIN}

${ZAK_IMAGE_AD_FRAMEWORK}

DIMENSIONS (each /10, total /100, threshold ≥72%):
1. Angle Quality: Are angles actionable "reasons to buy" (not vague concepts)? EV×MA×WS scoring honest? At least 3 emotions covered?
2. ZAK Headline Quality: Max 8 words? Psychological triggers stated? Customer language used? Unique numbers? Specificity types varied? Awareness-matched?
3. EVOLVE Concept Quality: Template patterns referenced? Image descriptions vivid enough for an editor? Format types varied? At least 4 different example ad patterns used?
4. Dual-Track Balance: Did BOTH tracks contribute meaningfully? Not one track doing 90% of the work? Are merged briefs genuinely combining both approaches?
5. Visual Direction Depth: 100+ words each? Specific for fal.ai? Pain=dark, Hope=bright? Z-pattern layout? Ugly vs polished matches awareness?
6. AI Prompt Quality: 80-150 words? No text in prompt? Style-consistent with format type?
7. Congruence Lock: Mechanism name EXACT? Root cause correct? Sub-avatar names EXACT? Voice maintained?
8. Preset Balance: 3 briefs per preset = 24? Preset visual rules followed? Format type diversity across presets?
9. Testing Strategy: Marksman Method recommendation included? Clear first-test-ad? Multi-angle concept suggested?
10. Actionability: Can an editor + fal.ai execute each brief? Clear source traceability (angle → track → brief)?

Respond in valid JSON with score, maxScore (100), dimensions array, feedback, and passed boolean.`,

  reviewCriteria: `Score each dimension /10. Brutal honesty. Vague angles = instant fail. One-track dominance = low score. Missing template references = low score. Total /100, pass ≥ 72%.`,

  reviewThreshold: 72,
  hasCongruenceCheck: true,

  congruencePrompt: `You are the Brand Congruence Guardian for a dual-track Static Ad Studio package.

CHECK EVERY BRIEF across all 8 presets:
1. LOCKED TERMS: Mechanism name, root cause, belief error, product descriptor — exact?
2. CUSTOMER LANGUAGE: "Always use" present? "Never use" absent? Headlines sound like the customer?
3. VISUAL IDENTITY: Color palettes match Brand DNA? Visual metaphor maintained? Image rules followed?
4. AWARENESS CONSISTENCY: Copy register matches funnel level? No drift?
5. EMOTIONAL ARC: Primary → secondary → resolution emotions maintained?
6. VOICE PROFILE: Formality, tone, sentence style consistent?
7. CONGRUENCY: Does imagery MATCH and EMPHASIZE the headline? (EVOLVE rule #1)

Score each dimension 0-100. Output valid JSON:
{
  "score": 0,
  "passed": true,
  "dimensions": {
    "locked_terms_match": 0,
    "customer_language": 0,
    "visual_identity": 0,
    "awareness_consistency": 0,
    "emotional_arc": 0,
    "voice_profile": 0,
    "headline_image_congruency": 0
  },
  "driftReport": [
    { "location": "preset/brief-id/field", "expected": "Brand DNA", "found": "what was written", "severity": "CRITICAL|WARNING|MINOR" }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific instructions to fix drift"
}`,

  congruenceThreshold: 75,
};

export default gate7;
