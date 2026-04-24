// ============================================================
// PAWEN — Phase U.2 — Agent Constitutional Self-Update
//
// Each agent periodically rewrites its operating rules from its
// own results (past outputs, reviewer scores, rejections, picks).
// Client-side orchestrator. Calls the server-only route
// `/api/admin/update-constitution` which owns the Anthropic API key.
// ============================================================

import { AgentId, AgentConstitution } from '../kb/types';
import {
  getAllGateOutputs,
  getAllProjects,
  getAgentMemories,
  getGoldOutputsForGate,
  saveAgentConstitution,
  getAgentConstitution,
} from '../store/db';
import { AGENT_PERSONAS } from '../agents/personas';

const WINDOW_OUTPUTS = 50;           // last N gate outputs to analyze
const WINDOW_REJECTIONS = 15;        // last rejections + errors
const WINDOW_GOLD_PICKS = 20;        // top picks per gate
const MAX_INPUT_CHARS = 120_000;     // Sonnet 200k context, stay conservative

interface ConstitutionCorpusStats {
  outputCount: number;
  rejectionCount: number;
  errorCount: number;
  goldCount: number;
  avgScore: number;
  approvalRate: number;
}

/**
 * Assemble the analysis corpus for one agent: recent gate outputs the
 * agent led, their reviewer scores, rejections/errors, and top picks.
 */
export async function collectConstitutionCorpus(agentId: AgentId): Promise<{
  payload: string;
  stats: ConstitutionCorpusStats;
  basedOnGates: string[];
}> {
  const persona = AGENT_PERSONAS[agentId];
  if (!persona) throw new Error(`Unknown persona: ${agentId}`);
  const personaGates = new Set(persona.gates);

  // 1. Recent outputs. getAllGateOutputs takes a projectId; to get across
  //    all projects we iterate projects. This isn't hot path (constitution
  //    refresh is rare), so it's fine.
  const projects = await getAllProjects();
  const allOutputs: Array<{
    projectId: string;
    projectName: string;
    gateId: string;
    score?: number;
    rejected?: boolean;
    output: unknown;
    updatedAt: string;
  }> = [];
  for (const proj of projects) {
    const gateOutputs = await getAllGateOutputs(proj.id);
    for (const go of gateOutputs) {
      if (!personaGates.has(go.gateId)) continue;
      const score = go.reviewResult ? go.reviewResult.percentage : undefined;
      const rejected = go.status !== 'approved' && !!go.reviewResult && go.reviewResult.passed === false;
      allOutputs.push({
        projectId: proj.id,
        projectName: proj.name ?? 'unnamed',
        gateId: go.gateId,
        score,
        rejected,
        output: go.data,
        updatedAt: go.updatedAt ?? go.createdAt ?? new Date(0).toISOString(),
      });
    }
  }
  allOutputs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const windowOutputs = allOutputs.slice(0, WINDOW_OUTPUTS);

  // 2. Rejection + error memories
  const memories = await getAgentMemories(agentId);
  const rejections = memories
    .filter(m => m.type === 'rejection')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, WINDOW_REJECTIONS);
  const errors = memories
    .filter(m => m.type === 'error')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, WINDOW_REJECTIONS);

  // 3. Top picks for each of the agent's gates
  const goldAll: Array<{ gateId: string; content: string; section: string }> = [];
  for (const gateId of personaGates) {
    const golds = await getGoldOutputsForGate(gateId);
    const picks = golds.filter(g => g.captureType === 'pick').slice(0, WINDOW_GOLD_PICKS);
    for (const g of picks) {
      goldAll.push({ gateId, content: g.content, section: g.sectionPath });
    }
  }

  // Stats
  const scored = windowOutputs.filter(o => typeof o.score === 'number') as Array<{ score: number; rejected?: boolean }>;
  const avgScore = scored.length > 0 ? scored.reduce((s, o) => s + (o.score ?? 0), 0) / scored.length : 0;
  const approvals = scored.filter(o => !o.rejected).length;
  const total = scored.length;
  const approvalRate = total > 0 ? approvals / total : 0;

  // Assemble
  const lines: string[] = [
    `# CONSTITUTION UPDATE CORPUS FOR ${persona.name.toUpperCase()} (${agentId})`,
    ``,
    `## Summary stats`,
    `- Output window: ${windowOutputs.length} gate outputs analyzed (last ${WINDOW_OUTPUTS})`,
    `- Avg reviewer score: ${avgScore.toFixed(1)}%`,
    `- Approval rate: ${(approvalRate * 100).toFixed(1)}% (${approvals}/${total})`,
    `- Rejections in memory: ${rejections.length}`,
    `- Errors in memory: ${errors.length}`,
    `- Gold picks across gates: ${goldAll.length}`,
    ``,
  ];

  if (rejections.length > 0) {
    lines.push('## Human rejections (YOUR priority: never repeat these)');
    for (const r of rejections) {
      lines.push(`- [${r.context}] ${r.title}`);
      lines.push(`  ${r.content.slice(0, 500)}`);
    }
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('## Reviewer-flagged errors');
    for (const e of errors) {
      lines.push(`- ${e.title}`);
      lines.push(`  ${e.content.slice(0, 400)}`);
    }
    lines.push('');
  }

  if (goldAll.length > 0) {
    lines.push('## Top picks (human hand-picked — what you should reproduce)');
    for (const g of goldAll.slice(0, 30)) {
      lines.push(`- [${g.gateId} · ${g.section}] ${g.content.slice(0, 400)}`);
    }
    lines.push('');
  }

  if (windowOutputs.length > 0) {
    lines.push('## Recent gate outputs (chronological, newest last)');
    // Oldest → newest so the model reads a narrative
    const rev = [...windowOutputs].reverse();
    for (const o of rev) {
      const scoreTag = typeof o.score === 'number' ? `score=${o.score}%` : 'no-score';
      const rejectTag = o.rejected ? ' REJECTED' : '';
      lines.push(`### ${o.gateId} · ${o.projectName} (${scoreTag}${rejectTag})`);
      const s = JSON.stringify(o.output).slice(0, 1500);
      lines.push(s);
      lines.push('');
    }
  }

  let payload = lines.join('\n');
  if (payload.length > MAX_INPUT_CHARS) {
    payload = payload.slice(0, MAX_INPUT_CHARS) +
      `\n\n[...truncated ${payload.length - MAX_INPUT_CHARS} chars...]`;
  }

  return {
    payload,
    stats: {
      outputCount: windowOutputs.length,
      rejectionCount: rejections.length,
      errorCount: errors.length,
      goldCount: goldAll.length,
      avgScore,
      approvalRate,
    },
    basedOnGates: [...personaGates],
  };
}

/**
 * Build the persona-scoped constitution-update system prompt.
 * Output contract: first-person numbered Do/Don't/Watch-out rules, ≤8000 chars.
 */
export function buildConstitutionSystemPrompt(agentId: AgentId, prior?: AgentConstitution | null): string {
  const p = AGENT_PERSONAS[agentId];
  if (!p) throw new Error(`Unknown persona: ${agentId}`);

  const priorBlock = prior?.constitution
    ? `\n\nYOUR PREVIOUS CONSTITUTION (v${prior.version}), which you will revise:\n\`\`\`\n${prior.constitution}\n\`\`\`\n`
    : '';

  return `You are ${p.name}, the ${p.role} at Pawen Agency. You are about to rewrite YOUR OWN operating constitution — the numbered list of rules YOU commit to follow in every future gate.${priorBlock}

You will be given a corpus of YOUR recent outputs, the reviewer scores they received, the human rejections you collected, and the picks the human highlighted as gold. Study it, then produce a revised constitution.

CONSTRAINTS (non-negotiable):
- Output is written in first person ("I will…", "I must never…"), addressed to yourself.
- Output is Markdown with exactly three sections:
  # Do — numbered list, ≥8 rules. Rules you MUST follow. Each rule must be specific (not "write good copy" — "I will lead every ad with a pattern-interrupt question when awareness ≤ Problem Aware").
  # Don't — numbered list, ≥6 rules. Patterns that caused rejections or low scores. Each rule references the evidence it came from ("After BH-22 rejection on fear-heavy intro, I will never…").
  # Watch-out — numbered list, ≥6 rules. Softer judgment calls — situations where you historically wobbled and need to stop and decide consciously.
- You MAY NOT contradict the DR principles or funnel context that will be injected at runtime alongside your constitution. If a past output did, put the correction in the # Don't section and explicitly cite the case.
- Total output ≤ 8000 characters.
- No preamble. No meta-commentary. Start directly with "# Do".
- Every rule must be actionable (someone could apply it at runtime without clarification).`;
}

export function buildConstitutionUserMessage(payload: string): string {
  return `Here is the corpus of your recent work. Revise your constitution per the contract above.\n\n${payload}`;
}

/**
 * Run the constitution compile for one agent end-to-end. Server route owns
 * Anthropic; we persist to IndexedDB and fire-and-forget mirror to Postgres.
 */
export async function updateAgentConstitution(
  agentId: AgentId,
  adminToken?: string | null,
): Promise<AgentConstitution> {
  const existing = await getAgentConstitution(agentId);
  const { payload, stats, basedOnGates } = await collectConstitutionCorpus(agentId);
  const systemPrompt = buildConstitutionSystemPrompt(agentId, existing);
  const userMessage = buildConstitutionUserMessage(payload);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) headers['x-admin-token'] = adminToken;

  const res = await fetch('/api/admin/update-constitution', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({
      agentId,
      systemPrompt,
      userMessage,
      stats,
      basedOnGates,
      priorVersion: existing?.version ?? 0,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Constitution update failed: ${res.status} ${detail.slice(0, 200)}`);
  }

  const data = await res.json() as {
    ok: boolean;
    constitution: string;
    tokens: number;
    model: string;
  };

  const rec: AgentConstitution = {
    agentId,
    constitution: data.constitution,
    version: (existing?.version ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    basedOnGates,
    basedOnOutputCount: stats.outputCount,
    metrics: {
      avgScore: stats.avgScore,
      rejectionCount: stats.rejectionCount,
      approvalRate: stats.approvalRate,
    },
  };

  await saveAgentConstitution(rec);

  void fetch('/api/sync/agent-constitution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rec),
  }).catch(() => { /* mirror best-effort */ });

  return rec;
}

// ---------- Auto-trigger counter ----------

const COUNTER_KEY = 'pawen:constitution-counter';

type CounterMap = Record<string, number>;

function readCounters(): CounterMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(COUNTER_KEY);
    return raw ? JSON.parse(raw) as CounterMap : {};
  } catch {
    return {};
  }
}

function writeCounters(map: CounterMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COUNTER_KEY, JSON.stringify(map));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

/**
 * Call after a gate completes where `agentId` was the lead. Returns true
 * if the accumulated count crossed the refresh threshold (caller should
 * then trigger an async `updateAgentConstitution`).
 */
export function bumpConstitutionCounter(agentId: AgentId, refreshEvery: number): boolean {
  const counters = readCounters();
  const next = (counters[agentId] ?? 0) + 1;
  if (next >= refreshEvery) {
    counters[agentId] = 0;
    writeCounters(counters);
    return true;
  }
  counters[agentId] = next;
  writeCounters(counters);
  return false;
}

export function getConstitutionCounter(agentId: AgentId): number {
  return readCounters()[agentId] ?? 0;
}

export function resetConstitutionCounter(agentId: AgentId): void {
  const counters = readCounters();
  delete counters[agentId];
  writeCounters(counters);
}
