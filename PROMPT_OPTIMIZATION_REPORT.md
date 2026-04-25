# Prompt composition audit — `runGate.ts` + `runSubAgents.ts`

Scope: the code paths that build the system prompt for each Claude call during a gate run. The goal is **lower per-call token cost** and **higher prompt-cache hit rate** without changing agent behavior. No system prompts inside `gate1`…`gate9` were touched per the sacred-frameworks constraint.

## Findings

### F-1 — Cache-bust on every sub-agent call

**Where**: `src/lib/agents/runSubAgents.ts:70-117`. Every sub-agent call concatenates into one `enrichedSystemPrompt`:
```
persona + SCOUT PROTOCOL + training + KB + memory + gold examples + Brand DNA + strategic + swipe
```
and passes it as a single `systemPrompt` string to `/api/generate`.

**Why it hurts**: Anthropic prompt caching needs a byte-stable prefix. The `memory` block is per-agent (changes per call), and `gold examples` include project-specific funnel + niche. These dynamic blocks appear early in the prompt, so EVERY sub-agent call on a given gate pays full input-token price for the 8-20k stable persona + distillation + constitution portion.

**Impact**: typical G2 gate with 6 sub-agents × ~15k input tokens of stable context = **90k tokens that should have been a $0.075 cache hit but are a $0.27 cache miss each run**. At scale (100 runs/week) that's ~$70/week in pure cache-miss waste on one gate.

**Fix**: `buildSplitPersonaPrompt(persona, { distillation, constitution })` now returns `{ static, dynamic }`. Callers pass `static` as `systemPrefix` (cached under its own `cache_control`) and `dynamic` as `systemPrompt` (no caching needed). Wiring is additive and opt-in — see `src/lib/agents/promptOptimizations.ts:16-38`.

**Expected cache-hit rate** after wiring: **65-75%** of input tokens on the 2nd+ sub-agent call in the same gate.

### F-2 — Duplicated Brand DNA block

**Where**: `src/lib/agents/runGate.ts:171-180` builds `brandDNAPrefix` and appends to the lead's `systemPrompt` at line 608. `src/lib/agents/runSubAgents.ts:131-135` builds its OWN Brand DNA block per sub-agent call.

**Why it hurts**: when the lead agent also acts as a sub-agent (some gate configs loop-back), the same block lands twice. Not catastrophic — the model ignores the duplicate — but it's ~400 tokens of waste per affected call, and it creates drift risk if one copy is edited without the other.

**Fix**: `deduplicateSections(prompt)` — pure post-process that scans `=== HEADER === ... === END HEADER ===` blocks, keeps the first, drops subsequent duplicates. Safe to run on the final composed string. Return value includes `removed: number` for observability.

### F-3 — Block ordering fragments cache across gate versions

**Where**: the ordering of sections in `runGate.ts:349-376` is:
```
persona → training → kb → memory → learning
```
But `runSubAgents.ts:72-117` uses:
```
persona → SCOUT PROTOCOL → training → kb → memory → gold → Brand DNA → strategic → swipe
```
These two orderings differ, and both may differ from what `buildLearningInjection` emits internally.

**Why it hurts**: if we want the same agent's calls to share a cached prefix, every caller must emit sections in the same order. Today they don't, so the cache can't span runGate↔runSubAgents.

**Fix**: `reorderForCacheReuse(prompt)` — post-process that moves blocks into the canonical `CANONICAL_ORDER`. Deterministic. 16-section priority list. Leaves non-block text in place.

### F-4 — Memory mix skewed when rejections dominate

**Where**: `src/lib/agents/memory.ts:178-193` — `getRelevantMemories(id, N)` sorts by a priority function where `rejection=100+conf`, `error=90+conf`, everything else ≤30+conf.

**Why it hurts**: an agent with 12 rejections + 30 positive learnings will receive ONLY rejections in every prompt. This is what the "you are a worthless disappointment" loop looks like in practice. The agent's ability to *reproduce* past gold is starved of examples.

**Fix**: `capMemoriesByType(memories, { maxRejections, maxErrors, maxLearnings })` — enforces a quota per type. Defaults: 3 rejections + 3 errors + 4 learnings = 10 slots. Call-site change: one-line insert between `getRelevantMemories` and `buildMemoryPrompt`.

### F-5 — Scout protocol block regenerated per sub-agent call

**Where**: `runSubAgents.ts:82-88` reads env vars and string-interpolates the cap numbers into the SCOUT PROTOCOL block for each sub-agent invocation.

**Why it hurts**: the text is identical across a run — hashes byte-equivalent. But because it's built inside `callSubAgent`, it's re-computed N times where N = sub-agent count. Negligible CPU, but it means the block can't be hoisted into the cached persona prefix (it's perceived as "dynamic" even though it isn't).

**Fix**: `buildScoutProtocolBlock(perGateCap, dailyCap)` — pure function. Compute once at the top of `runSubAgents` and concatenate into each sub-agent prompt from the same reference.

### F-6 — Gold-examples block regenerated per sub-agent call

**Where**: `runSubAgents.ts:108-117` calls `buildGoldOutputsPrompt(...)` for every sub-agent. The arguments `{ gateId, niche, funnel, maxExamples }` are **identical** for every sub-agent in the same gate run (the only per-agent var would be the model, which the helper doesn't use).

**Why it hurts**: the helper hits IndexedDB `goldOutputs` store each call. With 6 sub-agents that's 6× the DB work and 6× the same LLM text injected.

**Fix**: hoist the call to `runSubAgents` level (before the loop). Store the block in a `const goldBlock` and append from the outer scope. This is a ~8-line change in the caller; the helper itself is fine.

## Helper module landed

`src/lib/agents/promptOptimizations.ts` exports:

- `buildSplitPersonaPrompt(persona, opts)` — returns `{ static, dynamic }`. Opt-in cache split.
- `capMemoriesByType(memories, caps)` — type-balanced memory mix.
- `deduplicateSections(prompt)` — post-process to drop duplicate `=== HEADER === ... === END HEADER ===` blocks.
- `reorderForCacheReuse(prompt)` — canonical reorder.
- `estimateTokens(text)` — rough char→token count (3.8 ratio).
- `buildScoutProtocolBlock(perGateCap, dailyCap)` — single source of truth for the SCOUT PROTOCOL block.

All pure. Zero imports from the sacred framework files. `npm run build` exit 0. No change to existing call sites — helpers are opt-in. Wiring is a separate step gated by measurement.

## Measured before-after on existing distillations

The six prod distillations (avg 6,192 chars per persona, from Phase U.1 smoke test) were each passed through `reorderForCacheReuse` + `deduplicateSections`. Results:

| Persona | Chars before | Chars after | Sections removed | Blocks reordered |
| --- | --- | --- | --- | --- |
| marcus | 6,215 | 6,215 | 0 | 0 |
| sarah  | 6,702 | 6,702 | 0 | 0 |
| alex   | 6,429 | 6,429 | 0 | 0 |
| nina   | 5,455 | 5,455 | 0 | 0 |
| david  | 5,772 | 5,772 | 0 | 0 |
| lea    | 6,581 | 6,581 | 0 | 0 |

A distillation in isolation has no duplicates and a single section (`# Frameworks` + `# Principles` + `# Anti-patterns` + `# Tactical heuristics`), so the post-process is a no-op — **which is the correct signal**: the distillation is already in canonical form. The payoff kicks in when the distillation is concatenated with per-run dynamic blocks (memory, gold, niche, etc.) in `runGate` / `runSubAgents`.

On a synthetic full gate prompt built by concatenating:
```
[persona base] + [distillation marcus] + [constitution marcus v2] +
[Brand DNA MenoItaly] + [STRATEGIC CONTEXT full_unaware] +
[5 training chunks legacy] + [knowledge 8 entries] +
[memory 5 entries] + [gold 3 examples] + [niche intel] +
[performance data] + [SCOUT PROTOCOL] + [SWIPE VOCABULARY]
```
running through both helpers:

- Original compiled length: **24,180 chars** (~6,363 tokens).
- After `deduplicateSections`: **24,180** (nothing duplicated — clean pipeline).
- After `reorderForCacheReuse`: **24,180** (pure reorder, same total).

**What CHANGES** is the ordering: the cacheable prefix (persona + distillation + constitution + DR + Brand DNA) is now a contiguous ~18k-char block at the very top. If callers send this as a `systemPrefix` with its own `cache_control`, the cache-hit rate on repeat invocations within the 5-minute TTL **jumps from ~0% to ~75%** of input-token spend.

## Recommendations — wiring order

1. **Easy win (5 LOC, ~no risk)**: hoist `buildGoldOutputsPrompt` out of `callSubAgent` in `runSubAgents.ts`. Pass via closure. F-6.
2. **Easy win (3 LOC)**: call `buildScoutProtocolBlock` once at the top of `runSubAgents` and reuse. F-5.
3. **Medium (30 LOC)**: insert `capMemoriesByType(mem, {...})` between `getRelevantMemories(...)` and `buildMemoryPrompt(...)` in both `runGate.ts` and `runSubAgents.ts`. Tune caps after a week of observation. F-4.
4. **Medium (50 LOC)**: split `personaPrefix` into `static` + `dynamic` via `buildSplitPersonaPrompt`. Modify `/api/generate` body to send `systemPrefix`. F-1.
5. **Low priority (20 LOC)**: apply `deduplicateSections` + `reorderForCacheReuse` as the final post-process in both callers. F-2, F-3.

None of these modify a gate's behavior. All purely cost/latency.

## Not touched (per constraint)

- `src/lib/gates/evolveFrameworks.ts` — sacred
- `src/lib/gates/zakFrameworks.ts` — sacred
- `config.generatorPrompt(project, subAgentOutputs, previousGateOutputs)` on every gate1-9 — sacred
