'use client';

// ============================================================
// Gate 1 — Avatar Excavation UI
//
// Replaces the generic GateView for Gate 1.
// Form: Core Avatar input (surface_desire, niche, product, language, market)
// + per-source toggles + Run button
// + live progress
// + full result visualization (sub-avatars, comparative table, recommendation)
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, GateOutput, ShopifyProductData, ShopifyVariant, ShopifyImage, ShopifyReviewData } from '@/lib/types';
import { saveProject, saveGateOutput } from '@/lib/store/db';
import { unlockNextGate } from '@/lib/store/project-utils';
import {
  CoreAvatarInput,
  SourceConfig,
  DEFAULT_SOURCE_CONFIG,
  SOURCE_LABELS,
  SourceType,
  AvatarRunResult,
  AvatarProgressEvent,
  SubAvatarV2,
  AwarenessLevel,
  AwarenessVariant,
  DeepDiveResult,
  AWARENESS_LEVELS,
  RawSignal,
} from '@/lib/avatars/types';
import {
  generateAwarenessVariant,
  generateDeepDive,
  appendAwarenessVariant,
  appendDeepDive,
  AWARENESS_LABEL,
  AWARENESS_DESCRIPTION,
} from '@/lib/avatars/enrich';
import { runAvatarExcavation } from '@/lib/avatars/runAvatarExcavation';
import { convertReverseEngineeredToAvatarRunResult } from '@/lib/avatars/fromReverseEngineered';
import { enrichReverseEngineeredRun } from '@/lib/avatars/reverseEnrichment';
import {
  localizeReverseEngineered,
  type LocalizationProgress,
} from '@/lib/avatars/localizeReverseEngineered';
import { REDDIT_DEPTH_PRESETS, RedditDepth } from '@/lib/sources/reddit';
import RawSignalView from './RawSignalView';
import SourcesView from './SourcesView';
import { TranslateCtx, InlineTranslate } from '@/components/ui/TranslateToggle';

interface Gate1AvatarExcavationProps {
  project: Project;
  onProjectChange: (project: Project) => void;
  onLoadDemo?: () => void;
}

const SOURCE_ORDER: SourceType[] = [
  'reddit',
  'amazon',
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'quora',
  'forums',
  'reviews',
  'searchWide',
  'shopify',
];

function defaultCoreFromProject(project: Project): CoreAvatarInput {
  return (
    project.coreAvatarInput ?? {
      surface_desire: '',
      niche: project.niche ?? '',
      product: project.productDescription ?? project.name ?? '',
      language: project.targetLanguage ?? 'en-US',
      market: project.targetMarket ?? 'US',
      notes: '',
    }
  );
}

export default function Gate1AvatarExcavation({
  project,
  onProjectChange,
  onLoadDemo,
}: Gate1AvatarExcavationProps) {
  const router = useRouter();
  const [core, setCore] = useState<CoreAvatarInput>(() => defaultCoreFromProject(project));
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(
    () => project.avatarSourceConfig ?? DEFAULT_SOURCE_CONFIG,
  );
  const [redditDepth, setRedditDepth] = useState<RedditDepth>('deep');
  const [isRunning, setIsRunning] = useState(false);
  const [progressEvents, setProgressEvents] = useState<AvatarProgressEvent[]>([]);
  const [result, setResult] = useState<AvatarRunResult | null>(project.avatarRunResult ?? null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubAvatar, setExpandedSubAvatar] = useState<string | null>(null);
  const [selectedSubAvatarId, setSelectedSubAvatarId] = useState<string | null>(
    project.selectedSubAvatarId ?? null,
  );
  const [resultTab, setResultTab] = useState<'sub-avatars' | 'raw-signal' | 'sources'>('sub-avatars');
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [shopifyImporting, setShopifyImporting] = useState(false);
  const [shopifyStatus, setShopifyStatus] = useState<string | null>(null);

  const isApproved = project.gateStatuses.gate1 === 'approved';

  // Auto-select the recommended sub-avatar as soon as a result is available
  // and no explicit selection has been made yet.
  useEffect(() => {
    if (result && !selectedSubAvatarId) {
      const recommended = result.sub_avatars.find(sa => sa.recommended_for_test);
      const fallback = result.sub_avatars[0];
      const defaultPick = recommended?.id ?? fallback?.id ?? null;
      if (defaultPick) setSelectedSubAvatarId(defaultPick);
    }
  }, [result, selectedSubAvatarId]);

  const handleSelectSubAvatar = useCallback(
    async (id: string) => {
      setSelectedSubAvatarId(id);
      // Persist immediately so navigating away keeps the choice.
      const updatedProject: Project = {
        ...project,
        selectedSubAvatarId: id,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updatedProject);
      onProjectChange(updatedProject);
    },
    [project, onProjectChange],
  );

  // Replace ONE sub-avatar in the current run result, immutably, and persist.
  // Used by the awareness-filter chips and the "approfondis encore +" button
  // to append variants / dives without destroying prior data.
  const handleUpdateSubAvatar = useCallback(
    async (updated: SubAvatarV2) => {
      if (!result) return;
      const nextSubAvatars = result.sub_avatars.map((sa) =>
        sa.id === updated.id ? updated : sa,
      );
      const nextResult: AvatarRunResult = {
        ...result,
        sub_avatars: nextSubAvatars,
      };
      setResult(nextResult);
      const updatedProject: Project = {
        ...project,
        avatarRunResult: nextResult,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updatedProject);
      onProjectChange(updatedProject);
    },
    [result, project, onProjectChange],
  );

  // Persist golden-nugget picks from the Raw Signal view. Non-destructive —
  // only updates `raw_signal` on the current result. The raw corpus, n-grams
  // and emotion hits are never mutated here; only `raw_signal.picks`.
  const handleRawSignalChange = useCallback(
    async (next: RawSignal) => {
      if (!result) return;
      const nextResult: AvatarRunResult = {
        ...result,
        raw_signal: next,
      };
      setResult(nextResult);
      const updatedProject: Project = {
        ...project,
        avatarRunResult: nextResult,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updatedProject);
      onProjectChange(updatedProject);
    },
    [result, project, onProjectChange],
  );

  const handleShopifyImport = useCallback(async () => {
    if (!shopifyUrl.trim()) return;
    setShopifyImporting(true);
    setShopifyStatus('Detecting Shopify store...');
    try {
      // Step 1: Detect if it's Shopify
      const detectRes = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'detect', url: shopifyUrl.trim() }),
      });
      const detect = await detectRes.json();
      if (!detect.isShopify) {
        setShopifyStatus('Not a Shopify store — try pasting a .myshopify.com or /products/ URL');
        setShopifyImporting(false);
        return;
      }

      // Step 2: Fetch product data
      setShopifyStatus('Fetching product data...');
      const productRes = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'product', url: shopifyUrl.trim() }),
      });
      const data = await productRes.json();

      if (data.product) {
        const p = data.product;
        const reviews: ShopifyReviewData[] = (data.reviews ?? []).map((r: ShopifyReviewData) => ({
          author: r.author,
          rating: r.rating,
          title: r.title,
          body: r.body,
          date: r.date,
        }));

        // Infer currency from price string or store domain
        const currency = shopifyUrl.includes('.fr') || shopifyUrl.includes('.de') || shopifyUrl.includes('.es') ? 'EUR'
          : shopifyUrl.includes('.co.uk') ? 'GBP'
          : shopifyUrl.includes('.ca') ? 'CAD'
          : 'USD';

        // Infer price position
        const priceNum = parseFloat(p.price ?? '0');
        const pricePosition = priceNum > 100 ? 'premium' as const
          : priceNum > 30 ? 'mid' as const
          : 'budget' as const;

        // Compute review stats
        const reviewStats = reviews.length > 0 ? {
          averageRating: Math.round((reviews.reduce((acc: number, r: ShopifyReviewData) => acc + r.rating, 0) / reviews.length) * 10) / 10,
          totalReviews: reviews.length,
          ratingDistribution: reviews.reduce((acc: Record<number, number>, r: ShopifyReviewData) => {
            acc[r.rating] = (acc[r.rating] || 0) + 1;
            return acc;
          }, {} as Record<number, number>),
        } : undefined;

        // Build full structured data
        const shopifyData: ShopifyProductData = {
          storeUrl: detect.domain,
          productUrl: shopifyUrl.trim(),
          productTitle: p.title,
          productDescription: p.description ?? '',
          productDescriptionHtml: p.descriptionHtml,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          currency,
          pricePosition,
          vendor: p.vendor ?? '',
          productType: p.productType ?? '',
          tags: p.tags ?? [],
          variants: (p.variants ?? []).map((v: ShopifyVariant) => ({
            title: v.title,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            sku: v.sku,
            available: v.available,
          })),
          images: (p.images ?? []).map((img: ShopifyImage) => ({
            src: img.src,
            alt: img.alt,
          })),
          reviews,
          reviewStats,
          importedAt: new Date().toISOString(),
          shopifyProductId: p.id,
        };

        // Auto-fill form fields
        const productText = `${p.title}${p.description ? ' — ' + p.description.slice(0, 200) : ''}`;
        setCore(prev => ({
          ...prev,
          product: productText,
          niche: prev.niche || p.productType || '',
        }));

        // Save full structured data on project
        const updatedProject: Project = {
          ...project,
          productUrl: shopifyUrl.trim(),
          productDescription: productText,
          niche: project.niche || p.productType || '',
          shopifyData,
          updatedAt: new Date().toISOString(),
        };
        await saveProject(updatedProject);
        onProjectChange(updatedProject);

        const reviewCount = reviews.length;
        setShopifyStatus(
          `Imported: ${p.title} (${p.variants?.length ?? 0} variants, ${currency === 'EUR' ? '€' : '$'}${p.price ?? '?'})${reviewCount > 0 ? ` + ${reviewCount} reviews (avg ${reviewStats?.averageRating ?? '?'}/5)` : ''} — data flows into ALL gates`
        );
      } else if (data.products?.length > 0) {
        setShopifyStatus(`Found ${data.products.length} products in store catalog. Paste a specific product URL for auto-fill.`);
      } else {
        setShopifyStatus('Could not fetch product data from this URL.');
      }
    } catch (err) {
      setShopifyStatus(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setShopifyImporting(false);
    }
  }, [shopifyUrl, project, onProjectChange]);

  const handleApprove = useCallback(async () => {
    if (!result || !selectedSubAvatarId) return;
    const updatedProject = unlockNextGate(
      {
        ...project,
        selectedSubAvatarId,
        gateStatuses: { ...project.gateStatuses, gate1: 'approved' },
      },
      'gate1',
    );
    await saveProject(updatedProject);
    onProjectChange(updatedProject);
    router.push(`/project/${project.id}/gate/gate2`);
  }, [project, result, selectedSubAvatarId, onProjectChange, router]);

  useEffect(() => {
    if (project.avatarRunResult) setResult(project.avatarRunResult);
  }, [project.avatarRunResult]);

  const updateField = <K extends keyof CoreAvatarInput>(key: K, value: CoreAvatarInput[K]) => {
    setCore(prev => ({ ...prev, [key]: value }));
  };

  const toggleSource = (source: SourceType) => {
    setSourceConfig(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const canRun =
    core.surface_desire.trim().length > 0 &&
    core.niche.trim().length > 0 &&
    core.product.trim().length > 0 &&
    Object.values(sourceConfig).some(Boolean) &&
    !isRunning;

  // If the user reverse-engineered a competitor funnel and injected the
  // result into the Project, give them a one-click path to turn it into
  // a real SubAvatarV2 and skip the long multi-source excavation. This
  // treats the competitor's already-converting avatar as the ground truth.
  const reverseEngineeredRaw = project.competitorIntel?.reverseEngineered;
  const handleUseReverseEngineered = useCallback(async () => {
    if (!reverseEngineeredRaw) return;
    setError(null);
    setIsRunning(true);
    try {
      const startedAt = Date.now();
      const baseConverted = convertReverseEngineeredToAvatarRunResult(
        reverseEngineeredRaw,
        core,
        startedAt,
      );

      // Level 1: run the Opus enrichment pass immediately so the
      // reverse-engineered avatar ships with 3-5 angles, sensory triggers,
      // structured past attempts, buying behavior, localized demographics,
      // narrator persona and scored hooks — not the bare shape transform.
      const targetLanguage = project.targetLanguage || core.language || 'en-US';
      const targetMarket = project.targetMarket || core.market || 'Global';
      let converted = baseConverted;
      try {
        setProgressEvents([
          { phase: 'analyzing', message: `Enriching reverse-engineered avatar for ${targetMarket}...`, progress: 0.5 },
        ]);
        converted = await enrichReverseEngineeredRun(
          baseConverted,
          reverseEngineeredRaw,
          core,
          targetLanguage,
          targetMarket,
        );
      } catch (enrichErr) {
        console.warn('[Gate1] reverse enrichment failed, using base shape transform:', enrichErr);
      }

      setResult(converted);
      setSelectedSubAvatarId(converted.sub_avatars[0]?.id ?? null);

      const updatedProject: Project = {
        ...project,
        coreAvatarInput: core,
        avatarRunResult: converted,
        selectedSubAvatarId: converted.sub_avatars[0]?.id ?? null,
        gateStatuses: { ...project.gateStatuses, gate1: 'pending_review' },
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updatedProject);
      onProjectChange(updatedProject);

      const now = new Date().toISOString();
      const gateOutput: GateOutput = {
        gateId: 'gate1',
        projectId: project.id,
        status: 'pending_decisions',
        data: converted as unknown as Record<string, unknown>,
        generationLog: [
          {
            timestamp: now,
            agent: 'lead',
            model: 'reverse-engineered-conversion',
            iteration: 1,
            input_summary: `Reverse-engineered from competitor intel (injected ${reverseEngineeredRaw.injected_at})`,
            output_summary: `1 sub-avatar inflated from competitor funnel, ${converted.sub_avatars[0]?.verbatim_quotes.length ?? 0} verbatims`,
            tokens_used: { input: 0, output: 0 },
          },
        ],
        reviewResult: null,
        congruenceResult: null,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveGateOutput(gateOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [reverseEngineeredRaw, core, project, onProjectChange]);

  // Localize flavor of the same flow. Keeps the angles/mechanism from the
  // reverse funnel but refreshes verbatims, emotional triggers and cultural
  // anchors by running a targeted Tavily+scrape pass in the target market.
  // Used when the original funnel was scraped from a different country.
  const handleLocalizeReverseEngineered = useCallback(async () => {
    if (!reverseEngineeredRaw) return;
    setError(null);
    setIsRunning(true);
    setProgressEvents([]);
    try {
      const targetLanguage = project.targetLanguage || core.language || 'en-US';
      const targetMarket = project.targetMarket || core.market || 'Global';
      const localized = await localizeReverseEngineered(
        reverseEngineeredRaw,
        core,
        targetLanguage,
        targetMarket,
        (p: LocalizationProgress) => {
          // Map LocalizationProgress phases → AvatarProgressPhase so we can
          // reuse the existing progress UI. Localize only goes through fetch
          // and analyze conceptually, so we collapse accordingly.
          const phase =
            p.phase === 'done'
              ? 'done'
              : p.phase === 'extract'
                ? 'analyzing'
                : 'fetching';
          setProgressEvents(prev => [
            ...prev,
            { phase, message: p.message, progress: p.pct / 100 },
          ]);
        },
      );

      // Level 1: enrichment pass on the localized result. We keep the
      // localized verbatims/triggers and stack angles/sensory/structured
      // past attempts/buying behavior/demographics on top.
      let converted = localized;
      try {
        setProgressEvents(prev => [
          ...prev,
          { phase: 'analyzing', message: 'Enriching with angles, triggers, buying behavior...', progress: 0.95 },
        ]);
        converted = await enrichReverseEngineeredRun(
          localized,
          reverseEngineeredRaw,
          core,
          targetLanguage,
          targetMarket,
        );
      } catch (enrichErr) {
        console.warn('[Gate1] reverse enrichment failed, keeping localized base:', enrichErr);
      }

      setResult(converted);
      setSelectedSubAvatarId(converted.sub_avatars[0]?.id ?? null);

      const updatedProject: Project = {
        ...project,
        coreAvatarInput: core,
        avatarRunResult: converted,
        selectedSubAvatarId: converted.sub_avatars[0]?.id ?? null,
        gateStatuses: { ...project.gateStatuses, gate1: 'pending_review' },
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updatedProject);
      onProjectChange(updatedProject);

      const now = new Date().toISOString();
      const gateOutput: GateOutput = {
        gateId: 'gate1',
        projectId: project.id,
        status: 'pending_decisions',
        data: converted as unknown as Record<string, unknown>,
        generationLog: [
          {
            timestamp: now,
            agent: 'lead',
            model: 'reverse-engineered-localization',
            iteration: 1,
            input_summary: `Localized reverse-engineered funnel from ${reverseEngineeredRaw.competitor_brand} → ${targetMarket} (${targetLanguage})`,
            output_summary: `1 localized sub-avatar, ${converted.sub_avatars[0]?.verbatim_quotes.length ?? 0} native verbatims`,
            tokens_used: { input: 0, output: 0 },
          },
        ],
        reviewResult: null,
        congruenceResult: null,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveGateOutput(gateOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [reverseEngineeredRaw, core, project, onProjectChange]);

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setIsRunning(true);
    setError(null);
    setProgressEvents([]);
    setResult(null);

    // Level 2: if a reverse-engineered funnel is sitting on the project,
    // seed the discovery phase with it. Marcus uses it to sharpen the hunt,
    // but the pipeline still mines real third-party voices in the target
    // market — so we get evidence-backed sub-avatars instead of a synthetic
    // shape transform.
    const runResult = await runAvatarExcavation({
      core,
      config: sourceConfig,
      redditDepth,
      reverseSeeds: reverseEngineeredRaw ?? null,
      onProgress: (event) => {
        setProgressEvents(prev => [...prev, event]);
      },
    });

    if (runResult.error || !runResult.result) {
      setError(runResult.error ?? 'Unknown error');
      setIsRunning(false);
      return;
    }

    setResult(runResult.result);

    // Persist into project
    const updatedProject: Project = {
      ...project,
      coreAvatarInput: core,
      avatarSourceConfig: sourceConfig,
      avatarRunResult: runResult.result,
      gateStatuses: { ...project.gateStatuses, gate1: 'pending_review' },
      updatedAt: new Date().toISOString(),
    };
    await saveProject(updatedProject);
    onProjectChange(updatedProject);

    // Also persist as a GateOutput so the rest of the pipeline (Brand DNA
    // compile, getAllGateOutputs, downstream gates) finds Gate 1 the same
    // way it finds every other gate. The full AvatarRunResult goes into data.
    const now = new Date().toISOString();
    const gateOutput: GateOutput = {
      gateId: 'gate1',
      projectId: project.id,
      status: 'pending_decisions',
      data: runResult.result as unknown as Record<string, unknown>,
      generationLog: [
        {
          timestamp: now,
          agent: 'lead',
          model: 'avatar-excavation-pipeline',
          iteration: 1,
          input_summary: `Core avatar: ${core.surface_desire} / ${core.niche} / ${core.market}`,
          output_summary: `${runResult.result.sub_avatars.length} sub-avatars, ${runResult.result.metadata.total_verbatims} verbatims, ${runResult.result.metadata.total_items_scraped} items scraped`,
          tokens_used: runResult.totalTokens,
        },
      ],
      reviewResult: null,
      congruenceResult: null,
      humanDecisions: {},
      checkpoint: null,
      createdAt: now,
      updatedAt: now,
    };
    await saveGateOutput(gateOutput);

    setIsRunning(false);
  }, [canRun, core, sourceConfig, redditDepth, reverseEngineeredRaw, project, onProjectChange]);

  return (
    <TranslateCtx.Provider value={project.targetLanguage ?? null}>
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gate 1 — Avatar Excavation</h1>
          <p className="text-sm text-text-muted mt-1">
            Multi-source deep mining from a human-provided Core Avatar. Marcus plans, scrapes,
            analyzes and clusters verbatims into sub-avatars with 3 angles each.
          </p>
        </div>

        {/* Reverse-engineered shortcut. When the user already pulled a
            competitor funnel via /competitor-intel → Reverse Engineer →
            "Inject Sub-Avatar", we promote that into a real SubAvatarV2
            here instead of forcing a second multi-hour excavation run.
            Hidden once avatarRunResult exists so it doesn't overwrite
            real research on re-visit. */}
        {reverseEngineeredRaw && !result && !project.avatarRunResult && (
          <section className="p-5 bg-bg-card border border-accent-orange/50 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="text-2xl leading-none">⚡</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-accent-orange uppercase tracking-wide">
                    Reverse-engineered avatar ready
                  </h3>
                  <span className="text-[10px] text-text-muted">
                    from {reverseEngineeredRaw.competitor_brand || 'competitor'}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed mb-3">
                  You injected a competitor&apos;s funnel in Competitor Intel
                  ({new Date(reverseEngineeredRaw.injected_at).toLocaleDateString()}).
                  Use it directly as your sub-avatar — skip the full multi-source
                  excavation. Downstream gates (2-9) will treat it exactly like a
                  freshly-mined avatar, so you can iterate fast on copy, hooks,
                  and creatives before (or without) running deep research.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseReverseEngineered}
                    disabled={isRunning}
                    className="px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50"
                  >
                    {isRunning ? 'Working...' : 'Use as sub-avatar →'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalizeReverseEngineered}
                    disabled={isRunning}
                    className="px-4 py-2 bg-bg-primary border border-accent-orange/60 text-accent-orange text-sm font-semibold rounded-lg hover:bg-accent-orange/10 disabled:opacity-50"
                    title={`Refresh verbatims, emotional triggers and cultural anchors for ${project.targetMarket || 'your market'} — keeps the angle/mechanism intact.`}
                  >
                    Localize to {project.targetMarket || 'my market'} ⚡
                  </button>
                  <span className="text-[10px] text-text-muted">
                    or run the full excavation below for deeper verbatims
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* INPUT FORM */}
        <section className="p-6 bg-bg-card border border-border rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Core Avatar Input</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Surface desire *"
              value={core.surface_desire}
              placeholder="ex: wants restorative sleep"
              onChange={v => updateField('surface_desire', v)}
            />
            <Field
              label="Niche *"
              value={core.niche}
              placeholder="ex: sleep, skincare 40+, dog health"
              onChange={v => updateField('niche', v)}
            />
            <Field
              label="Product *"
              value={core.product}
              placeholder="name + short description"
              onChange={v => updateField('product', v)}
            />
            <Field
              label="Language"
              value={core.language}
              placeholder="fr-FR, es-ES, en-US..."
              onChange={v => updateField('language', v)}
            />
            <Field
              label="Market"
              value={core.market}
              placeholder="France, Spain, US..."
              onChange={v => updateField('market', v)}
            />
          </div>

          {/* Shopify Auto-Import */}
          <div className="p-4 bg-bg-primary border border-border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">Shopify Auto-Import</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-accent-teal/20 text-accent-teal rounded">NEW</span>
            </div>
            <p className="text-[11px] text-text-muted">
              Paste a Shopify product URL to auto-fill product name, description, niche + pull reviews for excavation.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={shopifyUrl}
                onChange={e => setShopifyUrl(e.target.value)}
                placeholder="https://store.myshopify.com/products/your-product"
                className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal"
              />
              <button
                type="button"
                onClick={handleShopifyImport}
                disabled={shopifyImporting || !shopifyUrl.trim()}
                className="px-4 py-2 bg-accent-teal text-white font-medium rounded-lg text-sm hover:bg-accent-teal-hover disabled:opacity-50 whitespace-nowrap"
              >
                {shopifyImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
            {shopifyStatus && (
              <p className={`text-xs ${shopifyStatus.includes('Imported') ? 'text-success' : shopifyStatus.includes('failed') || shopifyStatus.includes('Not a') ? 'text-error' : 'text-text-muted'}`}>
                {shopifyStatus}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Notes (optional)</label>
            <textarea
              value={core.notes ?? ''}
              onChange={e => updateField('notes', e.target.value)}
              rows={2}
              placeholder="Any extra context Marcus should keep in mind..."
              className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-teal resize-y"
            />
          </div>
        </section>

        {/* SOURCE TOGGLES */}
        <section className="p-6 bg-bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Source Excavators</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSourceConfig(DEFAULT_SOURCE_CONFIG)}
                className="text-xs px-2 py-1 border border-border rounded text-text-muted hover:text-text-primary"
              >
                All on
              </button>
              <button
                onClick={() =>
                  setSourceConfig({
                    reddit: false,
                    amazon: false,
                    youtube: false,
                    tiktok: false,
                    quora: false,
                    forums: false,
                    reviews: false,
                    searchWide: false,
                    shopify: false,
                    instagram: false,
                    facebook: false,
                  })
                }
                className="text-xs px-2 py-1 border border-border rounded text-text-muted hover:text-text-primary"
              >
                All off
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SOURCE_ORDER.map(source => (
              <label
                key={source}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm ${
                  sourceConfig[source]
                    ? 'border-accent-teal bg-accent-teal/10 text-text-primary'
                    : 'border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sourceConfig[source]}
                  onChange={() => toggleSource(source)}
                  className="accent-accent-teal"
                />
                {SOURCE_LABELS[source]}
              </label>
            ))}
          </div>

          {/* REDDIT DEPTH PRESET */}
          {sourceConfig.reddit && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Reddit depth</h3>
                <span className="text-[11px] text-text-muted">
                  More subs = more verbatims, longer run
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'deep', 'maximum'] as RedditDepth[]).map(depth => {
                  const preset = REDDIT_DEPTH_PRESETS[depth];
                  const active = redditDepth === depth;
                  return (
                    <button
                      key={depth}
                      onClick={() => setRedditDepth(depth)}
                      className={`text-left px-3 py-2 border rounded-lg text-xs transition ${
                        active
                          ? 'border-accent-orange bg-accent-orange/10 text-text-primary'
                          : 'border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <div className="font-semibold">{preset.label}</div>
                      <div className="text-[10px] opacity-80">{preset.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RUN BUTTON */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="px-6 py-3 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Running Avatar Excavation...' : 'Run Avatar Excavation'}
          </button>
          {!result && !isRunning && onLoadDemo && (
            <button
              onClick={onLoadDemo}
              className="px-6 py-3 bg-bg-card border border-accent-orange/50 text-accent-orange font-semibold rounded-lg hover:bg-accent-orange/10"
            >
              Demo (preview UI)
            </button>
          )}
          {result && !isRunning && (
            <button
              onClick={handleRun}
              className="px-4 py-3 border border-border text-text-secondary rounded-lg hover:text-text-primary"
            >
              Re-run
            </button>
          )}
        </div>

        {/* PROGRESS */}
        {(isRunning || progressEvents.length > 0) && (
          <MoneyFlightProgress events={progressEvents} isRunning={isRunning} />
        )}

        {/* ERROR */}
        {error && (
          <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* RESULT */}
        {result && (
          <>
            {/* Tab switcher — Sub-Avatars (LLM-compiled) vs Raw Signal (verbatim corpus + n-grams) */}
            <div className="flex items-center gap-2 border-b border-border">
              <button
                type="button"
                onClick={() => setResultTab('sub-avatars')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                  resultTab === 'sub-avatars'
                    ? 'border-accent-teal text-accent-teal'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                Sub-Avatars ({result.sub_avatars.length})
              </button>
              <button
                type="button"
                onClick={() => setResultTab('raw-signal')}
                disabled={!result.raw_signal}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                  resultTab === 'raw-signal'
                    ? 'border-accent-orange text-accent-orange'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={
                  result.raw_signal
                    ? 'Preserved verbatim corpus + n-grams + emotion markers'
                    : 'Raw signal not available for this run — re-run to compute it'
                }
              >
                ★ Raw Signal
                {result.raw_signal && (
                  <span className="ml-1.5 text-[10px] font-normal text-text-muted">
                    ({result.raw_signal.total_items} verbatims
                    {(() => {
                      const p = result.raw_signal.picks;
                      const picked =
                        (p?.phrases.length ?? 0) +
                        (p?.verbatims.length ?? 0) +
                        (p?.emotion_markers.length ?? 0);
                      return picked > 0 ? ` · ${picked} picked` : '';
                    })()}
                    )
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setResultTab('sources')}
                disabled={!result.raw_signal}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                  resultTab === 'sources'
                    ? 'border-accent-teal text-accent-teal'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={
                  result.raw_signal
                    ? 'Per-platform source breakdown — see what was scraped from where'
                    : 'Raw signal not available for this run — re-run to see sources'
                }
              >
                📊 Sources
                {result.raw_signal && (
                  <span className="ml-1.5 text-[10px] font-normal text-text-muted">
                    ({Object.keys(result.raw_signal.source_breakdown || {}).length} platforms)
                  </span>
                )}
              </button>
            </div>

            {resultTab === 'sub-avatars' && (
              <ResultView
                result={result}
                core={core}
                expanded={expandedSubAvatar}
                onExpand={setExpandedSubAvatar}
                selectedSubAvatarId={selectedSubAvatarId}
                onSelect={handleSelectSubAvatar}
                onUpdateSubAvatar={handleUpdateSubAvatar}
                onRunFullExcavation={handleRun}
                canRunFullExcavation={canRun && !isRunning}
              />
            )}

            {resultTab === 'raw-signal' && result.raw_signal && (
              <RawSignalView
                signal={result.raw_signal}
                onChange={handleRawSignalChange}
              />
            )}

            {resultTab === 'raw-signal' && !result.raw_signal && (
              <div className="p-6 bg-bg-card border border-border rounded-xl text-sm text-text-muted italic">
                This avatar run was produced before the Raw Signal module existed.
                Re-run the excavation to generate the verbatim corpus + n-gram tables.
              </div>
            )}

            {resultTab === 'sources' && result.raw_signal && (
              <SourcesView signal={result.raw_signal} />
            )}

            {resultTab === 'sources' && !result.raw_signal && (
              <div className="p-6 bg-bg-card border border-border rounded-xl text-sm text-text-muted italic">
                Source breakdown needs raw signal data. Re-run the excavation to populate it.
              </div>
            )}
          </>
        )}

        {/* APPROVE & CONTINUE */}
        {result && !isRunning && (
          <div className="flex flex-col gap-2 pt-2">
            {selectedSubAvatarId && (
              <div className="text-xs text-text-muted">
                Deep dive will focus on{' '}
                <span className="text-accent-teal font-semibold">
                  {result.sub_avatars.find(sa => sa.id === selectedSubAvatarId)?.nickname ??
                    selectedSubAvatarId}
                </span>
                . All Gates 2-9 will be built around this sub-avatar.
              </div>
            )}
            {!selectedSubAvatarId && (
              <div className="text-xs text-accent-orange">
                Pick ONE sub-avatar below to focus the deep dive on before continuing.
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={!selectedSubAvatarId}
                className="px-6 py-3 bg-success text-white font-semibold rounded-lg hover:bg-success/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApproved ? 'Continue to Gate 2 →' : 'Approve & Continue to Gate 2 →'}
              </button>
              {isApproved && (
                <span className="text-xs text-text-muted">
                  Gate 1 already approved. Re-running will overwrite the saved result.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </TranslateCtx.Provider>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function Field({ label, value, placeholder, onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-teal"
      />
    </div>
  );
}

interface ResultViewProps {
  result: AvatarRunResult;
  core: CoreAvatarInput;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  selectedSubAvatarId: string | null;
  onSelect: (id: string) => void;
  onUpdateSubAvatar: (updated: SubAvatarV2) => Promise<void>;
  onRunFullExcavation?: () => void;
  canRunFullExcavation?: boolean;
}

function ResultView({
  result,
  core,
  expanded,
  onExpand,
  selectedSubAvatarId,
  onSelect,
  onUpdateSubAvatar,
  onRunFullExcavation,
  canRunFullExcavation,
}: ResultViewProps) {
  const { sub_avatars, comparative_table, final_recommendation, metadata, adversarial_summary } = result;

  return (
    <section className="space-y-6">
      {/* Metadata */}
      <div className="p-4 bg-bg-card border border-border rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <Metric label="Sub-avatars" value={String(sub_avatars.length)} />
        <Metric label="Verbatims" value={String(metadata.total_verbatims)} />
        <Metric label="Items scraped" value={String(metadata.total_items_scraped)} />
        <Metric label="Duration" value={`${(metadata.run_duration_ms / 1000).toFixed(1)}s`} />
        <Metric label="Cost" value={`$${metadata.cost_estimate_usd.toFixed(3)}`} />
      </div>

      {/* Final recommendation */}
      <div className="p-5 bg-accent-teal/10 border border-accent-teal/30 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase text-accent-teal">Recommended first test</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          {final_recommendation.first_to_test}
        </h3>
        <p className="text-sm text-text-secondary mb-2">{final_recommendation.reason}</p>
        <p className="text-xs text-text-muted italic">Strategy: {final_recommendation.strategy}</p>
      </div>

      {/* Adversarial summary — quality signal + merge/missing suggestions */}
      {adversarial_summary && (
        <div
          className={`p-5 rounded-xl border space-y-3 ${
            adversarial_summary.overall_quality === 'excellent'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : adversarial_summary.overall_quality === 'good'
              ? 'bg-sky-500/10 border-sky-500/30'
              : adversarial_summary.overall_quality === 'needs_work'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
              Adversarial audit
            </span>
            <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full bg-bg-primary border border-border">
              {adversarial_summary.overall_quality.replace('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-muted text-[10px] uppercase">Strongest</div>
              <div className="text-text-primary font-medium">{adversarial_summary.strongest_sub_avatar}</div>
            </div>
            <div>
              <div className="text-text-muted text-[10px] uppercase">Weakest</div>
              <div className="text-text-primary font-medium">{adversarial_summary.weakest_sub_avatar}</div>
            </div>
          </div>
          {adversarial_summary.merge_suggestions.length > 0 && (
            <div className="text-xs">
              <div className="text-text-muted text-[10px] uppercase mb-1">Merge suggestions</div>
              <ul className="list-disc list-inside space-y-0.5 text-text-secondary">
                {adversarial_summary.merge_suggestions.map((m, i) => (
                  <li key={i}>
                    <span className="text-text-primary font-medium">
                      {m.merge[0]} + {m.merge[1]}
                    </span>
                    <span className="text-text-muted"> — {m.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {adversarial_summary.missing_angles.length > 0 && (
            <div className="text-xs">
              <div className="text-text-muted text-[10px] uppercase mb-1">Missing angles the data supports</div>
              <ul className="list-disc list-inside space-y-0.5 text-text-secondary">
                {adversarial_summary.missing_angles.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-[10px] text-text-muted italic">
            Per-sub-avatar weaknesses are shown inside each sub-avatar card below.
          </div>
        </div>
      )}

      {/* Comparative table */}
      <div className="p-5 bg-bg-card border border-border rounded-xl">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">Comparative Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-border">
                <th className="text-left py-2 pr-3">Sub-avatar</th>
                <th className="text-left py-2 pr-3">TAM</th>
                <th className="text-left py-2 pr-3">Urgency</th>
                <th className="text-left py-2 pr-3">Scope</th>
                <th className="text-left py-2 pr-3">Staying</th>
                <th className="text-left py-2">Rec.</th>
              </tr>
            </thead>
            <tbody>
              {comparative_table.map((row) => (
                <tr key={row.sub_avatar_id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium text-text-primary">{row.nickname}</td>
                  <td className="py-2 pr-3 text-text-secondary">{row.tam}</td>
                  <td className="py-2 pr-3">{row.urgency}/10</td>
                  <td className="py-2 pr-3">{row.scope}/10</td>
                  <td className="py-2 pr-3">{row.staying_power}/10</td>
                  <td className="py-2">{row.recommended ? '★' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-avatars */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-secondary">Sub-Avatars</h3>
          <span className="text-[11px] text-text-muted">Pick ONE to focus the deep dive on.</span>
        </div>
        {sub_avatars.map((sa) => (
          <SubAvatarCard
            key={sa.id}
            subAvatar={sa}
            core={core}
            isExpanded={expanded === sa.id}
            onToggle={() => onExpand(expanded === sa.id ? null : sa.id)}
            isSelected={selectedSubAvatarId === sa.id}
            onSelect={() => onSelect(sa.id)}
            onUpdateSubAvatar={onUpdateSubAvatar}
            onRunFullExcavation={onRunFullExcavation}
            canRunFullExcavation={canRunFullExcavation}
          />
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted">{label}</div>
      <div className="text-text-primary font-semibold text-base">{value}</div>
    </div>
  );
}

interface SubAvatarCardProps {
  subAvatar: SubAvatarV2;
  core: CoreAvatarInput;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateSubAvatar: (updated: SubAvatarV2) => Promise<void>;
  onRunFullExcavation?: () => void;
  canRunFullExcavation?: boolean;
}

function SubAvatarCard({
  subAvatar,
  core,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  onUpdateSubAvatar,
  onRunFullExcavation,
  canRunFullExcavation,
}: SubAvatarCardProps) {
  const sa = subAvatar;
  const [awarenessBusy, setAwarenessBusy] = useState<AwarenessLevel | null>(null);
  const [deepDiveBusy, setDeepDiveBusy] = useState(false);
  const [deepDiveFocus, setDeepDiveFocus] = useState('');
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const handleAwarenessClick = async (level: AwarenessLevel) => {
    if (awarenessBusy) return;
    setAwarenessBusy(level);
    setEnrichError(null);
    try {
      const variant = await generateAwarenessVariant({
        core,
        subAvatar: sa,
        awarenessLevel: level,
      });
      const next = appendAwarenessVariant(sa, variant);
      await onUpdateSubAvatar(next);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Awareness call failed');
    } finally {
      setAwarenessBusy(null);
    }
  };

  const handleDeepDiveClick = async () => {
    if (deepDiveBusy) return;
    setDeepDiveBusy(true);
    setEnrichError(null);
    try {
      const dive = await generateDeepDive({
        core,
        subAvatar: sa,
        focus: deepDiveFocus.trim() || null,
        priorDives: sa.deep_dives ?? [],
      });
      const next = appendDeepDive(sa, dive);
      await onUpdateSubAvatar(next);
      setDeepDiveFocus('');
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Deep-dive call failed');
    } finally {
      setDeepDiveBusy(false);
    }
  };

  const borderClass = isSelected
    ? 'border-accent-orange ring-2 ring-accent-orange/30'
    : sa.recommended_for_test
    ? 'border-accent-teal/50'
    : 'border-border';
  return (
    <div className={`border rounded-xl transition-all ${borderClass} bg-bg-card`}>
      <div className="w-full p-4 flex items-center justify-between gap-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 text-left flex-1 hover:opacity-80"
        >
          {sa.recommended_for_test && <span className="text-accent-teal">★</span>}
          {isSelected && <span className="text-accent-orange text-xs font-bold">◉ FOCUS</span>}
          <div>
            <div className="font-semibold text-text-primary">{sa.name}</div>
            <div className="text-xs text-text-muted">
              {sa.nickname} · dominant: {sa.dominant_category} · urgency {sa.urgency_score}/10
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSelect}
            disabled={isSelected}
            className={`text-xs px-3 py-1.5 rounded border transition ${
              isSelected
                ? 'bg-accent-orange/20 border-accent-orange text-accent-orange cursor-default'
                : 'border-border text-text-muted hover:text-text-primary hover:border-accent-orange'
            }`}
          >
            {isSelected ? 'Selected' : 'Pick for deep dive'}
          </button>
          <button
            onClick={onToggle}
            className="text-text-muted text-xs w-6 h-6 flex items-center justify-center hover:text-text-primary"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 text-sm">
          {sa.is_from_reverse_engineer && (
            <ReverseEngineerWarningBanner
              brand={sa.reverse_source_brand}
              url={sa.reverse_source_url}
              onRunFullExcavation={onRunFullExcavation}
              canRunFull={canRunFullExcavation}
            />
          )}
          <p className="text-text-secondary">{sa.description}</p>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <Metric label="Urgency" value={`${sa.urgency_score}/10`} />
            <Metric label="Scope" value={`${sa.scope_score}/10`} />
            <Metric label="Staying" value={`${sa.staying_power_score}/10`} />
          </div>

          <Block title="TAM">{sa.tam_estimate}</Block>

          {sa.emotional_triggers?.length > 0 && (
            <Block title="Emotional triggers">
              <ul className="list-disc list-inside text-text-secondary text-xs space-y-0.5">
                {sa.emotional_triggers.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Block>
          )}

          {sa.past_attempts_failures?.length > 0 && (
            <Block title="Past attempts that failed">
              <ul className="list-disc list-inside text-text-secondary text-xs space-y-0.5">
                {sa.past_attempts_failures.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Block>
          )}

          {sa.implicit_demographics?.length > 0 && (
            <Block title="Implicit demographics">
              <div className="flex flex-wrap gap-1.5">
                {sa.implicit_demographics.map((d, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-bg-primary border border-border rounded text-text-secondary">
                    {d}
                  </span>
                ))}
              </div>
            </Block>
          )}

          {sa.verbatim_quotes?.length > 0 && (
            <Block title={`Verbatim quotes (${sa.verbatim_quotes.length})`}>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sa.verbatim_quotes.map((q, i) => (
                  <div key={i} className="text-xs p-2 bg-bg-primary border-l-2 border-accent-teal/50 rounded">
                    <p className="text-text-secondary italic">&ldquo;{q.quote}&rdquo;</p>
                    <InlineTranslate text={q.quote} />
                    <a
                      href={q.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-accent-teal text-[10px] mt-1 block truncate"
                    >
                      {q.source_type} · {q.source_url}
                    </a>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {sa.angles && (
            <div className="space-y-3 p-3 bg-bg-primary rounded-lg border border-border">
              <div className="text-xs font-semibold uppercase text-accent-orange">3 Angles</div>

              <Block title={`Positioning — ${sa.angles.positioning?.framework}`}>
                <p className="text-xs text-text-secondary">{sa.angles.positioning?.description}</p>
                <p className="text-[10px] text-text-muted italic mt-1">
                  Why: {sa.angles.positioning?.rationale}
                </p>
              </Block>

              {sa.angles.hooks?.length > 0 && (
                <Block title="Hooks">
                  <ul className="space-y-1">
                    {sa.angles.hooks.map((h, i) => (
                      <li key={i} className="text-xs text-text-secondary">
                        <span className="text-accent-orange">{i + 1}.</span> {h}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {sa.angles.story_angle && (
                <Block title="Story arc">
                  <dl className="text-xs text-text-secondary space-y-1">
                    <StoryRow label="Problem" value={sa.angles.story_angle.problem} />
                    <StoryRow label="Agitation" value={sa.angles.story_angle.agitation} />
                    <StoryRow label="Solution" value={sa.angles.story_angle.solution} />
                    <StoryRow label="Mechanism" value={sa.angles.story_angle.mechanism} />
                    <StoryRow label="CTA" value={sa.angles.story_angle.cta} />
                  </dl>
                </Block>
              )}
            </div>
          )}

          <ReverseEnrichmentSections subAvatar={sa} />

          {sa.recommended_for_test && sa.recommendation_reason && (
            <div className="p-3 bg-accent-teal/10 border border-accent-teal/30 rounded-lg text-xs">
              <div className="font-semibold text-accent-teal mb-1">Why test this one first</div>
              <div className="text-text-secondary">{sa.recommendation_reason}</div>
            </div>
          )}

          {sa.adversarial_challenge && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                sa.adversarial_challenge.confidence_score >= 80
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : sa.adversarial_challenge.confidence_score >= 50
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold uppercase tracking-wide text-text-primary">
                  Adversarial validation
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-bg-primary border border-border text-text-secondary">
                    {sa.adversarial_challenge.confidence_score}/100
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-bg-primary border border-border text-text-secondary uppercase">
                    {sa.adversarial_challenge.evidence_density}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full uppercase font-semibold ${
                      sa.adversarial_challenge.recommendation === 'keep'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : sa.adversarial_challenge.recommendation === 'flag_weak'
                        ? 'bg-amber-500/20 text-amber-300'
                        : sa.adversarial_challenge.recommendation === 'merge'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {sa.adversarial_challenge.recommendation.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {sa.adversarial_challenge.reasoning && (
                <div className="text-text-secondary italic">
                  {sa.adversarial_challenge.reasoning}
                </div>
              )}
              {sa.adversarial_challenge.challenges.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase mb-1">
                    Specific weaknesses
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-text-secondary">
                    {sa.adversarial_challenge.challenges.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {sa.adversarial_challenge.overlap_with.length > 0 && (
                <div className="text-[10px] text-text-muted">
                  Overlaps with: {sa.adversarial_challenge.overlap_with.join(', ')}
                </div>
              )}
              {!sa.adversarial_challenge.cross_source_confirmed && (
                <div className="text-[10px] text-amber-400">
                  ⚠ Evidence is not confirmed across 2+ sources — treat as speculative
                </div>
              )}
            </div>
          )}

          {/* ============================================== */}
          {/* AWARENESS LEVEL FILTER (re-runnable, stackable) */}
          {/* ============================================== */}
          <div className="p-3 bg-bg-primary rounded-lg border border-border space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-accent-orange">
                  Awareness filter
                </div>
                <div className="text-[11px] text-text-muted">
                  Tune the copy to one of Schwartz&apos;s 5 levels. Re-run freely &mdash; every run
                  stacks below, nothing is overwritten.
                </div>
              </div>
              {(sa.awareness_variants?.length ?? 0) > 0 && (
                <span className="text-[10px] text-text-muted shrink-0">
                  {sa.awareness_variants!.length} variant
                  {sa.awareness_variants!.length > 1 ? 's' : ''} saved
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {AWARENESS_LEVELS.map((level) => {
                const busy = awarenessBusy === level;
                const anyBusy = awarenessBusy !== null;
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={anyBusy}
                    onClick={() => handleAwarenessClick(level)}
                    title={AWARENESS_DESCRIPTION[level]}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                      busy
                        ? 'border-accent-orange bg-accent-orange/20 text-accent-orange'
                        : 'border-border text-text-secondary hover:border-accent-orange hover:text-text-primary'
                    } ${anyBusy && !busy ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {busy ? `${AWARENESS_LABEL[level]}…` : AWARENESS_LABEL[level]}
                  </button>
                );
              })}
            </div>

            {(sa.awareness_variants?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                {sa.awareness_variants!.map((v, i) => (
                  <AwarenessVariantBlock key={v.id} variant={v} index={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* ================================ */}
          {/* DEEP-DIVE (approfondis encore +) */}
          {/* ================================ */}
          <div className="p-3 bg-bg-primary rounded-lg border border-border space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-accent-teal">
                  Approfondis encore +
                </div>
                <div className="text-[11px] text-text-muted">
                  Push the research deeper: hidden fears, contradictions, micro-segments, a
                  meta-story. Each dive goes deeper than the last.
                </div>
              </div>
              {(sa.deep_dives?.length ?? 0) > 0 && (
                <span className="text-[10px] text-text-muted shrink-0">
                  {sa.deep_dives!.length} dive{sa.deep_dives!.length > 1 ? 's' : ''} saved
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={deepDiveFocus}
                onChange={(e) => setDeepDiveFocus(e.target.value)}
                placeholder="Optional focus hint (ex: hidden guilt, price objections…)"
                disabled={deepDiveBusy}
                className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-teal disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleDeepDiveClick}
                disabled={deepDiveBusy}
                className="px-3 py-2 bg-accent-teal/10 border border-accent-teal text-accent-teal text-xs font-semibold rounded-lg hover:bg-accent-teal/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {deepDiveBusy
                  ? 'Digging deeper…'
                  : `Approfondis +${(sa.deep_dives?.length ?? 0) > 0 ? ' encore' : ''}`}
              </button>
            </div>

            {(sa.deep_dives?.length ?? 0) > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                {sa.deep_dives!.map((d, i) => (
                  <DeepDiveBlock key={d.id} dive={d} index={i + 1} />
                ))}
              </div>
            )}
          </div>

          {enrichError && (
            <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {enrichError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// AWARENESS + DEEP-DIVE DISPLAY BLOCKS
// ============================================================

function AwarenessVariantBlock({
  variant,
  index,
}: {
  variant: AwarenessVariant;
  index: number;
}) {
  return (
    <div className="p-3 bg-bg-card border border-border rounded-lg space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">#{index}</span>
          <span className="text-[11px] font-semibold uppercase text-accent-orange">
            {AWARENESS_LABEL[variant.awareness_level]}
          </span>
        </div>
        <span className="text-[10px] text-text-muted">
          {new Date(variant.generated_at).toLocaleString()} · {variant.tokens_used} tok
        </span>
      </div>

      <div className="text-sm font-semibold text-text-primary leading-snug">
        {variant.headline}
      </div>

      <dl className="text-xs space-y-1.5">
        <VariantRow label="Hook" value={variant.hook} />
        <VariantRow label="Agitation" value={variant.agitation} />
        <VariantRow label="Bridge" value={variant.bridge} />
        <VariantRow label="Proof" value={variant.proof_angle} />
        <VariantRow label="CTA" value={variant.cta_style} />
      </dl>

      {variant.claude_notes && (
        <div className="text-[11px] text-text-muted italic pt-1 border-t border-border">
          Claude: {variant.claude_notes}
        </div>
      )}
    </div>
  );
}

function VariantRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-text-muted uppercase text-[10px] mt-0.5">{label}</dt>
      <dd className="flex-1 text-text-secondary">{value}</dd>
    </div>
  );
}

// Color theme per dimension — each card gets its own accent for instant scanability.
const DIVE_THEME = {
  red:    { border: 'border-rose-500/40',    bg: 'bg-rose-500/5',    text: 'text-rose-300',    chip: 'bg-rose-500/20 text-rose-300' },
  orange: { border: 'border-amber-500/40',   bg: 'bg-amber-500/5',   text: 'text-amber-300',   chip: 'bg-amber-500/20 text-amber-300' },
  blue:   { border: 'border-sky-500/40',     bg: 'bg-sky-500/5',     text: 'text-sky-300',     chip: 'bg-sky-500/20 text-sky-300' },
  purple: { border: 'border-violet-500/40',  bg: 'bg-violet-500/5',  text: 'text-violet-300',  chip: 'bg-violet-500/20 text-violet-300' },
  teal:   { border: 'border-teal-500/40',    bg: 'bg-teal-500/5',    text: 'text-teal-300',    chip: 'bg-teal-500/20 text-teal-300' },
  pink:   { border: 'border-pink-500/40',    bg: 'bg-pink-500/5',    text: 'text-pink-300',    chip: 'bg-pink-500/20 text-pink-300' },
  green:  { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', text: 'text-emerald-300', chip: 'bg-emerald-500/20 text-emerald-300' },
} as const;

type DiveTone = keyof typeof DIVE_THEME;

function DeepDiveBlock({ dive, index }: { dive: DeepDiveResult; index: number }) {
  const hasAny =
    dive.hidden_fears.length +
      dive.contradictions.length +
      dive.sharper_triggers.length +
      dive.buying_objections.length >
    0;

  return (
    <div className="p-4 bg-bg-card border border-accent-teal/30 rounded-xl space-y-3">
      {/* Header: Dive number + focus + timestamp */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-accent-teal/20 text-accent-teal text-xs font-bold">
            DIVE #{index}
          </span>
          <span className="text-sm font-semibold text-text-primary">{dive.focus}</span>
        </div>
        <span className="text-[10px] text-text-muted shrink-0">
          {new Date(dive.generated_at).toLocaleString()} · {dive.tokens_used} tok
        </span>
      </div>

      {/* The real story — meta narrative */}
      {dive.meta_story && (
        <div className="p-3 bg-bg-primary border-l-4 border-accent-teal rounded-r-lg">
          <div className="text-[10px] uppercase text-accent-teal font-bold tracking-wider mb-1">
            🎭 The Real Story
          </div>
          <p className="text-xs text-text-secondary italic leading-relaxed">{dive.meta_story}</p>
          <InlineTranslate text={dive.meta_story} />
        </div>
      )}

      {/* 4-card color-coded grid */}
      {hasAny && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {dive.hidden_fears.length > 0 && (
            <DiveDimensionCard
              tone="red"
              icon="😰"
              title="Hidden Fears"
              subtitle="What they don't say out loud"
              items={dive.hidden_fears}
            />
          )}
          {dive.contradictions.length > 0 && (
            <DiveDimensionCard
              tone="orange"
              icon="⚡"
              title="Contradictions"
              subtitle="Stated vs. actual desires"
              items={dive.contradictions}
            />
          )}
          {dive.sharper_triggers.length > 0 && (
            <DiveDimensionCard
              tone="blue"
              icon="🎯"
              title="Sharper Triggers"
              subtitle="High-precision buy moments"
              items={dive.sharper_triggers}
            />
          )}
          {dive.buying_objections.length > 0 && (
            <DiveDimensionCard
              tone="purple"
              icon="🛑"
              title="Buying Objections"
              subtitle="What stops the click"
              items={dive.buying_objections}
            />
          )}
        </div>
      )}

      {/* Identity map (Phase O) */}
      {dive.identity_map && (
        <DiveSectionCard tone="pink" icon="🪞" title="Identity Map">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <IdentityField label="Self-image" value={dive.identity_map.self_image} />
            <IdentityField label="Anti-identity" value={dive.identity_map.anti_identity} />
            <IdentityField label="Aspiration" value={dive.identity_map.aspiration} />
            {dive.identity_map.tribal_markers.length > 0 && (
              <IdentityField
                label="Tribal markers"
                value={dive.identity_map.tribal_markers.join(' · ')}
              />
            )}
          </div>
        </DiveSectionCard>
      )}

      {/* Linguistic DNA (Phase O) */}
      {dive.linguistic_dna && (
        <DiveSectionCard tone="teal" icon="🗣️" title="Linguistic DNA">
          <div className="space-y-2">
            {dive.linguistic_dna.power_words.length > 0 && (
              <ChipRow label="Power words" items={dive.linguistic_dna.power_words} tone="teal" />
            )}
            {dive.linguistic_dna.emotional_vocabulary.length > 0 && (
              <ChipRow
                label="Emotional vocab"
                items={dive.linguistic_dna.emotional_vocabulary}
                tone="red"
              />
            )}
            {dive.linguistic_dna.metaphors_used.length > 0 && (
              <ChipRow
                label="Metaphors"
                items={dive.linguistic_dna.metaphors_used}
                tone="orange"
              />
            )}
            {dive.linguistic_dna.recurring_phrases.length > 0 && (
              <ChipRow
                label="Recurring phrases"
                items={dive.linguistic_dna.recurring_phrases}
                tone="purple"
              />
            )}
          </div>
        </DiveSectionCard>
      )}

      {/* Transformation narrative (Phase O) */}
      {dive.transformation_narrative && (
        <DiveSectionCard tone="green" icon="🌱" title="Transformation Narrative">
          <div className="space-y-2 text-xs">
            <NarrativeRow
              step="Before"
              color="text-rose-300"
              value={dive.transformation_narrative.before_state}
            />
            <NarrativeRow
              step="Turning point"
              color="text-amber-300"
              value={dive.transformation_narrative.turning_point}
            />
            <NarrativeRow
              step="After"
              color="text-emerald-300"
              value={dive.transformation_narrative.after_state}
            />
            <NarrativeRow
              step="Proof needed"
              color="text-sky-300"
              value={dive.transformation_narrative.proof_they_need}
            />
          </div>
        </DiveSectionCard>
      )}

      {/* Objection hierarchy (Phase O) — prioritized by severity */}
      {dive.objection_hierarchy && dive.objection_hierarchy.length > 0 && (
        <DiveSectionCard tone="purple" icon="⚖️" title="Objection Hierarchy">
          <div className="space-y-1.5">
            {dive.objection_hierarchy.map((obj, i) => (
              <div
                key={i}
                className="p-2 bg-bg-primary border border-border rounded text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      obj.severity === 'deal_breaker'
                        ? 'bg-rose-500/20 text-rose-300'
                        : obj.severity === 'hesitation'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {obj.severity.replace('_', ' ')}
                  </span>
                  <span className="text-text-primary font-medium">{obj.objection}</span>
                </div>
                <div className="text-text-muted text-[11px] pl-2 border-l-2 border-emerald-500/40">
                  Counter: {obj.counter_argument}
                </div>
              </div>
            ))}
          </div>
        </DiveSectionCard>
      )}

      {/* New verbatims */}
      {dive.new_verbatims.length > 0 && (
        <DiveSectionCard
          tone="teal"
          icon="💬"
          title={`New Verbatims (${dive.new_verbatims.length})`}
        >
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {dive.new_verbatims.map((q, i) => (
              <div
                key={i}
                className="text-xs p-2 bg-bg-primary border-l-2 border-accent-teal/50 rounded"
              >
                <p className="text-text-secondary italic leading-snug">
                  &ldquo;{q.quote}&rdquo;
                </p>
                <InlineTranslate text={q.quote} />
                {q.source_url && (
                  <a
                    href={q.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted hover:text-accent-teal text-[10px] mt-1 block truncate"
                  >
                    {q.source_type} · {q.source_url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </DiveSectionCard>
      )}

      {/* Micro-segments */}
      {dive.micro_segments.length > 0 && (
        <DiveSectionCard tone="orange" icon="🧬" title="Micro-Segments">
          <div className="space-y-2">
            {dive.micro_segments.map((s, i) => (
              <div
                key={i}
                className="text-xs p-2.5 bg-bg-primary border border-amber-500/30 rounded-lg"
              >
                <div className="font-bold text-amber-300">{s.name}</div>
                <div className="text-text-secondary mt-0.5">{s.description}</div>
                <div className="text-text-muted italic mt-1">
                  <span className="text-[10px] uppercase">Different because: </span>
                  {s.what_makes_them_different}
                </div>
                <div className="mt-1.5 p-1.5 bg-accent-orange/10 border-l-2 border-accent-orange rounded">
                  <span className="text-[10px] uppercase text-accent-orange font-bold">
                    Hook:{' '}
                  </span>
                  <span className="text-text-primary">{s.recommended_hook}</span>
                </div>
              </div>
            ))}
          </div>
        </DiveSectionCard>
      )}

      {/* Dark funnel (Phase O) */}
      {dive.dark_funnel && (
        <DiveSectionCard tone="blue" icon="🕶️" title="Dark Funnel">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {dive.dark_funnel.influencers.length > 0 && (
              <IdentityField
                label="Influencers"
                value={dive.dark_funnel.influencers.join(' · ')}
              />
            )}
            {dive.dark_funnel.content_consumed.length > 0 && (
              <IdentityField
                label="Content consumed"
                value={dive.dark_funnel.content_consumed.join(' · ')}
              />
            )}
            {dive.dark_funnel.trusted_sources.length > 0 && (
              <IdentityField
                label="Trusted sources"
                value={dive.dark_funnel.trusted_sources.join(' · ')}
              />
            )}
            {dive.dark_funnel.peer_pressure && (
              <IdentityField label="Peer pressure" value={dive.dark_funnel.peer_pressure} />
            )}
          </div>
        </DiveSectionCard>
      )}

      {/* Claude's reasoning */}
      {dive.claude_notes && (
        <div className="text-[11px] text-text-muted italic pt-2 border-t border-border">
          <span className="uppercase font-bold text-[9px] text-accent-teal">Claude: </span>
          {dive.claude_notes}
        </div>
      )}
    </div>
  );
}

function DiveDimensionCard({
  tone,
  icon,
  title,
  subtitle,
  items,
}: {
  tone: DiveTone;
  icon: string;
  title: string;
  subtitle: string;
  items: string[];
}) {
  const theme = DIVE_THEME[tone];
  return (
    <div className={`p-3 rounded-lg border ${theme.border} ${theme.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <div>
          <div className={`text-xs font-bold uppercase tracking-wider ${theme.text}`}>
            {title}
          </div>
          <div className="text-[10px] text-text-muted">{subtitle}</div>
        </div>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${theme.chip}`}>
          {items.length}
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="text-[11px] text-text-secondary leading-snug flex gap-1.5"
          >
            <span className={`${theme.text} shrink-0`}>▸</span>
            <div className="flex-1">
              <span>{it}</span>
              <InlineTranslate text={it} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiveSectionCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: DiveTone;
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const theme = DIVE_THEME[tone];
  return (
    <div className={`p-3 rounded-lg border ${theme.border} ${theme.bg}`}>
      <div className={`flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider ${theme.text}`}>
        <span className="text-base">{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase font-semibold">{label}</div>
      <div className="text-text-primary">{value}</div>
    </div>
  );
}

function NarrativeRow({
  step,
  color,
  value,
}: {
  step: string;
  color: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <span className={`w-24 shrink-0 text-[10px] uppercase font-bold ${color}`}>{step}</span>
      <span className="flex-1 text-text-secondary">{value}</span>
    </div>
  );
}

function ChipRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: DiveTone;
}) {
  const theme = DIVE_THEME[tone];
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase font-semibold mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${theme.chip}`}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MONEY-FLIGHT LOADING ANIMATION
// ============================================================

const PHASE_LABELS: Partial<Record<string, string>> = {
  planning: 'Planning discovery',
  fetching: 'Scraping the voice of the market',
  analyzing: 'Decoding emotion & intent',
  compiling: 'Compiling sub-avatars',
  done: 'Done',
};

function MoneyFlightProgress({
  events,
  isRunning,
}: {
  events: AvatarProgressEvent[];
  isRunning: boolean;
}) {
  const latest = events[events.length - 1];
  const phaseLabel = latest
    ? PHASE_LABELS[latest.phase] ?? latest.phase
    : 'Starting the hunt for $1M/day winners…';
  const sourceLine = latest?.source ? `${latest.source} · ${latest.message}` : latest?.message ?? '';

  return (
    <section className="p-5 bg-bg-card border border-accent-orange/40 rounded-xl space-y-4">
      {/* Hero banner with flying money */}
      <div className="relative h-20 rounded-xl bg-gradient-to-r from-accent-orange/10 via-accent-teal/10 to-accent-orange/10 border border-accent-orange/30 overflow-hidden flex items-center px-4">
        {/* Flying money */}
        {isRunning && (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 money-fly text-3xl select-none">
              💵
            </div>
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 money-fly text-3xl select-none"
              style={{ animationDelay: '0.8s' }}
            >
              💸
            </div>
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 money-fly text-3xl select-none"
              style={{ animationDelay: '1.6s' }}
            >
              💰
            </div>
          </>
        )}

        {/* Spacer pushes target to the right */}
        <div className="flex-1" />

        {/* $1M/day target on the right */}
        <div className="target-pulse relative z-10 px-3 py-2 bg-accent-orange text-white rounded-xl font-black text-sm shadow-lg">
          <div className="text-[9px] uppercase tracking-widest opacity-80 leading-none">
            Target
          </div>
          <div className="leading-none mt-0.5">$1M / day</div>
        </div>
      </div>

      {/* Status line */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 bg-accent-orange rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-accent-orange status-fade">
            {phaseLabel}
          </span>
          {latest && (
            <span className="ml-auto text-[10px] text-text-muted uppercase tracking-wider">
              {events.length} events
            </span>
          )}
        </div>
        {sourceLine && (
          <p className="text-xs text-text-secondary pl-4 truncate">{sourceLine}</p>
        )}
      </div>

      {/* Collapsible log */}
      {events.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-text-muted hover:text-text-primary select-none">
            Full pipeline log ({events.length})
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto font-mono pr-1">
            {events.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-accent-teal w-20 shrink-0">{e.phase}</span>
                {e.source && (
                  <span className="text-accent-orange w-16 shrink-0">{e.source}</span>
                )}
                <span className="text-text-muted">{e.message}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">{title}</div>
      {children}
    </div>
  );
}

function StoryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-text-muted">{label}:</dt>
      <dd className="flex-1">{value}</dd>
    </div>
  );
}

// ============================================================
// REVERSE-ENGINEER ENRICHMENT DISPLAY
// ============================================================

function ReverseEngineerWarningBanner({
  brand,
  url,
  onRunFullExcavation,
  canRunFull,
}: {
  brand?: string;
  url?: string;
  onRunFullExcavation?: () => void;
  canRunFull?: boolean;
}) {
  return (
    <div className="p-3 bg-error/10 border border-error/40 rounded-lg text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-error font-bold">⚠</span>
        <span className="font-semibold text-error uppercase tracking-wider">
          Synthetic avatar — not mined from real VOC
        </span>
      </div>
      <p className="text-text-secondary leading-relaxed">
        This sub-avatar was reverse-engineered from {brand ? <strong className="text-text-primary">{brand}</strong> : 'a competitor funnel'} + enriched by Claude.
        It&apos;s a strong synthetic starting point but does NOT contain real customer quotes from independent sources.
        For a fully-evidenced run, launch a seeded full excavation — Marcus will use the competitor signal to sharpen the hunt while mining real third-party voices in your target market.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-text-muted hover:text-error underline truncate max-w-[60%]"
          >
            source: {url}
          </a>
        ) : (
          <span />
        )}
        {onRunFullExcavation && (
          <button
            type="button"
            onClick={onRunFullExcavation}
            disabled={!canRunFull}
            className="text-[11px] font-semibold px-3 py-1.5 rounded border border-error/60 text-error bg-error/5 hover:bg-error/15 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Run Full Excavation (seeded)
          </button>
        )}
      </div>
    </div>
  );
}

function ReverseEnrichmentSections({ subAvatar }: { subAvatar: SubAvatarV2 }) {
  const sa = subAvatar;
  const hasAny =
    (sa.additional_angles?.length ?? 0) > 0 ||
    (sa.sensory_triggers?.length ?? 0) > 0 ||
    (sa.structured_past_attempts?.length ?? 0) > 0 ||
    (sa.scored_hooks?.length ?? 0) > 0 ||
    !!sa.buying_behavior ||
    !!sa.localized_demographics ||
    !!sa.narrator_persona ||
    !!sa.bridge_moment;

  if (!hasAny) return null;

  return (
    <div className="p-3 bg-bg-primary rounded-lg border border-accent-teal/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-accent-teal">
          Reverse enrichment
        </div>
        <span className="text-[10px] text-text-muted">
          Claude Opus pass · localized
        </span>
      </div>

      {sa.narrator_persona && (
        <Block title="Narrator persona">
          <p className="text-xs text-text-secondary leading-relaxed">{sa.narrator_persona}</p>
        </Block>
      )}

      {sa.bridge_moment && (
        <Block title="Bridge moment">
          <p className="text-xs text-text-secondary italic leading-relaxed">&ldquo;{sa.bridge_moment}&rdquo;</p>
        </Block>
      )}

      {(sa.additional_angles?.length ?? 0) > 0 && (
        <Block title={`Additional angles (${sa.additional_angles!.length})`}>
          <div className="space-y-3">
            {sa.additional_angles!.map((angle, i) => (
              <div
                key={i}
                className="p-2.5 bg-bg-card border border-border rounded-lg space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted">#{i + 2}</span>
                  <span className="text-[11px] font-semibold uppercase text-accent-orange">
                    {angle.positioning.framework.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{angle.positioning.description}</p>
                {angle.positioning.rationale && (
                  <p className="text-[10px] text-text-muted italic">
                    Why: {angle.positioning.rationale}
                  </p>
                )}
                {angle.hooks.length > 0 && (
                  <ul className="space-y-0.5 pt-1 border-t border-border/50">
                    {angle.hooks.map((h, j) => (
                      <li key={j} className="text-[11px] text-text-secondary">
                        <span className="text-accent-orange">{j + 1}.</span> {h}
                      </li>
                    ))}
                  </ul>
                )}
                {angle.story_angle && (
                  <dl className="text-[11px] text-text-secondary space-y-0.5 pt-1 border-t border-border/50">
                    <StoryRow label="Problem" value={angle.story_angle.problem} />
                    <StoryRow label="Agitation" value={angle.story_angle.agitation} />
                    <StoryRow label="Solution" value={angle.story_angle.solution} />
                    <StoryRow label="Mechanism" value={angle.story_angle.mechanism} />
                    <StoryRow label="CTA" value={angle.story_angle.cta} />
                  </dl>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {(sa.sensory_triggers?.length ?? 0) > 0 && (
        <Block title={`Sensory triggers (${sa.sensory_triggers!.length})`}>
          <div className="space-y-1.5">
            {sa.sensory_triggers!.map((t, i) => (
              <div key={i} className="p-2 bg-bg-card border border-border rounded text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase text-accent-teal font-semibold">
                    {t.sensory_anchor}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    intensity {t.intensity_score}/10 · frequency {t.frequency_score}/10
                  </span>
                </div>
                <p className="text-text-secondary mt-1">{t.trigger}</p>
                {t.context && (
                  <p className="text-[10px] text-text-muted italic mt-0.5">{t.context}</p>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {(sa.structured_past_attempts?.length ?? 0) > 0 && (
        <Block title={`Structured past attempts (${sa.structured_past_attempts!.length})`}>
          <div className="space-y-1.5">
            {sa.structured_past_attempts!.map((p, i) => (
              <div key={i} className="p-2 bg-bg-card border border-border rounded text-xs">
                <div className="text-text-primary font-semibold">{p.what_tried}</div>
                {p.why_failed && (
                  <div className="text-text-secondary mt-0.5">Why it failed: {p.why_failed}</div>
                )}
                {p.residual_emotion && (
                  <div className="text-[10px] uppercase text-error mt-0.5">
                    Residue: {p.residual_emotion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Block>
      )}

      {(sa.scored_hooks?.length ?? 0) > 0 && (
        <Block title={`Scored hooks (${sa.scored_hooks!.length})`}>
          <div className="space-y-1">
            {[...sa.scored_hooks!]
              .sort(
                (a, b) =>
                  b.curiosity_score + b.intensity_score + b.relevance_score -
                  (a.curiosity_score + a.intensity_score + a.relevance_score),
              )
              .map((h, i) => (
                <div key={i} className="p-2 bg-bg-card border border-border rounded text-xs">
                  <div className="text-text-secondary">{h.hook}</div>
                  <div className="text-[10px] text-text-muted mt-0.5 flex gap-2">
                    <span>curio {h.curiosity_score}/10</span>
                    <span>intens {h.intensity_score}/10</span>
                    <span>relev {h.relevance_score}/10</span>
                    <span className="ml-auto uppercase">{h.target_language}</span>
                  </div>
                </div>
              ))}
          </div>
        </Block>
      )}

      {sa.buying_behavior && (
        <Block title="Buying behavior">
          <dl className="text-xs text-text-secondary space-y-1">
            <StoryRow label="Cycle" value={sa.buying_behavior.decision_cycle} />
            <StoryRow label="Price" value={sa.buying_behavior.price_sensitivity} />
            <StoryRow label="Proof" value={sa.buying_behavior.preferred_social_proof} />
            <StoryRow label="Channel" value={sa.buying_behavior.preferred_channel} />
          </dl>
          {sa.buying_behavior.top_objections.length > 0 && (
            <div className="space-y-1 mt-2 pt-2 border-t border-border/50">
              <div className="text-[10px] font-semibold uppercase text-text-muted">
                Top objections
              </div>
              {sa.buying_behavior.top_objections.map((o, i) => (
                <div key={i} className="p-2 bg-bg-card border border-border rounded text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-primary font-semibold">{o.objection}</span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                        o.severity === 'deal_breaker'
                          ? 'bg-error/20 text-error'
                          : o.severity === 'hesitation'
                            ? 'bg-accent-orange/20 text-accent-orange'
                            : 'bg-border text-text-muted'
                      }`}
                    >
                      {o.severity.replace('_', ' ')}
                    </span>
                  </div>
                  {o.counter_argument && (
                    <div className="text-text-secondary mt-0.5">→ {o.counter_argument}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Block>
      )}

      {sa.localized_demographics && (
        <Block title="Localized demographics">
          <dl className="text-xs text-text-secondary space-y-1">
            <StoryRow label="Age" value={sa.localized_demographics.age_range} />
            <StoryRow
              label="Income"
              value={`${sa.localized_demographics.income_range} (${sa.localized_demographics.income_currency})`}
            />
            <StoryRow label="Register" value={sa.localized_demographics.language_register} />
          </dl>
          {sa.localized_demographics.geographic_concentration.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {sa.localized_demographics.geographic_concentration.map((g, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 bg-bg-card border border-border rounded text-text-secondary"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          {sa.localized_demographics.cultural_references.length > 0 && (
            <div className="pt-2 border-t border-border/50 mt-2">
              <div className="text-[10px] font-semibold uppercase text-text-muted mb-1">
                Cultural references
              </div>
              <div className="flex flex-wrap gap-1">
                {sa.localized_demographics.cultural_references.map((c, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 bg-bg-card border border-accent-teal/30 rounded text-text-secondary"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Block>
      )}
    </div>
  );
}
