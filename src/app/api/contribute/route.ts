// ============================================================
// AutoEcom Lab — Contributions API
// POST /api/contribute   — create a pending contribution
// GET  /api/contribute   — list (query: agent, status, contributor)
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession, requireAdmin } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import {
  AGENT_IDS,
  CONTRIBUTION_TYPES,
  type AgentId,
  type ContributionType,
  type ContributionStatus,
  type Contribution,
} from '@/lib/db/schema';

export const maxDuration = 30;

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
    status: row.status as ContributionStatus,
    created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
  };
}

function randomId(): string {
  return `ct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// === POST ============================================================
export async function POST(req: Request) {
  // Defense-in-depth: the proxy gates /api/*, but we also verify here.
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();

    // SECURITY: always trust the session, never the body. A client could
    // put any name in `body.contributor` and it used to be accepted as
    // long as it was in the hardcoded APP_USERS list. Now the contributor
    // IS the cookie-signed session user, period.
    const contributor = session.user;
    const agent_id = String(body.agent_id ?? '').trim();
    const type = String(body.type ?? '').trim();
    const title = String(body.title ?? '').trim();
    const content = String(body.content ?? '').trim();
    const tagsInput = Array.isArray(body.tags) ? body.tags : [];
    if (!AGENT_IDS.includes(agent_id as AgentId)) {
      return NextResponse.json({ ok: false, message: 'Invalid agent_id' }, { status: 400 });
    }
    if (!CONTRIBUTION_TYPES.includes(type as ContributionType)) {
      return NextResponse.json({ ok: false, message: 'Invalid type' }, { status: 400 });
    }
    if (title.length < 3 || title.length > 200) {
      return NextResponse.json({ ok: false, message: 'Title must be 3-200 chars' }, { status: 400 });
    }
    if (content.length < 10 || content.length > 20_000) {
      return NextResponse.json({ ok: false, message: 'Content must be 10-20000 chars' }, { status: 400 });
    }

    const tags = tagsInput
      .map((t: unknown) => String(t).trim().toLowerCase())
      .filter((t: string) => t.length > 0 && t.length < 40)
      .slice(0, 15);

    const attachment_url = body.attachment_url ? String(body.attachment_url) : null;
    const attachment_name = body.attachment_name ? String(body.attachment_name) : null;
    const attachment_size = body.attachment_size != null ? Number(body.attachment_size) : null;
    const attachment_type = body.attachment_type ? String(body.attachment_type) : null;

    const sql = getSql();
    const id = randomId();

    const rows = (await sql`
      INSERT INTO contributions (
        id, contributor, agent_id, type, title, content, tags,
        attachment_url, attachment_name, attachment_size, attachment_type, status
      ) VALUES (
        ${id}, ${contributor}, ${agent_id}, ${type}, ${title}, ${content}, ${tags},
        ${attachment_url}, ${attachment_name}, ${attachment_size}, ${attachment_type}, 'pending'
      )
      RETURNING *
    `) as ContributionRow[];

    console.log(`[contribute] ${contributor} → ${agent_id}/${type} "${title}" (${id})`);

    await writeAudit(req, contributor, 'contribute.create', {
      id,
      agent_id,
      type,
      title,
    });

    return NextResponse.json({ ok: true, contribution: rowToContribution(rows[0]) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[contribute:POST] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

// === GET =============================================================
export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const searchParams = req.nextUrl.searchParams;
    const agent = searchParams.get('agent');
    const status = searchParams.get('status');
    const contributor = searchParams.get('contributor');
    const limit = Math.min(Number(searchParams.get('limit') ?? 200), 500);

    const sql = getSql();

    // Neon tagged templates need separate queries for different WHERE shapes.
    // Keep it simple: build one query per filter combo we actually use.
    let rows: ContributionRow[];
    if (agent && status) {
      rows = (await sql`
        SELECT * FROM contributions
        WHERE agent_id = ${agent} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as ContributionRow[];
    } else if (agent) {
      rows = (await sql`
        SELECT * FROM contributions
        WHERE agent_id = ${agent}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as ContributionRow[];
    } else if (status) {
      rows = (await sql`
        SELECT * FROM contributions
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as ContributionRow[];
    } else if (contributor) {
      rows = (await sql`
        SELECT * FROM contributions
        WHERE contributor = ${contributor}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as ContributionRow[];
    } else {
      rows = (await sql`
        SELECT * FROM contributions
        ORDER BY created_at DESC
        LIMIT ${limit}
      `) as ContributionRow[];
    }

    return NextResponse.json({
      ok: true,
      contributions: rows.map(rowToContribution),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[contribute:GET] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

// === DELETE ==========================================================
// DELETE /api/contribute?id=... — admin only, for cleanup
export async function DELETE(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, message: 'Missing id' }, { status: 400 });
    }

    const sql = getSql();
    await sql`DELETE FROM contributions WHERE id = ${id}`;
    console.log(`[contribute:DELETE] admin ${session.user} removed ${id}`);
    await writeAudit(req, session.user, 'contribute.delete', { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[contribute:DELETE] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
