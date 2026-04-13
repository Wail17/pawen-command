// ============================================================
// PAWEN — Swipe Vocabulary per Sub-Avatar
// Auto-extracts a copywriter's vocabulary toolkit from verbatims:
// - Power words (trigger action)
// - Forbidden words (this audience hates)
// - Emotional anchors (top 5 charged expressions)
// - Metaphors (how they describe their situation)
// - Recurring phrases (high-frequency customer language)
// Injected into ALL downstream gates so copy stays authentic.
// ============================================================

import type { SubAvatarV2, SourceAnalysis } from './types';
import type { RankedVerbatim } from './verbatimRanking';

export interface SwipeVocabulary {
  sub_avatar_id: string;
  power_words: string[];          // words that trigger emotion/action in this audience
  forbidden_words: string[];      // words that turn this audience OFF
  emotional_anchors: string[];    // top 5 most emotionally charged expressions
  metaphors: string[];            // "I feel like I'm drowning", "hitting a wall"
  recurring_phrases: string[];    // phrases that appear 3+ times across verbatims
  identity_phrases: string[];     // "I am / I'm not" self-descriptions
  objection_language: string[];   // how they express doubts/objections
}

// -------- Extraction helpers --------

// Detect metaphor patterns in text
const METAPHOR_PATTERNS = [
  /\b(?:feel like|feels like|it's like|like a|as if|comme si|on dirait|c'est comme)\b[^.!?\n]{3,60}/gi,
  /\b(?:drowning|sinking|falling|spinning|hitting a wall|rollercoaster|tunnel|cage|prison|treadmill)\b/gi,
  /\b(?:noyer|couler|tomber|tourner en rond|mur|cage|prison)\b/gi,
];

function extractMetaphors(texts: string[]): string[] {
  const metaphors = new Set<string>();
  for (const text of texts) {
    for (const pattern of METAPHOR_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          const cleaned = m.trim().slice(0, 80);
          if (cleaned.length >= 8) metaphors.add(cleaned.toLowerCase());
        }
      }
    }
  }
  return Array.from(metaphors).slice(0, 10);
}

// Find words/phrases that appear 3+ times across texts
function findRecurringPhrases(texts: string[], minOccurrences: number = 3): string[] {
  // Extract 2-4 word phrases
  const phraseCounts = new Map<string, number>();

  for (const text of texts) {
    const lower = text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ');
    const words = lower.split(/\s+/).filter(w => w.length > 2);

    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ');
        if (phrase.length >= 6) {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase]) => phrase);
}

// Extract identity-related phrases
function extractIdentityPhrases(texts: string[]): string[] {
  const phrases = new Set<string>();
  const patterns = [
    /\b(i am|i'm|i've always been|i consider myself|i'm not|i refuse to be)\b[^.!?\n]{3,60}/gi,
    /\b(je suis|j'ai toujours été|je ne suis pas|je refuse)\b[^.!?\n]{3,60}/gi,
    /\b(people like me|as a \w+|en tant que \w+|les gens comme moi)\b[^.!?\n]{3,40}/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          phrases.add(m.trim().slice(0, 100));
        }
      }
    }
  }

  return Array.from(phrases).slice(0, 8);
}

// Extract objection/doubt language
function extractObjectionLanguage(texts: string[]): string[] {
  const objections = new Set<string>();
  const patterns = [
    /\b(too expensive|not worth|waste of money|doesn't work|scam|rip off|won't work|can't trust|scared to try|what if it)\b[^.!?\n]{0,40}/gi,
    /\b(trop cher|pas la peine|arnaque|marche pas|gaspillage|peur d'essayer|et si ça)\b[^.!?\n]{0,40}/gi,
    /\b(but what about|my concern is|the problem is|i'm worried that|i'm not sure)\b[^.!?\n]{0,40}/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          objections.add(m.trim().slice(0, 80));
        }
      }
    }
  }

  return Array.from(objections).slice(0, 8);
}

// Known "forbidden" words that turn audiences off (expanded by analysis)
const GENERIC_FORBIDDEN = [
  'revolutionary', 'game-changer', 'disruptive', 'synergy', 'leverage',
  'empower', 'unlock your potential', 'life-changing', 'miracle',
  'révolutionnaire', 'miracle', 'incroyable opportunité',
];

function detectForbiddenWords(texts: string[]): string[] {
  // Find words/phrases that co-occur with skepticism markers
  const forbidden = new Set<string>(GENERIC_FORBIDDEN);

  for (const text of texts) {
    // If someone is skeptical about specific claims, extract those claims
    const skepticPatterns = [
      /(?:scam|fake|doesn't work|bs|bull|lie|lying|arnaque|mensonge)\b[^.!?\n]{0,30}\b(\w{4,}\s+\w{4,})/gi,
      /\b(\w{4,}\s+\w{4,})\b[^.!?\n]{0,30}(?:scam|fake|doesn't work|bs|arnaque|mensonge)/gi,
    ];

    for (const pattern of skepticPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          const cleaned = m.trim().toLowerCase().slice(0, 40);
          if (cleaned.length >= 6 && !cleaned.includes('scam') && !cleaned.includes('arnaque')) {
            forbidden.add(cleaned);
          }
        }
      }
    }
  }

  return Array.from(forbidden).slice(0, 12);
}

// -------- Power word extraction (high-emotion vocabulary) --------

const POWER_WORD_PATTERNS = [
  // EN
  /\b(finally|immediately|instantly|guaranteed|proven|secret|discover|imagine|transform|eliminate|destroy|dominate|unleash|breakthrough|exposed|shocking|urgent|limited|exclusive|free)\b/gi,
  // FR
  /\b(enfin|immédiatement|garanti|prouvé|secret|découvr|imagin|transform|élimin|percée|choquant|urgent|limité|exclusif|gratuit)\b/gi,
];

function extractPowerWords(texts: string[]): string[] {
  const wordCounts = new Map<string, number>();

  for (const text of texts) {
    for (const pattern of POWER_WORD_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          const word = m.toLowerCase();
          wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// -------- Main builder --------

export function buildSwipeVocabulary(
  subAvatar: SubAvatarV2,
  analyses?: SourceAnalysis[],
  rankedVerbatims?: RankedVerbatim[],
): SwipeVocabulary {
  // Collect all text from this sub-avatar's verbatims + analysis language_dna
  const allTexts: string[] = [];

  for (const v of subAvatar.verbatim_quotes) {
    allTexts.push(v.quote);
  }

  // Include language_dna from analyses for this sub-avatar's sources
  if (analyses) {
    for (const a of analyses) {
      if (subAvatar.source_references.includes(a.source)) {
        for (const ld of a.language_dna ?? []) {
          allTexts.push(ld);
        }
      }
    }
  }

  // Top emotional anchors from ranked verbatims (or fallback to all verbatims)
  const emotionalAnchors = rankedVerbatims
    ? rankedVerbatims
        .filter(rv => rv.tags.includes('high_emotion'))
        .slice(0, 5)
        .map(rv => rv.quote.slice(0, 120))
    : subAvatar.verbatim_quotes
        .slice(0, 5)
        .map(v => v.quote.slice(0, 120));

  return {
    sub_avatar_id: subAvatar.id,
    power_words: extractPowerWords(allTexts),
    forbidden_words: detectForbiddenWords(allTexts),
    emotional_anchors: emotionalAnchors,
    metaphors: extractMetaphors(allTexts),
    recurring_phrases: findRecurringPhrases(allTexts),
    identity_phrases: extractIdentityPhrases(allTexts),
    objection_language: extractObjectionLanguage(allTexts),
  };
}

// Build a prompt block for injection into downstream gates
export function buildSwipeVocabularyPrompt(vocab: SwipeVocabulary): string {
  const sections: string[] = [];

  if (vocab.power_words.length > 0) {
    sections.push(`POWER WORDS (use these — they trigger action): ${vocab.power_words.join(', ')}`);
  }
  if (vocab.forbidden_words.length > 0) {
    sections.push(`FORBIDDEN WORDS (NEVER use these — audience hates them): ${vocab.forbidden_words.join(', ')}`);
  }
  if (vocab.emotional_anchors.length > 0) {
    sections.push(`EMOTIONAL ANCHORS (the 5 most charged expressions from real customers):\n${vocab.emotional_anchors.map(a => `  • "${a}"`).join('\n')}`);
  }
  if (vocab.metaphors.length > 0) {
    sections.push(`THEIR METAPHORS (reuse these in copy): ${vocab.metaphors.join(' | ')}`);
  }
  if (vocab.recurring_phrases.length > 0) {
    sections.push(`RECURRING PHRASES (high-frequency customer language): ${vocab.recurring_phrases.join(' | ')}`);
  }
  if (vocab.identity_phrases.length > 0) {
    sections.push(`IDENTITY LANGUAGE (how they describe themselves):\n${vocab.identity_phrases.map(p => `  • "${p}"`).join('\n')}`);
  }
  if (vocab.objection_language.length > 0) {
    sections.push(`OBJECTION LANGUAGE (how they express doubts — address these in copy):\n${vocab.objection_language.map(o => `  • "${o}"`).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `=== SWIPE VOCABULARY (use this audience's EXACT language) ===
${sections.join('\n\n')}

RULE: Copy that uses the customer's own words converts 2-5x better than generic marketing-speak. Echo their vocabulary.
=== END SWIPE VOCABULARY ===`;
}
