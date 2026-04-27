// ============================================================
// PAWEN — Inngest worker (Railway-hosted, long-running)
//
// Runs the avatar excavation pipeline as an Inngest connect()
// worker — persistent WebSocket to Inngest cloud, no platform
// HTTP timeouts. Replaces the Vercel /api/inngest serve() handler
// that kept hitting the 800s function-duration cap on rich niches.
//
// Per Inngest docs (https://www.inngest.com/docs/setup/connect):
//   "Step execution is not bound by platform http timeouts."
//
// Railway gives us a long-running Node.js server. Each step.run()
// inside the avatar excavation function can run as long as needed
// (Anthropic compile cascade, BD scraping, etc).
//
// Required env vars (set in Railway dashboard):
//   INNGEST_EVENT_KEY     — auto-set when Inngest app is registered
//   INNGEST_SIGNING_KEY   — auto-set when Inngest app is registered
//   DATABASE_URL          — Neon pooled URL (same as Vercel)
//   ANTHROPIC_API_KEY
//   BRIGHTDATA_API_KEY
//   BRIGHTDATA_DATASET_ID_REDDIT_POSTS, _COMMENTS, etc.
//   VOYAGE_API_KEY
//   EXA_API_KEY
//   FIRECRAWL_API_KEY
//   BLOB_READ_WRITE_TOKEN
//   META_ACCESS_TOKEN, FAL_AI_API_KEY (optional)
//   NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1
//   FORCE_TWO_PASS_COMPILE=1 (recommended)
//   DISABLE_GAP_FILL=1 (recommended)
//   DISABLE_SOURCE_DOUBLING=1 (recommended)
//   BRIGHTDATA_DISABLE_YOUTUBE_COMMENTS=1 (optional, schema unverified)
//   PAWEN_BASE_URL        — https://pawen-command-center.vercel.app
//                            (the worker calls this for /api/scraping/fetch
//                             /api/avatars/dedup-items /api/avatars/rerank-items
//                             /api/generate). Worker-only env, used to forward
//                             internal HTTP calls.
//   PAWEN_INTERNAL_TOKEN  — short-lived signed session token the worker
//                            attaches to internal calls. Generated client-side
//                            from SESSION_SECRET.
//   SESSION_SECRET        — same value as Vercel; lets the worker sign its
//                            own session for internal calls (avoids needing
//                            a real user cookie).
// ============================================================

// Force verbose Inngest SDK logging before importing anything that uses it.
process.env.INNGEST_LOG_LEVEL = process.env.INNGEST_LOG_LEVEL ?? 'debug';

import { connect } from 'inngest/connect';
import type { Inngest } from 'inngest';
import { workerInngest } from './inngest-client';
import { avatarExcavationFn } from '../src/lib/inngest/functions/avatarExcavation';
import { zombieReaperFn } from '../src/lib/inngest/functions/zombieReaper';

const INSTANCE_ID = process.env.INSTANCE_ID
  ?? process.env.RAILWAY_REPLICA_ID
  ?? `pawen-worker-${Math.random().toString(36).slice(2, 10)}`;

// Diagnostic: confirm critical env at boot (mask secrets).
const mask = (v: string | undefined) => (v ? `${v.slice(0, 12)}…(${v.length}c)` : 'MISSING');
console.log(`[worker] starting Inngest connect — instance=${INSTANCE_ID}`);
console.log(`[worker] functions: avatar-excavation, zombie-reaper`);
console.log(`[worker] env check:`);
console.log(`  INNGEST_EVENT_KEY    = ${mask(process.env.INNGEST_EVENT_KEY)}`);
console.log(`  INNGEST_SIGNING_KEY  = ${mask(process.env.INNGEST_SIGNING_KEY)}`);
console.log(`  INNGEST_BASE_URL     = ${process.env.INNGEST_BASE_URL ?? '(default)'}`);
console.log(`  INNGEST_DEV          = ${process.env.INNGEST_DEV ?? '(unset)'}`);
console.log(`  INNGEST_LOG_LEVEL    = ${process.env.INNGEST_LOG_LEVEL}`);
console.log(`  app id               = ${(workerInngest as unknown as { id?: string }).id ?? '(unknown)'}`);

let connection;
try {
  connection = await connect({
    apps: [
      {
        client: workerInngest as unknown as Inngest.Any,
        functions: [avatarExcavationFn, zombieReaperFn],
      },
    ],
    instanceId: INSTANCE_ID,
    maxWorkerConcurrency: 4,
  });
} catch (err) {
  console.error(`[worker] connect() threw at boot:`, err);
  if (err instanceof Error) {
    console.error(`  name:    ${err.name}`);
    console.error(`  message: ${err.message}`);
    console.error(`  stack:   ${err.stack}`);
  }
  process.exit(1);
}

console.log(`[worker] connected to Inngest cloud`);

// Graceful shutdown: drain in-flight steps before exiting.
async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, closing Inngest connection...`);
  try {
    await connection.close();
    console.log(`[worker] connection closed cleanly`);
    process.exit(0);
  } catch (err) {
    console.error(`[worker] error during shutdown:`, err);
    process.exit(1);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Keep the process alive — connect() returns once the connection is up.
// The Promise from connection.closed resolves when the connection terminates.
await connection.closed;
console.log(`[worker] connection terminated, exiting`);
process.exit(0);
