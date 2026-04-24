// ============================================================
// PAWEN — Phase U.3c — Scout agent (autonomous scraping)
//
// Client-side orchestrator. Given a natural-language intent + the
// requesting agent + project context, Scout:
//   1. Asks Sonnet (via /api/scout) to pick tool(s) + queries.
//   2. Executes the picked tools via existing source-fetcher APIs.
//   3. Returns a structured ScoutResult, writes a ScoutLedgerEntry,
//      and appends items to project rawSignal (caller handles merge).
//
// Caps (from Q-002):
//   - 3 invocations per gate run (SCOUT_PER_GATE_CAP)
//   - 20 invocations per project per day (SCOUT_DAILY_CAP)
//   - $2 max estimated cost per job (SCOUT_MAX_JOB_COST_USD)
// ============================================================

import { v4 as uuid } from 'uuid';
import type { AgentId, ScoutLedgerEntry } from '../kb/types';
import type { Project } from '../types';
import { appendScoutLedger, countScoutCallsForProjectToday } from '../store/db';

// Keep this typed locally — Scout operates at the API edge, not the full
// source-fetcher internals.
export type ScoutTool =
  | 'tavily'
  | 'firecrawl'
  | 'reddit'
  | 'youtube'
  | 'tiktok'
  | 'amazon-reviews'
  | 'meta-ads'
  | 'shopify'
  | 'brandsearch';

export interface ScoutPlan {
  tools: ScoutTool[];
  queries: Record<ScoutTool, string[]>;
  rationale: string;
  estimatedCostUsd: number;   // rough — Sonnet picks, we sanity-check
}

export interface ScoutResult {
  intent: string;
  plan: ScoutPlan;
  items: Array<{
    tool: ScoutTool;
    query: string;
    summary: string;
    data: unknown;
  }>;
  costHint: Record<string, number>;  // call count per tool
  summary: string;
  ledgerId: string;
  tokensUsed: number;
  skipped: boolean;           // true if a cap refused the job
  skipReason?: string;
}

// Rough cost model (USD per call). Deliberately conservative — used for
// the pre-flight abort, not billing.
const TOOL_COST_USD: Record<ScoutTool, number> = {
  tavily: 0.008,
  firecrawl: 0.02,
  reddit: 0,
  youtube: 0,
  tiktok: 0.05,
  'amazon-reviews': 0.02,
  'meta-ads': 0.008,
  shopify: 0,
  brandsearch: 0.01,
};

const PER_GATE_SENTINEL_KEY = 'pawen:scout-gate-counts';

type GateCounters = Record<string, number>;

function readGateCounters(): GateCounters {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PER_GATE_SENTINEL_KEY);
    return raw ? JSON.parse(raw) as GateCounters : {};
  } catch {
    return {};
  }
}

function writeGateCounters(v: GateCounters): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(PER_GATE_SENTINEL_KEY, JSON.stringify(v)); } catch { /* noop */ }
}

/**
 * Tracks invocation count per (projectId, gateRunId). The gateRunId is
 * a short-lived identifier (millisecond-bucket or gate-run UUID). Callers
 * pass a stable key for the current run.
 */
function incrementGateCounter(key: string): number {
  const c = readGateCounters();
  c[key] = (c[key] ?? 0) + 1;
  writeGateCounters(c);
  return c[key];
}

function resetGateCounter(key: string): void {
  const c = readGateCounters();
  delete c[key];
  writeGateCounters(c);
}

export interface ScoutInvocationContext {
  intent: string;
  agentId: AgentId;
  project: Project;
  gateRunKey: string;         // stable for one gate run (e.g. `${projectId}:${gateId}:${timestamp}`)
  perGateCap: number;         // default 3 — enforce Q-002
  dailyCap: number;           // default 20 — enforce Q-002
  maxCostUsd: number;         // default $2 — hard stop
}

export async function runScout(ctx: ScoutInvocationContext): Promise<ScoutResult> {
  const today = new Date().toISOString().slice(0, 10);

  // --- Cap checks ---
  const gateCount = incrementGateCounter(ctx.gateRunKey);
  if (gateCount > ctx.perGateCap) {
    // Reset? No — leave the counter so the user sees the cap was exceeded
    // during the run. It'll naturally reset when a new run uses a new key.
    return skippedResult(ctx, 'gate_cap_exceeded', `Exceeded ${ctx.perGateCap} Scout calls this gate run`);
  }

  const dailyCount = await countScoutCallsForProjectToday(ctx.project.id);
  if (dailyCount >= ctx.dailyCap) {
    return skippedResult(ctx, 'daily_cap_exceeded', `Exceeded ${ctx.dailyCap} Scout calls today for this project`);
  }

  // --- Step 1: plan (Sonnet picks tools + queries) ---
  const planRes = await fetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      mode: 'plan',
      intent: ctx.intent,
      agentId: ctx.agentId,
      projectContext: {
        niche: ctx.project.niche,
        product: ctx.project.name,
        language: ctx.project.targetLanguage,
        market: ctx.project.targetMarket,
      },
    }),
  });

  if (!planRes.ok) {
    return skippedResult(ctx, 'plan_failed', `Scout plan request failed: ${planRes.status}`);
  }

  const planData = await planRes.json() as {
    ok: boolean;
    plan?: ScoutPlan;
    tokens?: number;
    message?: string;
  };

  if (!planData.ok || !planData.plan) {
    return skippedResult(ctx, 'plan_rejected', planData.message ?? 'Plan malformed');
  }

  const plan = planData.plan;
  const planTokens = planData.tokens ?? 0;

  // --- Cost pre-flight ---
  const estCost = plan.tools.reduce((sum, t) => {
    const q = plan.queries[t] ?? [];
    return sum + q.length * (TOOL_COST_USD[t] ?? 0);
  }, 0);
  if (estCost > ctx.maxCostUsd) {
    return skippedResult(
      ctx,
      'cost_cap_exceeded',
      `Estimated cost $${estCost.toFixed(2)} > cap $${ctx.maxCostUsd.toFixed(2)}`,
    );
  }

  // --- Step 2: execute each (tool, query) ---
  const items: ScoutResult['items'] = [];
  const costHint: Record<string, number> = {};

  for (const tool of plan.tools) {
    const queries = plan.queries[tool] ?? [];
    for (const q of queries.slice(0, 5)) { // cap queries per tool
      try {
        const data = await dispatchTool(tool, q);
        items.push({ tool, query: q, summary: summarizeToolResult(tool, data), data });
        costHint[tool] = (costHint[tool] ?? 0) + 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        items.push({ tool, query: q, summary: `ERROR: ${msg}`, data: null });
      }
    }
  }

  // --- Step 3: ledger entry ---
  const ledger: ScoutLedgerEntry = {
    id: uuid(),
    projectId: ctx.project.id,
    gateId: ctx.gateRunKey,
    agentId: ctx.agentId,
    intent: ctx.intent,
    tools: plan.tools,
    queries: Object.values(plan.queries).flat(),
    addedItems: items.filter(i => i.data !== null).length,
    costHint,
    summary: `Scout by ${ctx.agentId}: ${plan.rationale.slice(0, 200)} → ${items.length} items`,
    day: today,
    createdAt: new Date().toISOString(),
  };
  await appendScoutLedger(ledger);

  return {
    intent: ctx.intent,
    plan,
    items,
    costHint,
    summary: ledger.summary,
    ledgerId: ledger.id,
    tokensUsed: planTokens,
    skipped: false,
  };
}

function skippedResult(ctx: ScoutInvocationContext, reason: string, detail: string): ScoutResult {
  return {
    intent: ctx.intent,
    plan: { tools: [], queries: {} as Record<ScoutTool, string[]>, rationale: detail, estimatedCostUsd: 0 },
    items: [],
    costHint: {},
    summary: `Scout skipped: ${detail}`,
    ledgerId: '',
    tokensUsed: 0,
    skipped: true,
    skipReason: reason,
  };
}

// Dispatch a single tool + query through existing source-fetcher APIs.
async function dispatchTool(tool: ScoutTool, query: string): Promise<unknown> {
  switch (tool) {
    case 'tavily': {
      const res = await fetch('/api/search', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxResults: 10 }),
      });
      return await res.json();
    }
    case 'firecrawl': {
      const res = await fetch('/api/scrape', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: query }),
      });
      return await res.json();
    }
    case 'reddit': {
      const res = await fetch('/api/reddit', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      });
      return await res.json();
    }
    case 'youtube': {
      const res = await fetch('/api/youtube', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 10 }),
      });
      return await res.json();
    }
    case 'tiktok': {
      const res = await fetch('/api/tiktok', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'search', query, limit: 20 }),
      });
      return await res.json();
    }
    case 'amazon-reviews': {
      const res = await fetch('/api/amazon-reviews', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrlOrAsin: query }),
      });
      return await res.json();
    }
    case 'meta-ads': {
      const res = await fetch('/api/meta-ads', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return await res.json();
    }
    case 'shopify': {
      const res = await fetch('/api/shopify', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'detect', url: query }),
      });
      return await res.json();
    }
    case 'brandsearch': {
      const res = await fetch('/api/brandsearch', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return await res.json();
    }
  }
}

function summarizeToolResult(tool: ScoutTool, data: unknown): string {
  if (!data || typeof data !== 'object') return `${tool}: no data`;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.results)) return `${tool}: ${(d.results as unknown[]).length} results`;
  if (Array.isArray(d.items)) return `${tool}: ${(d.items as unknown[]).length} items`;
  if (Array.isArray(d.comments)) return `${tool}: ${(d.comments as unknown[]).length} comments`;
  if (Array.isArray(d.reviews)) return `${tool}: ${(d.reviews as unknown[]).length} reviews`;
  if (Array.isArray(d.ads)) return `${tool}: ${(d.ads as unknown[]).length} ads`;
  return `${tool}: response received`;
}

// Exposed so caller can reset the gate counter when a gate run starts/ends.
export { resetGateCounter as resetScoutGateCounter };
