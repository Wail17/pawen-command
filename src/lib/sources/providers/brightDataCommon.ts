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
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS  = 90_000;

interface TriggerOk {
  snapshot_id?: string;
  error?: string;
}

/**
 * Trigger a Bright Data dataset collection and poll for completion.
 * `inputs` is the JSON body the dataset's trigger endpoint expects.
 * Returns parsed rows on success. Throws ProviderError on failure.
 */
export async function brightDataCollect<T = unknown>(opts: {
  providerId: string;
  datasetId: string;
  inputs: unknown;
  timeoutMs?: number;
  type?: 'discover_new' | 'discover_url' | 'collect_data';
}): Promise<T[]> {
  const key = requireEnv('BRIGHTDATA_API_KEY');
  if (!key) throw new ProviderError('BRIGHTDATA_API_KEY not configured', opts.providerId);

  const triggerUrl = `${BD_BASE}/trigger?dataset_id=${encodeURIComponent(opts.datasetId)}&include_errors=true&type=${opts.type ?? 'discover_new'}`;
  const triggerRes = await fetchWithTimeout(triggerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(opts.inputs),
    timeoutMs: 30_000,
  });
  if (!triggerRes) throw new ProviderError('Bright Data trigger network failure', opts.providerId, undefined, true);
  if (!triggerRes.ok) {
    const text = await triggerRes.text().catch(() => '');
    throw new ProviderError(`Bright Data trigger ${triggerRes.status}: ${text.slice(0, 200)}`, opts.providerId, triggerRes.status, triggerRes.status >= 500);
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
    return Array.isArray(data) ? (data as T[]) : [];
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
