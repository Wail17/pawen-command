// ============================================================
// PAWEN — Competitor Ad Copy Analyzer
// Analyzes competitor hook patterns from Meta Ad Library scrapes.
// Detects overused angles, identifies unexploited gaps,
// generates "anti-angles" (what competitors do → we do opposite).
// ============================================================

import type { CoreAvatarInput } from './types';

export interface CompetitorHookPattern {
  pattern: string;         // the hook pattern (generalized)
  frequency: number;       // how many competitor ads use this pattern
  examples: string[];      // actual ad headlines/hooks
  overused: boolean;       // true if >30% of competitor ads use this
}

export interface CompetitorAnalysisResult {
  generated_at: string;
  total_ads_analyzed: number;
  hook_patterns: CompetitorHookPattern[];
  overused_angles: string[];       // angles that are SO common they're noise
  unexploited_gaps: string[];      // angles nobody is using (opportunity)
  anti_angles: string[];           // "competitors do X → we do opposite"
  common_claims: string[];         // repeated claims (e.g., "30-day guarantee")
  emotional_tones: Array<{        // what emotional register competitors use
    tone: string;
    frequency: number;
  }>;
}

// Build the LLM prompt for analyzing competitor ads
export function buildCompetitorAnalysisPrompt(
  core: CoreAvatarInput,
  competitorAds: Array<{ headline?: string; body?: string; advertiser?: string; cta?: string }>,
): { system: string; user: string } {
  const system = `You are a Meta Ads strategist analyzing competitor ad copy patterns. Your job: find what EVERYONE does (overused) and what NOBODY does (opportunity).

STRICT OUTPUT FORMAT — return ONLY JSON:

{
  "total_ads_analyzed": 0,
  "hook_patterns": [
    {
      "pattern": "generalized hook pattern (e.g., 'Question about pain point')",
      "frequency": 0,
      "examples": ["actual headline from the ads"],
      "overused": false
    }
  ],
  "overused_angles": ["angle that 30%+ of competitors use — these are NOISE, avoid them"],
  "unexploited_gaps": ["angle NOBODY is using — these are GOLD, exploit them"],
  "anti_angles": ["competitors do X → do the OPPOSITE for differentiation"],
  "common_claims": ["claims that appear in 3+ ads — if everyone says it, it's meaningless"],
  "emotional_tones": [
    { "tone": "fear-based | aspirational | educational | social-proof | urgency | humor", "frequency": 0 }
  ]
}`;

  const adsBlock = competitorAds
    .slice(0, 30) // cap to avoid token explosion
    .map((ad, i) => {
      const parts = [
        ad.headline ? `Headline: ${ad.headline}` : null,
        ad.body ? `Body: ${ad.body.slice(0, 300)}` : null,
        ad.advertiser ? `Brand: ${ad.advertiser}` : null,
        ad.cta ? `CTA: ${ad.cta}` : null,
      ].filter(Boolean);
      return `--- Ad ${i + 1} ---\n${parts.join('\n')}`;
    })
    .join('\n\n');

  const user = `=== NICHE CONTEXT ===
Surface desire: ${core.surface_desire}
Niche: ${core.niche}
Product: ${core.product}
Market: ${core.market}
Language: ${core.language}

=== ${competitorAds.length} COMPETITOR ADS ===
${adsBlock}

=== YOUR TASK ===
1. Identify the 5-10 most common HOOK PATTERNS across these ads.
2. Flag which patterns are OVERUSED (>30% of ads) — these are noise, our ads should AVOID them.
3. Find GAPS — what angles, emotions, or approaches does NOBODY use? These are opportunities.
4. Generate ANTI-ANGLES: for each overused pattern, suggest the opposite approach.
5. List common claims that are now meaningless because everyone says them.

Return the JSON now.`;

  return { system, user };
}

// Deterministic hook pattern detection (no LLM needed for basic patterns)
export function detectBasicPatterns(
  ads: Array<{ headline?: string; body?: string }>,
): { pattern: string; count: number }[] {
  const patterns: Record<string, number> = {
    question_hook: 0,        // starts with a question
    number_hook: 0,          // uses numbers ("3 reasons", "in 7 days")
    testimonial_hook: 0,     // first person / quote-style
    fear_hook: 0,            // negative consequences
    curiosity_hook: 0,       // teases without revealing
    social_proof_hook: 0,    // "10,000+ customers", "as seen on"
    urgency_hook: 0,         // "limited time", "last chance"
    how_to_hook: 0,          // "How to...", "The secret to..."
    before_after_hook: 0,    // transformation narrative
    authority_hook: 0,       // "doctors recommend", "backed by science"
  };

  for (const ad of ads) {
    const text = `${ad.headline ?? ''} ${ad.body ?? ''}`.toLowerCase();

    if (/^[^.!]*\?/.test(text)) patterns.question_hook++;
    if (/\b\d+\s*(ways?|reasons?|steps?|tips?|secrets?|days?|minutes?|hours?)\b/i.test(text)) patterns.number_hook++;
    if (/^["']|^(i |my |I was|j'ai|je suis)/i.test(text)) patterns.testimonial_hook++;
    if (/\b(don't|stop|avoid|mistake|danger|risk|warning|never|worst)\b/i.test(text)) patterns.fear_hook++;
    if (/\b(secret|hidden|little-known|most people don't|what.*don't tell you)\b/i.test(text)) patterns.curiosity_hook++;
    if (/\b(\d+[,.]?\d*\+?\s*(customers?|users?|people|reviews?)|as seen|featured|trusted by)\b/i.test(text)) patterns.social_proof_hook++;
    if (/\b(limited|last chance|hurry|ends|only \d|today only|act now|don't miss)\b/i.test(text)) patterns.urgency_hook++;
    if (/\b(how to|the secret|the key|the trick|le secret|comment|la clé)\b/i.test(text)) patterns.how_to_hook++;
    if (/\b(before|after|transform|changed|went from|used to|now i|avant|après)\b/i.test(text)) patterns.before_after_hook++;
    if (/\b(doctor|scientist|expert|study|research|clinically|proven|backed by)\b/i.test(text)) patterns.authority_hook++;
  }

  return Object.entries(patterns)
    .map(([pattern, count]) => ({ pattern: pattern.replace(/_/g, ' '), count }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);
}

// Build a prompt block for injection into copy gates
export function buildCompetitorInsightPrompt(result: CompetitorAnalysisResult): string {
  if (result.total_ads_analyzed === 0) return '';

  const sections: string[] = [];

  if (result.overused_angles.length > 0) {
    sections.push(`OVERUSED (avoid — everyone does this):\n${result.overused_angles.map(a => `  ✗ ${a}`).join('\n')}`);
  }
  if (result.unexploited_gaps.length > 0) {
    sections.push(`UNEXPLOITED GAPS (opportunity — nobody does this):\n${result.unexploited_gaps.map(g => `  ★ ${g}`).join('\n')}`);
  }
  if (result.anti_angles.length > 0) {
    sections.push(`ANTI-ANGLES (differentiation plays):\n${result.anti_angles.map(a => `  → ${a}`).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `=== COMPETITOR INTELLIGENCE (${result.total_ads_analyzed} ads analyzed) ===
${sections.join('\n\n')}

INSTRUCTION: Differentiate. If competitors zig, you zag. Use unexploited gaps as primary angles.
=== END COMPETITOR INTELLIGENCE ===`;
}
