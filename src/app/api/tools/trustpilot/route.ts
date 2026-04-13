// ============================================================
// AutoEcom Lab — /api/tools/trustpilot
// Scrapes N pages of Trustpilot reviews via Firecrawl, then
// feeds the concatenated markdown to Claude Sonnet for analysis.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';
const TRUSTPILOT_MODEL = 'claude-sonnet-4-6';

type ScrapedPage = {
  page: number;
  url: string;
  markdown: string;
};

// ---------- URL normalization ----------
function normalizeTrustpilotUrl(raw: string): { baseUrl: string; slug: string } | null {
  const input = raw.trim();
  if (!input) return null;

  // Full trustpilot URL
  const full = input.match(/trustpilot\.com\/review\/([^/?#\s]+)/i);
  if (full) {
    const slug = full[1];
    return { baseUrl: `https://www.trustpilot.com/review/${slug}`, slug };
  }

  // Bare slug / domain (e.g. "company.com" or "company")
  const bare = input.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (/^[a-z0-9.-]+$/i.test(bare)) {
    return { baseUrl: `https://www.trustpilot.com/review/${bare}`, slug: bare };
  }

  return null;
}

// ---------- Firecrawl ----------
async function scrapePage(url: string, apiKey: string): Promise<string> {
  const res = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Firecrawl ${res.status}: ${err?.message || 'scrape failed'}`);
  }

  const data = await res.json();
  return data?.data?.markdown ?? '';
}

// ---------- Claude analysis ----------
const ANALYSIS_SYSTEM_PROMPT = `Tu es un analyste de reviews e-commerce expert. On te donne un bundle brut de reviews Trustpilot en markdown (plusieurs pages concaténées). Ta mission: en extraire des insights structurés et actionnables pour quelqu'un qui veut lancer une marque concurrente ou améliorer son offre.

Tu DOIS retourner un JSON strict (aucun texte autour), conforme à ce schema:

{
  "company": string,
  "totalReviewsAnalyzed": number (estimation à partir du markdown),
  "overallSentiment": "positive" | "mixed" | "negative",
  "averageRating": number | null,
  "negativeThemes": [
    {
      "theme": string (court, ex: "Service client injoignable"),
      "frequency": "very_high" | "high" | "medium" | "low",
      "description": string (2-3 phrases),
      "exampleQuotes": string[] (2-3 citations verbatim, traduites en FR si besoin)
    }
  ] (5 max, triés par fréquence),
  "positiveThemes": [
    {
      "theme": string,
      "frequency": "very_high" | "high" | "medium" | "low",
      "description": string,
      "exampleQuotes": string[]
    }
  ] (3 max),
  "demographics": {
    "genderBreakdown": {
      "female": number (0-100, pourcentage),
      "male": number (0-100, pourcentage),
      "unknown": number (0-100, pourcentage)
    },
    "caveat": string (rappel que c'est inféré des prénoms),
    "lifeStageSignals": string[] (ex: "parents de jeunes enfants", "retraités", "étudiants") - 3-5 items si détectés
  },
  "actionableInsights": [
    {
      "insight": string (1 phrase actionnable pour un concurrent),
      "basedOn": string (référence au thème négatif ou positif)
    }
  ] (5 max)
}

Règles strictes:
- Output en français même si les reviews sont dans une autre langue
- Si un champ n'est pas déterminable, mets null ou [] — ne jamais inventer
- Pour genderBreakdown: base-toi uniquement sur les prénoms visibles dans le markdown. Si aucun prénom n'est présent, mets 0/0/100
- exampleQuotes: courtes (max 20 mots), entre guillemets, traduites en français
- JSON pur uniquement, pas de \`\`\`json wrapper`;

async function analyzeReviews(
  apiKey: string,
  markdown: string,
  companySlug: string,
): Promise<string> {
  const userMessage = `Voici le bundle de reviews Trustpilot pour "${companySlug}" (concaténation de plusieurs pages):

---
${markdown}
---

Analyse ce bundle et retourne le JSON d'insights selon le schema fourni.`;

  const advisorEnabled = shouldUseAdvisor(TRUSTPILOT_MODEL);

  const requestBody: Record<string, unknown> = {
    model: TRUSTPILOT_MODEL,
    max_tokens: 8192,
    temperature: 0.3,
    system: [
      {
        type: 'text' as const,
        text: withAdvisorHint(ANALYSIS_SYSTEM_PROMPT, TRUSTPILOT_MODEL),
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const beta = composeBetaHeader({ caching: true, advisor: advisorEnabled });
  if (beta) headers['anthropic-beta'] = beta;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude ${res.status}: ${err?.error?.message || 'analysis failed'}`);
  }

  const data = await res.json();
  const content =
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

  return content;
}

// ---------- Route handler ----------
export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const requestId = Math.random().toString(36).slice(2, 10);
  console.log(`[tools:trustpilot:${requestId}] POST received from ${session.user}`);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;

  if (!anthropicKey) {
    console.error(`[tools:trustpilot:${requestId}] missing ANTHROPIC_API_KEY`);
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  if (!firecrawlKey) {
    console.error(`[tools:trustpilot:${requestId}] missing FIRECRAWL_API_KEY`);
    return NextResponse.json({ message: 'FIRECRAWL_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { url, pages = 3 } = body as { url?: string; pages?: number };

  if (!url) {
    console.warn(`[tools:trustpilot:${requestId}] 400 missing url`);
    return NextResponse.json({ message: 'url is required' }, { status: 400 });
  }

  const normalized = normalizeTrustpilotUrl(url);
  if (!normalized) {
    console.warn(`[tools:trustpilot:${requestId}] 400 invalid url: ${url}`);
    return NextResponse.json(
      { message: 'URL invalide. Utilise une URL Trustpilot ou un slug (ex: company.com)' },
      { status: 400 },
    );
  }

  const pageCount = Math.max(1, Math.min(5, Math.floor(pages)));
  const startedAt = Date.now();
  console.log(
    `[tools:trustpilot:${requestId}] start slug=${normalized.slug} pages=${pageCount}`,
  );

  try {
    // Scrape pages in parallel
    const pageUrls = Array.from({ length: pageCount }, (_, i) =>
      i === 0 ? normalized.baseUrl : `${normalized.baseUrl}?page=${i + 1}`,
    );

    const scrapes = await Promise.allSettled(
      pageUrls.map((u) => scrapePage(u, firecrawlKey)),
    );

    const scraped: ScrapedPage[] = [];
    const scrapeErrors: string[] = [];

    scrapes.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        scraped.push({ page: i + 1, url: pageUrls[i], markdown: result.value });
      } else if (result.status === 'rejected') {
        scrapeErrors.push(`page ${i + 1}: ${result.reason?.message || 'failed'}`);
      }
    });

    console.log(
      `[tools:trustpilot:${requestId}] scraped ${scraped.length}/${pageCount} pages (errors=${scrapeErrors.length})`,
    );

    if (scraped.length === 0) {
      console.error(
        `[tools:trustpilot:${requestId}] all scrapes failed: ${scrapeErrors.join(' | ')}`,
      );
      return NextResponse.json(
        {
          message: 'Aucune page n\'a pu être scrapée. Vérifie l\'URL.',
          details: scrapeErrors,
        },
        { status: 502 },
      );
    }

    // Concatenate markdown with page separators
    const bundle = scraped
      .map((s) => `\n\n=== PAGE ${s.page} (${s.url}) ===\n\n${s.markdown}`)
      .join('\n');

    // Truncate if absurdly long (Claude input budget safety)
    const MAX_INPUT_CHARS = 180_000;
    const truncated = bundle.length > MAX_INPUT_CHARS ? bundle.slice(0, MAX_INPUT_CHARS) + '\n\n[... truncated]' : bundle;

    // Analyze
    const rawAnalysis = await analyzeReviews(anthropicKey, truncated, normalized.slug);

    // Parse JSON (strip possible code fences just in case)
    const cleaned = rawAnalysis
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        `[tools:trustpilot:${requestId}] Claude returned invalid JSON (len=${rawAnalysis.length})`,
      );
      return NextResponse.json(
        {
          message: 'Claude a retourné un JSON invalide',
          raw: rawAnalysis.slice(0, 2000),
        },
        { status: 502 },
      );
    }

    const elapsed = Date.now() - startedAt;
    console.log(
      `[tools:trustpilot:${requestId}] success in ${elapsed}ms (pages=${scraped.length}/${pageCount})`,
    );

    return NextResponse.json({
      slug: normalized.slug,
      pagesScraped: scraped.length,
      pagesRequested: pageCount,
      scrapeErrors: scrapeErrors.length > 0 ? scrapeErrors : undefined,
      analysis: parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const elapsed = Date.now() - startedAt;
    console.error(
      `[tools:trustpilot:${requestId}] failed after ${elapsed}ms: ${message}`,
      error,
    );
    return NextResponse.json({ message }, { status: 500 });
  }
}
