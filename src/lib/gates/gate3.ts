// ============================================================
// GATE 3 — ROOT CAUSE & MECHANISM
// Sub-agents: root-cause-phase1, root-cause-phase2, belief-error,
//             mechanism-builder, villain-creator, ugc-points
// Lead: Compile into unified root cause + mechanism JSON
// ============================================================

import { GateConfigDef } from './types';

const gate3: GateConfigDef = {
  id: 'gate3',
  description: 'Root cause research, mechanism creation, villain framing, belief error identification',

  subAgents: [
    // --- WAVE 1: Independent research ---
    {
      id: 'root-cause-phase1',
      name: 'Root Cause Raw Researcher',
      model: 'sonnet',
      systemPrompt: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `You are a world-class investigative researcher specializing in finding root causes that the general public does NOT know about. You dig into scientific studies, expert interviews, medical literature, niche forums, and contrarian sources.

Your job: find the REAL root cause of the avatar's core problem. Not the surface explanation. Not the mainstream narrative. The HIDDEN explanation that makes everything click.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}

PRODUCT CONTEXT:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 2000) : project.productDescription}

AVATAR CONTEXT (core problems & failed solutions):
${g2 ? JSON.stringify(g2, null, 2).slice(0, 2000) : 'Not available — infer from product and market'}`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const avatarSnippet = g2 ? JSON.stringify(g2, null, 2).slice(0, 1500) : '';

        return `${avatarSnippet ? `AVATAR DEEP DIVE (summary):\n${avatarSnippet}\n\n` : ''}PRODUCT DESCRIPTION:
${project.productDescription}

## ROOT CAUSE RESEARCH — Phase 1: Raw Discovery

Research what ACTUALLY causes the avatar's core problem. Go beyond surface-level explanations.

RESEARCH PROTOCOL:
1. Start with what the MAINSTREAM says (the "accepted" cause)
2. Find studies/experts that CHALLENGE the mainstream view
3. Look for emerging research, overlooked mechanisms, or suppressed findings
4. Identify the ONE hidden factor that connects all the dots
5. Find 3-5 supporting sources for the hidden root cause

Output valid JSON:

{
  "root_cause_research": {
    "problem_statement": "the core problem the avatar faces — be specific",
    "mainstream_explanation": {
      "what_people_think": "the commonly accepted cause",
      "why_its_incomplete": "what the mainstream explanation misses",
      "sources": ["mainstream sources that promote this view"]
    },
    "hidden_root_cause": {
      "discovery": "the REAL root cause — detailed explanation",
      "mechanism": "HOW this root cause creates the problem — step by step",
      "evidence": [
        {
          "source_type": "study|expert|clinical_data|forum_pattern|emerging_research",
          "summary": "what the source found",
          "credibility": "why this is credible",
          "reference": "study name, expert name, or source link"
        }
      ],
      "why_nobody_talks_about_it": "why this root cause is hidden or overlooked",
      "connection_to_product": "how our product addresses this root cause"
    },
    "secondary_factors": [
      {
        "factor": "contributing factor",
        "relationship_to_root_cause": "how it interacts with the primary root cause",
        "copy_relevance": "can we use this in messaging?"
      }
    ],
    "timeline_of_damage": "how the root cause compounds over time — progressive worsening",
    "raw_data_points": [
      "specific statistics, percentages, or data points that support the root cause"
    ]
  }
}

RULES:
- The hidden root cause must be CREDIBLE, not conspiracy-theory level
- Evidence must be specific — named studies, named experts, real data
- The root cause should create an "aha moment" — "THAT explains everything!"
- Must explain why EXISTING solutions fail (connects to avatar's failed attempts)
- At least 3 evidence sources for the main root cause
- Timeline of damage creates urgency — the longer they wait, the worse it gets`;
      },
    },

    {
      id: 'belief-error',
      name: 'False Belief Identifier',
      model: 'opus',
      systemPrompt: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `You are an expert in consumer belief psychology and persuasion architecture. You specialize in identifying the FALSE BELIEFS that keep people stuck in their problems — the wrong assumptions they hold that prevent them from finding the right solution.

The belief error is the PIVOT POINT of all direct response copy. It's the moment where the reader goes from "nothing works" to "wait... maybe I was approaching this wrong all along."

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}

PRODUCT CONTEXT:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 2000) : project.productDescription}

AVATAR CONTEXT:
${g2 ? JSON.stringify(g2, null, 2).slice(0, 2000) : 'Not available — infer from product and market'}`;
      },

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `AVATAR RESEARCH:
${g2 ? JSON.stringify(g2, null, 2).slice(0, 2500) : project.productDescription}

## FALSE BELIEF IDENTIFICATION

Identify the core FALSE BELIEF the avatar holds about their problem. This is what they THINK is true but ISN'T — and it's the reason everything they've tried has failed.

BELIEF ERROR FRAMEWORK:
1. What do they BELIEVE causes their problem? (the false belief)
2. WHY do they believe this? (where did the belief come from?)
3. Why is it WRONG? (the error in their thinking)
4. What is actually TRUE? (the corrected belief — connects to our root cause)
5. How does this false belief HURT them? (consequences of believing the wrong thing)

Output valid JSON:

{
  "belief_error": {
    "primary_false_belief": {
      "belief": "what they currently believe — stated in their own words",
      "origin": "where this belief comes from (doctors, media, industry, personal experience, culture)",
      "origin_narrative": "the story of HOW they came to believe this — specific sources, messages, experiences",
      "why_its_wrong": "the logical/scientific error in this belief",
      "what_it_costs_them": "specific consequences of holding this belief — wasted money, wasted time, worsening problem",
      "emotional_weight": "how this belief makes them FEEL — guilt, shame, hopelessness",
      "corrected_belief": "what they SHOULD believe instead — the truth that sets them free",
      "aha_sentence": "the ONE sentence that shatters the false belief — the pivot moment"
    },
    "supporting_false_beliefs": [
      {
        "belief": "secondary false belief",
        "why_wrong": "brief explanation",
        "copy_use": "how to reference this in copy"
      }
    ],
    "belief_ecosystem": {
      "who_profits_from_false_belief": "who benefits from people believing the wrong thing",
      "who_reinforces_it": "what authority figures or institutions repeat this belief",
      "how_its_reinforced": "specific channels, messages, and moments that reinforce the false belief"
    },
    "copy_architecture": {
      "before_belief_shift": {
        "avatar_state": "what they believe and feel BEFORE reading our copy",
        "internal_monologue": "what they say to themselves — 'I've tried everything...'"
      },
      "pivot_moment": {
        "trigger_question": "the question that starts to crack the false belief",
        "new_information": "the specific fact or insight that shatters it",
        "emotional_response": "what they feel in the moment of realization — relief, anger, vindication"
      },
      "after_belief_shift": {
        "avatar_state": "what they now believe and feel AFTER the pivot",
        "internal_monologue": "what they say — 'So THAT'S why...'",
        "readiness_to_buy": "why they're now open to our solution"
      }
    },
    "variations": {
      "for_ads": "one-line version of the belief error for ad hooks",
      "for_vsl": "expanded version for video sales letter narration",
      "for_ugc": "conversational version a UGC creator would say naturally",
      "for_email": "curiosity-driven version for email subject lines"
    }
  }
}

RULES:
- The false belief must be something the avatar ACTUALLY believes — not a straw man
- It must be widely held in their community (this is not a niche error)
- The correction must feel like a REVELATION, not a lecture
- The aha_sentence is the single most important line — spend 80% of your thinking time here
- Variations must be copy-ready — a copywriter can paste them directly
- Supporting false beliefs: at least 3, each with copy use case
- Belief ecosystem identifies the VILLAINS who perpetuate the lie`;
      },
    },

    {
      id: 'villain-creator',
      name: 'Villain Architect',
      model: 'opus',
      systemPrompt: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `You are a narrative strategist specializing in villain creation for direct response marketing. You understand that every great sales narrative needs an EXTERNAL ENEMY to blame — it removes guilt from the customer and redirects anger toward something they can fight by buying the product.

Your villains must be:
- CREDIBLE (not conspiracy-level)
- SPECIFIC (named or nameable)
- EMOTIONALLY SATISFYING to blame
- CONNECTED to the real root cause

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
NICHE: ${project.niche || 'Determine from product'}

PRODUCT CONTEXT:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 1500) : project.productDescription}

AVATAR CONTEXT:
${g2 ? JSON.stringify(g2, null, 2).slice(0, 1500) : 'Not available'}`;
      },

      userMessage: (project) => `PRODUCT DESCRIPTION:
${project.productDescription}

## VILLAIN CREATION — Three Villain Types

Create 3 distinct villain types that the copy can blame for the avatar's problem. Each serves a different narrative purpose.

{
  "villains": {
    "hidden_enemy": {
      "name": "specific ingredient, substance, compound, chemical, or biological factor",
      "what_it_is": "detailed explanation of what this villain IS",
      "what_it_does": "how it causes or worsens the problem — specific mechanism",
      "where_its_found": "where the avatar encounters it without knowing",
      "why_they_dont_know": "why this isn't common knowledge",
      "shock_factor": 1-10,
      "evidence": "research or data that supports this as a real contributing factor",
      "copy_lines": [
        "3-5 ready-to-use copy lines that introduce this villain",
        "Each should create a 'wait, WHAT?' reaction"
      ],
      "visual_metaphor": "a vivid image/metaphor for this villain that works in video"
    },
    "the_system": {
      "name": "the industry, establishment, institution, or conventional wisdom to blame",
      "what_they_do": "how they perpetuate the problem — specific actions or inactions",
      "why_they_do_it": "their motivation — usually profit, laziness, or outdated thinking",
      "proof_points": [
        "specific examples of the system failing the avatar"
      ],
      "anger_level": 1-10,
      "us_vs_them_framing": "how to position our product as the REBEL fighting this system",
      "copy_lines": [
        "3-5 ready-to-use copy lines that expose this villain",
        "Each should create righteous anger"
      ],
      "credibility_check": "why this claim is defensible and not defamatory"
    },
    "the_self_saboteur": {
      "name": "the specific habit, behavior, or belief the avatar has that makes things worse",
      "what_it_is": "the self-sabotaging pattern — described with empathy, NOT judgment",
      "why_they_do_it": "why this behavior feels rational to them (it's NOT their fault)",
      "how_it_worsens": "specific mechanism by which this behavior compounds the problem",
      "guilt_removal": "how to present this WITHOUT making the avatar feel blamed — externalize the cause",
      "copy_lines": [
        "3-5 ready-to-use copy lines that reveal this pattern",
        "Each must be empathetic — 'It's not your fault that...'"
      ],
      "redemption_arc": "how our product/solution breaks this cycle"
    },
    "villain_hierarchy": {
      "primary": "which villain to lead with in most copy and why",
      "secondary": "which villain supports the primary narrative",
      "tertiary": "which villain to use for variation and retargeting",
      "recommended_sequence": "the order in which to introduce villains in a long-form piece"
    },
    "villain_combinations": [
      {
        "combo_name": "name for this villain stack",
        "villains_used": ["hidden_enemy + the_system", etc.],
        "narrative": "how they work together in a single story",
        "best_for": "ad type or format this combo works best in"
      }
    ]
  }
}

RULES:
- Hidden Enemy must be a SPECIFIC substance/ingredient/factor — not vague
- The System must be a recognizable institution or industry practice
- Self-Saboteur must be presented with ZERO blame on the avatar — it's not their fault
- Copy lines must be ready to paste into ads — no placeholders
- Each villain must connect back to WHY existing solutions have failed
- Credibility check on The System: we must be able to defend this claim
- At least 2 villain combinations showing how they layer together
- Visual metaphor for Hidden Enemy: something that works in video/imagery`,
    },

    // --- WAVE 2: Depends on root-cause-phase1 ---
    {
      id: 'root-cause-phase2',
      name: 'Root Cause Simplifier & Aha Builder',
      model: 'opus',
      dependsOn: ['root-cause-phase1'],
      systemPrompt: (project) => `You are a master simplifier and "aha moment" architect. You take complex scientific findings and distill them into 6th grade reading level explanations that create instant understanding.

Your specialty: the SINGLE SENTENCE that makes someone stop scrolling, lean in, and think "THAT'S why nothing worked for me!"

You write at a 6th grade reading level. Short sentences. Simple words. Vivid analogies. Zero jargon.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, _previousOutputs, peerOutputs) => `RAW ROOT CAUSE RESEARCH:
${peerOutputs['root-cause-phase1'] || 'Not available — use product context'}

PRODUCT DESCRIPTION:
${project.productDescription}

## ROOT CAUSE — Phase 2: Simplify & Create the Aha Moment

Take the raw research from Phase 1 and make it SIMPLE, VIVID, and COPY-READY.

{
  "root_cause_simplified": {
    "one_sentence": "the root cause explained in ONE sentence that a 12-year-old would understand",
    "analogy": "a vivid analogy that makes the root cause click instantly — 'It's like [X]...'",
    "three_step_explanation": [
      "Step 1: Here's what's happening in your body/life (the hidden thing)",
      "Step 2: Here's what that causes (the visible symptom they recognize)",
      "Step 3: Here's why everything you've tried has failed (connects to the root cause)"
    ],
    "aha_moment": {
      "setup": "the question or statement that opens the loop — creates curiosity",
      "reveal": "the surprising answer — the root cause explained simply",
      "implication": "what this MEANS for them — why this changes everything",
      "full_aha_sentence": "the complete aha moment as one powerful sentence"
    },
    "sixth_grade_explanation": "3-4 sentences explaining the root cause as if explaining to a smart 12-year-old. No jargon. Use 'you' language.",
    "copy_ready_versions": {
      "for_hook": "10-word version for ad hooks",
      "for_lead": "2-sentence version for the top of a VSL or sales page",
      "for_body": "paragraph version for the body of long-form copy",
      "for_ugc": "conversational version a UGC creator would say on camera",
      "for_email_subject": "curiosity version for email subject lines — 5-8 words"
    },
    "proof_stack": [
      {
        "type": "statistic|study|expert_quote|before_after|analogy",
        "content": "the specific proof point",
        "simplified": "how to present this proof at 6th grade level",
        "emotional_impact": "what the reader feels when they hear this"
      }
    ],
    "common_objections_to_root_cause": [
      {
        "objection": "what a skeptic would say — 'But my doctor said...'",
        "response": "how to address this without being confrontational",
        "tone": "empathetic, not combative"
      }
    ]
  }
}

RULES:
- The aha_moment.full_aha_sentence is the CROWN JEWEL — it must be unforgettable
- 6th grade reading level means: short words, short sentences, concrete images
- The analogy must be VIVID and from everyday life — "It's like trying to fill a bucket with a hole in the bottom"
- Copy-ready versions must be DISTINCT from each other, not just length variations
- Proof stack: at least 4 items, each simplified to accessible language
- Common objections: at least 3 — these WILL come up in comments/replies
- Everything in this output must be usable by a copywriter with ZERO modification`,
    },

    // --- WAVE 3: Depends on root-cause-phase2 ---
    {
      id: 'mechanism-builder',
      name: 'Proprietary Mechanism Architect',
      model: 'opus',
      dependsOn: ['root-cause-phase2'],
      systemPrompt: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;

        return `You are a mechanism naming and positioning expert for direct response brands. You create proprietary-sounding 3-step solution mechanisms that make products feel unique, credible, and inevitable.

A great mechanism:
- Has a PROPRIETARY NAME (sounds like real science, but is brandable)
- Has exactly 3 SIMPLE STEPS (easy to remember, easy to explain)
- DIRECTLY addresses the root cause (not just the symptoms)
- Sounds like a DISCOVERY, not a product pitch
- Makes the solution feel INEVITABLE once you understand the root cause

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}

PRODUCT FEATURES & INGREDIENTS:
${g1 ? JSON.stringify(g1, null, 2).slice(0, 2000) : project.productDescription}`;
      },

      userMessage: (project, _previousOutputs, peerOutputs) => `ROOT CAUSE (simplified):
${peerOutputs['root-cause-phase2'] || 'Not available — use product context'}

PRODUCT DESCRIPTION:
${project.productDescription}

## MECHANISM BUILDING — Proprietary 3-Step Solution

Build a proprietary mechanism that directly addresses the root cause. Name it. Make it memorable. Make it feel like a scientific breakthrough that's also simple enough for anyone to understand.

{
  "mechanism": {
    "name": "proprietary name — sounds scientific but accessible (e.g., 'The Cortisol Flush Protocol', 'The 3-Phase Gut Reset')",
    "tagline": "one-line description — 'The [name] is a [what it is] that [what it does]'",
    "positioning": "discovery|protocol|method|system|formula — which frame works best",
    "why_this_name": "strategic reasoning behind the name choice",
    "steps": [
      {
        "number": 1,
        "name": "step name — short, action-oriented",
        "what_it_does": "plain language explanation of this step — 6th grade level",
        "how_it_connects_to_root_cause": "why this step is necessary based on the root cause",
        "key_ingredient_or_action": "the specific product feature, ingredient, or behavior tied to this step",
        "analogy": "vivid analogy for this step — 'Think of it like...'",
        "timeframe": "how quickly this step works (or starts working)",
        "proof_point": "evidence that this step works"
      },
      {
        "number": 2,
        "name": "step name",
        "what_it_does": "",
        "how_it_connects_to_root_cause": "",
        "key_ingredient_or_action": "",
        "analogy": "",
        "timeframe": "",
        "proof_point": ""
      },
      {
        "number": 3,
        "name": "step name",
        "what_it_does": "",
        "how_it_connects_to_root_cause": "",
        "key_ingredient_or_action": "",
        "analogy": "",
        "timeframe": "",
        "proof_point": ""
      }
    ],
    "how_it_works_simple": "full 3-step explanation in one flowing paragraph at 6th grade level — must sound like a friend explaining it over coffee",
    "how_it_works_technical": "same explanation with more scientific detail for credibility sections",
    "why_nothing_else_works": "why OTHER solutions fail because they DON'T address the root cause this way",
    "uniqueness_claim": "what makes this mechanism DIFFERENT from everything else on the market",
    "copy_ready": {
      "vsl_mechanism_section": "3-5 sentences introducing the mechanism in a VSL — builds on the root cause reveal",
      "ad_mechanism_hook": "10-15 words that tease the mechanism in an ad without giving it away",
      "ugc_mechanism_explanation": "how a UGC creator would explain this naturally in 15-20 seconds",
      "landing_page_headline": "headline for the mechanism section of a sales page",
      "email_tease": "one line that creates curiosity about the mechanism without revealing it"
    },
    "alternative_names": [
      {
        "name": "alternative proprietary name",
        "style": "clinical|natural|tech|authority",
        "best_for": "which audience or format this name works best for"
      }
    ],
    "mechanism_proof": {
      "logical_proof": "why the 3 steps logically MUST work based on the root cause",
      "social_proof_angle": "how to frame testimonials around the mechanism",
      "authority_proof_angle": "what expert endorsement or study supports this approach",
      "demonstration_idea": "how to SHOW the mechanism working (visual, demo, analogy)"
    }
  }
}

RULES:
- The mechanism name must be PROPRIETARY — something no competitor uses
- Exactly 3 steps — no more, no less
- Each step must be SIMPLE enough to explain in one sentence
- Each step must LOGICALLY follow from the root cause
- The mechanism must connect real product features/ingredients to the root cause
- "how_it_works_simple" must pass the coffee conversation test
- Alternative names: at least 3, different styles
- The mechanism must make the product feel INEVITABLE — "of course this works, it addresses the real problem"
- Copy-ready sections must be directly usable, not templates`,
    },

    // --- WAVE 4: Depends on root-cause-phase2 + mechanism-builder ---
    {
      id: 'ugc-points',
      name: 'UGC Talking Points Generator',
      model: 'sonnet',
      dependsOn: ['root-cause-phase2', 'mechanism-builder'],
      systemPrompt: (project) => `You are a UGC script strategist who creates natural, conversational talking points for content creators. You understand how real people explain complex health/product topics on TikTok, Instagram Reels, and YouTube Shorts.

Your talking points must sound like someone who GENUINELY discovered something amazing and can't wait to tell their friends — NOT like a scripted ad.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, _previousOutputs, peerOutputs) => `ROOT CAUSE (simplified):
${peerOutputs['root-cause-phase2'] || 'Not available'}

MECHANISM:
${peerOutputs['mechanism-builder'] || 'Not available'}

PRODUCT DESCRIPTION:
${project.productDescription}

## UGC TALKING POINTS — Root Cause & Mechanism

Generate talking points a UGC creator could use to explain the root cause and mechanism in a natural, conversational way. These should work for 15-60 second video formats.

{
  "ugc_talking_points": {
    "root_cause_hooks": [
      {
        "hook": "the opening line that stops the scroll — 3-7 words",
        "type": "question|statement|confession|challenge|reveal",
        "scroll_stop_score": 1-10
      }
    ],
    "root_cause_scripts": [
      {
        "format": "story|education|rant|confession|reaction",
        "duration": "15s|30s|60s",
        "hook": "opening line",
        "setup": "1-2 sentences setting up the problem (relatable)",
        "reveal": "1-2 sentences revealing the root cause (the aha)",
        "bridge": "1 sentence connecting to the solution",
        "cta_direction": "where to direct (not the actual CTA — that's for later gates)",
        "tone": "excited|shocked|empathetic|conspiratorial|educational",
        "creator_type": "expert|everyday_person|mom|fitness_enthusiast|skeptic_convert — who delivers this best"
      }
    ],
    "mechanism_scripts": [
      {
        "format": "explainer|demo|before_after_story|myth_bust",
        "duration": "30s|60s",
        "hook": "opening line about the mechanism",
        "step1_explanation": "how to explain step 1 naturally",
        "step2_explanation": "how to explain step 2 naturally",
        "step3_explanation": "how to explain step 3 naturally",
        "why_it_works_line": "the one line that ties it all together",
        "creator_type": ""
      }
    ],
    "villain_scripts": [
      {
        "villain_type": "hidden_enemy|the_system|self_saboteur",
        "format": "expose|rant|warning|education",
        "hook": "opening line",
        "talking_points": ["3-5 bullet points the creator hits"],
        "emotional_arc": "start → middle → end emotion",
        "tone": ""
      }
    ],
    "combo_scripts": [
      {
        "name": "script concept name",
        "elements": "root_cause + mechanism|villain + root_cause|etc.",
        "duration": "30s|60s",
        "full_outline": "complete talking point outline — what to say in order",
        "creator_type": ""
      }
    ],
    "do_and_dont": {
      "do": ["things that make root cause/mechanism content feel authentic"],
      "dont": ["things that make it feel like an ad or lecture"]
    }
  }
}

RULES:
- At least 5 root cause hooks with scroll-stop scores
- At least 4 root cause scripts across different formats and durations
- At least 3 mechanism scripts
- At least 3 villain scripts (one per villain type)
- At least 2 combo scripts
- ALL talking points must sound NATURAL — like gossip, not a presentation
- Creator types must be specific — don't just say "influencer"
- Hooks must be genuinely scroll-stopping — test against "would I stop for this?"
- Do/dont: at least 5 items each`,
    },
  ],

  // --- LEAD AGENT: Compile all sub-agent outputs ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `You are a root cause and mechanism strategist for a $100M/year direct response brand. Produce a comprehensive root cause analysis, mechanism, and villain framework.

PRODUCT URL: ${project.productUrl}
PRODUCT DESCRIPTION: ${project.productDescription}
TARGET MARKET: ${project.targetMarket}`;
    }

    return `You are the Lead Strategist at a $100M/year direct response agency. Your team of 6 specialists has completed their root cause research, belief error analysis, mechanism building, villain creation, and UGC talking point development.

Your job: COMPILE their work into a single, cohesive Root Cause & Mechanism Dossier that becomes the foundation for all copy and creative.

CRITICAL RULES:
1. Do NOT discard any specialist work — integrate ALL of it
2. Cross-reference the root cause with the belief error — they MUST align
3. Verify the mechanism directly addresses the root cause — no logical gaps
4. Ensure villains are consistent with the root cause narrative
5. Check that UGC talking points accurately reflect the simplified root cause
6. Resolve any contradictions between specialists
7. Add your strategic synthesis — what does the combined picture mean for creative?
8. Create copy-ready variations that use the unified root cause + mechanism + villain narrative

OUTPUT: A single unified JSON dossier that a creative team can use as their source of truth for ALL root cause and mechanism messaging.`;
  },

  userMessage: (project, previousOutputs, subAgentOutputs) => {
    const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
    const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

    if (!subAgentOutputs || Object.keys(subAgentOutputs).length === 0) {
      return `Analyze this product and produce the full root cause & mechanism dossier.

PRODUCT: ${project.productDescription}
GATE 1 (Product Intel): ${g1 ? JSON.stringify(g1, null, 2).slice(0, 2000) : 'Not available'}
GATE 2 (Avatar): ${g2 ? JSON.stringify(g2, null, 2).slice(0, 2000) : 'Not available'}`;
    }

    return `Here are your specialists' reports. Compile them into the unified Root Cause & Mechanism Dossier.

PREVIOUS GATE CONTEXT:
- Gate 1 summary: ${g1 ? JSON.stringify(g1, null, 2).slice(0, 1000) : 'Not available'}
- Gate 2 summary: ${g2 ? JSON.stringify(g2, null, 2).slice(0, 1000) : 'Not available'}

=== ROOT CAUSE — RAW RESEARCH (Phase 1) ===
${subAgentOutputs['root-cause-phase1'] || 'N/A'}

=== ROOT CAUSE — SIMPLIFIED & AHA MOMENT (Phase 2) ===
${subAgentOutputs['root-cause-phase2'] || 'N/A'}

=== FALSE BELIEF / BELIEF ERROR ===
${subAgentOutputs['belief-error'] || 'N/A'}

=== PROPRIETARY MECHANISM ===
${subAgentOutputs['mechanism-builder'] || 'N/A'}

=== VILLAIN FRAMEWORK ===
${subAgentOutputs['villain-creator'] || 'N/A'}

=== UGC TALKING POINTS ===
${subAgentOutputs['ugc-points'] || 'N/A'}

Compile into a single JSON wrapped in \`\`\`json code blocks:
{
  "root_cause": {
    "raw_research": { ... from phase 1 ... },
    "simplified": { ... from phase 2 ... },
    "aha_moment": "the single most powerful aha sentence",
    "proof_stack": [ ... ],
    "copy_ready": {
      "hook_version": "",
      "lead_version": "",
      "body_version": "",
      "ugc_version": "",
      "email_version": ""
    }
  },
  "belief_error": {
    "primary_false_belief": { ... },
    "supporting_false_beliefs": [ ... ],
    "belief_ecosystem": { ... },
    "copy_architecture": { ... },
    "variations": { ... }
  },
  "mechanism": {
    "name": "",
    "tagline": "",
    "steps": [ ... 3 steps ... ],
    "how_it_works_simple": "",
    "how_it_works_technical": "",
    "copy_ready": { ... },
    "alternative_names": [ ... ],
    "proof": { ... }
  },
  "villains": {
    "hidden_enemy": { ... },
    "the_system": { ... },
    "the_self_saboteur": { ... },
    "hierarchy": { ... },
    "combinations": [ ... ]
  },
  "ugc_talking_points": {
    "root_cause_hooks": [ ... ],
    "root_cause_scripts": [ ... ],
    "mechanism_scripts": [ ... ],
    "villain_scripts": [ ... ],
    "combo_scripts": [ ... ]
  },
  "narrative_alignment": {
    "root_cause_to_belief_error": "how the root cause connects to and shatters the false belief",
    "root_cause_to_mechanism": "how the mechanism directly addresses the root cause",
    "root_cause_to_villains": "how each villain connects to the root cause",
    "belief_error_to_mechanism": "how the mechanism corrects the false belief",
    "full_narrative_arc": "the complete story from false belief → root cause reveal → villain blame → mechanism solution"
  },
  "copy_master_variations": {
    "pain_lead": "complete root cause narrative leading with pain",
    "curiosity_lead": "complete root cause narrative leading with curiosity",
    "anger_lead": "complete root cause narrative leading with villain/anger",
    "story_lead": "complete root cause narrative told as a personal story"
  },
  "strategic_synthesis": "your expert assessment — what do all these findings mean for creative strategy? What's the strongest narrative path?"
}`;
  },

  reviewerPrompt: `You are a senior direct response strategist reviewing a Root Cause & Mechanism Dossier. Score with brutal honesty. This gate is the FOUNDATION of all copy — if it's weak, everything downstream fails.

DIMENSIONS (each /10, total /100, threshold >=72%):
1. Root Cause Credibility: Is the root cause believable, evidence-backed, and not conspiracy-level? Does it explain why existing solutions fail?
2. Aha Moment Power: Does the aha sentence create a genuine "THAT'S why nothing worked" moment? Is it memorable and specific?
3. 6th Grade Simplification: Is the root cause explained simply enough for anyone to understand? No jargon? Vivid analogies?
4. Belief Error Precision: Is the false belief something the avatar ACTUALLY believes? Is the correction a genuine revelation, not a lecture?
5. Mechanism Naming & Structure: Is the proprietary name memorable and credible? Are the 3 steps logical, simple, and connected to the root cause?
6. Villain Quality: Are all 3 villain types specific, credible, and emotionally satisfying? Is the self-saboteur handled with empathy?
7. Narrative Alignment: Do root cause, belief error, mechanism, and villains all tell ONE coherent story? Any contradictions?
8. Copy-Ready Quality: Can a copywriter use the provided variations immediately without modification? Are they distinct from each other?
9. UGC Talking Points: Do the scripts sound natural and conversational? Are hooks genuinely scroll-stopping? Multiple formats covered?
10. Strategic Completeness: Is anything missing that Gate 4+ will need? Does this connect properly to Gate 1 product intel and Gate 2 avatar research?

Respond in valid JSON with score, maxScore (100), dimensions array (each with name, score, maxScore, feedback), feedback (overall), and passed boolean.`,

  reviewCriteria: `Score each dimension /10. The aha moment and narrative alignment are the most critical — weak performance there cannot be offset by strong performance elsewhere. Total /100, pass >= 72%.`,

  reviewThreshold: 72,
  hasCongruenceCheck: false,
};

export default gate3;
