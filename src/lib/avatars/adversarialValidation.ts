// ============================================================
// PAWEN — Adversarial Validation Pass (Phase 4.5)
// Runs AFTER compile. A second LLM pass that plays devil's advocate:
// challenges each sub-avatar, scores confidence, flags weak evidence,
// detects overlapping clusters.
// ============================================================

import type { SubAvatarV2, CoreAvatarInput } from './types';
import type { SignalConfidenceMatrix } from './crossSourceValidation';

export interface SubAvatarChallenge {
  sub_avatar_id: string;
  confidence_score: number;         // 0-100
  evidence_density: 'strong' | 'moderate' | 'weak';
  cross_source_confirmed: boolean;  // backed by 2+ source types
  challenges: string[];             // specific weaknesses found
  overlap_with: string[];           // IDs of sub-avatars it overlaps with
  recommendation: 'keep' | 'merge' | 'flag_weak' | 'drop';
  reasoning: string;
}

export interface AdversarialReport {
  generated_at: string;
  overall_quality: 'excellent' | 'good' | 'needs_work' | 'poor';
  sub_avatar_challenges: SubAvatarChallenge[];
  merge_suggestions: Array<{
    merge: [string, string];         // pair of IDs to merge
    reason: string;
  }>;
  missing_angles: string[];          // sub-avatars the data supports but compile missed
  strongest_sub_avatar: string;      // ID of most evidence-backed sub-avatar
  weakest_sub_avatar: string;        // ID of least evidence-backed
}

export function buildAdversarialPrompt(
  core: CoreAvatarInput,
  subAvatars: SubAvatarV2[],
  confidenceMatrix?: SignalConfidenceMatrix,
): { system: string; user: string } {
  const system = `You are a senior research auditor. Your ONLY job is to CHALLENGE and STRESS-TEST sub-avatars produced by a customer research pipeline.

You are NOT here to be nice. You are here to find WEAKNESSES:
- Sub-avatars with too few verbatims or weak evidence
- Sub-avatars that overlap too much (should be merged)
- Claims not backed by cross-source evidence
- Missing sub-avatars the data clearly supports but were overlooked
- Hooks/angles that don't match the evidence

You score each sub-avatar on a 0-100 confidence scale:
- 90-100: Rock-solid, multiple sources, specific verbatims, tight cluster
- 70-89: Good but has gaps — could use more evidence on 1-2 dimensions
- 50-69: Shaky — built on thin evidence or overlaps significantly with another
- 0-49: Should be merged into another or dropped

STRICT OUTPUT FORMAT — return ONLY JSON (no fences, no prose):

{
  "overall_quality": "excellent | good | needs_work | poor",
  "sub_avatar_challenges": [
    {
      "sub_avatar_id": "sa-X",
      "confidence_score": 0,
      "evidence_density": "strong | moderate | weak",
      "cross_source_confirmed": true,
      "challenges": ["specific weakness 1", "specific weakness 2"],
      "overlap_with": ["sa-Y"],
      "recommendation": "keep | merge | flag_weak | drop",
      "reasoning": "1-2 sentences"
    }
  ],
  "merge_suggestions": [
    { "merge": ["sa-X", "sa-Y"], "reason": "why these should be one sub-avatar" }
  ],
  "missing_angles": ["sub-avatar the data supports but wasn't created"],
  "strongest_sub_avatar": "sa-X",
  "weakest_sub_avatar": "sa-Y"
}`;

  const subAvatarBlock = subAvatars
    .map(sa => {
      const verbatimSources = [...new Set(sa.verbatim_quotes.map(v => v.source_type))];
      return `--- ${sa.id}: "${sa.name}" (${sa.nickname}) ---
Category: ${sa.dominant_category}
Description: ${sa.description}
Scores: urgency=${sa.urgency_score}, scope=${sa.scope_score}, staying_power=${sa.staying_power_score}
Sources: ${sa.source_references.join(', ')}
Verbatim count: ${sa.verbatim_quotes.length} from ${verbatimSources.length} source types
Verbatims: ${sa.verbatim_quotes.slice(0, 5).map(v => `"${v.quote.slice(0, 100)}"`).join(' | ')}
Triggers: ${sa.emotional_triggers.join(', ')}
Past attempts: ${sa.past_attempts_failures.join(', ')}
Hooks: ${sa.angles?.hooks?.join(' | ') ?? 'none'}`;
    })
    .join('\n\n');

  const confidenceBlock = confidenceMatrix
    ? `\n=== CROSS-SOURCE CONFIDENCE DATA ===
High-confidence signals: ${confidenceMatrix.high_confidence.slice(0, 5).map(s => `"${s.signal}" (${s.sources.join(',')})`).join('; ')}
Source quality ranking: ${confidenceMatrix.source_quality_ranking.slice(0, 5).map(s => `${s.source}(${s.signal_strength})`).join(' > ')}
Weak areas: ${confidenceMatrix.weakest_areas.join(', ') || 'none'}`
    : '';

  const user = `=== CORE AVATAR ===
Surface desire: ${core.surface_desire}
Niche: ${core.niche}
Product: ${core.product}
Market: ${core.market}

=== ${subAvatars.length} SUB-AVATARS TO CHALLENGE ===

${subAvatarBlock}
${confidenceBlock}

=== YOUR TASK ===
Challenge EVERY sub-avatar. Be ruthless but fair. Score each one 0-100.
Key questions per sub-avatar:
1. Is this cluster ACTUALLY distinct from the others, or is it the same person described differently?
2. Are the verbatims SPECIFIC enough to write targeted ad copy, or are they generic?
3. Does the evidence come from 2+ different source types, or is it all from one platform?
4. Do the hooks actually use the sub-avatar's language, or are they generic marketing-speak?
5. Is anything important MISSING that the compile clearly had data for?

Return the JSON now.`;

  return { system, user };
}

// Deterministic post-processing: apply the adversarial report to the sub-avatars
// by enriching them with confidence metadata. Non-destructive — appends data, never removes.
// Stores the full structured challenge on `adversarial_challenge` so the UI can
// render the complete weakness list (not just a 2-item summary mashed into
// recommendation_reason).
export function applyAdversarialReport(
  subAvatars: SubAvatarV2[],
  report: AdversarialReport,
): SubAvatarV2[] {
  return subAvatars.map(sa => {
    const challenge = report.sub_avatar_challenges.find(c => c.sub_avatar_id === sa.id);
    if (!challenge) return sa;

    const qualityTag = challenge.confidence_score >= 80 ? '✓' :
      challenge.confidence_score >= 50 ? '~' : '⚠';
    const advNote = `${qualityTag} Confidence: ${challenge.confidence_score}/100 (${challenge.evidence_density}). ${challenge.challenges.slice(0, 2).join('. ')}`;

    return {
      ...sa,
      recommendation_reason: `${sa.recommendation_reason}\n[Validation] ${advNote}`,
      adversarial_challenge: {
        confidence_score: challenge.confidence_score,
        evidence_density: challenge.evidence_density,
        cross_source_confirmed: challenge.cross_source_confirmed,
        challenges: challenge.challenges ?? [],
        overlap_with: challenge.overlap_with ?? [],
        recommendation: challenge.recommendation,
        reasoning: challenge.reasoning ?? '',
      },
    };
  });
}
