'use client';

// ============================================================
// PAWEN — /hive   (Phase W — Hive-as-dashboard)
//
// 6 island cards in a grid, each showing its owner's projects.
// User's own card highlighted with gold pulse; their projects are
// clickable links to /project/[id]. Other users' projects show
// as label-only badges (lurk).
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  { owner: 'sykss',    emoji: '🏝️', color: '#FF8A00', name: 'Sykss' },
  { owner: 'maghrabi', emoji: '🌴', color: '#2DD4BF', name: 'Maghrabi' },
  { owner: 'suley',    emoji: '⛰️', color: '#A78BFA', name: 'Suley' },
  { owner: 'stavo',    emoji: '🗿', color: '#F472B6', name: 'Stavo' },
  { owner: 'many',     emoji: '🏖️', color: '#FBBF24', name: 'Many' },
  { owner: 'amlee',    emoji: '🌋', color: '#EF4444', name: 'Amlee' },
];

export default function HivePage() {
  const [me, setMe] = useState<{ user?: { name: string } } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Login check-in: once per browser session, ping the server to fire an
  // auto standup on the most-stale project. Fire-and-forget.
  useEffect(() => {
    let alreadyFired = false;
    try { alreadyFired = sessionStorage.getItem('hive-checkin-fired') === '1'; } catch { /* private mode */ }
    if (alreadyFired) return;
    try { sessionStorage.setItem('hive-checkin-fired', '1'); } catch { /* noop */ }
    void fetch('/api/hive/checkin', { method: 'POST', credentials: 'same-origin' }).catch(() => { /* silent */ });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, hRes, pRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'same-origin' }),
          fetch('/api/hive/state', { credentials: 'same-origin' }),
          fetch('/api/hive/projects', { credentials: 'same-origin' }),
        ]);
        if (mRes.ok) setMe(await mRes.json());
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
    })();
  }, []);

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
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-white/50 hover:text-white">Legacy dashboard →</Link>
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
                  <div className="text-xs text-white/40 truncate">@{isl.owner} · {isl.projects.length} projects</div>
                </div>
              </div>

              {isl.projects.length === 0 ? (
                <p className="text-xs text-white/30 italic py-3 text-center">No projects yet</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {isl.projects.map(p => {
                    const pct = p.progress.total > 0 ? Math.round((p.progress.approved / p.progress.total) * 100) : 0;
                    if (isl.isMe) {
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
                    }
                    return (
                      <li key={p.id} className="px-2.5 py-1.5 rounded-lg bg-white/[0.02] cursor-default" title="Lurk view — only owner can open">
                        <div className="flex items-center justify-between gap-2 opacity-60">
                          <span className="text-sm truncate">{p.name}</span>
                          <span className="text-[10px] text-white/30 flex-shrink-0">{pct}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <Link
                  href={isl.isMe ? `/brand/${isl.owner}` : `/brand/${isl.owner}?view=lurk`}
                  className="text-xs text-white/50 hover:text-white"
                >
                  {isl.isMe ? 'Open my world →' : 'Lurk →'}
                </Link>
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
