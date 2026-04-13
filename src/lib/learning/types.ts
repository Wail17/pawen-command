// ============================================================
// PAWEN — Adaptive Learning Engine Types
// Gold outputs + learning profile for continuous improvement
// ============================================================

import type { GateId, FunnelType } from '../types';

/**
 * GoldOutput — a human-validated output section.
 * Created when:
 *   1. User ★ picks an item (captureType: 'pick')
 *   2. Manager/Director scores >= 85% (captureType: 'auto_score')
 *   3. User approves a gate (captureType: 'approval')
 *
 * Indexed by gate + niche for cross-project retrieval.
 * Used as few-shot examples in future gate runs.
 */
export interface GoldOutput {
  id: string;
  gateId: string;
  niche: string;
  funnel: string;                    // FunnelType or 'any'
  language: string;                  // target language
  sectionPath: string;               // e.g. "hooks", "headlines", "body_copies"
  content: string;                   // the actual validated text/JSON
  contentPreview: string;            // first 200 chars for display
  sourceProjectId: string;
  sourceProjectName: string;
  captureType: 'pick' | 'auto_score' | 'approval';
  score?: number;                    // manager/director score if auto-captured
  createdAt: string;
}

/**
 * LearningProfile — single evolving document per user.
 * Tracks style preferences, approval rates, and rejection patterns.
 * Injected into prompts as "USER PREFERENCES" so agents calibrate
 * their output to what the human actually wants.
 */
export interface LearningProfile {
  id: string;                        // always 'default'
  version: number;

  // Style preferences extracted from picks (per gate)
  styleSignals: {
    avgPickLength: Record<string, number>;         // gateId -> avg char count
    toneKeywords: Record<string, string[]>;        // gateId -> ["bold", "direct"]
  };

  // Performance tracking
  totalApprovals: number;
  totalRejections: number;
  rejectionReasons: string[];        // last 10, FIFO

  updatedAt: string;
}

/** Default empty profile */
export function createDefaultProfile(): LearningProfile {
  return {
    id: 'default',
    version: 1,
    styleSignals: {
      avgPickLength: {},
      toneKeywords: {},
    },
    totalApprovals: 0,
    totalRejections: 0,
    rejectionReasons: [],
    updatedAt: new Date().toISOString(),
  };
}
