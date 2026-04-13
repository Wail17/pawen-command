// ============================================================
// PAWEN — Verbatim Quality Auto-Ranking
// Scores every verbatim quote by marketing value:
// - Emotional intensity (0-30)
// - Specificity (0-25) — concrete moments vs generic statements
// - Uniqueness (0-20) — says something others don't
// - Ad-readiness (0-25) — can be copy-pasted into an ad
// Best float to top. Deterministic, no LLM.
// ============================================================

import type { VerbatimQuote, SourceType } from './types';

export interface RankedVerbatim extends VerbatimQuote {
  quality_score: number;      // 0-100
  breakdown: {
    emotional_intensity: number;   // 0-30
    specificity: number;           // 0-25
    uniqueness: number;            // 0-20
    ad_readiness: number;          // 0-25
  };
  tags: string[];                 // ['high_emotion', 'specific_moment', 'identity', 'objection', etc.]
}

// -------- Scoring dimensions --------

// Emotional intensity: strong emotion words/phrases get higher scores
const HIGH_EMOTION_PATTERNS = [
  // Intensity 3 (highest)
  { regex: /\b(desperate|hopeless|terrified|devastated|heartbreaking|unbearable|rock bottom|worst moment|breaking point|suicidal|crying|sobbing)\b/i, score: 3 },
  { regex: /\b(désespéré|insupportable|dévast|effondré|au plus bas|larmes|pleurer)\b/i, score: 3 },
  // Intensity 2
  { regex: /\b(exhausted|furious|ashamed|humiliated|helpless|trapped|stuck|miserable|suffering|agonizing|panic|nightmare)\b/i, score: 2 },
  { regex: /\b(épuisé|furieux|honte|humilié|piégé|coincé|cauchemar|souffr|paniqu)\b/i, score: 2 },
  // Intensity 1
  { regex: /\b(frustrated|worried|anxious|scared|angry|sad|tired|stressed|overwhelmed|confused|disappointed|afraid)\b/i, score: 1 },
  { regex: /\b(frustré|inquiet|anxieux|fatigué|stressé|déçu|peur|triste)\b/i, score: 1 },
];

// Sentence markers that indicate emotional language
const EMOTION_AMPLIFIERS = [
  /\b(i can't|i couldn't|i literally|it's killing me|i swear|i'm done|i give up|makes me want to)\b/i,
  /\b(je n'en peux plus|j'en peux plus|ça me tue|j'abandonne|je craque|plus jamais)\b/i,
  /!{2,}/, // multiple exclamation marks
  /\.{3,}/, // trailing ellipsis (pause = weight)
];

function scoreEmotionalIntensity(text: string): number {
  let score = 0;

  for (const pattern of HIGH_EMOTION_PATTERNS) {
    if (pattern.regex.test(text)) {
      score += pattern.score * 5;
    }
  }

  for (const amp of EMOTION_AMPLIFIERS) {
    if (amp.test(text)) score += 3;
  }

  // First-person statements are more emotional
  if (/\b(i |i'm |i've |i was |i feel |i can't |my |me |je |j'|mon |ma |mes )\b/i.test(text)) {
    score += 3;
  }

  return Math.min(30, score);
}

// Specificity: concrete situations, times, amounts, people
const SPECIFICITY_MARKERS = [
  { regex: /\b\d+\s*(years?|months?|weeks?|days?|hours?|times?|kg|lbs?|€|\$|%)\b/i, points: 5 },
  { regex: /\b(ans?|mois|semaines?|jours?|heures?|fois|kilos?)\b/i, points: 4 },
  { regex: /\b(at \d|around \d|about \d|over \d|since \d|\d\d\d\d)\b/i, points: 4 },
  { regex: /\b(3\s*am|middle of the night|at work|in the shower|driving|at the gym|at school|in bed)\b/i, points: 5 },
  { regex: /\b(my (?:wife|husband|partner|mom|dad|boss|doctor|kids?|daughter|son|friend))\b/i, points: 4 },
  { regex: /\b(ma (?:femme|mari|mère|père|fille|fils|docteur|amie?))\b/i, points: 4 },
  { regex: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening|night)\b/i, points: 3 },
  // Product/brand names (indicate real experience)
  { regex: /\b(tried|bought|ordered|used|switched to|went back to)\s+\w/i, points: 4 },
  { regex: /\b(essayé|acheté|commandé|utilisé|passé à)\s+\w/i, points: 4 },
];

function scoreSpecificity(text: string): number {
  let score = 0;

  for (const marker of SPECIFICITY_MARKERS) {
    if (marker.regex.test(text)) {
      score += marker.points;
    }
  }

  // Longer quotes are usually more specific (but with diminishing returns)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 15) score += 3;
  if (wordCount >= 30) score += 2;

  return Math.min(25, score);
}

// Uniqueness: penalize generic statements, reward unusual expressions
const GENERIC_PATTERNS = [
  /^(great product|love it|works well|highly recommend|very good|not bad|decent|okay|fine|good quality)/i,
  /^(bon produit|très bien|je recommande|super|parfait|génial|excellent produit)/i,
  /^(this is|it is|it's|there are|I think|in my opinion)\b/i,
];

function scoreUniqueness(text: string, allTexts: string[]): number {
  let score = 10; // start at 10/20 (average)

  // Penalize generic patterns
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(text)) {
      score -= 5;
    }
  }

  // Reward metaphors/vivid language
  if (/\b(like|feel like|as if|it's like|comme si|on dirait|c'est comme)\b/i.test(text)) {
    score += 4;
  }

  // Reward contradictions (internal tension = interesting)
  if (/\b(but|however|even though|despite|although|yet|mais|pourtant|malgré)\b/i.test(text)) {
    score += 3;
  }

  // Penalize if very similar to many other verbatims (fuzzy dedup)
  const normalized = text.toLowerCase().slice(0, 50);
  let duplicates = 0;
  for (const other of allTexts) {
    if (other === text) continue;
    if (other.toLowerCase().slice(0, 50) === normalized) duplicates++;
  }
  score -= duplicates * 3;

  return Math.max(0, Math.min(20, score));
}

// Ad-readiness: can this be dropped into a Meta ad as-is?
function scoreAdReadiness(text: string): number {
  let score = 5; // base

  const wordCount = text.split(/\s+/).length;

  // Sweet spot: 8-40 words (too short = no context, too long = needs editing)
  if (wordCount >= 8 && wordCount <= 40) score += 8;
  else if (wordCount >= 5 && wordCount <= 60) score += 4;

  // First person = ad-ready (testimonial format)
  if (/^(i |i'm |i've |i was |my |je |j'ai |mon |ma )/i.test(text)) score += 5;

  // Question format = great for hooks
  if (/\?$/.test(text.trim())) score += 4;

  // Contains a concrete before/after or transformation
  if (/\b(before|after|used to|now i|finally|since|avant|après|maintenant|depuis)\b/i.test(text)) {
    score += 4;
  }

  // Contains identity statement = powerful for targeting
  if (/\b(i'm the kind|i'm not|people like me|as a |en tant que)\b/i.test(text)) {
    score += 4;
  }

  // Penalty: contains URLs, usernames, or technical jargon
  if (/https?:\/\/|@\w+|u\/\w+/i.test(text)) score -= 3;

  return Math.min(25, score);
}

// -------- Tag assignment --------

function assignTags(text: string): string[] {
  const tags: string[] = [];

  if (/\b(desperate|hopeless|terrified|devastated|suicidal|rock bottom|désespéré|au plus bas)\b/i.test(text)) {
    tags.push('high_emotion');
  }
  if (/\b\d+\s*(years?|months?|€|\$|%|ans|mois)\b/i.test(text)) {
    tags.push('specific_moment');
  }
  if (/\b(i'm |i am |i'm not|je suis|je ne suis pas)\b/i.test(text)) {
    tags.push('identity');
  }
  if (/\b(tried|bought|used|tested|essayé|acheté|testé)\b/i.test(text)) {
    tags.push('past_attempt');
  }
  if (/\b(too expensive|waste|scam|doesn't work|trop cher|arnaque|marche pas)\b/i.test(text)) {
    tags.push('objection');
  }
  if (/\b(should i|which one|recommend|vs|avis|recommand|lequel)\b/i.test(text)) {
    tags.push('buying_signal');
  }
  if (/\b(before|after|used to|now i|finally|transformation|avant|après|enfin)\b/i.test(text)) {
    tags.push('transformation');
  }
  if (/\?/.test(text)) {
    tags.push('question');
  }

  return tags;
}

// -------- Main ranking function --------

export function rankVerbatims(verbatims: VerbatimQuote[]): RankedVerbatim[] {
  const allTexts = verbatims.map(v => v.quote);

  return verbatims
    .map(v => {
      const emotional_intensity = scoreEmotionalIntensity(v.quote);
      const specificity = scoreSpecificity(v.quote);
      const uniqueness = scoreUniqueness(v.quote, allTexts);
      const ad_readiness = scoreAdReadiness(v.quote);
      const quality_score = emotional_intensity + specificity + uniqueness + ad_readiness;
      const tags = assignTags(v.quote);

      return {
        ...v,
        quality_score,
        breakdown: { emotional_intensity, specificity, uniqueness, ad_readiness },
        tags,
      };
    })
    .sort((a, b) => b.quality_score - a.quality_score);
}

// Rank all verbatims across sub-avatars and return the top N
export function rankAllVerbatims(
  subAvatars: Array<{ id: string; verbatim_quotes: VerbatimQuote[] }>,
): Array<RankedVerbatim & { sub_avatar_id: string }> {
  const all: Array<RankedVerbatim & { sub_avatar_id: string }> = [];

  for (const sa of subAvatars) {
    const ranked = rankVerbatims(sa.verbatim_quotes);
    for (const rv of ranked) {
      all.push({ ...rv, sub_avatar_id: sa.id });
    }
  }

  return all.sort((a, b) => b.quality_score - a.quality_score);
}

// Build a compact prompt showing the top-ranked verbatims for injection
export function buildRankedVerbatimsPrompt(
  ranked: RankedVerbatim[],
  limit: number = 15,
): string {
  if (ranked.length === 0) return '';

  const top = ranked.slice(0, limit);
  const lines = top.map((v, i) => {
    const tagStr = v.tags.length > 0 ? ` [${v.tags.join(', ')}]` : '';
    return `  ${i + 1}. (${v.quality_score}/100) "${v.quote.slice(0, 150)}"${tagStr}`;
  });

  return `=== TOP-RANKED VERBATIMS (by marketing value) ===
${lines.join('\n')}
=== END RANKED VERBATIMS ===`;
}
