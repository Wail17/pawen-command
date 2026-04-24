// ============================================================
// PAWEN — Swipe Vault types
// Global (cross-project) library of ads that worked, flopped,
// or are worth testing. Agents in G4/G6/G7 can pick from it.
// ============================================================

export type SwipeStatus = 'winning' | 'losing' | 'big_swing' | 'reference';
export type SwipeSource = 'own_brand' | 'competitor' | 'swipe' | 'generated';

// Schwartz market sophistication levels (1-5)
export type SophisticationLevel = 1 | 2 | 3 | 4 | 5;

export const SOPHISTICATION_LEVELS: { level: SophisticationLevel; name: string; short: string; description: string; example: string }[] = [
  {
    level: 1, name: 'Direct Claim', short: 'L1',
    description: 'Simple direct benefit. First mover advantage. No proof needed — the claim itself is new to the market.',
    example: '"Lose weight with this new pill"',
  },
  {
    level: 2, name: 'Enlarged Claim', short: 'L2',
    description: 'Bigger, bolder, more specific. The market has seen L1 claims, so you compete on magnitude and specificity.',
    example: '"Lose 30lbs in 30 days — guaranteed or your money back"',
  },
  {
    level: 3, name: 'Unique Mechanism', short: 'L3',
    description: 'Introduces a WHY — a unique mechanism that explains how the product works differently. The market is skeptical of claims.',
    example: '"The estrobolome reset that rebalances your hormones from the gut"',
  },
  {
    level: 4, name: 'Mechanism Stacked', short: 'L4',
    description: 'Mechanism + proof layers (story, credentials, specificity). Market knows mechanisms exist — yours must be the most credible.',
    example: '"How a Harvard hormone scientist discovered the 3-strain probiotic that fixes the real cause of menopause belly in 14 days"',
  },
  {
    level: 5, name: 'Identity / Experience', short: 'L5',
    description: 'The ad IS the transformation. Identity-level connection. Market is saturated — only raw authenticity and belonging cut through.',
    example: '"For the woman who has tried everything for her 3AM wake-ups — and is ready to stop blaming herself"',
  },
];

export interface SwipeVaultEntry {
  id: string;
  status: SwipeStatus;
  source: SwipeSource;

  // Visual
  imageUrl?: string;
  imageBlobKey?: string;

  // Copy
  hook?: string;
  headline?: string;
  body?: string;
  cta?: string;

  // Classification
  niche?: string;
  format?: string;
  awarenessLevel?: string;
  angle?: string;
  emotion?: string;
  triggers?: string[];
  sophisticationLevel?: SophisticationLevel;

  // Performance (optional, only when known)
  metrics?: {
    ctr?: number;
    cpa?: number;
    roas?: number;
    spend?: number;
    conversions?: number;
  };

  // Context
  sourceProjectId?: string;
  sourceGateId?: string;
  note?: string;
  tags?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface SwipeVaultFilter {
  status?: SwipeStatus;
  niche?: string;
  format?: string;
  awarenessLevel?: string;
}
