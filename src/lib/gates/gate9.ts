// ============================================================
// GATE 9 — CAMPAIGN BLUEPRINT
// Sub-agents: campaign-architect, testing-strategist, brief-creator,
//             naming-system, scaling-planner
// Lead: Compile into launch-ready Campaign Blueprint
// ============================================================

import { GateConfigDef } from './types';

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

        return `PRODUCT: ${project.productDescription}

${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 4000)}` : ''}

${g1 ? `PRODUCT INTEL (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 2000)}` : ''}

## MISSION: Design the complete Meta Ads campaign structure

### 1. CAMPAIGN NAMING (EVOLVE 3-Level System)
Use the 3-level naming convention:
- Level 1 (Campaign): Campaign_Audience_Concept
- Level 2 (Ad Set): More detailed targeting/angle info
- Level 3 (Ad): Specific creative identifier

### 2. AD SET STRUCTURE
Design 1 CBO campaign per sub-avatar with multiple ad sets:
- Winners/Champions ad set (for proven creatives)
- Testing ad sets by angle (3-5 ads per angle)
- Separate ad sets for video vs image creatives
- NEVER mix video and image in the same ad set

### 3. BUDGET ALLOCATION (ZAK 50-Conversion Rule)
- Meta needs 50 conversions per ad set per week for stable optimization
- Minimum daily spend per ad set = CPA x 3
- Allocate budget proportionally to sub-avatar priority (launch_order from Gate 2)
- Starting budget recommendation based on market and CPA estimate

### 4. AUDIENCE TARGETING per Sub-Avatar
- Broad targeting as default (let Meta optimize)
- Interest-based targeting only for initial testing
- Lookalike audiences for scaling phase
- Geographic targeting based on target market
- Age/gender only if sub-avatar data strongly supports restriction

### 5. PIXEL / CONVERSION SETUP
- Recommended conversion event (Purchase, AddToCart, Lead)
- Pixel event recommendations
- Conversion API setup notes
- Attribution window recommendation (7-day click, 1-day view)

### 6. CAMPAIGN OBJECTIVE SELECTION
- Recommend campaign objective with reasoning
- When to use Sales vs Leads vs Traffic
- Optimization event selection

Output valid JSON wrapped in \`\`\`json code blocks:
{
  "campaign_structure": {
    "campaigns": [
      {
        "name": "campaign name using EVOLVE naming",
        "sub_avatar_id": "sa-1",
        "sub_avatar_name": "",
        "location": "${project.targetMarket}",
        "budget_type": "CBO",
        "objective": "Sales|Leads|Traffic",
        "objective_reasoning": "",
        "daily_budget": 0,
        "budget_reasoning": "",
        "ad_sets": [
          {
            "name": "ad set name using EVOLVE naming",
            "type": "winners|testing|angle_test",
            "focus": "description of what this ad set tests",
            "format": "video|image",
            "targeting": {
              "type": "broad|interest|lookalike",
              "details": "",
              "age_range": "",
              "gender": ""
            },
            "ads": ["ad names/references"]
          }
        ]
      }
    ],
    "total_campaigns": 0,
    "total_ad_sets": 0,
    "naming_convention_applied": {
      "level_1_campaign": "template",
      "level_2_adset": "template",
      "level_3_ad": "template"
    }
  },
  "budget_plan": {
    "fifty_conversion_rule": "calculation showing how 50-conv rule applies",
    "estimated_cpa": 0,
    "minimum_daily_per_adset": 0,
    "recommended_total_daily": 0,
    "phase_1_testing_daily": 0,
    "phase_2_scaling_daily": 0,
    "reasoning": ""
  },
  "pixel_setup": {
    "primary_conversion_event": "",
    "secondary_events": [],
    "attribution_window": "7-day click, 1-day view",
    "conversion_api": "recommended|optional",
    "setup_notes": ""
  }
}

RULES:
- One sub-avatar, one location per campaign
- Broad targeting by default
- No minimum spend on ad sets
- NEVER mix video and image in same ad set
- Budget must respect CPA x 3 minimum per ad set
- All naming follows EVOLVE 3-level system`;
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

        return `PRODUCT: ${project.productDescription}

${g1 ? `PRODUCT INTEL & SCORECARD (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 2000)}` : ''}
${g2 ? `SUB-AVATARS & ANGLES (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 2000)}` : ''}

## MISSION: Design the testing strategy using EVOLVE 3 Methods

### METHOD 1: MARKSMAN (Low Budget / Starting Out)
- Test 1 variable at a time for HIGH confidence results
- 1 avatar, 1 angle per test cycle
- 3-5 creatives per test
- Wait for 50 conversions before making decisions
- Kill losers fast, scale winners immediately
- Best for: new products, limited budget, unknown CPA
- Confidence level: HIGH (clear causation)

### METHOD 2: SNIPER (Medium Budget / Creative Angles)
- Test creative angles across 2-3 avatars simultaneously
- 5-10 creatives per avatar
- Parallel testing: different hooks, different angles, different formats
- Quick iteration cycles (4-7 days per test)
- Best for: validated product, moderate budget, need to find winning angles
- Speed: MEDIUM

### METHOD 3: SHOTGUN (High Budget / Rapid Testing)
- Test multiple avatars x angles x formats simultaneously
- 15-30 creatives per test cycle
- Large budget enables rapid learning (more data = faster decisions)
- Identify super winners fast, kill everything else
- Best for: proven product, high budget, scaling aggressively
- Volume: HIGH

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
    ]
  }
}

RULES:
- Launch method MUST be justified by product data (scorecard, market sophistication)
- 50-conversion rule applies to ALL methods
- Testing sequences must be specific enough for a media buyer to execute day 1
- Transition triggers must be measurable, not subjective`;
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

${g6 ? `AD SCRIPTS & COPY (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 4000)}` : ''}
${g2 ? `AVATAR DATA (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 3000)}` : ''}
${g1 ? `PRODUCT INTEL (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 2000)}` : ''}
${brandDna ? `BRAND DNA:\n${JSON.stringify(brandDna, null, 2).slice(0, 2000)}` : ''}

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

${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 2000)}` : ''}
${g6 ? `AD SCRIPTS (Gate 6):\n${JSON.stringify(g6, null, 2).slice(0, 2000)}` : ''}

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

You follow the ZAK 50-Conversion Rule and ZAK Scaling SOP precisely.

PRODUCT: ${project.name || 'See description'}
TARGET MARKET: ${project.targetMarket}`,

      userMessage: (project, previousOutputs) => {
        const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
        const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;

        return `PRODUCT: ${project.productDescription}

${g1 ? `PRODUCT INTEL & SCORECARD (Gate 1):\n${JSON.stringify(g1, null, 2).slice(0, 2000)}` : ''}
${g2 ? `SUB-AVATARS (Gate 2):\n${JSON.stringify(g2, null, 2).slice(0, 2000)}` : ''}

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
    }
  }
}

RULES:
- All thresholds must be SPECIFIC numbers, not vague ("if it's not working")
- Kill rules must be actionable on day 1
- Budget math must check out (CPA x 3 = minimum daily, 50-conv rule)
- Weekly checklist must be executable by a junior media buyer
- Scaling decisions must reference attribution quality`;
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

DIMENSIONS (each /10, total /100, threshold >=72%):
1. Campaign Structure: Follows CBO best practices? One avatar/location per campaign? Proper ad set separation? Naming applied?
2. Budget Math: CPA x 3 calculation present? 50-conversion rule addressed? Budget realistic for market?
3. Testing Strategy: Method appropriate for product/budget? Test plan specific and week-by-week actionable?
4. Testing Variables: Priority ranking logical? Transition triggers measurable?
5. Creator Briefs: Complete 10-section structure? Casual, not corporate? Story-focused? 2 distinct briefs (pain + transformation)?
6. Naming Conventions: Consistent 3-level system? 5 complete examples? Scalable to 100+ ads?
7. Scaling Playbook: Attribution rules clear? Budget tiers appropriate? Kill/scale criteria specific numbers, not vague?
8. Kill Rules: Specific and measurable thresholds? Frequency caps defined? Creative fatigue signals listed?
9. Cross-Reference Quality: All components reference each other correctly? No contradictions?
10. Day-1 Readiness: Could a media buyer and creative team launch from this document alone?

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
