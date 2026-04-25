// ============================================================
// PAWEN — Phase W — Oracle persona + proposal generator (stub)
//
// Oracle is the 8th agent: synthesizes winning patterns across
// brands and proposes new angles a target brand might try. Sits
// ALONGSIDE the 6 production personas, NOT inside AGENT_PERSONAS
// (which has a strict type used by goldOutputs/agentMemory/etc.).
// ============================================================

import type { OracleProposal } from './types';

export interface OraclePersona {
  id: 'oracle';
  name: 'Oracle';
  role: string;
  emoji: string;
  model: string;
  personality: string;
}

export const ORACLE: OraclePersona = {
  id: 'oracle',
  name: 'Oracle',
  role: 'Hive Ideator',
  emoji: '🔮',
  model: 'claude-opus-4-6',
  personality: 'Silent observer. Speaks only when patterns converge across brands. Does not take sides.',
};

/**
 * Phase W stub — returns empty array. Real implementation will:
 *   1. Fetch winning_patterns from other brands (sharesPatterns=true).
 *   2. Group by generalized_pattern.kind + niche adjacency.
 *   3. Call Opus to synthesize an opinionated proposal per target brand.
 *   4. Filter by confidence ≥ 0.6 and inject into /api/oracle/feed.
 */
export async function generateOracleProposals(_targetBrandId: string): Promise<OracleProposal[]> {
  return [];
}
