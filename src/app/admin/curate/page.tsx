'use client';

// ============================================================
// AutoEcom Lab — /admin/curate
// Admin-only. Shows pending contributions per agent + a one-click
// Process button that triggers Claude-driven dedup/merge.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { APP_USERS, type AppUser } from '@/lib/auth/users';
import {
  hasAdminToken,
  setAdminToken,
  clearAdminToken,
  adminHeaders,
} from '@/lib/auth/adminClient';
import { AGENT_IDS, type AgentId, type Contribution, type CuratedKnowledge } from '@/lib/db/schema';

type AgentMeta = { id: AgentId; name: string; emoji: string };
const AGENTS: AgentMeta[] = [
  { id: 'marcus',  name: 'Marcus',  emoji: '🔍' },
  { id: 'alex',    name: 'Alex',    emoji: '✍️' },
  { id: 'nina',    name: 'Nina',    emoji: '🎨' },
  { id: 'david',   name: 'David',   emoji: '📊' },
  { id: 'lea',     name: 'Léa',     emoji: '👑' },
  { id: 'sarah',   name: 'Sarah',   emoji: '🧠' },
  { id: 'general', name: 'General', emoji: '🧩' },
];

type RunResult = {
  ok: boolean;
  runId?: string;
  counts?: { pending: number; approved: number; merged: number; rejected: number };
  summary?: string;
  decisions?: Array<{ action: string; contribution_id: string; reason: string }>;
  message?: string;
};

export default function AdminCuratePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [agent, setAgent] = useState<AgentId>('marcus');
  const [pending, setPending] = useState<Contribution[]>([]);
  const [curated, setCurated] = useState<CuratedKnowledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [countsByAgent, setCountsByAgent] = useState<Record<string, number>>({});
  const [migrated, setMigrated] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const loadForAgent = useCallback(async (a: AgentId) => {
    setLoading(true);
    try {
      const [pendingRes, curatedRes] = await Promise.all([
        fetch(`/api/contribute?agent=${a}&status=pending&limit=200`),
        fetch(`/api/curate?agent=${a}`),
      ]);
      const pendingData = await pendingRes.json();
      const curatedData = await curatedRes.json();
      if (pendingData.ok) setPending(pendingData.contributions);
      if (curatedData.ok) setCurated(curatedData.curated);
    } catch (err) {
      console.error('[admin:curate] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginPassword) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await res.json();
      if (data.ok && typeof data.token === 'string') {
        setAdminToken(data.token);
        setIsAdmin(true);
        setLoginPassword('');
      } else {
        setLoginError(data.message || 'Wrong password');
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    clearAdminToken();
    setIsAdmin(false);
    setPending([]);
    setCurated([]);
    setCountsByAgent({});
    setRunResult(null);
  }

  const loadCounts = useCallback(async () => {
    try {
      const entries = await Promise.all(
        AGENT_IDS.map(async (a) => {
          const res = await fetch(`/api/contribute?agent=${a}&status=pending&limit=500`);
          const data = await res.json();
          return [a, data.ok ? data.contributions.length : 0] as [string, number];
        })
      );
      setCountsByAgent(Object.fromEntries(entries));
    } catch (err) {
      console.error('[admin:curate] counts failed', err);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('app-user') : null;
    if (stored && (APP_USERS as readonly string[]).includes(stored)) {
      setUser(stored as AppUser);
    }
    setIsAdmin(hasAdminToken());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadCounts();
    loadForAgent(agent);
  }, [isAdmin, agent, loadCounts, loadForAgent]);

  async function handleMigrate() {
    if (!isAdmin) return;
    setMigrating(true);
    try {
      const res = await fetch('/api/admin/db-migrate', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (data.ok) {
        setMigrated(true);
        console.log('[admin:curate] migration applied:', data.applied);
      } else {
        alert(`Migration failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Migration error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setMigrating(false);
    }
  }

  async function handleProcess() {
    if (!isAdmin) return;
    setProcessing(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user: user ?? 'admin', agent_id: agent }),
      });
      const data = (await res.json()) as RunResult;
      setRunResult(data);
      if (data.ok) {
        await loadForAgent(agent);
        await loadCounts();
      }
    } catch (err) {
      setRunResult({
        ok: false,
        message: err instanceof Error ? err.message : 'unknown error',
      });
    } finally {
      setProcessing(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="bg-bg-card border border-border rounded-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-accent-orange">Admin login</h1>
            <p className="text-text-secondary text-sm mt-1">
              Curation is admin-only. Enter the admin password.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => {
                setLoginPassword(e.target.value);
                setLoginError(null);
              }}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange"
              autoFocus
              required
            />
            {loginError && <p className="text-error text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn || !loginPassword}
              className="w-full py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Checking…' : 'Enter'}
            </button>
            <Link
              href="/"
              className="block text-center text-text-muted text-xs hover:text-text-secondary"
            >
              ← Back to dashboard
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Knowledge Curation</h1>
            <p className="text-text-muted text-xs">Claude-driven dedup + merge for each agent&apos;s KB</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs rounded-md bg-accent-orange/20 border border-accent-orange/40 text-accent-orange">
              admin{user ? ` · ${user}` : ''}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 border border-border rounded-lg text-text-muted hover:text-error hover:border-error/50 text-xs"
            >
              Logout
            </button>
            <Link href="/contribute" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              Contribute
            </Link>
            <Link href="/" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Migration button — safe to run multiple times */}
        <div className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-text-primary text-sm font-semibold">Database schema</p>
            <p className="text-text-muted text-xs mt-0.5">
              Run once per environment (idempotent — safe to re-run).
            </p>
          </div>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm disabled:opacity-50"
          >
            {migrating ? 'Running…' : migrated ? '✓ Migrated' : 'Run migrations'}
          </button>
        </div>

        {/* Agent tabs */}
        <div className="flex flex-wrap gap-2">
          {AGENTS.map((a) => {
            const count = countsByAgent[a.id] ?? 0;
            return (
              <button
                key={a.id}
                onClick={() => setAgent(a.id)}
                className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${
                  agent === a.id
                    ? 'border-accent-orange bg-accent-orange/10 text-text-primary'
                    : 'border-border text-text-secondary hover:border-text-muted'
                }`}
              >
                <span>{a.emoji}</span>
                <span className="font-semibold">{a.name}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Process button + stats */}
        <div className="bg-bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-text-primary text-sm">
              <span className="font-semibold">{pending.length}</span> pending ·{' '}
              <span className="font-semibold">{curated.length}</span> curated
            </p>
            <p className="text-text-muted text-xs mt-1">
              Claude will dedup, merge into existing entries where possible, and reject obvious noise.
            </p>
          </div>
          <button
            onClick={handleProcess}
            disabled={processing || pending.length === 0}
            className="px-5 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {processing ? 'Processing… (30-90s)' : `Process ${pending.length} pending`}
          </button>
        </div>

        {/* Run result */}
        {runResult && (
          <div
            className={`rounded-xl p-5 border ${
              runResult.ok
                ? 'bg-green-500/5 border-green-500/30'
                : 'bg-error/5 border-error/30'
            }`}
          >
            {runResult.ok ? (
              <div>
                <p className="text-green-500 text-sm font-semibold mb-2">Curation complete</p>
                {runResult.counts && (
                  <div className="flex gap-4 text-sm text-text-secondary mb-3">
                    <span>Approved: <b className="text-green-500">{runResult.counts.approved}</b></span>
                    <span>Merged: <b className="text-blue-500">{runResult.counts.merged}</b></span>
                    <span>Rejected: <b className="text-error">{runResult.counts.rejected}</b></span>
                  </div>
                )}
                {runResult.summary && (
                  <p className="text-text-primary text-sm italic border-l-2 border-green-500 pl-3">
                    {runResult.summary}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-error text-sm font-semibold">Curation failed</p>
                <p className="text-text-secondary text-xs mt-1">{runResult.message}</p>
              </div>
            )}
          </div>
        )}

        {/* Pending list */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            Pending ({pending.length})
          </h2>
          {loading ? (
            <p className="text-text-muted text-sm">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-text-muted text-sm">No pending contributions for this agent.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((c) => (
                <ContributionCard key={c.id} contribution={c} />
              ))}
            </div>
          )}
        </section>

        {/* Curated list */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-3">
            Curated ({curated.length})
          </h2>
          {curated.length === 0 ? (
            <p className="text-text-muted text-sm">Nothing curated yet for this agent.</p>
          ) : (
            <div className="space-y-3">
              {curated.map((k) => (
                <CuratedCard key={k.id} entry={k} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ContributionCard({ contribution: c }: { contribution: Contribution }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="text-accent-orange font-semibold">{c.contributor}</span>
          <span>·</span>
          <span className="uppercase">{c.type}</span>
          <span>·</span>
          <span>{new Date(c.created_at).toLocaleDateString()}</span>
        </div>
        {c.attachment_url && (
          <a
            href={c.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent-orange hover:underline"
          >
            📎 {c.attachment_name}
          </a>
        )}
      </div>
      <p className="text-text-primary font-semibold text-sm">{c.title}</p>
      <p className="text-text-secondary text-xs mt-1.5 whitespace-pre-wrap line-clamp-6">{c.content}</p>
      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {c.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CuratedCard({ entry: k }: { entry: CuratedKnowledge }) {
  return (
    <div className="bg-bg-card border border-green-500/20 rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="uppercase">{k.type}</span>
          <span>·</span>
          <span>v{k.version}</span>
          <span>·</span>
          <span>approved by {k.approved_by}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">
          curated
        </span>
      </div>
      <p className="text-text-primary font-semibold text-sm">{k.title}</p>
      <p className="text-text-secondary text-xs mt-1.5 whitespace-pre-wrap line-clamp-6">{k.content}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {k.tags.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">
            {t}
          </span>
        ))}
      </div>
      {k.source_contributors.length > 0 && (
        <p className="text-[10px] text-text-muted mt-2">
          contributors: {k.source_contributors.join(', ')}
        </p>
      )}
    </div>
  );
}

