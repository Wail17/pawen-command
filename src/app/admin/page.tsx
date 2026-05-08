'use client';

// ============================================================
// AutoEcom Lab — /admin (the "god panel")
//
// Single-page SPA with tab navigation. Shows EVERYTHING:
//   - Overview: counts, recent activity, failed logins
//   - Users: CRUD, block, quota, notes
//   - Projects: list every project, drill down into gate outputs
//   - Audit: paginated log search
//   - Env: which secrets are configured on this deployment
//   - Curate: link to existing /admin/curate page
//
// Auth: admin cookie session is enforced by proxy.ts AND by each
// /api/admin/* route handler via requireAdmin(). This page just
// calls /api/auth/me to decide whether to render or redirect.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AppUserRow } from '@/lib/db/schema';

type Tab = 'overview' | 'users' | 'projects' | 'audit' | 'logins' | 'env' | 'curate' | 'autonomous';

type Me = { authenticated: boolean; user?: { name: string; role: string } };

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data: Me = res.ok ? await res.json() : { authenticated: false };
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe({ authenticated: false });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return <FullPageMessage>Checking session…</FullPageMessage>;
  }

  if (!me?.authenticated) {
    return (
      <FullPageMessage>
        <p className="text-text-primary mb-4">Not signed in.</p>
        <Link href="/" className="text-accent-orange hover:underline">
          → Go to login
        </Link>
      </FullPageMessage>
    );
  }

  if (me.user?.role !== 'admin') {
    return (
      <FullPageMessage>
        <p className="text-text-primary mb-2">Access denied.</p>
        <p className="text-text-muted text-sm">
          Signed in as <span className="text-accent-orange">{me.user?.name}</span> ({me.user?.role}).
        </p>
        <Link href="/" className="text-accent-orange hover:underline mt-4 block">
          ← Back to dashboard
        </Link>
      </FullPageMessage>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">God Panel</h1>
            <p className="text-text-muted text-xs">Total visibility across every user, project, gate</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs rounded-md bg-accent-orange/20 border border-accent-orange/40 text-accent-orange">
              admin · {me.user?.name}
            </span>
            <Link
              href="/"
              className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 pb-3 flex flex-wrap gap-2">
          {([
            ['overview', 'Overview'],
            ['users', 'Users'],
            ['projects', 'Projects'],
            ['audit', 'Audit log'],
            ['logins', 'Login IPs'],
            ['env', 'Environment'],
            ['curate', 'Curation'],
            ['autonomous', 'Autonomous (Phase U)'],
          ] as Array<[Tab, string]>).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                tab === id
                  ? 'border-accent-orange bg-accent-orange/10 text-text-primary'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'logins' && <LoginIPsTab />}
        {tab === 'env' && <EnvTab />}
        {tab === 'curate' && <CurateTab />}
        {tab === 'autonomous' && <AutonomousTab />}
      </main>
    </div>
  );
}

// ============================================================
// Shared helpers
// ============================================================

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-6">
      <div className="bg-bg-card border border-border rounded-xl p-8 w-full max-w-md text-center">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <p className="text-text-muted text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-text-primary text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'orange' | 'green' | 'red' | 'muted' }) {
  const color =
    tone === 'orange' ? 'bg-accent-orange/20 text-accent-orange border-accent-orange/40' :
    tone === 'green'  ? 'bg-green-500/20 text-green-500 border-green-500/40' :
    tone === 'red'    ? 'bg-error/20 text-error border-error/40' :
                        'bg-bg-primary text-text-muted border-border';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>{children}</span>
  );
}

// ============================================================
// Overview tab
// ============================================================

type OverviewData = {
  users: { total: number; admins: number; blocked: number; disabled: number };
  projects: { total: number; owners: number };
  gateOutputs: { total: number };
  recentLogins: Array<{ user_name: string; ip: string; created_at: string }>;
  recentWrites: Array<{ user_name: string; action: string; details: unknown; created_at: string }>;
  failedLoginsLast24h: number;
};

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/overview', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => d.ok ? setData(d) : setErr(d.message))
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <p className="text-error text-sm">{err}</p>;
  if (!data) return <p className="text-text-muted text-sm">Loading overview…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Users" value={data.users.total} sub={`${data.users.admins} admin · ${data.users.blocked} blocked`} />
        <StatCard label="Projects" value={data.projects.total} sub={`${data.projects.owners} distinct owners`} />
        <StatCard label="Gate runs" value={data.gateOutputs.total} sub="server mirror" />
        <StatCard label="Failed logins 24h" value={data.failedLoginsLast24h} sub="brute-force signal" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Recent logins</h3>
          {data.recentLogins.length === 0 ? (
            <p className="text-text-muted text-xs">No logins yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentLogins.map((l, i) => (
                <li key={i} className="text-xs flex justify-between text-text-secondary">
                  <span className="text-accent-orange font-semibold">{l.user_name}</span>
                  <span className="text-text-muted">{l.ip}</span>
                  <span className="text-text-muted">{new Date(l.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Recent writes</h3>
          {data.recentWrites.length === 0 ? (
            <p className="text-text-muted text-xs">No writes yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentWrites.map((w, i) => (
                <li key={i} className="text-xs text-text-secondary">
                  <span className="text-accent-orange font-semibold">{w.user_name}</span>
                  {' · '}
                  <span className="text-text-primary">{w.action}</span>
                  {' · '}
                  <span className="text-text-muted">{new Date(w.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ============================================================
// Users tab
// ============================================================

function UsersTab() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppUserRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok) setUsers(data.users); else setErr(data.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(name: string) {
    if (!confirm(`Delete user "${name}"? This does NOT delete their projects.`)) return;
    try {
      const res = await fetch(`/api/admin/users?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!data.ok) { alert(data.message); return; }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  if (loading) return <p className="text-text-muted text-sm">Loading users…</p>;
  if (err) return <p className="text-error text-sm">{err}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-text-primary text-lg font-semibold">Users ({users.length})</h2>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover"
        >
          + New user
        </button>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-primary text-text-muted text-[11px] uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Enabled</th>
              <th className="text-left px-4 py-2">Quota</th>
              <th className="text-left px-4 py-2">Last seen</th>
              <th className="text-left px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.name} className="border-t border-border">
                <td className="px-4 py-2 text-text-primary font-semibold">{u.name}</td>
                <td className="px-4 py-2">
                  <Pill tone={u.role === 'admin' ? 'orange' : u.role === 'blocked' ? 'red' : 'muted'}>
                    {u.role}
                  </Pill>
                </td>
                <td className="px-4 py-2">
                  <Pill tone={u.enabled ? 'green' : 'red'}>
                    {u.enabled ? 'yes' : 'no'}
                  </Pill>
                </td>
                <td className="px-4 py-2 text-text-secondary">
                  ${Number(u.quota_used_usd ?? 0).toFixed(2)} / ${Number(u.quota_monthly_usd ?? 0).toFixed(0)}
                </td>
                <td className="px-4 py-2 text-text-muted text-xs">
                  {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : '—'}
                  {u.last_seen_ip && <span className="ml-1 text-text-muted">({u.last_seen_ip})</span>}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => setEditing(u)} className="text-xs text-accent-orange hover:underline">
                    edit
                  </button>
                  <button onClick={() => handleDelete(u.name)} className="text-xs text-error hover:underline">
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <UserEditModal
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function UserEditModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AppUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState<string>(initial?.role ?? 'user');
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true);
  const [quota, setQuota] = useState<number>(Number(initial?.quota_monthly_usd ?? 100));
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, role, enabled, quota_monthly_usd: quota, notes }),
      });
      const data = await res.json();
      if (!data.ok) setErr(data.message);
      else onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-text-primary text-lg font-semibold">
          {initial ? `Edit ${initial.name}` : 'New user'}
        </h3>
        <div>
          <label className="text-text-muted text-xs uppercase">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!!initial}
            className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="blocked">blocked</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <label htmlFor="enabled" className="text-text-secondary text-sm">Enabled</label>
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase">Monthly quota (USD)</label>
          <input
            type="number"
            value={quota}
            onChange={(e) => setQuota(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary"
          />
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary"
          />
        </div>
        {err && <p className="text-error text-xs">{err}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-text-secondary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name}
            className="px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Projects tab
// ============================================================

type ProjectRow = {
  id: string;
  owner: string;
  name: string;
  created_at: string;
  updated_at: string;
  niche: string | null;
  target_market: string | null;
  target_language: string | null;
  current_gate: string | null;
  selected_sub_avatar_id: string | null;
  product_url: string | null;
  gate_count: number;
};

function ProjectsTab() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [owner, setOwner] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drill, setDrill] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (owner) params.set('owner', owner);
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/projects?${params.toString()}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.ok) setRows(data.projects);
      else setErr(data.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [owner, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Filter by owner name"
          className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search project name"
          className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
        />
      </div>

      {loading ? (
        <p className="text-text-muted text-sm">Loading projects…</p>
      ) : err ? (
        <p className="text-error text-sm">{err}</p>
      ) : rows.length === 0 ? (
        <p className="text-text-muted text-sm">No projects match.</p>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-primary text-text-muted text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-left px-4 py-2">Niche</th>
                <th className="text-left px-4 py-2">Market</th>
                <th className="text-left px-4 py-2">Current gate</th>
                <th className="text-right px-4 py-2">Gates</th>
                <th className="text-left px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-bg-primary/50">
                  <td className="px-4 py-2 text-text-primary font-semibold">{p.name}</td>
                  <td className="px-4 py-2"><Pill tone="orange">{p.owner}</Pill></td>
                  <td className="px-4 py-2 text-text-secondary">{p.niche ?? '—'}</td>
                  <td className="px-4 py-2 text-text-secondary">{p.target_market ?? '—'}</td>
                  <td className="px-4 py-2 text-text-muted">{p.current_gate ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{p.gate_count}</td>
                  <td className="px-4 py-2 text-text-muted text-xs">
                    {new Date(p.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setDrill(p)}
                      className="text-xs text-accent-orange hover:underline"
                    >
                      inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drill && (
        <ProjectDrillDown projectId={drill.id} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}

type DrillDownData = {
  project: {
    id: string;
    owner: string;
    name: string;
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  gateOutputs: Array<{
    id: string;
    project_id: string;
    gate_id: string;
    owner: string;
    status: string;
    data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
};

function ProjectDrillDown({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [data, setData] = useState<DrillDownData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openGate, setOpenGate] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => d.ok ? setData(d) : setErr(d.message))
      .catch((e: Error) => setErr(e.message));
  }, [projectId]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-5xl my-8 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-text-primary text-lg font-semibold">
              {data?.project.name ?? 'Loading…'}
            </h3>
            <p className="text-text-muted text-xs">
              {projectId}
              {data && <> · owner <span className="text-accent-orange">{data.project.owner}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm">
            ✕ close
          </button>
        </div>

        {err && <p className="text-error text-sm">{err}</p>}
        {!data && !err && <p className="text-text-muted text-sm">Loading drill-down…</p>}

        {data && (
          <>
            <section>
              <h4 className="text-text-primary text-sm font-semibold mb-2">Project metadata</h4>
              <JsonBlock value={data.project.data} collapsedDepth={2} />
            </section>

            <section>
              <h4 className="text-text-primary text-sm font-semibold mb-2">
                Gate outputs ({data.gateOutputs.length})
              </h4>
              {data.gateOutputs.length === 0 ? (
                <p className="text-text-muted text-xs">No gate runs mirrored for this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.gateOutputs.map((g) => (
                    <div key={g.id} className="border border-border rounded-lg">
                      <button
                        onClick={() => setOpenGate(openGate === g.gate_id ? null : g.gate_id)}
                        className="w-full flex justify-between items-center px-3 py-2 hover:bg-bg-primary"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-accent-orange font-semibold">{g.gate_id}</span>
                          <Pill tone={g.status === 'approved' ? 'green' : 'muted'}>{g.status}</Pill>
                          <span className="text-text-muted text-[11px]">
                            updated {new Date(g.updated_at).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-text-muted text-xs">
                          {openGate === g.gate_id ? '▲' : '▼'}
                        </span>
                      </button>
                      {openGate === g.gate_id && (
                        <div className="border-t border-border p-3">
                          <JsonBlock value={g.data} collapsedDepth={1} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Collapsible JSON viewer. We don't use a library — the god panel
 * ships almost no extra JS this way, and the data is already trusted.
 */
function JsonBlock({ value, collapsedDepth = 1 }: { value: unknown; collapsedDepth?: number }) {
  return (
    <pre className="text-[11px] leading-relaxed bg-bg-primary border border-border rounded-lg p-3 overflow-x-auto max-h-[500px] text-text-secondary whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
      {/* collapsedDepth reserved for future progressive disclosure */}
      {collapsedDepth < 0 && null}
    </pre>
  );
}

// ============================================================
// Audit tab
// ============================================================

type AuditEntry = {
  id: number;
  user_name: string;
  action: string;
  details: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (userFilter) params.set('user', userFilter);
      if (actionFilter) params.set('action', actionFilter);
      params.set('limit', '300');
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data.ok) setEntries(data.entries);
      else setErr(data.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Filter user"
          className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
        />
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter action (e.g. login.success)"
          className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
        />
      </div>

      {loading ? (
        <p className="text-text-muted text-sm">Loading audit log…</p>
      ) : err ? (
        <p className="text-error text-sm">{err}</p>
      ) : entries.length === 0 ? (
        <p className="text-text-muted text-sm">No entries match.</p>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-primary text-text-muted text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Details</th>
                <th className="text-left px-4 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 text-text-muted text-[11px] whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-accent-orange font-semibold">{e.user_name}</td>
                  <td className="px-4 py-2 text-text-primary">{e.action}</td>
                  <td className="px-4 py-2 text-text-secondary text-[11px] font-mono max-w-md truncate">
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                  <td className="px-4 py-2 text-text-muted text-xs">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Env tab
// ============================================================

type EnvEntry = { key: string; configured: boolean; length: number; preview: string | null };

function EnvTab() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/env', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => d.ok ? setEntries(d.entries) : setErr(d.message))
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <p className="text-error text-sm">{err}</p>;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg-primary text-text-muted text-[11px] uppercase">
          <tr>
            <th className="text-left px-4 py-2">Key</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-left px-4 py-2">Length</th>
            <th className="text-left px-4 py-2">Preview</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.key} className="border-t border-border">
              <td className="px-4 py-2 text-text-primary font-mono text-xs">{e.key}</td>
              <td className="px-4 py-2">
                <Pill tone={e.configured ? 'green' : 'red'}>
                  {e.configured ? 'configured' : 'missing'}
                </Pill>
              </td>
              <td className="px-4 py-2 text-text-secondary text-xs">{e.length || '—'}</td>
              <td className="px-4 py-2 text-text-muted font-mono text-xs">{e.preview ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Login IPs tab — shows all connection attempts by IP
// ============================================================

interface IPEntry {
  ip: string;
  totalAttempts: number;
  successes: number;
  failures: number;
  lastAttempt: string;
  usernames: string[];
  userAgents: string[];
  // Vercel-injected geolocation, lifted out of audit_log.details.geo
  country?: string;
  countryRegion?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  events: { action: string; username: string; time: string; details: Record<string, unknown> }[];
}

function flagFromCountryCode(cc?: string): string {
  if (!cc || cc.length !== 2) return '';
  const A = 0x1F1E6;
  return String.fromCodePoint(
    A + cc.toUpperCase().charCodeAt(0) - 65,
    A + cc.toUpperCase().charCodeAt(1) - 65,
  );
}

function geoLine(ip: IPEntry): string {
  const parts: string[] = [];
  if (ip.city) parts.push(ip.city);
  if (ip.countryRegion && ip.countryRegion !== ip.city) parts.push(ip.countryRegion);
  if (ip.country) parts.push(ip.country);
  return parts.join(', ');
}

function LoginIPsTab() {
  const [data, setData] = useState<{
    summary: { uniqueIPs: number; totalAttempts: number; totalFailures: number; suspiciousIPs: number; periodHours: number };
    ips: IPEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(168); // 7 days
  const [expandedIP, setExpandedIP] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/login-attempts?hours=${hours}`, { credentials: 'same-origin' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [hours]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <p className="text-text-muted text-sm">Loading login attempts...</p>;
  if (!data) return <p className="text-error text-sm">Failed to load data</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Unique IPs" value={data.summary.uniqueIPs} />
        <SummaryCard label="Total Attempts" value={data.summary.totalAttempts} />
        <SummaryCard label="Failed Attempts" value={data.summary.totalFailures} color="text-error" />
        <SummaryCard label="Suspicious IPs" value={data.summary.suspiciousIPs} color="text-warning" />
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {[24, 72, 168, 720].map(h => (
          <button key={h} onClick={() => setHours(h)}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              hours === h ? 'border-accent-orange bg-accent-orange/10 text-text-primary' : 'border-border text-text-secondary hover:border-text-muted'
            }`}>
            {h <= 24 ? '24h' : h <= 72 ? '3 days' : h <= 168 ? '7 days' : '30 days'}
          </button>
        ))}
      </div>

      {/* IP table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-primary">
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">IP Address</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Location</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Attempts</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Success</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Failed</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Usernames</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium text-xs">Last Attempt</th>
            </tr>
          </thead>
          <tbody>
            {data.ips.map(ip => (
              <>
                <tr key={ip.ip}
                  onClick={() => setExpandedIP(expandedIP === ip.ip ? null : ip.ip)}
                  className={`border-b border-border cursor-pointer hover:bg-bg-card-hover ${
                    ip.failures >= 3 ? 'bg-error/5' : ''
                  }`}>
                  <td className="px-4 py-2 font-mono text-text-primary text-xs">{ip.ip}</td>
                  <td className="px-4 py-2 text-text-secondary text-xs whitespace-nowrap">
                    {ip.country ? (
                      <span title={`${geoLine(ip)}${ip.timezone ? ` · ${ip.timezone}` : ''}`}>
                        <span className="mr-1">{flagFromCountryCode(ip.country)}</span>
                        {geoLine(ip) || ip.country}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-text-secondary text-xs">{ip.totalAttempts}</td>
                  <td className="px-4 py-2 text-success text-xs">{ip.successes}</td>
                  <td className={`px-4 py-2 text-xs ${ip.failures > 0 ? 'text-error font-medium' : 'text-text-muted'}`}>
                    {ip.failures}
                  </td>
                  <td className="px-4 py-2 text-text-secondary text-xs">
                    {ip.usernames.length > 0 ? ip.usernames.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2 text-text-muted text-xs">
                    {new Date(ip.lastAttempt).toLocaleString()}
                  </td>
                </tr>
                {expandedIP === ip.ip && ip.events.length > 0 && (
                  <tr key={`${ip.ip}-detail`}>
                    <td colSpan={7} className="px-4 py-3 bg-bg-primary">
                      {(ip.country || ip.latitude) && (
                        <div className="mb-3 pb-3 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <span className="text-text-muted">Geo:</span>
                          {ip.country && (
                            <span>
                              <span className="mr-1">{flagFromCountryCode(ip.country)}</span>
                              <span className="text-text-secondary">{geoLine(ip) || ip.country}</span>
                            </span>
                          )}
                          {ip.timezone && (
                            <span className="text-text-muted">⏱ {ip.timezone}</span>
                          )}
                          {ip.latitude && ip.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${ip.latitude},${ip.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent-orange hover:underline"
                            >
                              📍 {ip.latitude}, {ip.longitude} → open in Maps
                            </a>
                          )}
                        </div>
                      )}
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {ip.events.map((e, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className={`px-1.5 py-0.5 rounded ${
                              e.action.includes('success') ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                            }`}>
                              {e.action.replace('login.', '').replace('admin.', 'admin ')}
                            </span>
                            <span className="text-text-secondary">{e.username}</span>
                            {e.details && Object.keys(e.details).length > 0 && (
                              <span className="text-text-muted">
                                {JSON.stringify(e.details)}
                              </span>
                            )}
                            <span className="text-text-muted ml-auto">
                              {new Date(e.time).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                      {ip.userAgents.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-xs text-text-muted">
                            User-Agent: {ip.userAgents[0]}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {data.ips.length === 0 && (
          <p className="px-4 py-8 text-center text-text-muted text-sm">No login attempts in this period</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <p className="text-text-muted text-xs">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

// ============================================================
// Curate tab (link out to existing page)
// ============================================================

function CurateTab() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <h3 className="text-text-primary text-sm font-semibold mb-2">Knowledge curation</h3>
      <p className="text-text-muted text-xs mb-4">
        Claude-driven dedup + merge for agent knowledge bases. This tool has its own dedicated UI.
      </p>
      <Link
        href="/admin/curate"
        className="inline-block px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover"
      >
        Open curation panel →
      </Link>
    </div>
  );
}

// ============================================================
// Autonomous (Phase U) tab — links to distillations + constitutions
// ============================================================

function AutonomousTab() {
  const flagOn = process.env.NEXT_PUBLIC_USE_AUTONOMOUS_MODE === '1';
  return (
    <div className="space-y-4">
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h3 className="text-text-primary text-sm font-semibold mb-2">Phase U — Autonomous mode</h3>
        <p className="text-text-muted text-xs mb-3">
          Baked-in per-persona expertise (U.1) + self-written constitutions (U.2). Master flag
          <code className="mx-1 px-1 bg-black/40 rounded">NEXT_PUBLIC_USE_AUTONOMOUS_MODE</code>
          is currently <span className={flagOn ? 'text-emerald-400' : 'text-yellow-300'}>{flagOn ? 'ON' : 'OFF'}</span>.
          When OFF the legacy runtime-RAG path is used; when ON, agents inject their distilled corpus and skip the chunk-level training injection.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/distillations"
            className="inline-block px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover"
          >
            Persona distillations (U.1) →
          </Link>
          <Link
            href="/admin/constitutions"
            className="inline-block px-4 py-2 border border-accent-orange text-accent-orange text-sm font-semibold rounded-lg hover:bg-accent-orange/10"
          >
            Agent constitutions (U.2) →
          </Link>
          <Link
            href="/admin/scraping-health"
            className="inline-block px-4 py-2 border border-accent-orange text-accent-orange text-sm font-semibold rounded-lg hover:bg-accent-orange/10"
          >
            Scraping health (U.4) →
          </Link>
        </div>
      </div>
    </div>
  );
}
