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
  const anyReverse = subAvatars.some(sa => sa.is_from_reverse_engineer);

  const system = `You are a senior research auditor. Your job is to STRESS-TEST sub-avatars produced by a customer research pipeline — find real weaknesses, but DO NOT manufacture doubt where the evidence is solid.

Find weaknesses where they actually exist:
- Sub-avatars with too few verbatims or weak evidence
- Sub-avatars that overlap too much (should be merged)
- Claims not backed by the evidence provided
- Missing sub-avatars the data clearly supports but were overlooked
- Hooks/angles that don't match the evidence

SCORING RUBRIC — two tracks:

TRACK A — Multi-source sub-avatars (from organic research: Reddit/Quora/TikTok/forums/YouTube):
- 90-100: Rock-solid, 3+ source types, 8+ specific verbatims, tight coherent cluster, distinct identity
- 75-89: Solid — 2+ sources, 5+ verbatims, clear cluster, minor gaps acceptable
- 60-74: Has gaps — thin on one dimension (sources/verbatims/specificity) but still usable
- 40-59: Shaky — thin evidence, overlaps another, or generic voice
- 0-39: Should be merged or dropped

TRACK B — Reverse-engineered sub-avatars (is_from_reverse_engineer = true):
These come from ONE competitor funnel by nature, so single-source is EXPECTED, not a weakness. DO NOT penalize for cross-source — score on specificity + coherence + ad-readiness instead:
- 85-100: Specific identity, concrete pains/desires/fears, sharp named mechanism, strong verbatims, clear funnel position → ready to deep-dive
- 70-84: Coherent avatar with minor gaps (e.g. weak objection list or thin identity statements)
- 55-69: Needs enrichment — generic pains, vague description, missing mechanism, but still directionally useful
- 40-54: Too shallow — rebuild from deeper competitor intel
- 0-39: Incoherent, contradictory, or completely generic

CRITICAL — Do NOT output cross_source_confirmed: false as a penalty for reverse-engineered avatars. Instead, judge whether the single source is USED THOROUGHLY (specific verbatims, named mechanism, real identity cues).

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
      const reverseTag = sa.is_from_reverse_engineer
        ? `\n⚠ TRACK B — reverse-engineered from competitor "${sa.reverse_source_brand ?? 'unknown'}" — single-source is EXPECTED, do NOT penalize for cross-source.`
        : '';
      const structuredPast = sa.structured_past_attempts?.length
        ? `\nStructured past attempts: ${sa.structured_past_attempts.map(p => `tried=${p.what_tried} / failed=${p.why_failed}`).join(' | ')}`
        : '';
      const sensory = sa.sensory_triggers?.length
        ? `\nSensory triggers: ${sa.sensory_triggers.map(s => `${s.trigger} [${s.sensory_anchor}, i=${s.intensity_score}/f=${s.frequency_score}]`).join(' | ')}`
        : '';
      const scoredHooks = sa.scored_hooks?.length
        ? `\nScored hooks: ${sa.scored_hooks.map(h => `"${h.hook}" (cur=${h.curiosity_score}/int=${h.intensity_score}/rel=${h.relevance_score})`).join(' | ')}`
        : '';
      const buying = sa.buying_behavior
        ? `\nBuying behavior: ${JSON.stringify(sa.buying_behavior).slice(0, 300)}`
        : '';
      // Show ALL verbatims up to a reasonable cap, with longer truncation, so
      // the auditor can actually judge evidence density.
      const verbatimList = sa.verbatim_quotes
        .slice(0, 15)
        .map(v => `"${v.quote.slice(0, 220)}" [${v.source_type}]`)
        .join(' || ');
      return `--- ${sa.id}: "${sa.name}" (${sa.nickname}) ---${reverseTag}
Category: ${sa.dominant_category}
Description: ${sa.description}
Scores: urgency=${sa.urgency_score}, scope=${sa.scope_score}, staying_power=${sa.staying_power_score}
Sources: ${sa.source_references.join(', ')}
Verbatim count: ${sa.verbatim_quotes.length} from ${verbatimSources.length} source types
Verbatims: ${verbatimList}
Triggers: ${sa.emotional_triggers.join(', ')}
Past attempts: ${sa.past_attempts_failures.join(', ')}${structuredPast}${sensory}${scoredHooks}${buying}
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
Challenge EVERY sub-avatar FAIRLY. Pick the right rubric per sub-avatar (Track A for organic research, Track B if tagged ⚠ TRACK B — reverse-engineered).${anyReverse ? ' AT LEAST ONE sub-avatar in this batch is reverse-engineered — judge it on Track B, NOT Track A. Do not output cross_source_confirmed: false as a challenge for those.' : ''}

Key questions per sub-avatar:
1. Is this cluster ACTUALLY distinct from the others, or is it the same person described differently?
2. Are the verbatims SPECIFIC enough to write targeted ad copy, or are they generic?
3. For Track A: is evidence from 2+ source types? / For Track B: is the single source USED THOROUGHLY (named mechanism, concrete verbatims, real identity cues)?
4. Do the hooks actually use the sub-avatar's language, or are they generic marketing-speak?
5. Is anything important MISSING that the data clearly had room for?

Score honestly: if an avatar has 8+ specific verbatims, a sharp mechanism, and clear identity, it deserves 80+ even on Track B. Do not deduct points you can't justify from the evidence above.

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

    // Track B: reverse-engineered avatars are single-source by design.
    // Strip any "cross-source" / "single platform" / "one source" challenges
    // the auditor still produced despite the instructions — those are noise,
    // not real weaknesses, and they were the main driver of unfair 30% scores.
    const rawChallenges = challenge.challenges ?? [];
    const filteredChallenges = sa.is_from_reverse_engineer
      ? rawChallenges.filter(c => {
          const low = c.toLowerCase();
          return !(
            low.includes('cross-source') ||
            low.includes('cross source') ||
            low.includes('single source') ||
            low.includes('single platform') ||
            low.includes('one platform') ||
            low.includes('only one source') ||
            low.includes('only from one') ||
            low.includes('lacks cross')
          );
        })
      : rawChallenges;

    // If reverse-engineered AND the auditor still scored <55 purely because of
    // source-count issues (now removed above), rebase to 60 so the base isn't
    // poisoned for the rest of the pipeline. Single-source specificity still
    // deserves a passing grade.
    const droppedSourcePenalty = sa.is_from_reverse_engineer && rawChallenges.length > filteredChallenges.length;
    const effectiveScore = droppedSourcePenalty && challenge.confidence_score < 60
      ? Math.max(60, challenge.confidence_score + 20)
      : challenge.confidence_score;

    const effectiveCrossSource = sa.is_from_reverse_engineer ? true : challenge.cross_source_confirmed;

    const qualityTag = effectiveScore >= 80 ? '✓' :
      effectiveScore >= 50 ? '~' : '⚠';
    const advNote = `${qualityTag} Confidence: ${effectiveScore}/100 (${challenge.evidence_density}). ${filteredChallenges.slice(0, 2).join('. ')}`;

    return {
      ...sa,
      recommendation_reason: `${sa.recommendation_reason}\n[Validation] ${advNote}`,
      adversarial_challenge: {
        confidence_score: effectiveScore,
        evidence_density: challenge.evidence_density,
        cross_source_confirmed: effectiveCrossSource,
        challenges: filteredChallenges,
        overlap_with: challenge.overlap_with ?? [],
        recommendation: challenge.recommendation,
        reasoning: challenge.reasoning ?? '',
      },
    };
  });
}
