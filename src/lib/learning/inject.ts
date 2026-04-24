// ============================================================
// PAWEN — Adaptive Learning: Prompt Injection
// Builds prompt blocks from gold outputs + learning profile
// so agents calibrate to what the human actually wants.
// ============================================================

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
 * Tells agents what actually converts in the real world — distilled into
 * patterns (winning hooks / formats / angles) when tagging is present,
 * otherwise falls back to a clean top-performers list.
 */
export function buildPerformancePrompt(adPerformance?: AdPerformance[]): string {
  if (!adPerformance || adPerformance.length === 0) return '';

  // Identify clearly winning + losing ads. Prefer explicit verdicts (set by
  // the CSV insight extractor); otherwise infer from ROAS percentiles so
  // hand-entered data still works.
  const sorted = [...adPerformance].sort((a, b) => b.roas - a.roas);
  const winners = sorted.filter(a => a.verdict === 'winner');
  const losers = sorted.filter(a => a.verdict === 'loser');

  let inferredWinners: AdPerformance[] = [];
  let inferredLosers: AdPerformance[] = [];
  if (winners.length === 0 && losers.length === 0 && sorted.length >= 4) {
    const cut = Math.max(1, Math.floor(sorted.length * 0.25));
    inferredWinners = sorted.slice(0, cut);
    inferredLosers = sorted.slice(-cut);
  }
  const W = winners.length ? winners : inferredWinners;
  const L = losers.length ? losers : inferredLosers;

  const lines: string[] = ['=== PROVEN AD PERFORMANCE (real Meta Ads data) ==='];

  // Aggregate winners by tag (hook / format / angle) and surface dominant
  // patterns so the agent has rules to apply, not raw rows to skim.
  const tagBreakdown = (
    items: AdPerformance[],
    pick: (a: AdPerformance) => string | undefined,
  ): Array<[string, { spend: number; conv: number; cnt: number; roas: number }]> => {
    const m = new Map<string, { spend: number; conv: number; cnt: number; rev: number }>();
    for (const a of items) {
      const k = pick(a);
      if (!k || k === 'unknown') continue;
      const cur = m.get(k) ?? { spend: 0, conv: 0, cnt: 0, rev: 0 };
      cur.spend += a.spend;
      cur.conv += a.conversions;
      cur.cnt += 1;
      cur.rev += a.spend * a.roas;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([k, v]) => [k, { spend: v.spend, conv: v.conv, cnt: v.cnt, roas: v.spend > 0 ? v.rev / v.spend : 0 }] as [string, { spend: number; conv: number; cnt: number; roas: number }])
      .sort((a, b) => b[1].roas - a[1].roas);
  };

  if (W.length > 0) {
    lines.push('');
    lines.push('WINNING ADS (top performers):');
    for (const ad of W.slice(0, 5)) {
      const tags = [ad.hookType, ad.formatType, ad.angle].filter(t => t && t !== 'unknown').join(' / ');
      const tagSuffix = tags ? `  [${tags}]` : '';
      lines.push(`- "${ad.adName}": CTR ${ad.ctr.toFixed(2)}%, CPA $${ad.cpa.toFixed(2)}, ROAS ${ad.roas.toFixed(2)}x${tagSuffix}`);
      if (ad.notes) lines.push(`  Note: ${ad.notes}`);
    }
  }

  if (L.length > 0) {
    lines.push('');
    lines.push('LOSING ADS (do NOT replicate these patterns):');
    for (const ad of L.slice(0, 3)) {
      const tags = [ad.hookType, ad.formatType, ad.angle].filter(t => t && t !== 'unknown').join(' / ');
      const tagSuffix = tags ? `  [${tags}]` : '';
      lines.push(`- "${ad.adName}": CTR ${ad.ctr.toFixed(2)}%, CPA ${ad.cpa === Infinity ? '—' : '$' + ad.cpa.toFixed(2)}, ROAS ${ad.roas.toFixed(2)}x${tagSuffix}`);
    }
  }

  // Pattern rules — only when winners actually have creative tagging (CSV path)
  const winnersHaveTags = W.some(a => a.hookType || a.formatType || a.angle);
  if (winnersHaveTags) {
    const winningHooks = tagBreakdown(W, a => a.hookType);
    const losingHooks = tagBreakdown(L, a => a.hookType);
    const winningFormats = tagBreakdown(W, a => a.formatType);
    const winningAngles = tagBreakdown(W, a => a.angle);

    lines.push('');
    lines.push('PATTERNS YOU MUST APPLY:');
    if (winningHooks[0]) {
      const [hook, agg] = winningHooks[0];
      lines.push(`✓ Lead with "${hook}" hooks — ROAS ${agg.roas.toFixed(2)}x across ${agg.cnt} winning ads.`);
    }
    if (winningFormats[0]) {
      const [fmt, agg] = winningFormats[0];
      lines.push(`✓ Prefer "${fmt}" format — ROAS ${agg.roas.toFixed(2)}x across ${agg.cnt} winning ads.`);
    }
    if (winningAngles[0]) {
      const [ang, agg] = winningAngles[0];
      lines.push(`✓ Lean into "${ang}" angle — ROAS ${agg.roas.toFixed(2)}x across ${agg.cnt} winning ads.`);
    }
    if (losingHooks[0] && losingHooks[0][1].cnt >= 2) {
      const [hook] = losingHooks[0];
      lines.push(`✗ Avoid "${hook}" hooks — they keep losing in this account.`);
    }
  }

  // Account benchmarks
  const accountSpend = sorted.reduce((s, a) => s + a.spend, 0);
  const accountConv = sorted.reduce((s, a) => s + a.conversions, 0);
  const accountRev = sorted.reduce((s, a) => s + a.spend * a.roas, 0);
  const accountImpr = sorted.reduce((s, a) => s + a.impressions, 0);
  const accountClicks = sorted.reduce((s, a) => s + a.clicks, 0);
  const accountRoas = accountSpend > 0 ? accountRev / accountSpend : 0;
  const accountCtr = accountImpr > 0 ? (accountClicks / accountImpr) * 100 : 0;
  const accountCpa = accountConv > 0 ? accountSpend / accountConv : 0;

  lines.push('');
  lines.push(`ACCOUNT BENCHMARKS (beat these): ROAS ${accountRoas.toFixed(2)}x · CTR ${accountCtr.toFixed(2)}% · CPA $${accountCpa.toFixed(2)} across ${sorted.length} ads`);
  lines.push('Your job: produce copy/creatives that match the WINNING patterns above and outperform these benchmarks.');
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
  copyFormat?: 'advertorial' | 'native' | 'listicle' | 'skipped';
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

  // Hard-coded DR principles — injected into EVERY agent prompt for gates
  // that produce copy or creatives. Non-negotiable. See drPrinciples.ts.
  const copyGates = new Set(['gate4', 'gate5', 'gate6']);
  const creativeGates = new Set(['gate7', 'gate8']);
  let drBlock = '';
  if (copyGates.has(params.gateId) || creativeGates.has(params.gateId)) {
    const { buildDRInjection } = await import('./drPrinciples');
    drBlock = buildDRInjection(params.copyFormat, {
      includeCreativeRules: creativeGates.has(params.gateId),
      includeCopyRules: copyGates.has(params.gateId),
    });
  }

  const parts: string[] = [];
  if (drBlock) parts.push(drBlock);
  if (goldBlock) parts.push(goldBlock);
  if (profileBlock) parts.push(profileBlock);
  if (nicheBlock) parts.push(nicheBlock);
  if (perfBlock) parts.push(perfBlock);

  return parts.join('\n\n');
}
