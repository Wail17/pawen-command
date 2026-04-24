// ============================================================
// GATE 5 — NATIVE AD (300-600 word story-driven primary text)
//
// Methodology (5 phases → collapsed to 5 sub-agents):
//   1. Diagnosis — awareness/stage/objection map + character choice
//   2. Story Elements — scene, specific trigger, sensory detail, named characters
//   3. Hooks & Close — pick 1 of 6 hook mechanisms, write 3 opening variants + soft close
//   4. Draft — weave everything into 300-600 words, fragmented, first-person
//   5. QA — verify organic feel, verbatim usage, skepticism beat, no marketing tells
//
// Lead: final polish + assembly + optional target-language rewrite.
// Reviewer: scoring on 10 DR-native dimensions.
// ============================================================

import { GateConfigDef } from './types';
import { EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { DR_COPY_RULES, DR_CREATIVE_RULES } from '../learning/drPrinciples';

// ---- Swipe examples (injected into every sub-agent for voice calibration) ----
// Example 1 references the Doctor Ad beat structure (not full reproduction).
// Examples 2 & 3 are original, written from scratch in the methodology's style.

const SWIPE_EXAMPLES = `=== NATIVE AD SWIPE EXAMPLES (voice reference — match THIS register, not marketing copy) ===

--- SWIPE 1: "The Doctor Ad" structural reference (authority/whistleblower + broken-system hook) ---
BEAT STRUCTURE (not verbatim):
1. Credentialed narrator confesses something the industry doesn't want said ("14 years prescribing X, and I'm done pretending...")
2. Specific turning-point patient — named, one sentence of visceral detail
3. The "broken system" reveal — why the default solution was designed to fail the reader
4. The accidental discovery — found while researching something else, not while selling
5. Mechanism named in 1 sentence (no lecture)
6. Soft close: "I can't share the source publicly — here's where I sent her"
Voice: conversational authority, admits professional guilt, zero hype, no superlatives.

--- SWIPE 2: Original — Reluctant Discoverer (sleep/gut niche, problem-aware) ---
I wasn't looking for another sleep thing. I have a drawer full of sleep things. Magnesium, the mouth tape, the weighted blanket my sister swore by — all of it.

What happened was this: my husband Daniele started making coffee at 6am because I'd stopped. Four months of staring at the ceiling at 3am will do that. You stop making coffee because you're too tired to stand up and also too tired to sleep. Which is a thing nobody tells you is possible.

Anyway. A woman at the pharmacy in Trastevere — late fifties, tired in the same specific way I was tired — saw me buying melatonin for the third time that month and said, in Italian, "that's not what you need." She told me it wasn't the sleep. It was what was happening two hours after dinner, every night, that I was ignoring because I'd been ignoring it for years.

I won't pretend I believed her. I went home and complained to Daniele about being cornered by a stranger.

Then I tried it. €38. Fourteen nights later I woke up on a Tuesday and realized I'd slept through.

That was in October. I'm writing this in April. I still keep the melatonin in the drawer — I don't need it, I just can't throw it away yet. If you've been staring at the ceiling and you know, deep down, it's not really about the sleep, this might be the thing.

--- SWIPE 3: Original — Mirror/Transformed Peer (skincare, solution-aware) ---
This is my face three weeks ago. I had it lasered in March. €1,400. The dermatologist told me it would "likely come back" but they usually don't say that out loud so I knew.

It came back in six weeks.

I'm 41. I've had melasma since my second pregnancy and I've tried — I'm not exaggerating — every prescription cream a dermatologist in Milan will write you. Hydroquinone, tretinoin, the combo one that burns, the French one my aunt sent. You know what I'm talking about if you're here.

What I didn't try, because it sounded stupid, was the thing about the gut. A friend of my husband's — a biochemist at Sapienza, not a wellness person — mentioned it at a dinner in November. He wasn't selling anything. He was explaining why his wife's rosacea had gone after she stopped a specific antibiotic.

The short version: the pigmentation isn't (only) in the skin. It's being fed from somewhere else. You can laser the surface forever and the thing making the surface will keep making it.

I'm not going to tell you this fixed everything. My face in the photo still has a smudge under the right eye. But the jaw and forehead are quiet for the first time since 2019, and I stopped wearing the concealer I've been wearing every single day since the baby.

If you've been lasered, or you're about to be, read the thing below before you book the next one.

=== END SWIPE EXAMPLES ===`;

const NATIVE_METHOD = `=== NATIVE AD METHOD (5 PHASES) ===

PHASE 1 — DIAGNOSIS
- Pick ONE character type: Mirror/Transformed Peer | Authority/Whistleblower | Caregiver | Reluctant Discoverer/Skeptic Convert | Insider | Accidental Expert.
- Pick ONE hook mechanism: Fear/Danger | Broken System | Authority/Credibility | Relatability/Mirror | Curiosity/Pattern Interrupt | Validation/Urgency.
- Match character + hook to funnel position (awareness level).

PHASE 2 — STORY ELEMENTS (all required)
- Specific scene (city, room, time, weather, other people named).
- One visceral sensory detail per emotional peak.
- Named secondary character (spouse, doctor, friend) — not anonymous.
- Exact numbers (€ price, months tried, time of day, age).
- At least one admitted skepticism moment BEFORE the transformation.

PHASE 3 — HOOKS & CLOSE
- 3 opening-line variants, each ≤25 words, pattern-interrupt.
- Soft close: redirect, not a sell. No "click now", no "limited time".
- Close leaves a door open: "I wrote down where I got it below" / "if that sounds like you, read this".

PHASE 4 — DRAFT (300-600 words)
- First-person. Pull verbatim phrases from VOC research into the body.
- NO bullet points. NO headers. NO marketing typography.
- Flow: hook → scene → conflict/frustration → unlikely turn → skepticism admitted → small specific proof → soft close.

FRAGMENTATION QUOTA (HARD REQUIREMENT — the draft will be rejected below quota):
- ≥ 3 ellipses ("...") used mid-thought or trailing off. NOT at sentence endings only.
- ≥ 2 "anyway"-type restart beats. In the target language. Examples: EN "Anyway." / "Anyway —" / "Whatever." · IT "Comunque." / "In ogni caso." / "Vabbè." · ES "Bueno." / "En fin." · FR "Bref." / "Enfin." — use as paragraph-reset after a tangent.
- ≥ 5 sentence fragments (single-word or incomplete lines standing alone as a paragraph or line). Examples: "Niente." "Four months." "Not a drop."
- ≥ 4 em-dashes used to break a thought mid-sentence (not just as parenthetical).
- ≥ 1 self-interrupted restart — a sentence that breaks off and restarts with a different framing. Example: "I mean — look, it's just — okay. Here's what happened." / IT "Cioè — guarda, è solo — va bene. Ecco cos'è successo."

FRAGMENTATION EXEMPLAR (aggressive register — match this density, not the polished version):
"I won't pretend I believed her. I didn't.
Went home. Complained to Daniele about being cornered by a stranger in a pharmacy. Who does that.
Anyway.
Tried it that Tuesday because — I don't know. Because I was tired of being tired. Because €38 is nothing when you've already spent €340. Because the woman at the pharmacy had that specific look.
Nothing the first week. Nothing the second.
Then... I don't know how to describe it. I woke up one morning and the thing I'd been waiting for — the jolt, the 3am — didn't happen. I lay there waiting for it. It didn't come.
That was October. It's April now."

PHASE 5 — QA CHECK (reject if any fail)
- Reddit test: could this pass as an organic post?
- Zero forbidden phrases ("Introducing...", "Transform your life...", "Say goodbye...", etc.)
- Verbatim quotes from VOC actually appear.
- Product name appears late (past 60% mark) or not at all.
- Numbers are specific, not vague.
- Named characters, not anonymous testimonials.

=== END NATIVE METHOD ===`;

const gate5Native: GateConfigDef = {
  id: 'gate5',
  description: 'Native Ad — 300-600 word story-driven primary text (organic DR)',

  subAgents: [
    // ---- 1. DIAGNOSIS ----
    {
      id: 'native-diagnosis',
      name: 'Native Ad Diagnostician',
      model: 'sonnet',
      systemPrompt: (project) => `You are a direct-response native-ad strategist. Diagnose the optimal character + hook + emotional entry for this specific product, sub-avatar, and funnel position.

${DR_COPY_RULES}

${NATIVE_METHOD}

PRODUCT: ${project.name || project.productDescription}
TARGET MARKET: ${project.targetMarket}
LANGUAGE: write in ENGLISH (translation/native-rewrite happens in lead phase).`,
      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
        return `PRODUCT: ${project.productDescription}
FUNNEL: ${project.selectedFunnel || 'problem_aware'}

GATE 1 (sub-avatar + verbatims):
${g1 ? JSON.stringify(g1, null, 2).slice(0, 4000) : 'n/a'}

GATE 2 (voice + pain/desire quotes):
${g2 ? JSON.stringify(g2, null, 2).slice(0, 3000) : 'n/a'}

GATE 3 (root cause + mechanism):
${g3 ? JSON.stringify(g3, null, 2).slice(0, 2500) : 'n/a'}

OUTPUT JSON:
{
  "character_type": "Mirror/Transformed Peer | Authority/Whistleblower | Caregiver | Reluctant Discoverer | Insider | Accidental Expert",
  "character_justification": "why this character fits this avatar + funnel",
  "narrator_profile": { "name": "", "age": 0, "city": "", "role": "", "one_line_identity": "" },
  "hook_mechanism": "Fear/Danger | Broken System | Authority | Relatability | Curiosity | Validation",
  "hook_justification": "why this mechanism + this funnel level",
  "primary_objection": "the #1 objection this ad must quietly dismantle",
  "emotional_entry_point": "the exact emotional state the reader is in when they see this",
  "skepticism_moment": "the admitted doubt the narrator will confess mid-story"
}`;
      },
    },

    // ---- 2. STORY ELEMENTS ----
    {
      id: 'native-story-elements',
      name: 'Native Ad Story Architect',
      model: 'opus',
      systemPrompt: (project) => `You extract the CONCRETE story elements a native ad needs. Specificity is the whole game — vague stories fail the Reddit test.

${DR_COPY_RULES}

PRODUCT: ${project.name || project.productDescription}
TARGET MARKET: ${project.targetMarket}

${SWIPE_EXAMPLES}`,
      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        return `PRODUCT: ${project.productDescription}
MARKET: ${project.targetMarket}

VOC PAIN/DESIRE QUOTES (must use these verbatims in body):
${g2 ? JSON.stringify((g2 as Record<string, unknown>)?.customer_language ?? g2, null, 2).slice(0, 4000) : 'n/a'}

Generate the concrete story skeleton:
{
  "scene": { "city_or_place": "", "time_of_day": "", "sensory_anchors": ["3-5 physical details — the pyjama on the nightstand, the 3am kitchen, etc."] },
  "trigger_moment": "the exact moment everything shifted — one sentence, visceral",
  "named_secondary_characters": [{ "name": "", "relationship": "", "role_in_story": "" }],
  "specific_numbers": { "price_eur_or_usd": "", "time_tried": "", "age": "", "other": [] },
  "failed_attempts": ["3-5 things they tried that didn't work — specific brands/classes, not generic"],
  "small_believable_proof": "the first specific sign it was working — not miraculous, just noticed",
  "verbatims_pulled": ["3-6 EXACT phrases from VOC to embed in body"],
  "emotional_peaks": [{ "moment": "", "sensory_detail": "" }]
}

Write in English. Specificity > eloquence.`;
      },
    },

    // ---- 3. HOOKS & CLOSE ----
    {
      id: 'native-hook-close',
      name: 'Native Hook & Close Writer',
      model: 'opus',
      systemPrompt: (project) => `You write openings and soft closes for organic-feeling native ads. Hooks must pattern-interrupt without screaming "ad". Closes must redirect, not sell.

${DR_COPY_RULES}

PRODUCT: ${project.name || project.productDescription}
TARGET MARKET: ${project.targetMarket}

${SWIPE_EXAMPLES}`,
      userMessage: (project, previousOutputs, subAgentOutputs) => {
        return `PRODUCT: ${project.productDescription}

DIAGNOSIS:
${subAgentOutputs?.['native-diagnosis'] || '(use product context)'}

STORY SKELETON:
${subAgentOutputs?.['native-story-elements'] || '(use product context)'}

Produce EXACTLY ${project.gateConfigs?.gate5?.hookCount ?? 3} hooks and EXACTLY ${project.gateConfigs?.gate5?.closeVariantCount ?? 2} closes.

Return JSON:
{
  "hook_variants": [
    { "variant": "A", "text": "opening ≤25 words", "mechanism": "Fear|BrokenSystem|Authority|Relatability|Curiosity|Validation|DataPoint|Confession", "why_it_stops_scroll": "" }
    // ... add one object per hook up to the requested count, labeling B, C, D...
  ],
  "soft_close_variants": [
    { "variant": "A", "text": "2-3 line close that redirects without selling", "pattern": "redirect|door-open|permission|peer-hand-off" }
    // ... add one object per close up to the requested count
  ],
  "recommended_hook": "letter of the strongest",
  "recommended_close": "letter of the strongest"
}

RULES:
- If count ≥ 4, the hooks MUST cover at least 3 distinct mechanisms (not all the same angle).
- Vary length across hooks (some 10-word punchy, some 22-word narrative).
- Vary entry mode (scene-in-media-res, confession, data point, dialogue, broken-system).

RULES:
- Hooks: no "Introducing", no "Are you tired of", no question marks (usually), no emoji.
- Closes: no "click now", no "limited time", no "buy today". Think "I wrote down where I got it below" / "if that sounds like you, read this".`;
      },
    },

    // ---- 4. DRAFT ----
    {
      id: 'native-draft',
      name: 'Native Ad Draft Writer',
      model: 'opus',
      systemPrompt: (project) => `You write the full 300-600 word native ad body. First-person, fragmented, specific. You are NOT writing marketing copy — you are writing a post a real person would write if they felt like sharing.

${DR_COPY_RULES}

${NATIVE_METHOD}

${SWIPE_EXAMPLES}

PRODUCT: ${project.name || project.productDescription}
TARGET MARKET: ${project.targetMarket}
Write in ENGLISH.`,
      userMessage: (project, previousOutputs, subAgentOutputs) => {
        return `DIAGNOSIS:
${subAgentOutputs?.['native-diagnosis'] || ''}

STORY SKELETON:
${subAgentOutputs?.['native-story-elements'] || ''}

HOOKS & CLOSE:
${subAgentOutputs?.['native-hook-close'] || ''}

PRODUCT DESCRIPTION:
${project.productDescription}

Write the full native ad. 300-600 words. Use the recommended hook as the opening line. Weave in story skeleton + verbatims. Close with the recommended soft close.

OUTPUT JSON:
{
  "native_ad_en": "the complete 300-600 word body, as one continuous first-person post. No headers. No bullets.",
  "word_count": 0,
  "opening_line": "the exact first sentence",
  "closing_line": "the exact last sentence",
  "verbatims_used": ["list of VOC phrases actually present in body"],
  "numbers_used": ["specific numbers present"],
  "named_characters": ["list of named secondary characters"],
  "skepticism_moment_excerpt": "the sentence where narrator admits doubt"
}`;
      },
    },

    // ---- 5. QA ----
    {
      id: 'native-qa',
      name: 'Native Ad QA Auditor',
      model: 'sonnet',
      systemPrompt: () => `You audit native ads for organic authenticity. You are ruthless about marketing tells, vague numbers, missing skepticism moments, and anything that breaks the Reddit test.

${DR_COPY_RULES}

${NATIVE_METHOD}`,
      userMessage: (project, previousOutputs, subAgentOutputs) => {
        return `Audit this draft. Return issues and a PASS/FAIL.

DRAFT:
${subAgentOutputs?.['native-draft'] || ''}

COUNT THE FRAGMENTATION MARKERS LITERALLY IN THE DRAFT (do not infer — count the actual characters/words):
- ellipsis_count: occurrences of "..." (three dots)
- anyway_restart_count: standalone restart words used as paragraph/line resets. Count only when the word is on its own line OR immediately followed by a period. EN: "Anyway." / IT: "Comunque." "Vabbè." "In ogni caso." / ES: "Bueno." "En fin." / FR: "Bref." "Enfin."
- sentence_fragment_count: lines/sentences with no verb OR standing as a 1-3 word sentence ("Niente." "Four months." "Not a drop.")
- em_dash_mid_thought_count: em-dashes used to interrupt a thought (not parenthetical pairs)
- self_interrupt_count: sentences that break off and restart ("I mean — look, it's just —")

QUOTA: ellipsis ≥3, anyway ≥2, fragment ≥5, em_dash ≥4, self_interrupt ≥1.

If ANY count is below quota → rewrite_required = true AND add a specific suggested_fix naming the missing marker.

OUTPUT JSON:
{
  "reddit_test_pass": true,
  "forbidden_phrase_hits": [],
  "missing_elements": [],
  "specificity_score_0_100": 0,
  "verbatim_usage_score_0_100": 0,
  "skepticism_present": true,
  "marketing_tells": [],
  "fragmentation_counts": {
    "ellipsis_count": 0,
    "anyway_restart_count": 0,
    "sentence_fragment_count": 0,
    "em_dash_mid_thought_count": 0,
    "self_interrupt_count": 0
  },
  "fragmentation_quota_met": false,
  "rewrite_required": false,
  "suggested_fixes": []
}`;
      },
    },
  ],

  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `Write a 300-600 word first-person native ad for: ${project.name || project.productDescription}. Organic DR register. No marketing language.`;
    }
    return `You are the Lead Native Ad Editor. Sub-agents have produced diagnosis, story, hook/close, draft, and QA. Your job:

1. If QA flagged rewrite_required OR specificity_score < 70 OR verbatim_usage_score < 60 OR fragmentation_quota_met === false → rewrite the draft fixing ALL suggested_fixes AND meeting the fragmentation quota (ellipsis ≥3, anyway-restart ≥2, fragment ≥5, em-dash-mid-thought ≥4, self-interrupt ≥1). Localize restart beats to target language (IT "Comunque." / ES "Bueno." / FR "Bref.").
2. Otherwise, lightly polish the draft for rhythm and flow.
3. Produce the final ENGLISH version.
${project.targetLanguage !== 'en-US' ? `4. Produce a full NATIVE REWRITE in ${project.targetLanguage} — not translation, cultural adaptation. Swap named places, idioms, currency, local brand references.` : ''}

${DR_COPY_RULES}

RULES:
- Length 300-600 words in each language
- First-person throughout
- Keep the named secondary characters, specific numbers, skepticism moment
- NO headers, NO bullets, NO "Introducing"`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `Product: ${project.productDescription}\nWrite the native ad.`;
    }
    return `Sub-agent outputs:

=== DIAGNOSIS ===
${subAgentOutputs['native-diagnosis'] || 'n/a'}

=== STORY ELEMENTS ===
${subAgentOutputs['native-story-elements'] || 'n/a'}

=== HOOKS & CLOSE ===
${subAgentOutputs['native-hook-close'] || 'n/a'}

=== DRAFT ===
${subAgentOutputs['native-draft'] || 'n/a'}

=== QA ===
${subAgentOutputs['native-qa'] || 'n/a'}

You will produce the MAIN native ad AND EXACTLY ${Math.max(0, (project.gateConfigs?.gate5?.bodyVariantCount ?? 1) - 1)} additional FULL body variants (not just alt hooks — different narrative angles). Each variant ≥300 words. Variants must differ in: POV angle (narrator role), pacing (fast/slow reveal), hook mechanism. All must respect DR rules and fragmentation quota. If the count is 0, omit the "body_variants" array entirely.

Respond in valid JSON wrapped in \`\`\`json code blocks:
{
  "native_ad_en": "MAIN final polished 300-600 word English version",
  ${project.targetLanguage !== 'en-US' ? `"native_ad_${project.targetLanguage}": "MAIN full native rewrite in ${project.targetLanguage}",` : ''}
  "metadata": {
    "character_type": "",
    "hook_mechanism": "",
    "word_count_en": 0,
    ${project.targetLanguage !== 'en-US' ? `"word_count_${project.targetLanguage}": 0,` : ''}
    "verbatims_used": [],
    "named_characters": [],
    "opening_line": "",
    "closing_line": ""
  },
  "body_variants": [
    {
      "label": "Variant 2 — alternate narrator / angle",
      "character_type": "pick a DIFFERENT character type than main",
      "hook_mechanism": "pick a DIFFERENT mechanism than main",
      "pacing": "fast-reveal|slow-burn|in-media-res",
      "native_ad_en": "full 300-600 word body, DIFFERENT opening, DIFFERENT story arc than main",
      ${project.targetLanguage !== 'en-US' ? `"native_ad_${project.targetLanguage}": "full culturally-adapted version",` : ''}
      "word_count_en": 0
    },
    {
      "label": "Variant 3 — alternate narrator / angle",
      "character_type": "pick a THIRD character type",
      "hook_mechanism": "pick a THIRD mechanism",
      "pacing": "fast-reveal|slow-burn|in-media-res",
      "native_ad_en": "full 300-600 word body, DIFFERENT opening, DIFFERENT story arc than main and V2",
      ${project.targetLanguage !== 'en-US' ? `"native_ad_${project.targetLanguage}": "full culturally-adapted version",` : ''}
      "word_count_en": 0
    }
  ],
  "primary_text_variants": [
    "8 alternate opening hook lines from sub-agent — carry all 8 forward here so the creative team can A/B test"
  ],
  "soft_close_variants": ["4 close variants — carry all 4 forward"],
  "creative_brief_handoff": {
    "image_beats": [
      // Produce EXACTLY ${project.gateConfigs?.gate5?.imageBeatCount ?? 4} beats.
      // Pick from this menu, in this priority order — stop at the requested count:
      // 1. Problem Artifact — the object/scene they stare at (pyjama pile, receipts, 3am alarm)
      // 2. Private Evidence — something only they see (receipt handwriting, a text)
      // 3. Low Point — worst moment (bathroom floor, parking lot, kitchen 4am)
      // 4. Reveal / Product Shot — organic register, carousel pos 4+, NO competitor brands
      // 5. Failed Attempt Collage — graveyard of what didn't work
      // 6. Unlikely Messenger — source of breakthrough (friend, pharmacist)
      // 7. Small Proof Moment — first quiet sign it worked
      // 8. Return-to-Normal — resumed life detail (partner back in bed, coffee)
      // 9. Dialogue Moment — the sentence someone said that changed everything
      // 10. Calendar/Tally — visual of time passing or money counted
      { "id": "A", "label": "", "description": "" }
    ]
  }
}

HARD RULES on body_variants:
- Each variant must have a DIFFERENT character_type and DIFFERENT hook_mechanism than the main and than each other.
- Each variant must have a DIFFERENT opening line and different first scene.
- All variants must independently pass the fragmentation quota.
- Localized version required in ${project.targetLanguage !== 'en-US' ? project.targetLanguage : 'target language when applicable'}.`;
  },

  reviewerPrompt: `You are a veteran DR native-ad reviewer. Score on these 10 dimensions (each /10, total /100, pass ≥78):

${EVOLVE_COHERENCE_CHAIN}

1. Reddit test — would this pass as organic on r/[niche]?
2. Opening — pattern-interrupts in ≤25 words without "ad voice"?
3. Specificity — named places, numbers, brands, people (not vague)?
4. Verbatim usage — actual VOC phrases from Gate 2?
5. Skepticism beat — narrator admits doubt BEFORE transformation?
6. Character consistency — one voice start to finish, not drifting into marketing?
7. Soft close — redirects without selling, no "click now"/"limited time"?
8. Funnel awareness match — copy matches selected awareness level?
9. Forbidden-phrase check — zero "Introducing", "Transform your life", stacked adjectives, emoji decoration?
10. Fragmented authentic register — fragments, em-dashes, ellipses, "anyway..." — not polished corporate?

Respond JSON: { score, maxScore:100, dimensions:[{criterionId,name,score,maxScore,feedback}], feedback, passed }.`,
  reviewCriteria: `7=testable, 8=likely converts, 9=exceptional, 10=category-defining. Pass ≥78/100.`,
  reviewThreshold: 78,

  hasCongruenceCheck: true,
  congruencePrompt: `Check the native ad against upstream gates:
1. Sub-avatar voice match (Gate 1/2): does the narrator sound like the selected sub-avatar?
2. Mechanism name: if the product mechanism is named, does it match Brand DNA EXACTLY (no paraphrase)?
3. Root cause: if invoked, matches Gate 3?
4. Customer language: uses always_use list, avoids never_use?
5. Forbidden content: zero forbidden phrases from DR_COPY_RULES?

Score /100, threshold 75. JSON: { score, maxScore:100, checks:[...], violations:[...], passed }.`,
  congruenceThreshold: 75,
};

// Also expose the DR creative rules string so callers can inject it elsewhere.
export { DR_CREATIVE_RULES };
export default gate5Native;
