# Debug runbooks

Quick incident response playbooks. Format: symptom → diagnosis → fix.

## R-1 — Prod returns 503 "Maintenance en cours"

**Symptom**: every request to `pawen-command-center.vercel.app` returns the Offline HTML page.

**Diagnosis**: global kill switch is on (`KILL_SWITCH = true` in `src/proxy.ts:53`).

**Fix paths**:
- Admin tooling bypass: send `x-admin-token: $ADMIN_PASSWORD` header.
- Cron bypass: send `x-cron-secret: $CRON_SECRET` or `Authorization: Bearer $CRON_SECRET`.
- Full disable: edit `src/proxy.ts` → `KILL_SWITCH = false` → redeploy.

## R-2 — Scraping returns 0 items across the board

**Symptom**: Gate 1 produces empty raw signal; all source tabs show nothing.

**Diagnosis checklist**:
1. Open `/admin/scraping-health`.
2. Check providers — any DOWN? Look at `envVarMissing`.
3. Check last errors in per-source table.
4. Likely causes in order: (a) provider quota exhausted (check vendor dashboard); (b) env var revoked/expired.

**Fix**: see `SCRAPING_AUDIT.md` RC-1/RC-2 for root causes; add/rotate keys; redeploy.

## R-3 — Gate run produces an empty output

**Symptom**: Gate 1-9 completes but the SmartGateOutput is empty / shows "raw content" only.

**Diagnosis**:
1. Open the gate page with devtools → Network tab.
2. Look at the last `/api/generate` call — was the response `{ content: "" }` or was it cut off?
3. Check the generation log (the "log" dropdown on the gate page) — look for reviewer failures.

**Common causes**:
- Opus truncated at 32k output tokens. Check `maxTokens` in the call site.
- Sub-agent backfill didn't run (Phase T regression). Check `runGate.ts:960+` for the backfill logic.
- Brand DNA congruence rejected the output. Check `congruenceResult` in IDB.

## R-4 — Conversations feature disabled banner but flag is on

**Symptom**: `/project/[id]/agent-chat` shows "Conversations feature is not enabled".

**Diagnosis**: the client-side flag check reads `process.env.NEXT_PUBLIC_CONVERSATIONS_ENABLED`. Even if set in Vercel, a redeploy is required for the inline value to take effect.

**Fix**: `vercel env pull .env.local --environment=production --yes` → verify the var → `npx -y vercel@latest deploy --prod --yes`.

## R-5 — Distillation route returns 502 "Anthropic error"

**Symptom**: clicking Distill on `/admin/distillations` → spinner → 502.

**Diagnosis**:
1. Check `ANTHROPIC_API_KEY` is set in prod env.
2. Check token usage on the Anthropic dashboard — free tier quota exhausted?
3. Check the error `detail` field in the response — it has the upstream message.
4. Typical culprits: `rate_limit_error`, `overloaded_error`, `invalid_api_key`.

**Fix**: for rate limits, wait or upgrade tier. For invalid key, rotate the env var + redeploy.

## R-6 — Meta perf cron fails silently

**Symptom**: expected auto-rerun row in `rerun_queue` after a drop, nothing arrived.

**Diagnosis**:
1. `SELECT * FROM ad_performance_snapshots ORDER BY pulled_at DESC LIMIT 20;` — any rows today?
2. `SELECT * FROM audit_log WHERE action = 'phase_u.meta.perf_pull' ORDER BY created_at DESC LIMIT 5;` — cron executed?
3. Check projects have `metaCampaignIds` set on `projects_mirror.data`.
4. Check Meta access token validity: `curl "https://graph.facebook.com/me?access_token=$META_ACCESS_TOKEN"`.

**Fix**: token expiry is most common. Regenerate via Facebook for Developers.

## R-7 — IndexedDB upgrade stuck on `Blocked` event

**Symptom**: user reports "dashboard won't load" after an app update.

**Diagnosis**: an older tab has the DB open at a lower version, blocking the upgrade.

**Fix**: instruct user to close all Pawen tabs + reload. If desperate, they can run `await indexedDB.deleteDatabase('pawen-command-center')` in devtools — but this nukes local state (server mirror restores on reload).

## R-8 — New provider adapter not picked by registry

**Symptom**: added env var, redeployed, but `/admin/scraping-health` still shows provider DOWN.

**Diagnosis**:
1. Confirm the env var is really set: `npx -y vercel@latest env ls production | grep <VAR_NAME>`.
2. Redeploy — env changes don't hot-reload.
3. The `HEALTH_TTL_MS = 60000` cache in `registry.ts` — wait 60s, reload the health page.
4. Check the adapter's `isHealthy()` — it only checks env presence, not a live call. If the key is set but invalid, health shows HEALTHY but live calls 401.

**Fix**: run the live smoke test from `TODO_TESTS.md` §2 for that provider.

## R-9 — Conversation cost climbs faster than expected

**Symptom**: `costUsd` on `/admin/conversations-stats` jumps $1-$3 per conversation.

**Diagnosis**: the dispatch loop chains up to `maxChainLength: 5` agent turns per user post. If the agents ping-pong without closing, 5 Opus turns = ~$0.20-0.50. Multiple posts = compound.

**Fix**:
- Lower `maxChainLength` in the route (currently hardcoded 5).
- Lower `CONVERSATION_COST_CEILING_USD` (default 5).
- Tune `detectPingPong` sensitivity (currently A-B-A-B over 4 turns).

## R-10 — Session cookie rejected after minor domain change

**Symptom**: users get logged out after switching between `sykss-agency.vercel.app` and `pawen-command-center.vercel.app`.

**Diagnosis**: session cookies are domain-scoped. Cross-alias sessions don't persist.

**Fix**: both URLs point to the same deployment — users just need to re-login per-domain. Not a bug. Acceptable UX for admins.
