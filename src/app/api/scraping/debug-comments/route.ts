// ============================================================
// Debug-only: directly trigger a Bright Data COMMENTS dataset
// with a known post URL and return the raw response. Used to
// figure out the actual response schema for each platform.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { brightDataCollect } from '@/lib/sources/providers/brightDataCommon';
import { ProviderError } from '@/lib/sources/providers/types';

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: { datasetId?: string; url?: string; discoverBy?: string; type?: 'url_collection' | 'discover_new'; extra?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: 'invalid JSON' }, { status: 400 }); }

  if (!body.datasetId || !body.url) {
    return NextResponse.json({ ok: false, message: 'datasetId + url required' }, { status: 400 });
  }

  try {
    const useUrlCollection = body.type === 'url_collection';
    const rows = await brightDataCollect<Record<string, unknown>>({
      providerId: 'debug-comments',
      datasetId: body.datasetId,
      inputs: [{ url: body.url, ...(body.extra ?? {}) }],
      discoverBy: useUrlCollection ? undefined : (body.discoverBy ?? 'post_url'),
      type: body.type ?? 'discover_new',
    });
    return NextResponse.json({
      ok: true,
      rowCount: rows.length,
      firstRowKeys: rows[0] ? Object.keys(rows[0]) : [],
      sample: rows.slice(0, 3),
    });
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json({
        ok: false,
        providerError: true,
        message: e.message,
        status: e.status,
        retriable: e.retriable,
      });
    }
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : String(e) });
  }
}
