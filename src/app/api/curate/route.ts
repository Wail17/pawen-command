// ============================================================
// AutoEcom Lab — Curation API (admin only)
// POST /api/curate
// Body: { user: AppUser, agent_id: AgentId }
//
// Flow:
//   1. Load all PENDING contributions for the agent + the current
//      curated_knowledge entries for the same agent.
//   2. Ask Claude Sonnet 4.6 to dedup/merge: for each pending entry
//      decide MERGE (into existing), APPROVE (new curated entry),
//      or REJECT (low quality / off-topic).
//   3. Apply the decisions in a single transaction-ish batch:
//        - APPROVE → insert into curated_knowledge
//        - MERGE   → update existing curated_knowledge (bump version,
//                    append contribution id + contributor)
//        - REJECT  → mark contribution as rejected
//   4. Record a curation_runs row with counts + Claude's reasoning.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin, requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { isAdminRequest } from '@/lib/auth/adminServer';
import {
  AGENT_IDS,
  type AgentId,
  type Contribution,
  type CuratedKnowledge,
  type ContributionType,
} from '@/lib/db/schema';
import { extractJSON } from '@/lib/util/extractJson';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';

export const maxDuration = 300;

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

type ContributionRow = {
  id: string;
  contributor: string;
  agent_id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: string | number | null;
  attachment_type: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
};

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

type Decision =
  | {
      action: 'approve';
      contribution_id: string;
      title: string;
      content: string;
      tags: string[];
      reason: string;
    }
  | {
      action: 'merge';
      contribution_id: string;
      merge_into_curated_id: string;
      merged_content: string; // the combined / polished content
      merged_tags: string[];
      reason: string;
    }
  | {
      action: 'reject';
      contribution_id: string;
      reason: string;
    };

type ClaudeDecisionPayload = {
  summary: string;
  decisions: Decision[];
};

const CURATION_SYSTEM_PROMPT = `You are an editorial curator for a marketing AI knowledge base.

Your job: take raw, unstructured contributions from a team of marketers and decide how each one should enter the curated knowledge base. The goal is to BUILD UP a high-quality, dedup'd KB that will later be injected into AI prompts to improve marketing output.

For each pending contribution, choose exactly one action:
- "approve"  → this is net-new information. Include a cleaned-up title and polished content that preserves ALL the useful info but removes filler/repetition. Keep the original voice if it has practical examples.
- "merge"    → this duplicates or extends an existing curated entry. Specify which curated entry to merge into (merge_into_curated_id), and provide merged_content that weaves the new info into the existing entry WITHOUT losing anything from either side.
- "reject"   → only reject if the contribution is off-topic, spammy, obviously low quality, or adds zero information. Be tolerant: anything with a specific insight should be approved or merged, not rejected.

STRICT OUTPUT FORMAT — return ONLY JSON, no markdown fences, no prose outside the JSON:
{
  "summary": "<1-3 sentences explaining the overall curation pass>",
  "decisions": [
    { "action": "approve", "contribution_id": "...", "title": "...", "content": "...", "tags": ["..."], "reason": "..." },
    { "action": "merge",   "contribution_id": "...", "merge_into_curated_id": "...", "merged_content": "...", "merged_tags": ["..."], "reason": "..." },
    { "action": "reject",  "contribution_id": "...", "reason": "..." }
  ]
}

Rules:
- Every pending contribution_id MUST appear exactly once in "decisions".
- Never invent merge_into_curated_id — only use IDs from the "existing curated entries" list.
- Tags: lowercase, 1-4 words, no punctuation, 3-10 tags per entry.
- Content: plain text or lightweight markdown. No HTML. Max ~3000 chars per entry.
- When merging, prefer to preserve the contributor's concrete examples — examples are gold.`;

function buildCurationUserMessage(
  agentId: AgentId,
  pending: Contribution[],
  curated: CuratedKnowledge[]
): string {
  const pendingBlock = pending
    .map(
      (c, i) => `--- Pending #${i + 1} (id: ${c.id}) ---
Contributor: ${c.contributor}
Type: ${c.type}
Title: ${c.title}
Tags: ${c.tags.join(', ') || '(none)'}
Content:
${c.content}`
    )
    .join('\n\n');

  const curatedBlock =
    curated.length === 0
      ? '(none — this is the first curation pass for this agent)'
      : curated
          .map(
            (k, i) => `--- Curated #${i + 1} (id: ${k.id}) ---
Type: ${k.type}
Title: ${k.title}
Tags: ${k.tags.join(', ') || '(none)'}
Version: ${k.version}
Content:
${k.content.slice(0, 1500)}`
          )
          .join('\n\n');

  return `Agent: ${agentId}

=== EXISTING CURATED ENTRIES ===
${curatedBlock}

=== PENDING CONTRIBUTIONS TO PROCESS ===
${pendingBlock}

Return the decisions JSON now.`;
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const advisorEnabled = shouldUseAdvisor(CLAUDE_MODEL);

  const requestBody: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: 16384,
    temperature: 0.3,
    system: [
      {
        type: 'text',
        text: withAdvisorHint(systemPrompt, CLAUDE_MODEL),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };

  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const beta = composeBetaHeader({ caching: true, advisor: advisorEnabled });
  if (beta) headers['anthropic-beta'] = beta;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(280_000),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API ${response.status}: ${errBody?.error?.message || 'unknown error'}`
    );
  }

  const data = await response.json();
  const content = data.content
    ?.filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('') ?? '';
  return content;
}

function rowToContribution(row: ContributionRow): Contribution {
  return {
    id: row.id,
    contributor: row.contributor,
    agent_id: row.agent_id as AgentId,
    type: row.type as ContributionType,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    attachment_url: row.attachment_url,
    attachment_name: row.attachment_name,
    attachment_size: row.attachment_size != null ? Number(row.attachment_size) : null,
    attachment_type: row.attachment_type,
    status: row.status as Contribution['status'],
    created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
  };
}

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

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// === POST ===========================================================
export async function POST(req: Request) {
  const runId = randomId('cr');

  // Accept cookie-session admin OR legacy x-admin-token.
  const session = requireAdmin(req);
  const legacyAdmin = isAdminRequest(req);
  if (session instanceof Response && !legacyAdmin) return session;

  // The runner is always the session user (authoritative) unless we
  // fell through the legacy path, in which case we accept the body's
  // user field as a label-only value for back-compat.
  const runner =
    session instanceof Response ? String((await req.clone().json())?.user ?? 'admin') : session.user;

  try {
    const body = await req.json();
    const agentId = String(body?.agent_id ?? '') as AgentId;
    const user = runner;

    if (!AGENT_IDS.includes(agentId)) {
      return NextResponse.json({ ok: false, message: 'Invalid agent_id' }, { status: 400 });
    }

    const sql = getSql();

    // 1. Load pending + curated
    const pendingRows = (await sql`
      SELECT * FROM contributions
      WHERE agent_id = ${agentId} AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100
    `) as ContributionRow[];

    const curatedRows = (await sql`
      SELECT * FROM curated_knowledge
      WHERE agent_id = ${agentId}
      ORDER BY approved_at DESC
      LIMIT 100
    `) as CuratedRow[];

    const pending = pendingRows.map(rowToContribution);
    const curated = curatedRows.map(rowToCurated);

    if (pending.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No pending contributions for this agent',
        counts: { pending: 0, merged: 0, approved: 0, rejected: 0 },
      });
    }

    console.log(
      `[curate:${runId}] ${user} processing ${pending.length} pending for agent "${agentId}" (${curated.length} existing curated)`
    );

    // 2. Ask Claude for decisions
    const userMessage = buildCurationUserMessage(agentId, pending, curated);
    const rawClaude = await callClaude(CURATION_SYSTEM_PROMPT, userMessage);

    const payload = extractJSON<ClaudeDecisionPayload>(rawClaude);
    if (!payload || !Array.isArray(payload.decisions)) {
      console.error(`[curate:${runId}] failed to parse Claude response:`, rawClaude.slice(0, 500));
      throw new Error('Claude returned invalid JSON or missing "decisions" array');
    }

    // 3. Apply decisions
    let mergedCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    const pendingById = new Map(pending.map((p) => [p.id, p]));
    const curatedById = new Map(curated.map((k) => [k.id, k]));

    for (const decision of payload.decisions) {
      const contribution = pendingById.get(decision.contribution_id);
      if (!contribution) {
        console.warn(`[curate:${runId}] decision references unknown contribution ${decision.contribution_id}`);
        continue;
      }

      if (decision.action === 'approve') {
        const newId = randomId('ck');
        const tags = (decision.tags ?? []).map((t) => String(t).toLowerCase()).slice(0, 10);
        await sql`
          INSERT INTO curated_knowledge (
            id, agent_id, type, title, content, tags,
            source_contribution_ids, source_contributors, approved_by, version
          ) VALUES (
            ${newId}, ${agentId}, ${contribution.type},
            ${decision.title || contribution.title},
            ${decision.content || contribution.content},
            ${tags.length ? tags : contribution.tags},
            ${[contribution.id]},
            ${[contribution.contributor]},
            ${user},
            1
          )
        `;
        await sql`
          UPDATE contributions
          SET status = 'approved', updated_at = NOW()
          WHERE id = ${contribution.id}
        `;
        approvedCount++;
      } else if (decision.action === 'merge') {
        const target = curatedById.get(decision.merge_into_curated_id);
        if (!target) {
          console.warn(
            `[curate:${runId}] merge target ${decision.merge_into_curated_id} not found — treating as approve`
          );
          const newId = randomId('ck');
          await sql`
            INSERT INTO curated_knowledge (
              id, agent_id, type, title, content, tags,
              source_contribution_ids, source_contributors, approved_by, version
            ) VALUES (
              ${newId}, ${agentId}, ${contribution.type},
              ${contribution.title},
              ${decision.merged_content || contribution.content},
              ${contribution.tags},
              ${[contribution.id]},
              ${[contribution.contributor]},
              ${user},
              1
            )
          `;
          await sql`UPDATE contributions SET status = 'approved', updated_at = NOW() WHERE id = ${contribution.id}`;
          approvedCount++;
          continue;
        }

        const nextContent = decision.merged_content || target.content;
        const nextTags = decision.merged_tags?.length
          ? decision.merged_tags.map((t) => String(t).toLowerCase()).slice(0, 10)
          : target.tags;
        const nextSources = Array.from(new Set([...target.source_contribution_ids, contribution.id]));
        const nextContributors = Array.from(
          new Set([...target.source_contributors, contribution.contributor])
        );

        await sql`
          UPDATE curated_knowledge
          SET content = ${nextContent},
              tags = ${nextTags},
              source_contribution_ids = ${nextSources},
              source_contributors = ${nextContributors},
              version = version + 1,
              approved_at = NOW()
          WHERE id = ${target.id}
        `;
        await sql`
          UPDATE contributions
          SET status = 'merged', updated_at = NOW()
          WHERE id = ${contribution.id}
        `;
        mergedCount++;
      } else if (decision.action === 'reject') {
        await sql`
          UPDATE contributions
          SET status = 'rejected', updated_at = NOW()
          WHERE id = ${contribution.id}
        `;
        rejectedCount++;
      }
    }

    // 4. Log the run
    await sql`
      INSERT INTO curation_runs (
        id, agent_id, pending_count, merged_count, approved_count, rejected_count,
        claude_reasoning, run_by
      ) VALUES (
        ${runId}, ${agentId}, ${pending.length}, ${mergedCount}, ${approvedCount}, ${rejectedCount},
        ${payload.summary ?? ''}, ${user}
      )
    `;

    console.log(
      `[curate:${runId}] done — approved=${approvedCount} merged=${mergedCount} rejected=${rejectedCount}`
    );

    return NextResponse.json({
      ok: true,
      runId,
      counts: {
        pending: pending.length,
        approved: approvedCount,
        merged: mergedCount,
        rejected: rejectedCount,
      },
      summary: payload.summary,
      decisions: payload.decisions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[curate:${runId}] error:`, err);
    return NextResponse.json({ ok: false, message, runId }, { status: 500 });
  }
}

// GET /api/curate?agent=... — returns curated knowledge for browsing
export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const { searchParams } = new URL(req.url);
    const agent = searchParams.get('agent');

    const sql = getSql();
    const rows = agent
      ? ((await sql`
          SELECT * FROM curated_knowledge WHERE agent_id = ${agent}
          ORDER BY approved_at DESC LIMIT 500
        `) as CuratedRow[])
      : ((await sql`
          SELECT * FROM curated_knowledge
          ORDER BY approved_at DESC LIMIT 500
        `) as CuratedRow[]);

    return NextResponse.json({
      ok: true,
      curated: rows.map(rowToCurated),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
