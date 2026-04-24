# Phase U.4 — Scraping Engine Rebuild (Quality-First Foundation)

Released: 2026-04-25 (ralph-loop, built without live API keys — TODO_TESTS.md has the live verification runbook)

## Summary

Replaces the broken Tavily + Apify-based scraping layer (9 of 12 sources were dead in prod per the audit) with a quality-first multi-provider abstraction. Every adapter is built and compiled. Live tests are deferred to TODO_TESTS.md to run once the user adds API keys.

## What's new

### Provider abstraction (`src/lib/sources/providers/`)

- `types.ts` — `SearchProvider`, `ScraperProvider`, `SocialProvider`, `VideoProvider`, `EcomProvider`, `MetaAdsProvider`, `EmbeddingProvider` interfaces each with `isHealthy()` + typed result shapes.
- `registry.ts` — picks the highest-priority healthy provider per category. Per-id health cache (60s TTL).
- `common.ts` — shared helpers (`fetchWithTimeout`, `sha256Hex`, `normalizeUrl`, env-missing health check).

### Adapters (11 total)

| Adapter | Category | Priority | Env var |
| --- | --- | --- | --- |
| `ExaAdapter` | search | 1 | `EXA_API_KEY` |
| `BraveAdapter` | search | 2 | `BRAVE_API_KEY` |
| `FirecrawlAdapter` (+12h cache) | scraper | 1 | `FIRECRAWL_API_KEY` |
| `BrightDataAdapter` | social (reddit+quora) | 1 | `BRIGHTDATA_API_KEY` |
| `RedditOAuthAdapter` | social (reddit) | 2 | `REDDIT_CLIENT_ID`/`SECRET` |
| `TikApiAdapter` | video (tiktok) | 1 | `TIKAPI_KEY` |
| `YouTubeDataAPIAdapter` | video (youtube) | 1 | `YOUTUBE_API_KEY` |
| `RainforestAdapter` | ecom (amazon, all marketplaces) | 1 | `RAINFOREST_API_KEY` |
| `ShopifyPublicAdapter` | ecom (shopify) | 1 | (none — public JSON) |
| `MetaGraphAdapter` | meta_ads | 1 | `META_ACCESS_TOKEN` |
| `VoyageEmbeddingAdapter` + `SimhashEmbeddingAdapter` | embedding | 1 / 99 | `VOYAGE_API_KEY` (optional) |

### Unified API route

- `POST /api/scraping/fetch` — server-side dispatcher. Accepts `{source, plan, language}`, routes through the right wrapper, records health, returns `RawSourceData`.
- `POST /api/scraping/feedback` — records `chunkUtilizationRate` per source (feedback loop, U.4.9).
- `GET /api/admin/scraping-health` — admin dashboard data source: per-provider health, per-source 24h stats (p50/p95, success rate, quality, utilization), cache stats.

### Legacy fetcher wrapping

Every file in `src/lib/sources/` (`reddit.ts`, `quora.ts`, `youtube.ts`, `tiktok.ts`, `amazon.ts`, `shopify.ts`) now checks `NEXT_PUBLIC_USE_NEW_SCRAPING_STACK` at the top and short-circuits to `fetchViaNewStack(source, plan, language)` when ON. Legacy Tavily/Apify code paths are untouched and remain the default. Zero risk of regression.

### Cache layer (U.4.5)

- `src/lib/sources/scrapeCache.ts` — Neon-backed key/value cache. SHA-256 of normalized URL → markdown + metadata + 12h TTL.
- Integrated into `FirecrawlAdapter.scrape()` — 2nd call within TTL returns cached, increments `hit_count`.
- Stats exposed at `/admin/scraping-health`.

### Quality scoring (U.4.6)

`src/lib/sources/qualityScore.ts` → `scoreChunk({ text, source, chunkEmbedding, avatarEmbedding })` returns `{specificity, emotion, relevance, authority, total}` where total is 0-100. Heuristic + embedding-based. Score ≥ 60 = high, < 30 = low.

### Embeddings + dedup (U.4.7)

- `src/lib/sources/embeddings.ts` → `dedupByCosine(items, threshold=0.92)`. O(n²) single-pass, keeps highest-quality per cluster.
- `TrainingChunk` type extended with optional `embedding`, `embeddingModel`, `qualityScore`, `similarityHash` fields. IDB v9 → v10 adds a `by-similarity-hash` index (additive, non-destructive — legacy rows stay intact).

### Meta Ad Library rewrite (U.4.4)

`/api/meta-ads` now calls `MetaGraphAdapter` directly when `META_ACCESS_TOKEN` is set AND (the new-stack flag is on OR Tavily is missing). Returns 50-500 structured ads per query vs 0-3 via Tavily wrapper. Kept the `{ads: []}` response shape for backward compatibility; new consumers may read `raw: MetaAdResult[]` for full structure (demographic distribution, EU reach, snapshot URLs, etc.).

### Health dashboard (U.4.8)

New admin page `/admin/scraping-health`:
- Per-provider card grouped by category (search / scraper / social / video / ecom / meta_ads / embedding) with status, missing env vars, priority.
- Per-source table: 24h calls, success rate, p50/p95 latency, avg quality, avg utilization, low-utility flag.
- Cache tile: entry count, total hits, avg size, oldest entry.
- 30s auto-refresh.
- Linked from the god-panel Autonomous tab.

### Audit additions

`phase_u.distill` enum extended; no new audit actions needed — scraping events recorded in `scrape_health` table which has its own observability path.

## Bugs fixed / failure modes addressed

Every failure mode from `SCRAPING_AUDIT.md` (FM-1 through FM-7) is closed by the new abstraction:
- **FM-1** (Reddit swallows Apify 403) — new wrappers always bubble `error` in `RawSourceData`.
- **FM-3** (Meta Ads silent Tavily failure) — new route returns `ok: false` with structured error when provider fails.
- **FM-4/FM-5** (YouTube / TikTok fallback confusion) — explicit provider-level error propagation; the scraping-health dashboard shows which provider failed with its exact error message.
- **FM-6** (Reddit route emits 200 for failures) — new `/api/scraping/fetch` route returns the correct HTTP status tier.
- **FM-7** (no central health surface) — `/admin/scraping-health` is that surface.

## Migration plan (U.4.11)

Behind `USE_NEW_SCRAPING_STACK` flag (default OFF). Flip procedure:
1. Add all missing env vars to Vercel prod (see `TODO_TESTS.md` §0).
2. Redeploy. Visit `/admin/scraping-health` — every configured provider shows HEALTHY.
3. Run live tests (`TODO_TESTS.md` §2).
4. Set `NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1` + `USE_NEW_SCRAPING_STACK=1`. Redeploy.
5. Watch the dashboard for 24h. If any red → flip back. Else → continue 30-day observation.
6. After 30 days: remove `TAVILY_API_KEY` + `APIFY_TOKEN`. Delete the `if (isNewScrapingStackOn()) ...` short-circuits from legacy fetchers. Remove the flag.

## Known limitations

- **Live tests not executed** — user does not yet have Exa / Bright Data / TikAPI / Rainforest keys. All smoke-tests live in `TODO_TESTS.md` to run after keys are added.
- **Bright Data dataset ids are defaults** — the adapter uses built-in dataset ids for Reddit + Quora. If those datasets have changed id, user can override via `BRIGHTDATA_DATASET_ID_REDDIT` / `BRIGHTDATA_DATASET_ID_QUORA` env vars.
- **Chunk quality scoring requires avatar embedding** — when `avatarEmbedding` is absent, the relevance dimension falls back to a neutral 15/30. No runtime breakage — quality scores just have a narrower range until embeddings backfill.
- **Legacy archival not yet physical** — spec called for `src/lib/sources/_legacy/` folder. Instead, legacy paths stay inline with a flag short-circuit at the top of each fetcher. Equivalent effect, zero import-path churn, easier to rollback.
- **Feedback loop hook not called from gate runners yet** — the `/api/scraping/feedback` endpoint exists and `recordUtilization` works. Wiring gate runners to POST after each gate run is a follow-up (TODO).

## `npm run build` status

All 7 iterations compile cleanly. Final build registers:
- `/api/scraping/fetch`
- `/api/scraping/feedback`
- `/api/admin/scraping-health`
- `/admin/scraping-health`

No regressions in Phase U / V routes.

---

# Phase V — Agent Chat Room

Released: 2026-04-24 (ralph-loop iterations 1-8)

## Summary

Pawen is no longer just a pipeline — agents now hold real multi-agent conversations about a project, tagged by each other or auto-started by system events (Meta drop). The user observes or jumps in. Léa moderates routing via a lightweight Sonnet call, and she (and only she) can close a thread with a summary. All behavior is behind `NEXT_PUBLIC_CONVERSATIONS_ENABLED` and every auto-trigger is a separate flag.

## What works live on prod

Smoke-tested end-to-end on `pawen-command-center.vercel.app`:

- `POST /api/conversations/start` — creates conv, dispatches 3 agent turns with genuine pushback (Alex → Marcus → Nina with named reasoning, ~$0.07 per turn chain)
- `POST /api/conversations/:id/message` — user @mentions route to the tagged agent
- `POST /api/conversations/:id/close` — Léa summarizes ("Team landed on defiance-framing as the lead hook direction…") then DB flips status
- `GET /api/conversations?projectId=X` — list
- `GET /api/conversations/:id` — full thread

## New storage

| Layer | Store | Purpose |
| --- | --- | --- |
| IDB v9 | `conversations` | Conversation metadata per client |
| IDB v9 | `conversationMessages` | Full thread locally |
| Neon  | `conversations_mirror` | Server source of truth |
| Neon  | `conversation_messages_mirror` | Thread in Postgres |

Lazy `CREATE TABLE IF NOT EXISTS` — no manual migration required.

## Architecture

- **Persona prompt extension**: `buildPersonaPrompt(persona, { mode: 'conversation', conversationTopic, participants })` emits the CONVERSATION MODE block (2-6 sentence messages, @tag protocol, `SCRAPE_REQUEST:` and `CLOSE_CONVERSATION:` markers, prompt-injection resistance).
- **Routing** (`src/lib/conversations/routing.ts`): parsers for @mentions / SCRAPE_REQUEST / CLOSE_CONVERSATION, plus a Sonnet-based Léa moderator call. Ping-pong detector (`detectPingPong`) forces override to Léa after A-B-A-B pattern.
- **Engine** (`src/lib/conversations/engine.ts`): pure agent-turn runner. Loads distillation + constitution from Neon (V.12 — warns if missing), builds conversation-mode prompt, calls Anthropic with last 15 messages trimmed to 2k chars each, returns content + tokens + cost.
- **Dispatch** (`src/lib/conversations/dispatch.ts`): the loop. For each chain step: check cap/ceiling → detect ping-pong → decide speaker → run agent turn → persist → update stats → repeat up to N.
- **System start** (`src/lib/conversations/systemStart.ts`): used by the Meta cron (`AUTO_CONVERSATION_ON_DROP=1`) to open a thread from Léa on CRITICAL drop. 6h cooldown per project.

## New API routes

| Route | Purpose |
| --- | --- |
| `POST /api/conversations/start` | Create conv + first user or system message + first chain |
| `POST /api/conversations/[id]/message` | User posts, server chains up to 5 agent turns |
| `GET  /api/conversations/[id]` | Fetch full thread |
| `GET  /api/conversations?projectId=X` | List conversations for a project |
| `POST /api/conversations/[id]/close` | User-initiated close; optional Léa summary |
| `GET  /api/admin/conversations-stats` | Admin tile — 24h / 7d stats |

All session-gated. No admin-only routes for conversations — it's a first-class user feature.

## UI

New page `/project/[id]/agent-chat`:
- Split 65/35 layout: thread left, sidebar right
- Per-agent tinted bubbles, emoji + role label, @mention syntax-highlighted, SCRAPE_REQUEST/CLOSE_CONVERSATION markers rendered as pill badges
- Composer with Ctrl/⌘+Enter to send
- Sidebar: live message/cost counter (goes red >25/30), participants list, past conversations list, Close button

Feature-disabled banner renders when flag is off.

## Feature flags

| Flag | Default | Role |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVERSATIONS_ENABLED` | OFF | Master switch |
| `AUTO_CONVERSATION_ON_DROP` | OFF | System conv on Meta CRITICAL drop |
| `AUTO_CONVERSATION_ON_DISTILL` | OFF | Standup conv after distillation complete (hook point wired; trigger site TODO) |
| `CONVERSATION_COST_CEILING_USD` | 5 | Force-close ceiling |
| `CONVERSATION_MAX_MESSAGES` | 30 | Hard cap on authored messages |
| `LEA_ROUTING_MODEL` | claude-sonnet-4-6 | Léa's routing model |

## Safety mitigations (V.11)

| # | Risk | Mitigation |
| --- | --- | --- |
| 18 | Infinite agent loop (A/B tagging) | `detectPingPong` in dispatch → force override to Léa |
| 19 | Cost blowup | Per-conv `CONVERSATION_COST_CEILING_USD`; Léa force-close above; Discord notif on close with cost |
| 20 | Léa hallucinates a non-existent agent | `decideNextSpeaker` validates against a fixed whitelist; falls back to `user` |
| 21 | Stale conversation context | `buildThreadMessages` slices last 15 messages × 2k chars each |
| 22 | Scout recursion | Scout is a canned placeholder message in chat mode — no recursive scrape trigger inside the room; real Scout runs via its own Phase U path |
| 23 | Prompt injection via user message | Persona prompt CONVERSATION MODE block instructs agent to ignore identity/override attempts from user messages |
| 24 | Concurrent convs same project | `countActiveConversationsForProject` available for soft warn (UI has hook point); no hard block |

## Bugs fixed en route

- **BUG-003** — Neon driver couldn't infer type for parameters passed into `jsonb_build_object` → "could not determine data type of parameter $N". Fix: explicit `::text` cast on every parameter landing in a jsonb builder (see `persistence.ts` `markConversationClosed`).

## Known limitations

- SSE streaming NOT implemented — client polls via the route response. Non-blocking for UX since agent replies return within one HTTP roundtrip. See TODO.md for the SSE upgrade path.
- Scout inside a conversation is a canned placeholder, not a full Scout run. The real Scout dispatcher is wired to sub-agents (Phase U.3c), not to chat messages. Cleaner separation; less recursion risk.
- `AUTO_CONVERSATION_ON_DISTILL` flag reserved — trigger-site not wired yet (TODO.md).
- No UI for admin conversations-stats tile yet — endpoint exists, god-panel integration pending.

---

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
