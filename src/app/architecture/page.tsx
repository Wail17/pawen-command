'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

// ============================================================
// AutoEcom Lab — Architecture page
// Public, no auth gate — meant to be shared for pitching.
// Uses Mermaid via CDN (no package.json changes).
// ============================================================

type MermaidAPI = {
  initialize: (config: Record<string, unknown>) => void;
  run: () => Promise<void>;
};

declare global {
  interface Window {
    mermaid?: MermaidAPI;
  }
}

const BIG_PICTURE = `flowchart TD
    User([👤 User<br/>Sykss / Suley]) --> Dash{{🎛 Dashboard<br/>AutoEcom Lab}}
    Dash --> Proj[📂 Projects<br/>9-Gate Pipeline]
    Dash --> Agents[🤖 Agent Team<br/>6 personas]
    Dash --> Tools[🛠 Mini-Tools<br/>Trustpilot, ...]
    Dash --> Train[📚 Training<br/>Knowledge base]

    Proj --> DB[(💾 IndexedDB<br/>local store)]
    Proj --> API[⚡ API Routes<br/>Vercel Functions]

    API --> Anthropic[🧠 Anthropic Claude<br/>Opus + Sonnet]
    API --> Firecrawl[🕷 Firecrawl<br/>web scraping]
    API --> Tavily[🔍 Tavily<br/>LLM search]
    API --> Reddit[🟠 Reddit JSON<br/>public API]
    API --> Fal[🎨 fal.ai<br/>image gen]

    classDef user fill:#f97316,stroke:#f97316,color:#fff,stroke-width:2px
    classDef hub fill:#1e293b,stroke:#f97316,color:#f97316,stroke-width:2px
    classDef module fill:#0f172a,stroke:#334155,color:#e2e8f0
    classDef storage fill:#0f172a,stroke:#334155,color:#e2e8f0
    classDef service fill:#1e1b4b,stroke:#6366f1,color:#a5b4fc

    class User user
    class Dash hub
    class Proj,Agents,Tools,Train module
    class DB,API storage
    class Anthropic,Firecrawl,Tavily,Reddit,Fal service`;

const GATES_PIPELINE = `flowchart LR
    subgraph A[" PHASE A — RESEARCH "]
        G1[Gate 1<br/>Avatar<br/>Excavation]
        G2[Gate 2<br/>Deep Dive]
        G3[Gate 3<br/>Root Cause]
    end
    subgraph B[" PHASE B — LOCK "]
        BD[🔒 Brand DNA<br/>Single source<br/>of truth]
    end
    subgraph C[" PHASE C — COPY "]
        G4[Gate 4<br/>Copy Arsenal]
        G5[Gate 5<br/>Advertorial]
        G6[Gate 6<br/>Ad Scripts]
    end
    subgraph D[" PHASE D — CREATIVE "]
        G7[Gate 7<br/>Image Ads]
        G8[Gate 8<br/>Creative Gen]
    end
    subgraph E[" PHASE E — LAUNCH "]
        G9[Gate 9<br/>Campaign]
    end

    G1 --> G2 --> G3 --> BD
    BD --> G4 --> G5 --> G6
    G6 --> G7 --> G8
    G8 --> G9

    classDef gate fill:#1e293b,stroke:#f97316,color:#f97316,stroke-width:2px
    classDef lock fill:#422006,stroke:#f59e0b,color:#fbbf24,stroke-width:3px
    class G1,G2,G3,G4,G5,G6,G7,G8,G9 gate
    class BD lock`;

const GATE1_DETAIL = `flowchart TD
    Input["🎯 INPUT<br/>Core Avatar<br/>• surface_desire<br/>• niche + produit<br/>• langue + marché<br/>+ Training Doc (cached)"]

    Input --> P1

    subgraph P1[" PHASE 1 — DISCOVERY "]
        D1[Marcus génère le plan de chasse<br/>40-60 subreddits + queries<br/>Sonnet · 1 call]
    end

    P1 --> P2

    subgraph P2[" PHASE 2 — FETCHING (no LLM) "]
        F1[Reddit JSON]
        F2[Firecrawl]
        F3[Tavily]
        F1 & F2 & F3 --> Raw[RawSourceData<br/>markdown bundles]
    end

    P2 --> P3

    subgraph P3[" PHASE 3 — ANALYZERS "]
        A1[Analyzer per source<br/>extracts verbatims, emotions,<br/>behaviors, demographics<br/>N × Sonnet · séquentiel 2.5s gap]
    end

    P3 --> P4

    subgraph P4[" PHASE 4 — COMPILE "]
        C1[Synthèse en 3-5 sub-avatars<br/>+ 3 angles par avatar<br/>+ scoring + reco<br/>Sonnet · fallback cascade]
    end

    P4 --> Output

    Output["📦 OUTPUT<br/>3-5 sub-avatars<br/>comparative table<br/>final recommendation"]
    Output --> Pick["👆 USER PICKS ONE<br/>→ lock pour Gates 2-9"]

    classDef io fill:#422006,stroke:#f59e0b,color:#fbbf24,stroke-width:2px
    classDef phase fill:#1e293b,stroke:#f97316,color:#e2e8f0
    classDef pick fill:#065f46,stroke:#10b981,color:#a7f3d0,stroke-width:2px
    class Input,Output io
    class D1,F1,F2,F3,Raw,A1,C1 phase
    class Pick pick`;

const AGENT_MAP = `flowchart LR
    Marcus["🔍 Marcus<br/>Researcher"]
    Lea["👑 Léa<br/>PM / Director"]
    Alex["✍️ Alex<br/>Copywriter"]
    Nina["🎨 Nina<br/>Creative Dir"]
    David["📊 David<br/>Media Buyer"]

    Marcus --> G1[Gate 1]
    Marcus --> G2[Gate 2]
    Marcus --> G3[Gate 3]
    Lea --> BD[🔒 Brand DNA]
    Alex --> G4[Gate 4]
    Alex --> G5[Gate 5]
    Alex --> G6[Gate 6]
    Nina --> G7[Gate 7]
    Nina --> G8[Gate 8]
    David --> G9[Gate 9]

    classDef agent fill:#1e1b4b,stroke:#6366f1,color:#a5b4fc,stroke-width:2px
    classDef gate fill:#1e293b,stroke:#f97316,color:#f97316
    classDef lock fill:#422006,stroke:#f59e0b,color:#fbbf24
    class Marcus,Lea,Alex,Nina,David agent
    class G1,G2,G3,G4,G5,G6,G7,G8,G9 gate
    class BD lock`;

const SERVICES_MAP = `flowchart LR
    subgraph Client[" 🖥 CLIENT (React) "]
        UI[UI Pages]
        Run[runAvatarExcavation]
    end

    subgraph Backend[" ⚡ BACKEND (Vercel Functions) "]
        Gen[/api/generate/]
        Rev[/api/review/]
        Con[/api/congruence/]
        Scr[/api/scrape/]
        Sea[/api/search/]
        Red[/api/reddit/]
        Img[/api/imagegen/]
        Tru[/api/tools/trustpilot/]
    end

    subgraph External[" 🌐 EXTERNAL APIS "]
        Ant[Anthropic Claude]
        Fc[Firecrawl]
        Tv[Tavily]
        Rd[Reddit JSON]
        Fa[fal.ai]
    end

    UI --> Gen
    UI --> Img
    Run --> Gen
    Run --> Scr
    Run --> Sea
    Run --> Red

    Gen --> Ant
    Rev --> Ant
    Con --> Ant
    Tru --> Ant
    Tru --> Fc

    Scr --> Fc
    Sea --> Tv
    Red --> Rd
    Img --> Fa

    classDef client fill:#1e293b,stroke:#f97316,color:#e2e8f0
    classDef backend fill:#0f172a,stroke:#334155,color:#94a3b8
    classDef ext fill:#1e1b4b,stroke:#6366f1,color:#a5b4fc
    class UI,Run client
    class Gen,Rev,Con,Scr,Sea,Red,Img,Tru backend
    class Ant,Fc,Tv,Rd,Fa ext`;

const AGENTS = [
  { emoji: '🧠', name: 'Sarah', role: 'Strategist', gates: 'Legacy', color: 'text-purple-400' },
  { emoji: '🔍', name: 'Marcus', role: 'Researcher', gates: 'Gate 1 · 2 · 3', color: 'text-blue-400' },
  { emoji: '✍️', name: 'Alex', role: 'Copywriter', gates: 'Gate 4 · 5 · 6', color: 'text-green-400' },
  { emoji: '🎨', name: 'Nina', role: 'Creative Director', gates: 'Gate 7 · 8', color: 'text-pink-400' },
  { emoji: '📊', name: 'David', role: 'Media Buyer', gates: 'Gate 9', color: 'text-yellow-400' },
  { emoji: '👑', name: 'Léa', role: 'PM & Director', gates: 'Brand DNA', color: 'text-accent-orange' },
];

const STACK = [
  { layer: 'Frontend', items: ['Next.js 16 · App Router', 'React 19', 'TailwindCSS', 'IndexedDB (idb)'] },
  { layer: 'Backend', items: ['Vercel Functions', 'Fluid Compute', 'Node.js 24 LTS'] },
  { layer: 'AI', items: ['Anthropic Claude Opus 4.6', 'Claude Sonnet 4.6', 'Prompt caching (90% savings)'] },
  { layer: 'Data', items: ['Firecrawl (scraping)', 'Tavily (LLM search)', 'Reddit public JSON', 'fal.ai (image gen)'] },
];

export default function ArchitecturePage() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Load Mermaid from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      if (!window.mermaid) return;
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          darkMode: true,
          background: '#0f172a',
          primaryColor: '#1e293b',
          primaryTextColor: '#e2e8f0',
          primaryBorderColor: '#f97316',
          lineColor: '#64748b',
          secondaryColor: '#1e1b4b',
          tertiaryColor: '#0f172a',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
        },
        flowchart: {
          curve: 'basis',
          padding: 20,
          nodeSpacing: 40,
          rankSpacing: 60,
          useMaxWidth: true,
        },
      });
      window.mermaid.run().catch((err) => console.error('[architecture] mermaid render error', err));
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-accent-orange">AutoEcom Lab</h1>
              <p className="text-text-secondary text-sm mt-1">
                Multi-agent AI pipeline for Meta Ads — any product, any language, any niche
              </p>
              <p className="text-text-muted text-xs mt-2">Architecture overview · v1.0</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm"
            >
              ← Back to app
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* Pitch */}
        <section className="bg-gradient-to-br from-bg-card to-bg-primary border border-accent-orange/30 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-accent-orange mb-3">The pitch</h2>
          <p className="text-text-primary text-lg leading-relaxed">
            A <span className="text-accent-orange font-semibold">multi-agent AI pipeline</span> that starts from a single
            product idea and <span className="text-accent-orange font-semibold">reverse-engineers real customers</span> by
            scraping 8 sources (Reddit, Amazon, YouTube, TikTok, Quora, forums, reviews, wide web). The output flows
            through <span className="text-accent-orange font-semibold">9 sequential gates</span> — from avatar excavation
            to campaign blueprint — each run by a persona-driven agent team. A locked{' '}
            <span className="text-accent-orange font-semibold">Brand DNA</span> ensures cross-gate consistency. Final
            deliverable: Meta Ads campaigns ready to launch.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
              Any niche
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
              15 languages
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
              6 agents
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
              9 gates
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/30">
              8 data sources
            </span>
          </div>
        </section>

        {/* Diagram 1 — Big picture */}
        <Section number="01" title="Big picture" subtitle="System architecture overview">
          <DiagramBox chart={BIG_PICTURE} />
        </Section>

        {/* Diagram 2 — 9 gates pipeline */}
        <Section number="02" title="9-gate pipeline" subtitle="From raw product idea to launch-ready campaign">
          <DiagramBox chart={GATES_PIPELINE} />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['Gate 1', 'Avatar Excavation', 'Deep mining → sub-avatars'],
              ['Gate 2', 'Avatar Deep Dive', '17-category enrichment'],
              ['Gate 3', 'Root Cause', 'Belief error + villain framing'],
              ['Brand DNA', 'Lock-in', 'Single source of truth'],
              ['Gate 4', 'Copy Arsenal', 'Hooks, loops, sensory'],
              ['Gate 5', 'Advertorial', '7-block + 9-step close'],
              ['Gate 6', 'Ad Scripts', 'Video scripts + body copies'],
              ['Gate 7', 'Image Ads', 'Headlines + image briefs'],
              ['Gate 8', 'Creative Gen', 'Static ads via fal.ai'],
              ['Gate 9', 'Campaign Blueprint', 'CBO + testing + scaling'],
            ].map(([gate, name, desc]) => (
              <div key={gate} className="bg-bg-card border border-border rounded-lg p-4">
                <div className="text-accent-orange text-[11px] uppercase tracking-wider">{gate}</div>
                <div className="text-text-primary text-sm font-semibold mt-1">{name}</div>
                <div className="text-text-muted text-xs mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Diagram 3 — Gate 1 deep dive */}
        <Section
          number="03"
          title="Zoom: Gate 1 — Avatar Excavation"
          subtitle="The research engine — 4-phase pipeline"
        >
          <DiagramBox chart={GATE1_DETAIL} />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-bg-card border border-border rounded-lg p-5">
              <h4 className="text-accent-orange font-semibold text-sm mb-2">Cost optimization</h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                The ~14k-token EVOLVE methodology doc is injected as a{' '}
                <span className="text-text-primary">cached system prefix</span>, shared across all phase calls. Anthropic
                caches it for ~5 min → <span className="text-accent-orange font-semibold">90% input cost reduction</span>{' '}
                on repeat calls.
              </p>
            </div>
            <div className="bg-bg-card border border-border rounded-lg p-5">
              <h4 className="text-accent-orange font-semibold text-sm mb-2">Fallback cascade</h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                Phase 4 uses a <span className="text-text-primary">3-layer fallback</span>: tryFullCompile (16k) →
                tryTwoPassCompile (skeleton + per-avatar angles) → synthesizeMinimalResult (heuristic). Ensures Gate 1
                <span className="text-accent-orange font-semibold"> never fully fails</span> even on timeouts.
              </p>
            </div>
          </div>
        </Section>

        {/* Agent team */}
        <Section number="04" title="Agent team" subtitle="6 personas, each specialized in their phase">
          <DiagramBox chart={AGENT_MAP} />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENTS.map((a) => (
              <div
                key={a.name}
                className="bg-bg-card border border-border rounded-lg p-4 hover:border-border-active"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{a.emoji}</div>
                  <div>
                    <div className={`font-semibold ${a.color}`}>{a.name}</div>
                    <div className="text-text-muted text-xs">{a.role}</div>
                  </div>
                </div>
                <div className="text-text-secondary text-[11px] mt-3 uppercase tracking-wider">{a.gates}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Services map */}
        <Section number="05" title="Backend & external services" subtitle="How the pieces connect">
          <DiagramBox chart={SERVICES_MAP} />
        </Section>

        {/* Tech stack */}
        <Section number="06" title="Tech stack" subtitle="Built on Vercel's modern stack">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STACK.map((s) => (
              <div key={s.layer} className="bg-bg-card border border-border rounded-lg p-5">
                <div className="text-accent-orange text-[11px] uppercase tracking-wider font-semibold">{s.layer}</div>
                <ul className="mt-3 space-y-1.5">
                  {s.items.map((item) => (
                    <li key={item} className="text-text-secondary text-xs flex items-start gap-2">
                      <span className="text-accent-orange mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Key numbers */}
        <Section number="07" title="Key numbers" subtitle="What it takes to generate a full campaign">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['~50', 'LLM calls per project'],
              ['8', 'Data sources scraped'],
              ['3-5', 'Sub-avatars generated'],
              ['9', 'Sequential gates'],
              ['15', 'Languages supported'],
              ['~14k', 'Tokens of knowledge injected'],
              ['90%', 'Input cost reduction via cache'],
              ['~$2-5', 'Typical full pipeline run'],
            ].map(([num, label]) => (
              <div key={label} className="bg-bg-card border border-border rounded-lg p-5 text-center">
                <div className="text-3xl font-bold text-accent-orange">{num}</div>
                <div className="text-text-muted text-[11px] mt-1 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 pb-4">
          <p className="text-text-muted text-xs text-center">
            AutoEcom Lab · Architecture overview · Private beta ·{' '}
            <Link href="/" className="text-accent-orange hover:underline">
              Open app
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span className="text-accent-orange/40 text-sm font-mono">{number}</span>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          {subtitle && <p className="text-text-muted text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DiagramBox({ chart }: { chart: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-6 overflow-x-auto">
      <pre className="mermaid text-center">{chart}</pre>
    </div>
  );
}
