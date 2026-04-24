# Scraping Engine Audit — before Phase W

**Date**: 2026-04-25
**Scope**: every source under `src/lib/sources/` + their fronting API routes
**Test query**: "probiótico perro senior" (Spanish-language senior dog probiotics) — a narrow niche in a non-English market, representative of what Pawen actually processes
**Method**: read code + env inventory + 12 live HTTP calls to prod (`https://pawen-command-center.vercel.app`) with a logged-in admin session
**Verdict**: **🚨 Scraping engine is currently NON-FUNCTIONAL in prod.** 9 of 12 endpoints fail. Do NOT build Phase W on top until the three root causes below are resolved.

---

## Summary table

| # | Source | Route | Primary path | Fallback | Latency | Status | Items | Root cause |
| - | - | - | - | - | - | - | - | - |
| 1 | **Tavily search** | `/api/search` | Tavily `/search` | — | 1.3s | ❌ **432** | 0 | **Tavily plan usage exceeded** |
| 2 | **Firecrawl** | `/api/scrape` | Firecrawl `/v2/scrape` | — | 3.0s | ✅ 200 | 1 (45k chars) | healthy |
| 3 | **Reddit discover** | `/api/reddit` | Reddit OAuth or native | Apify | 1.2s | ⚠ 200 | **0** | Reddit creds missing → Apify, but Apify also dead |
| 4 | **Reddit subreddit** | `/api/reddit` | Reddit OAuth or native | Apify | 0.2s | ⚠ 200 | **0** | same — "Apify HTTP 403" |
| 5 | **Reddit search** | `/api/reddit` | Reddit OAuth or native | Apify | 0.3s | ⚠ 200 | **0** | same |
| 6 | **YouTube search** | `/api/youtube` | YouTube Data API v3 | Tavily + Firecrawl | 0.4s | ❌ **500** | 0 | `YOUTUBE_API_KEY not configured` + Tavily fallback also dead |
| 7 | **TikTok search** | `/api/tiktok` | Apify `clockworks/free-tiktok-scraper` | Tavily + Firecrawl | 1.4s | ❌ **502** | 0 | **Apify monthly usage limit exceeded** (403 platform-feature-disabled) |
| 8 | **Amazon search** | `/api/amazon-reviews` | Apify `junglee/amazon-product-scraper` | Tavily + Firecrawl | 0.4s | ❌ **502** | 0 | Apify 403 + Tavily fallback also dead |
| 9 | **Shopify detect** | `/api/shopify` | Public `/products.json` | — | 1.0s | ✅ 200 | 0 | healthy (test URL wasn't Shopify) |
| 10 | **Shopify product** | `/api/shopify` | Public `/products/{handle}.json` | — | 0.9s | ❌ **500** | 0 | returned HTML not JSON (same URL not a Shopify store — this is user input validation, not a break) |
| 11 | **Meta Ad Library** | `/api/meta-ads` | Tavily search on `facebook.com/ads/library` | — | 0.5s | ⚠ 200 | **0** | Tavily dead → no results |
| 12 | **BrandSearch** | `/api/brandsearch` | BrandSearch API | — | 0.4s | ❌ **400** | 0 | route requires `action` field (audit payload shape mismatch, route itself may be fine) |

**Working healthy**: 1 of 12 (Firecrawl). Shopify infra works but the test URL wasn't Shopify.
**Dead due to upstream**: 8 of 12.
**Degraded**: 3 (Reddit × 3) — not dead but returning 0 items because the fallback chain terminates at a dead Apify.

---

## Root causes (in priority order)

### RC-1 — Tavily plan usage exceeded 🚨 CRITICAL

Direct probe:
```
$ curl https://api.tavily.com/search ... { "api_key": "<key>", "query": "test" }
{"detail":{"error":"This request exceeds your plan's set usage limit. Please upgrade your plan or contact support@tavily.com"}}
```

The `TAVILY_API_KEY` env var is set and valid. The plan is over its monthly quota.

**Blast radius**: Tavily is the search substrate for **6 sources** — Quora (primary), YouTube (fallback), Amazon (fallback), TikTok (fallback), Shopify (competitor discovery), Meta Ad Library (primary). When Tavily is dead, every fallback path collapses in addition to the explicit primaries.

### RC-2 — Apify account over monthly limit 🚨 CRITICAL

Direct probe via TikTok test:
```
Apify call failed: 403 Forbidden
detail: { "error": { "type": "platform-feature-disabled",
                     "message": "Monthly usage limit exceeded..." } }
```

The `APIFY_TOKEN` is set. The account has hit its monthly compute quota, and Apify's platform has disabled feature execution until the next billing cycle or a plan upgrade.

**Blast radius**: Apify is primary for **TikTok** and **Amazon reviews**, and is the fallback that Reddit falls to when OAuth is not configured. With Apify dead, TikTok and Amazon produce zero items; Reddit also produces zero items (native path disabled, Apify path 403).

### RC-3 — `YOUTUBE_API_KEY` not configured on prod

`vercel env ls production` confirms this key is not set. The route at `src/app/api/youtube/route.ts:60` returns HTTP 500 with `"YOUTUBE_API_KEY not configured"`.

**Blast radius**: YouTube primary path is disabled → falls back to Tavily + Firecrawl. Normally this is usable (title+description, no comments). Right now Tavily is also dead, so YouTube is **100% broken**. The YouTube Data API has a free tier of 10,000 units/day — trivial to set up.

### RC-4 — `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` not configured on prod

`src/app/api/reddit/route.ts:30` reads these; if absent, `getRedditToken()` returns `null` and the native OAuth path is skipped. The comment at line 26 explicitly documents: *"Without them we fall back to unauthed public JSON (blocked from Vercel) → Apify."* Since Apify is also dead (RC-2), **Reddit is 100% broken**.

Free tier: register at https://www.reddit.com/prefs/apps (type: "script" or "web app"). 100 req/min limit. Zero cost.

### RC-5 — Meta Ads Library is a Tavily wrapper, not a first-party API

`src/app/api/meta-ads/route.ts:34-39` implements Meta Ads retrieval by asking Tavily to search `site:facebook.com/ads/library ...`. This is a brittle pattern: Tavily's crawler rarely has Meta Ad Library results indexed (ad library pages are JS-rendered and noindex in most regions), so even when Tavily is healthy the yield is ~0-3 ads per query.

`META_ACCESS_TOKEN` IS set in prod env — but the codebase never uses it for Ad Library queries. Meta's official Ad Library API (`https://graph.facebook.com/v19.0/ads_archive`) requires an access token but returns structured creative data. This is a design gap, independent of the quota issues above.

### RC-6 — Shopify shopping-discovery uses Tavily → collapses when RC-1 hits

`src/lib/sources/shopify.ts:191-207` uses Tavily to find competitor Shopify stores when no `store_urls` are provided by the discovery plan. When Tavily is dead, the fallback chain terminates with zero competitor discovery. Known-URL product fetching works (`/products.json` is public).

---

## Data quality observations (from what DID work)

### Firecrawl (`/api/scrape`)

- **Latency**: 3.0s for a 45k-char page (AKC article). Reasonable.
- **Output quality**: clean markdown, useful for the analyzer pipeline.
- **Weakness**: no observed caching layer. Hitting the same URL twice will cost twice. If Phase W plans to re-scrape competitor pages during conversations, add a short-TTL cache (or reuse the `scoutLedger` in Phase U).

### Shopify public endpoints

- Infrastructure works (Next.js route proxies correctly). Test URL was not a Shopify store — returned HTML, client got `Unexpected token '<'`. The route does not wrap this in a structured error; it propagates the JSON-parse failure. Minor UX fix: detect the non-JSON response and return `{ok:false, message:'Not a Shopify store'}`.

### Reddit discover — 0 subreddits

Even with Apify 403 dead, the discover endpoint failed to return ANY subreddits for "senior dog probiotic" — which is surprising because subreddit search is lightweight. Suggests the Reddit auto-discovery flow itself has a bug when OAuth is missing AND Apify fallback errors: the handler silently returns `{subreddits: []}` instead of surfacing the failure. File `src/app/api/reddit/route.ts` should bubble the underlying 403 so `fetchReddit` can set `error` on the `RawSourceData`. Today the pipeline gets `count:0` and can't tell the difference between "no relevant subs exist" and "every backend is 403".

### Meta Ads via Tavily — structural problem

Even before the quota issue, the Tavily-based Meta Ads search yields ~0-3 ads in practice and nearly zero for non-English niches. This is a design problem, not a quota problem. The right fix is a rewrite to use Meta Graph `/ads_archive` with `META_ACCESS_TOKEN`.

---

## Failure modes discovered during the test

| ID | Failure | Site | Severity | Fix |
| - | - | - | - | - |
| FM-1 | Reddit handler swallows Apify 403 | `src/app/api/reddit/route.ts` | MED | Bubble the Apify error through to the response so `fetchReddit` reports it in `RawSourceData.error` |
| FM-2 | Shopify route returns JSON parse error when upstream returns HTML | `src/app/api/shopify/route.ts` | LOW | Pre-check `Content-Type` header; return `{ok:false, message:'Not Shopify'}` |
| FM-3 | `/api/meta-ads` never returns the `ok:false` signal on Tavily failure | `src/app/api/meta-ads/route.ts` | MED | Route always returns HTTP 200 with `ads: []`; add a proper status |
| FM-4 | YouTube fallback assumes Tavily is healthy | `src/lib/sources/youtube.ts:194` | MED | When `YOUTUBE_API_KEY` is missing AND Tavily is dead, return an explicit error instead of 0 items silently |
| FM-5 | TikTok fallback detector confuses quota-exceeded with a normal "0 videos" | `src/lib/sources/tiktok.ts:252-262` | MED | Parse `platform-feature-disabled` / `Monthly usage limit exceeded` and expose a distinct error — currently users see "Firecrawl fallback also returned nothing" which misdirects the fix |
| FM-6 | Reddit `/api/reddit` emits 200 status code for auth/quota failures | `src/app/api/reddit/route.ts` | MED | Should emit 503 or 502 depending on the failure category — today status 200 with `posts: []` is indistinguishable from "no content available" |
| FM-7 | No central scraping health dashboard | — | HIGH for Phase W | Add `/admin/scraping-health` (or a tile on the god panel) that shows the last N fetch attempts per source, their success rates, latency percentiles, and the current env-var status for each provider |

---

## Recommendations — fix priority

### 🔴 Block Phase W on these three (cannot proceed without)

1. **Top up Tavily OR migrate to an alternative**
   - Fastest: upgrade the Tavily plan (single credit-card change, everything works again).
   - Resilient: migrate to a multi-provider search abstraction. Good alternatives: Brave Search API (free tier 2k/mo + $5/1k paid), SerpAPI ($75/mo for 5k), Google Custom Search API (100/day free). Implementation: add an adapter layer `src/lib/sources/searchProviders/` with Tavily, Brave, Serper implementations; `webSearch()` in `common.ts` picks the first one with a non-exhausted quota.

2. **Refill Apify OR migrate the critical actors**
   - Fastest: upgrade Apify plan.
   - Resilient: move TikTok comments to a cheaper provider (ScrapingBee, Bright Data, or direct reverse-engineered API). Move Amazon reviews to an alternative (Oxylabs, Rainforest API). Reddit fallback is not needed if RC-4 is fixed.

3. **Add `YOUTUBE_API_KEY` and `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`**
   - Both are free and 10-minute setups.
   - YouTube: https://console.cloud.google.com/apis/library/youtube.googleapis.com
   - Reddit: https://www.reddit.com/prefs/apps → "script" type → note Client ID + Client Secret.
   - `vercel env add YOUTUBE_API_KEY production` + `vercel env add REDDIT_CLIENT_ID production` + `vercel env add REDDIT_CLIENT_SECRET production`, then redeploy.

### 🟡 Fix before Phase W (quality + observability)

4. **Rewrite `/api/meta-ads` to use Meta Graph `/ads_archive`** using the already-present `META_ACCESS_TOKEN`. The current Tavily-based approach has inherent low yield even in steady state.
5. **Bubble upstream errors through source fetchers** (FM-1, FM-3, FM-4, FM-5, FM-6). Today a silent `items: []` is indistinguishable from "no content exists", which means the learning pipeline cannot tell when a source is genuinely dry vs. temporarily broken.
6. **Add a scraping-health admin page** (FM-7). For Phase W to trust source-dependent flows, the admin needs per-source success-rate and latency at a glance.
7. **Add a Firecrawl scrape cache** (12-24h TTL on competitor domain pages) so repeat scouting in conversations is cheap.

### 🟢 Nice-to-have

8. Test payload shape for `/api/brandsearch` — the route expects `action` in the body. The audit payload was wrong; route itself may be healthy. Re-test with `{action: 'search', query: '...'}` before drawing conclusions.
9. Parallelize the `scrapeMany` default (currently 8 concurrent) with a retry-on-429 backoff; when Tavily or Firecrawl wake back up the engine will ramp fast.
10. Consider deduplication across sources (the same URL surfacing from Tavily + Reddit + YouTube gets scraped by Firecrawl three times today).

---

## Env vars currently set on prod (for reference)

Present: `ANTHROPIC_API_KEY` · `APIFY_TOKEN` (quota-exceeded) · `FAL_AI_API_KEY` · `FIRECRAWL_API_KEY` (healthy) · `META_ACCESS_TOKEN` (unused for Ad Library) · `TAVILY_API_KEY` (quota-exceeded) · `BRANDSEARCH_API_KEY` · `DISCORD_WEBHOOK_URL` · `SHOPIFY_API_KEY` · `SHOPIFY_API_SECRET` · `BLOB_READ_WRITE_TOKEN` · `DATABASE_URL` · `SESSION_SECRET` · `ADMIN_PASSWORD` · `APP_PASSWORD` · `ALLOWED_ORIGINS` · `NEXT_PUBLIC_CONVERSATIONS_ENABLED`

**Missing (must add)**:
- `YOUTUBE_API_KEY` — YouTube primary path
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` — Reddit OAuth (avoids Apify dependency)
- `REDDIT_USER_AGENT` — optional but recommended

---

## Bottom line

Phase W should not begin until at minimum:
- RC-1 (Tavily) and RC-2 (Apify) are resolved (top up or migrate).
- RC-3 (YouTube key) and RC-4 (Reddit OAuth) are resolved (free + 10 min).
- FM-1, FM-3, FM-6 are fixed so the learning pipeline can distinguish real zeros from broken upstreams.

Until then, the autonomous pipeline (Phase U Scout, Phase V conversations that invoke Scout) will appear to run but feed downstream agents empty signal, which will silently degrade every output. The cost of building Phase W on this foundation is compounding misleading data, not a broken build.
