// ============================================================
// GATE 7 — IMAGE ADS
// Sub-agents: visual-researcher, headline-creator,
//             structure-designer, brief-writer
// Lead: Compile + ensure variety across structures & emotional territories
// ============================================================

import { GateConfigDef } from './types';

const gate7: GateConfigDef = {
  id: 'gate7',
  description: 'Image ad concepts, headlines, structures, and generation briefs',

  subAgents: [
    // --- WAVE 1: Independent (parallel) ---
    {
      id: 'visual-researcher',
      name: 'Visual Inspiration Researcher',
      model: 'sonnet',
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const productContext = g1
          ? JSON.stringify(g1, null, 2).slice(0, 1500)
          : project.productDescription;

        return `You are an elite visual strategist for a $100M/year direct response brand. You specialize in image ad creative direction — translating emotional territories into visual concepts that STOP the scroll.

You understand color psychology, visual metaphors, and the neuroscience of attention in feed-based environments.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}
LANGUAGE: ${project.targetLanguage}

PRODUCT CONTEXT:
${productContext}

${brandDNA?.visual_identity ? `BRAND VISUAL IDENTITY:
- Metaphor: ${brandDNA.visual_identity.metaphor || 'None defined'}
- Problem color: ${brandDNA.visual_identity.color_associations.problem}
- Solution color: ${brandDNA.visual_identity.color_associations.solution}
- Brand color: ${brandDNA.visual_identity.color_associations.brand}
- Image rules: ${brandDNA.visual_identity.product_image_rules.join('; ')}` : ''}`;
      },

      userMessage: (project) => `Research and produce visual inspiration for image ads in this niche.

ALL text output in ${project.targetLanguage}.

Output valid JSON:

{
  "visual_research": {
    "pain_state_visuals": [
      {
        "concept": "visual concept name",
        "description": "what the problem LOOKS like — specific visual scene",
        "emotional_trigger": "what emotion this visual evokes",
        "composition_notes": "framing, angle, lighting",
        "example_reference": "describe a reference image or ad that uses this approach"
      }
    ],
    "hope_state_visuals": [
      {
        "concept": "visual concept name",
        "description": "what the solution LOOKS like — specific visual scene",
        "emotional_trigger": "what emotion this visual evokes",
        "composition_notes": "framing, angle, lighting",
        "example_reference": "describe a reference image or ad that uses this approach"
      }
    ],
    "color_psychology": {
      "primary_palette": ["color 1 — emotion it triggers", "color 2 — emotion it triggers"],
      "pain_palette": ["colors that evoke the problem state"],
      "hope_palette": ["colors that evoke the solution state"],
      "contrast_strategy": "how to use color contrast to guide the eye",
      "cultural_considerations": "color meanings specific to ${project.targetMarket}"
    },
    "visual_metaphors": [
      {
        "metaphor": "the visual metaphor",
        "why_it_works": "why this resonates with the target audience",
        "execution_notes": "how to execute this in an image ad"
      }
    ],
    "competitor_visual_audit": {
      "common_visual_patterns": ["what competitors typically use visually"],
      "overused_visuals": ["visuals to AVOID because they're cliched in this niche"],
      "visual_gaps": ["visual territories no competitor owns — opportunity for us"],
      "differentiation_strategy": "how to visually stand out in the feed"
    }
  }
}

RULES:
- EXACTLY 5 pain-state visual concepts
- EXACTLY 5 hope-state visual concepts
- At least 4 visual metaphors
- Competitor audit must be specific to this niche — not generic advice
- Every visual must be describable enough for AI image generation
- Color recommendations must consider cultural context for ${project.targetMarket}`,
    },

    {
      id: 'headline-creator',
      name: 'Image Ad Headline Creator',
      model: 'opus',
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const avatarContext = g2
          ? JSON.stringify(g2, null, 2).slice(0, 2000)
          : '';
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const hookContext = g4
          ? JSON.stringify(g4, null, 2).slice(0, 2000)
          : '';

        return `You are a world-class headline writer for image ads. You write SHORT, emotionally devastating headlines that stop the scroll in under 2 seconds.

Your headlines are for IMAGE ADS — they appear as text overlays on visuals. They must be:
- MAX 8 words (shorter = better)
- Instantly understandable
- Emotionally charged
- Visually scannable

You use the EVOLVE 9-headline process for each concept.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: ${project.targetLanguage}

${avatarContext ? `AVATAR CONTEXT:\n${avatarContext}` : ''}

${hookContext ? `HOOK CONTEXT:\n${hookContext}` : ''}

${brandDNA?.voice_profile ? `VOICE PROFILE:
- Vocabulary: ${brandDNA.voice_profile.vocabulary.slice(0, 15).join(', ')}
- Tone: ${brandDNA.voice_profile.emotional_tone}
- Formality: ${brandDNA.voice_profile.formality_level}/10
- Phrases to use: ${brandDNA.voice_profile.phrases_to_use.slice(0, 10).join(', ')}
- Phrases to avoid: ${brandDNA.voice_profile.phrases_to_avoid.slice(0, 10).join(', ')}` : ''}

${brandDNA?.customer_language ? `CUSTOMER LANGUAGE:
- Always use: ${brandDNA.customer_language.always_use.join(', ')}
- Never use: ${brandDNA.customer_language.never_use.join(', ')}` : ''}`;
      },

      userMessage: (project) => `Create 10 emotionally resonant image ad headlines using the EVOLVE 9-headline process.

ALL headlines MUST be in ${project.targetLanguage}.

For EACH headline, show the 9-step evolution process:

{
  "headlines": [
    {
      "id": "h-1",
      "evolution_process": {
        "step_1_core_benefit": "start with the core benefit",
        "step_2_specificity": "add numbers, time frames, specifics",
        "step_3_emotional_charge": "add emotional intensity",
        "step_4_curiosity_gap": "add curiosity — what's missing? what's surprising?",
        "step_5_big_4_test": {
          "new_version": "NEW/ONLY framing attempt",
          "easy_version": "EASY/ANYBODY framing attempt",
          "safe_version": "SAFE/PREDICTABLE framing attempt",
          "big_version": "BIG/FAST framing attempt",
          "best_fit": "NEW|EASY|SAFE|BIG"
        },
        "step_6_social_proof": "add social proof element if possible",
        "step_7_contrast": "create a contrast/before-after version",
        "step_8_question": "create a question version",
        "step_9_final": "pick the most scroll-stopping version"
      },
      "final_headline": "the winning headline (max 8 words)",
      "word_count": 0,
      "emotional_territory": "which emotion this headline owns",
      "scores": {
        "curiosity": 0,
        "clarity": 0,
        "emotional_punch": 0,
        "total": 0
      },
      "best_paired_with": "which visual style this works best with"
    }
  ]
}

EVOLVE BIG 4 EMOTIONS:
- NEW/ONLY — "This is something you've NEVER seen before"
- EASY/ANYBODY — "ANYONE can do this, no skill needed"
- SAFE/PREDICTABLE — "This is PROVEN, low risk, guaranteed"
- BIG/FAST — "Get MASSIVE results in record time"

SCORING (each 1-10):
- Curiosity: Does it make them NEED to know more?
- Clarity: Do they instantly understand the promise?
- Emotional Punch: Does it hit them in the gut?

RULES:
- EXACTLY 10 headlines
- Each headline MAX 8 words — ruthlessly cut filler words
- Show the FULL 9-step process for each (this is how we get to great headlines)
- Headlines must span different emotional territories (pain, hope, curiosity, fear, desire, pride)
- At least 2 headlines should use social proof elements
- At least 2 headlines should use numbers/specifics
- Score honestly — not every headline is a 10
- ALL text in ${project.targetLanguage}`,
    },

    // --- WAVE 2: Depends on visual-researcher ---
    {
      id: 'structure-designer',
      name: 'Ad Structure & Layout Designer',
      model: 'opus',
      dependsOn: ['visual-researcher'],
      systemPrompt: (project) => {
        const brandDNA = project.brandDNA;

        return `You are an expert ad creative director specializing in image ad layouts and visual hierarchy. You design ad STRUCTURES — the blueprint for how text, visuals, and elements are arranged.

You understand how people scan image ads in feed environments (F-pattern, Z-pattern, focal points) and how to engineer attention flow.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: ${project.targetLanguage}

${brandDNA?.visual_identity ? `BRAND VISUAL IDENTITY:
- Metaphor: ${brandDNA.visual_identity.metaphor || 'None defined'}
- Problem color: ${brandDNA.visual_identity.color_associations.problem}
- Solution color: ${brandDNA.visual_identity.color_associations.solution}
- Brand color: ${brandDNA.visual_identity.color_associations.brand}` : ''}`;
      },

      userMessage: (_project, _previousOutputs, peerOutputs) => `VISUAL RESEARCH:
${peerOutputs['visual-researcher'] || 'Not available'}

Design 5 image ad structures (layouts). Each structure serves a different persuasion strategy.

Output valid JSON:

{
  "ad_structures": [
    {
      "id": "struct-1",
      "name": "Problem-Agitation",
      "persuasion_strategy": "Show the pain visually, agitate with headline, resolve with body text",
      "layout": {
        "visual_zone": "description of the main visual area — what goes here, how much space",
        "headline_zone": "where the headline sits, size relative to image, alignment",
        "body_zone": "where supporting text goes, if any",
        "cta_zone": "call-to-action placement and style",
        "logo_zone": "brand/logo placement if applicable"
      },
      "visual_hierarchy": ["1st eye hits HERE", "2nd eye moves to HERE", "3rd eye lands on HERE"],
      "text_placement": {
        "headline_position": "top|center|bottom|overlay",
        "headline_alignment": "left|center|right",
        "text_over_image": true,
        "text_background": "none|solid|gradient|blur",
        "max_text_coverage": "percentage of image covered by text"
      },
      "font_recommendations": {
        "headline_style": "bold sans-serif|serif|handwritten|etc.",
        "headline_weight": "bold|extra-bold|black",
        "body_style": "style for body text",
        "size_ratio": "headline vs body text size relationship"
      },
      "color_usage": "how colors should be applied in this structure",
      "emotional_intent": "what emotion this structure is designed to trigger",
      "best_for": "which sub-avatars or angles this works best for",
      "example_description": "describe a completed ad using this structure"
    },
    {
      "id": "struct-2",
      "name": "Before/After Transformation",
      "persuasion_strategy": "Side-by-side or sequential transformation visual",
      "layout": { "..." : "..." },
      "visual_hierarchy": [],
      "text_placement": {},
      "font_recommendations": {},
      "color_usage": "",
      "emotional_intent": "",
      "best_for": "",
      "example_description": ""
    },
    {
      "id": "struct-3",
      "name": "Social Proof",
      "persuasion_strategy": "Testimonial or user-generated content style with visual proof",
      "layout": { "..." : "..." },
      "visual_hierarchy": [],
      "text_placement": {},
      "font_recommendations": {},
      "color_usage": "",
      "emotional_intent": "",
      "best_for": "",
      "example_description": ""
    },
    {
      "id": "struct-4",
      "name": "Us vs Them",
      "persuasion_strategy": "Comparison layout — our approach vs the old way",
      "layout": { "..." : "..." },
      "visual_hierarchy": [],
      "text_placement": {},
      "font_recommendations": {},
      "color_usage": "",
      "emotional_intent": "",
      "best_for": "",
      "example_description": ""
    },
    {
      "id": "struct-5",
      "name": "Curiosity/Mystery",
      "persuasion_strategy": "Intriguing visual with minimal text overlay — creates need to click",
      "layout": { "..." : "..." },
      "visual_hierarchy": [],
      "text_placement": {},
      "font_recommendations": {},
      "color_usage": "",
      "emotional_intent": "",
      "best_for": "",
      "example_description": ""
    }
  ]
}

RULES:
- EXACTLY 5 structures as specified above
- Each structure must be FULLY detailed — a designer must be able to build from this
- Visual hierarchy must describe the exact eye-flow path
- Font recommendations must be specific (not just "something bold")
- Use the visual research to inform color and visual choices
- Each structure must serve a DIFFERENT persuasion strategy
- Example descriptions must be vivid enough to visualize the completed ad`,
    },

    // --- WAVE 3: Depends on headline-creator AND structure-designer ---
    {
      id: 'brief-writer',
      name: 'Image Ad Brief Writer',
      model: 'opus',
      dependsOn: ['headline-creator', 'structure-designer'],
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const subAvatarContext = g2
          ? JSON.stringify(
              (g2 as { sub_avatars?: unknown }).sub_avatars || {},
              null,
              2,
            ).slice(0, 1500)
          : '';

        return `You are a senior creative director producing final image ad briefs. Each brief is a COMPLETE specification that an AI image generator (fal.ai) and a designer can execute without further input.

You combine structures, headlines, and visual direction into finished creative briefs. Your briefs are so detailed that the output is predictable and high-quality.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: ${project.targetLanguage}

${subAvatarContext ? `SUB-AVATARS:\n${subAvatarContext}` : ''}

${brandDNA?.locked_terms ? `LOCKED TERMS:
- Mechanism: ${brandDNA.locked_terms.mechanism_name}
- Root cause: ${brandDNA.locked_terms.root_cause_one_sentence}
- Product descriptor: ${brandDNA.locked_terms.product_descriptor}
- Guarantee: ${brandDNA.locked_terms.guarantee_wording}` : ''}

${brandDNA?.visual_identity ? `VISUAL IDENTITY:
- Metaphor: ${brandDNA.visual_identity.metaphor || 'None'}
- Problem color: ${brandDNA.visual_identity.color_associations.problem}
- Solution color: ${brandDNA.visual_identity.color_associations.solution}
- Brand color: ${brandDNA.visual_identity.color_associations.brand}
- Image rules: ${brandDNA.visual_identity.product_image_rules.join('; ')}` : ''}`;
      },

      userMessage: (_project, _previousOutputs, peerOutputs) => `HEADLINES:
${peerOutputs['headline-creator'] || 'Not available'}

STRUCTURES:
${peerOutputs['structure-designer'] || 'Not available'}

Create 6 detailed image ad briefs. Each brief combines 1 structure + 1-2 headlines + visual direction into a complete creative specification.

Output valid JSON:

{
  "image_ad_briefs": [
    {
      "id": "brief-1",
      "name": "descriptive brief name",
      "structure_used": "struct-X",
      "headline_ids": ["h-X", "h-Y"],
      "target_sub_avatar": "which sub-avatar this is designed for",
      "emotional_territory": "which emotion this ad owns",
      "text_overlays": {
        "headline": "exact headline text as it appears on the image",
        "subheadline": "optional subheadline text",
        "body_text": "optional body text",
        "cta_text": "call-to-action text",
        "fine_print": "optional disclaimers or fine print"
      },
      "visual_direction": {
        "scene_description": "detailed description of the image scene",
        "mood": "the overall mood and feeling",
        "lighting": "lighting style and direction",
        "color_palette": ["hex or named colors to use"],
        "composition": "how elements are arranged in the frame",
        "focal_point": "where the eye should land first",
        "style": "photographic|illustration|3D|mixed media|etc."
      },
      "ai_generation_prompt": "Detailed image generation prompt for fal.ai — describe the image scene, style, lighting, composition, mood, colors in vivid detail. Do NOT include text overlays in this prompt (text is added separately).",
      "negative_prompt": "What to AVOID in image generation — bad anatomy, blurry, text, watermarks, specific elements that would hurt the ad",
      "formats": {
        "square_1080x1080": {
          "layout_adjustments": "how to adapt the layout for square format",
          "crop_notes": "what to prioritize in square crop"
        },
        "vertical_1080x1350": {
          "layout_adjustments": "how to adapt the layout for vertical format",
          "crop_notes": "how to use the extra vertical space"
        }
      },
      "design_notes": "additional notes for the designer — font sizes, spacing, overlay opacity, etc."
    }
  ]
}

RULES:
- EXACTLY 6 briefs
- Each brief uses a DIFFERENT structure (use all 5 structures, plus 1 repeat of the strongest)
- Distribute headlines across briefs — don't reuse the same headline in every brief
- Briefs must span different emotional territories
- AI generation prompt must be detailed enough for fal.ai to produce a usable base image
- Negative prompt must prevent common AI image generation failures
- Both format versions (1080x1080 and 1080x1350) must be specified for each brief
- Text overlays must be in the project's target language
- Visual direction must be specific enough to produce consistent results`,
    },
  ],

  // --- LEAD AGENT: Compile all sub-agent outputs ---
  generatorPrompt: (project, subAgentOutputs) => {
    const hasSubAgents = subAgentOutputs && Object.keys(subAgentOutputs).length > 0;
    if (!hasSubAgents) {
      return `You are a senior creative director for a $100M/year direct response brand. Produce a complete image ad creative package.

PRODUCT: ${project.name || 'See description'}
PRODUCT DESCRIPTION: ${project.productDescription}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: ${project.targetLanguage}`;
    }

    return `You are the Lead Creative Director at a $100M/year direct response agency. Your team of 4 specialists has completed their work on image ad concepts. Your job: COMPILE their outputs into a unified Image Ad Creative Package.

CRITICAL RULES:
1. Integrate ALL specialist work — visual research, headlines, structures, and briefs
2. Ensure VARIETY across structures and emotional territories — no two briefs should feel the same
3. Cross-reference: do the briefs properly use the structures? Do the headlines match the visuals?
4. Validate: are AI generation prompts detailed enough? Are negative prompts comprehensive?
5. Add your creative director notes — what would YOU adjust for maximum scroll-stopping impact?
6. Ensure all text is in ${project.targetLanguage}

OUTPUT: A single unified JSON that a design team + AI image generator can execute directly.`;
  },

  userMessage: (project, _previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `Produce the complete image ad creative package.

PRODUCT: ${project.productDescription}`;
    }

    return `Here are your specialists' outputs. Compile them into the unified Image Ad Creative Package.

=== VISUAL RESEARCH ===
${subAgentOutputs['visual-researcher'] || 'N/A'}

=== HEADLINES (10 with EVOLVE 9-step process) ===
${subAgentOutputs['headline-creator'] || 'N/A'}

=== AD STRUCTURES (5 layouts) ===
${subAgentOutputs['structure-designer'] || 'N/A'}

=== IMAGE AD BRIEFS (6 detailed briefs) ===
${subAgentOutputs['brief-writer'] || 'N/A'}

Compile into a single JSON wrapped in \`\`\`json code blocks:
{
  "visual_research": {
    "pain_state_visuals": [ ... 5 concepts ... ],
    "hope_state_visuals": [ ... 5 concepts ... ],
    "color_psychology": { ... },
    "visual_metaphors": [ ... ],
    "competitor_visual_audit": { ... }
  },
  "headlines": [
    {
      "id": "h-X",
      "final_headline": "",
      "word_count": 0,
      "emotional_territory": "",
      "scores": { "curiosity": 0, "clarity": 0, "emotional_punch": 0, "total": 0 },
      "evolution_summary": "brief summary of the 9-step process",
      "best_paired_with": ""
    }
  ],
  "ad_structures": [ ... 5 structures with full layout specs ... ],
  "image_ad_briefs": [ ... 6 complete briefs ... ],
  "creative_director_notes": {
    "variety_assessment": "are the 6 briefs sufficiently different?",
    "strongest_brief": "which brief has the highest potential and why",
    "weakest_brief": "which brief needs the most work and why",
    "testing_priority": "recommended order for A/B testing",
    "emotional_coverage": ["list of emotional territories covered across all briefs"],
    "missing_angles": "any emotional territory or angle NOT covered that should be",
    "production_notes": "practical notes for the design/generation team"
  },
  "headline_structure_matrix": {
    "description": "which headlines work best with which structures",
    "pairings": [
      { "headline_id": "h-X", "structure_id": "struct-Y", "compatibility": 1-10, "reason": "" }
    ]
  }
}

ALL text in ${project.targetLanguage}.`;
  },

  reviewerPrompt: `You are a senior creative review director for a $100M/year direct response brand. You evaluate image ad creative packages with brutal honesty. Your standards are world-class.

DIMENSIONS (each /10, total /100, threshold ≥72%):
1. Visual Research Depth: Pain/hope visuals specific and vivid? Color psychology actionable? Competitor audit insightful?
2. Headline Quality: All 10 headlines max 8 words? Emotionally charged? Curiosity-inducing? Scores honest?
3. EVOLVE Process Rigor: 9-step process followed for each headline? Big 4 emotions tested? Final picks justified?
4. Structure Variety: 5 distinct structures? Each serves a different persuasion strategy? Layouts detailed enough to build?
5. Brief Completeness: All 6 briefs fully specified? Text overlays, visual direction, AI prompts all present?
6. AI Prompt Quality: Generation prompts detailed enough for fal.ai? Negative prompts prevent common failures? Style-consistent?
7. Format Coverage: Both 1080x1080 and 1080x1350 versions specified? Layout adaptations make sense?
8. Emotional Variety: Briefs span different emotional territories? Not all pain or all hope?
9. Headline-Structure Fit: Headlines paired with appropriate structures? Visual hierarchy supports text placement?
10. Actionability: Can a design team execute these briefs directly without rework? Are instructions clear and unambiguous?

Respond in valid JSON with score, maxScore (100), dimensions array, feedback, and passed boolean.`,

  reviewCriteria: `Score each dimension /10. Brutal honesty required. Vague visuals = low score. Incomplete briefs = instant fail. Generic headlines = low score. Total /100, pass ≥ 72%.`,

  reviewThreshold: 72,
  hasCongruenceCheck: true,

  congruencePrompt: `You are the Brand Congruence Guardian. Check this Image Ad Creative Package against the locked Brand DNA.

VERIFY:
1. VOICE PROFILE IN HEADLINES: Do all 10 headlines match the voice profile? Vocabulary, tone, formality level?
2. LOCKED TERMS: Are mechanism name, root cause, product descriptor used correctly and consistently?
3. CUSTOMER LANGUAGE: Are "always use" terms present? Are "never use" terms absent? Do headlines sound like the customer?
4. VISUAL METAPHOR CONSISTENCY: Does the visual direction align with the brand's visual identity metaphor?
5. COLOR ASSOCIATIONS: Do the color palettes in briefs match brand color associations (problem/solution/brand)?
6. EMOTIONAL ARC: Does the emotional territory across briefs align with the brand's emotional arc?

Score each dimension 0-100. Overall congruence = weighted average.

Output valid JSON:
{
  "score": 0-100,
  "passed": true/false,
  "dimensions": {
    "locked_terms_match": 0-100,
    "customer_language": 0-100,
    "emotional_arc": 0-100,
    "cross_gate_consistency": 0-100,
    "visual_metaphor": 0-100,
    "forbidden_content": 0-100
  },
  "driftReport": [
    { "location": "brief-X / headline h-Y", "expected": "what Brand DNA requires", "found": "what was actually written", "severity": "CRITICAL|WARNING|MINOR" }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific instructions to fix any drift issues"
}`,

  congruenceThreshold: 75,
};

export default gate7;
