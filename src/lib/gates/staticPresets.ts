// ============================================================
// PAWEN — Static Ad Preset System
// 8 preset types (inspired by PRISM Ad Studio), each with:
// - Specialized prompt template
// - Required upstream elements
// - Visual composition rules
// - Awareness-level copy adaptations
// - Congruence checkpoints
// ============================================================

import type { CreativeContext } from './creativeContextAggregator';

// -------- Preset types --------

export type StaticPresetId =
  | 'before_after'
  | 'feature_highlight'
  | 'lifestyle_context'
  | 'problem_agitation'
  | 'social_proof'
  | 'statistique_data'
  | 'unboxing_product'
  | 'us_vs_them';

export interface StaticPreset {
  id: StaticPresetId;
  name: string;
  description: string;
  icon: string;              // emoji for UI
  quality: 'high' | 'dynamic';  // rendering complexity tag
  requiredUpstream: string[];    // which gates MUST have data
  visualRules: string[];         // composition constraints
  awarenessAdaptations: Record<string, string>;  // funnel_level → copy angle shift
}

export interface PresetBrief {
  preset_id: StaticPresetId;
  preset_name: string;
  headline_options: string[];     // 3 headline candidates (A/B/C)
  selected_headline_index: number;
  sub_avatar_id: string;
  awareness_level: string;
  visual_prompt: string;          // detailed scene description
  negative_prompt: string;
  text_overlays: {
    headline: string;
    subheadline?: string;
    cta?: string;
    body?: string;
  };
  layout: {
    headline_position: 'top' | 'center' | 'bottom' | 'overlay';
    text_alignment: 'left' | 'center' | 'right';
    text_background: 'none' | 'solid' | 'gradient' | 'blur';
  };
  color_palette: string[];
  emotional_intent: string;
  format: 'feed_1x1' | 'story_9x16' | 'vertical_4x5';
}

// -------- Preset definitions --------

export const STATIC_PRESETS: StaticPreset[] = [
  {
    id: 'before_after',
    name: 'Before / After',
    description: 'Split-screen transformation visual. Left = pain state, right = solution state. Maximum contrast.',
    icon: '🔄',
    quality: 'high',
    requiredUpstream: ['gate1', 'gate2', 'gate3'],
    visualRules: [
      'Split-screen layout: left 50% (before) + right 50% (after)',
      'Before side: muted/desaturated colors (problem palette)',
      'After side: vibrant/saturated colors (solution palette)',
      'Clear visual divider (line, gradient, or diagonal)',
      'Same subject in both halves for direct comparison',
      'Headline overlays the divider line for maximum impact',
    ],
    awarenessAdaptations: {
      full_unaware: 'Focus on the BEFORE state — make the pain visible. No product. "Is this you?" angle.',
      problem_aware: 'Show the contrast — "This is what happens when you fix [root cause]"',
      solution_aware: 'Show the mechanism working — before-during-after with product visible',
      product_aware: 'Show real results — testimonial-style with specific timeline',
      most_aware: 'Show the offer — before/after + price + guarantee overlay',
      retargeting: 'Show what they are MISSING — "You were this close to [after state]"',
    },
  },
  {
    id: 'feature_highlight',
    name: 'Feature Highlight',
    description: 'Spotlight the mechanism — the 3-step process or key differentiator. Educational and concrete.',
    icon: '✨',
    quality: 'dynamic',
    requiredUpstream: ['gate3'],
    visualRules: [
      'Clean, minimal background — white/light or brand color',
      'Product or mechanism visual as hero element (60% of frame)',
      'Numbered steps or callout annotations',
      'Icon-style visual elements for each step',
      'Sans-serif typography — modern, clean, authoritative',
      'Accent color on the key differentiator',
    ],
    awarenessAdaptations: {
      full_unaware: 'Frame as "discovery" — "The hidden reason why [problem persists]"',
      problem_aware: 'Frame as "the fix" — "3 steps to [desired outcome]"',
      solution_aware: 'Frame as "why this is different" — mechanism name front and center',
      product_aware: 'Frame as "how it works" — detailed mechanism with proof points',
      most_aware: 'Frame as "what you get" — feature + benefit + price',
      retargeting: 'Frame as "remember?" — the step they were most interested in',
    },
  },
  {
    id: 'lifestyle_context',
    name: 'Lifestyle / Product in Context',
    description: 'Product naturally placed in the target avatar\'s daily life. Aspirational but relatable.',
    icon: '🌿',
    quality: 'high',
    requiredUpstream: ['gate1', 'gate2'],
    visualRules: [
      'Natural, lifestyle photography aesthetic — warm lighting',
      'Product placed organically in a real-life scene',
      'Person matching sub-avatar demographics visible',
      'Environment reflects the avatar\'s aspirational state',
      'Minimal text overlay — let the image sell',
      'Soft, natural color palette (not hyper-saturated)',
    ],
    awarenessAdaptations: {
      full_unaware: 'Show the DESIRED lifestyle without product — pure aspiration, identity-based',
      problem_aware: 'Show someone in THEIR situation discovering something — curiosity hook',
      solution_aware: 'Show the product being used naturally in a solved-state environment',
      product_aware: 'Show multiple people using it — social proof through visual',
      most_aware: 'Show the product with price tag in lifestyle context — "Get yours"',
      retargeting: 'Show the "morning after" — person living the result, casual and authentic',
    },
  },
  {
    id: 'problem_agitation',
    name: 'Problem / Agitation',
    description: 'Visceral visualization of the problem state. Emotionally heavy. Scroll-stop through recognition.',
    icon: '⚡',
    quality: 'high',
    requiredUpstream: ['gate1', 'gate2', 'gate3'],
    visualRules: [
      'Dark, moody color palette (problem colors from Brand DNA)',
      'Close-up or intimate framing — feels personal',
      'Visual metaphor for the pain (drowning, weight, darkness, etc.)',
      'Bold, large headline text — impossible to ignore',
      'High contrast between text and background',
      'Single powerful image — no clutter',
    ],
    awarenessAdaptations: {
      full_unaware: 'Pure emotion — show the symptom they experience daily but never named. "Why do you always feel [X]?"',
      problem_aware: 'Name the problem explicitly — "Tired of [specific pain]?" — agitate hard',
      solution_aware: 'Show why other solutions FAIL — "Still doing [wrong approach]?"',
      product_aware: 'Show the cost of NOT acting — "Every day without [product] costs you [X]"',
      most_aware: 'NOT recommended for most-aware — switch to social proof or offer',
      retargeting: 'Remind of the pain they wanted to escape — "Still dealing with [X]?"',
    },
  },
  {
    id: 'social_proof',
    name: 'Social Proof / Testimonial',
    description: 'Customer voice as hero element. Real quotes, real results, real trust signals.',
    icon: '⭐',
    quality: 'high',
    requiredUpstream: ['gate1'],
    visualRules: [
      'Quote-card style layout or review screenshot aesthetic',
      'Star rating visual element (if available)',
      'Customer photo or UGC-style imagery',
      'Quotation marks or speech bubble framing',
      'Trust badges or verification indicators',
      'Warm, trustworthy color palette',
    ],
    awarenessAdaptations: {
      full_unaware: 'Lead with the person\'s STORY, not the product — "I never thought [pain] would end..."',
      problem_aware: 'Lead with empathy — "I felt exactly like you" — then reveal the turn',
      solution_aware: 'Lead with comparison — "I tried everything until I found [mechanism]"',
      product_aware: 'Lead with results — specific numbers, timeline, outcome',
      most_aware: 'Lead with volume — "Join 10,000+ people who [result]" + rating',
      retargeting: 'Show testimonial from someone who ALMOST didn\'t buy — "I almost didn\'t try it..."',
    },
  },
  {
    id: 'statistique_data',
    name: 'Statistique / Data Visual',
    description: 'Numbers that prove the claim. Charts, percentages, data points that build authority.',
    icon: '📊',
    quality: 'high',
    requiredUpstream: ['gate3'],
    visualRules: [
      'Clean data visualization — bar chart, pie chart, or large number',
      'Single dominant statistic as hero element',
      'Minimal design — data speaks, not decoration',
      'Brand color accent on the key data point',
      'Source citation for credibility (small text)',
      'High contrast number typography — impossible to miss',
    ],
    awarenessAdaptations: {
      full_unaware: 'Shocking statistic about the problem — "X% of people don\'t know [root cause]"',
      problem_aware: 'Problem magnitude — "You lose X hours/dollars/years to [problem] every [timeframe]"',
      solution_aware: 'Efficacy data — "[Mechanism] works X% faster than [old approach]"',
      product_aware: 'Product results — "X% satisfaction rate | X average improvement"',
      most_aware: 'Value data — "Save $X per [timeframe] | X% ROI"',
      retargeting: 'Urgency data — "X people bought since you last visited"',
    },
  },
  {
    id: 'unboxing_product',
    name: 'Unboxing / Product Shot',
    description: 'Hero product imagery. Premium feel. Desire-driven. Makes them want to touch it.',
    icon: '📦',
    quality: 'dynamic',
    requiredUpstream: [],
    visualRules: [
      'Product as absolute hero — 70%+ of frame',
      'Premium lighting (studio-quality, soft shadows)',
      'Clean background — solid color or subtle gradient',
      'Multiple angles or unboxing sequence feel',
      'Texture and detail visible — trigger tactile desire',
      'Brand colors in background/accent — cohesive look',
    ],
    awarenessAdaptations: {
      full_unaware: 'NOT recommended for unaware — they don\'t know the product. Use lifestyle instead.',
      problem_aware: 'Show product as "the answer" — mysterious reveal angle',
      solution_aware: 'Show product details — what makes it different physically',
      product_aware: 'Show the full package — what they GET (contents, bonuses)',
      most_aware: 'Show product + price tag + offer — unboxing with value stack',
      retargeting: 'Show product being USED — "This could be in your hands tomorrow"',
    },
  },
  {
    id: 'us_vs_them',
    name: 'Us vs Them',
    description: 'Direct comparison layout. Our approach vs the old/wrong way. Differentiation through contrast.',
    icon: '⚔️',
    quality: 'high',
    requiredUpstream: ['gate3'],
    visualRules: [
      'Two-column layout: LEFT (them/old way) vs RIGHT (us/new way)',
      '"Them" side: red/gray tones, X marks, faded',
      '"Us" side: green/brand tones, check marks, vibrant',
      'Clear labels: "Old way" / "New way" or "Them" / "Us"',
      'Headline spans both columns for context',
      'Visual asymmetry — "Us" side slightly larger or more prominent',
    ],
    awarenessAdaptations: {
      full_unaware: 'Compare "what you think works" vs "what actually works" — educational angle',
      problem_aware: 'Compare "what everyone tells you" vs "what science shows" — root cause angle',
      solution_aware: 'Compare competitor approach vs our mechanism — specific differentiators',
      product_aware: 'Compare our product vs alternatives — feature by feature',
      most_aware: 'Compare our offer vs their current situation — value proposition',
      retargeting: 'Compare "life without [product]" vs "life with [product]"',
    },
  },
];

// -------- Preset prompt builders --------

export function buildPresetPrompt(
  preset: StaticPreset,
  ctx: CreativeContext,
  headlineOptions: string[],
): { system: string; user: string } {
  const awarenessAdaptation = preset.awarenessAdaptations[ctx.funnel.level]
    || preset.awarenessAdaptations.problem_aware;

  const system = `You are an elite static ad creative director for a $100M/year direct response brand. You specialize in "${preset.name}" ad formats.

YOUR SPECIALTY: ${preset.description}

## VISUAL COMPOSITION RULES (NON-NEGOTIABLE)
${preset.visualRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## AWARENESS ADAPTATION
Current funnel position: ${ctx.funnel.label}
Adaptation rule: ${awarenessAdaptation}

## CONGRUENCE RULES
- Use EXACT mechanism name: "${ctx.brand.mechanism_name}"
- Use EXACT product descriptor: "${ctx.brand.product_descriptor}"
- Match voice profile: ${ctx.brand.emotional_tone}, formality ${ctx.brand.formality}/10
- USE these phrases: ${ctx.brand.phrases_to_use.slice(0, 8).join(', ')}
- NEVER use: ${ctx.brand.phrases_to_avoid.slice(0, 8).join(', ')}
- Color palette: Problem=${ctx.brand.color_problem} | Solution=${ctx.brand.color_solution} | Brand=${ctx.brand.color_brand}
- Visual metaphor: ${ctx.brand.visual_metaphor}

## OUTPUT: Return ONLY valid JSON — no markdown, no explanation.`;

  const user = `## FULL CREATIVE CONTEXT
${buildPresetContextBlock(ctx)}

## HEADLINE OPTIONS (pick the best fit OR improve — stay within 8 words)
${headlineOptions.map((h, i) => `  ${String.fromCharCode(65 + i)}. "${h}"`).join('\n')}

## YOUR TASK: Create 3 "${preset.name}" ad briefs

For EACH brief, output:
{
  "briefs": [
    {
      "id": "brief-1",
      "preset": "${preset.id}",
      "name": "descriptive internal name",
      "selected_headline": "the headline you chose or improved (max 8 words)",
      "headline_source": "A|B|C|improved",
      "subheadline": "optional supporting text (max 15 words)",
      "cta_text": "call-to-action button text",
      "body_text": "optional body text for the ad (max 30 words)",

      "visual_direction": {
        "scene_description": "DETAILED description — what the viewer SEES (100+ words)",
        "mood": "the overall feeling",
        "lighting": "specific lighting setup",
        "color_palette": ["#hex1", "#hex2", "#hex3"],
        "composition": "how elements are arranged",
        "focal_point": "where the eye lands first",
        "style": "photographic|illustration|3D|mixed",
        "camera_angle": "eye-level|low-angle|overhead|close-up|etc."
      },

      "ai_generation_prompt": "Complete fal.ai prompt (80-150 words). Describe the IMAGE ONLY — no text overlays. Include: subject, composition, lighting, mood, colors, style, camera angle, background, details.",
      "negative_prompt": "Elements to AVOID in generation",

      "layout": {
        "headline_position": "top|center|bottom|overlay",
        "text_alignment": "left|center|right",
        "text_background": "none|solid|gradient|blur",
        "headline_size": "large|xlarge|medium",
        "max_text_coverage_pct": 25
      },

      "emotional_intent": "what emotion this specific brief triggers",
      "why_it_works": "1-sentence psychology — why this stops the scroll",
      "awareness_fit": "how this brief matches the ${ctx.funnel.label} funnel position",

      "formats": {
        "feed_1080x1080": {
          "prompt_adjustments": "how to modify the prompt for square format",
          "layout_notes": "layout adaptation for square"
        },
        "story_1080x1920": {
          "prompt_adjustments": "how to modify the prompt for vertical 9:16",
          "layout_notes": "layout adaptation for vertical"
        }
      }
    }
  ]
}

RULES:
- EXACTLY 3 briefs per preset
- Each brief uses a DIFFERENT emotional angle
- ai_generation_prompt must be 80-150 words — SPECIFIC enough for fal.ai to execute
- negative_prompt must prevent: text, watermarks, logos, blurry, deformed anatomy, low quality
- Headlines MUST be in ${ctx.funnel.level === 'full_unaware' ? 'identity/curiosity' : ctx.funnel.level === 'most_aware' ? 'offer/urgency' : 'problem/solution'} register
- ALL text in the target language
- Visual direction must match the "${preset.name}" composition rules above
- Every brief must explicitly address the awareness level: ${ctx.funnel.label}`;

  return { system, user };
}

function buildPresetContextBlock(ctx: CreativeContext): string {
  const parts: string[] = [];

  parts.push(`TARGET: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname})
${ctx.sub_avatar.description}
Urgency: ${ctx.sub_avatar.urgency_score}/10 | Desire: ${ctx.sub_avatar.surface_desire}
Triggers: ${ctx.sub_avatar.emotional_triggers.join(', ')}`);

  if (ctx.sub_avatar.verbatim_quotes.length > 0) {
    parts.push(`THEIR WORDS:\n${ctx.sub_avatar.verbatim_quotes.slice(0, 6).map(q => `  • "${q}"`).join('\n')}`);
  }

  parts.push(`PRODUCT: ${ctx.product.name}
${ctx.product.price ? `Price: ${ctx.product.price} ${ctx.product.currency || ''}` : ''}
${ctx.product.benefits?.join(' | ') || ctx.product.description}`);

  if (ctx.root_cause) {
    parts.push(`ROOT CAUSE: ${ctx.root_cause.one_sentence}
${ctx.root_cause.aha_moment ? `Aha: ${ctx.root_cause.aha_moment}` : ''}
${ctx.root_cause.false_belief ? `False belief: ${ctx.root_cause.false_belief}` : ''}`);
  }

  parts.push(`MECHANISM: ${ctx.brand.mechanism_name}
Steps: ${ctx.brand.mechanism_steps.map(s => `${s.step}. ${s.name}`).join(' → ')}`);

  if (ctx.top_hooks?.length) {
    parts.push(`TOP HOOKS:\n${ctx.top_hooks.slice(0, 5).map(h => `  • [${h.score}] "${h.hook}"`).join('\n')}`);
  }

  if (ctx.swipe?.power_words.length) {
    parts.push(`POWER WORDS: ${ctx.swipe.power_words.join(', ')}`);
  }

  if (ctx.competitor_insights) {
    parts.push(`AVOID (overused): ${ctx.competitor_insights.overused_angles.join(', ')}
EXPLOIT (gaps): ${ctx.competitor_insights.unexploited_gaps.join(', ')}`);
  }

  return parts.join('\n\n');
}

// -------- Headline extractor --------

// Extract 3 headline candidates (A/B/C) for a given preset from upstream data
export function extractHeadlineCandidates(
  preset: StaticPreset,
  ctx: CreativeContext,
): string[] {
  const candidates: string[] = [];

  // 1. From Gate 7 headlines (if available)
  if (ctx.headlines?.length) {
    candidates.push(...ctx.headlines);
  }

  // 2. From Gate 4 top hooks
  if (ctx.top_hooks?.length) {
    for (const h of ctx.top_hooks) {
      // Shorten to max 8 words for image ad
      const words = h.hook.split(/\s+/);
      if (words.length <= 10) {
        candidates.push(h.hook);
      }
    }
  }

  // 3. From sub-avatar hooks
  if (ctx.sub_avatar.hooks?.length) {
    candidates.push(...ctx.sub_avatar.hooks);
  }

  // 4. From story angle
  if (ctx.sub_avatar.story_angle.problem) {
    candidates.push(ctx.sub_avatar.story_angle.problem);
  }

  // Filter and dedupe
  const seen = new Set<string>();
  const unique = candidates.filter(h => {
    if (!h || h.length < 3) return false;
    const key = h.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score by relevance to preset type
  const scored = unique.map(h => {
    let score = 0;
    const lower = h.toLowerCase();

    switch (preset.id) {
      case 'before_after':
        if (/before|after|transform|changed|used to|now i|avant|après/i.test(lower)) score += 3;
        if (/finally|enfin/i.test(lower)) score += 2;
        break;
      case 'problem_agitation':
        if (/tired|sick|stop|enough|why|still|marre|assez|pourquoi/i.test(lower)) score += 3;
        if (/\?$/.test(lower)) score += 2;
        break;
      case 'social_proof':
        if (/\d|people|customers|results|joined|proven|avis/i.test(lower)) score += 3;
        if (/trust|real|témoign/i.test(lower)) score += 2;
        break;
      case 'us_vs_them':
        if (/vs|versus|instead|unlike|while|others|alors que|contrairement/i.test(lower)) score += 3;
        if (/better|worse|old|new|mieux|pire/i.test(lower)) score += 2;
        break;
      case 'statistique_data':
        if (/\d+%|\d+x|\d+ (fois|times|out of)/i.test(lower)) score += 3;
        if (/proven|study|research|prouvé|étude/i.test(lower)) score += 2;
        break;
      case 'feature_highlight':
        if (/how|step|secret|discover|comment|étape|secret/i.test(lower)) score += 3;
        if (/simple|easy|facile|just/i.test(lower)) score += 2;
        break;
      case 'lifestyle_context':
        if (/imagine|picture|feel|life|morning|day|imagin|vie|matin/i.test(lower)) score += 3;
        if (/finally|freedom|libre|enfin/i.test(lower)) score += 2;
        break;
      case 'unboxing_product':
        if (/get|receive|inside|what|your|découvr|recevez/i.test(lower)) score += 3;
        if (/premium|quality|qualité/i.test(lower)) score += 2;
        break;
    }

    // General bonuses
    if (h.split(/\s+/).length <= 8) score += 1;  // Prefer short headlines
    return { headline: h, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top 3
  return scored.slice(0, 3).map(s => s.headline);
}

// -------- Congruence pre-check --------

export interface CongruenceWarning {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  fix: string;
}

export function preCheckCongruence(
  preset: StaticPreset,
  ctx: CreativeContext,
  selectedHeadline: string,
): CongruenceWarning[] {
  const warnings: CongruenceWarning[] = [];

  // 1. Awareness mismatch
  if (preset.id === 'unboxing_product' && ctx.funnel.level === 'full_unaware') {
    warnings.push({
      severity: 'critical',
      message: 'Unboxing preset is not recommended for fully unaware audiences',
      fix: 'Switch to Lifestyle or Problem/Agitation preset for unaware audiences',
    });
  }
  if (preset.id === 'problem_agitation' && ctx.funnel.level === 'most_aware') {
    warnings.push({
      severity: 'warning',
      message: 'Problem/Agitation is weak for most-aware audiences — they already know the problem',
      fix: 'Consider Social Proof or Unboxing for most-aware audiences',
    });
  }

  // 2. Missing upstream data
  for (const gate of preset.requiredUpstream) {
    const hasData = (() => {
      switch (gate) {
        case 'gate1': return !!ctx.sub_avatar.verbatim_quotes.length;
        case 'gate2': return !!ctx.sub_avatar.hidden_fears?.length || !!ctx.sub_avatar.identity_map;
        case 'gate3': return !!ctx.root_cause;
        default: return true;
      }
    })();

    if (!hasData) {
      warnings.push({
        severity: 'warning',
        message: `${preset.name} works best with ${gate} data, but it's missing or incomplete`,
        fix: `Run ${gate} first for maximum quality`,
      });
    }
  }

  // 3. Headline too long for image ad
  if (selectedHeadline.split(/\s+/).length > 10) {
    warnings.push({
      severity: 'warning',
      message: `Headline is ${selectedHeadline.split(/\s+/).length} words — image ads work best at 8 words max`,
      fix: 'Shorten the headline or let the AI adapt it',
    });
  }

  // 4. Brand voice violations in headline
  const headlineLower = selectedHeadline.toLowerCase();
  for (const forbidden of ctx.brand.never_use) {
    if (headlineLower.includes(forbidden.toLowerCase())) {
      warnings.push({
        severity: 'critical',
        message: `Headline contains forbidden word: "${forbidden}"`,
        fix: `Remove "${forbidden}" — it's in the Brand DNA never-use list`,
      });
    }
  }

  // 5. No mechanism name when awareness ≥ solution_aware
  if (['solution_aware', 'product_aware', 'most_aware'].includes(ctx.funnel.level)) {
    if (ctx.brand.mechanism_name && !headlineLower.includes(ctx.brand.mechanism_name.toLowerCase())) {
      warnings.push({
        severity: 'info',
        message: `For ${ctx.funnel.label} audiences, consider including the mechanism name "${ctx.brand.mechanism_name}"`,
        fix: 'The mechanism name builds recognition at this awareness level',
      });
    }
  }

  return warnings;
}

// -------- Get preset by ID --------

export function getPreset(id: StaticPresetId): StaticPreset {
  const found = STATIC_PRESETS.find(p => p.id === id);
  if (!found) throw new Error(`Unknown preset: ${id}`);
  return found;
}
