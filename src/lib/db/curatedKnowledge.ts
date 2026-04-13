// ============================================================
// AutoEcom Lab — Curated knowledge injection helpers
// Server-only. Fetches curated_knowledge rows for a given agent
// and renders them as an Anthropic-cached system prefix string.
// ============================================================

import 'server-only';
import { getSql } from './client';
import type { AgentId, CuratedKnowledge, ContributionType } from './schema';

type CuratedRow = {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  source_contribution_ids: string[];
  source_contributors: string[];
  approved_by: string;
  approved_at: string | Date;
  version: number;
};

function rowToCurated(row: CuratedRow): CuratedKnowledge {
  return {
    id: row.id,
    agent_id: row.agent_id as AgentId,
    type: row.type as ContributionType,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    source_contribution_ids: row.source_contribution_ids ?? [],
    source_contributors: row.source_contributors ?? [],
    approved_by: row.approved_by,
    approved_at: typeof row.approved_at === 'string' ? row.approved_at : row.approved_at.toISOString(),
    version: row.version,
  };
}

/**
 * Fetch curated knowledge for an agent. Always includes 'general'
 * so cross-agent learnings apply everywhere.
 */
export async function fetchCuratedForAgent(
  agentId: AgentId,
  limit = 80
): Promise<CuratedKnowledge[]> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT * FROM curated_knowledge
      WHERE agent_id = ${agentId} OR agent_id = 'general'
      ORDER BY approved_at DESC
      LIMIT ${limit}
    `) as CuratedRow[];
    return rows.map(rowToCurated);
  } catch (err) {
    // Table might not exist yet (before first migration) — return empty
    // instead of failing the whole pipeline.
    console.warn(
      `[curatedKnowledge] fetch failed for ${agentId}, returning empty:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Render curated entries as a markdown block suitable for appending to
 * a system-prefix string that is already marked with cache_control.
 * Returns '' if there's nothing to inject.
 */
export function renderCuratedAsPrefix(
  agentId: AgentId,
  entries: CuratedKnowledge[]
): string {
  if (entries.length === 0) return '';

  const byType = new Map<ContributionType, CuratedKnowledge[]>();
  for (const e of entries) {
    const arr = byType.get(e.type) ?? [];
    arr.push(e);
    byType.set(e.type, arr);
  }

  const sections: string[] = [];
  const order: ContributionType[] = ['rule', 'anti-pattern', 'framework', 'example', 'resource'];
  for (const t of order) {
    const items = byType.get(t);
    if (!items || items.length === 0) continue;
    const heading =
      t === 'rule' ? '## RULES'
      : t === 'anti-pattern' ? '## ANTI-PATTERNS (mistakes to NEVER repeat)'
      : t === 'framework' ? '## FRAMEWORKS'
      : t === 'example' ? '## EXAMPLES'
      : '## RESOURCES';
    const body = items
      .map((k, i) => `### ${i + 1}. ${k.title}
${k.content.slice(0, 2500)}
${k.tags.length ? `*tags: ${k.tags.join(', ')}*` : ''}`)
      .join('\n\n');
    sections.push(`${heading}\n\n${body}`);
  }

  return `# TEAM KNOWLEDGE BASE — ${agentId.toUpperCase()}

This knowledge was contributed by your team of marketers and curated by an editor. It is the authoritative playbook for this agent. When the task below overlaps with these rules, frameworks, or examples, DEFER to this knowledge. If an anti-pattern here conflicts with a "clever" idea you had, drop the clever idea — we've been burned before.

${sections.join('\n\n')}

---
END TEAM KNOWLEDGE BASE — the reference methodology and task follow below.`;
}
