# Pawen Command Center — Spec

## Tool & Purpose
**Pawen Command Center** — Autonomous multi-agent AI agency for Meta Ads (product/language/niche agnostic).
It runs an end-to-end Direct Response pipeline: Core Avatar → Sub-Avatars → Brand DNA → Deep Dive → Mechanism → Copy → Creatives → Campaign Blueprint → Export.

---

## Stack
- **Framework**: Next.js 16.2.2 (App Router, Turbopack) — note `middleware.ts` is renamed to `src/proxy.ts`; `params` are async
- **Runtime**: Node.js 24 LTS, React 19.2.4, TypeScript strict
- **Styling**: Tailwind v4 (`@tailwindcss/postcss`)
- **Client Storage**: IndexedDB via `idb` v8 — DB name `pawen-command-center`, version 6
- **Server Storage**: Neon Postgres (`@neondatabase/serverless`) + Vercel Blob (`@vercel/blob`)
- **Auth**: HMAC-SHA256 session cookies (custom, not NextAuth) + separate admin token
- **AI Providers**: Anthropic Claude (Opus 4.6 generator/compiler, Sonnet 4.6 reviewer/director)
- **External APIs**: Firecrawl, Tavily, Reddit public JSON, fal.ai (image gen), Apify (TikTok + FB Ads scraping), Shopify public endpoints, Meta Ad Library, BrandSearch, Discord webhook
- **Templating**: `liquidjs` (client-side render for live template editor)
- **Deployment**: Vercel (no git remote — deploys via `npx vercel@latest deploy --prod --yes`)
- **Prod URLs**: https://sykss-agency.vercel.app , https://pawen-command-center.vercel.app

---

## High-level Architecture
- **Pipeline = 9 gates** (`gate1`…`gate9`) + Brand DNA. Each gate runs sub-agents in parallel → compiler → manager review → director review → congruence check.
- **Gate 1** = Avatar Excavation (custom orchestrator `runAvatarExcavation.ts`)
- **Gates 2–9** = generic `runGate.ts` flow
- **Personas**: Marcus (avatars), Alex (copy), Nina (creatives), David (media buying), Léa (director), Sarah (strategist)
- **Funnel + Sub-avatar switch** propagates into every agent prompt (`GateContextBar`)
- **Learning engine**: Gold outputs + user profile + niche intelligence injected into all 4 agent layers
- **Static Ad Studio**: 8 presets × 3 briefs × 3 headlines (A/B/C) = 72 briefs, 144+ images
- **Live Template Editor**: Liquid + AI-edit (Sonnet streaming), 5 starter templates, export HTML/Liquid
- **Ad Cloner**: 3-step scrape → translate → generate image (FB Ads scraper + nano-banana-pro)

---

## Routes / Pages (Next.js App Router)

### Public (no auth)
- `/` — Dashboard / login (two-step: password → user picker)
- `/architecture` — system architecture page (known-public, flagged in audit)
- `/privacy` — privacy policy
- `/contribute` — user contributions upload

### Auth-gated
- `/project/[id]` — project detail (sidebar with 9 gates)
- `/project/[id]/gate/[gateId]` — gate runner + output viewer
- `/project/[id]/brand-dna` — Brand DNA locker
- `/project/[id]/templates` — Live Template Editor
- `/project/[id]/theme-editor` — Shopify theme editor
- `/project/[id]/competitor-intel` — Ad Cloner + Reverse Engineer (tabs)
- `/project/[id]/calculator` — pricing/margin calculator
- `/project/[id]/gallery` — image gallery
- `/project/[id]/emails` — email sequences
- `/project/[id]/carousels` — carousel ads
- `/project/[id]/ugc-briefs` — UGC briefs
- `/project/[id]/video-ads` — video ads
- `/project/[id]/offer-stack` — offer stacking
- `/project/[id]/brandsearch` — brand search tool
- `/project/[id]/ad-performance` — perf feedback input
- `/project/[id]/import-context` — context import
- `/tools` — tools dashboard
- `/training` — training sources + chunks
- `/swipe-vault` — swipe file vault
- `/agents` — agent inspector

### Admin-gated (ADMIN_PASSWORD + x-admin-token header)
- `/admin` — God panel (sees all users' projects)
- `/admin/curate` — knowledge curation

---

## API Endpoints (exhaustive)

### Auth & Session
- `POST /api/auth/login` — password + username → HttpOnly session cookie (rate-limited 5/15min/IP)
- `POST /api/auth/logout` — clear session
- `GET  /api/auth/me` — current session info
- `GET  /api/auth/users` — list of `app_users` (⚠ currently public — audit finding)

### Admin
- `POST /api/admin/login` — admin token (⚠ NO rate limit — audit critical)
- `GET  /api/admin/users`
- `GET  /api/admin/projects`
- `GET  /api/admin/overview`
- `GET  /api/admin/audit` — audit log
- `GET  /api/admin/login-attempts`
- `POST /api/admin/db-migrate`
- `POST /api/admin/env`
- `POST /api/admin/watermark-check` — extract user from watermarked text

### Sync (Neon mirror)
- `GET  /api/sync/bootstrap` — restore projects + gate outputs from Neon
- `POST /api/sync/project` — mirror project (applies watermark)
- `POST /api/sync/gate-output` — mirror gate output (applies watermark)

### Avatars (Gate 1 + enrichments)
- `POST /api/avatars/start` — kick off excavation
- `POST /api/avatars/classify`
- `POST /api/avatars/awareness` — 5 Schwartz levels variant gen
- `POST /api/avatars/deep-dive` — re-runnable deep dive (priorDives tracked)
- `POST /api/avatars/enrich-reverse`
- `POST /api/avatars/localize` — cultural adaptation (not translation)
- `GET  /api/avatars/jobs/*` — job status polling

### Pipeline / Gates
- `POST /api/generate` — generic LLM call
- `POST /api/review` — reviewer/director pass
- `POST /api/congruence` — Brand DNA congruence check
- `POST /api/compile-dna` — Brand DNA compilation
- `POST /api/curate` — curate contributions
- `GET  /api/curated-prefix/*` — curated knowledge per agent

### Sources (scrapers / APIs)
- `POST /api/scrape` — Firecrawl wrapper
- `POST /api/search` — Tavily wrapper
- `POST /api/reddit` — Reddit public JSON
- `POST /api/youtube`
- `POST /api/facebook`
- `POST /api/instagram`
- `POST /api/tiktok` — Apify `clockworks/free-tiktok-scraper` (search + hashtag mode)
- `POST /api/amazon-reviews`
- `POST /api/shopify` — 4 modes: detect, product, reviews, catalog
- `POST /api/shopify-oauth` — OAuth install flow
- `POST /api/shopify-theme` — theme editor backend
- `POST /api/brandsearch`
- `POST /api/meta-ads` — Meta Ad Library via Tavily
- `GET  /api/tools/trustpilot`

### Creatives / Export
- `POST /api/imagegen` — fal.ai proxy (flux-pro / flux-2-pro)
- `POST /api/video` — video gen
- `POST /api/carousels`
- `POST /api/emails`
- `POST /api/ugc-briefs`
- `POST /api/offer-stack`
- `POST /api/translate`
- `POST /api/analyze-ad` — competitor ad analysis
- `POST /api/ad-cloner` — 3-step (scrape | translate | generate)
- `POST /api/template-edit` — SSE streaming Claude template editor
- `POST /api/context/import`

### Ops
- `POST /api/notify` — Discord webhook
- `POST /api/presence` — online user ping
- `POST /api/jobs/*`
- `POST /api/contribute` — file upload to Vercel Blob

---

## Features (exhaustive)

### Gate 1 — Avatar Excavation
- Core Avatar form (product, niche, language, shopify URL auto-import)
- 9 source fetchers (Reddit, Quora, Forums, YouTube, Amazon, TikTok, Shopify, Firecrawl, Tavily)
- Raw signal engine v2 (15 emotion cats, negation-aware, n-grams 1–5, identity markers, buying signals)
- Dynamic source doubling (top source >30% & >20 items → 3 extra queries)
- Gap-fill wave (Sonnet identifies gaps → 5–8 follow-up searches)
- Cross-source validation (fuzzy clustering, HIGH/MED/LOW confidence)
- Adversarial validation (LLM auditor scores sub-avatars)
- Verbatim auto-ranking (4 dims: emotion/specificity/uniqueness/ad-readiness)
- Swipe vocabulary per sub-avatar
- Awareness variants (5 Schwartz levels, immutable stack)
- Deep dive (re-runnable, 7 dimensions)
- Raw Signal UI (tabs: phrases, trigrams, bigrams, words, emotion, verbatims, scored phrases, golden sentences, identity markers, buying signals)
- Sub-avatar switch (drives all downstream gates)

### Gates 2–9 (generic flow)
- Sub-agents parallel (p-queue)
- Compiler → Manager review → Director review → Congruence
- SmartGateOutput renderer (recursive, type-aware)
- Pickable ★ favorites → learning engine
- Notes per gate → `humanDecisions.notes` (visible to downstream)
- Variant generation (up to 4 per gate)
- Funnel + sub-avatar + Brand DNA + Shopify data + performance injected everywhere

### Brand DNA
- Locker gate between Gate 1 and rest
- Product specs, proof inventory auto-populated from Shopify
- Downstream congruence check

### Static Ad Studio (Gate 7/8)
- 8 presets: Before/After, Feature Highlight, Lifestyle, Problem/Agitation, Social Proof, Statistique, Unboxing, Us vs Them
- 24 briefs (3 per preset) × 3 headlines A/B/C
- Headline scoring: Curiosity / Clarity / Punch
- Congruence pre-check (critical/warning/info)
- fal.ai image gen: flux-pro / flux-2-pro, 3 formats (feed/story/vertical)
- "Generate All Picked" batch

### Live Template Editor
- Split-pane: code + variables + history | live iframe preview (desktop/tablet/mobile)
- AI edit (Sonnet streaming SSE, prompt-cached)
- 43 auto-inject variable mappings
- 5 starter templates (advertorial, landing, product, email, squeeze)
- Export HTML / Liquid / copy

### Ad Cloner (Gate 1.1)
- Step 1: Apify `apify~facebook-ads-scraper` (fallback: Firecrawl + Sonnet parse)
- Step 2: Sonnet translate headline/body/CTA + image_description
- Step 3: fal.ai nano-banana-pro img2img (strength 0.7) fallback flux-pro
- Batch + individual generation, JSON + image downloads

### Learning Engine
- Gold output capture (★ pick / score ≥85% / approval)
- Rejection tracking (FIFO last 10)
- Tone keywords, avg pick length per gate
- Niche intelligence (≥3 gold outputs → cross-niche patterns)
- Performance feedback (CTR/CPA/ROAS/spend/conversions) injected into prompts

### Security
- HMAC session, 32+ char SESSION_SECRET (throws at boot)
- `proxy.ts` global rate limit 120/min, heavy endpoints 30/min
- Per-user invisible watermarking (zero-width Unicode HMAC fingerprint)
- Security headers (X-Frame DENY, HSTS 1yr, no-sniff, noindex on /api/*)
- Source maps off, console stripped in prod
- Audit log on every sensitive route

---

## Business rules inferred from code
- `SESSION_SECRET` < 32 chars → app throws at boot (no silent fail)
- Login requires BOTH `APP_PASSWORD` env AND row in `app_users`
- Env vars on Vercel do NOT hot-reload → redeploy required after change
- Avatar enrichments are append-only (`appendAwarenessVariant`, `appendDeepDive`) — never mutate
- Gate output storage key = `${projectId}:${gateId}` (strict format)
- Server-project-wins content arbitration: `subCount*10 + approvedCount*5`
- Deep-link to `/project/X/gate/Y` on fresh device runs NO bootstrap (only `/` does)
- Opus for creative/inferential layers, Sonnet for review/structured — always prompt-cached
- Static Ad Studio: preset + headline + awareness combos pre-checked before fal.ai spend

---

## Run locally
```bash
cd pawen-command-center
npm install
# Pull env from Vercel prod (needs linked project)
npx -y vercel@latest env pull .env.local --yes
# Dev server (Turbopack)
npm run dev
# Open http://localhost:3000
```

### One-off scripts (no auto .env load)
```bash
npx -y dotenv-cli -e .env.local -- node scripts/X.mjs
```

### Deploy
```bash
node scripts/deploy.mjs
# or: npx -y vercel@latest deploy --prod --yes
```

### Check prod env
```bash
npx -y vercel@latest env ls production
```

---

## External service dependencies
- **Anthropic**: ANTHROPIC_API_KEY (required — no fallback)
- **Neon Postgres**: DATABASE_URL (mirror + auth tables)
- **Vercel Blob**: BLOB_READ_WRITE_TOKEN (file uploads)
- **fal.ai**: FAL_AI_API_KEY (image gen — Ad Cloner step 3 requires)
- **Apify**: APIFY_TOKEN (TikTok + FB Ads scrape — optional, fallback Firecrawl)
- **Firecrawl**: FIRECRAWL_API_KEY (scrape fallback)
- **Tavily**: TAVILY_API_KEY (search, Meta Ad Library, gap-fill)
- **Meta Graph**: META_ACCESS_TOKEN
- **Shopify**: SHOPIFY_API_KEY + SHOPIFY_API_SECRET (OAuth)
- **BrandSearch**: BRANDSEARCH_API_KEY
- **Discord**: DISCORD_WEBHOOK_URL (notifications)
- **ALLOWED_ORIGINS**: CORS whitelist
- **Auth**: APP_PASSWORD, ADMIN_PASSWORD, SESSION_SECRET (32+)

---

## Known suspicious zones (likely bug sources)
1. **Admin login** (`/api/admin/login`) — no rate limit, returns ADMIN_PASSWORD as token
2. **`/api/auth/users`** — public endpoint exposing usernames + roles
3. **`/architecture`** — public, exposes full system architecture
4. **Bootstrap only on `/`** — deep-linking to gate page on fresh device = silent empty state
5. **IndexedDB version bumps** — v6 stores include `adAttribution` planned for v7; migrations risky
6. **Watermark strip** — zero-width chars must NOT be filtered by any copy/export flow
7. **Env var drift** — changes need redeploy, easy to miss
8. **Ad Cloner fallback chain** — Apify → Firecrawl+Sonnet → fails silently if both keys missing
9. **Gate output key format** — any code using a different separator than `:` breaks restore
10. **Content arbitration heuristic** (`subCount*10 + approvedCount*5`) — can discard local work
11. **Append-only enrichments** — direct mutations of `sub_avatars[]` would corrupt history
12. **Two uncommitted phases (R→T)** — nothing committed since `61f54ff`, no preview deploys

---

## Phase U — Self-Learning Autonomous Agency

Goal: remove the human dependency in three places. Full plan in `REFACTOR_PLAN.md`.

### U.1 — Baked-in expertise per persona (distillation)

**Replaces**: runtime RAG via `getTrainingChunksForGate` + `buildTrainingPrompt` (slice-to-5, trunc-to-500).

- **Storage**: IndexedDB v8 store `personaDistillations` (keyed by `agentId`) + Postgres mirror table `persona_distillations_mirror`.
- **Record shape**: `{ agentId, distilledExpertise: string, chunkIds: string[], sourceCount: number, generatedAt: string, model: string, tokens: number, version: number }`.
- **Pipeline** (`src/lib/learning/distillation.ts` → `distillPersonaExpertise(agentId)`):
  1. Pull every `TrainingChunk` whose `applicableGates` intersects the persona's `gates` (plus `'all'`).
  2. Pull curated `KnowledgeEntry` rows matching the persona's domain categories.
  3. Concatenate up to 200k input chars, call Opus with a persona-scoped distill prompt → ≤20k chars out.
  4. Output contract: four titled sections — `Frameworks` (named), `Principles` (numbered), `Anti-patterns` (numbered), `Tactical heuristics` (numbered). Markdown.
- **API**: `POST /api/admin/distill` (admin + session required) body `{ agentId | 'all' }`. Returns the distillation record.
- **Client UI**: `/admin/distillations` — one card per persona, status (stale/fresh), Distill button, preview, last generated timestamp, input chunk count, output token count.
- **Injection**: `buildPersonaPrompt(persona, { distillation })` appends a `=== DISTILLED EXPERTISE ===` block. In `runGate.ts` + `runSubAgents.ts`, when autonomous mode is ON, skip the runtime-RAG path and use the distillation instead.
- **Feature flag**: `NEXT_PUBLIC_USE_AUTONOMOUS_MODE=1` (default off → legacy behavior preserved).
- **Auto-trigger**: optional, `AUTO_DISTILL=1`. Re-run when `trainingChunks` count delta since last run ≥ 20; debounced 10 min.

### U.2 — Constitutional self-update

Each agent periodically rewrites its own operating rules from its results.

- **Storage**: IndexedDB v8 store `agentConstitutions` (keyed by `agentId`) + Postgres mirror `agent_constitutions_mirror` (versioned, keep last 10 per agent).
- **Record shape**: `{ agentId, constitution: string, version: number, generatedAt: string, basedOnGates: string[], basedOnOutputCount: number, metrics: { avgScore: number, rejectionCount: number, approvalRate: number } }`.
- **Pipeline** (`src/lib/learning/constitution.ts` → `updateAgentConstitution(agentId)`):
  1. Last 50 `GateOutput` where the lead persona = agentId (chronological, newest last).
  2. All `agentMemory` entries with `type ∈ {'rejection', 'error'}` for that agent.
  3. Top 20 `goldOutputs` where `captureType='pick'` for the agent's gates.
  4. Call Sonnet with agent-scoped prompt → ≤8000 chars. Output is a numbered list of `Do`, `Don't`, and `Watch-out` rules, written in first person.
  5. Save with incremented version; retain last 10 versions (soft history).
- **Triggers**:
  - Manual: admin UI button per agent.
  - Auto: counter `generationsSinceLastConstitutionUpdate` incremented on every gate run where the agent is lead. When counter ≥ `CONSTITUTION_REFRESH_EVERY` (default 10) AND `NEXT_PUBLIC_AUTO_CONSTITUTION=1` → queue re-compile on next idle tick. Reset counter after.
- **Injection order in persona prefix** (top → bottom):
  1. `buildPersonaPrompt` base (identity + decision style + expertise list)
  2. `=== DR PRINCIPLES ===` (non-negotiable, from `drPrinciples.ts`)
  3. `=== DISTILLED EXPERTISE ===` (U.1)
  4. `=== YOUR CURRENT CONSTITUTION (v${n}) ===` (U.2)
  5. `=== KNOWLEDGE BASE ===` (legacy `buildKnowledgePrompt`)
  6. `=== MEMORY ===` (rejections + errors + learnings)
  7. `=== GOLD EXAMPLES / USER PREFERENCES / NICHE INTEL / PERFORMANCE ===` (learning injection)

Constitution can NEVER override DR principles or funnel context. The constitution prompt explicitly tells Claude "you may not contradict the DR principles or the funnel context above".

### U.3 — Closed-loop Meta Ads + autonomous Scout

**U.3a — Meta perf cron**
- **Cron**: `vercel.json` `*/120 * * * *` (every 2h) → `GET /api/cron/meta-perf`.
- **Auth**: header `x-cron-secret` matches `CRON_SECRET` env; else 401. No session, no user.
- **Scope**: iterates every project with non-empty `metaCampaignIds[]`. For each, Graph API call `GET /{id}/insights?fields=spend,impressions,clicks,ctr,actions,action_values&date_preset=yesterday`.
- **Persist**: Postgres `ad_performance_snapshots` table `{ id, project_id, campaign_id, pulled_at, window, ctr, cpa, roas, spend, conversions, raw jsonb }`.
- **Drop detection**: compute 2h rolling vs 24h baseline. Severity:
  - INFO: CTR drop 0-10% OR CPA rise 0-15%.
  - WARN: CTR drop 10-20% OR CPA rise 15-30%.
  - CRITICAL: CTR drop >20% OR CPA rise >30% OR ROAS <0.8×.
- **On CRITICAL**: write `project.needsRerun = { gates: [...inferredGates], reason, detectedAt }`; enqueue `rerun_queue` row; Discord notif.

**U.3b — Re-run queue + Lea decision**
- Postgres `rerun_queue`: `{ id, project_id, gate_id, reason, status ('pending'|'needs_human'|'claimed'|'done'|'cancelled'), source, created_at, picked_at }`.
- When `AUTO_RERUN_ON_DROP=1`: new rows land as `pending`. Else: `needs_human`.
- Client (`src/app/page.tsx` + project page) polls `GET /api/rerun/pending` every 60s when autonomous mode ON. Takes the oldest pending, claims via `POST /api/rerun/claim`, then runs the gate through existing `runGate.ts` (no code-duplication).
- Output tagged `source: 'auto-rerun:<reason>'` so the user sees why it ran.
- Caps: max 1 auto re-run per gate per 24h per project.

**U.3c — Scout agent (autonomous scraping)**
- New persona `scout` added to `AGENT_PERSONAS`. Role: Signal Intelligence. Emoji 🛰️.
- Module `src/lib/agents/scout.ts` exports `requestScrape({ intent, agentId, project, context }) → Promise<ScoutResult>`.
- Intent examples: "more voice-of-customer on fear of ageing for Italian menopause niche", "competitor Meta Ads from last 14 days on 'weight loss tea'", "recent Reddit complaints about estrobolome supplements".
- Pipeline:
  1. Small Sonnet call (cached) scores 9 available tools (Tavily, Firecrawl, Apify TikTok, Apify FB Ads, Reddit public, Amazon reviews, Shopify public, YouTube, BrandSearch) against the intent → picks 1-3.
  2. Generates 2-5 queries per chosen tool.
  3. Executes via internal routes (`/api/search`, `/api/tiktok`, `/api/meta-ads`, …).
  4. Normalizes results → appends to project `rawSignal` / `competitorAds` / `voc` slots (append-only, never mutate).
  5. Returns `{ tool, queries, addedItems, costHint, summary }`.
- **Caps**: 5 Scout invocations per gate run, 50 per project per day (env-overridable).
- **Trigger sites**:
  - Sub-agent runtime via `project.requestScrape(...)` helper (passed as a tool hint; sub-agents emit a `SCRAPE_REQUEST` JSON block which `runSubAgents` detects and dispatches).
  - Lea during Meta drop cron → runs Scout for the inferred gate before re-run.

### Feature flags (all default OFF)

| Flag | Role |
| --- | --- |
| `NEXT_PUBLIC_USE_AUTONOMOUS_MODE` | Master switch. OFF → full legacy behavior. |
| `NEXT_PUBLIC_AUTO_CONSTITUTION` | Constitution auto-refresh after N gate runs. |
| `AUTO_DISTILL` | Server-side auto-distillation when training chunks grow. |
| `AUTO_RERUN_ON_DROP` | Lea auto-claims CRITICAL rerun rows (else `needs_human`). |
| `AUTO_PUSH_CREATIVES` | Push re-run outputs to Meta (NOT implemented in U.3 MVP — queued for U.4). |
| `CRON_SECRET` | Cron header token. Required for cron routes. |
| `SCOUT_DAILY_CAP` | Override default 50/day. |
| `CONSTITUTION_REFRESH_EVERY` | Override default 10 gate runs. |

### IndexedDB migration v7 → v8

Additive only. New stores:
- `personaDistillations` (keyPath `agentId`)
- `agentConstitutions` (keyPath `agentId`, with `by-version` fallback in-memory)
- `scoutLedger` (keyPath `id`, indexed `by-project` and `by-day`)

Existing stores untouched. Rollback path: open DB read-only at v7 if new stores not present (graceful degradation).

