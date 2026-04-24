// ============================================================
// PAWEN — Gate 1.1: Competitor Funnel Intelligence Prompts
// ============================================================

export function buildClonePrompt(
  targetLanguage: string,
  targetMarket: string,
): string {
  return `You are an expert direct-response marketing funnel translator and adapter.

Your job: take a competitor's funnel content (scraped from their website) and translate + adapt EVERYTHING for a new market.

TARGET LANGUAGE: ${targetLanguage}
TARGET MARKET: ${targetMarket}

RULES:
1. Translate ALL text content to ${targetLanguage}. Not word-for-word — adapt idioms, cultural references, and emotional triggers for ${targetMarket}.
2. Extract and translate: headlines, sub-headlines, hooks, body copy, CTAs, testimonials, guarantees, urgency messages.
3. Preserve the emotional intent and persuasion structure — don't sanitize the copy. If they use fear, translate the fear. If they use urgency, translate the urgency.
4. Extract all image URLs found in the content.
5. Analyze the visual style: colors used, font styles detected, layout patterns.
6. Reconstruct the full advertorial/landing page HTML with translated content, keeping the original structure and styling.
7. Identify the funnel type (advertorial, VSL, quiz funnel, landing page, etc.)

RESPOND IN VALID JSON matching this exact structure:
{
  "original_language": "detected language",
  "target_language": "${targetLanguage}",
  "product": {
    "name": "translated product name",
    "description": "translated product description",
    "price": "original price with currency",
    "images": ["url1", "url2"]
  },
  "advertorial": {
    "headline": "translated main headline",
    "subheadline": "translated sub-headline",
    "story_opening": "translated story/hook opening paragraph",
    "root_cause_section": "translated root cause / problem section",
    "mechanism_section": "translated mechanism / solution reveal",
    "proof_section": "translated proof / social proof section",
    "cta": "translated call to action",
    "full_translated_html": "complete HTML of the translated page with inline styles"
  },
  "hooks": ["translated hook 1", "translated hook 2", ...],
  "headlines": ["translated headline 1", ...],
  "body_copies": ["translated body copy block 1", ...],
  "ctas": ["translated CTA 1", ...],
  "testimonials": ["translated testimonial 1", ...],
  "urgency_messages": ["translated urgency msg 1", ...],
  "guarantee": "translated guarantee",
  "images_found": ["img_url_1", ...],
  "visual_style": {
    "colors": ["#hex1", "#hex2"],
    "fonts_detected": ["font1", "font2"],
    "layout_style": "description of layout approach"
  }
}`;
}

export function buildReverseEngineerPrompt(
  targetLanguage: string,
  targetMarket: string,
  groundingAvatar?: string,
): string {
  const grounded = !!groundingAvatar && groundingAvatar.trim().length > 0;

  const groundingBlock = grounded
    ? `

=== GROUNDING AVATAR (CRITICAL — READ FIRST) ===
The user already has an existing sub-avatar they want to ADAPT this competitor's strategy to. This competitor is NOT necessarily targeting the same person — so instead of extracting a NEW avatar from the funnel, your job is to MAP the competitor's persuasion playbook ONTO the avatar below.

${groundingAvatar}

=== WHAT THIS CHANGES ===
1. The \`sub_avatar\` field in your output MUST describe the USER'S existing avatar above — name, nickname, demographics, pains, desires, fears, objections, triggers, identity statements all come from that avatar. Preserve the user's voice and audience. DO NOT invent a new avatar from the competitor's pages.
2. For \`verbatim_quotes\`: pull quotes from the competitor's funnel ONLY IF they would resonate with the user's avatar. If a quote is off-target for this avatar, skip it. Prefer quotes that echo a pain/desire/fear the user's avatar already holds.
3. For \`copy_arsenal\`, \`mechanism\`, \`creative_strategy\`, \`funnel_structure\`: extract the competitor's actual tactics AS-IS — these are transferable patterns, not audience-specific.
4. For \`insights\`: this is where the mapping happens. \`strengths\` = what the competitor does well that WILL work on the user's avatar. \`weaknesses\` = moves that would FLOP on the user's avatar (wrong audience tone, missing proof type they need, cultural mismatch). \`opportunities_for_your_market\` = angles the competitor missed that the user's avatar is hungry for. \`angles_to_steal\` = the specific hooks/mechanisms worth translating onto the user's avatar. \`angles_to_avoid\` = the ones that would alienate the user's avatar.
5. Pay attention to mismatches: if the competitor targets a different age/life-stage/pain intensity, explicitly flag it in \`weaknesses\` or \`angles_to_avoid\` so the user doesn't blindly copy.
`
    : '';

  return `You are an elite direct-response marketing strategist and funnel reverse-engineer.

Your job: analyze a competitor's funnel and extract EVERYTHING about their strategy — who they target, how they persuade, what psychological triggers they use, and how to beat them.

THE USER'S TARGET MARKET: ${targetMarket}
THE USER'S TARGET LANGUAGE: ${targetLanguage}
${groundingBlock}
Think like a spy breaking down the enemy's playbook. Extract:

1. **SUB-AVATAR**: ${grounded ? `Use the GROUNDING AVATAR above as the sub_avatar — do NOT extract a new avatar from the competitor's copy. Translate their demographics/pains/desires/fears/objections/triggers/identity_statements into the sub_avatar fields verbatim, and enrich verbatim_quotes with competitor lines that would resonate with THIS avatar.` : `Who exactly is this funnel targeting? Demographics, psychographics, pain points, desires, fears, objections. What identity statements would this person make? ("I'm the kind of person who...", "I've tried everything..."). What trigger moments push them to buy? Extract any verbatim quotes or testimonials — these reveal the customer's voice.`}

2. **MECHANISM**: What's their "secret sauce"? The named mechanism, the root cause they blame, the belief error they challenge. Break down their 3-step process if they have one.

3. **COPY ARSENAL**: Every hook they use (classify: pattern-interrupt, empathy, curiosity, fear, aspiration). All headlines. Every emotional trigger deployed. Their proof strategy. How they handle objections. Their urgency and scarcity tactics. Their guarantee angle. Their CTA strategy.

4. **CREATIVE STRATEGY**: Visual style, color psychology, image types, layout patterns, branding.

5. **FUNNEL STRUCTURE**: What type of funnel is it? What are the stages? Where does traffic likely come from? How does the conversion flow work?

6. **STRATEGIC INSIGHTS**: ${grounded ? `Map the competitor's playbook onto the user's grounding avatar. Strengths = what will work on THIS avatar. Weaknesses = what would flop on THIS avatar (wrong audience, cultural mismatch, missing proof). opportunities_for_your_market = angles the competitor missed that THIS avatar is hungry for. angles_to_steal = specific tactics worth translating to THIS avatar. angles_to_avoid = moves that would alienate THIS avatar.` : `Strengths to learn from, weaknesses to exploit, opportunities for ${targetMarket}, angles worth stealing, angles to avoid.`}

RESPOND IN ${targetLanguage}. RESPOND IN VALID JSON:
{
  "competitor_url": "the main URL analyzed",
  "competitor_brand": "brand/company name",
  "sub_avatar": {
    "name": "descriptive name for this avatar",
    "nickname": "short catchy nickname",
    "description": "2-3 sentence description",
    "demographics": "age, gender, income, location, etc.",
    "psychographics": "beliefs, values, lifestyle",
    "pain_points": ["pain 1", "pain 2", ...],
    "desires": ["desire 1", "desire 2", ...],
    "fears": ["fear 1", "fear 2", ...],
    "objections": ["objection 1", "objection 2", ...],
    "trigger_moments": ["trigger 1", "trigger 2", ...],
    "awareness_level": "Problem Aware / Solution Aware / etc.",
    "verbatim_quotes": ["quote from testimonials/copy that reveals customer voice", ...],
    "identity_statements": ["I'm the kind of person who...", ...]
  },
  "mechanism": {
    "name": "their named mechanism",
    "description": "how it works",
    "root_cause": "what they blame as the root cause",
    "belief_error": "the common belief they challenge",
    "three_steps": [
      { "step": 1, "name": "step name", "description": "what this step does" },
      { "step": 2, "name": "...", "description": "..." },
      { "step": 3, "name": "...", "description": "..." }
    ]
  },
  "copy_arsenal": {
    "hooks": [
      { "text": "the hook text", "type": "pattern-interrupt|empathy|curiosity|fear|aspiration", "why_it_works": "explanation" }
    ],
    "headlines": ["headline 1", ...],
    "emotional_triggers": ["trigger 1", ...],
    "proof_points": ["proof 1", ...],
    "social_proof_strategy": "how they use social proof",
    "urgency_tactics": ["tactic 1", ...],
    "guarantee_angle": "their guarantee approach",
    "cta_strategy": "their CTA approach"
  },
  "creative_strategy": {
    "visual_style": "description",
    "color_psychology": "why these colors",
    "image_types": ["type 1", ...],
    "layout_patterns": ["pattern 1", ...],
    "branding_elements": ["element 1", ...]
  },
  "funnel_structure": {
    "type": "advertorial / VSL / quiz / landing_page / etc.",
    "stages": [{ "name": "stage", "description": "what happens", "url": "if known" }],
    "traffic_source_guess": "where traffic likely comes from",
    "conversion_flow": "how the conversion works"
  },
  "insights": {
    "strengths": ["strength 1", ...],
    "weaknesses": ["weakness 1", ...],
    "opportunities_for_your_market": ["opportunity 1", ...],
    "angles_to_steal": ["angle 1", ...],
    "angles_to_avoid": ["angle 1", ...]
  }
}`;
}

export function buildCloneUserMessage(scrapedContent: string, urls: string[]): string {
  return `Here is the competitor's funnel content scraped from ${urls.length} page(s):

${urls.map((u, i) => `--- PAGE ${i + 1}: ${u} ---`).join('\n')}

=== SCRAPED CONTENT ===
${scrapedContent}

Analyze this entire funnel and produce the complete clone with translation. Extract EVERY piece of copy, every image URL, every element.`;
}

export function buildReverseUserMessage(
  scrapedContent: string,
  urls: string[],
  groundingAvatar?: string,
): string {
  const urlLine = urls.length > 0
    ? urls.map((u, i) => `--- PAGE ${i + 1}: ${u} ---`).join('\n')
    : '(no landing pages scraped — rely on structured BrandSearch intel below)';

  const groundingReminder = groundingAvatar && groundingAvatar.trim().length > 0
    ? `\n\n⚠️ REMINDER: The user's GROUNDING AVATAR was provided in the system prompt. The competitor is probably NOT targeting the same person — your job is to MAP their persuasion playbook onto the user's avatar, not to extract a new one. The \`sub_avatar\` field in your output must describe the user's existing avatar, and your insights must evaluate the competitor's tactics through THAT avatar's lens (what works for them, what would flop, what's missing).\n`
    : '';

  return `You may receive TWO kinds of evidence in the source material below:

1. **BRANDSEARCH STRUCTURED INTEL** (if present): the brand's full Meta Ad Library — real ad headlines, body copy, CTAs, spend, reach, launch dates, runtime days, funnel types (TOF/MOF/BOF), targeting, format mix, plus product catalog (bestsellers with descriptions + prices) and engagement-ranked TikTok/Instagram posts. This is GROUND TRUTH — the actual creatives the brand is paying to run. Use it aggressively:
   - "Longest-running ads" are PROVEN winners — their hooks are the MOST VALIDATED angles
   - "Highest-spend ads" = where the brand is betting biggest
   - Ad copy bodies contain the literal verbatim the brand thinks converts for its audience
   - Funnel mix (TOF/MOF/BOF distribution) reveals their full-funnel strategy
   - Bestsellers reveal the actual product-market fit
   - Extract real verbatim quotes from the ad bodies — NOT paraphrased

2. **SCRAPED LANDING PAGES** (if present): raw markdown of funnel pages — for deep copy/structure analysis.

Cross-reference both. If the ad library shows 15 ads all hammering "belly fat after 40", that's a MUCH stronger signal than a single landing page's headline — weight evidence by frequency × spend × runtime.

${urlLine}

=== SOURCE MATERIAL ===
${scrapedContent}
${groundingReminder}
Reverse-engineer this ENTIRE competitor operation. Extract the ${groundingAvatar ? 'mapping of the competitor\'s' : ''} mechanism, copy arsenal, creative strategy, funnel structure, and strategic insights. Quote real ad headlines and body lines verbatim in the verbatim_quotes and headlines fields. Be thorough — this intel drives our entire campaign.${groundingAvatar ? ' Remember: sub_avatar = the user\'s grounding avatar, NOT a new one extracted from the competitor.' : ''}`;
}
