# Pawen Command Center — Test Plan

Legend: `[ ]` = pending, `[x]` = done, `[!]` = bug filed in BUGS.md

---

## 1. Frontend UI — Happy paths

- [ ] Dashboard loads at `/` with login screen when no session cookie
- [ ] Login step 1: correct APP_PASSWORD → user picker appears
- [ ] Login step 2: pick user → dashboard with project list loads
- [ ] Logout clears cookie and returns to login
- [ ] Session persists across browser reload
- [ ] Dashboard "New Project" form renders all 15 language options
- [ ] Creating a project redirects to `/project/[id]`
- [ ] Project page shows 9-gate sidebar with statuses (pending/running/approved/rejected)
- [ ] Progress bar reflects `getProgressPercentage` from approved count
- [ ] Shopify auto-import: paste product URL → product + niche fields auto-fill
- [ ] Gate 1 page: Core Avatar form submits and kicks off excavation
- [ ] Gate 1: 9 source toggles render, can toggle each independently
- [ ] Gate 1: Raw Signal tab switcher works (all 10+ sub-tabs render)
- [ ] Gate 1: ★ pick on any item persists (reload page → ★ remains)
- [ ] Gate 1: Awareness chip click generates variant and stacks under sub-avatar
- [ ] Gate 1: Deep dive button with focus input generates result; history appended
- [ ] Sub-avatar switch in GateContextBar updates all downstream gate views
- [ ] Funnel selector (6 color-coded buttons + retargeting) saves to project
- [ ] SmartGateOutput renders strings, arrays, quotes, records, nested objects without blowing up
- [ ] Variant tabs (Original/V1/V2/V3) on gate page switch between compilations
- [ ] Static Ad Studio left sidebar shows 8 presets with brief counts
- [ ] Static Ad Studio grid view: color palette preview, A/B/C headlines, ★ pick button
- [ ] Static Ad Studio detail view: full headline scoring, fal.ai prompt visible
- [ ] Static Ad Studio: "Generate" per format button produces image inline
- [ ] Static Ad Studio: "Generate All Picked" batches correctly
- [ ] Template Editor: split-pane renders, Liquid live-preview updates on keystroke
- [ ] Template Editor: Variables tab lists auto-detected `{{ var }}`
- [ ] Template Editor: AI chat bar streams edits (SSE) into code pane
- [ ] Template Editor: responsive toggle switches iframe to desktop/tablet/mobile
- [ ] Template Gallery: all 5 starter templates importable
- [ ] Template Gallery: duplicate button creates copy with new id
- [ ] Ad Cloner: brand name input + Scrape button produces ad grid
- [ ] Ad Cloner: Translate step populates translated copy below original
- [ ] Ad Cloner: Generate step shows regenerated image beside original
- [ ] Ad Cloner: Download All JSON exports correctly
- [ ] Admin panel `/admin` loads only with valid admin token
- [ ] Admin overview shows all users' projects (watermark-free from god view)
- [ ] Export: JSON/CSV/clipboard all three modes produce Meta Ads-formatted output
- [ ] Meta Ad Library search returns competitor ads
- [ ] Brand DNA locker persists product_specs and proof_inventory from Shopify
- [ ] Presence indicator shows online users on dashboard
- [ ] Performance feedback form saves CTR/CPA/ROAS/spend/conversions

## 2. Frontend — Edge cases

- [ ] Login with wrong password → error shown, no session cookie set
- [ ] Login rate-limit: 5 failed attempts in 15min from same IP → 429
- [ ] Dashboard with zero projects → empty state CTA visible
- [ ] Dashboard with 100+ projects → list virtualizes or paginates (doesn't freeze)
- [ ] Fresh device, deep link to `/project/X/gate/gate5` → expected empty (no bootstrap) — document/fix
- [ ] Bootstrap race: local has sub-avatars, server has approved gates → correct project wins (`subCount*10 + approved*5`)
- [ ] Gate 1 with empty product field → form validation blocks submit
- [ ] Gate 1 with invalid Shopify URL → graceful error, no crash
- [ ] Gate 1 with all 9 sources toggled OFF → blocked or runs empty (document)
- [ ] Awareness variant stacker: generate 5 different levels → all 5 appended immutably (old ones intact)
- [ ] Deep dive re-run 3× → `priorDives` prevents duplicate findings
- [ ] Sub-avatar verbatim with emoji/RTL/Unicode renders without breaking
- [ ] SmartGateOutput on string >300 chars → collapsible shows
- [ ] Variant generation when original not yet compiled → disabled or queued
- [ ] Static Ad Studio: pick preset + headline + awareness combo that fails congruence → severity badge shown before generate
- [ ] Template Editor with malformed Liquid → preview shows error, no crash
- [ ] Template Editor AI edit interrupted mid-stream → partial result discarded, undo available
- [ ] Ad Cloner with URL that scrapes 0 ads → empty state + retry button
- [ ] Ad Cloner with 50+ ads → deduplicated by image URL
- [ ] Long-running gate (>2min) → keeps UI responsive, shows progress
- [ ] Browser-back from gate → project dashboard reloads cleanly
- [ ] Multiple tabs of same project → IndexedDB writes don't corrupt
- [ ] Copy-paste text containing zero-width watermark chars into text inputs → chars preserved (don't strip)

## 3. API endpoints — Happy paths

- [ ] `POST /api/auth/login` returns 200 + Set-Cookie for valid creds
- [ ] `POST /api/auth/logout` clears cookie, returns 200
- [ ] `GET  /api/auth/me` returns user info with valid session
- [ ] `GET  /api/auth/users` returns user list
- [ ] `POST /api/admin/login` with correct password → admin token
- [ ] `GET  /api/sync/bootstrap` returns projects + gate outputs for logged-in user
- [ ] `POST /api/sync/project` mirrors project to Neon with watermark applied
- [ ] `POST /api/sync/gate-output` mirrors gate output with watermark
- [ ] `POST /api/avatars/start` kicks off excavation, returns job id
- [ ] `POST /api/avatars/awareness` returns 1 variant with chosen level
- [ ] `POST /api/avatars/deep-dive` returns `DeepDiveResult` with 7 dimensions
- [ ] `POST /api/generate` with valid prompt returns Claude text + token counts
- [ ] `POST /api/scrape` with Firecrawl URL returns markdown content
- [ ] `POST /api/search` with Tavily query returns results array
- [ ] `POST /api/tiktok` in search mode returns comments
- [ ] `POST /api/shopify` mode=detect → `{isShopify: true/false}`
- [ ] `POST /api/shopify` mode=product returns product JSON + reviews
- [ ] `POST /api/meta-ads` returns competitor ads array
- [ ] `POST /api/imagegen` with flux-pro prompt returns image URL
- [ ] `POST /api/ad-cloner` step=scrape returns ads array
- [ ] `POST /api/ad-cloner` step=translate returns translated copy + image_description
- [ ] `POST /api/ad-cloner` step=generate returns fal.ai image URL
- [ ] `POST /api/template-edit` SSE stream emits tokens then completes
- [ ] `POST /api/admin/watermark-check` with leaked text → identifies user

## 4. API — Edge cases / validation

- [ ] `POST /api/auth/login` with empty body → 400
- [ ] `POST /api/auth/login` constant-time compare (no timing leak on wrong password)
- [ ] `POST /api/auth/login` with unknown username → 401 not 500
- [ ] Protected route without session cookie → 401
- [ ] Admin route without `x-admin-token` → 401 or 403
- [ ] Admin route with wrong token → 401
- [ ] `POST /api/admin/login` hit 100 times in 10s → is there rate limiting? (audit says NO)
- [ ] `POST /api/admin/login` response body → does it leak ADMIN_PASSWORD? (audit says YES)
- [ ] Global rate limit: 121 requests/min from one user → 429
- [ ] Heavy endpoint rate limit: 31 `/api/generate` requests/min → 429
- [ ] CORS: request from origin NOT in `ALLOWED_ORIGINS` → blocked
- [ ] `POST /api/scrape` with malformed URL → 400 not 500
- [ ] `POST /api/generate` with oversized prompt → clear error
- [ ] `POST /api/avatars/deep-dive` with priorDives > 50 entries → still responds in time
- [ ] `POST /api/imagegen` without FAL_AI_API_KEY → graceful 503 not stack trace
- [ ] `POST /api/ad-cloner` without APIFY_TOKEN and without FIRECRAWL_API_KEY → 503 with clear message
- [ ] `POST /api/shopify` mode=product on non-Shopify site → returns `{isShopify: false}`, not 500
- [ ] `POST /api/tiktok` with invalid APIFY_TOKEN → 401 bubble-up
- [ ] `POST /api/sync/project` → applies watermark without double-encoding on re-save
- [ ] `POST /api/sync/gate-output` with wrong key format (missing `:`) → rejected
- [ ] `POST /api/template-edit` on SSE client disconnect → server aborts cleanly
- [ ] Oversized JSON body (>5MB) → 413 or streaming rejection
- [ ] `SESSION_SECRET` < 32 chars at boot → process exits (verified by unit test)
- [ ] `GET /api/auth/users` from unauthenticated origin → should it be public? (audit says no — test current state)

## 5. Integration flows

- [ ] End-to-end: create project → run Gate 1 → pick sub-avatar → run Gate 2 → output uses chosen sub-avatar
- [ ] Gate 1 → Brand DNA → Gate 3: congruence check flags contradictions
- [ ] Shopify auto-import → Gate 1 → Brand DNA: product_specs + proof_inventory populated from reviews
- [ ] Awareness variant picked → injected into Gate 4 copy output
- [ ] Deep dive + gap-fill wave → verbatims visible in Gate 1 raw signal
- [ ] Funnel change (Unaware → Most Aware) → Gate 5 copy re-generates with new framing
- [ ] Static Ad Studio pick headline A for preset "Before/After" → Gate 8 fal.ai config uses headline A
- [ ] Auto-Pipeline click → Gates 2→9 run sequentially, stops at score <80%
- [ ] Template Editor: edit template, AI edit, undo → history intact
- [ ] Ad Cloner full flow: scrape → translate → generate → download JSON
- [ ] Watermark round-trip: sync project → fetch bootstrap → extract watermark → matches user
- [ ] Mirror restore on fresh browser: login → dashboard → projects appear from Neon
- [ ] Gold output capture: pick ★ in gate output → next run of same gate sees gold in prompt
- [ ] Performance feedback input → next gate run references CTR/CPA/ROAS in output
- [ ] Export Meta Ads JSON: all 9 gates → headlines/body/CTAs all present

## 6. Security basics

- [ ] Unauthenticated access to `/admin` → redirect to login
- [ ] Unauthenticated `POST /api/sync/project` → 401
- [ ] XSS: paste `<script>` in product field → rendered as text, not executed
- [ ] XSS: pick a sub-avatar with `<img onerror>` verbatim → sanitized in display
- [ ] SQL-injection: username `' OR 1=1 --` on login → auth fails, no leak
- [ ] CSRF: cross-origin POST to `/api/sync/project` with stolen cookie → blocked (SameSite / CSRF token)
- [ ] Session cookie flags: HttpOnly + Secure + SameSite set
- [ ] Session cookie not accessible from `document.cookie`
- [ ] Rate limit on login (5 fails / 15min / IP) enforces, logs attempt
- [ ] Watermark applied on every gate output at sync time (re-serve returns watermarked)
- [ ] `/api/admin/watermark-check` correctly identifies user from leak
- [ ] Security headers on every response: X-Frame-Options DENY, HSTS, X-Content-Type-Options, X-Robots-Tag noindex on /api/*
- [ ] No source maps in production build
- [ ] No `console.log` in production client bundle (TerserPlugin)
- [ ] Zero-width chars in user-visible fields survive copy-paste round trip
- [ ] Admin token in transit: header only, never in URL
- [ ] `GET /api/auth/users` → test whether public exposure is fixed or still a vuln
- [ ] `/architecture` page → test if gated or still public
- [ ] File upload (contribute): MIME whitelist enforced
- [ ] File upload: max size enforced
- [ ] Audit log row written for: login, admin login, sync, watermark check, migrate
- [ ] Audit log tamper-proof (admin cannot delete their own actions without trace)

## 7. Performance

- [ ] Dashboard initial load: <3s on cold cache
- [ ] Gate 1 full run with all 9 sources: <5min end-to-end
- [ ] IndexedDB write of 10MB gate output: <1s, doesn't freeze UI
- [ ] SmartGateOutput renders 500-item array without jank
- [ ] Template Editor live preview: <100ms keystroke-to-render
- [ ] Static Ad Studio with 144 images loaded: lazy-loads / thumbnails
- [ ] Ad Cloner Generate All with 20 ads: parallelized via p-queue, doesn't hit fal.ai rate limit
- [ ] Build time: <15s (`next build`) — regression threshold
- [ ] Page count: 61+ pages (regression check — currently 61)
- [ ] Bundle size: client JS <500KB gzipped per route (regression threshold)
- [ ] TypeScript strict: 0 errors
- [ ] ESLint: 0 errors

## 8. Regressions / known landmines

- [ ] `middleware.ts` does NOT exist (renamed to `proxy.ts`)
- [ ] `params` in dynamic routes awaited (Next 16 breaking change)
- [ ] IndexedDB name === `pawen-command-center` (NOT `pawen-db` or `autoecom-lab`)
- [ ] Gate output `_key` field === `${projectId}:${gateId}` exactly
- [ ] Bootstrap only runs on `/` page (deep-link = empty shell — expected behavior, documented)
- [ ] `SESSION_SECRET` required ≥32 chars (throws at boot)
- [ ] No database-client Proxy wrappers (breaks adapter introspection)
- [ ] Prompt caching header `anthropic-beta: prompt-caching-2024-07-31` on all Claude calls
- [ ] `appendAwarenessVariant` / `appendDeepDive` immutable (no mutation of sub_avatars[])
- [ ] No new agents invented outside `registry.ts` sub-agent lists
- [ ] No raw `<pre>{JSON.stringify(...)}</pre>` in gate outputs (use SmartGateOutput)

## 9. Phase U — Autonomous Mode

### 9.1 Distillation (U.1)

- [ ] IndexedDB upgrade v7→v8 on first autonomous-mode boot creates `personaDistillations` store; existing stores untouched
- [ ] `POST /api/admin/distill` with `{agentId:'marcus'}` returns a distillation record with non-empty `distilledExpertise`
- [ ] `POST /api/admin/distill` with `{agentId:'all'}` runs all 6 personas sequentially; progress logged
- [ ] Distilled text contains 4 sections (Frameworks / Principles / Anti-patterns / Tactical heuristics)
- [ ] Admin page `/admin/distillations` shows 6 persona cards with status + preview + Distill button
- [ ] Distill button on Marcus triggers `/api/admin/distill`, updates UI with new record
- [ ] Distilled record persisted to IndexedDB (reload → still present)
- [ ] Distilled record mirrored to Postgres (fresh device → bootstrap returns it)
- [ ] With `NEXT_PUBLIC_USE_AUTONOMOUS_MODE=1` and a distillation present, running any gate skips the runtime RAG and injects the distillation
- [ ] With autonomous mode OFF, `getTrainingChunksForGate` still runs (legacy path)
- [ ] With autonomous mode ON but no distillation stored, legacy path is used as fallback (no empty prompts)
- [ ] Distillation token output capped at ~20k chars (no runaway)
- [ ] Re-running distillation on the same agent increments `version` and keeps `chunkIds` accurate
- [ ] `AUTO_DISTILL=1` triggers re-distillation after +20 new training chunks
- [ ] Non-admin user hitting `/api/admin/distill` → 401/403

### 9.2 Constitutional self-update (U.2)

- [ ] IndexedDB v8 creates `agentConstitutions` store
- [ ] `POST /api/admin/update-constitution` with `{agentId:'alex'}` returns a constitution record with v=1 on first run
- [ ] Subsequent updates increment `version`, preserve last 10 records in memory
- [ ] Constitution generation uses last 50 gate outputs + rejection memories + gold picks (verify prompt payload)
- [ ] Constitution text is first-person, numbered Do/Don't/Watch-out list (visual inspection, ≤8000 chars)
- [ ] Admin page `/admin/constitutions` shows current version per persona, Update button, diff against previous version
- [ ] Constitution injected into persona prefix (after DR principles + distillation, before memory)
- [ ] Constitution explicitly told it cannot contradict DR principles or funnel context
- [ ] Auto-trigger: counter `generationsSinceLastConstitutionUpdate` increments on each gate completion where agent is lead
- [ ] When counter ≥ `CONSTITUTION_REFRESH_EVERY` (default 10) AND `NEXT_PUBLIC_AUTO_CONSTITUTION=1` → queued recompile on next idle
- [ ] Counter resets after auto-recompile
- [ ] Manual update always works regardless of flag state
- [ ] Constitution mirrored to Postgres; bootstrap restores latest version

### 9.3 Meta feedback loop (U.3a + U.3b)

- [ ] `vercel.json` declares cron path `/api/cron/meta-perf` with expected schedule string
- [ ] `GET /api/cron/meta-perf` without `x-cron-secret` header → 401
- [ ] `GET /api/cron/meta-perf` with wrong secret → 401
- [ ] With valid secret, route iterates projects with `metaCampaignIds[]` and calls Graph API
- [ ] `ad_performance_snapshots` table populated with pulled rows
- [ ] Drop detection tiers: INFO / WARN / CRITICAL applied correctly on synthetic data
- [ ] CRITICAL drop writes `project.needsRerun` + enqueues `rerun_queue` row + sends Discord notif
- [ ] `AUTO_RERUN_ON_DROP=0` → rerun row has status `needs_human`, no auto-claim
- [ ] `AUTO_RERUN_ON_DROP=1` → Lea auto-claims within 60s (client poll)
- [ ] Auto-rerun caps: max 1 per gate per 24h per project enforced
- [ ] Re-run output tagged `source: 'auto-rerun:meta-drop'` visible in SmartGateOutput
- [ ] Project with no `metaCampaignIds` → cron no-ops for it (no error)
- [ ] Meta API failure (expired token) → row logged with error, no crash, notif raised

### 9.4 Scout agent (U.3c)

- [ ] Persona `scout` added to `AGENT_PERSONAS` with full shape
- [ ] `POST /api/scout` with `{intent, agentId}` returns a `ScoutResult` with `tool`, `queries`, `addedItems`, `summary`
- [ ] Scout picks Tavily + Reddit for a VOC-style intent
- [ ] Scout picks Apify FB Ads for a competitor-ads intent
- [ ] Scout respects per-gate cap (5/run) — 6th call rejected with reason
- [ ] Scout respects per-project per-day cap (default 50) — tracked via `scoutLedger`
- [ ] `SCOUT_DAILY_CAP=100` overrides default
- [ ] Scout appends items to `rawSignal` append-only (no mutation of existing arrays)
- [ ] Sub-agent emits a `SCRAPE_REQUEST` JSON block → `runSubAgents` dispatches to Scout
- [ ] Lea invokes Scout before auto-rerun on Meta drop path
- [ ] Scout cost hint stored in `project.scoutLedger[]`
- [ ] Scout respects rate-limit from `src/proxy.ts` on downstream routes

### 9.5 Non-regression (all 9 gates + Phase R-T features)

- [ ] `npm run build` passes after each U phase merge (0 TS errors, 0 lint errors)
- [ ] With `NEXT_PUBLIC_USE_AUTONOMOUS_MODE` unset: every item in Section 5 (Integration flows) still passes
- [ ] Gate 1 full run (Marcus + avatar excavation) produces sub-avatars identical in shape to pre-Phase-U
- [ ] Gate 2-9 via `runGate.ts` still complete with lead + manager + director + congruence
- [ ] SmartGateOutput still renders every existing output shape
- [ ] Static Ad Studio (Gate 7/8) still generates 24 briefs + 3 headlines each
- [ ] Template Editor live preview unaffected
- [ ] Ad Cloner 3-step flow unaffected
- [ ] Learning engine: ★ picks still feed `goldOutputs`, scores still capture, rejections still captured
- [ ] IndexedDB v6-user upgrading to v8 completes without data loss (existing projects + gate outputs intact)
- [ ] Bootstrap flow on fresh device still rehydrates projects + gate outputs; additionally rehydrates distillations + constitutions when present
- [ ] Gate output `_key` format still `${projectId}:${gateId}`
- [ ] Watermarking on sync still applied (distillations + constitutions also watermarked)
- [ ] `SESSION_SECRET` still required at boot
- [ ] Rate limiter in `proxy.ts` unchanged for existing routes; new autonomous routes included
- [ ] All new routes use `requireSession()` except cron (uses `CRON_SECRET`)
- [ ] Prompt caching header present on every Opus/Sonnet call including new distillation + constitution + scout
- [ ] `USE_AUTONOMOUS_MODE=1` + distillation missing for one persona → that persona falls back to legacy RAG silently (no crash)
- [ ] Turning the flag OFF after distillations exist → behavior reverts to legacy, distillations remain on disk for later

# TEST_PLAN PATCH — append to TEST_PLAN.md after Section 9

## 10. Phase V — Agent Chat Room

### 10.1 — Conversation CRUD
- [ ] IndexedDB v8 to v9 migration adds conversations plus conversationMessages stores without data loss
- [ ] Neon mirror tables created lazy on first write
- [ ] POST api conversations start creates a conversation and returns id
- [ ] GET api conversations id returns full thread
- [ ] GET api conversations projectId X lists project conversations newest first
- [ ] POST api conversations id close marks status closed and records closedAt
- [ ] All routes require valid session cookie return 401 otherwise
- [ ] Per-project soft cap 3 active conversations warns user but does not hard block

### 10.2 — Routing logic
- [ ] Explicit at marcus in a message causes Marcus to be next speaker
- [ ] At agent autocomplete works in composer UI
- [ ] SCRAPE_REQUEST marker in any agent message triggers Scout as next
- [ ] When no mention Léa routing call returns a valid agentId
- [ ] When Léa returns an invalid agentId fallback forces user input
- [ ] User message always interrupts and Léa re-evaluates after
- [ ] Léa routing decisions are NOT counted toward 30-message cap
- [ ] CLOSE_CONVERSATION summary in a Léa message closes conversation with summary saved

### 10.3 — Hard cap safety
- [ ] Message 30 is last authored message attempting 31 is blocked server-side
- [ ] When cap reached without CLOSE_CONVERSATION Léa is forced to post a final summary
- [ ] Closed conversation becomes read-only POST returns 409
- [ ] UI displays X of 30 counter in sidebar goes red at greater than 25
- [ ] Conversation cost exceeding CONVERSATION_COST_CEILING_USD forces close

### 10.4 — Agent prompt mode conversation
- [ ] buildPersonaPrompt persona mode conversation thread produces conversation-style system prompt
- [ ] Distilled expertise is included Phase U integration
- [ ] Current constitution is included Phase U integration
- [ ] Training chunk RAG is NOT called in conversation mode
- [ ] Last 15 messages are included in context
- [ ] Older messages are summarized not dropped silently
- [ ] Conversation rules block is present and explicit
- [ ] Agent with missing distillation still participates with warning log

### 10.5 — UI project id agent-chat
- [ ] Feature disabled banner when NEXT_PUBLIC_CONVERSATIONS_ENABLED unset or 0
- [ ] Page loads with empty state when no prior conversations
- [ ] Start conversation button opens modal with topic plus participant selector
- [ ] User messages appear right-aligned agent messages left-aligned with agent color
- [ ] Each agent has visible emoji plus name plus role label
- [ ] Mentions are highlighted visually
- [ ] SCRAPE_REQUEST markers render as teal badges inline
- [ ] Auto-scroll to latest unless user scrolled up
- [ ] Jump to latest button appears when scrolled up
- [ ] Composer supports at agent autocomplete
- [ ] Close conversation button in sidebar works
- [ ] Past conversations list is clickable and opens read-only view
- [ ] SSE stream renders agent text as it generates no flicker

### 10.6 — Autonomous triggers
- [ ] With AUTO_CONVERSATION_ON_DROP 1 a CRITICAL Meta drop creates a system conversation
- [ ] The auto-created conversation has initiator system and a first message from Léa
- [ ] Cooldown second drop within 6h does NOT create a second conversation
- [ ] With AUTO_CONVERSATION_ON_DISTILL 1 finished distillation creates a short standup
- [ ] With flags OFF no conversation is auto-created by any event
- [ ] Discord notification fires when a conversation closes including summary and cost

### 10.7 — Safety and injection resistance
- [ ] Prompt injection in user message ignore previous instructions is rejected by agent via system prompt rule
- [ ] Scout cap of 3 per conversation is enforced
- [ ] Infinite ping-pong two agents tagging each other for 10 turns still closes at message 30
- [ ] Léa detects ping-pong pattern and auto-closes earlier if detected
- [ ] Daily cost rollup displays in admin tile
- [ ] Watermark chars in user messages are preserved

### 10.8 — Non-regression
- [ ] All Phase U flows still work
- [ ] npm run build exit 0
- [ ] npm run lint exit 0
- [ ] Existing gates still execute normally when conversations feature is off
- [ ] IndexedDB v8 users migrate to v9 without losing projects or gate outputs
