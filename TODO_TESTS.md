# Phase U.4 — Live integration tests (run after adding API keys)

All adapters below were built without the corresponding API keys present. Each one has been type-checked and compiled (`npm run build` exits 0), and each is wired through the registry + fetch route + scraping-health dashboard. The tests in this file are the **live smoke tests** to run once you've added the keys to Vercel prod.

## 0. Prerequisites

Add the following env vars on Vercel prod (`npx -y vercel@latest env add NAME production`) and redeploy:

| Env var | Required by | Notes |
| --- | --- | --- |
| `EXA_API_KEY` | Exa search | https://dashboard.exa.ai |
| `BRAVE_API_KEY` | Brave search (fallback) | https://brave.com/search/api — optional but recommended |
| `BRIGHTDATA_API_KEY` | Bright Data Reddit + Quora | https://brightdata.com |
| `BRIGHTDATA_DATASET_ID_REDDIT` | Optional override — defaults to a built-in dataset id | |
| `BRIGHTDATA_DATASET_ID_QUORA` | Optional override | |
| `TIKAPI_KEY` | TikTok | https://tikapi.io |
| `RAINFOREST_API_KEY` | Amazon (all marketplaces) | https://www.rainforestapi.com |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | https://console.cloud.google.com/apis/library/youtube.googleapis.com (free 10k units/day) |
| `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` | Reddit OAuth (secondary) | https://www.reddit.com/prefs/apps → "script" |
| `REDDIT_USER_AGENT` | Reddit OAuth | optional — defaults to `web:pawen-command-center:v1.0 (by /u/pawen_bot)` |
| `VOYAGE_API_KEY` | Embeddings (U.4.7) | https://dash.voyageai.com — optional; falls back to simhash stub |
| `META_ACCESS_TOKEN` | Meta Graph ads_archive | already set in prod, now actually used |
| `USE_NEW_SCRAPING_STACK=1` | Flip the whole new stack on | set this **last** after you've verified the dashboard shows green |
| `NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1` | Client-side flag (same) | needed because client-side source files read it too |

Redeploy after env changes: `npx -y vercel@latest deploy --prod --yes`

## 1. Check the health dashboard

Open `https://pawen-command-center.vercel.app/admin/scraping-health`. Every provider you've configured should show **HEALTHY** (green). Providers with missing env vars show **DOWN** with `missing env: KEY_NAME`.

## 2. Per-adapter live tests

For each adapter, run the corresponding command. Canonical test query: `probiótico perro senior` (Spanish senior dog probiotics). Adjust marketplace / country / language as noted.

All commands assume you're in `pawen-command-center/` with `.env.local` pulled from prod (`npx -y vercel@latest env pull .env.local --environment=production --yes`).

### 2.1 Exa search
```bash
npx -y dotenv-cli -e .env.local -- node -e "
(async()=>{
  const { ExaAdapter } = await import('./src/lib/sources/providers/exaAdapter.ts');
  const a = new ExaAdapter();
  const r = await a.search('probiótico perro senior reseñas', { maxResults: 10, country: 'ES' });
  console.log('Exa:', r.length, 'results'); console.log(r.slice(0,3).map(x=>x.url));
})();"
```
Pass: ≥ 8 results, at least 3 URLs visibly relevant (amazon.es / shopify / forums).

### 2.2 Brave search (fallback)
```bash
# Same as above but swap to BraveAdapter
```
Pass: ≥ 10 results. (Brave's free tier → this costs 1/2000 of your monthly budget.)

### 2.3 Firecrawl
```bash
curl -sS -X POST "$PROD/api/scrape" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  -d '{"url":"https://www.akc.org/expert-advice/health/probiotics-for-dogs/"}' | jq '.markdown | length'
```
Pass: returns a number ≥ 10_000 (AKC article is rich). Second call within 12h should be cached — `SELECT * FROM scrape_cache` in Neon shows an entry with `hit_count > 0`.

### 2.4 Bright Data Reddit
```bash
curl -sS -X POST "$PROD/api/scraping/fetch" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  --cookie "$SESSION_COOKIE" \
  -d '{"source":"reddit","plan":{"subreddits":["dogs","DogAdvice","dogfood"],"queries":["senior dog probiotic"]},"language":"en-US"}' | jq '.data.itemCount'
```
Pass: returns ≥ 10 posts. Each item has a `comments` array with ≥ 3 comments. If 0, check Bright Data dashboard for the dataset snapshot status — the trigger may be slow on first use.

### 2.5 Bright Data Quora
```bash
# Same shape, source=quora, queries like "best probiotic for senior dog"
```
Pass: ≥ 5 questions with ≥ 3 answers each.

### 2.6 TikAPI TikTok
```bash
curl -sS -X POST "$PROD/api/scraping/fetch" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  --cookie "$SESSION_COOKIE" \
  -d '{"source":"tiktok","plan":{"hashtags":["dogprobiotic","seniordoghealth"],"search_queries":["senior dog probiotic benefits"]},"language":"en-US"}' | jq '.data.items | length'
```
Pass: ≥ 15 videos, each with ≥ 10 comments.

### 2.7 Rainforest Amazon (amazon.es)
```bash
curl -sS -X POST "$PROD/api/scraping/fetch" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  --cookie "$SESSION_COOKIE" \
  -d '{"source":"amazon","plan":{"product_queries":["probiótico perro senior"],"marketplace":"amazon.es"},"language":"es-ES"}' | jq '.data.items | length'
```
Pass: ≥ 3 products, each with ≥ 10 reviews. Verify marketplace switching works: re-run with `"marketplace":"amazon.de"` — different products should appear.

### 2.8 YouTube Data API
```bash
curl -sS -X POST "$PROD/api/scraping/fetch" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  --cookie "$SESSION_COOKIE" \
  -d '{"source":"youtube","plan":{"video_queries":["senior dog dental health","dog probiotic benefits"]},"language":"en-US"}' | jq '.data.items | length'
```
Pass: ≥ 10 videos, each with `comments_scraped` ≥ 20.

### 2.9 Reddit OAuth (secondary provider)
```bash
# Flip Bright Data off temporarily (unset BRIGHTDATA_API_KEY in .env.local) and rerun 2.4.
# The registry should fall through to RedditOAuthAdapter.
```
Pass: posts return, health dashboard now shows `reddit-oauth` HEALTHY.

### 2.10 Meta Graph ads_archive
```bash
curl -sS -X POST "$PROD/api/meta-ads" -H "x-admin-token: $ADMIN" -H "Content-Type: application/json" \
  --cookie "$SESSION_COOKIE" \
  -d '{"query":"senior dog probiotic","niche":"pet supplements","country":"US","limit":100}' | jq '.totalFound'
```
Pass: `source: "meta-graph"` in the response. `totalFound` ≥ 50. Ads in `raw[]` have `adCreativeBodies` populated. (Tavily fallback returns `totalFound` ~ 0-3 — so the quality jump is visually obvious.)

### 2.11 Voyage embeddings
```bash
npx -y dotenv-cli -e .env.local -- node -e "
(async()=>{
  const { VoyageEmbeddingAdapter } = await import('./src/lib/sources/providers/voyageEmbeddingAdapter.ts');
  const v = new VoyageEmbeddingAdapter();
  const r = await v.embed(['senior dog probiotic','perro senior probiótico']);
  console.log('dims:', r[0].length);
  const cos = (a,b)=>{let d=0,na=0,nb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]}return d/(Math.sqrt(na)*Math.sqrt(nb))};
  console.log('cos EN vs ES:', cos(r[0], r[1]).toFixed(3));
})();"
```
Pass: dims = 512. cos(EN, ES translations) ≥ 0.70 — confirms cross-lingual semantic alignment.

## 3. End-to-end smoke — one real gate run

Once 2.1-2.11 all pass:

1. Flip `NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1` and `USE_NEW_SCRAPING_STACK=1` on Vercel prod. Redeploy.
2. In the god panel, run Gate 1 on a throwaway test project (niche: `senior dog health`, market: `Spain`, language: `es-ES`).
3. Watch `/admin/scraping-health` — every enabled provider should show green with `calls24h > 0`.
4. Open the Gate 1 output — sub-avatars should have verbatims from Amazon reviews + Reddit + TikTok, not blank.
5. After 24h of real usage, check `/admin/scraping-health` for the `avgUtilization` column. Any source < 5% over 10 runs → investigate + consider muting.

## 4. 30-day observation → cleanup

Per `spec.md` U.4.10:
- Remove `TAVILY_API_KEY` and `APIFY_TOKEN` from Vercel prod.
- Delete `src/lib/sources/_legacy/` (if created during refactor — currently the legacy code still lives inline in `reddit.ts` / `tiktok.ts` / etc. with an `if (isNewScrapingStackOn())` short-circuit at the top; delete the else branches).
- Remove the `USE_NEW_SCRAPING_STACK` flag (make it the default).

## 5. Quick sanity grep after keys are added

```bash
# Confirm every adapter class loaded
grep -r "class .*Adapter" src/lib/sources/providers/

# Confirm registry exports all factory functions
grep -E "export async function get(Search|Scraper|Social|Video|Ecom|MetaAds|Embedding)Provider" src/lib/sources/providers/registry.ts

# Confirm health records are flowing
# (after running a few live tests above, this should return rows)
# In Neon SQL editor:
#   SELECT source, provider, success, latency_ms FROM scrape_health ORDER BY created_at DESC LIMIT 20;
```
