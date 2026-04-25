'use client';

// ============================================================
// PAWEN — /brand/[id]   (Phase W.5 + W.6)
//
// Owner view: header with brand metadata, 7-card agent grid
// (uses existing AGENT_PERSONAS + Oracle), projects list filtered
// to this brandId (stub — returns empty for now).
//
// Lurk mode (`?view=lurk`): redacted activity, no project content,
// public winning patterns from this brand only.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AGENT_PERSONAS } from '@/lib/agents/personas';
import { ORACLE } from '@/lib/hive/oracle';
import { getAllProjects } from '@/lib/store/db';
import type { Project } from '@/lib/types';

interface Brand {
  id: string; ownerId: string; name: string;
  avatarEmoji: string; colorHex: string;
  sharesPatterns: boolean;
}
interface WinningPattern {
  id: string;
  sourceBrandId: string;
  gateId: string;
  generalizedPattern: { kind: string; description: string; example?: string };
  metrics: { ctr?: number; cpa?: number; roas?: number };
  createdAt: string;
}

export default function BrandPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const isLurk = search.get('view') === 'lurk';

  const [me, setMe] = useState<{ user?: { name: string } } | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [patterns, setPatterns] = useState<WinningPattern[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [mRes, hRes, pRes, idbProjects] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'same-origin' }),
        fetch('/api/hive/state', { credentials: 'same-origin' }),
        fetch(`/api/winning-patterns?brandId=${encodeURIComponent(params.id)}`, { credentials: 'same-origin' }),
        getAllProjects().catch(() => [] as Project[]),
      ]);
      if (mRes.ok) setMe(await mRes.json());
      if (hRes.ok) {
        const data = await hRes.json() as { brands?: Brand[] };
        const b = (data.brands ?? []).find(x => x.ownerId.toLowerCase() === params.id.toLowerCase())
          ?? (data.brands ?? []).find(x => x.id === params.id) ?? null;
        setBrand(b);
      }
      if (pRes.ok) {
        const data = await pRes.json() as { patterns?: WinningPattern[] };
        setPatterns(data.patterns ?? []);
      }
      // Local IDB projects: only the device-owner sees them. The route param
      // matches their own username → show all local projects. Lurk view of
      // someone else's brand never shows project content.
      setProjects(idbProjects);
      setLoading(false);
    })();
  }, [params.id]);

  const isOwner = useMemo(() => {
    return !!(me?.user?.name && brand && me.user.name.toLowerCase() === brand.ownerId.toLowerCase());
  }, [me, brand]);

  // Lurk mode is forced for non-owners regardless of the query param.
  const showOwnerView = !isLurk && isOwner;

  const agents = [
    ...Object.values(AGENT_PERSONAS),
    { id: ORACLE.id, name: ORACLE.name, role: ORACLE.role, emoji: ORACLE.emoji } as const,
  ];

  if (loading) return <div className="min-h-screen bg-bg-primary p-8 text-white/60">Loading…</div>;

  if (!brand) {
    return (
      <div className="min-h-screen bg-bg-primary text-white p-8">
        <p className="text-white/60">Brand not found.</p>
        <Link href="/hive" className="text-accent-orange hover:underline">← Hive</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Colored header strip using brand color */}
      <div
        className="px-6 py-6 border-b border-white/10"
        style={{ background: `linear-gradient(90deg, ${brand.colorHex}22 0%, transparent 60%)` }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{brand.avatarEmoji}</span>
            <div>
              <h1 className="text-2xl font-bold">{brand.name}</h1>
              <p className="text-white/50 text-xs">
                @{brand.ownerId}
                {showOwnerView ? ' · owner view' : ' · lurk mode (redacted)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/hive" className="text-white/50 hover:text-white">← Hive</Link>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats placeholder */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Projects',         value: '—' },
            { label: 'Winning patterns', value: patterns.length },
            { label: 'Active agents',    value: '—' },
            { label: 'Shares patterns',  value: brand.sharesPatterns ? 'yes' : 'no' },
          ].map(s => (
            <div key={s.label} className="border border-border bg-bg-card rounded-lg p-3">
              <div className="text-xs text-text-muted">{s.label}</div>
              <div className="text-xl font-semibold">{s.value}</div>
            </div>
          ))}
        </section>

        {/* Agent grid — 7 cards (6 personas + Oracle) */}
        <section>
          <h2 className="text-sm font-semibold text-text-muted uppercase mb-3">Agents</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {agents.map(a => {
              const isOracle = a.id === 'oracle';
              const card = (
                <div className="border border-border bg-bg-card rounded-lg p-3 text-center hover:border-accent-orange transition-colors h-full">
                  <div className="text-3xl">{a.emoji}</div>
                  <div className="text-sm font-semibold mt-1">{a.name}</div>
                  <div className="text-xs text-text-muted">{a.role}</div>
                  <div className="text-xs mt-2 text-white/40">
                    {showOwnerView && !isOracle ? '💬 talk' : (showOwnerView ? 'observing' : '•••')}
                  </div>
                </div>
              );
              if (showOwnerView && !isOracle) {
                return (
                  <Link key={a.id} href={`/agents/${a.id}/chat`}>{card}</Link>
                );
              }
              return <div key={a.id}>{card}</div>;
            })}
          </div>
        </section>

        {/* Projects — owner only, fetched from local IndexedDB */}
        {showOwnerView && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase">Projects ({projects.length})</h2>
              <Link href="/" className="text-xs text-accent-orange hover:underline">+ New / manage on legacy dashboard</Link>
            </div>
            {projects.length === 0 ? (
              <div className="border border-border bg-bg-card rounded-lg p-4 text-text-muted text-sm italic">
                No projects yet on this device.
              </div>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/project/${p.id}`}
                      className="block border border-border bg-bg-card rounded-lg p-3 hover:border-accent-orange transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold truncate flex-1">{p.name}</span>
                        <span className="text-xs text-text-muted ml-2">{p.targetLanguage}</span>
                      </div>
                      <div className="text-xs text-text-muted mt-1 truncate">
                        {p.coreAvatarInput?.niche || p.niche || 'no niche'}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Winning patterns — public to everyone (lurk includes this) */}
        <section>
          <h2 className="text-sm font-semibold text-text-muted uppercase mb-3">
            Winning patterns{showOwnerView ? '' : ' (public view)'}
          </h2>
          {patterns.length === 0 ? (
            <div className="border border-border bg-bg-card rounded-lg p-4 text-text-muted text-sm italic">
              No patterns shared yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {patterns.map(p => (
                <li key={p.id} className="border border-border bg-bg-card rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/50">
                      {p.generalizedPattern.kind} · {p.gateId}
                    </span>
                    <span className="text-xs text-white/40">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm mt-1">{p.generalizedPattern.description}</div>
                  {p.generalizedPattern.example && (
                    <div className="text-xs text-white/60 italic mt-1">&ldquo;{p.generalizedPattern.example}&rdquo;</div>
                  )}
                  {(p.metrics.roas || p.metrics.ctr || p.metrics.cpa) && (
                    <div className="text-xs text-white/50 mt-1">
                      {p.metrics.roas !== undefined && `ROAS ${p.metrics.roas}× · `}
                      {p.metrics.ctr !== undefined && `CTR ${p.metrics.ctr}% · `}
                      {p.metrics.cpa !== undefined && `CPA $${p.metrics.cpa}`}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!showOwnerView && (
          <section className="border border-white/10 bg-white/5 rounded-lg p-4 text-sm text-white/60">
            Lurk mode — activity redacted. Public winning patterns shown above.
          </section>
        )}
      </main>
    </div>
  );
}
