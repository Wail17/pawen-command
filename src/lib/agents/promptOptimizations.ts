// ============================================================
// PAWEN — Phase block-B — Prompt composition utilities
//
// Pure helpers, zero side effects. Callers opt-in explicitly. The
// existing runGate / runSubAgents code paths stay working; these
// helpers are designed to be wired in gradually once measurements
// confirm they help.
//
// Rationale: see PROMPT_OPTIMIZATION_REPORT.md for the before/after
// analysis that motivated each helper.
// ============================================================

import type { AgentPersona, PersonaDistillation, AgentConstitution } from '../kb/types';
import { buildPersonaPrompt } from './personas';

// ------------------------------------------------------------
// 1. Split static vs dynamic for prompt caching
// ------------------------------------------------------------
//
// Anthropic prompt caching has a 1024-token minimum. The persona
// header + distillation + constitution is easily 8-20k tokens —
// well worth caching. But memories / gold examples / performance
// blocks change per call and bust the cache every time. Callers
// should pass the static portion as `systemPrefix` (separate cache
// control) and the dynamic portion as `systemPrompt`.

export interface SplitPrompt {
  static: string;    // persona identity + distillation + constitution (~stable across a gate run)
  dynamic: string;   // memories + gold examples + niche intel + performance (per-call)
}

export function buildSplitPersonaPrompt(persona: AgentPersona, opts: {
  distillation?: PersonaDistillation | null;
  constitution?: AgentConstitution | null;
}): SplitPrompt {
  const staticPortion = buildPersonaPrompt(persona, {
    distillation: opts.distillation ?? null,
    constitution: opts.constitution ?? null,
  });
  return { static: staticPortion, dynamic: '' };
}

// ------------------------------------------------------------
// 2. Memory capping — ensure balanced representation
// ------------------------------------------------------------
//
// Today `getRelevantMemories(id, N)` returns up to N by priority.
// Rejections score highest, which is correct — but if an agent
// accumulates 12 rejections and 30 learnings, every call sees only
// rejections. `capMemoriesByType` enforces a minimum quota for
// positive learnings so the agent keeps a balanced self-image.

export interface MemoryLike {
  type: 'learning' | 'opinion' | 'decision' | 'feedback' | 'error' | 'rejection';
  title: string;
  content: string;
  confidence: number;
}

export function capMemoriesByType<T extends MemoryLike>(memories: T[], opts: {
  maxRejections?: number;
  maxErrors?: number;
  maxLearnings?: number;
}): T[] {
  const { maxRejections = 3, maxErrors = 3, maxLearnings = 4 } = opts;
  const out: T[] = [];
  let r = 0, e = 0, l = 0;
  for (const m of memories) {
    if (m.type === 'rejection') { if (r < maxRejections) { out.push(m); r++; } }
    else if (m.type === 'error') { if (e < maxErrors) { out.push(m); e++; } }
    else { if (l < maxLearnings) { out.push(m); l++; } }
  }
  return out;
}

// ------------------------------------------------------------
// 3. Deduplicate prompt sections
// ------------------------------------------------------------
//
// Under certain gate configurations (BrandDNA + congruence recheck)
// the same block (e.g. "=== BRAND DNA (DO NOT DEVIATE) ===") was
// being appended twice. `deduplicateSections` scans a compiled
// prompt, keeps the first occurrence of each === HEADER === block,
// and drops subsequent duplicates.

const SECTION_RE = /(===\s+[A-Z][A-Z0-9\s\-/.]+===[\s\S]*?===\s+END[^=]*===)/g;

export function deduplicateSections(prompt: string): { cleaned: string; removed: number; removedHeaders: string[] } {
  const seen = new Set<string>();
  const removedHeaders: string[] = [];
  const cleaned = prompt.replace(SECTION_RE, (block) => {
    const header = block.match(/===\s+([^=]+?)\s+===/)?.[1]?.trim().toUpperCase() ?? '';
    if (seen.has(header)) {
      removedHeaders.push(header);
      return '';
    }
    seen.add(header);
    return block;
  });
  return { cleaned: cleaned.replace(/\n{3,}/g, '\n\n'), removed: removedHeaders.length, removedHeaders };
}

// ------------------------------------------------------------
// 4. Reorder blocks for cache reuse
// ------------------------------------------------------------
//
// Order matters for prompt caching: the cached prefix must match
// byte-for-byte across calls. Any block that changes per-call must
// come AFTER the cached boundary. Ideal order:
//
//   [CACHED]
//     1. Persona identity (base + decisionStyle + expertise)
//     2. DISTILLED EXPERTISE
//     3. CURRENT CONSTITUTION
//     4. DR PRINCIPLES
//     5. BRAND DNA (stable per gate run)
//   [NOT CACHED]
//     6. STRATEGIC CONTEXT (funnel + sub-avatar)
//     7. PRODUCT CONTEXT (shopify)
//     8. KNOWLEDGE BASE (gate-scoped)
//     9. MEMORY (per-agent)
//    10. GOLD EXAMPLES
//    11. USER PREFERENCES
//    12. NICHE INTEL
//    13. PERFORMANCE DATA
//    14. SWIPE VOCABULARY
//    15. SCOUT PROTOCOL
//    16. Task block (gate-specific)
//
// `reorderForCacheReuse` takes a compiled prompt and sorts its
// `=== HEADER === ... === END HEADER ===` blocks according to the
// canonical priority list below. Non-block text stays in place.

const CANONICAL_ORDER = [
  'DISTILLED EXPERTISE',
  'YOUR CURRENT CONSTITUTION',
  'DR PRINCIPLES',
  'BRAND DNA',
  'STRATEGIC CONTEXT',
  'PRODUCT CONTEXT',
  'KEY PRINCIPLES',          // buildKnowledgePrompt
  'TRAINING MATERIAL',       // legacy RAG path
  'CRITICAL: MISTAKES',      // buildMemoryPrompt errors
  'YOUR EXPERIENCE',         // buildMemoryPrompt learnings
  'GOLD EXAMPLES',
  'USER PREFERENCES',
  'NICHE INTEL',
  'PROVEN AD PERFORMANCE',
  'SWIPE VOCABULARY',
  'SCOUT PROTOCOL',
];

function rank(header: string): number {
  const upper = header.toUpperCase();
  for (let i = 0; i < CANONICAL_ORDER.length; i++) {
    if (upper.startsWith(CANONICAL_ORDER[i])) return i;
  }
  return 999;
}

export function reorderForCacheReuse(prompt: string): string {
  const blocks: Array<{ raw: string; header: string; idx: number }> = [];
  const parts: Array<{ kind: 'text' | 'block'; raw: string; idx?: number }> = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(SECTION_RE);
  let i = 0;
  while ((m = re.exec(prompt)) !== null) {
    if (m.index > cursor) parts.push({ kind: 'text', raw: prompt.slice(cursor, m.index) });
    const header = m[0].match(/===\s+([^=]+?)\s+===/)?.[1]?.trim().toUpperCase() ?? '';
    const idx = i++;
    blocks.push({ raw: m[0], header, idx });
    parts.push({ kind: 'block', raw: m[0], idx });
    cursor = m.index + m[0].length;
  }
  if (cursor < prompt.length) parts.push({ kind: 'text', raw: prompt.slice(cursor) });

  const sortedBlocks = [...blocks].sort((a, b) => {
    const ra = rank(a.header);
    const rb = rank(b.header);
    if (ra !== rb) return ra - rb;
    return a.idx - b.idx;
  });
  // Map original index → new index → reorder
  const indexMap = new Map<number, number>();
  sortedBlocks.forEach((b, newIdx) => indexMap.set(b.idx, newIdx));

  const out: string[] = [];
  let blockCursor = 0;
  for (const p of parts) {
    if (p.kind === 'text') out.push(p.raw);
    else {
      out.push(sortedBlocks[blockCursor].raw);
      blockCursor++;
    }
  }
  return out.join('').replace(/\n{3,}/g, '\n\n');
}

// ------------------------------------------------------------
// 5. Token-count estimator
// ------------------------------------------------------------
//
// Lets callers log "prompt length = 12,340 tokens (~52k chars)" without
// pulling in a tokenizer dep. Approximation: ~3.8 chars/token for Claude.

export function estimateTokens(text: string): number {
  return Math.round(text.length / 3.8);
}

// ------------------------------------------------------------
// 6. Scout protocol block — single source of truth
// ------------------------------------------------------------
//
// The SCOUT PROTOCOL block was hand-written in runSubAgents.ts with
// env-var reads inline (bad: it's re-generated per sub-agent). This
// helper returns the same block, computed once per run. Callers can
// compute once and append to every sub-agent prompt.

export function buildScoutProtocolBlock(perGateCap: number, dailyCap: number): string {
  return `=== SCOUT PROTOCOL ===
If — and only if — you need more intel (VOC quotes, competitor ads, recent reviews, etc.) than the context already provides to produce a high-quality output, you may emit EXACTLY ONE line in your response formatted:
  SCRAPE_REQUEST: <one short sentence describing what you need>
Use this sparingly (hard cap: ${perGateCap} Scout calls per gate run, ${dailyCap} per project per day). Do NOT request Scout for anything already in the context above.
=== END SCOUT PROTOCOL ===`;
}
