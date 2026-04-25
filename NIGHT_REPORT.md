# Night Kitchen Sink — run summary

Built while the user slept. Every block below respected the sacred-framework constraint: `src/lib/gates/evolveFrameworks.ts`, `src/lib/gates/zakFrameworks.ts`, and the system prompts inside `gate1.ts`…`gate9.ts` were NOT touched.

Global regression check: `npm run build` exit 0 after every block. `HIVE_ENABLED=0` and `NEXT_PUBLIC_HIVE_ENABLED=0` — all Phase W surfaces gated, legacy `/`, `/admin`, `/project` flows byte-identical.

## Block A — Phase U.4 solidification (tests + calibration) ✅

**Files**: 5 new
- `tests/providers/mockFetch.mjs` — fetch mock harness + mini test runner (no new deps)
- `tests/providers/adapters.test.mjs` — 18 integration tests across Exa, Brave, Bright Data, Reddit-OAuth, TikAPI, YouTube, Rainforest, Shopify-public, Meta Graph, Voyage, Simhash. Covers missing-env, happy path, 429 retriable, 401 non-retriable, polling sequences, Meta error.code 32.
- `tests/providers/qualityScore.test.mjs` — 7 calibration tests over 20 realistic chunks (amazon reviews / reddit VOC / SEO blog filler). Asserts HIGH ≥ 40 avg, LOW ≤ 35 avg, HIGH beats LOW pairwise.
- `tests/providers/cache.test.mjs` — 5 tests for URL normalization (tracking param strip, trailing slash, lowercase host, param sort, invalid URL)
- `node_modules/server-only/` — stub auto-installed so tests can import server-only adapters from Node

**Results**: 18/18 + 7/7 + 5/5 = **30/30 pass**. Added `npm run test:providers` script (and `npm test` alias).

## Block B — Prompt audit & optimizations ✅ (analysis + helpers, no wiring)

**Files**: 2 new
- `src/lib/agents/promptOptimizations.ts` — 6 pure helpers (`buildSplitPersonaPrompt`, `capMemoriesByType`, `deduplicateSections`, `reorderForCacheReuse`, `estimateTokens`, `buildScoutProtocolBlock`)
- `PROMPT_OPTIMIZATION_REPORT.md` — findings F-1 through F-6 with measured before/after on the 6 prod distillations + a synthetic full gate prompt

**Key finding**: the cache-bust on each sub-agent call is the single biggest cost leak — ~$70/week at current volume on one gate. Fix is opt-in (send persona+distillation+constitution as `systemPrefix` separately from dynamic blocks). Wiring is left to the user's discretion — all helpers are additive, no call-site modified.

## Block C — Playwright E2E skeletons ✅ (requires one-time install)

**Files**: 11 new
- `playwright.config.ts` — serial, headless-chromium, baseURL from env
- `tests/e2e/_helpers.ts` — `login` + `loginAdmin` + `uniqueProjectName`
- `tests/e2e/01-login.spec.ts` — wrong pw + happy path + session persist
- `tests/e2e/02-create-project.spec.ts`
- `tests/e2e/03-gate1-kickoff.spec.ts`
- `tests/e2e/04-conversation.spec.ts` — skipped when flag off
- `tests/e2e/05-static-ad-studio.spec.ts`
- `tests/e2e/06-admin-scraping-health.spec.ts`
- `tests/e2e/07-admin-distillations.spec.ts`
- `tests/e2e/08-admin-constitutions.spec.ts`
- `tests/e2e/README.md` — one-page setup
- `tsconfig.json` — added `exclude` for `tests/**/*` + `playwright.config.ts` so Next build doesn't compile them

**Install to run**: `npm install --save-dev @playwright/test && npx playwright install chromium`. Not installed as part of this run — heavy dep, defer to user.

**Added scripts**: `npm run test:e2e` (runs Playwright).

## Block D — Performance audit ✅

**Files**: 1 new
- `PERF_AUDIT.md` — static analysis only. 7 prioritized recommendations:
  1. Add `images.remotePatterns` to `next.config.ts` (80-90% bandwidth savings on Static Ad Studio)
  2. Split admin tabs with `next/dynamic` (80-150 KB initial load)
  3. Combined `/api/bootstrap` endpoint (200-400ms first-paint)
  4. Cache conv + thread in dispatch loop (50-100ms per user message)
  5. Store embeddings as Float32Array buffer in IDB (halves IDB size)
  6. Align reviewer/director prompt structure for cache sharing (10-20% LLM cost)
  7. Add Vercel Analytics (zero savings, gives visibility)

None implemented — deferred to user review. Lighthouse run not possible (site behind auth + kill switch).

## Block E — Code cleanup (light) ✅

**Files**: 2 modified
- `src/lib/sources/providers/fetchWrappers.ts` — removed unused `trackHealth` stub (was a no-op — real tracking happens in `/api/scraping/fetch`)
- `tests/providers/cache.test.mjs` — removed unused `assertTrue` import

**Deferred (pre-existing, high-risk)**:
- 2 React ref errors in `src/lib/util/apiBaseUrl.ts` and `src/lib/util/internalContext.ts` (predate this run)
- 1 `react/no-unescaped-entities` error in a gate-adjacent file
- Remaining 86 warnings (mostly `@typescript-eslint/no-explicit-any` in frameworks — sacred)

`npm run lint` shows 3 errors remaining, all pre-existing. `npm run build` still exits 0 (Next build doesn't gate on ESLint errors by default).

## Block F — Auto-generated docs ✅

**Files**: 3 new
- `API_ROUTES.md` — complete inventory of ~90 API endpoints grouped by domain (auth, admin, sync, avatars, pipeline, conversations, scraping, sources, creatives, autonomous ops, ops)
- `SCHEMA.md` — Mermaid ER diagram for every Neon table + IndexedDB store inventory (v10, 17 stores)
- `RUNBOOKS.md` — 10 incident-response playbooks (kill switch, scraping 0-items, gate empty output, conversations disabled, distillation 502, Meta perf cron silent, IDB blocked, provider not picked up, conversation cost climb, session cookie domain)

## Block G — Refactor / constants ✅ (light)

**Files**: 1 new
- `src/lib/constants.ts` — consolidates ~25 magic numbers + 3 vendor URLs + Hive palette arrays. Additive; existing inline constants unchanged to avoid widespread diff.

**Deferred**: the actual import-substitution across call sites (high-risk for a night run; no behavior change anyway).

## Block H — Phase W (Hive) scaffolding ✅ (all 9 sub-blocks)

Master flag: `HIVE_ENABLED` default OFF. Client-side reader also respects `NEXT_PUBLIC_HIVE_ENABLED`.

### H.1 Multi-tenant data model ✅

- `src/lib/learning/autonomousMode.ts` — added `isHiveEnabled()` helper
- `src/lib/hive/persistence.ts` — `ensureHiveSchema()` runs `ALTER TABLE IF EXISTS projects_mirror ADD COLUMN IF NOT EXISTS brand_id TEXT` inside a try/catch. Safe no-op if already applied; no-op if `projects_mirror` doesn't exist yet in a fresh dev DB.
- Index `projects_mirror_brand_idx` on `brand_id`.
- IDB v10 → v11 migration **not needed** — `Project` JSONB in IDB can carry a `brandId` field without a schema bump (IDB is schemaless on records). The type addition is trivial if the user wants it later.

### H.2 `brands` Neon table ✅

Columns exactly as spec: `id, owner_id, name, niche, language, avatar_emoji, color_hex, shares_patterns boolean default true, created_at, updated_at`. Lazy `CREATE TABLE IF NOT EXISTS`. Unique owner index added by the seed script. Full type: `src/lib/hive/types.ts` → `Brand`.

### H.3 Seed script ✅

**File**: `scripts/seed-hive-users.mjs`

- 6 users: `sykss` (admin) + `maghrabi` + `suley` + `stavo` + `many` + `amlee`
- Emojis in spec order: 🏝️ 🌴 ⛰️ 🗿 🏖️ 🌋
- Colors: #FF8A00 / #2DD4BF / #A78BFA / #F472B6 / #FBBF24 / #EF4444 (visually distinct, Tailwind-adjacent)
- Passwords: `crypto.randomBytes(12).base64url` → 16 char URL-safe random
- Hash scheme: `pbkdf2$sha256$100000$<salt16>$<hash32>` (same format as existing app_users — assumes PBKDF2 is the house scheme; if the real scheme is bcrypt, adjust `hashPassword()` before running)
- **Prints temp passwords to stdout ONCE**. `ON CONFLICT DO NOTHING` on both `app_users` and `brands`. Idempotent.

**To run**: `npx -y dotenv-cli -e .env.local -- node scripts/seed-hive-users.mjs`

### H.4 `/hive` page ✅

**File**: `src/app/hive/page.tsx`

- SVG ocean (100×60 viewBox) with gradient background
- 3 animated wave strata (`@keyframes wave` + staggered delays, no Three.js)
- 6 islands at fixed canvas coords (spec-shaped archipelago layout)
- Active user's own island: larger radius (6 vs 4) + golden radial-gradient glow pulsing (`@keyframes pulseGold`)
- Click own island → `/brand/<ownerId>`. Click other → `/brand/<ownerId>?view=lurk`. Hover → inline SVG tooltip with placeholder stats
- Oracle floats at bottom-center with "Oracle is observing the hive" tagline
- Responsive: `<640px` switches to vertical stacked list via `@media` + CSS `display` toggle
- Reads `/api/hive/state` which returns 6 mock brands when `HIVE_ENABLED=0`, real rows when on

### H.5 `/brand/[id]` page ✅

**File**: `src/app/brand/[id]/page.tsx`

- Header strip tinted by the brand's `color_hex`
- Stats grid (4 cards): projects count / winning patterns count / active agents / shares-patterns
- 7-card agent grid pulling from `AGENT_PERSONAS` (Sarah, Marcus, Alex, Nina, David, Léa) + `ORACLE` — unified render
- Projects list **placeholder** — documented in-UI: "Project filtering by brandId ships in Phase W.next"
- Non-owners automatically forced to lurk mode regardless of `?view=` param

### H.6 Lurk mode ✅

Same page with `?view=lurk`:
- Header says "lurk mode (redacted)"
- Agent activity shown as `•••` instead of status strings
- Projects section hidden
- Winning patterns section kept (spec: "public winning patterns from that brand")
- Footer banner: "Lurk mode — activity redacted. Public winning patterns shown above."

### H.7 Oracle persona ✅

**File**: `src/lib/hive/oracle.ts`

- Exports `ORACLE` constant: `{ id: 'oracle', name: 'Oracle', role: 'Hive Ideator', emoji: '🔮', model: 'claude-opus-4-6', personality: ... }`
- **Deliberately kept OUTSIDE `AGENT_PERSONAS`** because that map's `AgentId` type is exhaustively matched across `goldOutputs`, `agentMemory`, `learningProfile`, etc. — adding a 7th would cascade into ~15 places and risk regressions on Phase U flows. Documented in the file comment.
- `generateOracleProposals(brandId)` stub returns `[]` with a real implementation outline in the docstring.
- Rendered on `/hive` as the floating bottom-center element.

### H.8 `winning_patterns` table ✅

- Lazy `CREATE TABLE IF NOT EXISTS winning_patterns(id, source_brand_id, gate_id, generalized_pattern jsonb, metrics jsonb, created_at)`.
- Indexes on `(source_brand_id, created_at DESC)` + `(gate_id, created_at DESC)`.
- `createWinningPattern(args)` stub returns `null` — the real detection loop will be inserted into `/api/cron/meta-perf` behind a `HIVE_ENABLED` check.
- `listWinningPatterns({ brandId?, gateId?, limit })` — used by `/brand/[id]` for the public view.

### H.9 API route stubs ✅

**Files**: 3 new
- `GET /api/hive/state` — returns 6 mock brands when flag off, real rows + status when on. Session-gated.
- `GET /api/oracle/feed?brandId=X` — returns `{ proposals: [] }` with a flag-off note, calls `generateOracleProposals` when on.
- `GET /api/winning-patterns?brandId=X&gateId=Y&limit=50` — flag-gated.

All 3 require `requireSession` (no admin needed — brand owners query their own data, lurkers query public patterns).

## Summary by numbers

| Category | Files new | Files modified |
| --- | ---: | ---: |
| Block A (tests) | 5 | — |
| Block B (prompts) | 2 | — |
| Block C (E2E) | 11 | 1 (tsconfig) |
| Block D (perf) | 1 | — |
| Block E (cleanup) | — | 2 |
| Block F (docs) | 3 | — |
| Block G (constants) | 1 | — |
| Block H (Hive) | 11 | 1 (autonomousMode) |
| **Totals** | **34 new** | **4 modified** |

## What the user should review at wake-up

**Critical (touch before doing anything else)**:
1. Read `PROMPT_OPTIMIZATION_REPORT.md` — the cache-bust finding is the single largest cost win available. None of its 6 fixes have been wired; all are opt-in.
2. Confirm the PBKDF2 hash format in `scripts/seed-hive-users.mjs` matches the real `app_users.password_hash` scheme. If the house uses bcrypt or scrypt instead, edit `hashPassword()` before running.
3. `SCRAPING_AUDIT.md` — one prior finding (Tavily + Apify quota) still governs gate runs until keys are added and the new stack flag is flipped.

**Side quest — a new Exa API key was provided mid-run**:
- `claude mcp add` executed to add the Exa MCP server locally.
- `vercel env add EXA_API_KEY production` completed in the background — the adapter's `isHealthy()` should now return ok on next deploy.

**Known deferred / not done**:
- Block E / G — light pass only. Pre-existing ESLint errors NOT touched (risk of regression in gate-adjacent code).
- Block H — UI is scaffold only. Mocked brands render when `HIVE_ENABLED=0`. Live-status on `BrandLiveStatus` fields is placeholder (`activeAgents`/`currentGate` always empty). Project filtering by `brandId` not wired. Oracle proposal generation is a stub.
- Playwright dependency not installed; `npm run test:e2e` will fail until `npm install --save-dev @playwright/test && npx playwright install chromium`.
- `next.config.ts` `images.remotePatterns` NOT added (80-90% bandwidth win waiting — see PERF_AUDIT.md #1).

**Regression check**: `/`, `/admin`, `/project/*` unchanged when both `HIVE_ENABLED` and `NEXT_PUBLIC_HIVE_ENABLED` are unset. `npm run build` exit 0 at every iteration.

## How to turn on the Hive (when ready)

```bash
# 1. Seed the 6 users + brands
npx -y dotenv-cli -e .env.local -- node scripts/seed-hive-users.mjs
# (save the printed passwords to 1Password IMMEDIATELY)

# 2. Flip the flags
npx -y vercel@latest env add HIVE_ENABLED production   # → value: 1
npx -y vercel@latest env add NEXT_PUBLIC_HIVE_ENABLED production   # → 1

# 3. Redeploy
npx -y vercel@latest deploy --prod --yes

# 4. Visit /hive — should show 6 real islands. Click your own to go to /brand/<you>.
```

All 8 blocks shipped. No build broken, no framework touched, no flag flipped.
