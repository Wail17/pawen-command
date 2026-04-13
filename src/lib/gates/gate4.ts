// ============================================================
// GATE 4 — COPY ARSENAL
// Sub-agents: hook-generator, open-loop-writer, sensory-writer,
//             future-pacer, bucket-brigade, takeaway-writer
// Lead: Compile + organize by sub-avatar + score top hooks
// ============================================================

import { GateConfigDef } from './types';
import { EVOLVE_EXECUTION_FRAMEWORK, EVOLVE_COHERENCE_CHAIN } from './evolveFrameworks';
import { ZAK_HOOK_ARSENAL } from './zakFrameworks';

const gate4: GateConfigDef = {
  id: 'gate4',
  description: 'Copy Arsenal — hooks (7 ZAK formulas), open loops, sensory language, future pacing, bucket brigades, takeaway copy',

  subAgents: [
    // --- WAVE 1: customer-language-extractor runs first (ZAK Customer Language Hooks Part 1) ---
    {
      id: 'customer-language-extractor',
      name: 'Customer Language Extractor (ZAK Part 1)',
      model: 'opus',
      temperature: 0.7,
      maxTokens: 12000,
      systemPrompt: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `You are an elite customer language mining specialist for a $100M/year direct response brand. Your job is to extract the raw customer language that will become the foundation for scroll-stopping hooks.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
NICHE: ${project.niche || 'See product'}

## WHAT MAKES AN INSANE HOOK (understand this BEFORE extracting)

A great hook does 3 JOBS in 3 seconds:
1. ATTENTION (Second 0-1): Stop the scroll with pattern interrupt
2. QUALIFICATION (Second 1-2): Make the right person think "this is about ME"
3. COMMITMENT (Second 2-3): Create an open loop they MUST close

A great hook triggers the REPTILIAN BRAIN:
- THREAT: "This is hurting you"
- OPPORTUNITY: "You could have this"
- NOVELTY: "Wait, what?"
- SELF: "That's ME"
- CONTRAST: "Before vs After"
- EMOTION: Strong feeling (fear, hope, frustration, relief)

A great hook has these ELEMENTS:
- Hyper-specific details (times, ages, numbers, scenarios)
- Visual language (you can SEE it happening)
- Emotional truth (names the feeling)
- Open loop (unfinished, needs resolution)
- Sounds like a REAL PERSON, not an ad
- Uses PAIN over curiosity (pain hooks outperform 2-3x)

A great hook AVOIDS:
- Generic claims ("struggling with X?")
- Marketer voice ("discover the secret")
- Closed loops (story is complete, no reason to continue)
- Broad language that could apply to anyone

AVATAR CONTEXT:
${g2 ? JSON.stringify(g2, null, 2).slice(0, 6000) : 'Not available — extract from product context'}`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `${g2 ? `AVATAR DEEP DIVE:\n${JSON.stringify(g2, null, 2).slice(0, 10000)}\n\n` : `PRODUCT: ${project.productDescription}\n\n`}## MISSION: Extract 70 Customer Language Phrases (7 Categories × 10)

Based on the avatar research above and the hook criteria, extract the raw customer language that will become hook ammunition.

### CATEGORY 1: MICRO-SPECIFIC MOMENTS (10 examples)
The tiny, visceral moments only someone with this problem would know.
Example format: "That thing where you [specific action] because [specific reason]"

### CATEGORY 2: INTERNAL DIALOGUE (10 examples)
What they say to themselves. The thoughts in their head.
Example format: "I'm starting to think..." / "Maybe I'm just..." / "What if I..."

### CATEGORY 3: RELATIONSHIP MOMENTS (10 examples)
How the problem affects their relationships. What others say/do.
Example format: "My [person] said..." / "I caught my [person] looking at me like..."

### CATEGORY 4: HUMILIATION MOMENTS (10 examples)
Specific times they felt embarrassed, ashamed, or exposed.
Example format: "The moment when..." / "I had to pretend that..."

### CATEGORY 5: FAILED SOLUTION LANGUAGE (10 examples)
How they describe things that didn't work.
Example format: "I tried [X] and..." / "Everyone said [X] would help but..."

### CATEGORY 6: TRANSFORMATION LANGUAGE (10 examples)
How they'd describe life if the problem was solved. Be specific.
Example format: "I just want to be able to..." / "I miss when I could..."

### CATEGORY 7: TRIGGER PHRASES (10 examples)
Phrases that sound like gossip/drama/real life, not ads.
Example format: "My husband thought..." / "I almost..." / "They found out..."

Output valid JSON:
{
  "customer_language_extraction": {
    "micro_specific_moments": [
      {
        "id": "cl-ms01",
        "phrase": "extracted phrase in ${project.sourceLanguage}",
        "phrase_target_lang": "in ${project.targetLanguage}",
        "source_quote": "the original avatar quote this came from (if available)",
        "specificity_elements": ["what makes this hyper-specific: times, ages, numbers, scenarios"],
        "emotion": "the emotion this evokes",
        "visual_score": 1-10,
        "hook_potential": 1-10
      }
    ],
    "internal_dialogue": [...],
    "relationship_moments": [...],
    "humiliation_moments": [...],
    "failed_solution_language": [...],
    "transformation_language": [...],
    "trigger_phrases": [...],
    "top_10_phrases": [
      {
        "rank": 1,
        "phrase": "",
        "category": "",
        "why_its_gold": "why this phrase has the highest hook potential"
      }
    ],
    "total_phrases": 70
  }
}

RULES:
- EXACTLY 10 per category = 70 total
- For each phrase, make them:
  • Hyper-specific (times, ages, situations, numbers)
  • Emotional (name the feeling)
  • Visual (you can picture it)
  • Authentic (sounds like real speech, not copywriting)
  • Pattern-interrupting (would stop a scroll)
- Use REAL customer language from the avatar deep dive — not invented marketing copy
- The top 10 ranking is critical — these feed directly into hook creation
- Include both source and target language
- Pain phrases should outnumber aspiration phrases 2:1
- Every phrase must pass the "would a real person actually say this?" test`;
      },
    },

    // --- WAVE 2: hook-generator depends on customer-language-extractor (ZAK Part 2 flow) ---
    {
      id: 'hook-generator',
      name: 'Hook Crafter (7 ZAK Formulas + EVOLVE Scorecard)',
      model: 'opus',
      dependsOn: ['customer-language-extractor'],
      temperature: 0.85,
      maxTokens: 16000,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const voiceProfile = brandDNA?.voice_profile;
        const lockedTerms = brandDNA?.locked_terms;

        return `You are an elite scroll-stopping hook architect for a $100M/year direct response brand. You understand the neuroscience of attention — the amygdala decides stop-or-scroll in 0-0.5 seconds, BEFORE conscious thought.

You are writing hooks for:
PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
NICHE: ${project.niche || 'See product'}
${voiceProfile ? `\nVOICE PROFILE:\n- Vocabulary: ${voiceProfile.vocabulary.join(', ')}\n- Sentence style: ${voiceProfile.sentence_style}\n- Formality: ${voiceProfile.formality_level}/10\n- Emotional tone: ${voiceProfile.emotional_tone}\n- Phrases to use: ${voiceProfile.phrases_to_use.join(', ')}\n- Phrases to avoid: ${voiceProfile.phrases_to_avoid.join(', ')}` : ''}
${lockedTerms ? `\nLOCKED TERMS:\n- Mechanism: ${lockedTerms.mechanism_name}\n- Root cause: ${lockedTerms.root_cause_one_sentence}\n- Belief error: ${lockedTerms.belief_error}\n- 3 Steps: ${lockedTerms.mechanism_3_steps.map(s => s.name).join(' → ')}` : ''}

## YOUR FRAMEWORK

### NEUROSCIENCE OF ATTENTION (ZAK)
6 REPTILIAN TRIGGERS that bypass conscious thought:
1. SELF-PRESERVATION — Pain, loss, danger, health threats
2. SEX APPEAL — Attractiveness, desirability, physical appearance
3. SOCIAL APPROVAL — Fitting in, being accepted, avoiding judgment
4. POWER — Control, dominance, autonomy, mastery
5. CURIOSITY — Novelty, mystery, open loops, "wait what?"
6. COMFORT — Ease, relief, safety, familiarity

ATTENTION HIERARCHY (strongest → weakest):
Level 1: IDENTITY — "that's literally me" (strongest scroll-stop)
Level 2: CONTRAST — before/after, unexpected juxtaposition
Level 3: EMOTION — raw feeling that resonates
Level 4: SPECIFICITY — concrete details that signal real

### THE 3 FIRST LINES (every hook MUST have all 3):
1. HOOK: The pattern interrupt (0.5s to stop the scroll)
2. ANCHOR: The validation/identification ("yes, that's me")
3. OPEN LOOP: The curiosity gap (cannot scroll away without resolution)

### 7 ZAK HOOK FORMULAS
1. QUESTION HOOK — Pattern-interrupt question targeting pain/desire/misconception. Forces mental engagement.
2. STATEMENT HOOK — Bold, specific claim that creates cognitive dissonance. "Wait, really?"
3. STORY HOOK — Micro-narrative that activates System 1 (narrative brain). 1-2 sentences max.
4. STATISTIC HOOK — Surprising data point that reframes the problem. Specific number = credibility.
5. CONTRADICTION HOOK — Challenges conventional wisdom in the avatar's world. Against what "everyone" believes.
6. CURIOSITY HOOK — Pure open loop. Missing information that MUST be resolved. Irresistible gap.
7. IDENTITY HOOK — "If you're the kind of person who..." or "You know you're a [X] when..." — self-selection.

### EVOLVE HOOK EVALUATION SCORECARD (/30)
Score each hook on 3 dimensions:
- REPTILIAN (R, /10): How many reptilian triggers does it fire? Which ones?
- HIERARCHY (H, /10): Where does it land on the Attention Hierarchy? Identity=10, Contrast=8, Emotion=6, Specificity=4
- FIRST 3 LINES (F, /10): How strong are the hook, anchor, and open loop individually?
Total = R + H + F (/30)

${ZAK_HOOK_ARSENAL}`;
      },

      userMessage: (project, previousOutputs, peerOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;

        return `=== CUSTOMER LANGUAGE EXTRACTION (Phase 1 — your ammunition) ===
${peerOutputs['customer-language-extractor'] || 'Not available — extract language directly from Gate 2 data below'}

CONTEXT FROM PREVIOUS GATES:
${g2 ? `\n=== AVATAR DEEP DIVE (Gate 2) — sub-avatars, angles, quote bank, voice ===\n${JSON.stringify(g2, null, 2).slice(0, 8000)}` : ''}
${g3 ? `\n=== ROOT CAUSE & MECHANISM (Gate 3) — root cause, belief error, mechanism ===\n${JSON.stringify(g3, null, 2).slice(0, 3000)}` : ''}
${g1 ? `\n=== PRODUCT INTELLIGENCE (Gate 1) — features, benefits, buyer psychology ===\n${JSON.stringify(g1, null, 2).slice(0, 3000)}` : ''}

## MISSION: Turn extracted customer language into 70+ hooks using 7 ZAK formulas

IMPORTANT: The Customer Language Extraction above contains 70 pre-mined phrases across 7 categories (micro-specific moments, internal dialogue, relationship moments, humiliation moments, failed solutions, transformation language, trigger phrases) + top 10 ranked phrases. USE THESE as your primary hook ammunition. The top 10 phrases should appear in your top 20 scored hooks.

Focus on the SELECTED SUB-AVATAR (the one provided in Strategic Context above). Generate hooks for this ONE avatar across its top 3 angles × ALL 7 formulas × 3-4 variations = 70+ hooks minimum.

For each hook, provide the full 3 First Lines (hook, anchor, open loop).

Then apply the EVOLVE Hook Evaluation Scorecard (/30) and score the TOP 20 hooks in detail.

Output valid JSON:
{
  "hook_matrix": [
    {
      "sub_avatar_id": "sa-1",
      "sub_avatar_name": "",
      "angle": "angle name",
      "hooks": [
        {
          "id": "h001",
          "formula": "question|statement|story|statistic|contradiction|curiosity|identity",
          "hook_text": "the hook in ${project.sourceLanguage}",
          "hook_text_target_lang": "the hook in ${project.targetLanguage}",
          "first_3_lines": {
            "hook": "the pattern interrupt line",
            "anchor": "the validation/identification line",
            "open_loop": "the curiosity gap line"
          },
          "reptilian_triggers": ["which of the 6 triggers it fires"],
          "attention_hierarchy_level": "identity|contrast|emotion|specificity",
          "rationale": "why this hook works for this avatar + angle"
        }
      ]
    }
  ],
  "top_20_scored": [
    {
      "rank": 1,
      "id": "h001",
      "formula": "",
      "hook_text": "",
      "hook_text_target_lang": "",
      "sub_avatar_id": "",
      "angle": "",
      "reptilian_score": 0,
      "hierarchy_score": 0,
      "first_3_lines_score": 0,
      "total_score": 0,
      "reptilian_triggers_fired": ["list"],
      "hierarchy_justification": "",
      "first_3_lines_evaluation": {
        "hook_strength": "",
        "anchor_strength": "",
        "open_loop_strength": ""
      },
      "recommended_placement": "ad|advertorial_headline|email_subject|social",
      "best_for": "which sub-avatar and why",
      "specificity_score": {
        "types_present": ["numerical", "temporal", "sensory", "emotional", "identity", "outcome", "process"],
        "count": 0,
        "pass": true
      },
      "hook_stacking": {
        "visual_hook": "what the viewer SEES (for image/video ads)",
        "text_hook": "what appears as text overlay",
        "audio_hook": "what the viewer HEARS (for video ads)"
      }
    }
  ],
  "hooks_by_formula": {
    "question": 0,
    "statement": 0,
    "story": 0,
    "statistic": 0,
    "contradiction": 0,
    "curiosity": 0,
    "identity": 0
  },
  "total_hooks_generated": 0,
  "recommended_copy_formats": {
    "problem_aware": "PAS|Problem Stack — best format for this avatar's awareness",
    "solution_aware": "AIDA|BAB — best format for this awareness",
    "product_aware": "4P|AIDA — best format for this awareness",
    "format_reasoning": "why these formats match the pain/desire ratio from Gate 2"
  },
  "trigger_phrases_used": {
    "fear": ["which fear trigger phrases were used in hooks"],
    "curiosity": ["which curiosity trigger phrases were used"],
    "identity": ["which identity trigger phrases were used"],
    "pain": ["which pain trigger phrases were used"]
  }
}

RULES:
- MINIMUM 105 hooks (5 avatars × 3 angles × 7 formulas)
- All hooks in TARGET LANGUAGE + source language
- NEVER use cliche marketing phrases ("revolutionary", "game-changer", "secret", "doctors don't want you to know")
- Every hook references REAL data from Gates 1-3 and Brand DNA
- Hooks must sound like a REAL PERSON talking, not an ad
- Pain hooks should outnumber curiosity hooks 2:1 (pain outperforms)
- Score the top 20 HONESTLY — a 30/30 should be once-in-a-career
- Use EXACT customer language from Gate 2 verbatim quotes
- Respect locked terms from Brand DNA
- Every top-20 hook MUST score 4+ on the 7 Types of Specificity — under 3 = too generic
- Top 20 hooks MUST include hook stacking (visual + text + audio) for multi-channel execution
- Use trigger phrases from the ZAK Word Bank — tag which categories were used
- Recommend copy format (PAS/AIDA/SPS/4P/BAB/Problem Stack) per awareness level based on Gate 2 pain/desire ratio`;
      },
    },

    {
      id: 'open-loop-writer',
      name: 'Open Loop Architect (5 ZAK Categories)',
      model: 'opus',
      temperature: 0.8,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const voiceProfile = brandDNA?.voice_profile;

        return `You are a master of psychological tension and curiosity gaps. You create open loops so compelling that the reader CANNOT scroll away without resolution. You work for a $100M/year direct response brand.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
${voiceProfile ? `\nVOICE: Formality ${voiceProfile.formality_level}/10, tone: ${voiceProfile.emotional_tone}\nPhrases to use: ${voiceProfile.phrases_to_use.join(', ')}\nPhrases to avoid: ${voiceProfile.phrases_to_avoid.join(', ')}` : ''}

## OPEN LOOP PSYCHOLOGY
An open loop is an incomplete pattern that the brain NEEDS to close. The Zeigarnik Effect — unfinished thoughts occupy the mind 90% more than completed ones.

A great open loop:
1. Creates a specific information gap
2. Signals the payoff is worth waiting for
3. Increases emotional tension
4. Can ACTUALLY be paid off (no empty promises)
5. Uses the avatar's actual language`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;

        return `CONTEXT:
${g2 ? `=== AVATAR DATA (Gate 2) — quote bank, customer language ===\n${JSON.stringify(g2, null, 2).slice(0, 5000)}` : ''}
${g3 ? `\n=== ROOT CAUSE & MECHANISM (Gate 3) ===\n${JSON.stringify(g3, null, 2).slice(0, 2000)}` : ''}

## MISSION: Create 50 open loops across 5 ZAK categories (10 per category)

### CATEGORY 1: MYSTERY LOOPS (10)
Create curiosity about hidden knowledge, industry secrets, or suppressed truths.
Template patterns:
- "What scientists found in their bloodwork shocked even the researchers..."
- "There's a reason [authority] doesn't talk about this publicly..."
- "The one thing [industry] hopes you never Google..."

### CATEGORY 2: CONTRADICTION LOOPS (10)
Challenge current beliefs with surprising contradictions that demand resolution.
Template patterns:
- "The one food doctors say is healthy that's actually..."
- "What everyone thinks causes [problem] isn't even close..."
- "The 'healthy' habit that's making [problem] worse..."

### CATEGORY 3: PERSONAL REVELATION LOOPS (10)
Intimate, story-driven loops using first-person perspective. Must feel confessional.
Template patterns:
- "I didn't find out until my doctor showed me the results..."
- "My [family member] was the one who finally told me the truth about..."
- "I spent 3 years hiding this from everyone until..."

### CATEGORY 4: SOCIAL PROOF LOOPS (10)
Leverage the behavior of others to create curiosity about what they know.
Template patterns:
- "Why 47,000 women stopped using [common solution] in the last 6 months..."
- "The reason [demographic] in [country] don't have this problem..."
- "What 9 out of 10 [professionals] do privately that they won't recommend..."

### CATEGORY 5: TIME-BOMB LOOPS (10)
Create urgency through inevitability — something IS going to happen, and they need to know.
Template patterns:
- "In 6 months, everyone will know about this..."
- "By next year, [current solution] won't even be available..."
- "What's happening right now that will change everything about [problem] by [timeframe]..."

Output valid JSON:
{
  "open_loops": {
    "mystery": [
      {
        "id": "ol-m01",
        "loop_text": "the open loop in ${project.sourceLanguage}",
        "loop_text_target_lang": "the open loop in ${project.targetLanguage}",
        "payoff_direction": "what this loop promises — how can we actually deliver?",
        "emotion_triggered": "primary emotion this creates",
        "best_placement": "ad_hook|advertorial_intro|mid_copy|email_subject",
        "pairs_with_sub_avatar": "which sub-avatar this resonates most with"
      }
    ],
    "contradiction": [...],
    "personal_revelation": [...],
    "social_proof": [...],
    "time_bomb": [...]
  },
  "total_loops": 50
}

RULES:
- EXACTLY 10 per category = 50 total
- Use EXACT language from Gate 2 customer quotes
- Every loop must have a deliverable payoff (no empty curiosity)
- Each loop must trigger a specific emotion — name it
- Loops must sound like gossip, confession, or insider knowledge — NOT like ads
- Include both source language and target language versions
- Vary the specificity — some with numbers, some with stories, some with authorities`;
      },
    },

    {
      id: 'sensory-writer',
      name: 'Sensory Language Architect (5 Senses × 2 States)',
      model: 'opus',
      temperature: 0.8,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const customerLang = brandDNA?.customer_language;

        return `You are a master of sensory copywriting for a $100M/year direct response brand. You write copy that makes people FEEL things in their body. You don't describe emotions — you EVOKE them through concrete sensory detail.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
${customerLang ? `\nCUSTOMER LANGUAGE BANK:\n- Pain quotes: ${customerLang.pain_quotes.slice(0, 5).map(q => q.quote).join(' | ')}\n- Desire quotes: ${customerLang.desire_quotes.slice(0, 5).map(q => q.quote).join(' | ')}\n- Always use: ${customerLang.always_use.join(', ')}\n- Never use: ${customerLang.never_use.join(', ')}` : ''}

## SENSORY WRITING PRINCIPLES
1. Show, don't tell — "her hands shook" not "she was nervous"
2. Specific trumps general — "3am alarm clock buzz" not "early morning"
3. Internal sensations are the most powerful — gut, chest, throat, temples
4. Contrast creates impact — pain moment vs. transformation moment
5. Use the avatar's REAL language for internal dialogue`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `CONTEXT:
${g2 ? `=== AVATAR DATA (Gate 2) — pain, desires, daily struggles, trigger moments ===\n${JSON.stringify(g2, null, 2).slice(0, 5000)}` : ''}

## MISSION: Create sensory language for 5 senses × 2 states (pain + transformation) = 50 total examples

For EACH of the 5 senses, write 5 vivid examples for the PAIN state (before) and 5 for the TRANSFORMATION state (after).

### SIGHT — What they SEE
PAIN (5 examples): What do they see that reminds them of the problem? The mirror, the scale, others' reactions, their own body...
TRANSFORMATION (5 examples): What do they see differently? The reflection, the number, the look in someone's eyes...

### SOUND — What they HEAR
PAIN (5 examples): The doctor's words, the whispered comments, the inner voice, the creaking joints, the labored breathing...
TRANSFORMATION (5 examples): The compliment, the surprised reaction, the silence where pain used to be, the laughter...

### TOUCH — What they FEEL physically
PAIN (5 examples): The tightness, the throbbing, the heaviness, the clothing that doesn't fit, the flinch...
TRANSFORMATION (5 examples): The lightness, the ease of movement, the smooth texture, the comfortable fit...

### SMELL — What they SMELL
PAIN (5 examples): The medicinal smell, the sweat, the staleness, the products that didn't work...
TRANSFORMATION (5 examples): The freshness, the morning air, the confidence of being close to others...

### TASTE — What they TASTE
PAIN (5 examples): The bitterness of pills, the metallic taste of anxiety, the bland diet, the food they can't enjoy...
TRANSFORMATION (5 examples): The flavors they can enjoy again, the celebratory meal, the morning coffee without worry...

Output valid JSON:
{
  "sensory_language": {
    "sight": {
      "pain": [
        {
          "id": "vis-p01",
          "text": "sensory description in ${project.sourceLanguage}",
          "text_target_lang": "sensory description in ${project.targetLanguage}",
          "internal_sensation": "what they feel INSIDE when they see this",
          "pairs_with_sub_avatar": "sa-1"
        }
      ],
      "transformation": [...]
    },
    "sound": { "pain": [...], "transformation": [...] },
    "touch": { "pain": [...], "transformation": [...] },
    "smell": { "pain": [...], "transformation": [...] },
    "taste": { "pain": [...], "transformation": [...] }
  },
  "sensory_phrases_bank": [
    {
      "phrase": "short punchy sensory phrase ready to drop into any copy",
      "phrase_target_lang": "",
      "sense": "sight|sound|touch|smell|taste",
      "state": "pain|transformation",
      "use_in": "hook|body_copy|future_pacing|close"
    }
  ],
  "total_examples": 50,
  "total_phrases": 20
}

RULES:
- 5 senses × 2 states × 5 examples = 50 total sensory descriptions
- PLUS 20 short sensory phrases ready for copy insertion
- Every description must engage at least 1 additional sense beyond the primary
- Use THEIR language from Gate 2 — not clinical or literary language
- Mirror the SAME sense between pain and transformation for maximum contrast
- Internal sensations (gut, chest, throat, jaw) are GOLD — include them
- Specific: not "feel bad" but "that tight knot below your ribs that won't unclench"
- Include both source and target language`;
      },
    },

    {
      id: 'future-pacer',
      name: 'Future Pacing Mini-Movie Writer (ZAK)',
      model: 'opus',
      temperature: 0.85,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const voiceProfile = brandDNA?.voice_profile;

        return `You are a screenwriter-turned-copywriter for a $100M/year direct response brand. You write future pacing scenes so vivid that the reader's brain literally cannot distinguish them from MEMORY. This is the ZAK Future Pacing technique — you create "mini-movies" that the reader projects themselves into.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
${voiceProfile ? `\nVOICE: ${voiceProfile.emotional_tone}, formality ${voiceProfile.formality_level}/10\nSample voice: "${voiceProfile.sample_paragraph}"` : ''}

## FUTURE PACING NEUROSCIENCE
When you describe a scene with enough sensory detail, the brain activates the SAME neural pathways as if it were experiencing the scene. The reader literally FEELS the transformation. This creates:
1. Emotional ownership ("I can already feel it")
2. Loss aversion ("I don't want to lose this feeling")
3. Identity shift ("I'm already that person")

## SCENE REQUIREMENTS (ZAK)
Each scene MUST include ALL 6 elements:
1. SPECIFIC TIME & PLACE — "7:14am Saturday" not "one day"
2. SENSORY TRIGGER — What they see/hear/feel that shows something is different
3. THE REALIZATION MOMENT — Instant they understand it worked ("Wait... is this real?")
4. ANOTHER PERSON'S REACTION — Someone else noticing + validating (adds dopamine)
5. THE EMOTIONAL PEAK — Describe what they feel IN THEIR BODY — chest, gut, eyes, throat
6. NEW NORMAL FRAMING — This isn't a miracle day. It's just Tuesday. This is their life now.

EMOTIONAL TRIGGERS (pick 2-3 per scene):
VICTORY, RELIEF, LOVE, PRIDE, SURPRISE, CONTROL`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;

        return `CONTEXT:
${g2 ? `=== AVATAR DATA (Gate 2) — daily struggles, dream outcomes, trigger moments ===\n${JSON.stringify(g2, null, 2).slice(0, 5000)}` : ''}
${g3 ? `\n=== MECHANISM (Gate 3) — what the solution does ===\n${JSON.stringify(g3, null, 2).slice(0, 2000)}` : ''}

## MISSION: Write 3 mini-movie future pacing scenes

### SCENE 1: THE MORNING ROUTINE (Transformed)
The reader wakes up. Something is different. They go through their morning — but everything has shifted. Small details reveal the transformation. Written in second person ("You..."), present tense. 150-200 words.

### SCENE 2: THE SOCIAL SITUATION (Transformed)
The reader is with people — family dinner, work event, friend gathering, date night. The old them would have dreaded this. The new them is... different. Someone notices. The interaction that used to cause anxiety now brings joy. 150-200 words.

### SCENE 3: THE MIRROR MOMENT / SELF-REFLECTION (Transformed)
The reader catches their own reflection — mirror, window, phone camera. They pause. What they see is different. What they FEEL about what they see is different. This is the identity-shift scene. 150-200 words.

Output valid JSON:
{
  "future_pacing_scenes": [
    {
      "scene_id": 1,
      "title": "The Morning Routine",
      "scene_text": "the full 150-200 word scene in ${project.sourceLanguage}",
      "scene_text_target_lang": "the full scene in ${project.targetLanguage}",
      "time_and_place": "specific time and location",
      "sensory_trigger": "the specific sensory detail that signals change",
      "realization_moment": "the exact moment they understand it worked",
      "others_reaction": "who notices and what they say/do",
      "emotional_peak": "the physical sensation of the emotion — WHERE in the body",
      "new_normal_frame": "how you frame this as everyday, not miraculous",
      "emotions_used": ["2-3 from VICTORY, RELIEF, LOVE, PRIDE, SURPRISE, CONTROL"],
      "word_count": 0
    }
  ]
}

RULES:
- EXACTLY 3 scenes, each 150-200 words
- Present tense, second person ("You...")
- Sensory-rich — at least 3 senses per scene
- Emotionally vivid — the reader should get a lump in their throat or a smile
- In customer voice — not literary, not clinical, not polished. RAW and REAL.
- Each scene must hit ALL 6 ZAK elements
- Specific times ("6:47am"), specific places ("your kitchen"), specific details ("the blue mug")
- The transformation should feel EARNED, not magical
- Include both source and target language`;
      },
    },

    {
      id: 'bucket-brigade',
      name: 'Bucket Brigade Builder (7 ZAK Categories)',
      model: 'sonnet',
      temperature: 0.7,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const voiceProfile = brandDNA?.voice_profile;

        return `You are a copy flow specialist for a $100M/year direct response brand. You create bucket brigades — short transitional phrases that keep the reader moving through copy like a bucket brigade passing water from person to person. Every phrase is a micro-commitment to keep reading.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
${voiceProfile ? `\nVOICE MATCH REQUIREMENTS:\n- Vocabulary: ${voiceProfile.vocabulary.slice(0, 15).join(', ')}\n- Formality: ${voiceProfile.formality_level}/10\n- Tone: ${voiceProfile.emotional_tone}\n- Phrases to use: ${voiceProfile.phrases_to_use.join(', ')}\n- Phrases to avoid: ${voiceProfile.phrases_to_avoid.join(', ')}` : ''}

## BUCKET BRIGADE PRINCIPLES
1. SHORT — 2-6 words maximum
2. CONVERSATIONAL — sounds like a friend talking
3. CREATES MOMENTUM — impossible to stop reading
4. MATCHES VOICE — must sound like the avatar, not a marketer
5. TRANSITIONS — bridges between ideas, sections, emotions`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `CONTEXT:
${g2 ? `=== VOICE PROFILE & CUSTOMER LANGUAGE (Gate 2) ===\n${JSON.stringify(g2, null, 2).slice(0, 3000)}` : ''}

## MISSION: Create 70 bucket brigade phrases across 7 ZAK categories (10 per category)

### CATEGORY 1: CURIOSITY BRIDGES (10)
Pull the reader forward with irresistible curiosity.
Examples: "Here's where it gets interesting...", "But wait...", "You won't believe what happened next..."

### CATEGORY 2: EMPATHY BRIDGES (10)
Show deep understanding of the reader's experience.
Examples: "I know exactly how that feels...", "Sound familiar?", "You've been there..."

### CATEGORY 3: AUTHORITY BRIDGES (10)
Transition into proof, data, or expert backing.
Examples: "What the research actually shows...", "Here's what the science says...", "The data doesn't lie..."

### CATEGORY 4: URGENCY BRIDGES (10)
Build tension and push toward action.
Examples: "But here's the thing...", "And this is where it matters...", "The clock is ticking..."

### CATEGORY 5: TRANSITION BRIDGES (10)
Smoothly move between sections, ideas, or emotional states.
Examples: "And that's when I realized...", "Fast forward to today...", "So here's what changed..."

### CATEGORY 6: CONTRAST BRIDGES (10)
Signal a shift, twist, or unexpected turn.
Examples: "But what most people don't know...", "The opposite is true...", "Wrong."

### CATEGORY 7: STORY BRIDGES (10)
Launch into narratives, examples, or scenarios.
Examples: "Let me tell you about...", "Picture this...", "Imagine for a second..."

Output valid JSON:
{
  "bucket_brigades": {
    "curiosity": [
      {
        "id": "bb-c01",
        "phrase": "phrase in ${project.sourceLanguage}",
        "phrase_target_lang": "phrase in ${project.targetLanguage}",
        "use_before": "what type of content follows this bridge",
        "emotional_shift": "what emotion it creates or transitions to"
      }
    ],
    "empathy": [...],
    "authority": [...],
    "urgency": [...],
    "transition": [...],
    "contrast": [...],
    "story": [...]
  },
  "total_phrases": 70
}

RULES:
- EXACTLY 10 per category = 70 total
- 2-6 words MAXIMUM per phrase — shorter is almost always better
- Must MATCH the avatar's voice profile — formality, vocabulary, tone
- NO marketing cliches ("But wait, there's more!", "Act now!")
- Each phrase must feel natural in conversation
- Vary rhythm — not all phrases should start the same way
- Include both source and target language
- These must work in ads, advertorials, emails, and landing pages`;
      },
    },

    {
      id: 'takeaway-writer',
      name: 'Takeaway & Disqualification Copy Writer',
      model: 'opus',
      temperature: 0.75,
      systemPrompt: (project, previousOutputs) => {
        const brandDNA = project.brandDNA;
        const lockedTerms = brandDNA?.locked_terms;

        return `You are a master of reverse psychology in direct response copy. You write for a $100M/year brand. Your specialty: TAKEAWAY copy — the art of pushing people AWAY to pull them closer. When you tell someone "this isn't for you," the right people lean IN.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
${lockedTerms ? `\nPRODUCT: ${lockedTerms.product_descriptor}\nGUARANTEE: ${lockedTerms.guarantee_wording}` : ''}

## TAKEAWAY PSYCHOLOGY
1. Scarcity + exclusivity = desire (but NEVER lie)
2. Disqualification builds trust ("they're not just trying to sell to everyone")
3. Qualification creates identity ("I AM the kind of person who...")
4. "Not for everyone" frames = social proof of quality
5. Honest boundaries make claims more believable`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `CONTEXT:
${g2 ? `=== AVATAR DATA (Gate 2) — sub-avatars, objections, skepticism ===\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}

## MISSION: Create 25 takeaway/disqualification copy blocks across 5 categories (5 per category)

### CATEGORY 1: "THIS ISN'T FOR EVERYONE" FRAMINGS (5)
General exclusivity framings that signal quality and honesty.
Must feel authentic, not formulaic. Each should take a different angle on WHY it's not for everyone.

### CATEGORY 2: "IF YOU'RE THE KIND OF PERSON WHO..." QUALIFICATIONS (5)
Positive qualification — describe the IDEAL customer so precisely that they self-select.
Connect each to a specific sub-avatar trait, behavior, or mindset from Gate 2.

### CATEGORY 3: "DON'T BUY THIS IF..." DISQUALIFICATIONS (5)
Negative disqualification — explicitly push away bad-fit customers.
These should address REAL objection patterns from Gate 2. Each disqualifier should secretly REINFORCE a benefit.

### CATEGORY 4: SCARCITY FRAMINGS WITHOUT LYING (5)
Create urgency through genuine scarcity. NEVER fabricate scarcity.
Types: production capacity, ingredient sourcing, support bandwidth, seasonal availability, batch limitations.

### CATEGORY 5: "YOU MIGHT NOT BE READY FOR THIS" FRAMINGS (5)
Challenge their readiness — this creates a "prove you wrong" response in the right customer.
Each should target a different type of readiness: emotional, financial, commitment, timeline, mindset.

Output valid JSON:
{
  "takeaway_copy": {
    "not_for_everyone": [
      {
        "id": "ta-nfe01",
        "copy": "the takeaway copy block (2-4 sentences) in ${project.sourceLanguage}",
        "copy_target_lang": "in ${project.targetLanguage}",
        "psychology": "why this works — what reaction it triggers",
        "hidden_benefit": "what positive trait this reinforces about the product",
        "best_placement": "ad|advertorial|landing_page|email"
      }
    ],
    "qualification": [...],
    "disqualification": [...],
    "scarcity": [...],
    "not_ready": [...]
  },
  "total_blocks": 25
}

RULES:
- EXACTLY 5 per category = 25 total
- Each block is 2-4 sentences — punchy and direct
- NEVER fabricate scarcity — every scarcity claim must be plausibly true
- Disqualifications must secretly reinforce benefits
- Qualifications must connect to specific Gate 2 sub-avatar traits
- "Not ready" framings must challenge without insulting
- Include both source and target language
- Tone: confident, slightly challenging, never arrogant or dismissive`;
      },
    },
  ],

  // --- LEAD AGENT: Compile, organize, score top hooks ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `You are an elite direct response copywriter for a $100M/year brand. Produce the complete Copy Arsenal — hooks, open loops, sensory language, future pacing, bucket brigades, and takeaway copy.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`;
    }

    return `You are the Lead Copy Strategist at a $100M/year direct response agency. Your team of 7 specialists has produced their work in a 2-phase chain:
- Phase 1: Customer Language Extraction (70 raw phrases from avatar deep dive)
- Phase 2: Hook Crafting (105+ hooks built FROM the extracted language) + 5 parallel specialists (open loops, sensory, future pacing, bucket brigades, takeaway)

Your job: COMPILE them into a single, organized Copy Arsenal.

CRITICAL RULES:
1. Do NOT throw away specialist work — integrate ALL of it
2. The customer language extraction is AMMUNITION — verify hooks actually USE those phrases
3. Organize hooks BY SUB-AVATAR for easy access
4. Verify the top 20 hook scores make sense — re-rank if needed
5. Cross-reference: do open loops pair well with hooks? Do sensory descriptions match future pacing scenes?
6. Flag any gaps: missing sub-avatar coverage, weak categories, voice inconsistencies
7. Add a STRATEGIC SUMMARY: which pieces are strongest, recommended combinations, and which sub-avatar has the richest arsenal

OUTPUT LANGUAGE: All copy in both ${project.sourceLanguage} and ${project.targetLanguage}.`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      let msg = `Build the complete Copy Arsenal for: ${project.name}\nTarget Language: ${project.targetLanguage}\nMarket: ${project.targetMarket}`;
      if (previousOutputs['gate2']) msg += `\n\n=== AVATAR DEEP DIVE (Gate 2) — sub-avatars, angles, quote bank, voice profile, customer language mining ===\n${JSON.stringify(previousOutputs['gate2'])}`;
      if (previousOutputs['gate3']) msg += `\n\n=== ROOT CAUSE & MECHANISM (Gate 3) — root cause, belief error, mechanism, why alternatives fail ===\n${JSON.stringify(previousOutputs['gate3'])}`;
      if (previousOutputs['gate1']) msg += `\n\n=== PRODUCT INTELLIGENCE (Gate 1) — features, benefits, market data, buyer psychology ===\n${JSON.stringify(previousOutputs['gate1'])}`;
      return msg;
    }

    return `Here are your specialists' outputs. Compile them into the unified Copy Arsenal.

=== CUSTOMER LANGUAGE EXTRACTION (70 phrases, 7 categories — Phase 1) ===
${subAgentOutputs['customer-language-extractor'] || 'N/A'}

=== HOOK CRAFTER (105+ hooks from extracted language — Phase 2) ===
${subAgentOutputs['hook-generator'] || 'N/A'}

=== OPEN LOOP WRITER (50 loops, 5 categories) ===
${subAgentOutputs['open-loop-writer'] || 'N/A'}

=== SENSORY LANGUAGE WRITER (50 examples + 20 phrases) ===
${subAgentOutputs['sensory-writer'] || 'N/A'}

=== FUTURE PACING (3 mini-movie scenes) ===
${subAgentOutputs['future-pacer'] || 'N/A'}

=== BUCKET BRIGADES (70 phrases, 7 categories) ===
${subAgentOutputs['bucket-brigade'] || 'N/A'}

=== TAKEAWAY COPY (25 blocks, 5 categories) ===
${subAgentOutputs['takeaway-writer'] || 'N/A'}

Compile into a single unified JSON wrapped in \`\`\`json code blocks:
{
  "customer_language_bank": {
    "micro_specific_moments": [...top phrases...],
    "internal_dialogue": [...],
    "relationship_moments": [...],
    "humiliation_moments": [...],
    "failed_solution_language": [...],
    "transformation_language": [...],
    "trigger_phrases": [...],
    "top_10_phrases": [...ranked by hook potential...],
    "total_extracted": 70
  },
  "hook_bank": {
    "hook_matrix": [...organized by sub-avatar...],
    "top_20_scored": [...re-verified rankings — verify top 10 customer phrases appear...],
    "hooks_by_formula": { "question": 0, "statement": 0, "story": 0, "statistic": 0, "contradiction": 0, "curiosity": 0, "identity": 0 },
    "total_hooks_generated": 0
  },
  "open_loops": {
    "mystery": [...],
    "contradiction": [...],
    "personal_revelation": [...],
    "social_proof": [...],
    "time_bomb": [...]
  },
  "sensory_language": {
    "sight": { "pain": [...], "transformation": [...] },
    "sound": { "pain": [...], "transformation": [...] },
    "touch": { "pain": [...], "transformation": [...] },
    "smell": { "pain": [...], "transformation": [...] },
    "taste": { "pain": [...], "transformation": [...] },
    "sensory_phrases_bank": [...]
  },
  "future_pacing": [...3 scenes...],
  "bucket_brigades": {
    "curiosity": [...],
    "empathy": [...],
    "authority": [...],
    "urgency": [...],
    "transition": [...],
    "contrast": [...],
    "story": [...]
  },
  "takeaway_copy": {
    "not_for_everyone": [...],
    "qualification": [...],
    "disqualification": [...],
    "scarcity": [...],
    "not_ready": [...]
  },
  "arsenal_summary": {
    "total_hooks": 0,
    "total_open_loops": 50,
    "total_sensory_examples": 50,
    "total_sensory_phrases": 20,
    "total_future_pacing_scenes": 3,
    "total_bucket_brigades": 70,
    "total_takeaway_blocks": 25,
    "strongest_sub_avatar": "which sub-avatar has the richest copy arsenal",
    "weakest_sub_avatar": "which needs more work",
    "recommended_hook_loop_combos": ["hook ID + open loop ID that pair well together"],
    "gaps_identified": ["any missing coverage or weak areas"],
    "strategic_notes": "overall assessment of arsenal readiness for Gates 5-8"
  }
}`;
  },

  reviewerPrompt: `You are an elite copy arsenal reviewer and scroll-stopping expert for $100M/year direct response brands. You have reviewed 10,000+ hooks and know what separates a 2% CTR from a 0.2% CTR.

${EVOLVE_COHERENCE_CHAIN}

${EVOLVE_EXECUTION_FRAMEWORK}

DIMENSIONS (each /10, total /100, threshold >=75%):
1. Hook Volume & Coverage: >=105 hooks? All 5 sub-avatars x angles x 7 formulas represented? No gaps?
2. Hook Formula Mastery: Each of the 7 formula types used correctly? No formula confusion? Variety within each formula?
3. Customer Language Fidelity: Hooks sound like real people, not ads? Verbatim language from Gate 2 quote bank used? Voice profile matched? EXACT sub-avatar names used (not renamed)?
4. EVOLVE Scorecard + ZAK Specificity: Top 20 scored honestly? Reptilian triggers identified correctly? Attention hierarchy applied? 3 First Lines evaluated? 3 Hook Requirements met? Every top-20 hook scores 4+ on 7 Types of Specificity (numerical/temporal/sensory/emotional/identity/outcome/process)? Hook stacking present (visual+text+audio)?
5. Open Loop Quality: 50 total across 5 categories? Each creates irresistible tension? Payoffs deliverable? Customer language used?
6. Sensory Language Depth: 5 senses x 2 states x 5 examples = 50? Visceral and specific? Pain/transformation contrast stark? Internal sensations included? SHOW don't TELL applied?
7. Future Pacing Power: 3 scenes? All 6 ZAK elements per scene? 150-200 words each? Would reader get emotional? Sensory-rich?
8. Bucket Brigade Voice Match: 70 phrases across 7 categories? 2-6 words each? Match avatar vocabulary and tone? No cliches?
9. 7 Reasons Ads Fail Check: No hooks lacking emotional impact? Curiosity created? Suspense maintained? 6th grade reading level? Show don't tell? Objections addressed? Awareness levels not skipped?
10. Coherence Lock: Mechanism name EXACT from Gate 3? Root cause EXACT? Emotional intensity NOT dropped from Gate 2? Sub-avatar details NOT lost? Desire elevation NOT dropped?

RED FLAGS (auto-deduct 2 points each from total):
- Generic hooks that could apply to ANY product
- Cliche marketing language ("revolutionary", "game-changer", "secret weapon")
- Fabricated statistics or false scarcity claims
- Open loops with no deliverable payoff
- Sensory language that's vague ("feel bad" instead of specific physical sensation)
- Future pacing scenes under 100 words or missing ZAK elements
- Bucket brigades over 6 words
- Voice mismatch between pieces
- Top-20 hooks scoring under 3 on the 7 Types of Specificity
- No copy format recommendation per awareness level
- Missing trigger phrase categorization

Respond in valid JSON:
{
  "score": 0,
  "maxScore": 100,
  "percentage": 0,
  "passed": false,
  "dimensions": [
    { "criterionId": "hook_volume", "name": "Hook Volume & Coverage", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "hook_formula", "name": "Hook Formula Mastery", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "customer_language", "name": "Customer Language Fidelity", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "evolve_scorecard", "name": "EVOLVE Scorecard Rigor", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "open_loops", "name": "Open Loop Quality", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "sensory_language", "name": "Sensory Language Depth", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "future_pacing", "name": "Future Pacing Power", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "bucket_brigades", "name": "Bucket Brigade Voice Match", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "takeaway", "name": "Takeaway Authenticity", "score": 0, "maxScore": 10, "feedback": "" },
    { "criterionId": "cohesion", "name": "Arsenal Cohesion", "score": 0, "maxScore": 10, "feedback": "" }
  ],
  "red_flags_found": [],
  "red_flag_deductions": 0,
  "feedback": "overall assessment with specific improvement instructions",
  "iteration": 0
}`,

  reviewCriteria: `Score each of 10 dimensions /10. Be brutal — generic copy = low scores. Evidence-based specificity and authentic voice = high scores. Total /100, pass >= 75%. Deduct 2 points per red flag.`,

  reviewThreshold: 75,
  hasCongruenceCheck: true,

  congruencePrompt: `You are the Brand DNA Congruence Agent for copy arsenal review. This gate produces the building blocks for ALL downstream copy (Gates 5-8), so congruence here is CRITICAL — drift here multiplies across every future gate.

CHECK EACH ARSENAL ELEMENT AGAINST BRAND DNA:

1. VOICE PROFILE MATCH (25%):
   - Do hooks match the voice_profile formality level?
   - Do bucket brigades use vocabulary from the voice_profile vocabulary list?
   - Do future pacing scenes match the emotional_tone?
   - Do open loops use phrases_to_use and avoid phrases_to_avoid?
   - Does the overall tone match the sample_paragraph voice?

2. CUSTOMER LANGUAGE COMPLIANCE (25%):
   - Are always_use words/phrases actually used across the arsenal?
   - Are ZERO never_use words/phrases present anywhere? (scan EVERY piece)
   - Are conditional_use terms only used in their allowed contexts?
   - Do hooks incorporate actual pain_quotes and desire_quotes from the bank?

3. LOCKED TERMS RESPECTED (25%):
   - Is the mechanism_name used exactly as locked (no paraphrasing, no abbreviation)?
   - Is the root_cause_one_sentence framing consistent across hooks that reference it?
   - Is the belief_error framed correctly in contradiction hooks?
   - Are the 3 mechanism steps named exactly when referenced?
   - Is the product_descriptor used correctly?
   - Is the guarantee_wording exact when referenced?

4. EMOTIONAL ARC ALIGNMENT (15%):
   - Do hooks match the emotional_arc for "ad" touchpoint?
   - Do future pacing scenes match the resolution_emotion?
   - Is the primary_emotion present in the strongest hooks?
   - Does the pain→transformation arc match the awareness_progression?

5. CROSS-GATE CONSISTENCY (10%):
   - Do hooks reference real data from Gate 1 (features, claims, stats)?
   - Do sensory descriptions match Gate 2 avatar experiences?
   - Does mechanism language match Gate 3 exactly?
   - Are sub-avatar names and angles consistent with Gate 2?

Flag EVERY deviation:
- CRITICAL: Wrong mechanism name, never_use word found, fabricated claim
- WARNING: Voice drift, missing always_use words, emotional arc mismatch
- MINOR: Slight formality level shift, minor vocabulary deviation

Respond in valid JSON:
{
  "score": 0,
  "passed": false,
  "dimensions": {
    "voice_profile_match": 0,
    "customer_language_compliance": 0,
    "locked_terms_respected": 0,
    "emotional_arc_alignment": 0,
    "cross_gate_consistency": 0
  },
  "driftReport": [
    {
      "location": "hook h023 / open loop ol-m05 / future pacing scene 2 / etc.",
      "expected": "what Brand DNA says",
      "found": "what the arsenal actually contains",
      "severity": "CRITICAL|WARNING|MINOR"
    }
  ],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific instructions for fixing any drift — reference exact pieces by ID",
  "iteration": 0
}`,

  congruenceThreshold: 85,
};

export default gate4;
