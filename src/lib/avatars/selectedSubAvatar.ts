// ============================================================
// PAWEN — Selected Sub-Avatar Resolver
//
// Single source of truth for "which sub-avatar is Gates 2-9 focused on?"
//
// Resolution order:
//   1. project.selectedSubAvatarId (explicit human pick after Gate 1)
//   2. sub_avatars[].recommended_for_test === true (Marcus's auto-pick)
//   3. sub_avatars[0] (absolute fallback — no pick, no recommendation)
//   4. null (no Gate 1 result at all)
//
// All downstream gates MUST go through this helper instead of eyeballing
// gate1 output themselves — that's what created the incoherence bug where
// every gate was rebuilding sub-avatars from scratch.
// ============================================================

import { Project } from '../types';
import { AvatarRunResult, SubAvatarV2 } from './types';

/**
 * Resolve the sub-avatar that downstream gates should focus on.
 *
 * @param project           Current project (source of selectedSubAvatarId)
 * @param previousOutputs   Map from runGate.ts — we pull gate1 out of here
 * @returns                 The selected sub-avatar, or null if Gate 1 hasn't run yet
 */
export function getSelectedSubAvatar(
  project: Project,
  previousOutputs?: Record<string, unknown>,
): SubAvatarV2 | null {
  // Pull Gate 1 output from either previousOutputs (runGate path) or
  // project.avatarRunResult (direct access path).
  const gate1Data =
    (previousOutputs?.['gate1'] as AvatarRunResult | undefined) ??
    project.avatarRunResult;

  if (!gate1Data || !Array.isArray(gate1Data.sub_avatars) || gate1Data.sub_avatars.length === 0) {
    return null;
  }

  const subAvatars = gate1Data.sub_avatars;

  // 1. Explicit human pick
  if (project.selectedSubAvatarId) {
    const picked = subAvatars.find(sa => sa.id === project.selectedSubAvatarId);
    if (picked) return picked;
  }

  // 2. Marcus's recommendation
  const recommended = subAvatars.find(sa => sa.recommended_for_test);
  if (recommended) return recommended;

  // 3. First in the list
  return subAvatars[0];
}

/**
 * Build a compact but rich text summary of the selected sub-avatar for use
 * as prompt context in downstream gates. Keeps the important fields and
 * drops the noise (source_urls, internal IDs, etc.).
 */
export function buildSelectedSubAvatarBrief(sa: SubAvatarV2): string {
  const lines: string[] = [];
  lines.push(`=== SELECTED SUB-AVATAR (focus for this gate) ===`);
  lines.push(`ID: ${sa.id}`);
  lines.push(`Name: ${sa.name}`);
  lines.push(`Nickname: ${sa.nickname}`);
  lines.push(`Dominant category: ${sa.dominant_category}`);
  lines.push(`Surface desire: ${sa.surface_desire}`);
  lines.push(`Description: ${sa.description}`);
  lines.push(`TAM estimate: ${sa.tam_estimate ?? '—'}`);
  lines.push(
    `Scores — urgency ${sa.urgency_score}/10 · scope ${sa.scope_score}/10 · staying ${sa.staying_power_score}/10`,
  );

  if (sa.emotional_triggers?.length) {
    lines.push(`\nEmotional triggers:`);
    sa.emotional_triggers.forEach(t => lines.push(`  - ${t}`));
  }

  if (sa.past_attempts_failures?.length) {
    lines.push(`\nPast failed attempts:`);
    sa.past_attempts_failures.forEach(p => lines.push(`  - ${p}`));
  }

  if (sa.implicit_demographics?.length) {
    lines.push(`\nImplicit demographics:`);
    sa.implicit_demographics.forEach(d => lines.push(`  - ${d}`));
  }

  if (sa.verbatim_quotes?.length) {
    lines.push(`\nVerbatim quotes (voice-of-customer):`);
    sa.verbatim_quotes.slice(0, 10).forEach(q => {
      lines.push(`  - "${q.quote}" [${q.source_type}]`);
    });
  }

  if (sa.angles) {
    if (sa.angles.positioning) {
      lines.push(
        `\nPositioning angle (${sa.angles.positioning.framework}): ${sa.angles.positioning.description}`,
      );
    }
    if (sa.angles.hooks?.length) {
      lines.push(`\nStarter hooks from Gate 1:`);
      sa.angles.hooks.forEach((h, i) => lines.push(`  ${i + 1}. ${h}`));
    }
    if (sa.angles.story_angle) {
      const s = sa.angles.story_angle;
      lines.push(`\nStory arc: ${s.problem} → ${s.agitation} → ${s.solution} → ${s.mechanism} → ${s.cta}`);
    }
  }

  lines.push(`\n=== END SELECTED SUB-AVATAR ===`);
  return lines.join('\n');
}
