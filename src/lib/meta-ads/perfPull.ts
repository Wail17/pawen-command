// ============================================================
// PAWEN — Phase U.3a — Meta Graph API performance pull
//
// Server-only. Pulls daily insights for a given campaign_id using
// META_ACCESS_TOKEN. Normalizes to a flat snapshot shape. Does not
// touch Postgres — caller handles persistence.
// ============================================================

import 'server-only';

export interface MetaPerfSnapshot {
  campaignId: string;
  datePreset: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;                // 0-100 (%)
  cpc: number;
  cpm: number;
  frequency: number;
  conversions: number;        // purchases
  conversionValue: number;    // revenue USD
  cpa: number;
  roas: number;
  pulledAt: string;
}

interface MetaInsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

interface MetaInsightsResponse {
  data?: MetaInsightsRow[];
  error?: { message: string; type: string; code: number };
}

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0';

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractAction(rows: Array<{ action_type: string; value: string }> | undefined, preferredTypes: string[]): number {
  if (!Array.isArray(rows)) return 0;
  for (const type of preferredTypes) {
    const hit = rows.find(r => r.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
}

/**
 * Pull yesterday's insights for a single campaign. Uses date_preset=yesterday
 * so we get a stable daily window. Returns null if the API rejects the call
 * (invalid token, permission, unknown campaign).
 */
export async function fetchMetaCampaignInsights(
  campaignId: string,
  accessToken: string,
  datePreset: 'today' | 'yesterday' | 'last_3d' | 'last_7d' = 'yesterday',
): Promise<MetaPerfSnapshot | null> {
  const fields = [
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'frequency',
    'actions',
    'action_values',
  ].join(',');

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(campaignId)}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${encodeURIComponent(accessToken)}`;

  let json: MetaInsightsResponse;
  try {
    const res = await fetch(url, { method: 'GET' });
    json = (await res.json()) as MetaInsightsResponse;
    if (!res.ok || json.error) {
      console.warn(`[meta-perf] insights failed for ${campaignId}: ${json.error?.message ?? res.status}`);
      return null;
    }
  } catch (err) {
    console.warn(`[meta-perf] fetch threw for ${campaignId}:`, err);
    return null;
  }

  const row = json.data?.[0];
  if (!row) {
    return {
      campaignId,
      datePreset,
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      frequency: 0,
      conversions: 0,
      conversionValue: 0,
      cpa: 0,
      roas: 0,
      pulledAt: new Date().toISOString(),
    };
  }

  const spend = num(row.spend);
  const conversions = extractAction(row.actions, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']);
  const conversionValue = extractAction(row.action_values, ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']);
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? conversionValue / spend : 0;

  return {
    campaignId,
    datePreset,
    spend,
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    ctr: num(row.ctr),
    cpc: num(row.cpc),
    cpm: num(row.cpm),
    frequency: num(row.frequency),
    conversions,
    conversionValue,
    cpa,
    roas,
    pulledAt: new Date().toISOString(),
  };
}

// --- Drop detection ---

export type DropSeverity = 'none' | 'info' | 'warn' | 'critical';

export interface DropVerdict {
  severity: DropSeverity;
  ctrDropPct: number;      // 0-100, positive = drop
  cpaRisePct: number;      // 0-100, positive = rise
  roasRatio: number;       // current/baseline
  reason: string;
}

/**
 * Compare a fresh 2h-like window against a longer baseline window.
 * INFO: CTR drop 0-10% OR CPA rise 0-15%
 * WARN: CTR drop 10-20% OR CPA rise 15-30%
 * CRITICAL: CTR drop >20% OR CPA rise >30% OR ROAS <0.8× baseline
 */
export function detectDrop(current: MetaPerfSnapshot, baseline: MetaPerfSnapshot): DropVerdict {
  const ctrCur = current.ctr;
  const ctrBase = baseline.ctr;
  const cpaCur = current.cpa;
  const cpaBase = baseline.cpa;
  const roasCur = current.roas;
  const roasBase = baseline.roas;

  const ctrDropPct = ctrBase > 0 ? Math.max(0, ((ctrBase - ctrCur) / ctrBase) * 100) : 0;
  const cpaRisePct = cpaBase > 0 ? Math.max(0, ((cpaCur - cpaBase) / cpaBase) * 100) : 0;
  const roasRatio = roasBase > 0 ? roasCur / roasBase : 1;

  let severity: DropSeverity = 'none';
  const reasons: string[] = [];

  if (ctrDropPct > 20 || cpaRisePct > 30 || (roasBase > 0 && roasRatio < 0.8)) {
    severity = 'critical';
    if (ctrDropPct > 20) reasons.push(`CTR drop ${ctrDropPct.toFixed(1)}%`);
    if (cpaRisePct > 30) reasons.push(`CPA rise ${cpaRisePct.toFixed(1)}%`);
    if (roasBase > 0 && roasRatio < 0.8) reasons.push(`ROAS ${roasRatio.toFixed(2)}× baseline`);
  } else if (ctrDropPct > 10 || cpaRisePct > 15) {
    severity = 'warn';
    if (ctrDropPct > 10) reasons.push(`CTR drop ${ctrDropPct.toFixed(1)}%`);
    if (cpaRisePct > 15) reasons.push(`CPA rise ${cpaRisePct.toFixed(1)}%`);
  } else if (ctrDropPct > 0 || cpaRisePct > 0) {
    severity = 'info';
    if (ctrDropPct > 0) reasons.push(`CTR drop ${ctrDropPct.toFixed(1)}%`);
    if (cpaRisePct > 0) reasons.push(`CPA rise ${cpaRisePct.toFixed(1)}%`);
  }

  return {
    severity,
    ctrDropPct,
    cpaRisePct,
    roasRatio,
    reason: reasons.join(' · ') || 'no delta',
  };
}
