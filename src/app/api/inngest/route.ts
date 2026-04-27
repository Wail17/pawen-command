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

// `inngest/next` refuses to PUT-sync when functions: [] is empty (returns
// 500), which means Inngest cloud keeps the previous sync alive and would
// happily continue dispatching avatar-excavation to this URL — defeating
// the whole point of the migration. Registering one trivial sentinel
// function lets the sync go through cleanly and re-registers this app
// with NO real workload here. The real `avatar-excavation` and
// `zombie-reaper` functions live exclusively on the Railway connect
// worker (worker/index.ts) and are therefore the only place those
// function IDs are routable from now on.
const sentinelFn = inngest.createFunction(
  {
    id: 'pawen-vercel-sentinel',
    triggers: [{ event: 'pawen/__sentinel.never-fired' }],
    retries: 0,
  },
  async () => ({ ok: true }),
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sentinelFn],
});
