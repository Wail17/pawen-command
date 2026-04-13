// ============================================================
// PAWEN — Shopify OAuth: Step 1 — Redirect to Shopify login
//
// GET /api/shopify-oauth/authorize?shop=mystore.myshopify.com&projectId=xxx
//   → 302 redirect to Shopify OAuth consent screen
//
// Requires env: SHOPIFY_API_KEY
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const shop = req.nextUrl.searchParams.get('shop');
  const projectId = req.nextUrl.searchParams.get('projectId');

  if (!shop) {
    return NextResponse.json({ message: 'shop parameter required' }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: 'SHOPIFY_API_KEY not configured. Create a Shopify Partner app first.' },
      { status: 500 },
    );
  }

  // Normalize shop domain
  const storeDomain = shop
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const normalizedShop = storeDomain.includes('.myshopify.com')
    ? storeDomain
    : `${storeDomain}.myshopify.com`;

  // Generate nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // State carries nonce + projectId so callback can redirect back
  const state = Buffer.from(JSON.stringify({ nonce, projectId, shop: normalizedShop })).toString('base64url');

  // Build callback URL — must exactly match the URL registered in Shopify Dev Dashboard
  const appUrl = process.env.SHOPIFY_APP_URL || 'https://sykss-agency.vercel.app';
  const redirectUri = `${appUrl}/api/shopify-oauth/callback`;

  // Shopify OAuth URL
  const scopes = 'read_themes,write_themes';
  const authUrl = `https://${normalizedShop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  // Set nonce cookie for CSRF verification in callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('shopify-oauth-nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  return response;
}
