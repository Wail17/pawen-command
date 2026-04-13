// ============================================================
// GATE 8 — STATIC AD GENERATION (Studio Engine)
// Takes Gate 7 preset briefs + user selections (preset, headline,
// sub-avatar, awareness) and generates final fal.ai configs.
// Full creative context injection — zero information loss.
// Pre-generation congruence validation built in.
// ============================================================

import { GateConfigDef } from './types';
import { buildCreativeContext, serializeCreativeContext } from './creativeContextAggregator';
import { EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { ZAK_IMAGE_AD_FRAMEWORK } from './zakFrameworks';

const gate8: GateConfigDef = {
  id: 'gate8',
  description: 'Static Ad Generation Studio — takes preset selections from Gate 7, generates final fal.ai configs with full context + congruence lock',

  // No sub-agents — single-agent flow that consumes Gate 7 presets
  // The real selection happens in the UI (StaticAdStudio component)

  generatorPrompt: (project, _subAgentOutputs, previousOutputs) => {
    const ctx = buildCreativeContext(project, previousOutputs || {});

    return `You are the final-stage AI image generation coordinator for a $100M/year direct response brand. You take validated creative briefs from the Static Ad Studio (Gate 7) and produce PRODUCTION-READY fal.ai generation configurations.

## YOUR MISSION
Transform each selected brief into multiple fal.ai generation configs across formats (feed 1:1, story 9:16, vertical 4:5). Each config must be so specific that the generated image requires ZERO iteration.

## GENERATION QUALITY RULES

### Prompt Engineering (for fal.ai flux models)
1. Start with the PRIMARY subject and its state/action
2. Add ENVIRONMENT details (location, setting, time of day)
3. Specify LIGHTING (direction, quality, color temperature)
4. Define MOOD/ATMOSPHERE (emotional tone of the scene)
5. Include STYLE keywords (photographic, cinematic, editorial, studio, etc.)
6. Add CAMERA details (lens, angle, depth of field)
7. Specify TECHNICAL quality (8K, professional, award-winning, etc.)
8. End with COLOR GRADING notes

### Model Selection
- "fal-ai/flux-pro/v1.1" → photorealistic: lifestyle, product shots, testimonial-style, before/after with real people
- "fal-ai/flux/dev" → creative/artistic: abstract concepts, data visualizations, mood pieces, stylized illustrations

### Format-Specific Rules
- Feed (1080×1080): Centered composition, key elements in center 70%
- Story (1080×1920): Vertical composition, top 40% for hook visual, bottom 30% for text
- Vertical (1080×1350): 4:5 ratio, balanced composition, works well for feed + explore

## CONGRUENCE LOCK
- Product: ${project.name}
- Market: ${project.targetMarket}
- Language: ${project.targetLanguage}
- Awareness: ${project.selectedFunnel || 'problem_aware'}
- Brand colors: ${ctx.brand.color_problem} (problem) | ${ctx.brand.color_solution} (solution) | ${ctx.brand.color_brand} (brand)
- Visual metaphor: ${ctx.brand.visual_metaphor}
- Image rules: ${ctx.brand.image_rules.join('; ')}

## OUTPUT: Return ONLY valid JSON wrapped in \`\`\`json code blocks.`;
  },

  userMessage: (project, previousOutputs) => {
    const ctx = buildCreativeContext(project, previousOutputs);
    const g7 = previousOutputs['gate7'] as Record<string, unknown> | undefined;

    // Build a focused context block (not full serialize — Gate 7 already has the brief details)
    const contextBlock = `## CREATIVE CONTEXT SUMMARY
Target: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname})
Awareness: ${ctx.funnel.label} — ${ctx.funnel.strategy}
Mechanism: ${ctx.brand.mechanism_name}
Product: ${ctx.product.name} ${ctx.product.price ? `(${ctx.product.price} ${ctx.product.currency || ''})` : ''}
Visual metaphor: ${ctx.brand.visual_metaphor}
Colors: Problem=${ctx.brand.color_problem} | Solution=${ctx.brand.color_solution} | Brand=${ctx.brand.color_brand}

## SWIPE VOCABULARY
${ctx.swipe?.power_words.length ? `Power words: ${ctx.swipe.power_words.join(', ')}` : ''}
${ctx.sub_avatar.verbatim_quotes.slice(0, 5).map(q => `  • "${q}"`).join('\n')}`;

    let msg = `${contextBlock}\n\n`;

    if (g7) {
      msg += `## STATIC AD STUDIO BRIEFS (Gate 7 — all 8 presets)
${JSON.stringify(g7, null, 2)}

`;
    }

    // Check for user selections stored in humanDecisions
    const g7Output = previousOutputs['gate7_decisions'] as Record<string, unknown> | undefined;
    if (g7Output) {
      msg += `## USER SELECTIONS (from Static Ad Studio UI)
${JSON.stringify(g7Output, null, 2)}

`;
    }

    msg += `## YOUR TASK
Generate PRODUCTION-READY fal.ai configs for ALL briefs in the Static Ad Studio package.

For each brief, produce 3 format variants:
1. Feed (1080×1080) — square, Meta feed placement
2. Story (1080×1920) — vertical, Meta/IG story placement
3. Vertical (1080×1350) — 4:5 ratio, Meta feed + explore

Output:
\`\`\`json
{
  "generation_batch": {
    "metadata": {
      "total_configs": 0,
      "total_images": 0,
      "awareness_level": "${project.selectedFunnel || 'problem_aware'}",
      "sub_avatar": "${ctx.sub_avatar.name}",
      "generated_at": "ISO"
    },
    "configs": [
      {
        "id": "gen_ba-1_feed",
        "source_preset": "before_after",
        "source_brief_id": "ba-1",
        "brief_name": "brief descriptive name",
        "format": "feed_1x1",

        "model": "fal-ai/flux-pro/v1.1",
        "prompt": "PRODUCTION-QUALITY prompt (100-180 words). Include: subject, action, environment, lighting (direction + quality + color temp), mood, style, camera (lens + angle + DoF), quality keywords, color grading. NO text in image.",
        "negative_prompt": "text, watermark, logo, blurry, deformed, low quality, bad anatomy, extra limbs, cropped, worst quality, jpeg artifacts, ugly, duplicate, morbid, mutilated",
        "width": 1080,
        "height": 1080,
        "guidance_scale": 7.5,
        "num_images": 2,
        "seed": null,

        "text_overlays": {
          "headline": "final headline text (from selected option A/B/C)",
          "subheadline": "optional",
          "cta": "optional CTA text",
          "body": "optional body text"
        },

        "overlay_design": {
          "headline_position": "top|center|bottom|overlay",
          "text_alignment": "left|center|right",
          "text_background": "none|solid|gradient|blur",
          "headline_font_style": "bold sans-serif|serif|handwritten",
          "headline_color": "#FFFFFF",
          "headline_shadow": true,
          "max_text_coverage_pct": 25
        },

        "vision_review_prompt": "Evaluate: 1) Does the image match the ${ctx.sub_avatar.name} sub-avatar's world? 2) Does the composition follow [preset] rules? 3) Are brand colors present? 4) Is there a clear focal point? 5) Would this stop the scroll? Score 1-10.",

        "awareness_check": "Does this image match ${ctx.funnel.label} awareness? YES/NO and why"
      }
    ],

    "post_processing": {
      "text_overlay_tool": "Text must be added via Figma/Canva or text-overlay API — fal.ai does NOT render text reliably",
      "quality_checks": [
        "Resolution ≥ 1080px shortest side",
        "No AI artifacts (extra fingers, warped edges, melted objects)",
        "Product accurately represented (if applicable)",
        "Brand color palette present in image",
        "Clear focal point visible at mobile thumbnail size",
        "Composition matches preset layout rules",
        "Image emotional tone matches awareness level"
      ],
      "brand_consistency_checks": [
        "Color grading consistent across all images in same preset",
        "Visual metaphor (${ctx.brand.visual_metaphor}) referenced where appropriate",
        "No visual elements from competitor territory",
        "Product representation matches real product (if Shopify data available)"
      ]
    },

    "testing_plan": {
      "phase_1_presets": ["which 2-3 presets to test first (highest predicted impact)"],
      "phase_1_headlines": ["which headline variant (A/B/C) per preset"],
      "phase_2_expansion": "after finding winners, which presets/headlines to test next",
      "budget_split": "recommended budget allocation across preset types"
    }
  }
}
\`\`\`

RULES:
- EVERY brief from Gate 7 gets 3 format variants = minimum 72 configs (24 briefs × 3 formats)
- num_images: 2 per config = 144+ total image variations
- Prompts MUST be 100-180 words — SPECIFIC and production-quality
- negative_prompt: always include the full standard negative set
- Text overlays are added POST-generation — NEVER include text in the fal.ai prompt
- Each prompt must reference the specific PRESET rules (before/after = split screen, social proof = quote card, etc.)
- Vision review prompts must be specific to the brief's intent AND awareness level
- All text overlays in ${project.targetLanguage}
- guidance_scale: 7.5 for photorealistic, 3.5 for creative/artistic
- Model selection must match visual style: flux-pro for realistic, flux/dev for creative`;

    return msg;
  },

  reviewerPrompt: `You are a visual quality reviewer and AI image generation specialist for performance marketing static ads.

${EVOLVE_COHERENCE_CHAIN}

${ZAK_IMAGE_AD_FRAMEWORK}

DIMENSIONS (each /10, total /100, threshold ≥70%):
1. Prompt Specificity: Are prompts 100-180 words with subject, environment, lighting, mood, camera, style? No vague descriptions? Ugly vs polished style correctly matched to awareness level and concept type?
2. Model Selection: Correct model for each visual style? Photorealistic vs creative matched appropriately? Visual scoring criteria applied (thumb-stop power, brand consistency, emotional resonance)?
3. Negative Prompt Coverage: Standard negatives always present? Preset-specific negatives included?
4. Format Coverage: All 3 formats (feed/story/vertical) per brief? Composition adapted for each ratio?
5. Preset Rule Adherence: Does each prompt follow its preset's visual composition rules? Split-screen for Before/After? Quote-card for Social Proof?
6. Brand Alignment: Brand colors in prompts? Visual metaphor referenced? Image rules followed?
7. Text Overlay Specs: Headline position, alignment, background all specified? Design system consistent?
8. Awareness Consistency: Do all prompts match the selected funnel level? No awareness drift? No skipped awareness levels?
9. Coherence Lock: Product descriptor EXACT from Brand DNA? Visual identity aligned with Gate 2 sub-avatar? Text overlays use EXACT mechanism name from Gate 3?
10. Testing Plan: Logical phase 1/2 split? Budget allocation sensible? Based on predicted performance?

Respond in valid JSON with score, maxScore (100), dimensions array, feedback, and passed boolean.`,

  reviewCriteria: `Score each dimension /10. Missing formats = low score. Vague prompts = instant fail. Awareness drift = critical issue. Total /100, pass ≥ 70%.`,

  reviewThreshold: 70,

  hasCongruenceCheck: true,
  congruencePrompt: `Brand DNA Congruence Agent for Static Ad Generation configs.

CHECK ALL generation configs:
1. VISUAL IDENTITY: Do prompts reference brand colors (Problem/Solution/Brand)? Visual metaphor maintained? Image rules from Brand DNA followed?
2. PRODUCT ACCURACY: If product is visible in the prompt, does it match real product data (Shopify/manual)?
3. CAMPAIGN CONSISTENCY: Will all generated images feel like ONE cohesive campaign? Consistent palette, mood, style across presets?
4. AWARENESS LOCK: Does every config's visual tone match the selected awareness level? No drift between presets?
5. TEXT OVERLAY CONGRUENCE: Do headlines use locked mechanism name? Customer language? No forbidden words?
6. PRESET INTEGRITY: Does each config follow its preset's specific visual rules?

Score each dimension 0-100. Output valid JSON:
{
  "score": 0,
  "passed": true,
  "dimensions": {
    "visual_identity": 0,
    "product_accuracy": 0,
    "campaign_consistency": 0,
    "awareness_lock": 0,
    "text_overlay_congruence": 0,
    "preset_integrity": 0
  },
  "driftReport": [
    { "location": "config_id / field", "expected": "what Brand DNA requires", "found": "what was written", "severity": "CRITICAL|WARNING|MINOR" }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific fix instructions"
}`,
  congruenceThreshold: 80,
};

export default gate8;
