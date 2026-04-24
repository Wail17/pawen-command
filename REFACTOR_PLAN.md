# Phase U — Self-Learning Autonomous Agency

Mission: make Pawen genuinely autonomous on three axes.

## Current state (what we're replacing)

- **RAG naïf au runtime**: `getTrainingChunksForGate(gateId)` (`src/lib/store/db.ts:432`) renvoie TOUS les chunks marqués pour ce gate, `buildTrainingPrompt` (`src/lib/agents/personas.ts:166`) slice à 5 premiers et tronque. Injecté dans `runGate.ts:339` (lead) et `runSubAgents.ts:53` (sub-agents).
- **Pas d'expertise distillée**: les personas ont juste `personality + decisionStyle + expertise[]` (tableau de strings). Aucune constitution éditable.
- **Memory only sur rejections/erreurs**: `agentMemory` store tracke learnings/errors/rejections mais ce n'est pas une auto-reécriture de règles.
- **Scraping manuel**: chaque source fetcher (`src/lib/sources/*`) est déclenché depuis un gate. Pas d'agent qui décide quoi scraper tout seul.
- **Pas de Meta perf auto-pull**: `AdPerformance` est saisi à la main. Pas de cron. META_ACCESS_TOKEN existe mais seulement utilisé pour Ad Library via Tavily (`/api/meta-ads`).

## Design

### U.1 — Distillation (per-persona baked-in expertise)

**Goal**: chaque persona stocke un corpus distillé (~15-30k chars) produit une fois à partir de tous ses trainingChunks pertinents. Remplace le RAG runtime quand autonomous mode ON.

**Storage**:
- New IndexedDB v8 store `personaDistillations` keyed by `agentId`.
- Record: `{ agentId, distilledExpertise, chunkIds[], sourceCount, generatedAt, model, tokens, version }`.
- Server mirror: new `persona_distillations_mirror` Postgres table (agentId, data jsonb, updated_at). Populated from client via `/api/sync/persona-distillation`.
- Hydrated on bootstrap alongside projects.

**Pipeline**:
- `src/lib/learning/distillation.ts` — `distillPersonaExpertise(agentId)`:
  1. Collect all training chunks where `applicableGates ∩ persona.gates` OR `applicableGates includes 'all'`
  2. Collect all curated `KnowledgeEntry` rows with category matching persona domain
  3. Group chunks by source, concatenate (up to ~200k input chars)
  4. Call Opus with persona-specific distill prompt → ~20k chars output: Frameworks (named), Principles (numbered), Anti-patterns (numbered), Tactical heuristics
  5. Save + mirror

**Trigger**: admin route `POST /api/admin/distill` (body: `{ agentId }` or `{ agentId: 'all' }`). Admin UI at `/admin/distillations`. Also runs on chunk save (debounced 10 min) if `AUTO_DISTILL=1`.

**Injection**: `buildPersonaPrompt(persona, { distillation })` appends a `=== DISTILLED EXPERTISE ===` block. In autonomous mode, `getTrainingChunksForGate` + `buildTrainingPrompt` are skipped.

**Fallback**: `NEXT_PUBLIC_USE_AUTONOMOUS_MODE !== '1'` → legacy RAG path unchanged.

### U.2 — Constitutional self-update

**Goal**: each agent can rewrite its own operating rules from its past outputs + reviewer scores + rejections.

**Storage**:
- New IndexedDB v8 store `agentConstitutions` keyed by `agentId`.
- Record: `{ agentId, constitution: string, version: number, generatedAt: string, basedOnGates[], basedOnOutputCount, metrics: { avgScore, rejectionCount, approvalRate } }`.
- Versioned — `by-agent` index for history (soft). Keep last 10 versions in memory, prune older. Server mirror.

**Pipeline**:
- `src/lib/learning/constitution.ts` — `updateAgentConstitution(agentId)`:
  1. Pull last N (default 50) `GateOutput` where leadPersona = agentId, plus reviewer scores from output metadata
  2. Pull agent's `rejection` + `error` memories from `agentMemory`
  3. Pull gold outputs where `capturedType=pick` for this agent's gates
  4. Compose prompt for Sonnet: "You are ${agentName}. Here are your past 50 outputs, scores, rejections, and picks. Rewrite your operating constitution — a numbered list of YOUR rules (Do / Don't / Watch-out). Must be specific, not generic. Reference past project learnings. Max 8000 chars."
  5. Save new version, increment counter, mirror

**Trigger**:
- Manual: admin UI button per agent.
- Auto: every 10 approved gate runs per agent, check `generationsSinceLastUpdate` counter on agent; if ≥ threshold AND autonomous mode ON → queue re-compile. Runs client-side after gate approval.

**Injection**: after distilled expertise, before memory block. Block: `=== YOUR CURRENT CONSTITUTION (v${n}) ===`. Flag `NEXT_PUBLIC_AUTO_CONSTITUTION=1` gates auto-updates; manual always works.

### U.3 — Closed-loop Meta Ads + autonomous Scout

**U.3a — Meta perf cron**:
- `vercel.json` cron `*/0 */2 * * *` (every 2h) → `GET /api/cron/meta-perf`.
- Protected by `CRON_SECRET` header match.
- For each project with `project.metaCampaignIds[]`, call Meta Graph API `/{campaign-id}/insights?fields=ctr,cpa,spend,actions&date_preset=today,yesterday`.
- Append to `ad_performance_snapshots` Postgres table.
- Drop detection: compare 2h-window vs 24h baseline. Severity tiers: INFO / WARN / CRITICAL.
- On CRITICAL: mark `project.needsRerun = { gates: [inferredGate], reason, at }`.
- Notify Discord.
- `AUTO_RERUN_ON_DROP=1` env flag: if ON, enqueue gate re-run automatically. Else: notif only, waits for human.

**U.3b — Re-run queue**:
- Postgres `rerun_queue` table: `{ id, project_id, gate_id, reason, status, created_at, picked_at }`.
- Client polls via `GET /api/rerun/pending` every 60s when autonomous mode ON.
- Lea decides whether to re-run (based on project state + recent reruns). Runs gate via existing `runGate.ts`.
- Output tagged `source: 'auto-rerun:meta-drop'`.

**U.3c — Scout agent**:
- New persona `scout` in `AGENT_PERSONAS`. Role: Signal Intelligence.
- New module `src/lib/agents/scout.ts` exporting `requestScrape({ intent, agentId, project, context }) → Promise<ScrapeResult>`.
  - Scout receives an intent ("I need more VOC for fear hooks", "competitor ads for X niche", "recent testimonials on mechanism Y").
  - Calls a small Sonnet call to choose tool(s) + queries from the toolbox (tavily, firecrawl, apify tiktok, apify fbads, reddit, amazon, shopify) based on intent. Prompt-cached.
  - Executes via `runSourceFetchers` or direct API route.
  - Returns structured `{ addedToRawSignal, addedToSwipeVault, summary, tool, cost }`.
- Sub-agents and Lea can call `requestScrape` mid-run. Rate-limited per project (max 5 scouts per gate run; max 50 per project per day).
- On drop-detection cron path: Scout runs for David's inferred re-run need before gate re-executes.

## Changes by file

**New**:
- `src/lib/learning/distillation.ts` — distiller
- `src/lib/learning/constitution.ts` — constitution compiler + trigger counter
- `src/lib/agents/scout.ts` — Scout persona orchestrator
- `src/lib/meta-ads/perfPull.ts` — Meta Graph insights fetch
- `src/lib/rerun/queue.ts` — rerun queue client + types
- `src/app/api/admin/distill/route.ts`
- `src/app/api/admin/update-constitution/route.ts`
- `src/app/api/sync/persona-distillation/route.ts`
- `src/app/api/sync/agent-constitution/route.ts`
- `src/app/api/cron/meta-perf/route.ts` (cron-protected)
- `src/app/api/rerun/pending/route.ts`
- `src/app/api/rerun/claim/route.ts`
- `src/app/api/scout/route.ts` (server endpoint the client calls)
- `src/app/admin/distillations/page.tsx`
- `src/app/admin/constitutions/page.tsx`
- `vercel.json` (cron declaration)
- `scripts/migrate-phase-u.mjs` (Neon migration for 4 new tables)

**Modified**:
- `src/lib/store/db.ts` — bump v7→v8: add `personaDistillations`, `agentConstitutions` stores; keep swipeVault v7.
- `src/lib/kb/types.ts` — `PersonaDistillation`, `AgentConstitution` types; extend `AgentPersona` with optional inline fields for in-memory read.
- `src/lib/agents/personas.ts` — `buildPersonaPrompt` accepts `{ distillation, constitution }`. Legacy calls unchanged.
- `src/lib/agents/runGate.ts` — read flag, short-circuit training-chunk RAG when autonomous, inject distillation + constitution.
- `src/lib/agents/runSubAgents.ts` — same changes.
- `src/lib/types/index.ts` — extend `Project` with `metaCampaignIds?`, `needsRerun?`, `metaSnapshotsCount?`.
- `src/proxy.ts` — allow `x-cron-secret` origin for cron route; do not rate-limit.
- `src/app/admin/layout.tsx` — add nav links for the two new admin pages.

## Non-negotiable constraints (from brief)

- ✅ No git commits.
- ✅ IndexedDB v7 → v8. Additive only, never drop stores.
- ✅ Gate output key format `${projectId}:${gateId}` untouched.
- ✅ All new routes require `requireSession()`; cron route uses `CRON_SECRET` header.
- ✅ Prompt caching on every Opus/Sonnet call.
- ✅ No watermark strip.
- ✅ Fallback flag: `NEXT_PUBLIC_USE_AUTONOMOUS_MODE`. When unset/empty/0 → legacy behavior.
- ✅ Max iterations caps on every recursive/retry loop (distillation max 1 attempt, re-run queue max 1 per gate per 24h, scout max 5 per gate run).
- ✅ `npm run build` must pass after each phase.

## Iteration schedule

- **Iteration 1** (this one): scaffold docs + start U.1 foundation (types, store, distillation module, admin route).
- **Iteration 2**: finish U.1 (admin UI page, inject into prompts, feature-flag gate, test on 1 agent).
- **Iteration 3**: U.1 test all 6 agents + non-regression.
- **Iteration 4**: U.2 constitution storage + compiler + injection.
- **Iteration 5**: U.2 auto-trigger counter + admin UI.
- **Iteration 6**: U.3a — Meta perf cron + schema + drop detection.
- **Iteration 7**: U.3b — rerun queue + Lea decision logic.
- **Iteration 8**: U.3c — Scout persona + orchestrator + API.
- **Iteration 9**: Integration — sub-agents call Scout, cron triggers Scout.
- **Iteration 10**: Full regression pass + CHANGELOG + TODO.md.

## Open questions (→ `QUESTIONS.md`)

Any decision that would fundamentally change product shape (e.g., "should Scout be able to spend money via fal.ai?") gets deferred to QUESTIONS.md and work continues around it.
