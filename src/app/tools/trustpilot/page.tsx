'use client';

import { useState } from 'react';
import Link from 'next/link';

type Frequency = 'very_high' | 'high' | 'medium' | 'low';

type Theme = {
  theme: string;
  frequency: Frequency;
  description: string;
  exampleQuotes: string[];
};

type Analysis = {
  company: string;
  totalReviewsAnalyzed: number;
  overallSentiment: 'positive' | 'mixed' | 'negative';
  averageRating: number | null;
  negativeThemes: Theme[];
  positiveThemes: Theme[];
  demographics: {
    genderBreakdown: { female: number; male: number; unknown: number };
    caveat: string;
    lifeStageSignals: string[];
  };
  actionableInsights: { insight: string; basedOn: string }[];
};

type ApiResponse = {
  slug: string;
  pagesScraped: number;
  pagesRequested: number;
  scrapeErrors?: string[];
  analysis: Analysis;
};

const FREQ_LABEL: Record<Frequency, { label: string; color: string }> = {
  very_high: { label: 'Très fréquent', color: 'bg-error/20 text-error' },
  high: { label: 'Fréquent', color: 'bg-accent-orange/20 text-accent-orange' },
  medium: { label: 'Moyen', color: 'bg-yellow-500/20 text-yellow-500' },
  low: { label: 'Rare', color: 'bg-bg-primary text-text-muted' },
};

export default function TrustpilotToolPage() {
  const [url, setUrl] = useState('');
  const [pages, setPages] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const userTag = typeof window !== 'undefined' ? localStorage.getItem('app-user') || 'unknown' : 'unknown';
    console.log(`[user:${userTag}] [trustpilot] analyze start: ${url} (${pages} pages)`);

    try {
      const res = await fetch('/api/tools/trustpilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), pages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Échec de l\'analyse');
        console.error(`[user:${userTag}] [trustpilot] error:`, data);
      } else {
        setResult(data as ApiResponse);
        console.log(`[user:${userTag}] [trustpilot] success: ${data.pagesScraped} pages analyzed`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      console.error(`[user:${userTag}] [trustpilot] fetch failed:`, err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Trustpilot Review Analyzer</h1>
            <p className="text-text-muted text-xs">Scrape + analyse des reviews publiques</p>
          </div>
          <Link
            href="/tools"
            className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm"
          >
            ← Tools
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Input form */}
        <form
          onSubmit={handleAnalyze}
          className="bg-bg-card border border-border rounded-xl p-5 mb-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1.5">
                URL Trustpilot ou slug
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.trustpilot.com/review/company.com ou juste company.com"
                className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-orange text-sm"
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-1">
                Exemples: <code className="text-text-secondary">amazon.com</code>,{' '}
                <code className="text-text-secondary">trustpilot.com/review/shein.com</code>
              </p>
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-1.5">
                Nombre de pages à scraper ({pages} × ~20 reviews)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value))}
                className="w-full accent-accent-orange"
                disabled={loading}
              />
              <div className="flex justify-between text-[11px] text-text-muted mt-1">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Analyse en cours... (30-90s)' : 'Analyser'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-6">
            <p className="text-error text-sm font-medium">Erreur</p>
            <p className="text-text-secondary text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && <ResultPanel data={result} />}
      </main>
    </div>
  );
}

function ResultPanel({ data }: { data: ApiResponse }) {
  const { analysis, pagesScraped, pagesRequested, scrapeErrors } = data;

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{analysis.company}</h2>
            <p className="text-text-muted text-xs mt-1">
              {pagesScraped}/{pagesRequested} pages scrapées • ~{analysis.totalReviewsAnalyzed} reviews analysées
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SentimentBadge sentiment={analysis.overallSentiment} />
            {analysis.averageRating != null && (
              <span className="px-3 py-1 text-xs rounded-md bg-bg-primary border border-border text-text-secondary">
                ★ {analysis.averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        {scrapeErrors && scrapeErrors.length > 0 && (
          <p className="text-[11px] text-yellow-500 mt-3">
            ⚠ {scrapeErrors.length} page(s) non scrapée(s) — analyse basée sur les {pagesScraped} restantes
          </p>
        )}
      </div>

      {/* Negative themes */}
      <Section title={`Plaintes récurrentes (${analysis.negativeThemes.length})`} tone="negative">
        {analysis.negativeThemes.length === 0 ? (
          <p className="text-text-muted text-sm">Aucune plainte récurrente détectée.</p>
        ) : (
          <div className="space-y-3">
            {analysis.negativeThemes.map((t, i) => (
              <ThemeCard key={i} theme={t} tone="negative" />
            ))}
          </div>
        )}
      </Section>

      {/* Positive themes */}
      <Section title={`Points forts (${analysis.positiveThemes.length})`} tone="positive">
        {analysis.positiveThemes.length === 0 ? (
          <p className="text-text-muted text-sm">Aucun point fort récurrent détecté.</p>
        ) : (
          <div className="space-y-3">
            {analysis.positiveThemes.map((t, i) => (
              <ThemeCard key={i} theme={t} tone="positive" />
            ))}
          </div>
        )}
      </Section>

      {/* Demographics */}
      <Section title="Démographie inférée" tone="neutral">
        <div className="space-y-4">
          <div>
            <p className="text-text-secondary text-xs mb-2">Répartition par genre (estimation prénoms)</p>
            <GenderBar breakdown={analysis.demographics.genderBreakdown} />
          </div>
          {analysis.demographics.lifeStageSignals && analysis.demographics.lifeStageSignals.length > 0 && (
            <div>
              <p className="text-text-secondary text-xs mb-2">Signaux de contexte de vie</p>
              <div className="flex flex-wrap gap-2">
                {analysis.demographics.lifeStageSignals.map((s, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-xs rounded-md bg-bg-primary border border-border text-text-secondary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-text-muted italic border-l-2 border-border pl-3">
            ⓘ {analysis.demographics.caveat}
          </p>
        </div>
      </Section>

      {/* Actionable insights */}
      <Section title="Insights actionnables" tone="accent">
        {analysis.actionableInsights.length === 0 ? (
          <p className="text-text-muted text-sm">Aucun insight actionnable généré.</p>
        ) : (
          <div className="space-y-3">
            {analysis.actionableInsights.map((ins, i) => (
              <div key={i} className="border-l-2 border-accent-orange pl-3">
                <p className="text-text-primary text-sm">{ins.insight}</p>
                <p className="text-text-muted text-[11px] mt-1">→ basé sur: {ins.basedOn}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'negative' | 'positive' | 'neutral' | 'accent';
  children: React.ReactNode;
}) {
  const toneColor =
    tone === 'negative'
      ? 'text-error'
      : tone === 'positive'
      ? 'text-green-500'
      : tone === 'accent'
      ? 'text-accent-orange'
      : 'text-text-primary';

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${toneColor}`}>{title}</h3>
      {children}
    </div>
  );
}

function ThemeCard({ theme, tone }: { theme: Theme; tone: 'negative' | 'positive' }) {
  const freq = FREQ_LABEL[theme.frequency] ?? FREQ_LABEL.medium;
  const border = tone === 'negative' ? 'border-error/30' : 'border-green-500/30';

  return (
    <div className={`border ${border} rounded-lg p-4 bg-bg-primary/50`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-text-primary text-sm font-medium">{theme.theme}</h4>
        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-md whitespace-nowrap ${freq.color}`}>
          {freq.label}
        </span>
      </div>
      <p className="text-text-secondary text-xs mb-3 leading-relaxed">{theme.description}</p>
      {theme.exampleQuotes && theme.exampleQuotes.length > 0 && (
        <div className="space-y-1.5">
          {theme.exampleQuotes.map((q, i) => (
            <p key={i} className="text-[11px] text-text-muted italic">
              &ldquo;{q}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: 'positive' | 'mixed' | 'negative' }) {
  const config = {
    positive: { label: 'Positif', className: 'bg-green-500/20 text-green-500' },
    mixed: { label: 'Mitigé', className: 'bg-yellow-500/20 text-yellow-500' },
    negative: { label: 'Négatif', className: 'bg-error/20 text-error' },
  }[sentiment];

  return (
    <span className={`px-3 py-1 text-xs rounded-md font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function GenderBar({ breakdown }: { breakdown: { female: number; male: number; unknown: number } }) {
  const total = breakdown.female + breakdown.male + breakdown.unknown || 1;
  const fPct = (breakdown.female / total) * 100;
  const mPct = (breakdown.male / total) * 100;
  const uPct = (breakdown.unknown / total) * 100;

  return (
    <div>
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-bg-primary">
        <div style={{ width: `${fPct}%` }} className="bg-pink-500" />
        <div style={{ width: `${mPct}%` }} className="bg-blue-500" />
        <div style={{ width: `${uPct}%` }} className="bg-text-muted/40" />
      </div>
      <div className="flex gap-4 mt-2 text-[11px]">
        <span className="text-pink-500">♀ {Math.round(fPct)}%</span>
        <span className="text-blue-500">♂ {Math.round(mPct)}%</span>
        <span className="text-text-muted">? {Math.round(uPct)}%</span>
      </div>
    </div>
  );
}
