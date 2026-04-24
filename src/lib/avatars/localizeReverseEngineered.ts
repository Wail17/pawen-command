// ============================================================
// PAWEN — Localize a Reverse-Engineered Avatar to a New Market
//
// When a user reverse-engineers a US brand's funnel and wants to run it in
// Italy (or France, DACH, whatever), the mechanism / fears / desires are
// usually 90% transferable — but the VERBATIMS, cultural anchors, and
// emotional language need to be re-mined in the target market.
//
// This module does a targeted mini-excavation:
//   1. Translates the reverse-engineered pain points + mechanism into
//      target-language search queries
//   2. Hits Tavily (searchWide) scoped to the target market
//   3. Scrapes the top results
//   4. Sends everything to Claude Sonnet via /api/avatars/localize for a
//      single-shot verbatim extract (API route so the key stays server-side)
//   5. Merges the localized signals into the SubAvatarV2 built by
//      fromReverseEngineered — keeping angles/mechanism/description intact
//      but replacing verbatim_quotes, emotional_triggers, swipe vocabulary.
//
// Faster than a full runAvatarExcavation (no multi-source orchestration,
// no gap-fill wave, no cross-source validation) — typically 2-5 min vs 30+.
// ============================================================

import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type {
  AvatarRunResult,
  CoreAvatarInput,
  SourceConfig,
  SourceDiscoveryPlan,
  SourceType,
  SubAvatarV2,
  VerbatimQuote,
} from './types';
import { webSearch, scrapeMany, languageModifier, amazonMarketplace } from '@/lib/sources/common';
import { runSourceFetchers } from '@/lib/sources';
import type { RedditDepth } from '@/lib/sources/reddit';
import { convertReverseEngineeredToAvatarRunResult } from './fromReverseEngineered';
import { extractJSON } from '@/lib/util/extractJson';

// Progress survives a crash. Stored on Project.localizationCheckpoint so when
// /api/avatars/localize or the scrape step dies mid-flow, the next call can
// skip the phases already done. Cleared once 'done'.
export interface LocalizationCheckpoint {
  competitorBrand: string;
  targetLanguage: string;
  targetMarket: string;
  phase: 'queries' | 'search' | 'scrape' | 'extract' | 'done';
  queries?: string[];
  snippets?: string[];
  uniqueUrls?: string[];
  scrapedContent?: string;
  bundle?: LocalizedVerbatimBundle;
  updatedAt: string;
}

export interface LocalizationProgress {
  phase: 'queries' | 'search' | 'scrape' | 'extract' | 'done';
  message: string;
  pct: number;
}

export interface LocalizedVerbatimBundle {
  cultural_fit: {
    score: number;
    verdict: 'use_as_is' | 'adapt_deeply' | 'do_not_localize';
    reason: string;
    recommendation: string;
  };
  localized_name: string;
  localized_nickname: string;
  localized_description: string;
  localized_demographics: string[];
  pain_points: string[];
  desires: string[];
  fears: string[];
  objections: string[];
  trigger_moments: string[];
  identity_statements: string[];
  verbatim_quotes: string[];
  emotional_triggers: string[];
  competitor_swaps: Array<{ source: string; target: string; note?: string }>;
  medical_system_refs: string[];
  cultural_anchors: string[];
  behavior_adaptations: Array<{ source_behavior: string; target_behavior: string }>;
  price_anchor: string;
  non_transferable: string[];
  notes: string;
}

// Existing target-market VOC extracted from the project's avatarRunResult if
// the user has already run an excavation on the target market. Treated as
// ground truth by the API — cultural anchors and verbatims get cross-checked
// against this instead of invented from scratch.
export interface ExistingTargetMarketVoc {
  verbatims?: string[];
  sub_avatar_names?: string[];
}

// LLM-backed plan builder. Translates reverse-engineered pain points,
// desires and mechanism INTO the target language, and produces a native
// SourceDiscoveryPlan (subreddits, forums, hashtags, queries) that actually
// matches what real users write in the target market. Replaces the old
// English-queries + "in italian" suffix hack that returned 0 verbatims.
async function buildLocalizedDiscoveryPlan(
  reverse: ReverseEngineeredFunnel,
  targetLanguage: string,
  targetMarket: string,
): Promise<SourceDiscoveryPlan> {
  const sa = reverse.sub_avatar;
  const seedsEn = {
    pain_points: (sa.pain_points || []).slice(0, 6),
    desires: (sa.desires || []).slice(0, 4),
    mechanism: reverse.mechanism.name,
    niche: reverse.competitor_brand,
  };

  const systemPrompt = `You are a source-discovery strategist. You receive a reverse-engineered avatar whose pain points / desires / mechanism are in ENGLISH. You must produce a SourceDiscoveryPlan that lets scrapers find REAL native-language conversations in ${targetMarket} (${targetLanguage}).

CRITICAL RULES:
- All queries, hashtags, subreddits MUST be written as native ${targetLanguage} speakers would type them — not translations with foreign-language suffixes.
- Use actual local platforms: Italian women don't post on r/menopause, they post on r/Italia, Alfemminile, Donnamoderna, Medicitalia. French users use Doctissimo, Aufeminin. German users use Gofeminin, Onmeda.
- Subreddits: list real target-market subreddits (r/Italia, r/france, r/de, r/mexico, r/brasil, r/japan, etc.) AND niche-relevant ones in the target language when they exist.
- Forums domains: list real target-market forum domains (.it, .fr, .de, .es, native to that market).
- Hashtags in native language.
- Output STRICT JSON only. No prose.`;

  const userMessage = `Source avatar (English seeds — TRANSLATE and ADAPT to ${targetMarket}):
- Pain points: ${seedsEn.pain_points.join(' | ')}
- Desires: ${seedsEn.desires.join(' | ')}
- Mechanism: ${seedsEn.mechanism}
- Niche / competitor: ${seedsEn.niche}

Target market: ${targetMarket}
Target language: ${targetLanguage}
Amazon marketplace: ${amazonMarketplace(targetMarket)}

Build a SourceDiscoveryPlan. For each source, 3-6 queries/subreddits/hashtags in native ${targetLanguage}. Output JSON:
{
  "reddit": { "subreddits": ["r/..."], "queries": ["..."] },
  "amazon": { "product_queries": ["..."], "marketplace": "${amazonMarketplace(targetMarket)}" },
  "youtube": { "video_queries": ["..."] },
  "tiktok": { "hashtags": ["#..."], "search_queries": ["..."] },
  "quora": { "queries": ["..."] },
  "forums": { "domains": ["example.it"], "queries": ["..."] },
  "reviews": { "sites": ["trustpilot.it", "..."], "queries": ["..."] },
  "searchWide": { "queries": ["..."] },
  "shopify": { "store_urls": [], "product_queries": ["..."] },
  "instagram": { "hashtags": ["#..."], "search_queries": ["..."] },
  "facebook": { "page_urls": [], "search_queries": ["..."] }
}`;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        systemPrompt,
        userMessage,
        temperature: 0.4,
        maxTokens: 4096,
        stream: false,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = (data?.content || data?.text || '') as string;
      const parsed = extractJSON<Partial<SourceDiscoveryPlan>>(text);
      if (parsed) return normalizePlan(parsed, targetMarket);
    }
  } catch (e) {
    console.warn('[localize] plan LLM failed, falling back to heuristic plan:', e);
  }

  return fallbackPlan(reverse, targetLanguage, targetMarket);
}

function normalizePlan(p: Partial<SourceDiscoveryPlan>, targetMarket: string): SourceDiscoveryPlan {
  const mp = amazonMarketplace(targetMarket);
  return {
    reddit: { subreddits: p.reddit?.subreddits || [], queries: p.reddit?.queries || [] },
    amazon: { product_queries: p.amazon?.product_queries || [], marketplace: p.amazon?.marketplace || mp },
    youtube: { video_queries: p.youtube?.video_queries || [] },
    tiktok: { hashtags: p.tiktok?.hashtags || [], search_queries: p.tiktok?.search_queries || [] },
    quora: { queries: p.quora?.queries || [] },
    forums: { domains: p.forums?.domains || [], queries: p.forums?.queries || [] },
    reviews: { sites: p.reviews?.sites || [], queries: p.reviews?.queries || [] },
    searchWide: { queries: p.searchWide?.queries || [] },
    shopify: { store_urls: p.shopify?.store_urls || [], product_queries: p.shopify?.product_queries || [] },
    instagram: { hashtags: p.instagram?.hashtags || [], search_queries: p.instagram?.search_queries || [] },
    facebook: { page_urls: p.facebook?.page_urls || [], search_queries: p.facebook?.search_queries || [] },
  };
}

function fallbackPlan(reverse: ReverseEngineeredFunnel, targetLanguage: string, targetMarket: string): SourceDiscoveryPlan {
  const sa = reverse.sub_avatar;
  const seeds = [...(sa.pain_points || []).slice(0, 4), ...(sa.desires || []).slice(0, 2)];
  const langMod = languageModifier(targetLanguage);
  const q = seeds.map(s => `${s} ${targetMarket} ${langMod}`.trim());
  return {
    reddit: { subreddits: [], queries: q },
    amazon: { product_queries: [reverse.competitor_brand], marketplace: amazonMarketplace(targetMarket) },
    youtube: { video_queries: q.slice(0, 4) },
    tiktok: { hashtags: [], search_queries: q.slice(0, 3) },
    quora: { queries: q.slice(0, 4) },
    forums: { domains: [], queries: q },
    reviews: { sites: [], queries: [reverse.competitor_brand] },
    searchWide: { queries: q },
    shopify: { store_urls: [], product_queries: [reverse.competitor_brand] },
    instagram: { hashtags: [], search_queries: q.slice(0, 3) },
    facebook: { page_urls: [], search_queries: q.slice(0, 3) },
  };
}

// Legacy path: 6-8 Tavily queries built literally from English pain points
// + language suffix. Kept as fallback when sourceConfig is not provided.
function buildLocalizationQueries(
  reverse: ReverseEngineeredFunnel,
  targetLanguage: string,
  targetMarket: string,
): string[] {
  const pains = (reverse.sub_avatar.pain_points || []).slice(0, 4);
  const desires = (reverse.sub_avatar.desires || []).slice(0, 2);
  const mech = reverse.mechanism.name || '';

  const langMod = languageModifier(targetLanguage);
  const marketTag = targetMarket ? ` ${targetMarket}` : '';

  const seeds: string[] = [];
  for (const pain of pains) {
    seeds.push(`${pain} forum${marketTag}`);
    seeds.push(`"${pain}" reddit OR forum${marketTag}`);
  }
  for (const desire of desires) {
    seeds.push(`${desire} témoignage OR review${marketTag}`);
  }
  if (mech) seeds.push(`${mech} avis OR testimonial${marketTag}`);

  return seeds
    .map(s => `${s} ${langMod}`.trim())
    .slice(0, 8);
}

// Thin wrapper over /api/avatars/localize — the actual Claude call happens
// server-side so the ANTHROPIC_API_KEY never leaves the edge.
async function extractLocalizedVerbatims(
  reverse: ReverseEngineeredFunnel,
  scrapedContent: string,
  targetLanguage: string,
  targetMarket: string,
  existingVoc: ExistingTargetMarketVoc | null,
): Promise<LocalizedVerbatimBundle> {
  const res = await fetch('/api/avatars/localize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reverse,
      scrapedContent,
      targetLanguage,
      targetMarket,
      existingVoc: existingVoc ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Localize API failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.ok || !data?.bundle) {
    throw new Error(data?.message || 'Localize API returned no bundle');
  }
  return data.bundle as LocalizedVerbatimBundle;
}

function mergeLocalizedIntoSubAvatar(
  base: SubAvatarV2,
  bundle: LocalizedVerbatimBundle,
  targetMarket: string,
  competitorUrl: string,
): SubAvatarV2 {
  const localizedVerbatims: VerbatimQuote[] = bundle.verbatim_quotes.map(quote => ({
    quote,
    source_url: competitorUrl || 'localization://target-market-research',
    source_type: 'searchWide',
    context: `Localized to ${targetMarket}`,
  }));

  const swapLines = bundle.competitor_swaps.map(s =>
    `Competitor swap: ${s.source} → ${s.target}${s.note ? ` (${s.note})` : ''}`,
  );
  const behaviorLines = bundle.behavior_adaptations.map(b =>
    `Behavior: ${b.source_behavior} → ${b.target_behavior}`,
  );
  const fitLine = `Cultural fit: ${bundle.cultural_fit.verdict} (${bundle.cultural_fit.score}/100) — ${bundle.cultural_fit.reason}`;

  return {
    ...base,
    name: bundle.localized_name || base.name,
    nickname: bundle.localized_nickname || base.nickname,
    description: bundle.localized_description || base.description,
    verbatim_quotes: localizedVerbatims,
    emotional_triggers: [
      ...bundle.emotional_triggers,
      ...(base.emotional_triggers || []).slice(0, 3),
    ],
    past_attempts_failures: [
      ...bundle.fears.slice(0, 4),
      ...bundle.objections.slice(0, 3),
      ...base.past_attempts_failures.slice(0, 3),
    ],
    implicit_demographics: [
      ...bundle.localized_demographics,
      ...(bundle.medical_system_refs.length
        ? [`Medical/institutional refs: ${bundle.medical_system_refs.join(', ')}`]
        : []),
      ...(bundle.cultural_anchors.length
        ? [`Cultural anchors (${targetMarket}): ${bundle.cultural_anchors.join(', ')}`]
        : []),
      ...(bundle.price_anchor ? [`Price anchor: ${bundle.price_anchor}`] : []),
      ...swapLines,
      ...behaviorLines,
      fitLine,
      ...(bundle.cultural_fit.recommendation
        ? [`Recommendation: ${bundle.cultural_fit.recommendation}`]
        : []),
      ...(bundle.non_transferable.length
        ? [`Non-transferable: ${bundle.non_transferable.join(' | ')}`]
        : []),
      ...(bundle.notes ? [`Localization notes: ${bundle.notes}`] : []),
    ],
    recommendation_reason:
      `${base.recommendation_reason} Culturally adapted to ${targetMarket} [${bundle.cultural_fit.verdict}, fit ${bundle.cultural_fit.score}/100]. ${bundle.cultural_fit.recommendation}`,
  };
}

export async function localizeReverseEngineered(
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  targetLanguage: string,
  targetMarket: string,
  onProgress?: (p: LocalizationProgress) => void,
  checkpoint?: LocalizationCheckpoint | null,
  onCheckpoint?: (cp: LocalizationCheckpoint) => void | Promise<void>,
  existingVoc?: ExistingTargetMarketVoc | null,
  sourceConfig?: SourceConfig,
  redditDepth?: RedditDepth,
): Promise<AvatarRunResult> {
  const startedAt = Date.now();
  const report = (phase: LocalizationProgress['phase'], message: string, pct: number) => {
    onProgress?.({ phase, message, pct });
  };

  const baseResult = convertReverseEngineeredToAvatarRunResult(reverse, core, startedAt);
  const baseSubAvatar = baseResult.sub_avatars[0];
  if (!baseSubAvatar) throw new Error('Reverse conversion produced no sub-avatar');

  // Checkpoint is only valid for the exact same (brand, language, market) triple.
  const resumable =
    checkpoint &&
    checkpoint.competitorBrand === reverse.competitor_brand &&
    checkpoint.targetLanguage === targetLanguage &&
    checkpoint.targetMarket === targetMarket
      ? checkpoint
      : null;

  const saveCp = async (partial: Omit<LocalizationCheckpoint, 'competitorBrand' | 'targetLanguage' | 'targetMarket' | 'updatedAt'>) => {
    const cp: LocalizationCheckpoint = {
      competitorBrand: reverse.competitor_brand,
      targetLanguage,
      targetMarket,
      updatedAt: new Date().toISOString(),
      ...resumable,
      ...partial,
    };
    try { await onCheckpoint?.(cp); } catch { /* best-effort */ }
  };

  // === MULTI-SOURCE PATH ===
  // When sourceConfig is provided we run the full excavator suite (Reddit,
  // Amazon, YouTube, TikTok, Quora, Forums, Reviews, Wide Web, Shopify, IG,
  // FB) against the target market with native-language queries.
  const useMultiSource = Boolean(sourceConfig) && Object.values(sourceConfig || {}).some(Boolean);

  let queries: string[];
  let snippets: string[] = [];
  let uniqueUrls: string[] = [];
  let scrapedContent: string;

  if (useMultiSource) {
    if (resumable?.scrapedContent && resumable.phase === 'extract') {
      scrapedContent = resumable.scrapedContent;
      queries = resumable.queries || [];
      uniqueUrls = resumable.uniqueUrls || [];
    } else {
      report('queries', `Translating seeds + building ${targetMarket} discovery plan...`, 10);
      const plan = await buildLocalizedDiscoveryPlan(reverse, targetLanguage, targetMarket);
      queries = [
        ...plan.searchWide.queries,
        ...plan.reddit.queries,
        ...plan.forums.queries,
      ];
      await saveCp({ phase: 'queries', queries });

      report('search', `Running excavators across ${targetMarket}...`, 25);
      const fetchResult = await runSourceFetchers({
        plan,
        config: sourceConfig!,
        language: targetLanguage,
        market: targetMarket,
        redditDepth: redditDepth ?? 'deep',
        onProgress: (ev) => {
          if (ev.message) {
            onProgress?.({ phase: 'search', message: ev.message, pct: 25 + (ev.progress ?? 0) * 30 });
          }
        },
      });

      // Flatten items into a rich scrapedContent block — one section per
      // source, each item with title + content + comments (truncated).
      const sections: string[] = [];
      const urlSet = new Set<string>();
      let totalItems = 0;
      for (const src of Object.keys(fetchResult.data) as SourceType[]) {
        const bucket = fetchResult.data[src];
        if (!bucket || bucket.items.length === 0) continue;
        const lines: string[] = [`### SOURCE: ${src} (${bucket.itemCount} items)`];
        for (const item of bucket.items.slice(0, 20)) {
          if (item.url) urlSet.add(item.url);
          const block = [
            item.title ? `[${item.title}]` : '',
            item.content?.slice(0, 3000) || '',
            item.comments?.length ? `COMMENTS: ${item.comments.slice(0, 10).join(' | ').slice(0, 2000)}` : '',
          ].filter(Boolean).join('\n');
          lines.push(`--- ${item.url || 'no-url'} ---\n${block}`);
          totalItems++;
        }
        sections.push(lines.join('\n'));
      }
      uniqueUrls = Array.from(urlSet).slice(0, 60);
      snippets = [`Multi-source scrape: ${totalItems} items across ${Object.keys(fetchResult.data).length} sources in ${fetchResult.totalDurationMs}ms`];
      scrapedContent = sections.join('\n\n').trim() || snippets.join('\n');

      report('scrape', `Scraped ${totalItems} native ${targetMarket} items from ${Object.keys(fetchResult.data).length} sources`, 55);
      await saveCp({ phase: 'scrape', queries, snippets, uniqueUrls, scrapedContent });
    }
  } else {
    // === LEGACY TAVILY-ONLY PATH === (backward compat when no sourceConfig)
    if (resumable?.queries && resumable.phase !== 'queries') {
      queries = resumable.queries;
    } else {
      report('queries', `Building ${targetLanguage} search queries...`, 10);
      queries = buildLocalizationQueries(reverse, targetLanguage, targetMarket);
      await saveCp({ phase: 'queries', queries });
    }

    if (resumable?.snippets && resumable.uniqueUrls &&
        (resumable.phase === 'scrape' || resumable.phase === 'extract')) {
      snippets = resumable.snippets;
      uniqueUrls = resumable.uniqueUrls;
    } else {
      report('search', `Searching ${targetMarket} web...`, 25);
      const searchResults = await Promise.all(queries.map(q => webSearch(q, { maxResults: 8 })));
      const urlSet = new Set<string>();
      snippets = [];
      for (const sr of searchResults) {
        if (!sr) continue;
        if (sr.answer) snippets.push(sr.answer);
        for (const r of sr.results) {
          if (/amazon\.[a-z.]+\/(dp|gp\/product)/.test(r.url)) continue;
          urlSet.add(r.url);
          snippets.push(`[${r.title}] ${r.content}`);
        }
      }
      uniqueUrls = Array.from(urlSet).slice(0, 12);
      await saveCp({ phase: 'search', queries, snippets, uniqueUrls });
    }

    if (resumable?.scrapedContent && resumable.phase === 'extract') {
      scrapedContent = resumable.scrapedContent;
    } else {
      report('scrape', `Scraping ${uniqueUrls.length} ${targetMarket} pages...`, 50);
      let scraped: Array<{ url: string; markdown: string }> = [];
      try {
        scraped = await scrapeMany(uniqueUrls, 4);
      } catch (e) {
        console.warn('[localize] scrapeMany failed, continuing with snippets only:', e);
      }
      scrapedContent = [
        snippets.join('\n---\n'),
        ...scraped.map(p => `=== ${p.url} ===\n${p.markdown.slice(0, 8000)}`),
      ].join('\n\n').trim();
      await saveCp({ phase: 'scrape', queries, snippets, uniqueUrls, scrapedContent });
    }
  }

  let bundle: LocalizedVerbatimBundle;
  if (resumable?.bundle && resumable.phase === 'done') {
    bundle = resumable.bundle;
  } else {
    report('extract', 'Extracting localized verbatims with Claude...', 80);
    bundle = await extractLocalizedVerbatims(
      reverse,
      scrapedContent,
      targetLanguage,
      targetMarket,
      existingVoc ?? null,
    );
    await saveCp({ phase: 'done', queries, snippets, uniqueUrls, scrapedContent, bundle });
  }

  const localizedSubAvatar = mergeLocalizedIntoSubAvatar(
    baseSubAvatar,
    bundle,
    targetMarket,
    reverse.competitor_url || '',
  );

  const now = Date.now();
  report('done', `Localization complete — ${bundle.verbatim_quotes.length} native verbatims`, 100);

  return {
    ...baseResult,
    sub_avatars: [localizedSubAvatar],
    comparative_table: [
      {
        sub_avatar_id: localizedSubAvatar.id,
        nickname: localizedSubAvatar.nickname,
        tam: localizedSubAvatar.tam_estimate,
        urgency: localizedSubAvatar.urgency_score,
        scope: localizedSubAvatar.scope_score,
        staying_power: localizedSubAvatar.staying_power_score,
        recommended: true,
      },
    ],
    metadata: {
      ...baseResult.metadata,
      run_duration_ms: now - startedAt,
      total_verbatims: bundle.verbatim_quotes.length,
      total_items_scraped: uniqueUrls.length,
      phase_timings: {
        discovery_ms: 0,
        fetch_ms: 0,
        analyze_ms: now - startedAt,
        compile_ms: 0,
      },
    },
  };
}
