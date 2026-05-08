'use client';

// ============================================================
// PAWEN — /hive   (Phase W — Hive-as-dashboard + sole login entry)
//
// 6 island cards in a grid, each showing its owner's projects.
// User's own card highlighted with gold pulse; their projects are
// clickable links to /project/[id]. Other users' projects show
// as label-only badges (lurk).
//
// LOGIN ENTRY: this is the ONLY place users can sign in. The
// home page (/) and any other route bounces unauthenticated
// visitors here. Two-step flow: password → user picker → cookie.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type PickerUser = { name: string; role: 'admin' | 'user' | 'blocked' };

interface Brand {
  id: string; ownerId: string; name: string;
  avatarEmoji: string; colorHex: string;
}
interface ProjectMeta {
  id: string;
  name: string;
  ownerId: string;
  niche: string;
  language: string;
  progress: { approved: number; total: number };
}

const ORDER: Array<{ owner: string; emoji: string; color: string; name: string }> = [
  { owner: 'sykss',     emoji: '🏝️', color: '#FF8A00', name: 'Sykss' },
  { owner: 'maghrabi',  emoji: '🌴', color: '#2DD4BF', name: 'Maghrabi' },
  { owner: 'suley',     emoji: '⛰️', color: '#A78BFA', name: 'Suley' },
  { owner: 'alex',      emoji: '🌊', color: '#06B6D4', name: 'Alex (8lab)' },
  { owner: 'road',      emoji: '🏔️', color: '#10B981', name: 'Road' },
  { owner: 'bradriley', emoji: '🍍', color: '#F97316', name: 'Brad Riley' },
];

export default function HivePage() {
  const [me, setMe] = useState<{ user?: { name: string } } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // ── Login state (sole entry point) ───────────────────────────────
  const [sessionChecked, setSessionChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  const [pickerUsers, setPickerUsers] = useState<PickerUser[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  async function loadHiveData() {
    try {
      const [hRes, pRes] = await Promise.all([
        fetch('/api/hive/state', { credentials: 'same-origin' }),
        fetch('/api/hive/projects', { credentials: 'same-origin' }),
      ]);
      if (hRes.ok) {
        const data = await hRes.json() as { brands?: Brand[] };
        setBrands(data.brands ?? []);
      }
      if (pRes.ok) {
        const data = await pRes.json() as { projects?: ProjectMeta[] };
        setProjects(data.projects ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'load failed');
    }
  }

  // Mount: check session, load hive data only if logged in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!cancelled && mRes.ok) {
          const data = await mRes.json() as { user?: { name: string } };
          if (data.user) {
            setMe(data);
            await loadHiveData();
            // Login check-in: fire once per browser session
            let alreadyFired = false;
            try { alreadyFired = sessionStorage.getItem('hive-checkin-fired') === '1'; } catch { /* private mode */ }
            if (!alreadyFired) {
              try { sessionStorage.setItem('hive-checkin-fired', '1'); } catch { /* noop */ }
              void fetch('/api/hive/checkin', { method: 'POST', credentials: 'same-origin' }).catch(() => { /* silent */ });
            }
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'load failed');
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Step 1 — password → fetch user list (server gates this behind APP_PASSWORD)
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setAuthError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/users', { credentials: 'same-origin' });
      if (!res.ok) {
        setAuthError('Could not load user list — is the server up?');
        return;
      }
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.users) || data.users.length === 0) {
        setAuthError('No users available — contact admin');
        return;
      }
      setPickerUsers(data.users);
      setPendingPassword(password);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoggingIn(false);
    }
  }

  // Step 2 — pick user → POST password+user → cookie
  async function handlePickUser(u: PickerUser) {
    if (!pendingPassword) return;
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: pendingPassword, user: u.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.message || 'Login failed');
        setPendingPassword(null);
        setPickerUsers([]);
        return;
      }
      try { localStorage.setItem('app-user', data.user.name); } catch {}
      setMe({ user: { name: data.user.name } });
      setPendingPassword(null);
      setPickerUsers([]);
      await loadHiveData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
      setPendingPassword(null);
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch {}
    try { localStorage.removeItem('app-user'); localStorage.removeItem('app-auth'); } catch {}
    setMe(null);
    setProjects([]);
    setBrands([]);
  }

  // !! Hooks must run in the same order every render — keep useMemo BEFORE
  // any of the conditional early returns below (loading screen / login view).
  // Otherwise React throws Minified Error #310 once me?.user transitions.
  const myUsername = me?.user?.name?.toLowerCase() ?? '';
  const islands = useMemo(() => {
    return ORDER.map(o => {
      const brand = brands.find(b => b.ownerId.toLowerCase() === o.owner);
      const ownerProjects = projects.filter(p => p.ownerId.toLowerCase() === o.owner);
      return {
        owner: o.owner,
        emoji: brand?.avatarEmoji ?? o.emoji,
        color: brand?.colorHex ?? o.color,
        brandName: brand?.name ?? o.name,
        projects: ownerProjects,
        isMe: myUsername === o.owner,
      };
    });
  }, [brands, projects, myUsername]);

  // Avoid flash before session check
  if (!sessionChecked) {
    return <div className="min-h-screen bg-gradient-to-b from-[#03192e] via-[#062842] to-[#021326]" />;
  }

  // ── LOGIN VIEW (no session) ──────────────────────────────────────
  if (!me?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#03192e] via-[#062842] to-[#021326] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">🐝</div>
            <h1 className="text-3xl font-bold">The Hive</h1>
            <p className="text-white/50 text-sm mt-1">Sign in to enter your island</p>
          </div>

          {!pendingPassword ? (
            <form onSubmit={handlePasswordSubmit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                placeholder="Password"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              {authError && <p className="text-red-300 text-sm">{authError}</p>}
              <button
                type="submit"
                disabled={loggingIn || !password}
                className="w-full py-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {loggingIn ? 'Loading…' : 'Next'}
              </button>
            </form>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-center mb-1">Who are you?</h2>
              <p className="text-white/50 text-xs text-center mb-4">Pick your tag</p>
              {authError && <p className="text-red-300 text-sm text-center mb-3">{authError}</p>}
              <div className="grid grid-cols-3 gap-2">
                {pickerUsers.map((u) => (
                  <button
                    key={u.name}
                    onClick={() => handlePickUser(u)}
                    disabled={loggingIn}
                    className={`py-2.5 rounded-lg text-sm font-medium border text-white hover:border-amber-400 disabled:opacity-50 transition-colors ${
                      u.role === 'admin' ? 'border-amber-400/40 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    {u.name}
                    {u.role === 'admin' && <span className="ml-1 text-[9px] text-amber-300">★</span>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setPendingPassword(null); setPickerUsers([]); setAuthError(null); }}
                className="w-full mt-4 text-white/40 text-xs hover:text-white/70"
              >
                ← back
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  // ── End login view ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#03192e] via-[#062842] to-[#021326] text-white">
      <style jsx>{`
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 200, 0, 0.5), 0 0 30px rgba(255, 200, 0, 0.3); }
          50%      { box-shadow: 0 0 0 6px rgba(255, 200, 0, 0.2), 0 0 40px rgba(255, 200, 0, 0.6); }
        }
        @keyframes wave {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        .pulse-gold { animation: pulseGold 2.4s ease-in-out infinite; }
        .wave-line { animation: wave 8s ease-in-out infinite; }
      `}</style>

      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🐝 The Hive</h1>
          <p className="text-white/50 text-xs">
            {projects.length} projects across {islands.length} brands
            {me?.user?.name && <> · logged in as <span className="text-amber-300">{me.user.name}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-white/50 hover:text-white">Projects →</Link>
          <button
            onClick={handleLogout}
            className="text-sm text-white/50 hover:text-red-300 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {err && <div className="px-6 py-2 bg-red-500/10 text-red-300 text-sm">{err}</div>}

      <div className="relative h-2 bg-gradient-to-r from-cyan-500/20 via-blue-400/30 to-cyan-500/20 wave-line" />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {islands.map(isl => (
            <section
              key={isl.owner}
              className={`rounded-2xl border p-4 backdrop-blur-sm ${
                isl.isMe
                  ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/10 to-transparent pulse-gold'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
              style={isl.isMe ? undefined : { borderTopColor: isl.color, borderTopWidth: 2 }}
            >
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `radial-gradient(circle, ${isl.color}66 0%, ${isl.color}15 70%)` }}
                >
                  {isl.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold truncate">{isl.brandName}</h2>
                    {isl.isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200">YOU</span>}
                  </div>
                  <div className="text-xs text-white/40 truncate">
                    @{isl.owner}
                    {isl.isMe && <> · {isl.projects.length} projects</>}
                  </div>
                </div>
              </div>

              {isl.isMe ? (
                isl.projects.length === 0 ? (
                  <p className="text-xs text-white/30 italic py-3 text-center">No projects yet</p>
                ) : (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                    {isl.projects.map(p => {
                      const total    = p.progress?.total ?? 0;
                      const approved = p.progress?.approved ?? 0;
                      const pct      = total > 0 ? Math.round((approved / total) * 100) : 0;
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/project/${p.id}`}
                            className="block px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-amber-400/30 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">{p.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 flex-shrink-0">{pct}%</span>
                            </div>
                            <div className="text-[11px] text-white/40 truncate">
                              {p.niche || '—'} · {p.language || '?'}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                /* Other islands: show only an aggregate count, hide project names + progress.
                   Each owner's work is private; you can't see it from another tag. */
                <div className="py-5 px-3 rounded-lg bg-white/[0.02] border border-dashed border-white/10 text-center">
                  <div className="text-2xl mb-1.5 select-none">🔒</div>
                  <p className="text-xs text-white/60 font-semibold tracking-wide uppercase">
                    Private
                  </p>
                  <p className="text-[11px] text-white/30 mt-1 leading-snug">
                    Vous n&apos;êtes pas sur ce profil.
                  </p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                {isl.isMe ? (
                  <Link
                    href={`/brand/${isl.owner}`}
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Open my world →
                  </Link>
                ) : (
                  <span
                    className="text-xs text-white/25 cursor-not-allowed select-none"
                    title="Privé — vous n'êtes pas sur ce profil"
                  >
                    🔒 Privé
                  </span>
                )}
                {isl.isMe && (
                  <Link
                    href="/"
                    className="text-xs text-white/40 hover:text-white"
                  >
                    + new project
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 mx-auto max-w-md text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-400/30">
            <span className="text-2xl">🔮</span>
            <span className="text-sm text-purple-200">Oracle is observing the hive</span>
          </div>
        </div>
      </main>
    </div>
  );
}
