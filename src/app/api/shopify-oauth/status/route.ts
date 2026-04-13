// ============================================================
// PAWEN — Shopify OAuth: Check connection status + list themes
//
// GET /api/shopify-oauth/status
//   → { connected: true, shop, themes: [...] } or { connected: false }
//
// POST /api/shopify-oauth/status  { mode: 'download', themeId }
//   → { files: [...] } — downloads theme files using stored token
//
// Uses encrypted access token from httpOnly cookie (set by OAuth callback)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { decryptToken } from '../callback/route';

interface ShopifyAsset {
  key: string;
  value?: string;
}

function getConnection(req: NextRequest): { shop: string; accessToken: string } | null {
  const cookie = req.cookies.get('shopify-connection')?.value;
  if (!cookie) return null;

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) return null;

  try {
    const { shop, token } = JSON.parse(cookie);
    const accessToken = decryptToken(token, apiSecret);
    return { shop, accessToken };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const conn = getConnection(req);
  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  const { shop, accessToken } = conn;
  const apiBase = `https://${shop}/admin/api/2024-10`;

  try {
    const res = await fetch(`${apiBase}/themes.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      // Token might be revoked
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ connected: false, reason: 'Token expired or revoked' });
      }
      return NextResponse.json({ connected: false, reason: `API error: ${res.status}` });
    }

    const data = await res.json();
    const themes = (data.themes || []).map((t: { id: number; name: string; role: string }) => ({
      id: t.id,
      name: t.name,
      role: t.role,
    }));

    return NextResponse.json({ connected: true, shop, themes });
  } catch {
    return NextResponse.json({ connected: false, reason: 'Connection failed' });
  }
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const conn = getConnection(req);
  if (!conn) {
    return NextResponse.json({ message: 'Not connected to Shopify' }, { status: 401 });
  }

  const body = await req.json();
  const { mode, themeId } = body;

  if (mode !== 'download' || !themeId) {
    return NextResponse.json({ message: 'mode=download and themeId required' }, { status: 400 });
  }

  const { shop, accessToken } = conn;
  const apiBase = `https://${shop}/admin/api/2024-10`;
  const headers = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  try {
    // List all assets
    const res = await fetch(`${apiBase}/themes/${themeId}/assets.json`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { message: `Failed to list assets: ${res.status}`, details: err.slice(0, 500) },
        { status: res.status },
      );
    }

    const data = await res.json();
    const assetKeys: string[] = (data.assets || [])
      .map((a: ShopifyAsset) => a.key)
      .filter((key: string) => /\.(liquid|json|css|scss|js|svg)$/.test(key));

    // Fetch each asset (batched)
    const files: Array<{ path: string; content: string; size: number }> = [];
    const batchSize = 5;

    for (let i = 0; i < assetKeys.length; i += batchSize) {
      const batch = assetKeys.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (key: string) => {
          try {
            const assetRes = await fetch(
              `${apiBase}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
              { headers, signal: AbortSignal.timeout(10_000) },
            );
            if (!assetRes.ok) return null;
            const assetData = await assetRes.json();
            const asset = assetData.asset;
            if (!asset?.value) return null;
            return {
              path: asset.key as string,
              content: asset.value as string,
              size: (asset.value as string).length,
            };
          } catch {
            return null;
          }
        }),
      );
      for (const r of results) {
        if (r) files.push(r);
      }
    }

    return NextResponse.json({ files, totalFiles: files.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}
