// ============================================================
// PAWEN — Shopify OAuth: Step 2 — Exchange code for access token
//
// GET /api/shopify-oauth/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
//   → verifies HMAC from Shopify
//   → exchanges code for permanent access token
//   → stores encrypted token in httpOnly cookie
//   → redirects back to theme editor
//
// Requires env: SHOPIFY_API_KEY, SHOPIFY_API_SECRET
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

// No requireSession — this is a redirect FROM Shopify after OAuth consent.
// Security: Shopify HMAC verification + state parameter integrity.

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const shop = req.nextUrl.searchParams.get('shop');
    const stateParam = req.nextUrl.searchParams.get('state');
    const hmac = req.nextUrl.searchParams.get('hmac');

    if (!code || !shop || !stateParam) {
      return NextResponse.json({ message: 'Missing OAuth parameters', params: { code: !!code, shop: !!shop, state: !!stateParam } }, { status: 400 });
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ message: 'SHOPIFY_API_KEY or SHOPIFY_API_SECRET not configured' }, { status: 500 });
    }

    // Verify HMAC from Shopify (primary security measure)
    if (hmac) {
      const params = new URLSearchParams(req.nextUrl.search);
      params.delete('hmac');
      params.sort();
      const message = params.toString();
      const computed = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hmac, 'hex'))) {
        return NextResponse.json({ message: 'HMAC validation failed' }, { status: 403 });
      }
    }

    // Parse state (carries projectId)
    let state: { nonce?: string; projectId?: string; shop?: string };
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    } catch {
      return NextResponse.json({ message: 'Invalid state parameter' }, { status: 400 });
    }

    // Exchange code for permanent access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return NextResponse.json(
        { message: `Token exchange failed: ${tokenRes.status}`, details: err.slice(0, 500) },
        { status: tokenRes.status },
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;

    if (!accessToken) {
      return NextResponse.json({ message: 'No access token in Shopify response', data: tokenData }, { status: 500 });
    }

    // Encrypt the token for cookie storage
    const encryptedToken = encryptToken(accessToken, apiSecret);

    // Redirect back to theme editor
    const appUrl = process.env.SHOPIFY_APP_URL || 'https://sykss-agency.vercel.app';
    const projectId = state.projectId || '';
    const redirectUrl = projectId
      ? `${appUrl}/project/${projectId}/theme-editor`
      : appUrl;

    const response = NextResponse.redirect(redirectUrl);

    // Store encrypted token + shop in httpOnly cookie (30 days)
    response.cookies.set('shopify-connection', JSON.stringify({
      shop,
      token: encryptedToken,
    }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    // Clear nonce cookie if it exists
    response.cookies.delete('shopify-oauth-nonce');

    return response;
  } catch (err) {
    // Catch-all — return JSON so we get a readable error, not an HTML error page
    const message = err instanceof Error ? err.message : 'Unknown callback error';
    const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    return NextResponse.json({ message, stack }, { status: 500 });
  }
}

// AES-256-GCM encryption for cookie storage
function encryptToken(token: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

// Exported for use by shopify-oauth/status route
export function decryptToken(encryptedToken: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest();
  const data = Buffer.from(encryptedToken, 'base64url');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
