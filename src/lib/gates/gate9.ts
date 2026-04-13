// ============================================================
// GATE 9 — CAMPAIGN BLUEPRINT
// Sub-agents: campaign-architect, testing-strategist, brief-creator,
//             naming-system, scaling-planner
// Lead: Compile into launch-ready Campaign Blueprint
// ============================================================

import { GateConfigDef } from './types';
import { EVOLVE_TESTING_SCALING, EVOLVE_PLANNING_FRAMEWORK, EVOLVE_COHERENCE_CHAIN, EVOLVE_FEEDBACK_LOOP } from './evolveFrameworks';
import { ZAK_SCALING_ADVANCED } from './zakFrameworks';

const gate9: GateConfigDef = {
  id: 'gate9',
  description: 'Campaign blueprint — account structure, testing strategy, creator briefs, naming conventions, scaling playbook',

  subAgents: [
    // --- WAVE 1 (all parallel — no dependencies) ---
    {
      id: 'campaign-architect',
      name: 'Campaign Structure Architect',
      model: 'opus',
      systemPrompt: (project) => `You are a senior Meta Ads campaign architect for a $100M/year direct response brand. You design campaign structures using CBO (Campaign Budget Optimization) that scale profitably.

You follow the ZAK Meta Ads Scaling SOP and EVOLVE naming conventions precisely.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const g6 = previousOutputs['gate6'] as Record<string, unknown> | undefined;
        const g7 = previousOutputs['gate7'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}

${g1 ? `PRODUCT INTEL (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 4000)}` : ''}

${g4 ? `TOP HOOKS (Gate 4):\n${JSON.stringify(g4, null, 2).slice(0, 4000)}` : ''}

${g6 ? `AD CONCEPTS & HEADLINES (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 4000)}` : ''}

${g7 ? `CREATIVE BRIEFS (Gate 7 — static ad presets & briefs):\n${JSON.stringify(g7, null, 2).slice(0, 5000)}` : ''}

${EVOLVE_TESTING_SCALING}

## MISSION: Design the COMPLETE 5-Campaign Meta Ads Account Structure (EVOLVE 2026)

You MUST design ALL 5 campaigns as described in the EVOLVE framework above:
1. EAM MAIN CBO CAMPAIGN — Champions Ad Set + DCT ad sets (3-2-2 structure) + Page Test ad sets
2. ABO TESTING & SCALING CAMPAIGN — Breakthrough/Spend Winner/KPI Winner ad sets + Hard Exclusions + 1-Day Click
3. ZOMBIE/GRAVEYARD CAMPAIGN — CBO with cost cap (20% below CPA target), ALL losing ads dumped here
4. RAW CONTENT CAMPAIGN — UGC, product seeding, flexible ads
5. PROMO CAMPAIGN — Broad + Warm 60 + Hot 90 (only for real limited promos)

### NAMING CONVENTIONS (EVOLVE)
- Campaign: [Agency] // [Type] // [Objective] // [CBO/ABO]
- Ad Set: [DCT# + name] // [Country] // [Gender] // [Age] // [Audiences]
- Ad: [DCT#] // [Ad name] // [Variable] // [LP] // [Copy+Headline variant]

### BUDGET ALLOCATION
- 50-Conversion Rule: (target_CPA × 50) / 7 = minimum daily budget per ad set
- Breakeven ROAS = 1 / Gross Profit Margin
- Scaling ROAS = Breakeven + 1 point

### RESULTS CLASSIFICATION (for ad set management)
- BREAKTHROUGH: Sucks up spend + hits KPI + allows SCALING (the holy grail)
- SPEND WINNER: Sucks up spend but does NOT hit KPI (maintains level)
- KPI WINNER: Hits KPI but does not pull significant spend
- LOSER: Neither KPI nor spend → moves to Zombie/Graveyard

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "campaign_structure": {
    "one_campaign_philosophy": "explanation of why ONE CBO campaign does everything with 100% BROAD targeting",
    "campaigns": [
      {
        "campaign_number": 1,
        "name": "campaign name using EVOLVE naming template",
        "type": "EAM_MAIN|ABO_TESTING|ZOMBIE|RAW_CONTENT|PROMO",
        "budget_type": "CBO|ABO",
        "objective": "Sales|Leads|Traffic",
        "objective_reasoning": "",
        "daily_budget": 0,
        "budget_reasoning": "",
        "cost_cap": null,
        "ad_sets": [
          {
            "name": "ad set name using EVOLVE naming",
            "type": "champions|dct_test|page_test|breakthrough|spend_winner|kpi_winner|hard_exclusion|1day_click|broad|warm60|hot90",
            "focus": "description of what this ad set does",
            "format": "video|image|mixed",
            "dct_structure": "3 ads, 2 body copies, 2 headlines (3-2-2) if applicable",
            "targeting": {
              "type": "broad|warm|hot",
              "details": "100% BROAD for main, specific for promo",
              "age_range": "",
              "gender": ""
            },
            "budget_allocation": "percentage of campaign budget",
            "ads": ["ad names/references"]
          }
        ]
      }
    ],
    "total_campaigns": 5,
    "total_ad_sets": 0,
    "results_classification": {
      "breakthrough": "definition + what to do with these ads",
      "spend_winner": "definition + what to do",
      "kpi_winner": "definition + what to do",
      "loser": "definition + moves to Zombie/Graveyard"
    },
    "naming_convention_applied": {
      "campaign_template": "[Agency] // [Type] // [Objective] // [CBO/ABO]",
      "adset_template": "[DCT# + name] // [Country] // [Gender] // [Age] // [Audiences]",
      "ad_template": "[DCT#] // [Ad name] // [Variable] // [LP] // [Copy+Headline variant]"
    }
  },
  "budget_plan": {
    "fifty_conversion_rule": {
      "formula": "(target_CPA × 50) / 7",
      "calculated_minimum_daily": 0,
      "target_cpa": 0
    },
    "breakeven_roas": {
      "formula": "1 / Gross Profit Margin",
      "gross_profit_margin": 0,
      "breakeven": 0,
      "scaling_roas": 0
    },
    "estimated_cpa": 0,
    "recommended_total_daily": 0,
    "phase_1_testing_daily": 0,
    "phase_2_scaling_daily": 0,
    "zombie_budget": "~10% of total spend",
    "reasoning": ""
  },
  "pixel_setup": {
    "primary_conversion_event": "",
    "secondary_events": [],
    "attribution_window": "7-day click, 1-day view",
    "attribution_analysis": {
      "healthy_threshold": ">70% click-based",
      "view_through_warning": ">50% view-through = inflated numbers",
      "how_to_check": "Customize Columns > Compare Attribution Settings > 7 day click"
    },
    "conversion_api": "recommended|optional",
    "setup_notes": ""
  },
  "bad_ad_protection": {
    "ad_set_daily_maximum": "e.g., $500 for new test ad sets (for >$15K/day accounts)",
    "misclick_detection": "Link Clicks vs Landing Page Views ratio below 90% = misclicks"
  }
}

RULES:
- MUST output ALL 5 campaigns (not just 1 CBO)
- 100% BROAD targeting on main campaign (no audiences, no retargeting, no lookalikes)
- The CREATIVE does all the targeting — Meta's algorithm finds the right people
- Champions Ad Set = winning ads via duplication (keeps FB+IG engagement)
- Zombie/Graveyard = ALL losing ads, cost cap 20% below CPA target
- Budget must respect 50-conversion rule
- All naming follows EVOLVE template with // separators
- Include Results Classification for ad management decisions`;
      },
    },

    {
      id: 'testing-strategist',
      name: 'Testing Strategy Designer',
      model: 'sonnet',
      systemPrompt: (project) => `You are a Meta Ads testing strategist who uses the EVOLVE 3 Testing Methods framework. You design scientific, systematic testing plans that maximize learning per dollar spent.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
        const g7 = previousOutputs['gate7'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g1 ? `PRODUCT INTEL & SCORECARD (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 4000)}` : ''}
${g2 ? `SUB-AVATARS & ANGLES (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}
${g4 ? `TOP HOOKS (Gate 4):\n${JSON.stringify(g4, null, 2).slice(0, 4000)}` : ''}
${g7 ? `CREATIVE BRIEFS PRODUCED (Gate 7 — what ads exist):\n${JSON.stringify(g7, null, 2).slice(0, 4000)}` : ''}

${EVOLVE_PLANNING_FRAMEWORK}

## MISSION: Design the testing strategy using EVOLVE 3 Methods

CRITICAL DISTINCTION (from EVOLVE):
- CONCEPT = internally focused (what WE want to test)
- ANGLE = externally focused (why the CUSTOMER should buy)
- Quick test: Does it give the customer a reason to buy? YES = angle. NO = concept.

### METHOD 1: MARKSMAN (find direction)
- Test 3 DIFFERENT angles in 1 concept. 1 variation each. Use FIRST.
- 3-2-2 structure: 3 creatives, 2 body copies, 2 headlines per ad set
- Wait for 50 conversions before making decisions
- Best for: new products, unknown CPA, finding DIRECTION
- Confidence level: HIGH (clear causation)

### METHOD 2: SNIPER (exploit direction)
- Test 3 executions of 1 WINNING angle. Use SECOND.
- Iterate within the winning angle from Marksman
- Quick iteration cycles (4-7 days per test)
- Best for: validated angle, need to find winning EXECUTION
- Speed: MEDIUM

### METHOD 3: SHOTGUN (volume — UGC ONLY)
- Random ads, ONLY for incoming UGC/creator content
- NEVER for strategic testing
- High volume, low structure
- Best for: incoming creator content only

## YOUR DELIVERABLE

1. **Launch Method Selection**: Which method to use at launch and WHY (based on product scorecard, market sophistication, and budget)

2. **Method Transition Plan**: When to switch from one method to another:
   - Marksman -> Sniper trigger: specific metrics/milestones
   - Sniper -> Shotgun trigger: specific metrics/milestones
   - When to go BACK to Marksman (new market, new avatar)

3. **Specific Testing Sequences**: Week-by-week plan for first 4 weeks:
   - Week 1: What exactly to test
   - Week 2: What to test based on Week 1 results
   - Week 3: Iteration or expansion
   - Week 4: First scaling decisions

4. **Testing Variables Priority**: Rank what to test first:
   - Avatar (which sub-avatar responds best)
   - Angle (which reason-to-buy wins)
   - Hook (which opening grabs attention)
   - Format (video vs image vs carousel)
   - Copy length (short vs long)
   - CTA (which call-to-action converts)

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "testing_strategy": {
    "launch_method": "marksman|sniper|shotgun",
    "launch_method_reasoning": "detailed reasoning based on product data",
    "methods_detailed": {
      "marksman": {
        "description": "Test 1 variable at a time, high confidence",
        "when_to_use": "",
        "budget_range": "",
        "creatives_per_cycle": "3-5",
        "decision_threshold": "50 conversions",
        "cycle_length": "7-14 days",
        "specific_process": ["step 1", "step 2", "..."]
      },
      "sniper": {
        "description": "Test creative angles, medium speed",
        "when_to_use": "",
        "budget_range": "",
        "creatives_per_cycle": "5-10",
        "decision_threshold": "30-50 conversions per angle",
        "cycle_length": "4-7 days",
        "specific_process": ["step 1", "step 2", "..."]
      },
      "shotgun": {
        "description": "Rapid creative testing, high volume",
        "when_to_use": "",
        "budget_range": "",
        "creatives_per_cycle": "15-30",
        "decision_threshold": "statistical significance",
        "cycle_length": "3-5 days",
        "specific_process": ["step 1", "step 2", "..."]
      }
    },
    "transition_triggers": {
      "marksman_to_sniper": {
        "metrics": ["specific metric thresholds"],
        "milestones": ["what must be true before switching"]
      },
      "sniper_to_shotgun": {
        "metrics": ["specific metric thresholds"],
        "milestones": ["what must be true before switching"]
      },
      "back_to_marksman": "when entering new market, new avatar, or after major pivot"
    },
    "weekly_test_plan": [
      {
        "week": 1,
        "method": "marksman",
        "focus": "what to test this week",
        "creatives_to_test": 0,
        "variables_tested": ["variable 1"],
        "success_criteria": "specific measurable criteria",
        "decision_rules": "what to do with results"
      }
    ],
    "variable_priority": [
      { "rank": 1, "variable": "", "reasoning": "" }
    ],
    "breakthrough_memo_template": {
      "what": "What are we doing concretely in this ad?",
      "why": "Why are we making it? What data/insight/research justifies it?",
      "how": "How are we going to do it? (format, inspiration, style)"
    },
    "ad_types": {
      "ideation": "Idea from YOUR research (Reddit, Amazon, YouTube)",
      "imitation": "Idea from ANOTHER brand's ad",
      "iteration": "Idea from YOUR OWN existing ads"
    },
    "iteration_chain": "MARKSMAN → find direction → SNIPER → exploit → plateau → back to MARKSMAN",
    "three_batch_iteration": {
      "batch_1": "BIG SWING — wildly different angles, hooks, formats. Find DIRECTION.",
      "batch_2": "MEDIUM SWING — variations within winning angle from Batch 1.",
      "batch_3": "REFINED EXECUTION — fine-tune the winning variation from Batch 2."
    },
    "iteration_priority_order": "Hook > Headline > Benefits > Persona"
  }
}

RULES:
- Launch method MUST be justified by product data (scorecard, market sophistication)
- 50-conversion rule applies to ALL methods
- MARKSMAN first, SNIPER second, SHOTGUN for UGC only — never reverse
- Testing sequences must be specific enough for a media buyer to execute day 1
- Transition triggers must be measurable, not subjective
- Every ad must have a BREAKTHROUGH MEMO (WHAT/WHY/HOW)
- Include 3-batch iteration process and iteration priority order`;
      },
    },

    {
      id: 'brief-creator',
      name: 'Creator Brief Generator',
      model: 'opus',
      systemPrompt: (project) => `You are a world-class UGC (User Generated Content) brief creator for a $100M/year direct response brand. You create briefs using the ZAK 10-Section Framework that make creators EXCITED to film.

Your briefs are famous for being creator-friendly: casual, clear, story-focused, and never corporate.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}`,

      userMessage: (project, previousOutputs) => {
        const g6 = previousOutputs['gate6'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const brandDna = previousOutputs['brand-dna'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g6 ? `AD SCRIPTS & COPY (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 6000)}` : ''}
${g2 ? `AVATAR DATA (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}
${g1 ? `PRODUCT INTEL (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 4000)}` : ''}
${brandDna ? `BRAND DNA:\n${JSON.stringify(brandDna, null, 2).slice(0, 5000)}` : ''}

## MISSION: Create 2 UGC Creator Briefs

Generate 2 complete creator briefs using the ZAK 10-Section Framework:

### BRIEF 1: Pain-Focused UGC
The creator tells a story centered on the PAIN/PROBLEM — the struggle, the frustration, the failed attempts — then discovers the product as the solution.

### BRIEF 2: Transformation-Focused UGC
The creator tells a story centered on the TRANSFORMATION — the before/after, the life change, the identity shift — with the product as the catalyst.

## ZAK 10-SECTION FRAMEWORK (apply to EACH brief):

### Section 1: Brand Overview
- What the brand stands for (1-2 sentences)
- Brand voice and personality
- What makes this brand different

### Section 2: Target Audience Summary
- Who we are talking to (sub-avatar description)
- Their current emotional state
- What they have already tried and why it failed

### Section 3: Key Messages
- 6-8 messages the creator MUST communicate
- Priority order (most important first)
- Each message in conversational language

### Section 4: Tone & Voice Guidelines
- Tone: conversational, authentic, relatable
- Voice: first-person storytelling
- Energy level per section of the video
- Words/phrases to USE (from customer language)
- Words/phrases to AVOID

### Section 5: Do's and Don'ts
- DO: film in natural environments, use natural lighting, show real emotion
- DO: pause for emphasis, look at camera, be specific about experiences
- DON'T: sound scripted, use corporate language, rush through key moments
- DON'T: make medical/legal claims, show competitor logos
- Specific do's and don'ts for THIS product

### Section 6: Visual Guidelines
- Filming environment (kitchen, bathroom, living room, outdoor)
- Lighting (natural preferred, warm tones)
- Wardrobe suggestions (relatable, not glamorous)
- Camera angles (eye level, close-up for emotion, wide for environment)
- Product shots (unboxing, holding, using, results)

### Section 7: Script / Talking Points
- NOT a word-for-word script — TALKING POINTS
- Story beats with approximate timing
- Key phrases they MUST include naturally
- Emotional beats: where to show vulnerability, excitement, relief
- Note: "Tell this story in YOUR words — these are just the beats"

### Section 8: Platform Specifications
- Format: 9:16 vertical video
- Length: 45-90 seconds (sweet spot: 60 seconds)
- Resolution: minimum 1080p
- Sound: clear audio, no background music needed
- Captions: will be added post-production

### Section 9: Deliverables Checklist
- [ ] Main video (60 seconds)
- [ ] 3 alternative hooks (first 5 seconds, 3 versions)
- [ ] B-roll clips (product close-ups, lifestyle shots, reaction shots)
- [ ] Raw footage (unedited, for future iterations)

### Section 10: Timeline & Process
- Review brief: Day 1
- Questions/clarification: Day 1-2
- Film raw footage: Day 3-5
- Submit footage: Day 5
- Revision round (if needed): Day 6-7
- Final delivery: Day 7

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "creator_briefs": [
    {
      "id": "brief_pain_ugc",
      "type": "pain-focused",
      "title": "Brief title",
      "target_sub_avatar": "which sub-avatar this targets",
      "sections": {
        "brand_overview": "",
        "target_audience": "",
        "key_messages": ["message 1", "message 2", "..."],
        "tone_voice": {
          "tone": "",
          "voice": "",
          "energy_flow": "",
          "words_to_use": [""],
          "words_to_avoid": [""]
        },
        "dos_and_donts": {
          "dos": [""],
          "donts": [""]
        },
        "visual_guidelines": {
          "environment": "",
          "lighting": "",
          "wardrobe": "",
          "camera_angles": "",
          "product_shots": [""]
        },
        "talking_points": {
          "story_beats": [
            { "beat": 1, "timing": "0-5s", "content": "", "emotion": "", "energy": "" }
          ],
          "must_include_phrases": [""],
          "note": "Tell this story in YOUR words — these are the beats, not a script"
        },
        "platform_specs": {
          "format": "9:16 vertical",
          "length": "45-90 seconds",
          "resolution": "1080p minimum",
          "sound": "clear audio, no background music",
          "captions": "added post-production"
        },
        "deliverables": ["main video", "3 alt hooks", "b-roll clips", "raw footage"],
        "timeline": {
          "review_brief": "Day 1",
          "questions": "Day 1-2",
          "film": "Day 3-5",
          "submit": "Day 5",
          "revision": "Day 6-7",
          "final": "Day 7"
        }
      }
    },
    {
      "id": "brief_transformation_ugc",
      "type": "transformation-focused",
      "title": "Brief title",
      "target_sub_avatar": "which sub-avatar this targets",
      "sections": { "...same structure as above..." }
    }
  ]
}

GOLDEN RULES:
- Creator should understand STORY and EMOTIONS, not memorize words
- Max 2 pages when printed per brief
- Casual language, no corporate speak
- Every section must be specific to THIS product and THIS avatar
- Talking points, NOT scripts — creators perform best with freedom
- Include emotional direction: "show vulnerability here", "let genuine excitement show"`;
      },
    },

    {
      id: 'naming-system',
      name: 'EVOLVE Naming Convention Generator',
      model: 'sonnet',
      systemPrompt: (project) => `You are a Meta Ads naming convention specialist using the EVOLVE 3-level naming system. Clean, consistent naming is critical for managing campaigns at scale.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g6 = previousOutputs['gate6'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}
${g6 ? `AD SCRIPTS (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 4000)}` : ''}

## MISSION: Create EVOLVE 3-Level Naming Conventions

### LEVEL 1: CAMPAIGN LEVEL
Template: objective_audience_date
- objective: Sales, Leads, Traffic, etc.
- audience: sub-avatar nickname or segment
- date: launch date (YYMMDD format)
Example: Sales_StrugglingMom_260415

### LEVEL 2: AD SET LEVEL
Template: avatar_angle_targeting
- avatar: sub-avatar identifier
- angle: the reason-to-buy being tested
- targeting: broad, interest, LAL (lookalike), retarget
Example: SA1_PainRelief_Broad

### LEVEL 3: AD LEVEL
Template: concept_creative-type_variation
- concept: creative concept name
- creative-type: UGC, Static, Carousel, Video
- variation: V1, V2, V3 (for A/B testing)
Example: MorningRoutine_UGC_V1

## ADDITIONAL NAMING TEMPLATES

### Ad File Naming:
Template: Client - Batch# - ConceptName - Format - Type - Variation#
- Type: IDEA (new concept), ITER (iteration of winner), IMIT (imitation of competitor)
Example: ${project.name || 'Brand'} - B01 - MorningRoutine - 9x16 - IDEA - V1

### UTM Parameters:
- utm_campaign = campaign name (Level 1)
- utm_content = ad name (Level 3)
- utm_medium = paid-social
- utm_source = facebook

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "naming_system": {
    "level_1_campaign": {
      "template": "objective_audience_date",
      "components": {
        "objective": ["Sales", "Leads", "Traffic", "Awareness"],
        "audience": ["list of sub-avatar nicknames"],
        "date": "YYMMDD format"
      },
      "rules": ["keep under 40 chars", "no spaces — use underscores", "..."]
    },
    "level_2_adset": {
      "template": "avatar_angle_targeting",
      "components": {
        "avatar": ["SA1", "SA2", "SA3", "SA4", "SA5"],
        "angle": ["list of angle short names from Gate 2"],
        "targeting": ["Broad", "Interest", "LAL1", "LAL5", "LAL10", "Retarget"]
      },
      "rules": ["one avatar per ad set", "one angle per testing ad set", "..."]
    },
    "level_3_ad": {
      "template": "concept_creative-type_variation",
      "components": {
        "concept": ["list of concept short names"],
        "creative_type": ["UGC", "Static", "Carousel", "Video", "Image"],
        "variation": ["V1", "V2", "V3"]
      },
      "rules": ["max 3 variations per concept for testing", "..."]
    },
    "file_naming": {
      "template": "Client - Batch# - ConceptName - Format - Type - Variation#",
      "types": {
        "IDEA": "New creative concept",
        "ITER": "Iteration of a winning creative",
        "IMIT": "Imitation/inspiration from competitor"
      }
    },
    "utm_parameters": {
      "utm_campaign": "Level 1 campaign name",
      "utm_content": "Level 3 ad name",
      "utm_medium": "paid-social",
      "utm_source": "facebook"
    },
    "complete_examples": [
      {
        "example_number": 1,
        "scenario": "description of what this example represents",
        "campaign_name": "Level 1 name",
        "adset_name": "Level 2 name",
        "ad_name": "Level 3 name",
        "file_name": "file naming",
        "utm_string": "full UTM string"
      }
    ]
  }
}

RULES:
- Generate naming templates for ALL 3 levels
- Generate exactly 5 complete examples showing all levels applied
- Examples must use real sub-avatar names and angles from Gate 2
- Names must be scannable — a media buyer should understand the name at a glance
- System must scale to 100+ ads without confusion
- No special characters except underscores and hyphens`;
      },
    },

    {
      id: 'scaling-planner',
      name: 'Scaling Playbook Architect',
      model: 'opus',
      systemPrompt: (project) => `You are a scaling strategist for Meta Ads with $100M+ in managed ad spend. You design scaling playbooks that take campaigns from $100/day to $10,000+/day profitably.

You follow the EVOLVE Scaling Protocol and 50-Conversion Rule precisely.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
        const g6 = previousOutputs['gate6'] as Record<string, unknown> | undefined;
        const g7 = previousOutputs['gate7'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g1 ? `PRODUCT INTEL & SCORECARD (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 4000)}` : ''}
${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}
${g6 ? `AD CONCEPTS & HEADLINES (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 4000)}` : ''}
${g7 ? `CREATIVE BRIEFS PRODUCED (Gate 7):\n${JSON.stringify(g7, null, 2).slice(0, 4000)}` : ''}

${EVOLVE_TESTING_SCALING}

${EVOLVE_FEEDBACK_LOOP}

${ZAK_SCALING_ADVANCED}

## MISSION: Create the complete Scaling Playbook

### PHASE 1: TESTING ($X/day budget)
- Starting daily budget recommendation
- How many creatives to test per cycle
- Kill criteria (when to turn off an ad):
  - CPA threshold: X times target CPA = kill
  - Spend threshold: spent X without conversion = kill
  - Time threshold: X days without improvement = kill
  - Frequency threshold: frequency > X = creative fatigue
  - CTR threshold: CTR below X% = kill
- Win criteria (when an ad is a "winner"):
  - CPA below target for X consecutive days
  - ROAS above X for X days
  - Minimum spend threshold reached

### PHASE 2: VALIDATION (when to increase budget)
- Budget increase rules:
  - Only increase on winning ad sets
  - Maximum increase: 20-30% per day
  - Never increase budget on losing day
  - Wait 48-72 hours after increase before next increase
- Validation criteria before scaling:
  - Minimum X profitable days
  - CPA stable (not trending up)
  - Frequency below X
  - Attribution quality: 70%+ click-based

### PHASE 3: SCALING (horizontal vs vertical)
- Vertical scaling: increase budget on winning ad sets
  - Max 20-30% increase per step
  - Monitor for CPA increase after each step
  - Rollback rules if CPA spikes
- Horizontal scaling: duplicate winners to new audiences
  - Lookalike audiences (1%, 3%, 5%, 10%)
  - New geographies
  - New sub-avatars with proven angles
  - Cross-platform (Instagram Reels, Facebook Feed, etc.)
- When to scale vertically vs horizontally

### KILL RULES (detailed)
- CPA thresholds: specific numbers based on product price
- Frequency caps: creative fatigue signals
  - Frequency > 2.5 in 7 days = warning
  - Frequency > 3.5 = swap creative
  - Frequency > 5 = kill
- Creative fatigue signals:
  - CTR declining 3 days in a row
  - CPA increasing 3 days in a row
  - Hook rate dropping below benchmark
- The "3 strikes" rule: 3 consecutive losing days = pause

### ZAK 50-CONVERSION RULE APPLICATION
- Calculate minimum daily spend to achieve 50 conversions/week/ad set
- Formula: (target CPA x 50) / 7 = minimum daily budget per ad set
- If budget too low for 50 conversions → reduce ad sets, not daily spend
- Track: are ad sets consistently hitting 50 conversions/week?

### WEEKLY OPTIMIZATION CHECKLIST
- Monday: review last week's performance (7-day window)
- Tuesday: kill underperformers, reallocate budget
- Wednesday: launch new creatives (mid-week = cleaner data)
- Thursday: monitor new creative performance
- Friday: scaling decisions (increase budget on winners)
- Saturday-Sunday: observe only, no changes (lower CPMs, skewed data)

### ATTRIBUTION & REPORTING
- 7-day click attribution (primary, HIGH trust)
- 1-day click attribution (secondary, MEDIUM trust)
- 1-day view attribution (reference only, LOW trust)
- Must be 70%+ click-based to trust scaling decisions
- Calculate click attribution percentage weekly

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "scaling_playbook": {
    "phase_1_testing": {
      "daily_budget": 0,
      "creatives_per_cycle": 0,
      "cycle_length_days": 0,
      "kill_criteria": {
        "cpa_threshold": "X times target CPA",
        "spend_threshold": "X spent without conversion",
        "time_threshold": "X days without improvement",
        "frequency_threshold": "frequency > X",
        "ctr_threshold": "CTR below X%"
      },
      "win_criteria": {
        "cpa_target": "",
        "consecutive_days": 0,
        "minimum_spend": ""
      }
    },
    "phase_2_validation": {
      "budget_increase_rules": {
        "max_increase_percent": "20-30%",
        "wait_period_hours": "48-72",
        "only_on_winning_days": true
      },
      "validation_criteria": {
        "min_profitable_days": 0,
        "cpa_stability": "",
        "max_frequency": 0,
        "attribution_quality": "70%+ click"
      }
    },
    "phase_3_scaling": {
      "vertical": {
        "max_increase_per_step": "20-30%",
        "monitoring_period": "48-72 hours",
        "rollback_trigger": "",
        "max_daily_budget_per_adset": ""
      },
      "horizontal": {
        "lookalike_sequence": ["1%", "3%", "5%", "10%"],
        "new_geos": ["list of expansion markets"],
        "new_avatars": "apply proven angles to next sub-avatar in launch order",
        "cross_platform": ["placement expansion strategy"]
      },
      "vertical_vs_horizontal": "when to use each"
    },
    "kill_rules": {
      "cpa_thresholds": {
        "warning": "X times target CPA",
        "kill": "X times target CPA",
        "calculation": "based on product price of X"
      },
      "frequency_caps": {
        "warning": 2.5,
        "swap_creative": 3.5,
        "kill": 5.0,
        "window": "7-day rolling"
      },
      "creative_fatigue_signals": [
        "CTR declining 3+ consecutive days",
        "CPA increasing 3+ consecutive days",
        "Hook rate below benchmark",
        "Comment sentiment turning negative"
      ],
      "three_strikes_rule": "3 consecutive losing days = pause ad"
    },
    "fifty_conversion_rule": {
      "formula": "(target_CPA x 50) / 7 = minimum daily budget per ad set",
      "calculated_minimum": 0,
      "if_budget_insufficient": "reduce number of ad sets, not daily spend per ad set",
      "tracking_method": "weekly check — are ad sets hitting 50 conversions?"
    },
    "weekly_checklist": {
      "monday": "Review last 7 days performance",
      "tuesday": "Kill underperformers, reallocate budget",
      "wednesday": "Launch new creatives",
      "thursday": "Monitor new creative performance",
      "friday": "Scaling decisions on winners",
      "saturday_sunday": "Observe only — no changes (skewed weekend data)"
    },
    "attribution": {
      "primary": "7-day click (HIGH trust)",
      "secondary": "1-day click (MEDIUM trust)",
      "reference": "1-day view (LOW trust)",
      "scaling_rule": "Must be 70%+ click-based to scale",
      "calculation": "click_conversions / total_conversions x 100"
    },
    "evolve_scaling_protocol": {
      "entry_trigger": "48-72h of CONSISTENT performance ABOVE target KPI",
      "standard_increase": "+20%",
      "aggressive_increase": "Double or +50% (when 50%+ above KPI)",
      "big_budget_decrease": "15%, 10%, 5% increments for $10K+/day",
      "small_budget_increase": "More aggressive for <$3K/day",
      "decrease_trigger": "Below breakeven for 24-48h → decrease -20%",
      "minimum_spend_action": "Focus OUTSIDE the ad account (new DCTs, funnel check, research)"
    },
    "surf_scaling": {
      "when": "promos/BFCM only",
      "method": "Scale budget MULTIPLE times per day (every 2-6 hours)",
      "midnight_reset": "RESET budget to (actual spend / 2) at midnight",
      "hourly_check_protocol": {
        "hour_0_6": "Let algorithm warm up, no changes",
        "hour_6_12": "First check — CPA trending below target? If yes, +20%",
        "hour_12_18": "Second check — scale up if performing, scale down if not",
        "hour_18_24": "Final check — prepare for midnight reset",
        "midnight": "Reset budget = (actual spend / 2)"
      },
      "pre_load": "48 hours before surge, increase budget gradually to warm the algorithm",
      "max_duration": "3-7 day windows ONLY — not sustainable"
    },
    "lp_testing_3222": {
      "framework": "3:2:2:2 Landing Page Testing",
      "sequence": [
        "1. Test 3 different HOOKS (above the fold) — highest impact, fastest signal",
        "2. Winner gets 2 BODY variations (narrative vs. feature list)",
        "3. Winner gets 2 OFFER variations (pricing, bundles, guarantees)",
        "4. Winner gets 2 DESIGN variations (layout, colors, imagery)"
      ],
      "min_conversions_per_test": 100,
      "test_method": "Page Test ad sets in main campaign (not external tools)"
    },
    "attribution_quality_check": {
      "formula": "(7-day click purchases / total purchases) × 100",
      "healthy": ">70% click-based — your ads are driving real clicks",
      "watch": "50-70% click-based — consider 7-day click only for decisions",
      "inflated": "<50% click-based — view-through is padding your numbers, use 7-day click only",
      "red_flag": "If removing view-through makes campaign unprofitable, you don't have a real winner"
    },
    "scaling_decision_matrix": [
      { "performance": "Above KPI 48h+", "action": "Scale +20%", "timeline": "Immediate" },
      { "performance": "Above KPI 72h+", "action": "Scale +30-50%", "timeline": "Immediate" },
      { "performance": "At KPI (break-even)", "action": "Hold, test new creatives", "timeline": "1-2 days" },
      { "performance": "Below KPI 24h", "action": "Hold, monitor", "timeline": "Wait 24h more" },
      { "performance": "Below KPI 48h+", "action": "Decrease -20%", "timeline": "Immediate" },
      { "performance": "Below KPI 72h+", "action": "Decrease -40% or pause", "timeline": "Immediate" }
    ],
    "seasonal_reactivation": "Re-activate old winning ads at the same time of year — some ads perform at the SAME season year after year",
    "actions_outside_ad_account": [
      "1. Launch new DCTs (ALWAYS priority #1)",
      "2. Double-check the funnel (bugs, errors, out of stock)",
      "3. Data analysis + feedback loops",
      "4. Deep research for new avatars and mechanisms",
      "5. Offer testing (new pricing, bundles)"
    ],
    "roller_coaster_fix": {
      "A": "Target PERMANENT desires, not trends",
      "B": "Move UP in awareness (unaware/problem aware = most scalable, least competitive)",
      "C": "Create ads that EDUCATE or ENTERTAIN (or both) — become authority",
      "D": "Build congruent funnels + irresistible offers"
    },
    "feedback_loop": {
      "rule": "NON-NEGOTIABLE for EVERY ad tested (winner AND loser)",
      "on_losers": [
        "1. Pull metrics: % of spend distribution across variations (7-day window)",
        "2. Identify winning variation: <5%=loser, ~10%=signal, 30-50%=winner, >50%=super winner",
        "3. Compare variations: what did the winner do differently?",
        "4. Compare with proven templates",
        "5. Formulate BROAD learnings (not 'this headline didn't work')",
        "6. Create action plan: what specific NEW ads?"
      ],
      "on_winners": [
        "1. Play/pause hook frame by frame — what makes first 1-3s captivating?",
        "2. Identify the DESIRES being triggered (not features)",
        "3. Analyze hold rate: where do people drop off?",
        "4. Feed learnings to AI for new variations preserving winning elements"
      ],
      "iteration_priority": "Hook > Headline > Benefits > Persona"
    }
  }
}

RULES:
- All thresholds must be SPECIFIC numbers, not vague ("if it's not working")
- Kill rules must be actionable on day 1
- Budget math must check out (50-conv rule + breakeven ROAS formula)
- Scaling Protocol entry/exit triggers must be specific (48-72h above KPI)
- Include EVOLVE scaling amounts (+20% standard, +50%/double aggressive)
- Include feedback loop process for both winners AND losers
- Include actions OUTSIDE the ad account when at minimum spend
- Weekly checklist must be executable by a junior media buyer
- Scaling decisions must reference attribution quality
- Include ZAK Surge Scaling protocol with hourly check schedule + midnight reset formula
- Include 3:2:2:2 LP Testing framework (Hooks → Body → Offer → Design)
- Include attribution quality check with specific thresholds (>70%/50-70%/<50%)
- Include scaling decision matrix (specific actions per performance tier)`;
      },
    },
  ],

  // --- LEAD AGENT: Compile all sub-agent outputs into Campaign Blueprint ---
  generatorPrompt: (project, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `You are a senior media buyer AND campaign strategist for a $100M/year direct response brand. Produce a complete campaign launch blueprint for: ${project.name}`;
    }
    return `You are the Lead Campaign Strategist at a $100M/year direct response agency. Your team of 5 specialists has completed their individual analyses. Your job: COMPILE their work into a single, cohesive, launch-ready Campaign Blueprint.

CRITICAL RULES:
1. Do NOT discard specialist work — integrate ALL of it
2. Cross-reference: campaign structure must use the naming system, testing strategy must align with budget, creator briefs must reference the right sub-avatars
3. Resolve any conflicts between specialists (e.g., budget recommendations from campaign-architect vs scaling-planner)
4. Add your strategic synthesis: what is the launch sequence? What gets tested first? What does week 1 look like?
5. The final blueprint must be executable by a media buyer + creative team on day 1

OUTPUT: A unified JSON that serves as the complete campaign launch document.`;
  },

  userMessage: (project, _previousOutputs, subAgentOutputs) => {
    if (!subAgentOutputs) {
      return `Product: ${project.productDescription}\nProduce the complete campaign blueprint.`;
    }
    return `Here are your specialists' reports. Compile them into the unified Campaign Blueprint.

=== CAMPAIGN STRUCTURE (campaign-architect) ===
${subAgentOutputs['campaign-architect'] || 'N/A'}

=== TESTING STRATEGY (testing-strategist) ===
${subAgentOutputs['testing-strategist'] || 'N/A'}

=== CREATOR BRIEFS (brief-creator) ===
${subAgentOutputs['brief-creator'] || 'N/A'}

=== NAMING CONVENTIONS (naming-system) ===
${subAgentOutputs['naming-system'] || 'N/A'}

=== SCALING PLAYBOOK (scaling-planner) ===
${subAgentOutputs['scaling-planner'] || 'N/A'}

Compile into a single unified JSON wrapped in \`\`\`json code blocks:
{
  "campaign_blueprint": {
    "executive_summary": "1-paragraph overview of the launch plan",
    "launch_sequence": [
      { "day": 1, "action": "", "details": "" }
    ]
  },
  "campaign_structure": { "...from campaign-architect..." },
  "testing_strategy": { "...from testing-strategist..." },
  "creator_briefs": [ "...from brief-creator..." ],
  "naming_conventions": { "...from naming-system..." },
  "scaling_playbook": { "...from scaling-planner..." },
  "budget_summary": {
    "phase_1_daily": 0,
    "phase_2_daily": 0,
    "phase_3_daily": 0,
    "monthly_projection": { "month_1": 0, "month_2": 0, "month_3": 0 }
  },
  "cross_reference_checks": {
    "naming_applied_to_campaigns": true,
    "budget_aligns_with_fifty_conv_rule": true,
    "testing_method_matches_budget": true,
    "creator_briefs_match_sub_avatars": true,
    "scaling_thresholds_consistent": true
  },
  "strategic_synthesis": "what all this means — the big picture launch strategy",
  "week_1_action_plan": {
    "day_1": "",
    "day_2": "",
    "day_3": "",
    "day_4": "",
    "day_5": "",
    "day_6_7": ""
  }
}`;
  },

  reviewerPrompt: `You are a senior media buyer reviewer with $100M+ in managed ad spend. Score with brutal honesty based on whether a team could execute this blueprint on day 1.

${EVOLVE_COHERENCE_CHAIN}

DIMENSIONS (each /10, total /100, threshold >=72%):
1. 5-Campaign Structure: ALL 5 campaigns present (EAM Main, ABO Testing, Zombie/Graveyard, Raw Content, Promo)? Champions Ad Set + DCT structure? 100% broad targeting on main?
2. Budget Math: 50-conversion rule calculated? Breakeven ROAS formula present? Zombie budget at ~10%?
3. Testing Strategy: MARKSMAN→SNIPER→SHOTGUN chain correct? Shotgun restricted to UGC only? 3-2-2 structure applied?
4. Testing Variables: Breakthrough Memo (WHAT/WHY/HOW) template included? 3-batch iteration process? Iteration priority order?
5. Creator Briefs: Complete ZAK 10-section structure? Casual, not corporate? Story-focused? 2 distinct briefs (pain + transformation)?
6. Naming Conventions: Uses EVOLVE // separator template? Campaign/AdSet/Ad naming all covered? 5 complete examples?
7. Scaling Playbook: EVOLVE scaling protocol (+20% standard, +50% aggressive)? Entry trigger (48-72h above KPI)? Actions outside ad account? ZAK Surge Scaling with hourly check protocol + midnight reset? Scaling decision matrix included?
8. Results Classification + Attribution: Breakthrough/Spend Winner/KPI Winner/Loser categories defined? Zombie/Graveyard rules? Attribution quality check (>70%/50-70%/<50% thresholds)? Red flag for view-through dependency?
9. LP Testing + Feedback Loop: 3:2:2:2 LP Testing framework (Hooks→Body→Offer→Design) with min 100 conversions? Winner AND loser analysis process? Iteration priority (Hook > Headline > Benefits > Persona)?
10. Coherence: Does the blueprint use the EXACT mechanism name, sub-avatar names, and angles from upstream gates? No renamed/diluted terms?

Respond in valid JSON:
\`\`\`json
{
  "score": 0,
  "maxScore": 100,
  "dimensions": [
    { "name": "Campaign Structure", "score": 0, "maxScore": 10, "feedback": "" }
  ],
  "feedback": "",
  "passed": false
}
\`\`\``,

  reviewCriteria: `Score each dimension /10. Vague recommendations = low score. Specific, executable, number-backed = high score. Total /100, pass >= 72%.`,

  reviewThreshold: 72,

  hasCongruenceCheck: true,
  congruencePrompt: `Brand DNA Congruence Agent for campaign blueprint.

CHECK:
1. CAMPAIGN NAMING: Uses correct mechanism name and brand terms from Brand DNA? Naming consistent throughout?
2. CREATOR BRIEFS: Use approved customer language and voice_profile? Key messages align with Brand DNA messaging hierarchy?
3. TESTING STRATEGY: Aligned with Brand DNA sub-avatar priorities (launch_order)? Tests the right angles first?
4. SCALING TARGETS: Budget recommendations consistent with brand positioning (premium vs mass market)?
5. FORBIDDEN CONTENT: No forbidden terms in any creator-facing content? No never_use words in briefs?

Respond in valid JSON:
\`\`\`json
{
  "score": 0,
  "dimensions": [
    { "name": "Campaign Naming", "score": 0, "maxScore": 20, "feedback": "" }
  ],
  "driftReport": [],
  "verdict": "pass|fail",
  "alignmentInstructions": ""
}
\`\`\``,
  congruenceThreshold: 80,
};

export default gate9;
