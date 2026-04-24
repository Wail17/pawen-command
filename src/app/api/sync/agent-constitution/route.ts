// ============================================================
// PAWEN — /api/sync/agent-constitution
//
// Phase U.2 — IndexedDB → Neon mirror for per-agent constitutions.
// Keeps latest version per agent (soft history kept in IndexedDB
// on the client).
//
//   POST  <AgentConstitution JSON>       → { ok }
//   GET                                  → { ok, rows: AgentConstitution[] }
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 10;

const MAX_JSON_BYTES = 256 * 1024;
const AGENT_IDS = new Set(['sarah', 'marcus', 'alex', 'nina', 'david', 'lea']);

async function ensureTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS agent_constitutions_mirror (
      agent_id     TEXT PRIMARY KEY,
      version      INTEGER NOT NULL,
      data         JSONB NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const len = req.headers.get('content-length');
  if (len && Number(len) > MAX_JSON_BYTES) {
    return NextResponse.json({ ok: false, message: 'Body too large' }, { status: 413 });
  }

  let body: {
    agentId?: string;
    version?: number;
    constitution?: string;
    generatedAt?: string;
  } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body.agentId !== 'string' || !AGENT_IDS.has(body.agentId)) {
    return NextResponse.json({ ok: false, message: 'Invalid agentId' }, { status: 400 });
  }
  if (typeof body.constitution !== 'string' || body.constitution.length < 100) {
    return NextResponse.json({ ok: false, message: 'constitution required' }, { status: 400 });
  }

  try {
    await ensureTable();
    const sql = getSql();
    const generatedAt = body.generatedAt ?? new Date().toISOString();
    const version = Number(body.version) || 1;

    await sql`
      INSERT INTO agent_constitutions_mirror (agent_id, version, data, generated_at, updated_at)
      VALUES (${body.agentId}, ${version}, ${JSON.stringify(body)}::jsonb, ${generatedAt}, NOW())
      ON CONFLICT (agent_id)
        DO UPDATE SET
          version = EXCLUDED.version,
          data = EXCLUDED.data,
          generated_at = EXCLUDED.generated_at,
          updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    await ensureTable();
    const sql = getSql();
    const rows = (await sql`
      SELECT agent_id, version, data, generated_at
      FROM agent_constitutions_mirror
      ORDER BY agent_id
    `) as Array<{ agent_id: string; version: number; data: unknown; generated_at: string }>;
    return NextResponse.json({
      ok: true,
      rows: rows.map(r => r.data),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
