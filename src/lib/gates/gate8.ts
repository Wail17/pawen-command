// ============================================================
// GATE 8 — CREATIVE GENERATION
// Single-agent flow: fal.ai image generation configs + vision review
// No sub-agents — uses generatorPrompt/userMessage pattern directly
// ============================================================

import { GateConfigDef } from './types';

const gate8: GateConfigDef = {
  id: 'gate8',
  description: 'Generate static ads via fal.ai + vision review',

  // No sub-agents — single-agent flow

  generatorPrompt: (project) => `You are coordinating AI image generation for Meta Ad static creatives using fal.ai.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}

## MISSION
Take the validated image briefs from Gate 7 and create complete fal.ai generation configurations. For each image brief, produce:

1. **Model selection** — choose the best fal.ai model:
   - "fal-ai/flux-pro/v1.1" — photorealistic product shots, lifestyle imagery, realistic scenes
   - "fal-ai/flux/dev" — creative/artistic images, abstract concepts, stylized visuals

2. **Generation prompt** — detailed, specific prompt that captures:
   - Subject and composition
   - Lighting and mood
   - Color palette (aligned with brand)
   - Style and aesthetic
   - Camera angle / perspective
   - Background and environment

3. **Negative prompt** — elements to AVOID:
   - Text/watermarks (text overlay added post-generation)
   - Deformed anatomy, extra limbs
   - Low quality, blurry, pixelated
   - Brand-inappropriate content

4. **Dimensions** — based on ad placement:
   - Feed (1:1): width 1080, height 1080
   - Story/Reel (9:16): width 1080, height 1920

5. **Generation parameters**:
   - guidance_scale: 7.5 (balanced realism) or 3.5 (more creative freedom)
   - num_images: 2 (generate 2 variations per config)
   - seed: null (for variety)

6. **Vision review prompt** — for each image, generate a prompt to evaluate the generated output:
   - Does it match the brief intent?
   - Is the product accurately represented?
   - Is the composition effective for a scroll-stopping ad?
   - Are there AI artifacts or quality issues?

## OUTPUT FORMAT
Output valid JSON wrapped in \`\`\`json code blocks:
{
  "generation_configs": [
    {
      "id": "gen_1_feed",
      "source_brief_id": "brief_1",
      "format": "feed_1x1",
      "model": "fal-ai/flux-pro/v1.1",
      "prompt": "Complete, detailed generation prompt",
      "negative_prompt": "Complete negative prompt",
      "width": 1080,
      "height": 1080,
      "guidance_scale": 7.5,
      "num_images": 2,
      "seed": null,
      "vision_review_prompt": "Specific evaluation criteria for this image"
    },
    {
      "id": "gen_1_story",
      "source_brief_id": "brief_1",
      "format": "story_9x16",
      "model": "fal-ai/flux-pro/v1.1",
      "prompt": "Complete, detailed generation prompt (adjusted for vertical)",
      "negative_prompt": "Complete negative prompt",
      "width": 1080,
      "height": 1920,
      "guidance_scale": 7.5,
      "num_images": 2,
      "seed": null,
      "vision_review_prompt": "Specific evaluation criteria for this image"
    }
  ],
  "post_processing": {
    "text_overlay_required": true,
    "overlay_instructions": "Text must be added via separate tool — fal.ai does not reliably render text in images",
    "quality_checks": [
      "Resolution >= 1080px on shortest side",
      "No visible AI artifacts (extra fingers, warped text, melted edges)",
      "Product clearly visible and recognizable",
      "Brand color palette present",
      "Composition has clear focal point",
      "Mobile-friendly — key elements visible at small size"
    ]
  },
  "vision_review_summary": {
    "global_criteria": [
      "All images feel like one cohesive campaign",
      "Product representation consistent across all variants",
      "No image contradicts the brand positioning",
      "Each image has scroll-stop potential"
    ]
  },
  "total_configs": 0,
  "total_images_to_generate": 0
}

RULES:
- Minimum 12 generation configs (6 briefs x 2 formats)
- num_images: 2 per config = 24+ total image variations
- Text overlays are added post-generation, NOT in the prompt
- Seed: null for maximum variety
- Each prompt must be 50-150 words — specific enough to guide, not so long it confuses
- Negative prompts should always include: "text, watermark, logo, blurry, low quality, deformed"
- Vision review prompts must be specific to each image's intent`,

  userMessage: (project, previousOutputs) => {
    let msg = `Prepare all fal.ai image generation configs from the validated image briefs.\n`;

    if (previousOutputs['gate7']) {
      msg += `\n=== IMAGE AD BRIEFS (Gate 7) — source briefs for generation ===\n${JSON.stringify(previousOutputs['gate7'])}`;
    }
    if (previousOutputs['gate1']) {
      msg += `\n\n=== PRODUCT INTEL (Gate 1) — product details and reference images ===\n${JSON.stringify(previousOutputs['gate1'])}`;
    }
    if (previousOutputs['brand-dna']) {
      msg += `\n\n=== BRAND DNA — visual identity, colors, style constraints ===\n${JSON.stringify(previousOutputs['brand-dna'])}`;
    }

    msg += `\n\nGenerate the complete set of fal.ai configs. Wrap output in \`\`\`json code blocks.`;
    return msg;
  },

  reviewerPrompt: `You are a visual quality reviewer and AI image generation specialist for performance marketing static ads.

DIMENSIONS (each /10, total /70, threshold >=70%):
1. Prompt Quality: Are generation prompts specific, detailed, and likely to produce good results? Do they describe composition, lighting, mood, and style?
2. Model Selection: Is the correct fal.ai model chosen for each image type? Photorealistic vs creative matched appropriately?
3. Negative Prompt Coverage: Do negative prompts adequately prevent common AI artifacts and unwanted elements?
4. Format Coverage: Both feed (1:1) and story (9:16) formats generated for each brief? Prompts adjusted for aspect ratio?
5. Brand Alignment: Do prompts incorporate brand colors, visual identity, and campaign aesthetic?
6. Vision Review Prompts: Are evaluation prompts specific enough to catch quality issues? Do they reference the original brief intent?
7. Post-Processing Plan: Text overlay instructions clear? Quality checks comprehensive?

Respond in valid JSON:
\`\`\`json
{
  "score": 0,
  "maxScore": 70,
  "dimensions": [
    { "name": "Prompt Quality", "score": 0, "maxScore": 10, "feedback": "" }
  ],
  "feedback": "",
  "passed": false
}
\`\`\``,

  reviewCriteria: `Score each dimension /10. Prompts must be specific and actionable — vague prompts = low score. Total /70, pass >= 70%.`,

  reviewThreshold: 70,

  hasCongruenceCheck: true,
  congruencePrompt: `Brand DNA Congruence Agent for fal.ai generation configs.

CHECK (visual consistency with brand):
1. VISUAL IDENTITY: Do generation prompts reference brand colors, visual style, and aesthetic from Brand DNA?
2. PRODUCT ACCURACY: Do prompts describe the product accurately based on Gate 1 product profile?
3. CAMPAIGN CONSISTENCY: Will all generated images feel like one cohesive campaign? Consistent palette, mood, style?
4. BRAND POSITIONING: Do visual concepts align with brand positioning? No elements that contradict brand identity?
5. FORBIDDEN ELEMENTS: No visual elements from Brand DNA's "never use" list? No competitor visual territories?

Respond in valid JSON:
\`\`\`json
{
  "score": 0,
  "dimensions": [
    { "name": "Visual Identity", "score": 0, "maxScore": 20, "feedback": "" }
  ],
  "driftReport": [],
  "verdict": "pass|fail",
  "alignmentInstructions": ""
}
\`\`\``,
  congruenceThreshold: 80,
};

export default gate8;
