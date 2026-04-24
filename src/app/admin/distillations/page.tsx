'use client';

// ============================================================
// PAWEN — /admin/distillations
//
// Phase U.1 admin UI. One card per persona. Triggers the baked-in
// expertise distillation via /api/admin/distill (through the client
// orchestrator in src/lib/learning/distillation.ts), shows state,
// lets admin inspect the distilled markdown.
//
// Auth gate mirrors /admin/curate: admin token must be present in
// localStorage. If not, a password form is shown.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  hasAdminToken,
  setAdminToken,
  clearAdminToken,
  getAdminToken,
} from '@/lib/auth/adminClient';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import type { AgentId, PersonaDistillation } from '@/lib/kb/types';
import {
  distillPersonaExpertise,
  distillAllPersonas,
  collectChunksForPersona,
  collectKnowledgeForPersona,
} from '@/lib/learning/distillation';
import {
  getAllPersonaDistillations,
  savePersonaDistillation,
} from '@/lib/store/db';

type PerAgentInput = {
  chunkCount: number;
  knowledgeCount: number;
  sourceCount: number;
};

const AGENT_ORDER: AgentId[] = ['marcus', 'alex', 'nina', 'david', 'sarah', 'lea'];

export default function AdminDistillationsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [distillations, setDistillations] = useState<Record<string, PersonaDistillation>>({});
  const [inputs, setInputs] = useState<Record<string, PerAgentInput>>({});
  const [runningFor, setRunningFor] = useState<AgentId | 'all' | null>(null);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<AgentId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);

  const loadAll = useCallback(async () => {
    // 1. Fetch server mirror for any device that hasn't hydrated yet
    try {
      const res = await fetch('/api/sync/persona-distillation', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; rows?: PersonaDistillation[] };
        if (data.ok && Array.isArray(data.rows)) {
          for (const r of data.rows) {
            await savePersonaDistillation(r);
          }
        }
      }
    } catch {
      // Server mirror is best-effort; we'll still show IndexedDB state.
    }

    // 2. Read from IndexedDB (source of truth for this page)
    const all = await getAllPersonaDistillations();
    const map: Record<string, PersonaDistillation> = {};
    for (const d of all) map[d.agentId] = d;
    setDistillations(map);

    // 3. Count available training chunks + knowledge per persona
    const inputCounts: Record<string, PerAgentInput> = {};
    for (const id of AGENT_ORDER) {
      const [chunks, knowledge] = await Promise.all([
        collectChunksForPersona(id),
        collectKnowledgeForPersona(id),
      ]);
      const sources = new Set(chunks.map(c => c.sourceId));
      inputCounts[id] = {
        chunkCount: chunks.length,
        knowledgeCount: knowledge.length,
        sourceCount: sources.size,
      };
    }
    setInputs(inputCounts);
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

  async function handleDistill(agentId: AgentId) {
    setError(null);
    setRunningFor(agentId);
    setProgressLog([`→ Distilling ${agentId}…`]);
    const token = getAdminToken();
    if (!token) {
      setError('Missing admin token');
      setRunningFor(null);
      return;
    }
    try {
      const rec = await distillPersonaExpertise(agentId, token);
      setProgressLog(prev => [...prev, `✓ ${agentId}: v${rec.version} · ${rec.outputChars} chars · ${rec.tokens} tokens`]);
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgressLog(prev => [...prev, `✗ ${agentId}: ${msg}`]);
      setError(msg);
    } finally {
      setRunningFor(null);
    }
  }

  async function handleDistillAll() {
    setError(null);
    setRunningFor('all');
    setProgressLog(['→ Distilling all 6 personas (sequential)…']);
    const token = getAdminToken();
    if (!token) {
      setError('Missing admin token');
      setRunningFor(null);
      return;
    }
    try {
      const { succeeded, failed } = await distillAllPersonas(token, (aid, status, payload) => {
        if (status === 'start') {
          setProgressLog(prev => [...prev, `→ ${aid}…`]);
        } else if (status === 'done' && payload) {
          const rec = payload as PersonaDistillation;
          setProgressLog(prev => [...prev, `✓ ${aid}: v${rec.version} · ${rec.outputChars} chars`]);
        } else if (status === 'error') {
          setProgressLog(prev => [...prev, `✗ ${aid}: ${String(payload)}`]);
        }
      });
      setProgressLog(prev => [...prev, `= Done: ${succeeded.length} ok, ${failed.length} failed`]);
      await loadAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setRunningFor(null);
    }
  }

  const autonomousEnabled = useMemo(
    () => process.env.NEXT_PUBLIC_USE_AUTONOMOUS_MODE === '1',
    [],
  );

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
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50"
          >
            {loggingIn ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    );
  }

  const selectedPreviewRec = selectedPreview ? distillations[selectedPreview] : null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Persona Distillations</h1>
            <p className="text-text-muted text-xs">
              Phase U.1 — baked-in expertise per persona. Replaces runtime training-chunk RAG when
              <code className="mx-1 px-1 bg-black/40 rounded">NEXT_PUBLIC_USE_AUTONOMOUS_MODE=1</code>.
              Currently: <span className={autonomousEnabled ? 'text-emerald-400' : 'text-text-muted'}>{autonomousEnabled ? 'ON' : 'OFF'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm">
              ← God Panel
            </Link>
            <button
              type="button"
              onClick={() => { clearAdminToken(); setIsAdmin(false); }}
              className="px-3 py-2 border border-border rounded-md text-text-muted hover:text-text-primary text-sm"
            >
              Logout admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleDistillAll}
            disabled={runningFor !== null}
            className="px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50"
          >
            {runningFor === 'all' ? 'Distilling all…' : 'Distill all 6 personas'}
          </button>
          <span className="text-text-muted text-sm">Sequential · Opus · ~20k chars out per persona</span>
        </section>

        {error && (
          <div className="px-4 py-3 border border-red-500/40 bg-red-500/10 text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}

        {progressLog.length > 0 && (
          <section className="border border-border bg-bg-card rounded-lg p-4 font-mono text-xs space-y-1">
            {progressLog.map((line, i) => (
              <div key={i} className="text-text-secondary">{line}</div>
            ))}
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_ORDER.map(id => {
            const persona = AGENT_PERSONAS[id];
            const rec = distillations[id];
            const input = inputs[id];
            const hasDistillation = !!rec;
            const inputReady = input && (input.chunkCount + input.knowledgeCount > 0);
            return (
              <div key={id} className="border border-border bg-bg-card rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{persona.emoji} {persona.name}</div>
                    <div className="text-text-muted text-xs">{persona.role}</div>
                  </div>
                  <span className={
                    hasDistillation
                      ? 'px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'px-2 py-1 text-xs rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/30'
                  }>
                    {hasDistillation ? `v${rec.version}` : 'none'}
                  </span>
                </div>
                <div className="text-xs text-text-muted space-y-0.5">
                  <div>Gates: {persona.gates.join(', ') || '—'}</div>
                  <div>Inputs: {input ? `${input.chunkCount} chunks · ${input.sourceCount} sources · ${input.knowledgeCount} KB entries` : 'counting…'}</div>
                  {hasDistillation && (
                    <>
                      <div>Output: {rec.outputChars.toLocaleString()} chars · {rec.tokens.toLocaleString()} tokens</div>
                      <div>Generated: {new Date(rec.generatedAt).toLocaleString()}</div>
                      <div>Model: <code>{rec.model}</code></div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={runningFor !== null || !inputReady}
                    onClick={() => handleDistill(id)}
                    className="flex-1 px-3 py-2 text-sm bg-accent-orange text-black rounded-md disabled:opacity-50"
                    title={!inputReady ? 'No training chunks or knowledge for this persona yet' : ''}
                  >
                    {runningFor === id ? 'Distilling…' : hasDistillation ? 'Re-distill' : 'Distill'}
                  </button>
                  {hasDistillation && (
                    <button
                      type="button"
                      onClick={() => setSelectedPreview(id)}
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

        {selectedPreviewRec && (
          <section className="border border-border bg-bg-card rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Preview · {AGENT_PERSONAS[selectedPreviewRec.agentId].name} · v{selectedPreviewRec.version}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="text-text-muted hover:text-text-primary text-sm"
              >
                close ✕
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-text-secondary bg-black/30 p-3 rounded-md max-h-[600px] overflow-y-auto">
              {selectedPreviewRec.distilledExpertise}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
