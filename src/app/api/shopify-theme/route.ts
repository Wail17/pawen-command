// ============================================================
// PAWEN — /api/shopify-theme — Pull theme files from Shopify Admin API
//
// MODES:
//   { mode: "list", storeUrl, accessToken }
//     → returns { themes: [{ id, name, role }] }
//
//   { mode: "download", storeUrl, accessToken, themeId }
//     → returns { files: [{ path, content, type, size }] }
//
// Requires: Shopify store URL + Admin API access token
// (Settings → Apps → Develop apps → create app → Admin API access)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

interface ShopifyAsset {
  key: string;
  value?: string;
  content_type?: string;
  size?: number;
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const body = await req.json();
  const { mode, storeUrl, accessToken } = body;

  if (!storeUrl || !accessToken) {
    return NextResponse.json(
      { message: 'storeUrl and accessToken required' },
      { status: 400 },
    );
  }

  // Normalize store URL
  const store = storeUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\.myshopify\.com$/, '');
  const apiBase = `https://${store}.myshopify.com/admin/api/2024-10`;

  const headers = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  try {
    if (mode === 'list') {
      const res = await fetch(`${apiBase}/themes.json`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { message: `Shopify API error: ${res.status}`, details: err.slice(0, 500) },
          { status: res.status },
        );
      }

      const data = await res.json();
      const themes = (data.themes || []).map((t: { id: number; name: string; role: string }) => ({
        id: t.id,
        name: t.name,
        role: t.role, // "main" = live theme
      }));

      return NextResponse.json({ themes });
    }

    if (mode === 'download') {
      const { themeId } = body;
      if (!themeId) {
        return NextResponse.json({ message: 'themeId required' }, { status: 400 });
      }

      // Fetch all assets for this theme
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
        .filter((key: string) => {
          // Only download editable files, skip binary assets
          return /\.(liquid|json|css|scss|js|svg)$/.test(key);
        });

      // Fetch each asset's content (parallel, batched)
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
    }

    return NextResponse.json(
      { message: 'Invalid mode. Use "list" or "download".' },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
