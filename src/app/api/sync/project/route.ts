// ============================================================
// AutoEcom Lab — /api/sync/project
//
// IndexedDB → Neon mirror for the `projects` store.
// Every project write on the client is fire-and-forget mirrored
// here so the god panel (/admin) can see everything.
//
//   POST   /api/sync/project                 upsert  (body = Project JSON)
//   DELETE /api/sync/project?id=<projectId>  delete project + gate outputs
//
// Session-gated via proxy.ts AND re-verified here (defense-in-depth
// per Vercel routing-middleware guidance / CVE-2025-29927).
//
// Rows are owned by the session user. A user can only mirror/delete
// their OWN projects — admins can still see everything via the read
// endpoints in /api/admin/*.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { watermarkObject } from '@/lib/auth/watermark';

export const maxDuration = 15;

// Guard: a Project payload can be large (gate data, sub-avatars, etc).
// Postgres JSONB can handle megabytes, but we cap per-write at 2 MB so
// a malicious client can't DOS us by shipping a 200 MB JSON blob.
const MAX_PROJECT_JSON_BYTES = 2 * 1024 * 1024;

type ProjectPayload = {
  id: string;
  name?: string;
  [k: string]: unknown;
};

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: ProjectPayload;
  try {
    body = (await req.json()) as ProjectPayload;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object' || typeof body.id !== 'string' || !body.id) {
    return NextResponse.json(
      { ok: false, message: 'project.id is required' },
      { status: 400 },
    );
  }

  // Watermark project data with user fingerprint before persisting
  const watermarked = watermarkObject(body, session.user);
  const json = JSON.stringify(watermarked);
  if (json.length > MAX_PROJECT_JSON_BYTES) {
    return NextResponse.json(
      { ok: false, message: 'Project payload too large' },
      { status: 413 },
    );
  }

  const name = typeof body.name === 'string' ? body.name : '(unnamed)';

  try {
    const sql = getSql();
    // Upsert: first writer wins ownership. Subsequent writes must be
    // from the same owner OR an admin — otherwise we reject.
    const existing = (await sql`
      SELECT owner FROM projects_mirror WHERE id = ${body.id} LIMIT 1
    `) as Array<{ owner: string }>;

    if (existing[0] && existing[0].owner !== session.user && session.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Project owned by another user' },
        { status: 403 },
      );
    }

    await sql`
      INSERT INTO projects_mirror (id, owner, name, data, created_at, updated_at)
      VALUES (${body.id}, ${session.user}, ${name}, ${json}::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            data = EXCLUDED.data,
            updated_at = NOW()
    `;

    await writeAudit(req, session.user, 'project.upsert', {
      projectId: body.id,
      name,
      bytes: json.length,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync:project:POST] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { ok: false, message: 'id query param required' },
      { status: 400 },
    );
  }

  try {
    const sql = getSql();
    const existing = (await sql`
      SELECT owner FROM projects_mirror WHERE id = ${id} LIMIT 1
    `) as Array<{ owner: string }>;

    if (!existing[0]) {
      // Idempotent: already gone
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    if (existing[0].owner !== session.user && session.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Project owned by another user' },
        { status: 403 },
      );
    }

    // Cascade: gate outputs for this project go too
    await sql`DELETE FROM gate_outputs_mirror WHERE project_id = ${id}`;
    await sql`DELETE FROM projects_mirror WHERE id = ${id}`;

    await writeAudit(req, session.user, 'project.delete', { projectId: id });

    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync:project:DELETE] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
