// ============================================================
// PAWEN — Client-side server mirror
//
// Fire-and-forget HTTP wrappers that POST every IndexedDB write to
// the Neon mirror via /api/sync/*. IndexedDB stays the primary read
// path (instant, offline-tolerant); the server mirror is strictly
// additive so the god panel can see everything.
//
// IMPORTANT:
//   - Never throw. A failed sync must NOT break the local save.
//   - Cookie-based auth piggybacks on the user's session (credentials:
//     'same-origin'). If the user is logged out, the sync silently
//     no-ops — the local IndexedDB write still succeeds.
//   - Debounced per-key so rapid consecutive writes to the same
//     project / gate coalesce into one network call.
// ============================================================

import type { Project, GateOutput } from '../types';

const DEBOUNCE_MS = 800;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function schedule(key: string, fn: () => Promise<void>): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    pending.delete(key);
    // Swallow everything — never let a failing sync crash the caller
    fn().catch((err) => {
      console.warn('[serverMirror]', key, 'failed:', err);
    });
  }, DEBOUNCE_MS);
  pending.set(key, handle);
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // 401 means "not logged in yet" — expected during bootstrap, don't noise logs
    if (res.status !== 401) {
      const text = await res.text().catch(() => '');
      console.warn('[serverMirror] POST', path, res.status, text.slice(0, 200));
    }
  }
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok && res.status !== 401) {
    const text = await res.text().catch(() => '');
    console.warn('[serverMirror] DELETE', path, res.status, text.slice(0, 200));
  }
}

/** Mirror a project upsert to the server (debounced). */
export function mirrorProject(project: Project): void {
  schedule(`project:${project.id}`, () =>
    post('/api/sync/project', project),
  );
}

/** Mirror a project deletion to the server (flushes any pending upsert first). */
export function mirrorProjectDelete(projectId: string): void {
  // Cancel any queued upsert for this project — delete wins
  const key = `project:${projectId}`;
  const queued = pending.get(key);
  if (queued) {
    clearTimeout(queued);
    pending.delete(key);
  }
  schedule(`project-del:${projectId}`, () =>
    del(`/api/sync/project?id=${encodeURIComponent(projectId)}`),
  );
}

/** Mirror a gate output upsert to the server (debounced). */
export function mirrorGateOutput(output: GateOutput): void {
  schedule(`gate:${output.projectId}:${output.gateId}`, () =>
    post('/api/sync/gate-output', output),
  );
}

/**
 * Pull the caller's server-side data (projects + gate outputs) so a
 * fresh device / cleared browser can hydrate IndexedDB from Neon.
 * Returns null on auth failure or any error.
 */
export async function fetchBootstrap(): Promise<{
  projects: Project[];
  gateOutputs: GateOutput[];
} | null> {
  try {
    const res = await fetch('/api/sync/bootstrap', {
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok: boolean;
      projects: Project[];
      gateOutputs: GateOutput[];
    };
    if (!json.ok) return null;
    return {
      projects: json.projects ?? [],
      gateOutputs: json.gateOutputs ?? [],
    };
  } catch (err) {
    console.warn('[serverMirror] bootstrap failed:', err);
    return null;
  }
}
