# Performance audit — static analysis

**Scope**: bundle size, N+1 DB patterns, LLM call batching, image config. Static-only (no Lighthouse run — user's site is behind kill switch).

## 1. Bundle analysis (Next 16 build output)

Current route map (from the last `npm run build`):

- **~70 dynamic API routes** (ƒ prefix) — each is its own function, good.
- **~19 static pages** (○ prefix).
- Heaviest client surfaces (by import density): `/project/[id]/gate/[gateId]/page.tsx`, `/project/[id]/agent-chat/page.tsx`, `/admin/page.tsx`.

**Opportunity**: `src/app/admin/page.tsx` has 7 tab components inlined (`OverviewTab`, `UsersTab`, `ProjectsTab`, `AuditTab`, `LoginIPsTab`, `EnvTab`, `CurateTab`, `AutonomousTab`). That's 1 chunk → all 7 tabs bundled for every admin visit. `next/dynamic` with `ssr:false` would split ~6 chunks out (only the active tab loads).

**Est savings**: ~80-150 KB on initial admin page load (gated, low user volume — deprioritize).

## 2. N+1 database patterns

### 2.1 Scout ledger — looks clean

`appendScoutLedger` does one `put`. `countScoutCallsForProjectToday` does one `getAllFromIndex` + in-memory filter. Fine for small N (cap = 20/day/project).

### 2.2 Conversation dispatch — loads thread twice per turn

`src/lib/conversations/dispatch.ts:runAgentTurnWithRouting` calls `loadConversation` + `loadThread` inside the loop, on every chain step. For a 5-turn chain that's 10 SQL round-trips that could be 2 if the loader cached within the request.

**Impact**: visible in `/api/conversations/:id/message` latency — 50-100ms of unnecessary DB time per user message.

**Fix**: pass `conv` and `thread` through the loop, only re-load after a persistMessage to get the fresh state. Or wrap in a small request-scoped cache.

### 2.3 Gate runners — knowledge/training loaded per wave in worst case

Already addressed in Phase T (cached at the top of `runSubAgents`). Healthy.

### 2.4 Conversation persistence — stats update is 2 SQL round-trips

`updateConversationStats` does UPDATE → UPDATE (typed columns → jsonb sync). Could be one statement with a CTE, but readability wins — leave as is.

## 3. LLM call batching opportunities

### 3.1 Sub-agent serial vs parallel

`runSubAgents` deliberately serializes within a wave (Opus tier-1 tokens/min cap — documented at line 370). Can't batch without upgrading the Anthropic tier.

### 3.2 Distillation batching

`distillAllPersonas` runs 6 × Opus sequentially (~4 min wall). Parallelizing 3-at-a-time would halve wall time but tier-1 tokens/min would retry-loop. Stay serial.

### 3.3 Embedding batching — opportunity

`dedupByCosine` calls `embedTexts(items.map(..))` once — good, already batched at provider level. Voyage API accepts arrays. Keep as-is.

### 3.4 Reviewer + Director — can share cache prefix

Both reviewer and director calls re-send the SAME full gate output + persona prefix. Anthropic cache hit is possible but today the reviewer and director use separate `systemPrompt` strings. Aligning their prompt structure (see Prompt Optimization Report) would let the 2nd call (director) hit the cache from the 1st (reviewer).

## 4. Image optimization (next.config.ts)

Checked `next.config.ts` — no explicit `images.remotePatterns` config. Means any `<Image>` pointing to fal.ai / Shopify CDN is either falling through to raw `<img>` or getting blocked.

**Fix**:
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'fal.media' },
    { protocol: 'https', hostname: '**.shopify.com' },
    { protocol: 'https', hostname: 'cdn.shopify.com' },
    { protocol: 'https', hostname: 'm.media-amazon.com' },
  ],
  formats: ['image/avif', 'image/webp'],
},
```

**Savings**: on the Static Ad Studio (144 images per project) the difference between `<img src="https://fal.media/...">` at 1-2MB each vs AVIF at 200-400KB is 80-90% bandwidth reduction. Huge.

## 5. IndexedDB patterns

### 5.1 `getAllProjects` → 30 MB payload risk

`src/lib/store/db.ts` has `getAllProjects` returning every project with full gate outputs embedded. Fine for small N; risk at 100+ projects. Pagination or projection (omit `avatarRunResult`) would help.

### 5.2 TrainingChunk embedding stored as `number[]`

Phase U.4.7 adds `embedding?: number[]` to TrainingChunk. IndexedDB serializes number[] as JSON — a 512-dim embedding is ~3KB per chunk. With 500 chunks per source × 10 sources = 15 MB of embeddings just in IDB. Consider storing as Float32Array serialized via ArrayBuffer instead (4 bytes × 512 = 2KB, halved).

## 6. Network waterfalls

### 6.1 Bootstrap — waterfall of 3 calls

On `/` dashboard load: `/api/auth/me` → `/api/sync/bootstrap` → `/api/sync/persona-distillation` → `/api/sync/agent-constitution`. Four sequential round-trips. Could be a single combined `/api/bootstrap` endpoint. **Est savings**: 200-400ms on initial load.

### 6.2 Agent chat room polling

`/project/[id]/agent-chat` polls after each user message but doesn't use SSE. Acceptable for MVP — SSE in TODO.md.

## 7. Hot paths — observability

No metrics exporter today (no Vercel Analytics, no Sentry, no Grafana). First failure signal for latency regressions is user complaint. Consider adding `@vercel/analytics` (free) at least.

## Priority recommendations

| # | Change | Est savings | Effort |
| - | - | - | - |
| 1 | Add `images.remotePatterns` to `next.config.ts` | 80-90% bandwidth on Static Ad Studio | 5 min |
| 2 | Split tabs on `/admin` with `next/dynamic` | 80-150 KB initial | 20 min |
| 3 | Combined `/api/bootstrap` endpoint | 200-400ms first-paint | 30 min |
| 4 | Cache conv + thread in dispatch loop | 50-100ms per user message | 15 min |
| 5 | Store embeddings as Float32Array buffer in IDB | halve IDB size | 30 min |
| 6 | Align reviewer/director prompt structure for cache sharing | 10-20% LLM spend on gate reviews | 45 min |
| 7 | Add Vercel Analytics | zero savings but visibility | 5 min |

All deferred to the user — none blocking.

## Not investigated

- Actual Lighthouse score (site behind kill switch in dev, behind auth in prod).
- Real-time p50/p95 latency (no APM).
- Cold start times for Vercel functions (would need load-test runs).
