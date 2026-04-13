// ============================================================
// GATE 6 — AD SCRIPTS & COPY
// Sub-agents: concept-creator, body-copy-writer, headline-writer,
//             video-script-writer, speech-converter
// Lead: Compile concepts → body copies → headlines + video scripts
// ============================================================

import { GateConfigDef } from './types';
import { EVOLVE_EXECUTION_FRAMEWORK, EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { ZAK_SCRIPT_ANALYSIS, ZAK_QUALITY_GATES } from './zakFrameworks';

const gate6: GateConfigDef = {
  id: 'gate6',
  description: 'Ad concepts, body copies, headlines, and modular video scripts with natural speech conversion',

  subAgents: [
    // --- WAVE 1: Independent agents ---
    {
      id: 'concept-creator',
      name: 'Ad Concept Creator',
      model: 'opus',
      systemPrompt: (project) => `You are an elite Meta Ads creative strategist for a $100M/year direct response brand. You design ad concepts that stop the scroll and drive action.

Every concept must be anchored in a real emotional tension, a specific sub-avatar, and a clear psychological mechanism.

${ZAK_SCRIPT_ANALYSIS}

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const brandDNA = project.brandDNA;

        return `AVATAR DATA (Gate 2 — sub-avatars, angles, voice):
${g2 ? JSON.stringify(g2, null, 2).slice(0, 4000) : 'Not available — use product description'}

MECHANISM (Gate 3):
${g3 ? JSON.stringify(g3, null, 2).slice(0, 4000) : 'Not available'}

COPY ARSENAL (Gate 4 — hooks, open loops):
${g4 ? JSON.stringify(g4, null, 2).slice(0, 5000) : 'Not available'}

BRAND DNA — SUB-AVATARS:
${brandDNA?.sub_avatars ? JSON.stringify(brandDNA.sub_avatars, null, 2).slice(0, 4000) : 'Not available'}

## CREATE 5 AD CONCEPTS

Each concept must include:
1. **Name** — a memorable, internal reference name
2. **Target Sub-Avatar** — which specific sub-avatar this concept speaks to
3. **Angle Used** — the specific reason-to-buy driving this concept
4. **Psychological Mechanism** — WHY this concept works (System 1/2 triggers, mirror neurons, narrative transport, loss aversion, identity threat, etc.)
5. **Emotional Territory** — the dominant emotional space this concept occupies (fear, shame, hope, relief, belonging, etc.)
6. **Hook Direction** — the opening pattern interrupt — what stops the scroll
7. **Visual Direction** — what the viewer SEES (UGC, talking head, B-roll, split screen, text-on-screen, before/after)
8. **Body Copy Direction** — the narrative arc of the primary text

## RULES
- 5 concepts MUST span at least 3 DIFFERENT sub-avatars
- Each concept uses a DIFFERENT angle — no two concepts share the same reason-to-buy
- Concepts must cover a MIX of emotional territories (don't cluster all on pain or all on desire)
- Each psychological mechanism must be SPECIFIC and named, not vague ("creates curiosity" is unacceptable — "curiosity gap via incomplete pattern" is acceptable)
- Visual directions must be concrete and producible
- All content in ${project.targetLanguage}

Output valid JSON:
{
  "ad_concepts": [
    {
      "id": "concept-1",
      "name": "",
      "target_sub_avatar_id": "",
      "target_sub_avatar_name": "",
      "angle": "",
      "psychological_mechanism": "MUST be one of ZAK's 8: System1/2, COM-B, SDT, Narrative Transportation, Processing Fluency, Loss Aversion, Villain Externalization, Future Pacing",
      "why_it_works": "",
      "emotional_territory": "",
      "copy_format": "PAS|AIDA|SPS|4P|BAB|Problem Stack — selected based on awareness level",
      "hook_direction": "",
      "visual_direction": "",
      "body_copy_direction": "",
      "best_format": "UGC|talking-head|voiceover-broll|slideshow|before-after",
      "estimated_awareness_level": "problem-aware|solution-aware|product-aware"
    }
  ],
  "concept_diversity_check": {
    "sub_avatars_used": ["list of unique sub-avatar IDs"],
    "angles_used": ["list of unique angles"],
    "emotional_territories": ["list of unique territories"],
    "diversity_score": "self-assessment 1-10"
  }
}`;
      },
    },

    {
      id: 'video-script-writer',
      name: 'Modular Video Script Writer',
      model: 'opus',
      systemPrompt: (project) => `You are a world-class video ad scriptwriter specializing in direct response Meta Ads. You write modular video scripts using the EVOLVE framework where every component is independently testable.

Your scripts produce REAL results because they combine emotional storytelling with direct response mechanics.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const brandDNA = project.brandDNA;

        return `AVATAR DATA (Gate 2):
${g2 ? JSON.stringify(g2, null, 2).slice(0, 3000) : 'Not available'}

MECHANISM (Gate 3):
${g3 ? JSON.stringify(g3, null, 2).slice(0, 4000) : 'Not available'}

HOOKS & COPY ARSENAL (Gate 4):
${g4 ? JSON.stringify(g4, null, 2).slice(0, 4000) : 'Not available'}

VOICE PROFILE:
${brandDNA?.voice_profile ? JSON.stringify(brandDNA.voice_profile, null, 2) : 'Not available'}

## WRITE 2 COMPLETE VIDEO SCRIPTS — EVOLVE MODULAR FRAMEWORK

### MODULAR VIDEO SCRIPT STRUCTURE (per script):
- **3 HOOKS** (first 1-3 seconds each — pattern interrupt)
- **3 BRIDGES** (5-10 seconds each — connects hook to hold)
- **1 HOLD** (main content — 30-60 seconds — problem, mechanism, solution)
- **1 CTA** (call to action — 5-10 seconds)

This creates 3x3 = 9 possible hook-bridge combinations per script.
Each hook MUST work with ANY bridge. Each bridge MUST work with the hold.

### SCRIPT 1: PAIN-FOCUSED (UGC-style, talking head)
- Opens with raw, visceral pain
- The speaker is someone who HAS the problem and discovered the solution
- Tone: vulnerable, real, slightly messy
- Energy: starts low/frustrated, builds to hopeful, ends confident

### SCRIPT 2: TRANSFORMATION-FOCUSED (before/after, demonstration)
- Opens with the "after" state or a dramatic result
- Shows the contrast between before and after
- Tone: excited, proof-driven, demonstrative
- Energy: starts high, dips for the "before" story, rises for the transformation

### HOOK TYPES (3 per script):
- Hook A: Pain-led (start with the problem, vivid and raw)
- Hook B: Story-led (start mid-narrative, create intrigue)
- Hook C: Result-led (start with transformation, reverse engineer)

### BRIDGE TYPES (3 per script):
- Bridge A: "Here's why..." (educational transition)
- Bridge B: "That's when I discovered..." (story transition)
- Bridge C: "But what if..." (curiosity transition)

### HOLD STRUCTURE:
1. Root cause explanation (simplified, visual)
2. Mechanism introduction (branded name, 3 steps)
3. Quick proof (stat, testimonial, or visual demo)
4. Transformation moment (future pacing)

### CTA OPTIONS:
- Soft: "If you want to learn more..."
- Direct: "Click the link below to see if [mechanism] could work for you"
- Urgency (only if real): "They're running low on stock..."

### SCRIPT FORMAT — Each line includes:
- [TIMING] — timestamp (e.g., "0:00-0:03")
- [VISUAL] — what's on screen
- [AUDIO] — what's being said (written speech)
- [TEXT] — on-screen text overlay suggestions
- [TONE] — energy/emotion for that moment

## RULES
- Each script: 45-90 seconds total
- Hooks: 1-3 seconds each, must STOP the scroll
- Bridges: 5-10 seconds, must smoothly connect to hold
- Hold: 30-60 seconds, carries the persuasion payload
- Every hook must work independently with every bridge
- Include specific numbers, dates, details — never vague
- Reference mechanism by branded name from Gate 3
- All content in ${project.targetLanguage}

Output valid JSON:
{
  "video_scripts": [
    {
      "id": "vs-1",
      "title": "",
      "style": "pain-focused-ugc",
      "target_sub_avatar": "",
      "total_duration_seconds": 0,
      "hooks": [
        {
          "id": "vs1-hook-a",
          "type": "pain-led",
          "timing": "0:00-0:03",
          "audio": "",
          "visual": "",
          "text_overlay": "",
          "tone": ""
        },
        { "id": "vs1-hook-b", "type": "story-led", "timing": "", "audio": "", "visual": "", "text_overlay": "", "tone": "" },
        { "id": "vs1-hook-c", "type": "result-led", "timing": "", "audio": "", "visual": "", "text_overlay": "", "tone": "" }
      ],
      "bridges": [
        {
          "id": "vs1-bridge-a",
          "type": "educational",
          "timing": "",
          "audio": "",
          "visual": "",
          "text_overlay": "",
          "tone": ""
        },
        { "id": "vs1-bridge-b", "type": "story", "timing": "", "audio": "", "visual": "", "text_overlay": "", "tone": "" },
        { "id": "vs1-bridge-c", "type": "curiosity", "timing": "", "audio": "", "visual": "", "text_overlay": "", "tone": "" }
      ],
      "hold": {
        "timing": "",
        "sections": [
          { "label": "root_cause", "audio": "", "visual": "", "text_overlay": "", "tone": "", "duration_seconds": 0 },
          { "label": "mechanism", "audio": "", "visual": "", "text_overlay": "", "tone": "", "duration_seconds": 0 },
          { "label": "proof", "audio": "", "visual": "", "text_overlay": "", "tone": "", "duration_seconds": 0 },
          { "label": "transformation", "audio": "", "visual": "", "text_overlay": "", "tone": "", "duration_seconds": 0 }
        ],
        "total_duration_seconds": 0
      },
      "cta": {
        "timing": "",
        "type": "soft|direct|urgency",
        "audio": "",
        "visual": "",
        "text_overlay": "",
        "tone": "",
        "duration_seconds": 0
      },
      "delivery_notes": {
        "energy_arc": "",
        "pace": "",
        "emphasis_words": [],
        "emotional_shifts": []
      }
    }
  ]
}`;
      },
    },

    // --- WAVE 2: Depends on concept-creator ---
    {
      id: 'body-copy-writer',
      name: 'Meta Ads Body Copy Writer',
      model: 'opus',
      dependsOn: ['concept-creator'],
      systemPrompt: (project) => `You are an elite direct response copywriter specializing in Meta Ads primary text. You write body copies that combine emotional storytelling with proven DR mechanics.

You follow the EVOLVE OCPB cycle: Open -> Content -> Payoff -> Bridge. Every sentence earns the next.

${ZAK_QUALITY_GATES}

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs, peerOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const brandDNA = project.brandDNA;

        return `AD CONCEPTS (from concept-creator):
${peerOutputs['concept-creator']?.slice(0, 5000) || 'Not available — create body copies for generic concepts'}

CUSTOMER LANGUAGE & VOICE (Gate 2):
${g2 ? JSON.stringify(g2, null, 2).slice(0, 3000) : 'Not available'}

HOOKS & COPY ARSENAL (Gate 4):
${g4 ? JSON.stringify(g4, null, 2).slice(0, 4000) : 'Not available'}

VOICE PROFILE:
${brandDNA?.voice_profile ? JSON.stringify(brandDNA.voice_profile, null, 2) : 'Not available'}

CUSTOMER LANGUAGE RULES:
- Always use: ${brandDNA?.customer_language?.always_use?.join(', ') || 'N/A'}
- NEVER use: ${brandDNA?.customer_language?.never_use?.join(', ') || 'N/A'}

## WRITE BODY COPIES FOR THE TOP 3 CONCEPTS

### PRIMARY BODY COPIES (3 total — one per concept)
For each of the top 3 concepts, write the PRIMARY body copy:
- Length: 125-250 words each
- Structure: EVOLVE OCPB Cycle
  1. **OPEN** — Pattern interrupt hook. Stop the scroll. Use customer language from Gate 2.
  2. **CONTENT** — Bridge from hook to problem. Create identification. Agitate with specific scenarios.
  3. **PAYOFF** — Introduce the mechanism/solution. Hint at how it works. Build curiosity.
  4. **BRIDGE** — Clear CTA that drives to the next step (advertorial, not buy page).

### VARIATIONS (2 per primary = 6 additional)
For each primary body copy, write 2 variations:
- Variation A: SHORTER version (80-125 words) — same angle, tighter delivery
- Variation B: DIFFERENT angle on same concept — fresh emotional entry point

### TOTAL = 9 body copies (3 primary + 6 variations)

### COPY MECHANICS TO USE:
- Bucket brigades ("Here's the thing...", "But wait...", "And that's when...")
- Yes trains (get reader nodding)
- Specificity over generality ("Lost 4.2kg in 3 weeks" not "lose weight fast")
- Customer language verbatim from Gate 2
- Show, don't tell ("Waking up without the alarm" not "better sleep")
- Include specific numbers, dates, details
- End EVERY body copy with a clear CTA

### RULES:
- ALL copy in ${project.targetLanguage}
- Use customer language from Gate 2 — their words, not marketing speak
- ZERO words from the never_use list
- Each body copy must be a standalone piece — works without reading others
- Primary copies: 125-250 words STRICT
- Variation A: 80-125 words STRICT
- Variation B: 125-250 words, different emotional entry
- EVERY body copy must pass ZAK Quality Gates: 4+ specificity types, BS detector clean, 6th grade reading level, show-don't-tell audit, correct copy format for awareness level
- Include at least ONE damaging admission across the 3 primary body copies
- Select copy format (PAS/AIDA/SPS/4P/BAB/Problem Stack) based on target awareness level

Output valid JSON:
{
  "body_copies": [
    {
      "id": "bc-1-primary",
      "concept_id": "concept-1",
      "concept_name": "",
      "type": "primary",
      "target_sub_avatar": "",
      "angle": "",
      "text": "",
      "word_count": 0,
      "ocpb_breakdown": {
        "open": "first 1-2 lines",
        "content": "lines 3-6",
        "payoff": "lines 7-10",
        "bridge": "final CTA line"
      },
      "techniques_used": ["bucket brigade", "yes train", "specificity", "damaging admission", "..."],
      "emotional_entry": "",
      "emotional_exit": "",
      "cta_text": "",
      "specificity_audit": {
        "types_present": ["which of the 7 Types of Specificity are used"],
        "count": 0,
        "show_dont_tell_conversions": ["each TELL→SHOW conversion made"]
      },
      "copy_format_used": "PAS|AIDA|SPS|4P|BAB|Problem Stack"
    },
    {
      "id": "bc-1-var-a",
      "concept_id": "concept-1",
      "concept_name": "",
      "type": "variation-short",
      "parent_id": "bc-1-primary",
      "text": "",
      "word_count": 0,
      "techniques_used": [],
      "cta_text": ""
    },
    {
      "id": "bc-1-var-b",
      "concept_id": "concept-1",
      "concept_name": "",
      "type": "variation-angle",
      "parent_id": "bc-1-primary",
      "text": "",
      "word_count": 0,
      "different_angle": "",
      "techniques_used": [],
      "cta_text": ""
    }
  ]
}`;
      },
    },

    // --- WAVE 3: Depends on body-copy-writer ---
    {
      id: 'headline-writer',
      name: 'Meta Ads Headline Writer',
      model: 'opus',
      dependsOn: ['body-copy-writer'],
      systemPrompt: (project) => `You are a headline specialist for Meta Ads. You write headlines that appear BELOW the ad image/video. Your headlines complement the body copy — they don't repeat the hook.

Every headline must create curiosity OR deliver a clear benefit in under 40 characters.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, _previousOutputs, peerOutputs) => {
        return `BODY COPIES (from body-copy-writer):
${peerOutputs['body-copy-writer']?.slice(0, 6000) || 'Not available'}

## WRITE 2 HEADLINES PER BODY COPY

### TOTAL: 9 body copies x 2 headlines = 18 headlines

For each body copy, write:
- **Headline A: Curiosity-driven** — creates an open loop, makes them NEED to click
- **Headline B: Benefit-driven** — states the key benefit clearly, appeals to self-interest

### HEADLINE RULES:
- Max 40 characters (Meta Ads headline field limit)
- Appears BELOW the image/video — it's the LAST thing they see before clicking
- Must COMPLEMENT the body copy, not repeat the hook
- Test BOTH approaches (curiosity vs. benefit) for every body copy
- Short, punchy, no filler words
- Question format, statement format, OR number format
- All in ${project.targetLanguage}

### FORMATS THAT WORK:
- "The [X] Method" (branded curiosity)
- "[Number] [People] Already [Result]" (social proof)
- "Why [Common Belief] Is Wrong" (pattern interrupt)
- "Stop [Doing X]. Try This Instead." (command)
- "[Specific Result] In [Timeframe]" (benefit + specificity)
- "What [Authority] Won't Tell You" (conspiracy/insider)

Output valid JSON:
{
  "headlines": [
    {
      "id": "hl-bc1p-a",
      "body_copy_id": "bc-1-primary",
      "concept_id": "concept-1",
      "type": "curiosity",
      "text": "",
      "char_count": 0,
      "format_used": "question|statement|number|command",
      "why_it_works": ""
    },
    {
      "id": "hl-bc1p-b",
      "body_copy_id": "bc-1-primary",
      "concept_id": "concept-1",
      "type": "benefit",
      "text": "",
      "char_count": 0,
      "format_used": "",
      "why_it_works": ""
    }
  ]
}

RULES:
- EXACTLY 18 headlines (2 per body copy)
- Every headline under 40 characters — NO EXCEPTIONS
- Curiosity headlines must create a genuine open loop
- Benefit headlines must state a SPECIFIC benefit, not a vague promise
- Each headline must make sense paired with its body copy`;
      },
    },

    // --- WAVE 2 (parallel with body-copy-writer): Depends on video-script-writer ---
    {
      id: 'speech-converter',
      name: 'Natural Speech Converter',
      model: 'sonnet',
      dependsOn: ['video-script-writer'],
      systemPrompt: (project) => `You are a speech naturalizer. You take polished video scripts and convert them into REAL, natural speech — the exact words a creator would say on camera.

You remove all "written" language and replace it with how people ACTUALLY TALK. The result must be indistinguishable from someone talking to their phone camera, not reading a script.

TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, _previousOutputs, peerOutputs) => {
        const brandDNA = project.brandDNA;

        return `VIDEO SCRIPTS (from video-script-writer):
${peerOutputs['video-script-writer'] || 'Not available'}

VOICE PROFILE:
${brandDNA?.voice_profile ? JSON.stringify(brandDNA.voice_profile, null, 2) : 'Not available'}

## CONVERT ALL VIDEO SCRIPT AUDIO TO NATURAL SPEECH

For EVERY audio line in EVERY component (hooks, bridges, hold, CTA) of both scripts:

### CONVERSION RULES:
1. **Remove all "written" language** — no perfect sentences, no polished transitions
2. **Add filler words** — "like", "honestly", "you know what I mean", "literally", "basically"
3. **Add verbal tics and pauses** — "um", "...", "uh", "so yeah"
4. **Break long sentences** — into fragments, false starts, and restarts
5. **Add emotional reactions** — "I was literally shaking", "I kid you not", "I'm not even joking"
6. **Self-corrections** — "I tried like three... no, four different things"
7. **Conversational connectors** — "okay so", "and like", "but here's the thing", "wait wait wait"
8. **Emotional punctuation** — [exhale], [laugh-sigh], [pause], [gets serious]
9. **Questions to self/audience** — "you know?", "right?", "does that make sense?"

### FREQUENCY GUIDELINES:
- Filler words: 2-3 per 30 seconds (not overdone)
- Pauses/hesitations: 1-2 per 30 seconds
- Self-corrections: 1 per 45 seconds max
- Emotional reactions: 1-2 per script
- NEVER more than one "um" per 45 seconds
- Sound confident but REAL — conversational, not theatrical, not amateur

### WHAT IT SHOULD SOUND LIKE:
- Someone talking to their best friend about something exciting they discovered
- A person recording a genuine testimonial on their phone
- An influencer sharing a real experience, not reading a teleprompter

### WHAT IT SHOULD NOT SOUND LIKE:
- A radio commercial
- A corporate presentation
- A news anchor
- An overly rehearsed pitch
- Someone clearly reading

All speech in ${project.targetLanguage}.

Output valid JSON:
{
  "natural_speech_scripts": [
    {
      "video_script_id": "vs-1",
      "hooks_natural": [
        { "hook_id": "vs1-hook-a", "original_audio": "", "natural_speech": "" },
        { "hook_id": "vs1-hook-b", "original_audio": "", "natural_speech": "" },
        { "hook_id": "vs1-hook-c", "original_audio": "", "natural_speech": "" }
      ],
      "bridges_natural": [
        { "bridge_id": "vs1-bridge-a", "original_audio": "", "natural_speech": "" },
        { "bridge_id": "vs1-bridge-b", "original_audio": "", "natural_speech": "" },
        { "bridge_id": "vs1-bridge-c", "original_audio": "", "natural_speech": "" }
      ],
      "hold_natural": {
        "sections": [
          { "label": "root_cause", "original_audio": "", "natural_speech": "" },
          { "label": "mechanism", "original_audio": "", "natural_speech": "" },
          { "label": "proof", "original_audio": "", "natural_speech": "" },
          { "label": "transformation", "original_audio": "", "natural_speech": "" }
        ]
      },
      "cta_natural": { "original_audio": "", "natural_speech": "" },
      "full_script_ready_to_read": ""
    }
  ]
}

CRITICAL: The "full_script_ready_to_read" field should contain the COMPLETE script (hook A + bridge A + hold + CTA) as one continuous piece of natural speech that a creator can read directly on camera. This is the FINAL deliverable.`;
      },
    },
  ],

  // --- LEAD AGENT: Compile all sub-agent outputs ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `You are an elite Meta Ads creative director. Produce a complete ad package for: ${project.name}. Include ad concepts, body copies, headlines, and video scripts. All in ${project.targetLanguage}.`;
    }

    return `You are the Lead Creative Director at a $100M/year direct response agency. Your team of 5 specialists has completed their work. COMPILE their outputs into a single, organized Ad Scripts & Copy Package.

CRITICAL RULES:
1. Integrate ALL specialist work — nothing gets dropped
2. Ensure clear LINKING: concepts → body copies → headlines (trace the chain)
3. Attach natural speech versions to their corresponding video scripts
4. Cross-reference: do body copies match their assigned concepts? Do headlines complement their body copies?
5. Flag any inconsistencies between sub-agent outputs
6. All output in ${project.targetLanguage}`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs) {
      const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
      const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
      const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
      const g5 = previousOutputs['gate5'] as Record<string, unknown> | undefined;

      return `Produce the complete ad package.

${g5 ? `=== ADVERTORIAL (Gate 5) ===\n${JSON.stringify(g5).slice(0, 5000)}` : ''}
${g4 ? `\n=== COPY ARSENAL (Gate 4) ===\n${JSON.stringify(g4).slice(0, 5000)}` : ''}
${g3 ? `\n=== MECHANISM (Gate 3) ===\n${JSON.stringify(g3).slice(0, 4000)}` : ''}
${g2 ? `\n=== AVATAR DATA (Gate 2) ===\n${JSON.stringify(g2).slice(0, 4000)}` : ''}

Product: ${project.productDescription}`;
    }

    return `Compile these specialist reports into the unified Ad Scripts & Copy Package.

=== AD CONCEPTS (5 concepts) ===
${subAgentOutputs['concept-creator'] || 'N/A'}

=== BODY COPIES (9 total: 3 primary + 6 variations) ===
${subAgentOutputs['body-copy-writer'] || 'N/A'}

=== HEADLINES (18 total: 2 per body copy) ===
${subAgentOutputs['headline-writer'] || 'N/A'}

=== VIDEO SCRIPTS (2 modular scripts) ===
${subAgentOutputs['video-script-writer'] || 'N/A'}

=== NATURAL SPEECH VERSIONS ===
${subAgentOutputs['speech-converter'] || 'N/A'}

Output unified JSON wrapped in \`\`\`json code blocks:
{
  "ad_concepts": [
    {
      "id": "concept-1",
      "name": "",
      "target_sub_avatar_id": "",
      "target_sub_avatar_name": "",
      "angle": "",
      "psychological_mechanism": "",
      "emotional_territory": "",
      "hook_direction": "",
      "visual_direction": "",
      "body_copy_direction": "",
      "best_format": "",
      "linked_body_copies": ["bc-1-primary", "bc-1-var-a", "bc-1-var-b"],
      "linked_headlines": ["hl-bc1p-a", "hl-bc1p-b", "..."]
    }
  ],
  "body_copies": [
    {
      "id": "bc-1-primary",
      "concept_id": "concept-1",
      "type": "primary|variation-short|variation-angle",
      "parent_id": null,
      "target_sub_avatar": "",
      "angle": "",
      "text": "",
      "word_count": 0,
      "ocpb_breakdown": { "open": "", "content": "", "payoff": "", "bridge": "" },
      "techniques_used": [],
      "emotional_entry": "",
      "emotional_exit": "",
      "cta_text": "",
      "headlines": [
        { "id": "hl-bc1p-a", "type": "curiosity", "text": "", "char_count": 0 },
        { "id": "hl-bc1p-b", "type": "benefit", "text": "", "char_count": 0 }
      ]
    }
  ],
  "video_scripts": [
    {
      "id": "vs-1",
      "title": "",
      "style": "pain-focused-ugc|transformation-focused",
      "target_sub_avatar": "",
      "total_duration_seconds": 0,
      "hooks": [
        { "id": "", "type": "", "audio": "", "natural_speech": "", "visual": "", "text_overlay": "", "timing": "" }
      ],
      "bridges": [
        { "id": "", "type": "", "audio": "", "natural_speech": "", "visual": "", "text_overlay": "", "timing": "" }
      ],
      "hold": {
        "sections": [
          { "label": "", "audio": "", "natural_speech": "", "visual": "", "text_overlay": "" }
        ],
        "total_duration_seconds": 0
      },
      "cta": { "type": "", "audio": "", "natural_speech": "", "visual": "", "text_overlay": "" },
      "full_script_ready_to_read": "",
      "delivery_notes": { "energy_arc": "", "pace": "", "emphasis_words": [], "emotional_shifts": [] },
      "combination_matrix": {
        "total_combinations": 9,
        "recommended_test_order": [
          { "hook": "hook-a", "bridge": "bridge-b", "rationale": "" }
        ]
      }
    }
  ],
  "concept_body_copy_headline_map": [
    {
      "concept_id": "concept-1",
      "concept_name": "",
      "body_copy_ids": ["bc-1-primary", "bc-1-var-a", "bc-1-var-b"],
      "headline_ids": ["hl-bc1p-a", "hl-bc1p-b", "..."],
      "total_ad_combinations": 0
    }
  ],
  "cross_reference_check": {
    "concepts_without_body_copies": [],
    "body_copies_without_headlines": [],
    "inconsistencies_found": [],
    "all_linked": true
  },
  "split_test_plan": {
    "body_copy_tests": ["what to test first and why"],
    "headline_tests": ["what to test first and why"],
    "video_hook_tests": ["recommended hook-bridge combinations to test first"]
  }
}

RULES:
- Every concept must link to its body copies and headlines
- Every body copy must have exactly 2 headlines attached
- Video scripts must include BOTH original audio AND natural speech versions
- Include the full_script_ready_to_read for each video script
- Flag any cross-reference issues in cross_reference_check`;
  },

  reviewerPrompt: `You are a Meta Ads performance reviewer with $50M+ in tested ad spend. Score with the eye of someone whose money is on the line.

${EVOLVE_COHERENCE_CHAIN}

${EVOLVE_EXECUTION_FRAMEWORK}

DIMENSIONS (each /10, total /100, threshold >=75%):
1. Concept Variety: 5 genuinely different concepts? Span 3+ sub-avatars? Different angles? Different emotional territories?
2. Concept Quality: Each has clear psychological mechanism from ZAK's 8 frameworks (System 1/2, COM-B, SDT, Narrative Transportation, Processing Fluency, Loss Aversion, Villain Externalization, Future Pacing)? Would a creative team know EXACTLY what to produce? OCPB cycle applied? Copy format (PAS/AIDA/SPS/4P/BAB/Problem Stack) selected per awareness level?
3. Body Copy Power: Hook stops scroll (3 Hook Requirements met)? Content creates identification? Payoff builds curiosity? Bridge has clear CTA? Awareness levels NOT skipped? Damaging admission present in at least 1 primary body copy?
4. Body Copy Craft: Customer language used? 4+ of 7 Types of Specificity per body copy? SHOW don't TELL audit done? Law of Unique Numbers applied? 6th grade reading level? BS detector clean (no weasel words, fake urgency, unsubstantiated claims)?
5. Headline Effectiveness: Under 40 chars? Curiosity headlines create real open loops? Benefit headlines state specific benefits? Complement (don't repeat) body copy?
6. Video Script Modularity: 3 hooks x 3 bridges x 1 hold x 1 CTA structure? Each hook works with any bridge? Each bridge works with the hold?
7. Video Script Quality: Scripts sound like real scenarios? Pain script is visceral? Transformation script is compelling? Timing realistic?
8. Natural Speech Authenticity: Sounds like real person talking? Not reading a script? Appropriate filler words? Emotional reactions?
9. 7 Reasons Ads Fail Check: No copy lacking emotional impact? Curiosity created? Suspense maintained? Not too complex? Show don't tell? Objections addressed via OCPB? Awareness transitions complete?
10. Coherence Lock: Mechanism name EXACT from Gate 3? Root cause EXACT? Belief error EXACT? Sub-avatar names EXACT from Gate 2? Emotional intensity NOT diluted? Desire elevation NOT dropped?

RED FLAGS (auto-deduct):
- All concepts feel like same concept reworded (max 3/10 on dimension 1)
- Body copies under/over word count limits
- Headlines over 40 characters
- Video scripts sound like written copy read aloud
- Natural speech still sounds scripted
- Broken linkage (body copy references non-existent concept)

Respond in valid JSON with score, maxScore (100), dimensions array, feedback, and passed boolean.`,

  reviewCriteria: `Score each dimension /10. Copy quality and concept variety are paramount. Generic concepts = low score. Natural speech must pass the "could a real person have said this?" test. Total /100, pass >= 75%.`,

  reviewThreshold: 75,
  hasCongruenceCheck: true,

  congruencePrompt: `Brand DNA Congruence Agent for ad scripts & copy.

CHECK THESE DIMENSIONS:
1. VOICE PROFILE: Do body copies and video scripts match the voice_profile? Vocabulary, sentence style, formality level, emotional tone — all consistent?
2. LOCKED TERMS: Mechanism name used exactly as locked. Root cause one-sentence consistent. Mechanism 3 steps referenced correctly. Product descriptor matches. No invented claims.
3. CUSTOMER LANGUAGE: Uses always_use terms. ZERO never_use terms found. Conditional terms used only in allowed contexts. Body copies sound like real customers talking.
4. EMOTIONAL ARC: Ad emotional entry matches funnel_arc "ad" touchpoint. Emotional progression makes sense. Primary/secondary emotions from Brand DNA present.
5. AD-TO-ADVERTORIAL BRIDGE: Every promise in the ad can be fulfilled by the advertorial. No bait-and-switch. Same mechanism, same language, same emotional register.
6. FORBIDDEN CONTENT: No never_use words anywhere. No fabricated statistics. No unsubstantiated claims. No competitor comparisons that create categories.

Respond in valid JSON with score (0-100), dimensions, driftReport, verdict (CONGRUENT|NEEDS_ALIGNMENT|REBUILD), and alignmentInstructions.`,

  congruenceThreshold: 85,
};

export default gate6;
