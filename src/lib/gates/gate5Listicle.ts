// ============================================================
// GATE 5 — LISTICLE (scaffold)
// Numbered-list ad format. Each list item maps to one screenshot-style
// image. iPhone-Notes / Reddit-screenshot / handwritten aesthetic.
// TODO: flesh out sub-agents when user is ready to ship listicles.
// ============================================================

import { GateConfigDef } from './types';
import { DR_COPY_RULES } from '../learning/drPrinciples';

const gate5Listicle: GateConfigDef = {
  id: 'gate5',
  description: 'Listicle Ad — numbered list format with screenshot-style images',

  subAgents: [
    {
      id: 'listicle-drafter',
      name: 'Listicle Drafter',
      model: 'opus',
      systemPrompt: (project) => `You write DR listicle ads. Numbered list, 5-9 items, each item = one mini-story or one specific claim backed by a concrete detail. iPhone-Notes voice, not marketing voice.

${DR_COPY_RULES}

PRODUCT: ${project.name || project.productDescription}
TARGET MARKET: ${project.targetMarket}`,
      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
        return `PRODUCT: ${project.productDescription}
FUNNEL: ${project.selectedFunnel || 'problem_aware'}

GATE 1 context:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 3000) : 'n/a'}

GATE 3 context:
${g3 ? JSON.stringify(g3, null, 2).slice(0, 2000) : 'n/a'}

Output JSON:
{
  "title": "the list headline — ≤12 words, curiosity-driven",
  "items": [
    { "number": 1, "headline": "≤10 words", "body": "30-60 words, specific detail, one concrete number or name", "image_beat": "what the accompanying screenshot/image should show" }
  ],
  "close": "2-3 line soft close, redirect not sell"
}

RULES: 5-9 items. Item 1 must pattern-interrupt. Save the product reveal for item 4+ or inside close.`;
      },
    },
  ],

  generatorPrompt: (project) =>
    `Polish the listicle. Keep the numbered structure. Output JSON with final_en${project.targetLanguage !== 'en-US' ? ` and final_${project.targetLanguage} (native rewrite)` : ''}.`,

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    return `Draft:
${subAgentOutputs?.['listicle-drafter'] || 'n/a'}

Produce final polished listicle in JSON.`;
  },

  reviewerPrompt: `Review the listicle. Dimensions (each /10, pass ≥75):
1. Title hook, 2. Item specificity, 3. Verbatim usage, 4. No marketing tells, 5. Product reveal timing, 6. Close is soft not salesy, 7. Image beats are organic not studio, 8. Mobile-legibility (short lines), 9. Funnel-awareness match, 10. Reddit test.
JSON: { score, maxScore:100, dimensions:[...], feedback, passed }.`,
  reviewCriteria: `Pass ≥75/100.`,
  reviewThreshold: 75,
  hasCongruenceCheck: true,

  congruencePrompt: `You are the Brand DNA Congruence Agent for the listicle copy format. Listicles drift easily into generic clickbait — your job is to lock the voice, mechanism, and customer language to Brand DNA.

CHECK THE LISTICLE AGAINST BRAND DNA:

1. VOICE PROFILE MATCH (25%):
   - Title + item hooks match voice_profile formality and emotional_tone?
   - No generic clickbait phrasing that clashes with the brand voice?
   - Close matches emotional_arc resolution_emotion?

2. CUSTOMER LANGUAGE COMPLIANCE (25%):
   - Every item uses always_use vocabulary where natural?
   - ZERO never_use words/phrases anywhere (scan every line)?
   - Conditional_use terms only in allowed contexts?

3. LOCKED TERMS RESPECTED (25%):
   - mechanism_name used exactly when referenced (no paraphrase)?
   - product_descriptor correct?
   - guarantee_wording exact when mentioned?
   - 3 mechanism steps named correctly?

4. MECHANISM & BELIEF ALIGNMENT (15%):
   - Listicle items align with belief_error and root_cause framing?
   - Product reveal ties into the locked mechanism, not a generic feature?

5. CROSS-GATE CONSISTENCY (10%):
   - Hooks and items align with Gate 4 copy arsenal?
   - Sub-avatar language consistent with Gate 2?

Flag EVERY deviation:
- CRITICAL: Wrong mechanism name, never_use word found, fabricated claim
- WARNING: Voice drift, missing always_use words, generic phrasing
- MINOR: Formality shift, minor vocabulary deviation

Respond in valid JSON:
{
  "score": 0,
  "passed": false,
  "dimensions": {
    "voice_profile_match": 0,
    "customer_language_compliance": 0,
    "locked_terms_respected": 0,
    "mechanism_belief_alignment": 0,
    "cross_gate_consistency": 0
  },
  "driftReport": [
    { "location": "item N / title / close / etc.", "expected": "what Brand DNA says", "found": "what this listicle contains", "severity": "CRITICAL|WARNING|MINOR" }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific fixes by item",
  "iteration": 0
}`,

  congruenceThreshold: 75,
};

export default gate5Listicle;
