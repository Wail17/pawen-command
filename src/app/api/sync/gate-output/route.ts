// ============================================================
// AutoEcom Lab — /api/sync/gate-output
//
// IndexedDB → Neon mirror for the `gateOutputs` store.
// Every gate write on the client is fire-and-forget mirrored here.
//
//   POST   /api/sync/gate-output    upsert  (body = GateOutput JSON)
//   DELETE /api/sync/gate-output?projectId=...&gateId=...
//
// Ownership is inherited from the parent project in projects_mirror.
// If the project doesn't exist yet (race), we fall back to session.user.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { watermarkObject } from '@/lib/auth/watermark';

export const maxDuration = 15;

const MAX_GATE_JSON_BYTES = 4 * 1024 * 1024; // gate outputs (avatar dumps) can be chunky

type GateOutputPayload = {
  projectId: string;
  gateId: string;
  status?: string;
  [k: string]: unknown;
};

async function resolveOwner(
  sql: ReturnType<typeof getSql>,
  projectId: string,
  fallback: string,
): Promise<string> {
  try {
    const rows = (await sql`
      SELECT owner FROM projects_mirror WHERE id = ${projectId} LIMIT 1
    `) as Array<{ owner: string }>;
    return rows[0]?.owner ?? fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: GateOutputPayload;
  try {
    body = (await req.json()) as GateOutputPayload;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.projectId !== 'string' ||
    typeof body.gateId !== 'string' ||
    !body.projectId ||
    !body.gateId
  ) {
    return NextResponse.json(
      { ok: false, message: 'projectId and gateId are required' },
      { status: 400 },
    );
  }

  // Watermark gate output data with the user's fingerprint before persisting.
  // This way, any leaked server-side copy can be traced back to the user.
  // Watermarking is invisible (zero-width characters) and doesn't affect
  // the visible content or JSON parsing.
  const watermarked = watermarkObject(body, session.user);
  const json = JSON.stringify(watermarked);
  if (json.length > MAX_GATE_JSON_BYTES) {
    return NextResponse.json(
      { ok: false, message: 'Gate output payload too large' },
      { status: 413 },
    );
  }

  const id = `${body.projectId}:${body.gateId}`;
  const status = typeof body.status === 'string' ? body.status : 'unknown';

  try {
    const sql = getSql();
    const owner = await resolveOwner(sql, body.projectId, session.user);

    // Non-admins can only write gate outputs for their own projects
    if (owner !== session.user && session.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Gate output belongs to another user\'s project' },
        { status: 403 },
      );
    }

    // === REGRESSION PROTECTION ===
    // We lost an approved 70k G5 advertorial at 15:20 on 2026-04-14 because a stale
    // empty IndexedDB shell got pushed over the good server version. Never again:
    //   - Reject writes that downgrade status from approved → non-approved
    //   - Reject writes that shrink an approved output by >50%
    //   - Always snapshot the previous version into gate_outputs_history before upsert
    const existingRows = (await sql`
      SELECT status, data, length(data::text) as size
      FROM gate_outputs_mirror WHERE id = ${id} LIMIT 1
    `) as Array<{ status: string; data: unknown; size: number }>;
    const existing = existingRows[0];

    if (existing) {
      const wasApproved = existing.status === 'approved';
      const isDowngrade = wasApproved && status !== 'approved';
      const isShrinkage = wasApproved && existing.size > 0 && json.length < existing.size * 0.5;
      if (isDowngrade || isShrinkage) {
        await writeAudit(req, session.user, 'gate.upsert_rejected', {
          projectId: body.projectId,
          gateId: body.gateId,
          reason: isDowngrade ? 'status_downgrade' : 'size_shrinkage',
          existingStatus: existing.status,
          newStatus: status,
          existingBytes: existing.size,
          newBytes: json.length,
        });
        return NextResponse.json(
          {
            ok: false,
            rejected: true,
            reason: isDowngrade ? 'status_downgrade' : 'size_shrinkage',
            message: `Refusing to overwrite approved gate with ${isDowngrade ? 'lower status' : 'smaller payload'}. Server wins.`,
          },
          { status: 409 },
        );
      }
    }

    // Snapshot previous version (best-effort — table may not exist on first run)
    if (existing) {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS gate_outputs_history (
            id SERIAL PRIMARY KEY,
            gate_output_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            gate_id TEXT NOT NULL,
            owner TEXT NOT NULL,
            status TEXT NOT NULL,
            data JSONB NOT NULL,
            archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          INSERT INTO gate_outputs_history (gate_output_id, project_id, gate_id, owner, status, data)
          VALUES (${id}, ${body.projectId}, ${body.gateId}, ${owner}, ${existing.status}, ${JSON.stringify(existing.data)}::jsonb)
        `;
      } catch (histErr) {
        console.warn('[sync:gate-output] history snapshot failed:', histErr);
      }
    }

    await sql`
      INSERT INTO gate_outputs_mirror
        (id, project_id, gate_id, owner, status, data, created_at, updated_at)
      VALUES
        (${id}, ${body.projectId}, ${body.gateId}, ${owner}, ${status}, ${json}::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
        SET status = EXCLUDED.status,
            data = EXCLUDED.data,
            updated_at = NOW()
    `;

    await writeAudit(req, session.user, 'gate.upsert', {
      projectId: body.projectId,
      gateId: body.gateId,
      status,
      bytes: json.length,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync:gate-output:POST] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const gateId = url.searchParams.get('gateId');

  if (!projectId || !gateId) {
    return NextResponse.json(
      { ok: false, message: 'projectId and gateId query params required' },
      { status: 400 },
    );
  }

  const id = `${projectId}:${gateId}`;

  try {
    const sql = getSql();
    const existing = (await sql`
      SELECT owner FROM gate_outputs_mirror WHERE id = ${id} LIMIT 1
    `) as Array<{ owner: string }>;

    if (!existing[0]) return NextResponse.json({ ok: true, deleted: 0 });

    if (existing[0].owner !== session.user && session.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Gate output owned by another user' },
        { status: 403 },
      );
    }

    await sql`DELETE FROM gate_outputs_mirror WHERE id = ${id}`;
    await writeAudit(req, session.user, 'gate.delete', { projectId, gateId });

    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync:gate-output:DELETE] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
