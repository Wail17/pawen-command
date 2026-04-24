// ============================================================
// PAWEN — DR Ecom Principles (hard-coded, non-negotiable)
//
// These rules govern EVERY creative and copy output in Pawen.
// Injected as a cached block into every sub-agent, lead, manager
// and director prompt via creativeContextAggregator + runGate.
//
// Why hard-coded and not learned: these are first principles of
// direct-response (not opinions). The user runs DR ecom at scale
// and we cannot afford agent drift on them.
//
// When user feedback reveals a new violation pattern, add it to
// LEARNED_VIOLATIONS below — the agents will avoid it thereafter.
// ============================================================

/**
 * Rules that apply to EVERY static/video/image output, regardless of
 * copy format (advertorial, native, listicle). The entire premise of
 * DR creative is that it looks like organic UGC, not brand marketing.
 */
export const DR_CREATIVE_RULES = `=== DR CREATIVE RULES (NEVER VIOLATE — applies to ALL formats) ===

ORGANIC > BRANDED. Every creative must pass the "Reddit test": could this image pass as an organic post a real person made? If no, it fails.

HARD RULES:
1. NO logo overlays, NO brand watermarks, NO "shop now" graphic buttons inside the image.
2. NO graphic-design clichés: no red circles around features, no yellow highlight arrows, no "BEFORE/AFTER" stamped labels, no stock icon sets, no clip-art badges ("SALE!", "NEW!").
3. NO studio lighting that screams commercial. Use natural/window/phone-flash light. Imperfect is better than polished.
4. NO perfectly centered/symmetric compositions. Slightly off-frame, hand-held feel, captured moments — not staged.
5. NO stock-image faces. Either real UGC or AI-generated faces that look like specific real people, not models.
6. Products appear in-context (on a messy counter, half-used, next to coffee) — never isolated on a white background with a drop shadow.
7. Text overlays (if any) must look like iPhone Notes screenshot, Reddit thread screenshot, or handwritten — never "ad copy typography" (no Poppins/Montserrat marketing headlines).
8. Before/afters must be candid: same angle, same phone, same light. Never studio side-by-side with professional color grading.

POSITIVE SIGNALS (what TO generate):
- POV first-person: hand holding product, foot in stocking, cream on finger
- "The evidence no one else sees": the bathroom floor, the pyjama on the nightstand, the bottle next to the toothbrush
- "The moment they're alone with it": 3am kitchen, car in the parking lot, mirror in bad light
- Documentary quality: harsh fluorescent office light, yellow tungsten bedroom, window backlight that flares
- Real-life clutter in frame: other products, crumbs, a phone charger, tissues

This applies even to "premium" brands. Even Dyson-tier DR creatives look caught-not-staged.

=== END DR CREATIVE RULES ===`;

/**
 * Rules for long-form ad copy (any format) — reinforces that the reader
 * must forget it's an ad. Injected into G4/G5/G6 agents.
 */
export const DR_COPY_RULES = `=== DR COPY RULES (NEVER VIOLATE) ===

VOICE: first-person, conversational, fragmented. Not corporate, not "we". The narrator is a specific person with a name, age, city.

FORBIDDEN:
- "Introducing..." / "Say goodbye to..." / "Transform your life..." / "Unlock the secret..."
- Marketing superlatives without proof (best, revolutionary, game-changing)
- Stacked adjectives ("premium, luxurious, high-quality")
- Emoji strings as decoration (✨💫🌟) — use sparingly, only if a real person would
- "Limited time only!" language in the body (scarcity goes at the close, earned)
- Feature lists as bullet points in body copy (bullets are for the offer section only)
- Perfect grammar/punctuation — allow sentence fragments, em-dashes, ellipses, "anyway..." transitions

REQUIRED:
- Specific numbers ("14 months", "€187", "3 AM", "7 nights") over vague ones ("a long time")
- Named secondary characters ("my husband Marco", "Dr. Rossi") over anonymous testimonials
- Sensory detail at emotional peaks (the sound of peeling the sheet off the skin)
- At least one moment of narrator self-doubt or admitted skepticism before the transformation
- Audience language: pull actual phrases from the VOC research, don't paraphrase

=== END DR COPY RULES ===`;

/**
 * Per-format override: what the image's JOB is for each copy format.
 * The visual register stays organic; only the purpose changes.
 */
export function copyFormatCreativeContext(
  format: 'advertorial' | 'native' | 'listicle' | 'skipped' | undefined,
): string {
  if (!format || format === 'skipped') {
    return `=== COPY FORMAT: NO LONG-FORM COPY (direct-to-creative) ===
The creative must do 100% of the job — hook + story compression + proof + CTA, all in-frame. Lean into strong scroll-stoppers and curiosity-gap captions.
=== END COPY FORMAT ===`;
  }

  if (format === 'advertorial') {
    return `=== COPY FORMAT: ADVERTORIAL (ZAK 7-block long-form sales page) ===
The creative's only job: STOP THE SCROLL and generate a click to the advertorial page. The ad copy is shortened — headline + 1-2 line primary text. The image carries the curiosity load.
Capture: scroll-stopper moment, "wait what's happening here?" beat, the visual hook that mirrors the advertorial's opening scene.
Do NOT show the product clearly in the hook image — reveal happens on the advertorial page.
=== END COPY FORMAT ===`;
  }

  if (format === 'native') {
    return `=== COPY FORMAT: NATIVE AD (300-600 word story primary text) ===
The ad copy IS the sale. The creative accompanies specific beats of the story. Carousel or single-image formats work; each image maps to one of:
(a) The thing they're staring at — the problem artifact (the soaked pyjama, the failed product graveyard)
(b) The evidence no one else sees — the private moment (bathroom at 3am, mirror in bad light)
(c) The moment they're alone with it — the low-point scene
Never reveal the product in the first image. Save it for image 3+ of a carousel, or as a supporting shot inside the story arc.
=== END COPY FORMAT ===`;
  }

  if (format === 'listicle') {
    return `=== COPY FORMAT: LISTICLE (numbered list ad) ===
Image per list item. Screenshot-style or caption-card. Each image must carry one numbered point and be legible on mobile at thumbnail size.
Use iPhone-Notes aesthetic, Reddit screenshot, or handwritten list — never marketing-typography.
=== END COPY FORMAT ===`;
  }

  return '';
}

/**
 * Learned violations — appended when user rejects outputs with specific
 * reasons. Feed captureRejection() into this array via
 * updateLearnedViolations() so future prompts include the block.
 *
 * Format: `- {rule}: {example of what was rejected}`
 * Kept short (max 20 entries, FIFO).
 */
export const LEARNED_VIOLATIONS: string[] = [
  // seeded from 2026-04-14 correction — user flagged that even ZAK must be organic
  '- Do not propose "polished studio" aesthetics for any format, including advertorial — all DR creative must look organic/UGC.',
];

/**
 * Build the full DR injection block for a given context.
 * Pass this into system prompts of creative-producing agents (G4, G5, G6, G7, G8).
 */
export function buildDRInjection(
  format: 'advertorial' | 'native' | 'listicle' | 'skipped' | undefined,
  options: { includeCreativeRules?: boolean; includeCopyRules?: boolean } = {},
): string {
  const { includeCreativeRules = true, includeCopyRules = true } = options;
  const parts: string[] = [];

  if (includeCreativeRules) parts.push(DR_CREATIVE_RULES);
  if (includeCopyRules) parts.push(DR_COPY_RULES);
  parts.push(copyFormatCreativeContext(format));

  if (LEARNED_VIOLATIONS.length > 0) {
    parts.push(
      `=== LEARNED VIOLATIONS (user has rejected these before — never repeat) ===\n${LEARNED_VIOLATIONS.join('\n')}\n=== END LEARNED VIOLATIONS ===`,
    );
  }

  return parts.join('\n\n');
}
