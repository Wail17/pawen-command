@AGENTS.md

# Pawen Command Center

Multi-agent AI pipeline for Meta Ads. Product/language/niche agnostic. Next.js 16 App Router + Turbopack, React 19, Node.js 24 LTS, TypeScript strict, Postgres (Neon via Vercel Marketplace), Vercel Blob.

**Prod**: https://sykss-agency.vercel.app
**God panel**: https://pawen-command-center.vercel.app/admin
**Vercel project**: `automatisation_lab_sykss` (team `webexpertbruxelles-5771s-projects`)

## Architecture (high level)

- **Pipeline = 9 gates** (`gate1` → `gate9`), each runs agents that produce a `GateOutput`. Gate 1 = Avatar Excavation (fully custom), Gates 2-9 = generic `runGate` flow (`src/lib/agents/runGate.ts`) + `GateView`/`SmartGateOutput`.
- **Gates registry**: `src/lib/gates/registry.ts` — each gate declares its lead model, sub-agents, review loop, congruence check, output schema.
- **Personas**: `src/lib/agents/personas.ts` — Marcus (avatars), Alex (copy), Nina (creatives), David (media buying), Léa (director/PM), Sarah (strategist).
- **Brand DNA** gate is inserted between avatar and the rest. Once locked, downstream gates run a congruence check against it.
- **Storage**: local IndexedDB (`src/lib/store/db.ts`) + server-side mirror (`projects_mirror`, `gate_outputs_mirror`) via `/api/sync/project`. On fresh device, `fetchBootstrap` restores from mirror.
- **Auth**: HMAC-SHA256 session cookies (`src/lib/auth/session.ts`). Separate admin auth via `ADMIN_PASSWORD` env + `x-admin-token` header (see `src/lib/auth/adminServer.ts`).
- **Knowledge base**: `contributions` → admin curation → `curated_knowledge` per agent. Contributors upload files to Vercel Blob (private).

## Phases done

### Phase 0 — hardening (server-side auth, audit, mirror)
- HMAC session cookies via `SESSION_SECRET` (32+ chars required — throws at boot if missing)
- `app_users` Postgres table = authoritative user registry (old client-side `APP_USERS` gone)
- Rate-limited login (`login_attempts` table, 5 fails/15min per IP, constant-time compare)
- `/api/auth/{login,logout,me,users}` — server-side session flow, two-step (password → picker → login)
- `audit_log` table, written by every sensitive route via `writeAudit`
- `projects_mirror` / `gate_outputs_mirror` — god panel sees everything across all users
- `requireSession()` on every protected route

### Phase E — Non-destructive awareness variants
- **Route**: `POST /api/avatars/enrich-awareness` — Claude Opus 4.6, prompt caching, `maxDuration = 120`
- **Prompt builders**: `src/lib/avatars/enrichPrompts.ts`
- **Stacker**: `appendAwarenessVariant` (immutable append into `sub_avatar.awareness_variants[]`)
- **UI**: 5 chips (Unaware / Problem Aware / Solution Aware / Product Aware / Most Aware) in expanded sub-avatar card, Gate 1. Schwartz's 5 levels. Each click generates one variant and stacks it.

### Phase F — "Approfondis encore +" deep dive
- **Route**: `POST /api/avatars/deep-dive` — Opus, `maxTokens: 6144`, `maxDuration = 180`
- **Re-runnable**: each call receives `priorDives` so the model doesn't repeat itself. Focus hint optional.
- **Returns**: `DeepDiveResult` with `new_verbatims`, `hidden_fears`, `contradictions`, `sharper_triggers`, `micro_segments`, `buying_objections`, `meta_story`, `claude_notes`.
- **Stacker**: `appendDeepDive` (immutable append into `sub_avatar.deep_dives[]`)
- **UI**: focus input + button in expanded sub-avatar card, below awareness chips. Dive history displayed below.

### Phase G — Interactive gate output (gates 2-9)
- **Component**: `src/components/gates/SmartGateOutput.tsx` — recursive type-aware renderer
- **Dispatch**: strings (collapsible past 300 chars), `string[]` (pickable bullet list), `{quote,source,source_url,emotion}[]` (styled quote cards), `Record<string,unknown>[]` (stacked cards with auto-title from `name`/`title`/`label`/`headline`/`hook`), nested objects (left-border sections), top-level fields (collapsible `Section` with count badges)
- **Favorites**: ★/☆ per item, stored at `humanDecisions.picked[path]` as string arrays
- **Notes**: free-form textarea per gate → `humanDecisions.notes`, persisted and visible to downstream agents
- **Wired into** `src/app/project/[id]/gate/[gateId]/page.tsx` — replaces the old raw JSON `<pre>` dump

### Phase H — Raw Signal + Golden Nuggets (Gate 1)
- **Module**: `src/lib/avatars/rawSignal.ts` — deterministic (no LLM) n-gram + emotion extraction
- **Multi-language stopwords** (en/fr/es/de/it/pt), 100+ emotion regex patterns across 8 categories
- **N-gram tables**: unigrams → 5-grams, with source diversity tracking, min count 2
- **Emotion hits**: fear, frustration, hope, desperation, shame, exhaustion, urgency, skepticism
- **UI**: `src/components/gates/RawSignalView.tsx` — tab-based (phrases / trigrams / bigrams / words / emotion / verbatims) with ★ pickable golden nuggets, search, source filter
- **Wired into Gate1**: tab switcher (Sub-Avatars | ★ Raw Signal) in `Gate1AvatarExcavation.tsx`, picks persist via `handleRawSignalChange`
- **Pipeline**: Phase 2.5 in `runAvatarExcavation.ts` — runs after fetch, before analyzers. Rebuilt after gap-fill wave.

### Phase I — Deeper multi-pass research
- **Bumped per-source limits**: Quora 8→20, Forums 10→25, YouTube 8→16, SearchWide 6→15, analyzer input 80k→120k chars, analyzer output 6144→8192 tokens
- **Gap-fill wave** (Phase 3.5 in `runAvatarExcavation.ts`): after initial analyzers, Sonnet identifies underrepresented signal (missing emotions, demographics, triggers), generates 5-8 follow-up queries, runs Tavily searches, scrapes results, merges into raw signal + compile input
- **TikTok Apify scraper**: `POST /api/tiktok` using `clockworks/free-tiktok-scraper`, dual-mode (search + hashtag), returns organic comments. Source fetcher (`src/lib/sources/tiktok.ts`) upgraded to Apify-first with Firecrawl fallback. Requires `APIFY_TOKEN` env.

### Phase J — Security hardening
- **Security headers** in `next.config.ts`: X-Frame-Options DENY, HSTS 1yr, X-Content-Type-Options nosniff, Permissions-Policy, X-Robots-Tag noindex on /api/*
- **Source maps disabled** in production (`productionBrowserSourceMaps: false`)
- **Console.log stripped** from client bundle in production (TerserPlugin `drop_console`)
- **Global API rate limiting** in `proxy.ts`: 120 req/min per user (general), 30 req/min per user (heavy endpoints: generate, scrape, tiktok, avatars). In-memory sliding window with periodic cleanup.
- **Per-user invisible watermarking** (`src/lib/auth/watermark.ts`): zero-width Unicode encoding of HMAC user fingerprint. Applied to all gate outputs and project data at sync time (`/api/sync/gate-output`, `/api/sync/project`).
- **Watermark checker**: `POST /api/admin/watermark-check` — admin-only, extracts watermark from leaked text and matches to user.
- **Proxy matcher expanded** to all routes (not just /api/*).

### Phase L — Shopify Integration
- **API route**: `POST /api/shopify` — 4 modes: `detect` (is it Shopify?), `product` (fetch product JSON + reviews), `reviews` (reviews only), `catalog` (store product listing)
- **No API key needed** — uses Shopify's public `/products.json` and `/products/{handle}.json` endpoints
- **Review scraping**: 3 strategies — JSON-LD structured data → Judge.me widget API → regex fallback on HTML
- **Source fetcher**: `src/lib/sources/shopify.ts` — wired into `runSourceFetchers` as the 9th source type. Fetches products + reviews from known store URLs (discovery plan) + searches for competitor Shopify stores via Tavily.
- **Types**: `SourceType` union includes `'shopify'`, `SourceConfig` has `shopify: boolean`, `SourceDiscoveryPlan` has `shopify: { store_urls[], product_queries[] }`
- **Discovery prompt** updated: Marcus now plans Shopify store discovery alongside the other 8 sources
- **Auto-import in Gate 1**: Shopify URL input field in Core Avatar form. User pastes a product URL → detects store → fetches product title, description, price, variants, reviews → auto-fills Product and Niche fields + saves `productUrl` on Project
- **UI**: "Shopify Auto-Import" card with URL input, Import button, status feedback (green/red). Toggle in Source Excavators grid.
- **Full pipeline injection**: `ShopifyProductData` stored on `Project.shopifyData`. Every agent in every gate receives a `productContext` block with real product name, price, variants, images, reviews, tags.
  - Lead agent system prompt (`runGate.ts`): between `funnelContext` and `managerGuidance`
  - Manager review prompt: injected before `=== YOUR ROLE: MANAGER REVIEW ===`
  - Director (Léa) review prompt: injected before `=== YOUR ROLE: DIRECTOR REVIEW ===`
  - Sub-agents (`runSubAgents.ts`): injected before `=== YOUR CURRENT TASK ===`
- **Brand DNA extension**: `product_specs` (price, currency, variants, images, features) and `proof_inventory` (real testimonials from reviews, avg rating, total reviews) auto-populated from Shopify data during Brand DNA compilation. LLM also receives Shopify data in the compile prompt.
- **Rules enforced in prompts**: "Use REAL product name, REAL price, REAL reviews. Never invent features or claims not in the product data."

### Phase K — Funnel selector + sub-avatar switch (gates 2-9)
- **Funnel types** added to `Project` interface: `selectedFunnel?: FunnelType` (6 Schwartz awareness levels + retargeting)
- **Constants**: `FUNNEL_LABELS`, `FUNNEL_DESCRIPTIONS`, `FUNNEL_COLORS` in `src/lib/types/index.ts`
- **Sub-avatar switch**: `selectedSubAvatarId` on `Project`, selected in Gate 1, drives all downstream gates
- **UI**: `src/components/gates/GateContextBar.tsx` — combined funnel selector (6 color-coded buttons) + sub-avatar dropdown. Rendered via `contextBar` prop in `GateView`.
- **Prompt injection**: `funnelContext` block injected into ALL agent layers:
  - Lead agent system prompt (`runGate.ts` line 458)
  - Manager review prompt (before `=== YOUR ROLE: MANAGER REVIEW ===`)
  - Director (Léa) review prompt (before `=== YOUR ROLE: DIRECTOR REVIEW ===`)
  - Sub-agent system prompts (`runSubAgents.ts`, before `=== YOUR CURRENT TASK ===`)
- **Content**: funnel name + strategy description + focused sub-avatar details (name, nickname, description, category, triggers, verbatims)
- **Persistence**: both selections saved immediately to `Project` via `saveProject` in `GateContextBar`

### Production rebrand + bootstrap
- Rebrand "AutoEcom Lab" → "Pawen Command Center" in `layout.tsx` (metadata) + `page.tsx` (2× h1)
- Created all 9 Neon tables from scratch via `scripts/run-migrate.mjs` (one-off, against prod DB using `.env.local` DATABASE_URL)
- Seeded 13 users (`Sykss` as admin, 12 others as `user` role)
- Added `APP_PASSWORD` + `SESSION_SECRET` to Vercel prod (were missing — login was 500-ing)
- Deployed via `npx -y vercel@latest deploy --prod --yes`
- Verified `/api/auth/users`, `/api/auth/login`, `/api/admin/login` all return `ok:true` in prod

## Critical conventions / landmines

- **This is NOT the Next.js you know** — v16 has breaking changes. Before editing anything under `src/app/`, check `node_modules/next/dist/docs/` for the specific API. `middleware.ts` is now `proxy.ts`. Params are async (`await params`).
- **`SESSION_SECRET` is required** — `getSecret()` throws if missing or <32 chars. All protected routes die at boot if it's not set.
- **Env var changes on Vercel require a redeploy** — they do NOT hot-reload into running functions. After `vercel env add X`, always redeploy.
- **Login needs both** `APP_PASSWORD` env AND a row in `app_users` for that username. Missing either → 500 or "user not found".
- **Scripts don't auto-load `.env.local`** — only Next.js does. For `tsx`, `drizzle-kit`, any one-off script, use `npx -y dotenv-cli -e .env.local -- node script.mjs`.
- **Never wrap the DB client in a Proxy** — breaks NextAuth/libraries that introspect the adapter. Use plain `getDb()` lazy init instead.
- **Immutable append-only** for avatar enrichments — never mutate `sub_avatars[]` entries. Use `appendAwarenessVariant` / `appendDeepDive` which return new arrays.
- **Use existing agents/personas** — don't invent new ones. Gate sub-agent lists live in `src/lib/gates/registry.ts`; edit there, not inline.
- **Use `SmartGateOutput`** for any new gate display — don't reintroduce raw `<pre>{JSON.stringify(…)}</pre>`.
- **Opus 4.6 for creative/inferential gates** (avatars, copy, deep-dive), Sonnet 4.6 for review/structured work. Always enable prompt caching (`anthropic-beta: prompt-caching-2024-07-31`).
- **Watermarking is automatic** — every gate output + project synced to server gets per-user invisible watermarks. Don't strip zero-width characters from output text. Use `/api/admin/watermark-check` to trace leaks.
- **Rate limiting is in proxy.ts** — don't duplicate rate-limit logic in route handlers. The proxy handles global (120/min) and heavy endpoint (30/min) caps.

### Phase M — Adaptive Learning Engine
- **New module**: `src/lib/learning/` — types, capture, inject
- **IndexedDB v4**: two new stores — `goldOutputs` (indexed by gate/niche/project), `learningProfile` (single evolving doc)
- **Gold output capture**: 3 triggers:
  1. ★ pick in SmartGateOutput → `captureFromPick` (strongest signal)
  2. Manager/Director score ≥ 85% → `captureFromScore` (auto)
  3. Human approves gate → `captureFromApproval` (bulk)
- **Rejection tracking**: `captureRejection` updates learning profile with rejection reasons (FIFO, last 10)
- **Style extraction**: tone keywords (8 categories), avg pick length per gate — extracted from every pick
- **Prompt injection**: `buildLearningInjection` → injected into ALL 4 agent layers:
  - Lead agent system prompt (`runGate.ts`)
  - Manager review prompt
  - Director (Léa) review prompt
  - Sub-agent system prompts (`runSubAgents.ts`, 2 examples vs 3 for lead)
- **Gold output ranking**: scored by funnel match (30pts), capture type (picks=25, score=15, approval=10), recency (up to 20pts), review score
- **Learning profile prompt**: tells agents preferred tone, length, rejection reasons, approval rate
- **Graceful degradation**: empty string returned when no gold outputs or profile exist — zero impact on first run

### Phase N — Full Command Center Upgrade
- **Auto-Pipeline**: `src/lib/pipeline/autoPipeline.ts` — one-click run Gate 2→9. Auto-approves gates scoring ≥80%. Stops for human review when score is low. Progress bar on project page.
- **Multi-Variant Generation**: "Generate Variant" button on gate page. Runs alternate lead-agent compilation, stores up to 4 variants. Tab-based switching (Original/V1/V2/V3). Picks from any variant feed learning engine.
- **Performance Feedback**: `AdPerformance` type on Project. Input form on project page (CTR, CPA, ROAS, spend, conversions). Data injected into all agent prompts via `buildPerformancePrompt()` — agents see what actually converts.
- **Export System**: `src/lib/export/metaAdsExport.ts` — formats all gate outputs into Meta Ads structure. 3 export modes: JSON download, CSV download, clipboard copy. Extracts hooks, headlines, body copies, CTAs, ad variants from Gates 4-9.
- **Meta Ad Library**: `POST /api/meta-ads` — searches competitor ads via Tavily. UI on project page with search + results display. Competitor insights available for creative reference.
- **Cross-Niche Intelligence**: `src/lib/learning/nicheIntelligence.ts` — aggregates gold outputs by niche, extracts content patterns (length, structure, tone, testimonial usage). Injected into prompts as `=== NICHE INTELLIGENCE ===` when sufficient data exists (≥3 gold outputs per niche).
- **All injected into `buildLearningInjection()`**: gold outputs + user preferences + niche intelligence + performance data — single call, 4 layers of adaptive context.

### Phase O — Deep Research Intelligence Upgrade
- **Analyzer prompts rewritten**: extracts 18 signal dimensions (up from 8) — identity statements, language DNA, desire ladder (surface/real/hidden), buying journey signals, objection clusters, contradiction patterns, trust signals, emotional intensity peaks
- **Raw signal engine v2**: negation-aware emotion detection (skips "not a scam"), 15 emotion categories (up from 8: +desire, guilt, isolation, anger, envy, pride, helplessness), intensity scoring per pattern (1-3), 200+ patterns across en/fr/es/de
- **Identity marker extraction**: regex-based detection of "I am/I'm not/I want to be/people like me" patterns in en/fr/es — these are ad copy gold
- **Buying signal extraction**: comparison shopping, price sensitivity, purchase intent, recommendation seeking, urgency patterns
- **Golden sentence extraction**: full sentences scored by emotional intensity (multi-emotion + high-intensity markers), top 50 preserved
- **Smart phrase scoring**: n-grams ranked 0-100 by marketing value (frequency × source diversity × emotion overlap × identity signal × buying signal)
- **Compile prompt upgraded**: evidence-backed clustering (≥2 sources per sub-avatar), identity profiling (self-image/anti-identity/tribal), 5 hook types per sub-avatar (pattern-interrupt, empathy, curiosity, fear/urgency, aspiration), story arc with "twist" insight
- **Deep dive rewritten**: 7-dimension excavation (hidden fears, contradictions, identity map, linguistic DNA, transformation narrative, dark funnel, objection hierarchy with severity + counter-arguments). Each dimension has specific extraction criteria.
- **Types extended**: `SourceAnalysis` has 8 new optional fields, `EmotionCategoryV2` with 15 categories, `ScoredPhrase`, `IdentityMarkerHit`, `BuyingSignalHit` types, `DeepDiveResult` has 5 new structured fields, `RawSignal` has 4 new computed arrays

### Phase P — Signal Validation & Intelligence Layer
- **Cross-source signal validation** (`src/lib/avatars/crossSourceValidation.ts`): flattens all analyzer signals, clusters by fuzzy word-overlap similarity (60% threshold), scores confidence by source count (3+=HIGH, 2=MEDIUM, 1=LOW). Injected into compile prompt as `__signal_confidence` block. Runs as Phase 3.75 in pipeline.
- **Adversarial validation** (`src/lib/avatars/adversarialValidation.ts`): post-compile LLM pass ("research auditor") that stress-tests each sub-avatar — scores confidence 0-100, flags weak evidence, suggests merges. Applied to sub-avatar `recommendation_reason`. Runs as Phase 4.5A.
- **Verbatim quality auto-ranking** (`src/lib/avatars/verbatimRanking.ts`): deterministic scoring across 4 dimensions — emotional intensity (0-30), specificity (0-25), uniqueness (0-20), ad-readiness (0-25). Tags: high_emotion, specific_moment, identity, past_attempt, objection, buying_signal, transformation, question. Sub-avatar verbatims re-ordered by quality score. Runs as Phase 4.5B.
- **Dynamic source doubling**: after raw signal build, detects top-producing source (>30% of items AND >20 total). Generates 3 extra queries, runs Tavily searches, scrapes new URLs, appends to searchWide, rebuilds raw signal. Runs as Phase 2.75.
- **Few-shot quality calibration**: MEDIOCRE vs EXCELLENT extraction examples appended to analyzer system prompt — shows Claude the quality bar for verbatim extraction.
- **Swipe vocabulary** (`src/lib/avatars/swipeVocabulary.ts`): per sub-avatar extraction of power words, forbidden words, emotional anchors, metaphors, recurring phrases, identity phrases, objection language. `buildSwipeVocabularyPrompt()` for downstream gate injection. Runs as Phase 4.5C.
- **Competitor ad copy analysis** (`src/lib/avatars/competitorAnalysis.ts`): LLM prompt for analyzing Meta Ad Library scrapes. Deterministic `detectBasicPatterns()` for 10 hook types (question, number, testimonial, fear, curiosity, social proof, urgency, how-to, before/after, authority). `buildCompetitorInsightPrompt()` with overused angles, unexploited gaps, anti-angles.
- **Visual signal dashboard upgrade** (`src/components/gates/RawSignalView.tsx`): 4 new tabs — Scored Phrases (heat-mapped by marketing value 0-100), Golden Sentences (with emotion tags + intensity), Identity Markers (grouped by type: self-identify/anti-identify/aspiration/tribal), Buying Signals (grouped by type: purchase_intent/comparison/price_sensitivity/recommendation_seeking/urgency). Auto-selects best tab based on available data.

### Phase Q — Static Ad Studio (PRISM-style)
- **Creative Context Aggregator** (`src/lib/gates/creativeContextAggregator.ts`): builds a COMPLETE, non-lossy creative brief from ALL upstream gates (G1 sub-avatar + verbatims + swipe vocab, G2 deep dive, G3 root cause + mechanism, G4 top hooks scored, G6 concepts + headlines + body copies, Brand DNA, funnel position, Shopify data, performance data, competitor insights). `serializeCreativeContext()` formats for prompt injection. Zero information loss between gates.
- **Static Preset System** (`src/lib/gates/staticPresets.ts`): 8 preset types — Before/After, Feature Highlight, Lifestyle/Product in Context, Problem/Agitation, Social Proof/Testimonial, Statistique/Data Visual, Unboxing/Product Shot, Us vs Them. Each preset has specialized prompt template, visual composition rules, awareness-level copy adaptations, and required upstream elements. `buildPresetPrompt()` generates system+user prompt per preset. `preCheckCongruence()` validates preset+headline+awareness combinations before generation with severity levels (critical/warning/info). `extractHeadlineCandidates()` pulls and scores A/B/C headline options from upstream gates.
- **Gate 7 rewritten** (`src/lib/gates/gate7.ts`): 3 sub-agents (emotion-preset-agent for Before/After+Problem/Agitation+Social Proof+Us vs Them, product-preset-agent for Feature Highlight+Lifestyle+Statistique+Unboxing, headline-optimizer). Produces 24 briefs (3 per preset × 8 presets) with 3 scored headline options (A/B/C) each. Full creative context injected via aggregator. Headline optimizer scores all headlines on Curiosity/Clarity/Punch and identifies cross-preset gaps.
- **Gate 8 rewritten** (`src/lib/gates/gate8.ts`): consumes Gate 7 preset briefs + user selections. Generates fal.ai configs for all briefs across 3 formats (feed 1080×1080, story 1080×1920, vertical 1080×1350). 72+ configs, 144+ images. Model selection (flux-pro for photorealistic, flux/dev for creative). Prompt engineering rules: subject → environment → lighting → mood → style → camera → quality → color grading. Awareness-locked text overlays. Pre-generation congruence validation.
- **Static Ad Studio UI** (`src/components/gates/StaticAdStudio.tsx`): PRISM-style interface — left sidebar with 8 preset categories (icon, name, quality badge, brief count, picked count), main content with grid/detail views. Grid view: brief cards with color palette preview, A/B/C headline selector with scores, visual direction tags, ★ pick button. Detail view: expanded brief with full headline scoring, color palette swatches, visual direction (scene, mood, lighting, camera, composition, focal point), fal.ai generation prompt, negative prompt, layout specs. Rankings panel, creative director notes. Headline selections + picked briefs persisted in humanDecisions.
- **Wired into gate page**: `StaticAdStudio` replaces `SmartGateOutput` for gate7 and gate8.

### Phase R — Live Template Editor
- **Route**: `/project/[id]/templates` — project-scoped tool page (not a gate)
- **Rendering**: `liquidjs` client-side for instant re-render, no server round-trip per keystroke
- **Split-pane editor** (`src/components/templates/TemplateEditor.tsx`): left 45% (Variables/Code/History tabs + AI chat bar), right flex-1 (live iframe preview with responsive toggle desktop/tablet/mobile)
- **AI editing**: `/api/template-edit` route using Claude Sonnet 4.6, streaming SSE, prompt caching. Natural language instructions → complete modified template. Edit history with undo.
- **Content injection** (`src/lib/templates/contentInjector.ts`): auto-detects `{{ var }}` in Liquid source, fuzzy-maps to CreativeContext paths (43 patterns: headline→hooks, product_name→product.name, mechanism→brand.mechanism_name, etc.)
- **Template types** (`src/lib/templates/types.ts`): 6 categories (advertorial, landing_page, product_page, email, squeeze_page, custom). Template stores liquidSource, variableMap, editHistory[], compiledHtml.
- **IndexedDB v5**: `templates` store with `by-project` and `by-category` indexes. CRUD: `saveTemplate()`, `getTemplate()`, `getProjectTemplates()`, `deleteTemplate()`.
- **Gallery** (`src/components/templates/TemplateGallery.tsx`): grid of template cards with category badge, code preview, variable count, edit count. Import, delete, duplicate, starter template picker.
- **Pipeline link**: "Templates" in sidebar footer between Brand DNA and All Projects.

### Phase S — Template Powerups + Image Generation
- **5 starter templates** (`src/lib/templates/starterTemplates.ts`): Advertorial (ZAK 7-block), Landing Page (hero+benefits+CTA), Product Page (gallery+variants+reviews), Email (promo sequence), Squeeze Page (lead capture). All mobile-responsive with `{{ variable }}` integration.
- **Export buttons** in TemplateEditor header: Download HTML, Download Liquid source, Copy HTML to clipboard.
- **Duplicate template**: "dup" button on gallery cards, creates instant copy.
- **Starter template picker**: "Starter Templates" button in gallery, one-click to import and edit.
- **Image generation in StaticAdStudio** (Gate 7/8): Generate buttons per format (1080x1080 feed, 1080x1920 story, 1080x1350 vertical) on detail view. "Generate All Picked" batch button in sidebar. Generated images displayed inline (thumbnails on grid, full gallery in detail). Uses `/api/imagegen` fal.ai proxy (flux-2-pro model). Images persisted in `humanDecisions.generatedImages`.

### Phase T — Ad Cloner (Gate 1.1)
- **Route**: `/project/[id]/competitor-intel` — tabbed page (Ad Cloner primary, Reverse Engineer secondary)
- **API**: `POST /api/ad-cloner` — 3-step workflow, each step a separate call for progress tracking:
  1. **Scrape** (`step: 'scrape'`): Apify `apify~facebook-ads-scraper` actor (primary), Firecrawl + Claude Sonnet parsing (fallback). Deduplicates by image URL. Accepts brand name or Meta Ad Library URL. Requires `APIFY_TOKEN` env (falls back to `FIRECRAWL_API_KEY`).
  2. **Translate** (`step: 'translate'`): Claude Sonnet 4.6 with prompt caching. Translates headline/body/CTA to target language. Generates `image_description` in English for AI image regeneration (includes translated text overlays).
  3. **Generate** (`step: 'generate'`): fal.ai `nano-banana-pro` with img2img (strength 0.7 to keep 30% original structure), falls back to `flux-pro`. Requires `FAL_AI_API_KEY` env.
- **UI** (`src/components/gates/AdCloner.tsx`): Step workflow indicator (Scrape → Translate → Generate). Brand/URL input. Grid of ad cards: original image left / generated image right, original copy vs translated copy below. Per-ad "Generate Image" button + "Generate All Images" batch. Download individual images or all as JSON.
- **Page** (`src/app/project/[id]/competitor-intel/page.tsx`): Tab switcher — Ad Cloner (orange, default) and Reverse Engineer (teal, existing CompetitorIntel component).
- **Env vars needed**: `APIFY_TOKEN` (Apify scraper), `FAL_AI_API_KEY` (image generation). Both optional with graceful fallbacks, but `FAL_AI_API_KEY` required for image gen step.

## Dev workflow

```bash
npm run dev                    # Turbopack, localhost:3000
npx -y vercel@latest env pull .env.local --yes    # refresh env from Vercel
npx -y dotenv-cli -e .env.local -- node scripts/X.mjs   # one-off scripts
npx -y vercel@latest deploy --prod --yes          # deploy to prod (no git remote)
npx -y vercel@latest env ls production            # check prod env vars
```

**No git remote configured** — deploys go direct via CLI from the working dir. Nothing has been committed since `61f54ff`.

## Known pending work

- Commit everything (nothing pushed since `61f54ff`)
- `APP_PASSWORD` not set on Vercel `preview` (blocked on `git_branch_required` — low prio, no previews anyway)
- Consider setting up a git remote so preview deploys and rollbacks become possible
