// ============================================================
// PAWEN — Worker-only Inngest client
//
// Distinct id from the Vercel serve() client so Inngest cloud
// registers this Railway worker as a SEPARATE app. Without this,
// both Vercel and Railway share id=pawen-command-center, Inngest
// treats them as one app, and "last sync wins" routes events
// to Vercel's sentinel handler instead of this worker.
// ============================================================
import { Inngest } from 'inngest';

export const workerInngest = new Inngest({
  id: 'pawen-command-center-worker',
  eventKey: process.env.INNGEST_EVENT_KEY,
  appVersion: process.env.RAILWAY_GIT_COMMIT_SHA ?? `manual-${Date.now()}`,
});
