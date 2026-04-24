'use client';

// ============================================================
// PAWEN — /admin/scraping-health   (Phase U.4.8)
//
// Per-provider tile + per-source stats + cache stats.
// Polls every 30s. Admin-gated — shows login form if no token.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  hasAdminToken, setAdminToken, clearAdminToken,
} from '@/lib/auth/adminClient';

interface ProviderStatus {
  id: string;
  category: string;
  priority: number;
  health: {
    ok: boolean;
    message?: string;
    quota?: { remaining?: number; resetAt?: string; limit?: number };
    envVarMissing?: string[];
    lastCheckedAt: string;
  };
}

interface SourceStats {
  source: string;
  calls24h: number;
  successRate: number;
  p50Latency: number;
  p95Latency: number;
  avgQuality: number | null;
  avgUtilization: number | null;
  lastErrors: string[];
  lowUtilityFlag: boolean;
}

interface CacheStats {
  entries: number;
  hits: number;
  avgSize: number;
  oldest: string | null;
}

interface ApiResponse {
  ok: boolean;
  providers?: ProviderStatus[];
  sources?: SourceStats[];
  cache?: CacheStats;
}

export default function ScrapingHealthPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scraping-health', { credentials: 'same-origin' });
      const json = await res.json() as ApiResponse;
      if (res.ok) setData(json);
      else setErr(JSON.stringify(json).slice(0, 200));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'load failed');
    }
  }, []);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    setIsAdmin(hasAdminToken());
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginPw) return;
    setLoggingIn(true); setLoginErr(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: loginPw }),
      });
      const d = await res.json();
      if (d.ok && d.token) {
        setAdminToken(d.token);
        setIsAdmin(true);
        setLoginPw('');
        void load();
      } else {
        setLoginErr(d.message ?? 'Login failed');
      }
    } catch {
      setLoginErr('Network error');
    } finally {
      setLoggingIn(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-bg-primary p-8 text-text-primary">
        <form onSubmit={handleLogin} className="max-w-sm mx-auto mt-32 space-y-4">
          <h1 className="text-xl font-semibold">Admin login</h1>
          <input type="password" placeholder="ADMIN_PASSWORD" value={loginPw} onChange={e => setLoginPw(e.target.value)}
                 className="w-full px-4 py-2 bg-bg-card border border-border rounded-md" />
          {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}
          <button type="submit" disabled={loggingIn} className="w-full px-4 py-2 bg-accent-orange text-black rounded-md font-medium disabled:opacity-50">
            {loggingIn ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    );
  }

  const providers = data?.providers ?? [];
  const sources = data?.sources ?? [];
  const cache = data?.cache;
  const grouped: Record<string, ProviderStatus[]> = {};
  for (const p of providers) {
    (grouped[p.category] ??= []).push(p);
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Scraping Health</h1>
            <p className="text-text-muted text-xs">Phase U.4 — per-provider health, per-source stats, cache stats. Auto-refresh 30s.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 border border-border rounded-lg text-text-secondary text-sm hover:text-text-primary">← God Panel</Link>
            <button onClick={() => { clearAdminToken(); setIsAdmin(false); }} className="px-3 py-2 border border-border rounded-md text-text-muted hover:text-text-primary text-sm">
              Logout admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {err && <div className="px-4 py-3 border border-red-500/40 bg-red-500/10 text-red-300 rounded-md text-sm">{err}</div>}

        {/* Providers grouped by category */}
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-2">{cat} providers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.sort((a, b) => a.priority - b.priority).map(p => {
                const ok = p.health.ok;
                const missing = p.health.envVarMissing ?? [];
                return (
                  <div key={p.id} className={`border rounded-lg p-4 space-y-2 ${ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {ok ? 'HEALTHY' : 'DOWN'}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">priority {p.priority}</div>
                    {p.health.message && <div className="text-xs">{p.health.message}</div>}
                    {missing.length > 0 && (
                      <div className="text-xs text-red-300">missing env: {missing.join(', ')}</div>
                    )}
                    {p.health.quota && (
                      <div className="text-xs text-text-muted">
                        quota: {p.health.quota.remaining ?? '?'} / {p.health.quota.limit ?? '?'}
                        {p.health.quota.resetAt ? ` · reset ${p.health.quota.resetAt}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Per-source stats */}
        <section>
          <h2 className="text-sm font-semibold text-text-muted uppercase mb-2">Sources — last 24h</h2>
          {sources.length === 0 && <p className="text-text-muted text-sm italic">No fetches yet. Run a gate or Scout call to populate.</p>}
          {sources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border text-sm">
                <thead className="bg-bg-card">
                  <tr>
                    {['Source', 'Calls', 'Success', 'p50', 'p95', 'Avg quality', 'Utilization', 'Flags'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.map(s => (
                    <tr key={s.source} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{s.source}</td>
                      <td className="px-3 py-2">{s.calls24h}</td>
                      <td className="px-3 py-2">{(s.successRate * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2">{s.p50Latency}ms</td>
                      <td className="px-3 py-2">{s.p95Latency}ms</td>
                      <td className="px-3 py-2">{s.avgQuality !== null ? s.avgQuality.toFixed(1) : '—'}</td>
                      <td className="px-3 py-2">{s.avgUtilization !== null ? `${(s.avgUtilization * 100).toFixed(1)}%` : '—'}</td>
                      <td className="px-3 py-2">
                        {s.lowUtilityFlag && (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300">LOW UTILITY</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cache */}
        {cache && (
          <section>
            <h2 className="text-sm font-semibold text-text-muted uppercase mb-2">Firecrawl scrape cache</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-border bg-bg-card rounded-lg p-3">
                <div className="text-xs text-text-muted">Entries</div>
                <div className="text-xl font-semibold">{cache.entries.toLocaleString()}</div>
              </div>
              <div className="border border-border bg-bg-card rounded-lg p-3">
                <div className="text-xs text-text-muted">Total hits</div>
                <div className="text-xl font-semibold">{cache.hits.toLocaleString()}</div>
              </div>
              <div className="border border-border bg-bg-card rounded-lg p-3">
                <div className="text-xs text-text-muted">Avg size</div>
                <div className="text-xl font-semibold">{Math.round(cache.avgSize / 1024)} KB</div>
              </div>
              <div className="border border-border bg-bg-card rounded-lg p-3">
                <div className="text-xs text-text-muted">Oldest entry</div>
                <div className="text-sm">{cache.oldest ? new Date(cache.oldest).toLocaleString() : '—'}</div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
