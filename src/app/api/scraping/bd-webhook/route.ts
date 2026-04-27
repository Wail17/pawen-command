// ============================================================
// PAWEN — /api/scraping/bd-webhook
//
// Receives async snapshot deliveries from BrightData. Bound to a
// trigger via `?webhook=https://HOST/api/scraping/bd-webhook
// &webhook_header_Authorization=Bearer+SECRET&format=json
// &uncompressed_webhook=true` — see brightDataCommon.brightDataCollect.
//
// Auth: shared secret in the Authorization header (BD passes through
// the `webhook_header_Authorization` value verbatim). Without it,
// any caller could poison our snapshot cache.
//
// Response: must return 200 within 30s per BD's webhook contract.
// We do the minimum work synchronously (insert into bd_snapshot_cache)
// so the response is fast even on huge payloads.
// ============================================================

import 'server-only';
import { NextResponse } from 'next/server';
import { recordSnapshotDelivery } from '@/lib/sources/providers/brightDataCache';

// Webhook payloads can be huge (Reddit comment dumps run 5k+ rows).
// 800s gives plenty of room; the actual UPSERT should finish in <5s.
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  const secret = process.env.BRIGHTDATA_WEBHOOK_SECRET;
  if (!secret || secret.length === 0) {
    // Webhook never configured. Refuse cleanly rather than no-op.
    return NextResponse.json(
      { ok: false, message: 'BRIGHTDATA_WEBHOOK_SECRET not configured on this deployment' },
      { status: 503 },
    );
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!safeEqual(authHeader, expected)) {
    return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  // We always craft the webhook URL with `?ck=<cache_key>` so we can
  // match the pending row even when BD doesn't preserve `snapshot_id`.
  // BD MAY also append its own snapshot_id — use it as the primary
  // anchor when present.
  const cacheKey = url.searchParams.get('ck') ?? undefined;
  const snapshotIdParam = url.searchParams.get('snapshot_id') ?? undefined;
  const snapshotIdHeader = req.headers.get('x-brightdata-snapshot-id') ?? undefined;
  const snapshotId = snapshotIdParam || snapshotIdHeader || undefined;
  const datasetId = url.searchParams.get('dataset_id') ?? undefined;
  if (!snapshotId && !cacheKey) {
    return NextResponse.json(
      { ok: false, message: 'webhook URL must carry ?ck=<cache_key> (and optionally ?snapshot_id=)' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'invalid JSON body' }, { status: 400 });
  }
  const rows = Array.isArray(body) ? body : [];

  try {
    const result = await recordSnapshotDelivery({
      snapshotId,
      cacheKey,
      datasetId,
      data: rows,
      source: 'webhook',
    });
    console.log(`[bd-webhook] delivered ${rows.length} rows → snapshot=${result.snapshotId} matched=${result.matched}`);
    return NextResponse.json({ ok: true, snapshot_id: result.snapshotId, record_count: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bd-webhook] persist error: ${msg}`);
    // Return 500 so BD retries the webhook (built-in retry policy).
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
