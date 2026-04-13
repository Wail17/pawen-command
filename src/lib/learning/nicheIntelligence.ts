// ============================================================
// PAWEN — Cross-Niche Intelligence
// Extracts patterns from gold outputs across all projects.
// Builds niche-specific insights that improve future runs.
// ============================================================

import { getAllGoldOutputs } from '../store/db';
import type { GoldOutput } from './types';

export interface NicheInsight {
  niche: string;
  totalGoldOutputs: number;
  topGates: { gateId: string; count: number }[];
  avgContentLength: number;
  dominantCaptureType: 'pick' | 'auto_score' | 'approval';
  avgScore: number;
  patterns: string[];
}

/**
 * Aggregate gold outputs by niche and extract cross-niche patterns.
 * Returns insights that can be injected into prompts for each niche.
 */
export async function buildNicheInsights(): Promise<NicheInsight[]> {
  const allGold = await getAllGoldOutputs();
  if (allGold.length === 0) return [];

  // Group by niche
  const byNiche = new Map<string, GoldOutput[]>();
  for (const g of allGold) {
    const niche = g.niche || 'general';
    if (!byNiche.has(niche)) byNiche.set(niche, []);
    byNiche.get(niche)!.push(g);
  }

  const insights: NicheInsight[] = [];

  for (const [niche, golds] of byNiche) {
    if (golds.length < 2) continue; // need at least 2 data points

    // Count by gate
    const gateCounts = new Map<string, number>();
    for (const g of golds) {
      gateCounts.set(g.gateId, (gateCounts.get(g.gateId) || 0) + 1);
    }
    const topGates = [...gateCounts.entries()]
      .map(([gateId, count]) => ({ gateId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average content length
    const avgContentLength = Math.round(
      golds.reduce((sum, g) => sum + g.content.length, 0) / golds.length,
    );

    // Dominant capture type
    const typeCounts = { pick: 0, auto_score: 0, approval: 0 };
    for (const g of golds) typeCounts[g.captureType]++;
    const dominantCaptureType = (Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0]) as 'pick' | 'auto_score' | 'approval';

    // Average score (for scored outputs)
    const scored = golds.filter(g => g.score && g.score > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, g) => s + (g.score || 0), 0) / scored.length)
      : 0;

    // Extract content patterns
    const patterns = extractContentPatterns(golds);

    insights.push({
      niche,
      totalGoldOutputs: golds.length,
      topGates,
      avgContentLength,
      dominantCaptureType,
      avgScore,
      patterns,
    });
  }

  return insights.sort((a, b) => b.totalGoldOutputs - a.totalGoldOutputs);
}

/**
 * Build a prompt block from niche insights.
 */
export async function buildNicheInsightPrompt(niche: string): Promise<string> {
  const insights = await buildNicheInsights();
  const match = insights.find(i => i.niche === niche);
  if (!match || match.totalGoldOutputs < 3) return '';

  const lines: string[] = [
    `=== NICHE INTELLIGENCE (${match.niche}) ===`,
    `Based on ${match.totalGoldOutputs} validated outputs in this niche:`,
  ];

  if (match.avgScore > 0) {
    lines.push(`Average quality score: ${match.avgScore}%`);
  }
  lines.push(`Preferred content length: ~${match.avgContentLength} chars`);
  lines.push(`Most productive gates: ${match.topGates.map(g => g.gateId).join(', ')}`);

  if (match.patterns.length > 0) {
    lines.push(`Winning patterns in this niche:`);
    for (const p of match.patterns) {
      lines.push(`  - ${p}`);
    }
  }

  lines.push('=== END NICHE INTELLIGENCE ===');
  return lines.join('\n');
}

/**
 * Extract content-level patterns from gold outputs.
 * Simple heuristic-based analysis.
 */
function extractContentPatterns(golds: GoldOutput[]): string[] {
  const patterns: string[] = [];
  const allContent = golds.map(g => g.content.toLowerCase()).join(' ');
  const totalLen = golds.reduce((s, g) => s + g.content.length, 0);

  // Length pattern
  const avgLen = totalLen / golds.length;
  if (avgLen < 300) patterns.push('Short-form content performs best');
  else if (avgLen > 1000) patterns.push('Long-form, detailed content preferred');
  else patterns.push('Medium-length content (300-1000 chars) preferred');

  // Structure patterns
  const bulletCount = (allContent.match(/[•\-\*]\s/g) || []).length;
  const numberedCount = (allContent.match(/\d+\.\s/g) || []).length;
  if (bulletCount > golds.length * 2) patterns.push('Bullet-point format resonates');
  if (numberedCount > golds.length * 2) patterns.push('Numbered lists work well');

  // Emotional patterns
  const questionCount = (allContent.match(/\?/g) || []).length;
  if (questionCount > golds.length * 3) patterns.push('Questions in copy drive engagement');

  const exclamationCount = (allContent.match(/!/g) || []).length;
  if (exclamationCount > golds.length * 2) patterns.push('Energetic, exclamation-driven tone');

  // Quote/testimonial patterns
  const quoteCount = (allContent.match(/[""][^""]{20,}[""]|[""][^""]{20,}[""]/g) || []).length;
  if (quoteCount > golds.length) patterns.push('Testimonials and quotes boost quality');

  return patterns.slice(0, 5);
}
