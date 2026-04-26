# PAWEN Worker — Railway deployment

This is the **long-running Inngest worker** that runs the avatar
excavation pipeline. Hosted on Railway (no Vercel function-duration
cap). Replaces the `/api/inngest` HTTP `serve()` handler that kept
hitting the 800s cap on rich niches.

Per [Inngest Connect docs](https://www.inngest.com/docs/setup/connect):
> Step execution is not bound by platform http timeouts.

## Architecture

```
Vercel (UI + /api/avatars/start)  ──event──►  Inngest Cloud
                                                     │
                                            persistent WebSocket
                                                     │
                                                     ▼
                                         Railway worker (this app)
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                              Vercel /api/scraping/fetch   Vercel /api/generate
                              (BD scrape, 800s/call)        (Anthropic, 800s/call)
```

Each step.run() in the avatar-excavation function executes on
Railway with no timeout. Internal HTTP calls back to Vercel routes
each have their own 800s cap (Fluid Compute), which is plenty for
individual BD source scrapes or Anthropic LLM calls.

## Deploy steps (first time)

1. Push the repo to GitHub (any private repo).
2. Sign up at [Railway](https://railway.app) (login with GitHub, free).
3. **New Project → Deploy from GitHub repo → select your repo**.
4. Railway auto-detects the Dockerfile at `worker/Dockerfile`.
5. Set environment variables (Settings → Variables). Copy from your Vercel project settings — the worker needs the same secrets:
   - `INNGEST_EVENT_KEY` (from Inngest dashboard)
   - `INNGEST_SIGNING_KEY` (from Inngest dashboard)
   - `DATABASE_URL` (Neon pooled URL)
   - `ANTHROPIC_API_KEY`
   - `BRIGHTDATA_API_KEY`
   - `BRIGHTDATA_DATASET_ID_REDDIT_POSTS` (and 14 other BD dataset IDs)
   - `VOYAGE_API_KEY`
   - `EXA_API_KEY`
   - `FIRECRAWL_API_KEY`
   - `BLOB_READ_WRITE_TOKEN`
   - `SESSION_SECRET` (same as Vercel)
   - `META_ACCESS_TOKEN`, `FAL_AI_API_KEY` (optional)
   - `NEXT_PUBLIC_USE_NEW_SCRAPING_STACK=1`
   - `USE_NEW_SCRAPING_STACK=1`
   - `FORCE_TWO_PASS_COMPILE=1`
   - `DISABLE_GAP_FILL=1`
   - `DISABLE_SOURCE_DOUBLING=1`
   - `DISABLE_ADVERSARIAL=1`
   - `BRIGHTDATA_DISABLE_YOUTUBE_COMMENTS=1`
6. Deploy. Logs should show `[worker] connected to Inngest cloud`.
7. **In the Inngest dashboard** (https://app.inngest.com): your existing app `pawen-command-center` should now show TWO workers connected — the Vercel `/api/inngest` HTTP handler AND the Railway connect worker. Inngest will route step executions to whichever is healthier; the Railway worker has no timeouts so it'll handle long steps.

## Cost

Railway Hobby plan: $5/mo, includes $5 of compute credit. With the
current Pawen workload (~5-10 G1 runs/day, each 15-25 min compute),
expected real cost: ~$2-5/mo.

## Local development

```bash
cd worker
npm install
# Copy .env from your Vercel pull
cp ../.env.local .env
npm start
```

The worker will connect to your existing Inngest cloud app and
process events. Useful for debugging without redeploying.
