# Phase V — Deferred / follow-up items

- [ ] **SSE streaming for agent turns**. Today `/api/conversations/[id]/message` returns the whole chain in one response (can take 30-60s). Add `GET /api/conversations/[id]/stream` that emits each agent token as it arrives. Client swaps from polling to the stream when flag is on.
- [ ] **AUTO_CONVERSATION_ON_DISTILL trigger-site**. Flag exists and dispatch works, but nothing calls `startSystemConversation` after `/api/admin/distill` completes. Either hook into the distill route response path or add a lightweight post-distill daemon. Short conv (3-4 turns) where the freshly-distilled agent greets the team with its top insight.
- [ ] **Admin tile for `/api/admin/conversations-stats`**. Endpoint exists; add a card on the god panel overview tab rendering: 24h count, 7d count, total cost, avg messages/conv. Also a "watch live" link to any active conversation.
- [ ] **Per-project soft cap UI**. Server has `countActiveConversationsForProject` — plumb it through `/api/conversations` list response as a `warning: "3+ active"` field. Page shows toast.
- [ ] **Ping-pong detector sensitivity**. Current detector needs exactly A-B-A-B over 4 agent turns. Also trigger on 3-turn patterns where two agents tagged each other twice with no substantive shift.
- [ ] **Scout integration inside chat**. Today a `@scout` tag yields a canned stub message. Add a background async that runs the real Scout orchestrator after the canned message, then drops a follow-up agent message with Scout's results via `startSystemConversation`-style flow.
- [ ] **Full history pagination**. `loadThread` returns every message. For long-running convs (near cap), paginate and render older batches on scroll-up.
- [ ] **Rollback on injected identity override attempts**. V.11 item 23 is mitigated via prompt rule, but we don't detect/log successful injections. Add a post-response regex that flags replies containing `I am an AI language model` / `my instructions` / etc.

---

# Phase U — Deferred / follow-up items

## Short (next iteration)

- [ ] **Scout ↔ sub-agent prompt integration**. The Scout API (`/api/scout`) + client orchestrator (`src/lib/agents/scout.ts`) are live and tested. What's NOT done: updating sub-agent prompt templates in `src/lib/agents/runSubAgents.ts` so sub-agents can EMIT a `{{scrape-request: intent}}` marker that runSubAgents detects and dispatches. Today Scout is callable from any admin/user code path but no gate prompts ask for it. Concrete task: (1) add a `SCRAPE_REQUEST` protocol section to sub-agent system prompts (behind autonomous flag), (2) post-parse each sub-agent output in `runSubAgents`, (3) on detection, call `runScout(...)` + merge results into peer outputs via append-only writes.
- [ ] **Per-project Meta campaign UI**. U.3a cron reads `project.metaCampaignIds[]` from the mirrored JSONB but there's no UI to set it. Add an input on `/project/[id]/ad-performance` that persists `metaCampaignIds: string[]` via the existing sync/project route.
- [ ] **Constitution history diff view**. `agentConstitutions` store keeps only latest version in IDB. Client-side `previousVersion` field on `AgentConstitution` type is populated manually only. Add a soft history: when saving v+1, keep v in a separate `agentConstitutionsHistory` store (IDB v9) and display a version picker + diff on `/admin/constitutions`.
- [ ] **Scout-from-cron path**. U.3a's cron currently enqueues a rerun row; it does NOT run Scout for the inferred gate before the rerun executes. Wire: in `meta-perf` cron, on CRITICAL drop, also enqueue a Scout job in parallel so fresh intel is in place when the rerun fires.

## Medium (next phase or V)

- [ ] **Full session-based auth on `/api/admin/distill`**. Currently accepts x-admin-token OR cookie-session admin. Over time, migrate ADMIN_PASSWORD-based tooling to cookie-session-only and drop the x-admin-token acceptance.
- [ ] **Drop-detection per ad_id**, not per campaign. Current route queries campaign-level insights. Per-ad granularity is more sensitive to creative fatigue. Requires `project.metaAdIds[]` or linking through `AdAttribution` rows (type exists in `src/lib/meta-ads/types.ts` but no storage yet).
- [ ] **External cron option for 2h cadence**. Vercel Hobby caps crons at 1/day (Q-006). The route is idempotent and CRON_SECRET-gated; hook up a GitHub Action on a 2h cadence OR a free-tier cron-job.org poller to restore the brief's cadence without upgrading Vercel to Pro.
- [ ] **AUTO_PUSH_CREATIVES implementation (U.4)**. Brief mentions pushing re-run outputs to Meta. Q-003 explicitly deferred to a future phase. When enabled, re-run output goes through `metaAdsExport` then a new route that calls Meta Marketing API to upload a creative and duplicate the underperforming ad.
- [ ] **Scout persona in AGENT_PERSONAS**. The strict `AgentId` union is used across goldOutputs, memory, learningProfile. Adding `'scout'` to it has wide ripple effects. Deferred. Today Scout is an orchestrator module, not a first-class persona.

## Long / nice-to-have

- [ ] **Training chunks server mirror**. Chunks live only in IndexedDB → distillation requires the uploading user's device. A `training_chunks_mirror` table would enable distillation from a fresh admin device.
- [ ] **Streaming distillation**. 45-55s calls are acceptable but a streaming path (SSE) would give a nicer admin UI experience.
- [ ] **Scout cost actuals**. `TOOL_COST_USD` estimates are rough. Wire real costs from each source API's billing export into the ledger for a true cost dashboard.
- [ ] **Rollback constitution on DR-principle violation**. Q-005 default says Léa auto-rollbacks. Not yet implemented — today the constitution prompt instructs the model not to violate, but there's no automated post-compile check.

## Manual smoke tests to redo after Phase U deploys

Run one at a time with `npx -y dotenv-cli -e .env.local -- node scripts/<name>.mjs`:

1. `test-distill.mjs` — single persona (Marcus) synthetic distillation
2. `test-distill-all.mjs` — all 6 personas (~4 min total)
3. `test-phase-u-routes.mjs` — cron/constitution/rerun/scout routes
