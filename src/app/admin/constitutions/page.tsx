'use client';

// ============================================================
// PAWEN — /admin/constitutions
//
// Phase U.2 admin UI. One card per persona showing current
// constitution version + metrics. Trigger refresh per agent
// manually (calls /api/admin/update-constitution via the
// client orchestrator in src/lib/learning/constitution.ts).
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  hasAdminToken,
  setAdminToken,
  clearAdminToken,
  getAdminToken,
} from '@/lib/auth/adminClient';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import type { AgentId, AgentConstitution } from '@/lib/kb/types';
import {
  updateAgentConstitution,
  getConstitutionCounter,
} from '@/lib/learning/constitution';
import {
  getAllAgentConstitutions,
  saveAgentConstitution,
} from '@/lib/store/db';

const AGENT_ORDER: AgentId[] = ['marcus', 'alex', 'nina', 'david', 'sarah', 'lea'];

export default function AdminConstitutionsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [constitutions, setConstitutions] = useState<Record<string, AgentConstitution>>({});
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [runningFor, setRunningFor] = useState<AgentId | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [preview, setPreview] = useState<AgentId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/agent-constitution', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; rows?: AgentConstitution[] };
        if (data.ok && Array.isArray(data.rows)) {
          for (const r of data.rows) await saveAgentConstitution(r);
        }
      }
    } catch { /* best-effort */ }

    const all = await getAllAgentConstitutions();
    const map: Record<string, AgentConstitution> = {};
    for (const c of all) map[c.agentId] = c;
    setConstitutions(map);

    const c: Record<string, number> = {};
    for (const id of AGENT_ORDER) c[id] = getConstitutionCounter(id);
    setCounters(c);
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    setIsAdmin(hasAdminToken());
    void loadAll();
  }, [loadAll]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginPassword) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        setAdminToken(data.token);
        setIsAdmin(true);
        setLoginPassword('');
      } else {
        setLoginError(data.message ?? 'Login failed');
      }
    } catch {
      setLoginError('Network error');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleUpdate(agentId: AgentId) {
    setError(null);
    setRunningFor(agentId);
    setProgressLog([`→ Refreshing ${agentId} constitution…`]);
    try {
      const rec = await updateAgentConstitution(agentId, getAdminToken());
      setProgressLog(prev => [...prev, `✓ ${agentId}: v${rec.version} · ${rec.constitution.length} chars · ${rec.basedOnOutputCount} outputs analyzed`]);
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgressLog(prev => [...prev, `✗ ${agentId}: ${msg}`]);
      setError(msg);
    } finally {
      setRunningFor(null);
    }
  }

  const autonomousOn = process.env.NEXT_PUBLIC_USE_AUTONOMOUS_MODE === '1';
  const autoConstitutionOn = process.env.NEXT_PUBLIC_AUTO_CONSTITUTION === '1';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bg-primary p-8 text-text-primary">
        <form onSubmit={handleLogin} className="max-w-sm mx-auto mt-32 space-y-4">
          <h1 className="text-xl font-semibold">Admin login</h1>
          <input
            type="password"
            placeholder="ADMIN_PASSWORD"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="w-full px-4 py-2 bg-bg-card border border-border rounded-md text-text-primary"
          />
          {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
          <button type="submit" disabled={loggingIn} className="w-full px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50">
            {loggingIn ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    );
  }

  const previewRec = preview ? constitutions[preview] : null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Agent Constitutions</h1>
            <p className="text-text-muted text-xs">
              Phase U.2 — agents rewrite their operating rules from past results. Master:
              <code className="mx-1 px-1 bg-black/40 rounded">NEXT_PUBLIC_USE_AUTONOMOUS_MODE</code>
              <span className={autonomousOn ? 'text-emerald-400' : 'text-text-muted'}>{autonomousOn ? 'ON' : 'OFF'}</span>
              · Auto-trigger:
              <code className="mx-1 px-1 bg-black/40 rounded">NEXT_PUBLIC_AUTO_CONSTITUTION</code>
              <span className={autoConstitutionOn ? 'text-emerald-400' : 'text-text-muted'}>{autoConstitutionOn ? 'ON' : 'OFF'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm">
              ← God Panel
            </Link>
            <button type="button" onClick={() => { clearAdminToken(); setIsAdmin(false); }} className="px-3 py-2 border border-border rounded-md text-text-muted hover:text-text-primary text-sm">
              Logout admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="px-4 py-3 border border-red-500/40 bg-red-500/10 text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}
        {progressLog.length > 0 && (
          <section className="border border-border bg-bg-card rounded-lg p-4 font-mono text-xs space-y-1">
            {progressLog.map((line, i) => <div key={i} className="text-text-secondary">{line}</div>)}
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_ORDER.map(id => {
            const persona = AGENT_PERSONAS[id];
            const rec = constitutions[id];
            const counter = counters[id] ?? 0;
            return (
              <div key={id} className="border border-border bg-bg-card rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{persona.emoji} {persona.name}</div>
                    <div className="text-text-muted text-xs">{persona.role}</div>
                  </div>
                  <span className={rec
                    ? 'px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'px-2 py-1 text-xs rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                  }>
                    {rec ? `v${rec.version}` : 'none'}
                  </span>
                </div>
                <div className="text-xs text-text-muted space-y-0.5">
                  <div>Gates: {persona.gates.join(', ') || '—'}</div>
                  <div>Counter: {counter} approvals since last refresh</div>
                  {rec && (
                    <>
                      <div>Chars: {rec.constitution.length.toLocaleString()} · Outputs analyzed: {rec.basedOnOutputCount}</div>
                      <div>Avg score: {rec.metrics.avgScore.toFixed(1)}% · Approval rate: {(rec.metrics.approvalRate * 100).toFixed(1)}%</div>
                      <div>Rejections in window: {rec.metrics.rejectionCount}</div>
                      <div>Generated: {new Date(rec.generatedAt).toLocaleString()}</div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={runningFor !== null}
                    onClick={() => handleUpdate(id)}
                    className="flex-1 px-3 py-2 text-sm bg-accent-orange text-black rounded-md disabled:opacity-50"
                  >
                    {runningFor === id ? 'Updating…' : rec ? 'Refresh' : 'Compile'}
                  </button>
                  {rec && (
                    <button
                      type="button"
                      onClick={() => setPreview(id)}
                      className="px-3 py-2 text-sm border border-border rounded-md hover:text-accent-orange"
                    >
                      Preview
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {previewRec && (
          <section className="border border-border bg-bg-card rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Preview · {AGENT_PERSONAS[previewRec.agentId].name} · v{previewRec.version}
              </h2>
              <button type="button" onClick={() => setPreview(null)} className="text-text-muted hover:text-text-primary text-sm">
                close ✕
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-black/30 p-3 rounded-md max-h-[600px] overflow-y-auto">
              {previewRec.constitution}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
