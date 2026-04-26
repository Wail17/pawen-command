// ============================================================
// PAWEN — Bright Data shared helpers
// Every Bright Data adapter (Reddit, Quora, TikTok, YouTube,
// Instagram, Amazon) goes through the same trigger → poll pattern.
// Centralized here.
// ============================================================

import 'server-only';
import { ProviderError, type ProviderHealth } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const BD_BASE = 'https://api.brightdata.com/datasets/v3';
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS  = 600_000;   // 10 min — BD datasets pile up jobs server-side; data is ready, we just need to keep polling. Caller can override per-call.

interface TriggerOk {
  snapshot_id?: string;
  error?: string;
}

/**
 * Trigger a Bright Data dataset collection and poll for completion.
 * `inputs` is the JSON body the dataset's trigger endpoint expects.
 * `discoverBy` is REQUIRED by most BD datasets (e.g. 'keyword',
 * 'subreddit_url', 'post_url', 'hashtag_url', 'profile_url'). The
 * specific value depends on the dataset.
 * Returns parsed rows on success. Throws ProviderError on failure.
 */
export async function brightDataCollect<T = unknown>(opts: {
  providerId: string;
  datasetId: string;
  inputs: unknown;
  discoverBy?: string;
  timeoutMs?: number;
  type?: 'discover_new' | 'discover_url' | 'collect_data' | 'url_collection';
}): Promise<T[]> {
  // Master kill switch — set BRIGHTDATA_KILL_SWITCH=1 to stop ALL BD spend.
  if (process.env.BRIGHTDATA_KILL_SWITCH === '1') {
    throw new ProviderError('Bright Data calls disabled by BRIGHTDATA_KILL_SWITCH', opts.providerId);
  }
  const key = requireEnv('BRIGHTDATA_API_KEY');
  if (!key) throw new ProviderError('BRIGHTDATA_API_KEY not configured', opts.providerId);
  // Cap inputs at 20 hard — defensive bound across every adapter
  const inputArr = Array.isArray(opts.inputs) ? opts.inputs : [opts.inputs];
  if (inputArr.length > 20) {
    throw new ProviderError(`Bright Data: too many inputs (${inputArr.length} > 20 hard cap)`, opts.providerId);
  }

  const params = new URLSearchParams({
    dataset_id: opts.datasetId,
    include_errors: 'true',
    type: opts.type ?? 'discover_new',
  });
  if (opts.discoverBy) params.set('discover_by', opts.discoverBy);
  const triggerUrl = `${BD_BASE}/trigger?${params.toString()}`;
  const triggerRes = await fetchWithTimeout(triggerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(opts.inputs),
    timeoutMs: 30_000,
  });
  if (!triggerRes) throw new ProviderError('Bright Data trigger network failure', opts.providerId, undefined, true);
  if (!triggerRes.ok) {
    const text = await triggerRes.text().catch(() => '');
    throw new ProviderError(`Bright Data trigger ${triggerRes.status}: ${text.slice(0, 1500)}`, opts.providerId, triggerRes.status, triggerRes.status >= 500);
  }
  const trigger = (await triggerRes.json()) as TriggerOk;
  if (trigger.error) throw new ProviderError(`Bright Data: ${trigger.error}`, opts.providerId);
  const snapshotId = trigger.snapshot_id;
  if (!snapshotId) throw new ProviderError('Bright Data: no snapshot_id returned', opts.providerId);

  const deadline = Date.now() + (opts.timeoutMs ?? POLL_TIMEOUT_MS);
  while (Date.now() < deadline) {
    const res = await fetchWithTimeout(`${BD_BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      timeoutMs: 15_000,
    });
    if (!res) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (res.status === 202) {
      // still running
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Bright Data snapshot ${res.status}: ${text.slice(0, 200)}`, opts.providerId, res.status);
    }
    const data = await res.json();
    const rows = Array.isArray(data) ? (data as T[]) : [];
    // Surface cost on every call — $1.50/1000 records is the catalog price.
    if (rows.length > 0) {
      const estCost = (rows.length / 1000) * 1.5;
      console.log(`[${opts.providerId}] BD snapshot ${snapshotId}: ${rows.length} records (~$${estCost.toFixed(3)})`);
      if (rows.length > 10_000) {
        console.error(`[${opts.providerId}] CRITICAL: ${rows.length} records returned — this snapshot cost ~$${estCost.toFixed(2)}`);
      }
    }
    return rows;
  }
  throw new ProviderError(`Bright Data snapshot timeout (${POLL_TIMEOUT_MS}ms)`, opts.providerId, 504, true);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function brightDataHealth(providerId: string, extraEnv: string[] = []): Promise<ProviderHealth> {
  return Promise.resolve(missingEnvHealth(providerId, ['BRIGHTDATA_API_KEY', ...extraEnv]));
}

export const BD_NOW = nowIso;
