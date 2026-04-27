// ============================================================
// PAWEN — Bright Data shared helpers
// Every Bright Data adapter (Reddit, Quora, TikTok, YouTube,
// Instagram, Amazon) goes through the same trigger → poll pattern.
// Centralized here.
// ============================================================

import 'server-only';
import { ProviderError, type ProviderHealth } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';
import {
  computeCacheKey,
  ensureBdSchema,
  insertPendingSnapshot,
  lookupCachedSnapshot,
  readSnapshotData,
  recordSnapshotDelivery,
} from './brightDataCache';

const BD_BASE = 'https://api.brightdata.com/datasets/v3';
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS  = 600_000;   // 10 min — BD datasets pile up jobs server-side; data is ready, we just need to keep polling. Caller can override per-call.
const FALLBACK_POLL_EVERY_N_TICKS = 8; // ~32s between direct BD pollchecks when in webhook mode

interface TriggerOk {
  snapshot_id?: string;
  error?: string;
}

/**
 * Resolves the public host BrightData should call back. Caller order:
 *   1. BRIGHTDATA_WEBHOOK_HOST (explicit override, e.g. https://sykss-agency.vercel.app)
 *   2. NEXT_PUBLIC_BASE_URL (typically set in .env.local)
 *   3. VERCEL_PROJECT_PRODUCTION_URL (auto-set on Vercel deploys, no scheme)
 *   4. VERCEL_URL (auto-set, also no scheme)
 * Returns null when no webhook host is resolvable — caller falls back
 * to direct BD polling.
 */
function resolveWebhookHost(): string | null {
  const explicit = process.env.BRIGHTDATA_WEBHOOK_HOST;
  if (explicit && explicit.length > 0) return explicit.replace(/\/+$/, '');
  const pub = process.env.NEXT_PUBLIC_BASE_URL;
  if (pub && pub.length > 0) return pub.replace(/\/+$/, '');
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod && prod.length > 0) return `https://${prod.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.length > 0) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return null;
}

/**
 * Trigger a Bright Data dataset collection and return rows.
 *
 * Architecture (post-150€-incident — see plan file):
 *   1. Compute cache_key from inputs. Look up bd_snapshot_cache for a
 *      completed snapshot in the last 30 min — return immediately on
 *      cache hit ($0 BD spend on retried Inngest steps).
 *   2. Build trigger URL. If BRIGHTDATA_WEBHOOK_SECRET + webhook host
 *      are configured, append `?webhook=...&webhook_header_Authorization
 *      =Bearer+SECRET&format=json&uncompressed_webhook=true` so BD
 *      POSTs the rows to /api/scraping/bd-webhook when ready.
 *   3. POST trigger, get snapshot_id, INSERT pending row.
 *   4. Poll the LOCAL DB for `data IS NOT NULL` (cheap, no BD calls).
 *      Every ~32s also poll BD direct as a webhook-drop safety net.
 *   5. On success, also persist via recordSnapshotDelivery (so other
 *      callers waiting on the same cache_key see it instantly).
 *
 * Drop-in compatible with the previous signature. If no webhook
 * secret is configured, we fall back to the original direct-poll
 * pattern (still benefits from idempotency via cache_key lookup).
 */
export async function brightDataCollect<T = unknown>(opts: {
  providerId: string;
  datasetId: string;
  inputs: unknown;
  discoverBy?: string;
  timeoutMs?: number;
  type?: 'discover_new' | 'discover_url' | 'collect_data' | 'url_collection';
  /** Cap records returned per input (BD-side hard limit — affects billing). */
  limitPerInput?: number;
  /** Cap multiple records (BD-side hard limit — affects billing for some datasets). */
  limitMultipleResults?: number;
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

  // ── 1. Idempotency: was this exact request just completed? ──────────
  const cacheKey = await computeCacheKey({
    datasetId: opts.datasetId,
    type: opts.type,
    discoverBy: opts.discoverBy,
    inputs: opts.inputs,
  });
  // ensureBdSchema is a no-op after the first call (memoized promise).
  await ensureBdSchema().catch(e => {
    console.warn(`[${opts.providerId}] bd_snapshot_cache schema check failed (continuing): ${e instanceof Error ? e.message : String(e)}`);
  });
  const cached = await lookupCachedSnapshot<T>({ cacheKey, maxAgeMinutes: 30 }).catch(() => null);
  if (cached) {
    console.log(`[${opts.providerId}] BD cache hit ${cached.snapshotId}: ${cached.rows.length} rows ($0 BD spend)`);
    return cached.rows;
  }

  // ── 2. Build trigger URL (with webhook params if configured) ────────
  const params = new URLSearchParams({
    dataset_id: opts.datasetId,
    include_errors: 'true',
    type: opts.type ?? 'discover_new',
  });
  if (opts.discoverBy) params.set('discover_by', opts.discoverBy);
  // BD-side hard caps. These reduce records BD scrapes (and therefore bills),
  // not just what we keep client-side. Without these, an Amazon search that
  // matches 320 products is billed at 320 even if we slice to 4.
  if (opts.limitPerInput !== undefined) params.set('limit_per_input', String(opts.limitPerInput));
  if (opts.limitMultipleResults !== undefined) params.set('limit_multiple_results', String(opts.limitMultipleResults));

  const webhookSecret = process.env.BRIGHTDATA_WEBHOOK_SECRET;
  const webhookHost = resolveWebhookHost();
  const webhookEnabled = !!(webhookSecret && webhookHost);
  if (webhookEnabled) {
    // Encode cache_key in our webhook URL so the receiver can match
    // the pending row even if BD doesn't preserve query params.
    const webhookUrl = `${webhookHost}/api/scraping/bd-webhook?ck=${encodeURIComponent(cacheKey)}&dataset_id=${encodeURIComponent(opts.datasetId)}`;
    params.set('endpoint', webhookUrl);                   // some BD docs use `endpoint`
    params.set('webhook', webhookUrl);                    // others use `webhook` — set both
    params.set('format', 'json');
    params.set('uncompressed_webhook', 'true');
    params.set('webhook_header_Authorization', `Bearer ${webhookSecret}`);
  }
  const triggerUrl = `${BD_BASE}/trigger?${params.toString()}`;

  // ── 3. POST trigger ─────────────────────────────────────────────────
  const triggerRes = await fetchWithTimeout(triggerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(opts.inputs),
    timeoutMs: 30_000,
  });
  if (!triggerRes) {
    recordBrightDataFailure(opts.providerId, undefined);
    throw new ProviderError(`BrightData ${opts.providerId} trigger network failure (dataset=${opts.datasetId})`, opts.providerId, undefined, true);
  }
  if (!triggerRes.ok) {
    const text = await triggerRes.text().catch(() => '');
    recordBrightDataFailure(opts.providerId, triggerRes.status);
    throw new ProviderError(
      `BrightData ${opts.providerId} trigger HTTP ${triggerRes.status} (dataset=${opts.datasetId}): ${text.slice(0, 500)}`,
      opts.providerId,
      triggerRes.status,
      triggerRes.status >= 500,
    );
  }
  const trigger = (await triggerRes.json()) as TriggerOk;
  if (trigger.error) {
    recordBrightDataFailure(opts.providerId, undefined);
    throw new ProviderError(`BrightData ${opts.providerId} (dataset=${opts.datasetId}): ${trigger.error}`, opts.providerId);
  }
  const snapshotId = trigger.snapshot_id;
  if (!snapshotId) {
    recordBrightDataFailure(opts.providerId, undefined);
    throw new ProviderError(`BrightData ${opts.providerId} (dataset=${opts.datasetId}): no snapshot_id returned`, opts.providerId);
  }

  // ── 4. Persist pending row, then poll ──────────────────────────────
  await insertPendingSnapshot({ snapshotId, datasetId: opts.datasetId, cacheKey }).catch(e => {
    console.warn(`[${opts.providerId}] failed to insert pending snapshot row (continuing with poll): ${e instanceof Error ? e.message : String(e)}`);
  });

  const deadline = Date.now() + (opts.timeoutMs ?? POLL_TIMEOUT_MS);
  let tick = 0;
  let lastDirectPollAt = 0;
  while (Date.now() < deadline) {
    tick++;
    // 4a. Cheap local DB check — fed by the webhook receiver.
    if (webhookEnabled) {
      const fromCache = await readSnapshotData<T>(snapshotId).catch(() => null);
      if (fromCache !== null) {
        if (fromCache.length > 0) {
          const estCost = (fromCache.length / 1000) * 1.5;
          console.log(`[${opts.providerId}] BD snapshot ${snapshotId} via webhook: ${fromCache.length} rows (~$${estCost.toFixed(3)})`);
        }
        return fromCache;
      }
    }
    // 4b. Direct BD poll — primary path when webhook is off, safety
    //     net when webhook is on (every ~32s, so ~28x cheaper than
    //     polling every 4s).
    const shouldDirectPoll = !webhookEnabled || (tick % FALLBACK_POLL_EVERY_N_TICKS === 0);
    if (shouldDirectPoll && Date.now() - lastDirectPollAt > 8_000) {
      lastDirectPollAt = Date.now();
      const res = await fetchWithTimeout(`${BD_BASE}/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
        timeoutMs: 15_000,
      });
      if (res) {
        if (res.status === 202) {
          // still running, continue loop
        } else if (!res.ok) {
          const text = await res.text().catch(() => '');
          recordBrightDataFailure(opts.providerId, res.status);
          throw new ProviderError(
            `BrightData ${opts.providerId} snapshot HTTP ${res.status} (dataset=${opts.datasetId}, snapshot=${snapshotId}): ${text.slice(0, 300)}`,
            opts.providerId,
            res.status,
          );
        } else {
          const data = await res.json();
          const rows = Array.isArray(data) ? (data as T[]) : [];
          if (rows.length > 0) {
            const estCost = (rows.length / 1000) * 1.5;
            console.log(`[${opts.providerId}] BD snapshot ${snapshotId}: ${rows.length} records (~$${estCost.toFixed(3)})`);
            if (rows.length > 10_000) {
              console.error(`[${opts.providerId}] CRITICAL: ${rows.length} records returned — this snapshot cost ~$${estCost.toFixed(2)}`);
            }
          }
          // Persist into the cache so concurrent / future callers see it.
          await recordSnapshotDelivery({
            snapshotId,
            cacheKey,
            datasetId: opts.datasetId,
            data: rows,
            source: 'fallback-poll',
          }).catch(() => {});
          return rows;
        }
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  recordBrightDataFailure(opts.providerId, 504);
  throw new ProviderError(`BrightData ${opts.providerId} snapshot timeout (${POLL_TIMEOUT_MS}ms, dataset=${opts.datasetId})`, opts.providerId, 504, true);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Module-scope cache of the most recent BD failure per providerId. Used by
// `brightDataHealth` so the registry's pickHealthy() can fall back to a
// non-BD provider when quota is exhausted (HTTP 402) or auth is broken
// (HTTP 401/403). Without this, isHealthy() only checks the env var and
// always returns ok=true even when BD is rejecting every call.
interface RecentFailure {
  status: number | undefined;
  ts: number;
}
const FAILURE_TTL_MS = 60_000;
const recentFailures = new Map<string, RecentFailure>();

export function recordBrightDataFailure(providerId: string, status: number | undefined): void {
  recentFailures.set(providerId, { status, ts: Date.now() });
}

export function brightDataHealth(providerId: string, extraEnv: string[] = []): Promise<ProviderHealth> {
  const envHealth = missingEnvHealth(providerId, ['BRIGHTDATA_API_KEY', ...extraEnv]);
  if (!envHealth.ok) return Promise.resolve(envHealth);

  const recent = recentFailures.get(providerId);
  if (recent && Date.now() - recent.ts < FAILURE_TTL_MS) {
    // Treat hard auth/quota failures as unhealthy so the registry tries the
    // next provider. Network/5xx/timeouts (status undefined or >= 500) stay
    // healthy so we don't flap on transient blips.
    const s = recent.status;
    if (s === 401 || s === 402 || s === 403 || s === 429) {
      return Promise.resolve({
        ok: false,
        message: `BrightData ${providerId}: recent HTTP ${s} (auth/quota) — using fallback provider`,
        lastCheckedAt: nowIso(),
      });
    }
  }
  return Promise.resolve(envHealth);
}

export const BD_NOW = nowIso;
