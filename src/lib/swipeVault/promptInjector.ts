// ============================================================
// PAWEN — Swipe Vault prompt injection
// Builds a prompt block for agents — shows top winners (what to
// emulate), top losers (what to avoid), big swings (angles
// worth exploring), AND sophistication intelligence (what level
// the market is at, what works at each level).
// ============================================================

import { getAllSwipeEntries } from '@/lib/store/db';
import type { SwipeVaultEntry, SophisticationLevel } from './types';
import { SOPHISTICATION_LEVELS } from './types';

interface BuildArgs {
  niche?: string;
  awarenessLevel?: string;
  format?: string;
  maxWinners?: number;
  maxLosers?: number;
  maxBigSwings?: number;
}

function scoreMatch(entry: SwipeVaultEntry, args: BuildArgs): number {
  let score = 0;
  if (args.niche && entry.niche && entry.niche.toLowerCase() === args.niche.toLowerCase()) score += 10;
  if (args.awarenessLevel && entry.awarenessLevel === args.awarenessLevel) score += 5;
  if (args.format && entry.format === args.format) score += 3;
  if (entry.metrics?.roas) score += Math.min(entry.metrics.roas, 5);
  return score;
}

function summarize(e: SwipeVaultEntry): string {
  const parts: string[] = [];
  if (e.hook) parts.push(`HOOK: ${e.hook}`);
  if (e.headline) parts.push(`HEADLINE: ${e.headline}`);
  if (e.body) parts.push(`BODY: ${e.body.slice(0, 300)}${e.body.length > 300 ? '…' : ''}`);
  if (e.cta) parts.push(`CTA: ${e.cta}`);
  const meta: string[] = [];
  if (e.angle) meta.push(`angle=${e.angle}`);
  if (e.emotion) meta.push(`emotion=${e.emotion}`);
  if (e.format) meta.push(`format=${e.format}`);
  if (e.awarenessLevel) meta.push(`awareness=${e.awarenessLevel}`);
  if (e.sophisticationLevel) meta.push(`sophistication=L${e.sophisticationLevel}`);
  if (e.metrics?.roas) meta.push(`ROAS=${e.metrics.roas}`);
  if (e.metrics?.ctr) meta.push(`CTR=${e.metrics.ctr}%`);
  if (meta.length) parts.push(`[${meta.join(', ')}]`);
  if (e.note) parts.push(`WHY: ${e.note}`);
  return parts.join('\n');
}

interface SophisticationIntel {
  distribution: Record<SophisticationLevel, { winners: number; losers: number; total: number }>;
  dominantLevel: SophisticationLevel;
  winningLevel: SophisticationLevel | null;
  losingLevel: SophisticationLevel | null;
  marketReadiness: string;
  directive: string;
}

function analyzeSophistication(entries: SwipeVaultEntry[]): SophisticationIntel | null {
  const tagged = entries.filter(e => e.sophisticationLevel);
  if (tagged.length < 2) return null;

  const dist: Record<number, { winners: number; losers: number; total: number }> = {};
  for (let l = 1; l <= 5; l++) dist[l] = { winners: 0, losers: 0, total: 0 };

  for (const e of tagged) {
    const lv = e.sophisticationLevel!;
    dist[lv].total++;
    if (e.status === 'winning') dist[lv].winners++;
    if (e.status === 'losing') dist[lv].losers++;
  }

  // Dominant = level with most entries
  let dominantLevel: SophisticationLevel = 1;
  let maxTotal = 0;
  for (let l = 1; l <= 5; l++) {
    if (dist[l].total > maxTotal) { maxTotal = dist[l].total; dominantLevel = l as SophisticationLevel; }
  }

  // Winning level = level with best win ratio (min 2 entries)
  let winningLevel: SophisticationLevel | null = null;
  let bestWinRate = 0;
  for (let l = 1; l <= 5; l++) {
    if (dist[l].total >= 2) {
      const rate = dist[l].winners / dist[l].total;
      if (rate > bestWinRate) { bestWinRate = rate; winningLevel = l as SophisticationLevel; }
    }
  }

  // Losing level = level with worst win ratio (most losers)
  let losingLevel: SophisticationLevel | null = null;
  let worstRate = 1;
  for (let l = 1; l <= 5; l++) {
    if (dist[l].total >= 2) {
      const rate = dist[l].losers / dist[l].total;
      if (rate > (1 - worstRate)) { worstRate = 1 - rate; losingLevel = l as SophisticationLevel; }
    }
  }

  const levelDef = SOPHISTICATION_LEVELS.find(s => s.level === dominantLevel)!;
  const winDef = winningLevel ? SOPHISTICATION_LEVELS.find(s => s.level === winningLevel)! : null;

  let marketReadiness: string;
  let directive: string;

  if (dominantLevel <= 2) {
    marketReadiness = `EARLY MARKET — most competitors run L${dominantLevel} (${levelDef.name}). Market is not yet educated on mechanisms.`;
    directive = winningLevel && winningLevel > dominantLevel
      ? `Winning ads are already at L${winningLevel} (${winDef!.name}) — the market rewards sophistication above the average. Write at L${winningLevel} minimum.`
      : `L${dominantLevel + 1}+ copy has a structural advantage. Introduce mechanism-based angles to leapfrog.`;
  } else if (dominantLevel === 3) {
    marketReadiness = `MECHANISM-AWARE MARKET — most competitors already use unique mechanisms (L3). Simple claims (L1-L2) will underperform.`;
    directive = winningLevel && winningLevel >= 4
      ? `Winners stack at L${winningLevel} (${winDef!.name}) — add proof layers, specificity, and credentialing to your mechanism.`
      : `The market is crowded with mechanisms. Differentiate by stacking yours with clinical proof, story, or identity hooks.`;
  } else {
    marketReadiness = `SATURATED MARKET — competitors are at L${dominantLevel} (${levelDef.name}). The market has seen every claim and mechanism.`;
    directive = `Only L5 identity-level copy or genuinely novel mechanisms will cut through. Lead with belonging, transformation stories, and raw authenticity. Avoid re-stating known mechanisms without fresh proof.`;
  }

  return {
    distribution: dist as Record<SophisticationLevel, { winners: number; losers: number; total: number }>,
    dominantLevel,
    winningLevel,
    losingLevel,
    marketReadiness,
    directive,
  };
}

export async function buildSwipeVaultPrompt(args: BuildArgs = {}): Promise<string> {
  try {
    const all = await getAllSwipeEntries();
    if (all.length === 0) return '';

    const maxW = args.maxWinners ?? 5;
    const maxL = args.maxLosers ?? 3;
    const maxB = args.maxBigSwings ?? 3;

    const winners = all
      .filter(e => e.status === 'winning')
      .map(e => ({ e, s: scoreMatch(e, args) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, maxW)
      .map(x => x.e);

    const losers = all
      .filter(e => e.status === 'losing')
      .map(e => ({ e, s: scoreMatch(e, args) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, maxL)
      .map(x => x.e);

    const bigSwings = all
      .filter(e => e.status === 'big_swing')
      .map(e => ({ e, s: scoreMatch(e, args) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, maxB)
      .map(x => x.e);

    if (winners.length === 0 && losers.length === 0 && bigSwings.length === 0) return '';

    const blocks: string[] = [];
    blocks.push('=== SWIPE VAULT — LEARN FROM WHAT WORKS AND WHAT DOESN\'T ===');

    // Sophistication intelligence
    const sophIntel = analyzeSophistication(all);
    if (sophIntel) {
      blocks.push('\n--- MARKET SOPHISTICATION INTELLIGENCE ---');
      blocks.push(sophIntel.marketReadiness);
      blocks.push(`DIRECTIVE: ${sophIntel.directive}`);
      const distLines: string[] = [];
      for (let l = 1; l <= 5; l++) {
        const d = sophIntel.distribution[l as SophisticationLevel];
        const def = SOPHISTICATION_LEVELS[l - 1];
        if (d.total > 0) {
          distLines.push(`  L${l} ${def.name}: ${d.total} entries (${d.winners}W / ${d.losers}L)`);
        }
      }
      if (distLines.length) {
        blocks.push('Distribution:');
        blocks.push(...distLines);
      }
      if (sophIntel.winningLevel) {
        blocks.push(`Best-performing level: L${sophIntel.winningLevel} (${SOPHISTICATION_LEVELS[sophIntel.winningLevel - 1].name})`);
      }
      if (sophIntel.losingLevel && sophIntel.losingLevel !== sophIntel.winningLevel) {
        blocks.push(`Weakest level: L${sophIntel.losingLevel} (${SOPHISTICATION_LEVELS[sophIntel.losingLevel - 1].name}) — avoid writing at this level.`);
      }
    }

    if (winners.length) {
      blocks.push('\n--- WINNERS (emulate these patterns, not the words) ---');
      winners.forEach((e, i) => blocks.push(`\n#${i + 1} WINNER\n${summarize(e)}`));
    }
    if (bigSwings.length) {
      blocks.push('\n--- BIG SWINGS (ambitious angles worth trying) ---');
      bigSwings.forEach((e, i) => blocks.push(`\n#${i + 1} BIG SWING\n${summarize(e)}`));
    }
    if (losers.length) {
      blocks.push('\n--- LOSERS (AVOID these patterns) ---');
      losers.forEach((e, i) => blocks.push(`\n#${i + 1} LOSER\n${summarize(e)}`));
    }

    blocks.push('\nRULES:');
    blocks.push('- Extract PATTERNS (structure, angle, emotion) from winners — do NOT copy verbatim.');
    blocks.push('- Avoid the failure modes visible in losers (angle, claim style, tone).');
    blocks.push('- Big swings are permission to take risk on angles not yet validated.');
    if (sophIntel) {
      blocks.push(`- SOPHISTICATION RULE: The market is at L${sophIntel.dominantLevel}. Your copy MUST be at L${sophIntel.winningLevel ?? sophIntel.dominantLevel} or higher to compete. Never write below the market level.`);
    }
    blocks.push('=== END SWIPE VAULT ===\n');

    return blocks.join('\n');
  } catch {
    return '';
  }
}
