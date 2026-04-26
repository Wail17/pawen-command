// ============================================================
// PAWEN — Inngest client (singleton)
//
// All long-running pipeline jobs (avatar excavation, deep dive, etc.)
// are dispatched through Inngest. Each step.run() block runs in its
// own Vercel function call with a fresh duration budget — sidesteps
// the 800s single-function cap that broke the previous worker design.
//
// Env (auto-set by Vercel Marketplace integration):
//   INNGEST_EVENT_KEY    — for sending events from /api routes
//   INNGEST_SIGNING_KEY  — for verifying webhook signatures in /api/inngest
// ============================================================

import 'server-only';
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'pawen-command-center' });

// Centralized event-name constants so callers can't typo them.
export const EVENTS = {
  AVATAR_EXCAVATION_START: 'avatar/excavation.start',
} as const;
