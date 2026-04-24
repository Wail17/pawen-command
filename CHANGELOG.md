# Phase U — Self-Learning Autonomous Agency

Released: 2026-04-24 (iterations 1-10 via ralph-loop)

## Summary

Pawen Command Center was refactored from a human-dependent pipeline with naïve runtime RAG and manual scraping into an autonomous multi-layer learning system. Three layers landed:

- **U.1 Distillation** — per-persona baked-in expertise corpus replaces runtime training-chunk RAG.
- **U.2 Constitutional self-update** — agents rewrite their own operating rules from past results.
- **U.3 Closed-loop Meta + autonomous Scout** — daily Meta Ads drop detection + rerun queue + autonomous scraping intent router.

All three are gated behind environment flags; every default is OFF, so the legacy pipeline is preserved bit-for-bit when autonomous mode is unset.

## Architecture additions

### Storage (IndexedDB v7 → v8, Postgres lazy CREATE TABLE)

| Store | Key | Purpose |
| --- | --- | --- |
| `personaDistillations` (IDB) | `agentId` | Baked-in expertise corpus per persona |
| `agentConstitutions` (IDB) | `agentId` | Self-authored operating rules (current version) |
| `scoutLedger` (IDB) | `id` | Scraping budget tracking (per-project, per-day) |
| `persona_distillations_mirror` (PG) | `agent_id` | Server mirror of distillations |
| `agent_constitutions_mirror` (PG) | `agent_id` | Server mirror of constitutions |
| `ad_performance_snapshots` (PG) | `id` | Daily Meta Ads insights per campaign |
| `rerun_queue` (PG) | `id` | Pending gate re-runs triggered by drop detection |

### New API routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `POST /api/admin/distill` | Compile persona expertise via Opus | session-admin OR x-admin-token |
| `POST /api/sync/persona-distillation` | IDB → Neon mirror write | session |
| `GET  /api/sync/persona-distillation` | Bootstrap hydration | session |
| `POST /api/admin/update-constitution` | Rewrite agent constitution via Sonnet | session |
| `POST /api/sync/agent-constitution` | IDB → Neon mirror write | session |
| `GET  /api/sync/agent-constitution` | Bootstrap hydration | session |
| `GET  /api/cron/meta-perf` | Daily Meta insights pull + drop detection | `x-cron-secret` |
| `GET  /api/rerun/pending` | List pending rerun rows | session |
| `POST /api/rerun/claim` | Atomic claim + status update | session |
| `POST /api/scout` | Intent → tool plan via Sonnet | session |

### New admin pages

- `/admin/distillations` — per-persona cards, Distill + Re-distill, preview, batch.
- `/admin/constitutions` — per-persona cards, Refresh, auto-trigger counter visibility, preview.
- God-panel tab "Autonomous (Phase U)" links to both.

### New client modules

- `src/lib/learning/distillation.ts` — client orchestrator for U.1
- `src/lib/learning/constitution.ts` — client orchestrator + auto-trigger counter for U.2
- `src/lib/learning/autonomousMode.ts` — feature-flag helpers (7 flags)
- `src/lib/agents/scout.ts` — Scout orchestrator with caps from Q-002
- `src/lib/rerun/queue.ts` — client-side rerun queue helpers
- `src/lib/meta-ads/perfPull.ts` — Meta Graph API insights fetcher + drop detector

### Prompt injection changes

`buildPersonaPrompt(persona, { distillation, constitution })` now accepts optional U.1/U.2 blocks. When autonomous mode is ON and distillation exists, runtime-RAG path in `runGate.ts` and `runSubAgents.ts` is short-circuited — training chunks are skipped. When constitution is present, it is injected after the distillation with an explicit rule that DR principles take precedence.

### Infrastructure

- `vercel.json` — daily cron at 14:00 UTC for `/api/cron/meta-perf` (Hobby plan limit — see Q-006)
- `src/proxy.ts` — kill-switch bypass via `x-admin-token` OR cron secret (`x-cron-secret` or `Authorization: Bearer`)
- `src/lib/auth/audit.ts` — six new `phase_u.*` audit actions

## Feature flags

| Flag | Role | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_AUTONOMOUS_MODE` | Master switch | OFF |
| `NEXT_PUBLIC_AUTO_CONSTITUTION` | Constitution auto-refresh after N approvals | OFF |
| `AUTO_DISTILL` | Re-distill after +20 training chunks | OFF |
| `AUTO_RERUN_ON_DROP` | Auto-claim pending reruns on Meta CRITICAL drop | OFF |
| `AUTO_PUSH_CREATIVES` | Push reruns to Meta (Q-003: NOT implemented) | N/A |
| `CRON_SECRET` | Required for `/api/cron/meta-perf` | — |
| `SCOUT_DAILY_CAP` | Override default 20 calls/day/project (Q-002) | 20 |
| `SCOUT_PER_GATE_CAP` | Override default 3 calls/gate-run (Q-002) | 3 |
| `SCOUT_MAX_JOB_COST_USD` | Hard stop per Scout job (Q-002) | 2 |
| `CONSTITUTION_REFRESH_EVERY` | Approvals between auto-refresh | 10 |
| `META_GRAPH_VERSION` | Meta Graph API version | v19.0 |

## Validated in production

- Kill-switch bypass on prod works with x-admin-token (verified via `scripts/test-distill.mjs`).
- Distillation route produces valid 4-section corpora for all 6 personas: avg 5.5-6.7k chars, ~2k tokens, 37-45s on Opus 4.6 (`scripts/test-distill-all.mjs`, 6/6 passed).
- Constitution route returns valid "# Do / # Don't / # Watch-out" structure on synthetic corpus.
- Scout plan route picks relevant tools (reddit + tavily for VOC intent) and generates queries in the project's target language.
- Rerun pending route returns empty rows on fresh DB and handles CREATE TABLE IF NOT EXISTS lazily.
- `npm run build` passes after every iteration.

## Bugs fixed en route

- **BUG-001** — `/api/admin/distill` used `requireAdmin` only (cookie-session) — curl-based admin tooling could not hit it. Fixed: dual-auth (session OR x-admin-token) mirroring `/api/admin/db-migrate` pattern.
- **BUG-002** — Global `KILL_SWITCH=true` in `proxy.ts` blocked all routes including admin tooling. Fixed: `isKillSwitchBypassRequest()` in `proxy.ts` that accepts `x-admin-token`=ADMIN_PASSWORD or cron bearer.

## Known limitations / open questions

See `QUESTIONS.md` for Q-001…Q-006 with chosen defaults. The blocker one:

- **Q-006** — Vercel Hobby plan caps cron jobs at 1/day. Brief asked for every 2h. Deployed as daily; `scripts/test-phase-u-routes.mjs` verifies the route itself works. Upgrade to Pro (or hit the endpoint from an external scheduler with `x-cron-secret`) to restore 2h cadence.

See `TODO.md` for deferred items (Scout ↔ sub-agent prompt-level integration, per-project meta campaign UI, constitution history diff view).
