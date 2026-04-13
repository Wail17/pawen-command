// ============================================================
// PAWEN — Adaptive Learning: Prompt Injection
// Builds prompt blocks from gold outputs + learning profile
// so agents calibrate to what the human actually wants.
// ============================================================

import { GoldOutput } from './types';
import {
  getGoldOutputsForGateAndNiche,
  getGoldOutputsForGate,
  getLearningProfile,
} from '../store/db';
import { buildNicheInsightPrompt } from './nicheIntelligence';
import type { AdPerformance } from '../types';

/**
 * Build a few-shot gold examples prompt block.
 * Prioritizes: exact funnel match → picks → high scores → recent.
 */
export async function buildGoldOutputsPrompt(params: {
  gateId: string;
  niche: string;
  funnel: string;
  maxExamples?: number;
}): Promise<string> {
  const { gateId, niche, funnel, maxExamples = 3 } = params;

  // Try niche-specific first, fall back to all for this gate
  let candidates = await getGoldOutputsForGateAndNiche(gateId, niche);
  if (candidates.length < maxExamples) {
    const all = await getGoldOutputsForGate(gateId);
    const nicheIds = new Set(candidates.map(c => c.id));
    candidates = [...candidates, ...all.filter(g => !nicheIds.has(g.id))];
  }

  if (candidates.length === 0) return '';

  // Score and rank
  const scored = candidates.map(g => {
    let score = 0;
    // Funnel match
    if (g.funnel === funnel) score += 30;
    else if (g.funnel === 'any') score += 10;
    // Capture type priority
    if (g.captureType === 'pick') score += 25;       // human signal strongest
    else if (g.captureType === 'auto_score') score += 15;
    else score += 10;
    // Recency bonus (newer = better)
    const ageMs = Date.now() - new Date(g.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    score += Math.max(0, 20 - ageDays); // up to 20 points for fresh outputs
    // Score bonus
    if (g.score) score += Math.min(g.score / 10, 10);
    return { gold: g, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, maxExamples);

  const lines: string[] = [
    '=== GOLD EXAMPLES (the human loved these — match this quality & style) ===',
  ];

  for (let i = 0; i < selected.length; i++) {
    const g = selected[i].gold;
    const source = g.captureType === 'pick' ? '★ picked' : g.captureType === 'auto_score' ? `scored ${g.score}%` : 'approved';
    lines.push(`--- Example ${i + 1} (${source}, section: ${g.sectionPath}, from: ${g.sourceProjectName}) ---`);
    lines.push(g.content.slice(0, 1000));
    lines.push('');
  }

  lines.push('Study the style, length, tone, and structure of these examples.');
  lines.push('=== END GOLD EXAMPLES ===');

  return lines.join('\n');
}

/**
 * Build a learning profile prompt block.
 * Tells agents about the user's style preferences and rejection patterns.
 */
export async function buildLearningProfilePrompt(gateId?: string): Promise<string> {
  const profile = await getLearningProfile();
  if (!profile) return '';

  const lines: string[] = ['=== USER PREFERENCES (learned from past interactions) ==='];
  let hasContent = false;

  // Style signals for this specific gate
  if (gateId) {
    const avgLen = profile.styleSignals.avgPickLength[gateId];
    if (avgLen) {
      lines.push(`PREFERRED LENGTH: ~${avgLen} characters for picked outputs in this gate`);
      hasContent = true;
    }
    const tones = profile.styleSignals.toneKeywords[gateId];
    if (tones && tones.length > 0) {
      lines.push(`PREFERRED TONE: ${tones.join(', ')}`);
      hasContent = true;
    }
  }

  // Rejection patterns
  if (profile.rejectionReasons.length > 0) {
    lines.push(`RECENT REJECTION REASONS (avoid these): ${profile.rejectionReasons.slice(0, 5).join(' | ')}`);
    hasContent = true;
  }

  // Approval rate
  const total = profile.totalApprovals + profile.totalRejections;
  if (total >= 3) {
    const rate = Math.round((profile.totalApprovals / total) * 100);
    lines.push(`APPROVAL RATE: ${rate}% (${profile.totalApprovals}/${total})`);
    hasContent = true;
  }

  if (!hasContent) return '';

  lines.push('Calibrate your output to match these preferences.');
  lines.push('=== END USER PREFERENCES ===');

  return lines.join('\n');
}

/**
 * Build performance data prompt block.
 * Tells agents what actually converts in the real world.
 */
export function buildPerformancePrompt(adPerformance?: AdPerformance[]): string {
  if (!adPerformance || adPerformance.length === 0) return '';

  // Sort by ROAS descending — best performers first
  const sorted = [...adPerformance].sort((a, b) => b.roas - a.roas);
  const lines: string[] = ['=== PROVEN AD PERFORMANCE (real Meta Ads data) ==='];

  for (const ad of sorted.slice(0, 5)) {
    lines.push(`- "${ad.adName}": CTR ${ad.ctr}%, CPA $${ad.cpa}, ROAS ${ad.roas}x (${ad.impressions.toLocaleString()} impressions)`);
    if (ad.notes) lines.push(`  Notes: ${ad.notes}`);
  }

  // Calculate averages
  const avgCtr = sorted.reduce((s, a) => s + a.ctr, 0) / sorted.length;
  const avgRoas = sorted.reduce((s, a) => s + a.roas, 0) / sorted.length;
  lines.push(`BENCHMARKS: avg CTR ${avgCtr.toFixed(2)}%, avg ROAS ${avgRoas.toFixed(1)}x`);
  lines.push('Use these benchmarks to calibrate your output. Emulate patterns from top performers.');
  lines.push('=== END PERFORMANCE DATA ===');

  return lines.join('\n');
}

/**
 * Combined: gold outputs + learning profile + niche intelligence + performance in one call.
 * Returns empty string if nothing to inject (graceful degradation).
 */
export async function buildLearningInjection(params: {
  gateId: string;
  niche: string;
  funnel: string;
  adPerformance?: AdPerformance[];
}): Promise<string> {
  const [goldBlock, profileBlock, nicheBlock] = await Promise.all([
    buildGoldOutputsPrompt({
      gateId: params.gateId,
      niche: params.niche,
      funnel: params.funnel,
    }),
    buildLearningProfilePrompt(params.gateId),
    buildNicheInsightPrompt(params.niche),
  ]);

  const perfBlock = buildPerformancePrompt(params.adPerformance);

  const parts: string[] = [];
  if (goldBlock) parts.push(goldBlock);
  if (profileBlock) parts.push(profileBlock);
  if (nicheBlock) parts.push(nicheBlock);
  if (perfBlock) parts.push(perfBlock);

  return parts.join('\n\n');
}
