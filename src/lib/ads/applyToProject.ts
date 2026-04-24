// ============================================================
// PAWEN — Apply CSV insights to a Project
// Converts AdRollups (from insightExtractor) into AdPerformance
// entries that the agent prompt builder consumes.
// ============================================================

import type { Project, AdPerformance } from '../types';
import type { AdRollup } from './insightExtractor';

const SAFE_NUM = (n: number) => Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;

/**
 * Build AdPerformance entries from rollups. Entries are tagged with
 * `source: 'csv'` so we can de-dupe / replace cleanly on re-upload.
 */
export function rollupsToAdPerformance(rollups: AdRollup[], dateRange: string): AdPerformance[] {
  return rollups
    .filter(r => r.spend > 0)
    .map(r => ({
      id: `csv_${r.name.replace(/\s+/g, '_').slice(0, 40)}_${Date.now()}`,
      adName: r.name,
      funnel: r.funnel ?? 'unknown',
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: SAFE_NUM(r.ctr),
      cpc: SAFE_NUM(r.cpc),
      cpa: SAFE_NUM(r.cpa === Infinity ? 0 : r.cpa),
      roas: SAFE_NUM(r.roas),
      spend: SAFE_NUM(r.spend),
      conversions: r.conversions,
      dateRange,
      notes: r.verdictReason,
      addedAt: new Date().toISOString(),
      hookType: r.hookType,
      formatType: r.formatType,
      angle: r.angle,
      awareness: r.awareness,
      verdict: r.verdict,
      source: 'csv' as const,
    }));
}

/**
 * Replace all CSV-sourced AdPerformance entries on a project with a fresh
 * batch (manual entries are preserved). Returns the updated project.
 */
export function mergeCsvPerformance(project: Project, fresh: AdPerformance[]): Project {
  const manual = (project.adPerformance ?? []).filter(a => a.source !== 'csv');
  return {
    ...project,
    adPerformance: [...manual, ...fresh],
    updatedAt: new Date().toISOString(),
  };
}
