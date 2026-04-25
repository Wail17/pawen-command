// ============================================================
// PAWEN — Phase W (Hive) — types
// Multi-tenant brand/user model. All additive; legacy single-user
// flow stays bit-identical when HIVE_ENABLED=0.
// ============================================================

export interface Brand {
  id: string;                // uuid
  ownerId: string;           // app_users.name
  name: string;
  niche?: string;
  language?: string;
  avatarEmoji: string;       // '🏝️' | '🌴' | '⛰️' | '🗿' | '🏖️' | '🌋' …
  colorHex: string;          // '#FF8A00' etc.
  sharesPatterns: boolean;   // default true — contributes to winning_patterns pool
  createdAt: string;
  updatedAt: string;
}

export interface WinningPattern {
  id: string;
  sourceBrandId: string;
  gateId: string;
  generalizedPattern: {
    kind: 'hook' | 'headline' | 'body' | 'visual' | 'mechanism' | 'offer_stack' | 'other';
    description: string;
    example?: string;
    extractedAt: string;
  };
  metrics: {
    ctr?: number;
    cpa?: number;
    roas?: number;
    spend?: number;
    lift?: number;              // vs. baseline
  };
  createdAt: string;
}

export interface OracleProposal {
  id: string;
  // Oracle observes the whole hive and drafts proposals that a specific brand
  // might want to try — synthesized from cross-brand winning patterns.
  targetBrandId: string;
  sourceHints: string[];       // ids of winning_patterns that inspired this
  proposal: string;            // markdown, 1-3 paragraphs
  confidence: number;          // 0-1
  createdAt: string;
}

// Placeholder for runtime live-status — populated when /api/hive/state
// is implemented. For now every field is nullable.
export interface BrandLiveStatus {
  brandId: string;
  activeAgents: string[];      // agentIds currently working
  currentGate?: string;
  conversationActive?: boolean;
  lastActivityAt?: string;
  projectsCount: number;
  winningPatternCount: number;
}
