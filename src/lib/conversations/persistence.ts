// ============================================================
// PAWEN — Phase V — Server-side persistence for conversations.
// Single source of truth: Neon. Client-side IDB mirrors from reads.
// Lazy CREATE TABLE IF NOT EXISTS, same pattern as other U/V tables.
// ============================================================

import 'server-only';
import { getSql } from '../db/client';
import type { Conversation, ConversationMessage } from '../kb/types';

export async function ensureConversationSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS conversations_mirror (
      id             TEXT PRIMARY KEY,
      project_id     TEXT NOT NULL,
      title          TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active',
      initiator      TEXT NOT NULL,
      topic          TEXT NOT NULL,
      data           JSONB NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at      TIMESTAMPTZ,
      message_count  INTEGER NOT NULL DEFAULT 0,
      token_cost     INTEGER NOT NULL DEFAULT 0,
      cost_usd       NUMERIC NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversations_mirror_project_idx
    ON conversations_mirror (project_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversations_mirror_status_idx
    ON conversations_mirror (status, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS conversation_messages_mirror (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      author_type     TEXT NOT NULL,
      author_id       TEXT NOT NULL,
      content         TEXT NOT NULL,
      data            JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversation_messages_mirror_conv_idx
    ON conversation_messages_mirror (conversation_id, created_at ASC)
  `;
}

export async function persistConversation(c: Conversation): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO conversations_mirror
      (id, project_id, title, status, initiator, topic, data, created_at, closed_at, message_count, token_cost, cost_usd)
    VALUES
      (${c.id}, ${c.projectId}, ${c.title}, ${c.status}, ${c.initiator},
       ${c.topic}, ${JSON.stringify(c)}::jsonb, ${c.createdAt}, ${c.closedAt ?? null},
       ${c.messageCount}, ${c.tokenCost}, ${c.costUsd})
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      data = EXCLUDED.data,
      closed_at = EXCLUDED.closed_at,
      message_count = EXCLUDED.message_count,
      token_cost = EXCLUDED.token_cost,
      cost_usd = EXCLUDED.cost_usd
  `;
}

export async function persistMessage(m: ConversationMessage): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO conversation_messages_mirror
      (id, conversation_id, author_type, author_id, content, data, created_at)
    VALUES
      (${m.id}, ${m.conversationId}, ${m.authorType}, ${m.authorId},
       ${m.content}, ${JSON.stringify(m)}::jsonb, ${m.createdAt})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM conversations_mirror WHERE id = ${id} LIMIT 1
  `) as Array<{ data: unknown }>;
  return rows[0]?.data ? (rows[0].data as Conversation) : null;
}

export async function loadThread(conversationId: string): Promise<ConversationMessage[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM conversation_messages_mirror
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `) as Array<{ data: unknown }>;
  return rows.map(r => r.data as ConversationMessage);
}

export async function listProjectConversations(projectId: string): Promise<Conversation[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM conversations_mirror
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 100
  `) as Array<{ data: unknown }>;
  return rows.map(r => r.data as Conversation);
}

export async function countActiveConversationsForProject(projectId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM conversations_mirror
    WHERE project_id = ${projectId} AND status = 'active'
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function countRecentSystemConversationsForProject(projectId: string, hours: number): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM conversations_mirror
    WHERE project_id = ${projectId}
      AND initiator = 'system'
      AND created_at > NOW() - (${hours} || ' hours')::interval
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function updateConversationStats(
  conversationId: string,
  delta: { incMessages?: number; incTokens?: number; incCostUsd?: number },
): Promise<void> {
  const sql = getSql();
  const incMsg = delta.incMessages ?? 0;
  const incTok = delta.incTokens ?? 0;
  const incUsd = delta.incCostUsd ?? 0;
  // Two-step: bump the typed columns, then sync the JSONB snapshot so
  // reads from `data` stay in lockstep. Simpler than a chained expression
  // where Postgres evaluates every column reference against the pre-update
  // row value (safe, but hard to read).
  await sql`
    UPDATE conversations_mirror
    SET
      message_count = message_count + ${incMsg},
      token_cost = token_cost + ${incTok},
      cost_usd = cost_usd + ${incUsd}
    WHERE id = ${conversationId}
  `;
  await sql`
    UPDATE conversations_mirror
    SET data = data
      || jsonb_build_object(
           'messageCount', message_count,
           'tokenCost', token_cost,
           'costUsd', cost_usd
         )
    WHERE id = ${conversationId}
  `;
}

export async function markConversationClosed(
  conversationId: string,
  closeReason: 'user' | 'cap_reached' | 'cost_ceiling' | 'lea_summary' | 'error',
  summary?: string,
): Promise<void> {
  const sql = getSql();
  const now = new Date().toISOString();
  // Neon's serverless driver can't infer the Postgres type of a JS value
  // passed straight into jsonb_build_object (error "could not determine
  // data type of parameter $N"). Cast each parameter to ::text explicitly.
  const summarySafe = summary ?? '';
  await sql`
    UPDATE conversations_mirror
    SET status = 'closed',
        closed_at = ${now},
        data = data
          || jsonb_build_object(
               'status', 'closed',
               'closedAt', (${now})::text,
               'closeReason', (${closeReason})::text,
               'summary', (${summarySafe})::text
             )
    WHERE id = ${conversationId}
  `;

  // V.8 — Discord notification with summary + cost (best-effort).
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    try {
      const latest = await loadConversation(conversationId);
      if (latest) {
        const summaryText = summary ?? latest.summary ?? '(no summary)';
        const text = `🎬 Conversation closed — ${latest.title} · reason=${closeReason} · msgs=${latest.messageCount} · cost=$${latest.costUsd.toFixed(4)}\n> ${summaryText.slice(0, 300)}`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
      }
    } catch {
      /* non-blocking */
    }
  }
}

export async function getConversationStats(windowHours: number): Promise<{
  total: number;
  active: number;
  closed: number;
  totalCostUsd: number;
  totalTokens: number;
  avgMessagesPerConv: number;
}> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::int AS active,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)::int AS closed,
      COALESCE(SUM(cost_usd), 0)::float AS total_cost_usd,
      COALESCE(SUM(token_cost), 0)::int AS total_tokens,
      COALESCE(AVG(message_count), 0)::float AS avg_messages
    FROM conversations_mirror
    WHERE created_at > NOW() - (${windowHours} || ' hours')::interval
  `) as Array<{
    total: number; active: number; closed: number;
    total_cost_usd: number; total_tokens: number; avg_messages: number;
  }>;
  const r = rows[0] ?? { total: 0, active: 0, closed: 0, total_cost_usd: 0, total_tokens: 0, avg_messages: 0 };
  return {
    total: r.total,
    active: r.active,
    closed: r.closed,
    totalCostUsd: r.total_cost_usd,
    totalTokens: r.total_tokens,
    avgMessagesPerConv: r.avg_messages,
  };
}
