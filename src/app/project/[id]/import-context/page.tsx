'use client';

// ============================================================
// PAWEN — Import Context Bundle
// Skip Gates 1-3 + Brand DNA when the user already did their own
// research externally. Paste a document bundle → Claude Sonnet parses
// it into CoreAvatarInput + SubAvatarV2[] + BrandDNA → gates 1/2/3/BrandDNA
// get marked approved → user lands on Gate 4 (copy) with full context.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Project, GateOutput, GateId, BrandDNA } from '@/lib/types';
import type {
  AvatarRunResult,
  CoreAvatarInput,
  SubAvatarV2,
  SourceDiscoveryPlan,
} from '@/lib/avatars/types';
import { getProject, saveProject, saveGateOutput } from '@/lib/store/db';

type ParsedBundle = {
  core: Partial<CoreAvatarInput>;
  sub_avatars: Array<Partial<SubAvatarV2>>;
  brand_dna: Partial<BrandDNA>;
  import_notes?: string;
  dropped_avatars?: Array<{ name: string; reason: string }>;
  brand_dna_completeness?: {
    mechanism_found?: boolean;
    root_cause_found?: boolean;
    proof_points_count?: number;
    voice_confidence?: 'high' | 'medium' | 'low';
    missing_fields?: string[];
  };
};

function emptyDiscoveryPlan(): SourceDiscoveryPlan {
  return {
    reddit: { subreddits: [], queries: [] },
    amazon: { product_queries: [], marketplace: '' },
    quora: { queries: [] },
    forums: { domains: [], queries: [] },
    tiktok: { hashtags: [], search_queries: [] },
    youtube: { video_queries: [] },
    reviews: { sites: [], queries: [] },
    searchWide: { queries: [] },
    shopify: { store_urls: [], product_queries: [] },
    instagram: { hashtags: [], search_queries: [] },
    facebook: { page_urls: [], search_queries: [] },
  };
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Fill any missing required SubAvatarV2 fields so downstream gates don't
// crash. Uses the parsed data first, falls back to safe defaults.
function hydrateSubAvatar(raw: Partial<SubAvatarV2>, core: CoreAvatarInput, idx: number): SubAvatarV2 {
  const id = raw.id ?? makeId('sa');
  return {
    id,
    name: raw.name ?? `Avatar ${idx + 1}`,
    nickname: raw.nickname ?? '',
    dominant_category: raw.dominant_category ?? 'experience',
    surface_desire: raw.surface_desire ?? core.surface_desire,
    description: raw.description ?? '',
    tam_estimate: raw.tam_estimate ?? 'imported',
    urgency_score: typeof raw.urgency_score === 'number' ? raw.urgency_score : 7,
    scope_score: typeof raw.scope_score === 'number' ? raw.scope_score : 7,
    staying_power_score: typeof raw.staying_power_score === 'number' ? raw.staying_power_score : 7,
    verbatim_quotes: Array.isArray(raw.verbatim_quotes) ? raw.verbatim_quotes : [],
    emotional_triggers: Array.isArray(raw.emotional_triggers) ? raw.emotional_triggers : [],
    past_attempts_failures: Array.isArray(raw.past_attempts_failures) ? raw.past_attempts_failures : [],
    implicit_demographics: Array.isArray(raw.implicit_demographics) ? raw.implicit_demographics : [],
    angles: raw.angles ?? {
      positioning: { framework: 'new_mechanism', description: '', rationale: '' },
      hooks: [],
      story_angle: { problem: '', agitation: '', solution: '', mechanism: '', cta: '' },
    },
    source_references: (raw.source_references ?? ['searchWide']) as SubAvatarV2['source_references'],
    launch_order: typeof raw.launch_order === 'number' ? raw.launch_order : idx + 1,
    recommended_for_test: raw.recommended_for_test ?? idx === 0,
    recommendation_reason: raw.recommendation_reason ?? 'Imported from external research bundle',
  };
}

function hydrateBrandDNA(raw: Partial<BrandDNA>, core: CoreAvatarInput): BrandDNA {
  return {
    version: '1.0',
    locked: true,
    product_name: raw.product_name ?? core.product,
    brand_name: raw.brand_name ?? core.product,
    target_market: raw.target_market ?? core.market,
    target_language: raw.target_language ?? core.language,
    locked_terms: raw.locked_terms ?? {
      mechanism_name: '',
      root_cause_one_sentence: '',
      belief_error: '',
      mechanism_3_steps: [],
      product_descriptor: '',
      key_proof_points: [],
      guarantee_wording: '',
    },
    customer_language: raw.customer_language ?? {
      pain_quotes: [],
      desire_quotes: [],
      objection_quotes: [],
      always_use: [],
      never_use: [],
      conditional_use: [],
    },
    emotional_arc: raw.emotional_arc ?? {
      primary_emotion: '',
      secondary_emotion: '',
      resolution_emotion: '',
      funnel_arc: [],
      awareness_progression: { ad_level: '', advertorial_journey: '', lp_level: '' },
    },
    voice_profile: raw.voice_profile ?? {
      vocabulary: [],
      sentence_style: '',
      formality_level: 5,
      emotional_tone: '',
      phrases_to_use: [],
      phrases_to_avoid: [],
      sample_paragraph: '',
    },
    visual_identity: raw.visual_identity ?? {
      metaphor: null,
      color_associations: { problem: '', solution: '', brand: '' },
      product_image_rules: [],
    },
    product_specs: raw.product_specs,
    proof_inventory: raw.proof_inventory,
    sub_avatars: raw.sub_avatars ?? [],
  };
}

export default function ImportContextPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [bundle, setBundle] = useState('');
  const [hintMarket, setHintMarket] = useState('');
  const [hintLanguage, setHintLanguage] = useState('');
  const [hintProduct, setHintProduct] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBundle | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setHintMarket(p.targetMarket || '');
      setHintLanguage(p.targetLanguage || '');
      setHintProduct(p.productDescription || p.name || '');
    })();
  }, [projectId, router]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    const texts: string[] = [];
    for (const f of files) {
      if (f.size > 2_000_000) {
        setError(`File ${f.name} is too large (>2MB). Paste the relevant sections into the text area instead.`);
        continue;
      }
      if (/\.(txt|md|markdown|csv|json)$/i.test(f.name)) {
        texts.push(`=== ${f.name} ===\n${await f.text()}`);
      } else {
        setError(`Unsupported file type: ${f.name}. Paste the text directly (PDF/DOCX not yet supported).`);
      }
    }
    if (texts.length > 0) {
      setBundle(prev => (prev.trim() ? `${prev}\n\n${texts.join('\n\n')}` : texts.join('\n\n')));
    }
    e.target.value = '';
  }, []);

  const handleParse = useCallback(async () => {
    if (!project) return;
    if (bundle.trim().length < 100) {
      setError('Bundle too short — need at least 100 characters of research context.');
      return;
    }
    setIsParsing(true);
    setError(null);
    setParsed(null);
    try {
      const res = await fetch('/api/context/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle,
          hints: { market: hintMarket, language: hintLanguage, product: hintProduct },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; parsed?: ParsedBundle; message?: string };
      if (!res.ok || !data.ok || !data.parsed) {
        throw new Error(data.message ?? `Parse failed (${res.status})`);
      }
      setParsed(data.parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsParsing(false);
    }
  }, [project, bundle, hintMarket, hintLanguage, hintProduct]);

  const handleCommit = useCallback(async () => {
    if (!project || !parsed) return;
    setIsCommitting(true);
    setError(null);
    try {
      // Build CoreAvatarInput from parsed + hints
      const core: CoreAvatarInput = {
        surface_desire: parsed.core.surface_desire ?? '',
        niche: parsed.core.niche ?? project.niche ?? '',
        product: parsed.core.product ?? hintProduct ?? project.productDescription ?? project.name,
        language: parsed.core.language ?? hintLanguage ?? project.targetLanguage ?? 'en-US',
        market: parsed.core.market ?? hintMarket ?? project.targetMarket ?? 'US',
        notes: parsed.core.notes ?? 'Imported from external research bundle',
      };

      const subAvatars: SubAvatarV2[] = (parsed.sub_avatars ?? []).map((sa, i) => hydrateSubAvatar(sa, core, i));
      if (subAvatars.length === 0) {
        throw new Error('No sub-avatars extracted from the bundle. Check the paste contains at least one avatar description.');
      }

      const avatarRunResult: AvatarRunResult = {
        core_avatar: core,
        discovery_plan: emptyDiscoveryPlan(),
        sub_avatars: subAvatars,
        comparative_table: subAvatars.map(sa => ({
          sub_avatar_id: sa.id,
          nickname: sa.nickname,
          tam: sa.tam_estimate,
          urgency: sa.urgency_score,
          scope: sa.scope_score,
          staying_power: sa.staying_power_score,
          recommended: sa.recommended_for_test,
        })),
        final_recommendation: {
          first_to_test: subAvatars[0].id,
          reason: subAvatars[0].recommendation_reason,
          strategy: 'Imported from external research bundle — launch order matches import order.',
        },
        metadata: {
          sources_used: [],
          total_verbatims: subAvatars.reduce((n, sa) => n + sa.verbatim_quotes.length, 0),
          total_items_scraped: 0,
          run_duration_ms: 0,
          cost_estimate_usd: 0,
          phase_timings: { discovery_ms: 0, fetch_ms: 0, analyze_ms: 0, compile_ms: 0 },
        },
      };

      const brandDNA = hydrateBrandDNA(parsed.brand_dna ?? {}, core);

      const now = new Date().toISOString();

      // Gate statuses: mark G1, G2, G3, brand-dna as approved. G4 available.
      const approvedGates: GateId[] = ['gate1', 'gate2', 'gate3', 'brand-dna'];
      const nextGateStatuses = { ...project.gateStatuses };
      for (const g of approvedGates) nextGateStatuses[g] = 'approved';
      nextGateStatuses['gate4'] = 'available';

      const updatedProject: Project = {
        ...project,
        coreAvatarInput: core,
        avatarRunResult,
        brandDNA,
        selectedSubAvatarId: subAvatars[0].id,
        targetMarket: core.market,
        targetLanguage: core.language,
        niche: core.niche,
        productDescription: core.product || project.productDescription,
        gateStatuses: nextGateStatuses,
        currentGate: 'gate4',
        startAnywhereMode: true,
        updatedAt: now,
      };
      await saveProject(updatedProject);

      // Write GateOutput entries for G1, G2, G3 so downstream gates that
      // read getAllGateOutputs() see coherent upstream data.
      const gate1Output: GateOutput = {
        gateId: 'gate1',
        projectId,
        status: 'approved',
        data: avatarRunResult as unknown as Record<string, unknown>,
        generationLog: [{
          timestamp: now,
          agent: 'lead',
          model: 'context-import',
          iteration: 1,
          input_summary: `Imported ${bundle.length} chars of external research`,
          output_summary: `${subAvatars.length} sub-avatars, ${avatarRunResult.metadata.total_verbatims} verbatims`,
          tokens_used: { input: 0, output: 0 },
        }],
        reviewResult: null,
        congruenceResult: null,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveGateOutput(gate1Output);

      // G2 / G3 — store the sub-avatar + brand snippet as their "output" so
      // downstream context aggregators have something to read. The user can
      // re-run them later if they want the full pipeline output.
      const gate2Output: GateOutput = {
        gateId: 'gate2',
        projectId,
        status: 'approved',
        data: {
          imported: true,
          sub_avatar: subAvatars[0],
          notes: parsed.import_notes ?? 'Imported from external research — Gate 2 skipped.',
        },
        generationLog: gate1Output.generationLog,
        reviewResult: null,
        congruenceResult: null,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveGateOutput(gate2Output);

      const gate3Output: GateOutput = {
        gateId: 'gate3',
        projectId,
        status: 'approved',
        data: {
          imported: true,
          mechanism_name: brandDNA.locked_terms.mechanism_name,
          mechanism_3_steps: brandDNA.locked_terms.mechanism_3_steps,
          root_cause: brandDNA.locked_terms.root_cause_one_sentence,
          notes: parsed.import_notes ?? 'Imported from external research — Gate 3 skipped.',
        },
        generationLog: gate1Output.generationLog,
        reviewResult: null,
        congruenceResult: null,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveGateOutput(gate3Output);

      router.push(`/project/${projectId}/gate/gate4`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCommitting(false);
    }
  }, [project, parsed, projectId, bundle, hintMarket, hintLanguage, hintProduct, router]);

  if (!project) {
    return <div className="p-8 text-text-muted">Loading project...</div>;
  }

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wider">
            Project · {project.name}
          </div>
          <h1 className="text-2xl font-bold text-text-primary mt-1">
            Import context bundle → skip to copy
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Already done your research? Paste your docs (avatar, VOC, brand positioning, mechanism,
            angles) and we&apos;ll parse them into the pipeline. Gates 1-3 + Brand DNA get marked
            approved, you land directly on Gate 4 (copy) with full context.
          </p>
        </div>

        {/* Hints */}
        <div className="grid grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Market (e.g. Italy)"
            value={hintMarket}
            onChange={(e) => setHintMarket(e.target.value)}
            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
          />
          <input
            type="text"
            placeholder="Language (e.g. it-IT)"
            value={hintLanguage}
            onChange={(e) => setHintLanguage(e.target.value)}
            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
          />
          <input
            type="text"
            placeholder="Product (e.g. MenoItaly menopause supplement)"
            value={hintProduct}
            onChange={(e) => setHintProduct(e.target.value)}
            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
          />
        </div>

        {/* Paste + file input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Research bundle ({bundle.length.toLocaleString()} chars)
            </label>
            <label className="cursor-pointer text-xs px-3 py-1.5 bg-bg-card border border-border rounded-md hover:border-accent-teal text-text-secondary">
              + Add .txt / .md / .csv / .json
              <input
                type="file"
                multiple
                accept=".txt,.md,.markdown,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={bundle}
            onChange={(e) => setBundle(e.target.value)}
            rows={18}
            placeholder={`Paste everything you've got: avatar profile, sub-avatars with verbatims, mechanism / root cause, brand positioning, tone guidelines, proof points, angles, hooks, competitor notes, winning copy references — anything.

Example structure (but any format works):
- Sub-Avatar "La Delusa Cronica": donna 45+, ha provato Ymea senza risultato...
- Mechanism: estrobolome 3-step (riequilibrio → depurazione → sostegno)
- Brand voice: onesta, diretta, "protocollo" not "integratore"
- Verbatims: "Il mio ginecologo mi ha detto che è normale"
- Competitors: Ymea, Femal, Estromineral
- ...`}
            className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-accent-teal resize-y"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={isParsing || bundle.trim().length < 100}
            className="px-5 py-2.5 bg-accent-teal text-white text-sm font-semibold rounded-lg hover:bg-accent-teal-hover disabled:opacity-50"
          >
            {isParsing ? 'Parsing with Claude...' : parsed ? 'Re-parse' : 'Parse bundle →'}
          </button>
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="px-4 py-2.5 text-sm text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </div>

        {/* Preview */}
        {parsed && (
          <div className="space-y-4 p-5 bg-bg-card border border-accent-teal/40 rounded-xl">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-accent-teal font-bold mb-1">
                Parsed — ready to commit
              </div>
              <h2 className="text-lg font-bold text-text-primary">
                {parsed.sub_avatars?.length ?? 0} sub-avatar(s) · BrandDNA{' '}
                {parsed.brand_dna?.locked_terms?.mechanism_name ? '✓' : '○'} mechanism
              </h2>
              {parsed.import_notes && (
                <p className="text-xs text-text-muted mt-2 italic">{parsed.import_notes}</p>
              )}
            </div>

            {/* Dropped avatars warning */}
            {(parsed.dropped_avatars?.length ?? 0) > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-yellow-400 font-bold mb-2">
                  ⚠ {parsed.dropped_avatars!.length} avatar(s) dropped (too thin)
                </div>
                <ul className="space-y-1">
                  {parsed.dropped_avatars!.map((d, i) => (
                    <li key={i} className="text-[11px] text-text-secondary">
                      <b className="text-yellow-400">{d.name}</b> — {d.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Brand DNA completeness diagnostic */}
            {parsed.brand_dna_completeness && (
              <div className={`p-3 rounded-lg border ${
                parsed.brand_dna_completeness.mechanism_found && parsed.brand_dna_completeness.root_cause_found && (parsed.brand_dna_completeness.proof_points_count ?? 0) >= 3
                  ? 'bg-green-500/10 border-green-500/40'
                  : 'bg-red-500/10 border-red-500/40'
              }`}>
                <div className="text-[10px] uppercase tracking-wider font-bold mb-2">
                  Brand DNA completeness
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>Mechanism: <span className={parsed.brand_dna_completeness.mechanism_found ? 'text-green-400' : 'text-red-400'}>{parsed.brand_dna_completeness.mechanism_found ? '✓' : '✗ missing'}</span></div>
                  <div>Root cause: <span className={parsed.brand_dna_completeness.root_cause_found ? 'text-green-400' : 'text-red-400'}>{parsed.brand_dna_completeness.root_cause_found ? '✓' : '✗ missing'}</span></div>
                  <div>Proof points: <span className={(parsed.brand_dna_completeness.proof_points_count ?? 0) >= 3 ? 'text-green-400' : 'text-red-400'}>{parsed.brand_dna_completeness.proof_points_count ?? 0}</span></div>
                  <div>Voice confidence: <span className="text-text-secondary">{parsed.brand_dna_completeness.voice_confidence ?? '—'}</span></div>
                </div>
                {(parsed.brand_dna_completeness.missing_fields?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-red-400 mt-2">
                    Missing: {parsed.brand_dna_completeness.missing_fields!.join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-bg-primary rounded-lg border border-border">
                <div className="text-[10px] uppercase text-text-muted mb-1">Core avatar</div>
                <div className="space-y-1 text-text-secondary">
                  <div><span className="text-text-muted">Desire:</span> {parsed.core?.surface_desire || '—'}</div>
                  <div><span className="text-text-muted">Niche:</span> {parsed.core?.niche || '—'}</div>
                  <div><span className="text-text-muted">Market:</span> {parsed.core?.market || '—'}</div>
                  <div><span className="text-text-muted">Lang:</span> {parsed.core?.language || '—'}</div>
                </div>
              </div>
              <div className="p-3 bg-bg-primary rounded-lg border border-border">
                <div className="text-[10px] uppercase text-text-muted mb-1">Brand DNA snapshot</div>
                <div className="space-y-1 text-text-secondary">
                  <div><span className="text-text-muted">Mechanism:</span> {parsed.brand_dna?.locked_terms?.mechanism_name || '—'}</div>
                  <div><span className="text-text-muted">Root cause:</span> {parsed.brand_dna?.locked_terms?.root_cause_one_sentence?.slice(0, 80) || '—'}</div>
                  <div><span className="text-text-muted">Tone:</span> {parsed.brand_dna?.voice_profile?.emotional_tone || '—'}</div>
                  <div><span className="text-text-muted">Proof pts:</span> {parsed.brand_dna?.locked_terms?.key_proof_points?.length ?? 0}</div>
                </div>
              </div>
            </div>

            {parsed.sub_avatars?.length ? (
              <div className="space-y-2">
                {parsed.sub_avatars.map((sa, i) => (
                  <div key={i} className="p-3 bg-bg-primary rounded-lg border border-border text-xs">
                    <div className="font-semibold text-accent-orange">
                      {sa.name || `Avatar ${i + 1}`}
                      {sa.nickname && <span className="text-text-muted font-normal"> · {sa.nickname}</span>}
                    </div>
                    <div className="text-text-secondary mt-1">{sa.description?.slice(0, 200)}</div>
                    <div className="text-[10px] text-text-muted mt-2">
                      {(sa.verbatim_quotes?.length ?? 0)} verbatims ·{' '}
                      {(sa.emotional_triggers?.length ?? 0)} triggers ·{' '}
                      {(sa.angles?.hooks?.length ?? 0)} hooks
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <button
                onClick={handleCommit}
                disabled={isCommitting || (parsed.sub_avatars?.length ?? 0) === 0}
                className="px-5 py-2.5 bg-accent-orange text-white text-sm font-semibold rounded-lg hover:bg-accent-orange-hover disabled:opacity-50"
              >
                {isCommitting ? 'Committing...' : 'Commit → go to Gate 4 (copy)'}
              </button>
              <span className="text-[10px] text-text-muted">
                Marks Gate 1/2/3/Brand DNA as approved. You can re-run any gate later.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
