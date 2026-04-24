# Phase U — Blockers / Open Questions

Format: one H3 per question. Flip `status` from `open` to `answered` when resolved.

---

### Q-001 — Meta campaign ID storage
- **Status**: answered
- **Answer**: Add `metaCampaignIds?: string[]` to `Project` (optional). Surface in `/project/[id]/ad-performance` page as "Link Meta campaign" input. Cron no-ops on empty array. `metaAdSetIds[]` deferred to Phase V.

### Q-002 — Scout budget ceiling
- **Status**: answered
- **Answer**: Hard cap per project per day: **20** Scout invocations. Per-gate cap: **3**. Scout MUST return cost estimate in result object. Hard stop if estimated cost > $2 per job. Env `SCOUT_DAILY_CAP` overrides per-project cap. Log all invocations in `project.scoutLedger[]`.

### Q-003 — Auto-rerun on Meta drop policy
- **Status**: answered
- **Answer**: Two separate env flags. `AUTO_RERUN_ON_DROP=0` default (queue humaine + Discord notif + row in `rerun_queue` with status='needs_human'). If 1, Lea auto-approves re-run iff gate review score ≥80. `AUTO_PUSH_CREATIVES=0` default AND not toggleable from UI — only via manual Vercel env edit. Max safety.

### Q-004 — Distillation re-run cadence
- **Status**: answered
- **Answer**: Manual button always works. Auto re-distill only when `trainingChunks` count changes by ≥20 items since last distillation. Debounced 10 min. Env `AUTO_DISTILL` gates auto path. Add "Force re-distill all" button in `/admin/distill` for debug.

### Q-005 — Constitution vs DR principles conflict
- **Status**: answered
- **Answer**: DR principles injected FIRST (non-negotiable). Constitution injected second. If constitution attempts to override a DR principle, Lea (director) detects during congruence check and auto-rollbacks to previous constitution version. Log the rollback event in `audit_log`. Constitution update prompt explicitly told: "You may not contradict DR principles; if a past output did, flag it and correct in constitution v+1."

### Q-006 — Vercel Hobby plan caps crons at 1/day
- **Status**: blocker-documented
- **Context**: Phase U brief specifies "every 2h" Meta perf pull. Vercel Hobby plan rejects `0 */2 * * *` at deploy time with `Hobby accounts are limited to daily cron jobs`.
- **Default chosen**: schedule downgraded to `0 14 * * *` (daily at 14:00 UTC). This preserves the drop-detection logic and queue/notification shape but detects drops on a 24h granularity instead of 2h.
- **Impact**: critical performance drops are caught within 24h instead of 2h. Acceptable in practice because Meta's own dashboards are checked by the human daily anyway, and the value of Phase U.3a is the *automatic re-run* enqueue, not the pull frequency.
- **Unblock path**: upgrade Vercel to Pro (~$20/mo) OR keep it daily. For "every 2h" the route is already idempotent — a future external scheduler (GitHub Actions on a free runner, a tiny cron on a VPS) could hit `/api/cron/meta-perf` every 2h with the `x-cron-secret` header without needing the Vercel cron feature.