// ============================================================
// PAWEN — Phase U.1 — Persona Expertise Distillation
//
// Replaces runtime RAG (`getTrainingChunksForGate` → `buildTrainingPrompt`)
// with a once-compiled, baked-in expertise corpus per persona. The corpus
// is produced by Opus from ALL training chunks relevant to the persona's
// domain, plus curated knowledge entries. It is stored in IndexedDB
// (`personaDistillations`) and mirrored to Postgres.
//
// CLIENT-SIDE orchestrator. Calls the server-only route
// `/api/admin/distill` which owns the Anthropic API key.
// ============================================================

import { AgentId, PersonaDistillation, TrainingChunk, KnowledgeEntry } from '../kb/types';
import {
  getAllTrainingChunks,
  getAllKnowledge,
  savePersonaDistillation,
  getPersonaDistillation,
} from '../store/db';
import { AGENT_PERSONAS } from '../agents/personas';

// Hard cap on input characters sent to Opus. Leaves headroom for the
// distill prompt itself + the ≤20k output. Opus context is 200k tokens
// (~750k chars), but we stay conservative for cost + latency.
const MAX_INPUT_CHARS = 180_000;

// Category → agent mapping: which KnowledgeEntry categories belong to
// which persona's domain. Used to pull curated knowledge into the
// distillation input alongside the raw training chunks.
const AGENT_KNOWLEDGE_CATEGORIES: Record<AgentId, string[]> = {
  sarah:  ['product_research', 'psychology', 'general'],
  marcus: ['avatar_research', 'psychology', 'root_cause', 'mechanism', 'brand_voice'],
  alex:   ['copywriting', 'hooks', 'advertorial', 'video_scripts', 'brand_voice'],
  nina:   ['image_ads', 'brand_voice'],
  david:  ['media_buying', 'campaign_strategy', 'scaling', 'testing'],
  lea:    ['general', 'brand_voice'],
};

export interface DistillationInputStats {
  chunkCount: number;
  sourceCount: number;
  knowledgeCount: number;
  totalChars: number;
  truncatedChars: number;
}

/**
 * Select every TrainingChunk relevant to the persona. Relevance = the
 * chunk's `applicableGates` intersects the persona's `gates`, or the
 * chunk is marked `'all'`.
 */
export async function collectChunksForPersona(agentId: AgentId): Promise<TrainingChunk[]> {
  const persona = AGENT_PERSONAS[agentId];
  if (!persona) return [];
  const personaGates = new Set(persona.gates);
  const allChunks = await getAllTrainingChunks();
  return allChunks.filter(c => {
    if (c.applicableGates.includes('all')) return true;
    return c.applicableGates.some(g => personaGates.has(g));
  });
}

/**
 * Pull curated knowledge entries matching the persona's domain.
 */
export async function collectKnowledgeForPersona(agentId: AgentId): Promise<KnowledgeEntry[]> {
  const wantCats = new Set(AGENT_KNOWLEDGE_CATEGORIES[agentId] ?? []);
  const all = await getAllKnowledge();
  return all.filter(k => wantCats.has(k.category));
}

/**
 * Assemble the Opus user payload by concatenating chunks (full text) grouped
 * by source, followed by curated knowledge entries. Truncates to MAX_INPUT_CHARS
 * preserving the highest-priority chunks first (knowledge then chunks by source diversity).
 */
export function assembleDistillInput(
  chunks: TrainingChunk[],
  knowledge: KnowledgeEntry[],
): { payload: string; stats: DistillationInputStats } {
  // Group chunks by source, sort by index within source
  const bySource = new Map<string, TrainingChunk[]>();
  for (const c of chunks) {
    const arr = bySource.get(c.sourceId) ?? [];
    arr.push(c);
    bySource.set(c.sourceId, arr);
  }
  for (const arr of bySource.values()) {
    arr.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  // Build knowledge block first (tighter, higher signal)
  const kbLines: string[] = [];
  if (knowledge.length > 0) {
    kbLines.push('## CURATED KNOWLEDGE ENTRIES');
    for (const k of knowledge) {
      kbLines.push(`### ${k.title} [${k.category} | ${k.importance}]`);
      kbLines.push(`Key takeaway: ${k.keyTakeaway}`);
      kbLines.push(k.content.trim());
      kbLines.push('');
    }
  }
  const kbBlock = kbLines.join('\n');

  // Build chunk block grouped by source
  const chunkLines: string[] = [];
  chunkLines.push('## TRAINING SOURCE EXCERPTS');
  for (const [, arr] of bySource) {
    if (arr.length === 0) continue;
    const sourceName = arr[0].sourceName;
    chunkLines.push(`### SOURCE: ${sourceName}`);
    for (const c of arr) {
      chunkLines.push(`--- chunk ${c.chunkIndex} ---`);
      chunkLines.push(c.content.trim());
      chunkLines.push('');
    }
  }
  const chunkBlock = chunkLines.join('\n');

  // Concatenate with knowledge first, truncate tail if needed
  const raw = `${kbBlock}\n\n${chunkBlock}`;
  let payload = raw;
  let truncated = 0;
  if (raw.length > MAX_INPUT_CHARS) {
    payload = raw.slice(0, MAX_INPUT_CHARS) +
      `\n\n[...truncated ${raw.length - MAX_INPUT_CHARS} chars to fit context window...]`;
    truncated = raw.length - MAX_INPUT_CHARS;
  }

  return {
    payload,
    stats: {
      chunkCount: chunks.length,
      sourceCount: bySource.size,
      knowledgeCount: knowledge.length,
      totalChars: raw.length,
      truncatedChars: truncated,
    },
  };
}

/**
 * Build the persona-specific distillation system prompt.
 * The prompt is deliberately narrow: we want a reproducible 4-section
 * markdown output that replaces runtime RAG.
 */
export function buildDistillSystemPrompt(agentId: AgentId): string {
  const p = AGENT_PERSONAS[agentId];
  if (!p) throw new Error(`Unknown persona: ${agentId}`);

  return `You are compiling the baked-in expertise corpus for ${p.name}, the ${p.role} at Pawen Agency.

${p.personality}

YOUR EXPERTISE DOMAIN: ${p.expertise.join(' · ')}

You will receive a large body of training material (courses, transcripts, curated knowledge) that ${p.name} has been trained on. Your job is to compress it into a single, dense, self-contained expertise corpus that ${p.name} will carry INTO EVERY AGENT CALL, replacing runtime retrieval.

OUTPUT CONTRACT — the corpus MUST have exactly these four top-level sections, in this order, as Markdown:

# Frameworks
Numbered list. One entry per named framework with its full structure (steps, components, decision tree). Keep the named labels the sources use. If a framework has a mnemonic (e.g. "ZAK 7-block", "EVOLVE Core 5"), preserve it.

# Principles
Numbered list. ≥15 entries. Each entry is a one-paragraph principle that governs how ${p.name} decides. Reference evidence or examples from the sources when they exist. Principles must be specific to the domain — no generic marketing platitudes.

# Anti-patterns
Numbered list. ≥10 entries. What NOT to do, and why. Pull from rejection signals, failure case studies, or explicit "don't" guidance in the sources.

# Tactical heuristics
Numbered list. ≥20 entries. Rule-of-thumb shortcuts for in-the-moment decisions. Short (1-2 sentences). These are the "if you see X, do Y" rules ${p.name} will apply at runtime.

CONSTRAINTS:
- Total output ≤20,000 characters.
- Do NOT summarize. Preserve named frameworks, specific numbers, thresholds, and exact language when they appear in the sources.
- Do NOT invent content not present in the sources. If the sources don't cover a section, write "(no source material found for this section)" under it — but try hard to populate all four.
- Use ${p.name}'s voice: ${p.communicationStyle}
- No preamble, no meta-commentary, no "Here is the corpus". Start directly with "# Frameworks".`;
}

export function buildDistillUserMessage(payload: string): string {
  return `Here is the complete training material you've been trained on. Compile it into your baked-in expertise corpus per the 4-section contract.\n\n${payload}`;
}

/**
 * Run the distillation end-to-end for one persona. Calls the server
 * route `/api/admin/distill` which owns the Anthropic API key; persists
 * the result to IndexedDB; POSTs to the mirror route.
 *
 * Returns the persisted record. Throws on auth / API failure.
 */
export async function distillPersonaExpertise(
  agentId: AgentId,
  adminToken: string,
): Promise<PersonaDistillation> {
  const [chunks, knowledge] = await Promise.all([
    collectChunksForPersona(agentId),
    collectKnowledgeForPersona(agentId),
  ]);

  if (chunks.length === 0 && knowledge.length === 0) {
    throw new Error(`No training chunks or knowledge found for ${agentId}. Upload training sources first.`);
  }

  const { payload, stats } = assembleDistillInput(chunks, knowledge);
  const systemPrompt = buildDistillSystemPrompt(agentId);
  const userMessage = buildDistillUserMessage(payload);

  const res = await fetch('/api/admin/distill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify({
      agentId,
      systemPrompt,
      userMessage,
      inputStats: stats,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Distillation API failed: ${res.status} ${detail.slice(0, 200)}`);
  }

  const data = await res.json() as {
    distilledExpertise: string;
    tokens: number;
    model: string;
  };

  const existing = await getPersonaDistillation(agentId);
  const rec: PersonaDistillation = {
    agentId,
    distilledExpertise: data.distilledExpertise,
    chunkIds: chunks.map(c => c.id),
    sourceCount: stats.sourceCount,
    chunkCount: stats.chunkCount,
    inputChars: stats.totalChars,
    outputChars: data.distilledExpertise.length,
    generatedAt: new Date().toISOString(),
    model: data.model,
    tokens: data.tokens,
    version: (existing?.version ?? 0) + 1,
  };

  await savePersonaDistillation(rec);

  // Fire-and-forget mirror — don't block UI if it fails, the record is
  // already in IndexedDB.
  void fetch('/api/sync/persona-distillation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rec),
  }).catch(() => { /* server mirror is best-effort */ });

  return rec;
}

/**
 * Distill all 6 personas sequentially. Yields progress per agent.
 * Sequential to avoid Anthropic rate-limit + to keep cost predictable.
 */
export async function distillAllPersonas(
  adminToken: string,
  onProgress?: (agentId: AgentId, status: 'start' | 'done' | 'error', payload?: unknown) => void,
): Promise<{ succeeded: PersonaDistillation[]; failed: { agentId: AgentId; error: string }[] }> {
  const agentIds: AgentId[] = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea'];
  const succeeded: PersonaDistillation[] = [];
  const failed: { agentId: AgentId; error: string }[] = [];

  for (const id of agentIds) {
    onProgress?.(id, 'start');
    try {
      const rec = await distillPersonaExpertise(id, adminToken);
      succeeded.push(rec);
      onProgress?.(id, 'done', rec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ agentId: id, error: msg });
      onProgress?.(id, 'error', msg);
    }
  }

  return { succeeded, failed };
}
