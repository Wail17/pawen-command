// ============================================================
// PAWEN — Inngest webhook endpoint (drained — CONNECT-only mode)
//
// All Pawen Inngest functions now live on the long-running Railway
// worker (`worker/index.ts`) which uses `connect()` over WebSocket.
// We keep this route around so Inngest's HTTP control plane can still
// PUT-sync the app (zero functions registered here) and so existing
// inbound webhook URLs don't 404 — but no functions execute on Vercel
// anymore, eliminating the 800s function-duration cap that was
// killing rich-niche compile passes.
// ============================================================

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
