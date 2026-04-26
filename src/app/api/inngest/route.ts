// ============================================================
// PAWEN — Inngest webhook endpoint
//
// Inngest's cloud control plane invokes this URL to:
//   - PUT  /api/inngest    — register/sync our function definitions
//   - POST /api/inngest    — execute a step run (one HTTP call per step)
//   - GET  /api/inngest    — health probe
//
// `serve()` handles signature verification (INNGEST_SIGNING_KEY).
// Each POST runs ONE step from the function — that's what gives us
// fresh function-duration budget per step.
// ============================================================

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { avatarExcavationFn } from '@/lib/inngest/functions/avatarExcavation';
import { zombieReaperFn } from '@/lib/inngest/functions/zombieReaper';

// Each step gets the full Vercel Pro maxDuration. Most steps run far
// shorter (LLM phases ~120-180s) but the fetch step on rich niches
// can push 540s with Reddit posts + comments serial.
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [avatarExcavationFn, zombieReaperFn],
});
