'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, BrandDNA } from '@/lib/types';
import { getProject, saveProject, getGateOutput } from '@/lib/store/db';
import { extractJSON } from '@/lib/util/extractJson';
import Pipeline from '@/components/ui/Pipeline';
import { notifyGateStart, notifyGateEnd, notifyGateError, extractPreview } from '@/lib/notifications/discord';

export default function BrandDNAPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const p = await getProject(projectId);
    if (!p) { router.push('/'); return; }
    setProject(p);
    if (p.brandDNA) setDna(p.brandDNA);
    setLoading(false);
  }, [projectId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCompile = useCallback(async () => {
    if (!project) return;
    setCompiling(true);
    const __bdnaStart = Date.now();
    notifyGateStart('brand-dna', project.id, project.name);

    // Get downstream gate outputs for compilation
    const g2 = await getGateOutput(projectId, 'gate2');
    const g3 = await getGateOutput(projectId, 'gate3');

    // Gate 1 (Avatar Excavation) lives BOTH on the project (avatarRunResult)
    // and as a GateOutput. Use the project copy as the canonical truth so
    // we get the typed structure with sub_avatars + verbatims + angles.
    const avatarRun = project.avatarRunResult;

    // Reverse-engineered competitor funnel carries its own mechanism + copy arsenal.
    // When present, it compensates for G2/G3 so we relax the blocker.
    const reverse = project.competitorIntel?.reverseEngineered;

    if (!avatarRun) {
      alert('Gate 1 (Avatar Excavation) must be completed before compiling Brand DNA.');
      setCompiling(false);
      return;
    }
    if (!reverse && (!g2 || !g3)) {
      alert('Gate 2 and Gate 3 must be completed before compiling Brand DNA — or start from a reverse-engineered competitor funnel.');
      setCompiling(false);
      return;
    }

    // Pull the selected sub-avatar's deep enrichments (deep_dives, awareness_variants,
    // swipe_vocabulary) so the Brand DNA inherits every drop of context from Gate 1.
    const selectedSubAvatar =
      avatarRun.sub_avatars.find(sa => sa.id === project.selectedSubAvatarId) ??
      avatarRun.sub_avatars[0];

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          systemPrompt: `You are compiling a Brand DNA document from Gates 1-3 research outputs.

OUTPUT: A single valid JSON object. No markdown fences, no explanations, no text before or after — ONLY the JSON object.

EXACT SCHEMA (follow every field name and type precisely):
{
  "version": "1.0",
  "locked": false,
  "product_name": "string",
  "brand_name": "string",
  "target_market": "string",
  "target_language": "string",
  "locked_terms": {
    "mechanism_name": "EXACT brandable name from Gate 3",
    "root_cause_one_sentence": "one sentence root cause",
    "belief_error": "old belief vs new reality in one line",
    "mechanism_3_steps": [
      { "step": 1, "name": "Step Name", "description": "what happens" },
      { "step": 2, "name": "Step Name", "description": "what happens" },
      { "step": 3, "name": "Step Name", "description": "what happens" }
    ],
    "product_descriptor": "one-line product description",
    "key_proof_points": ["proof 1", "proof 2", "proof 3"],
    "guarantee_wording": "exact guarantee text"
  },
  "customer_language": {
    "pain_quotes": [{ "quote": "exact quote", "source": "where from", "emotion": "primary emotion", "sub_avatar_id": "avatar id" }],
    "desire_quotes": [{ "quote": "exact quote", "source": "where from", "depth": "surface/identity/transformation" }],
    "objection_quotes": [{ "quote": "exact objection", "handler": "how to address it" }],
    "always_use": ["word1", "word2"],
    "never_use": ["word1", "word2"],
    "conditional_use": [{ "term": "word", "allowed_in": ["context1"], "forbidden_in": ["context2"] }]
  },
  "emotional_arc": {
    "primary_emotion": "dominant emotion",
    "secondary_emotion": "supporting emotion",
    "resolution_emotion": "after transformation",
    "funnel_arc": [{ "touchpoint": "ad/advertorial/lp", "emotion": "emotion name", "intensity": 7 }],
    "awareness_progression": { "ad_level": "awareness stage", "advertorial_journey": "awareness journey", "lp_level": "awareness stage" }
  },
  "voice_profile": {
    "vocabulary": ["word1", "word2", "...20-30 specific words they use"],
    "sentence_style": "description of sentence patterns",
    "formality_level": 3,
    "emotional_tone": "dominant emotional state",
    "phrases_to_use": ["phrase1", "phrase2", "...10+ natural phrases"],
    "phrases_to_avoid": ["phrase1", "phrase2", "...10+ off-putting phrases"],
    "sample_paragraph": "5 sentences about their problem in THEIR voice"
  },
  "visual_identity": {
    "metaphor": "primary visual metaphor or null",
    "color_associations": { "problem": "#hex", "solution": "#hex", "brand": "#hex" },
    "product_image_rules": ["rule 1", "rule 2"]
  },
  "sub_avatars": [
    {
      "id": "sa1",
      "name": "Full Name",
      "nickname": "Short Name",
      "urgency_score": 8,
      "launch_order": 1,
      "tam": "estimated TAM",
      "trigger_moment": "when they buy",
      "primary_angle": { "name": "angle name", "description": "angle description" },
      "secondary_angles": [{ "name": "angle name", "description": "angle description" }]
    }
  ]
}

RULES:
- mechanism_name MUST be the EXACT brandable name from Gate 3 solution_mechanism.name
- mechanism_3_steps MUST be the EXACT 3 steps from Gate 3 — do NOT rephrase
- pain_quotes MUST be REAL verbatim quotes pulled DIRECTLY from Gate 1 sub_avatars[].verbatim_quotes — keep the exact wording, the source URL, and the sub_avatar id. Minimum 5.
- desire_quotes MUST be REAL verbatim quotes from Gate 2 OR derived from Gate 1 emotional_triggers — minimum 5
- objection_quotes minimum 3
- always_use and never_use minimum 5 words each
- sub_avatars: use the EXACT list from Gate 1 (Avatar Excavation) — keep their ids, names, nicknames, urgency_score, launch_order, tam_estimate (→tam), and convert their angles.positioning into primary_angle and angles.hooks into secondary_angles. DO NOT invent new sub-avatars.
- All fields MUST be populated — no empty strings, no empty arrays
- color_associations: use hex codes that emotionally match the problem/solution space
- IF a reverse-engineered competitor funnel is present, it is AUTHORITATIVE context: its mechanism_name, three_steps, root_cause, belief_error and copy_arsenal hooks/headlines are proven-in-market. Use them as the anchor for locked_terms and preserve their wording verbatim. Sub-avatar angles MUST stay consistent with the competitor's positioning.
- IF deep_dives[] or awareness_variants[] exist on the selected sub-avatar, harvest them: deep-dive hidden_fears → additional pain_quotes, buying_objections → objection_quotes, awareness-variant headlines → phrases_to_use, awareness-variant language notes → voice_profile.vocabulary.
- NEVER drop context that exists upstream. If a verbatim, mechanism step, fear, or objection exists in the inputs, it MUST survive into the Brand DNA in SOME field.`,
          userMessage: `Compile Brand DNA from these gate outputs:

=== GATE 1: AVATAR EXCAVATION (canonical sub-avatars + verbatims) ===
Core avatar input:
${JSON.stringify(avatarRun.core_avatar, null, 2)}

Sub-avatars (use these EXACT ids and nicknames in brand_dna.sub_avatars):
${JSON.stringify(avatarRun.sub_avatars.map(sa => ({
  id: sa.id,
  name: sa.name,
  nickname: sa.nickname,
  description: sa.description,
  urgency_score: sa.urgency_score,
  launch_order: sa.launch_order,
  tam: sa.tam_estimate,
  trigger_moment: sa.emotional_triggers?.[0] ?? '',
  primary_angle: {
    name: sa.angles?.positioning?.framework ?? '',
    description: sa.angles?.positioning?.description ?? '',
  },
  hooks: sa.angles?.hooks ?? [],
  story_angle: sa.angles?.story_angle ?? null,
  verbatim_quotes: sa.verbatim_quotes ?? [],
  emotional_triggers: sa.emotional_triggers ?? [],
})), null, 2)}

Final recommendation: ${JSON.stringify(avatarRun.final_recommendation, null, 2)}

=== SELECTED SUB-AVATAR DEEP ENRICHMENTS (Phase F/E/P — DO NOT DROP) ===
Selected sub-avatar id: ${selectedSubAvatar?.id ?? 'N/A'}
Selected funnel position: ${project.selectedFunnel ?? 'N/A'}
Deep dives (${selectedSubAvatar?.deep_dives?.length ?? 0}):
${JSON.stringify(selectedSubAvatar?.deep_dives ?? [], null, 2)}
Awareness variants (${selectedSubAvatar?.awareness_variants?.length ?? 0}):
${JSON.stringify(selectedSubAvatar?.awareness_variants ?? [], null, 2)}

${reverse ? `=== COMPETITOR INTEL — REVERSE-ENGINEERED FUNNEL (AUTHORITATIVE) ===
This funnel is proven in market. Its mechanism, copy arsenal and insights MUST anchor the Brand DNA.
Competitor brand: ${reverse.competitor_brand}
Competitor URL: ${reverse.competitor_url}

Mechanism (use as locked_terms.mechanism_name + mechanism_3_steps):
${JSON.stringify(reverse.mechanism, null, 2)}

Avatar profile (merge with Gate 1 sub-avatars):
${JSON.stringify(reverse.sub_avatar, null, 2)}

Copy arsenal (harvest hooks → phrases_to_use, emotional_triggers → customer_language, proof_points → key_proof_points, guarantee_angle → guarantee_wording):
${JSON.stringify(reverse.copy_arsenal, null, 2)}

Creative strategy (seed visual_identity):
${JSON.stringify(reverse.creative_strategy, null, 2)}

Funnel structure:
${JSON.stringify(reverse.funnel_structure, null, 2)}

Strategic insights (angles_to_steal → primary_angle seeds, angles_to_avoid → phrases_to_avoid):
${JSON.stringify(reverse.insights, null, 2)}
` : ''}
${g2 ? `=== GATE 2: AVATAR DEEP DIVE ===
${JSON.stringify(g2.data, null, 2)}
` : '=== GATE 2: NOT RUN (using reverse-engineered funnel instead) ===\n'}
${g3 ? `=== GATE 3: ROOT CAUSE & SOLUTION MECHANISM ===
${JSON.stringify(g3.data, null, 2)}
` : '=== GATE 3: NOT RUN (mechanism comes from reverse-engineered funnel above) ===\n'}
=== PROJECT INFO ===
Product Name: ${project.name}
Target Market: ${project.targetMarket}
Target Language: ${project.targetLanguage}
${project.shopifyData ? `
=== SHOPIFY PRODUCT DATA (USE REAL DATA) ===
Product: ${project.shopifyData.productTitle}
Price: ${project.shopifyData.currency === 'EUR' ? '€' : '$'}${project.shopifyData.price ?? 'N/A'}${project.shopifyData.compareAtPrice ? ` (was ${project.shopifyData.currency === 'EUR' ? '€' : '$'}${project.shopifyData.compareAtPrice})` : ''}
Vendor: ${project.shopifyData.vendor || 'N/A'}
Type: ${project.shopifyData.productType || 'N/A'}
Tags: ${project.shopifyData.tags.join(', ')}
Variants: ${project.shopifyData.variants.map(v => v.title + ' ($' + v.price + ')').join(', ')}
Reviews: ${project.shopifyData.reviewStats?.totalReviews ?? 0} reviews, avg ${project.shopifyData.reviewStats?.averageRating ?? '?'}/5
Top Reviews:
${project.shopifyData.reviews.filter(r => r.rating >= 4).slice(0, 5).map(r => `★${r.rating} "${r.body.slice(0, 150)}" — ${r.author}`).join('\n')}

IMPORTANT: Use REAL product name, REAL price, and REAL review quotes in the Brand DNA. The product_descriptor should match the actual product. proof_points should reference real review data.` : ''}`,
          temperature: 0.3,
          maxTokens: 32000,
          cacheControl: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
        alert(`API Error: ${errorData.message || 'Failed to call Claude API'}`);
        setCompiling(false);
        return;
      }

      const result = await response.json();

      // Cascading parse: strict → balanced → jsonrepair (handles truncated output)
      const parsed = extractJSON<BrandDNA>(result.content ?? '');
      if (!parsed) {
        console.error('Brand DNA parse error. Raw content (head):', (result.content ?? '').slice(0, 800));
        console.error('Brand DNA raw content (tail):', (result.content ?? '').slice(-500));
        alert('Failed to parse Brand DNA JSON even with repair. Check console for details. Try re-compiling.');
        setCompiling(false);
        return;
      }
      const compiled: BrandDNA = { ...parsed, locked: false, version: '1.0' };

      // Auto-populate product_specs + proof_inventory from Shopify data
      if (project.shopifyData) {
        const sd = project.shopifyData;
        compiled.product_specs = {
          price: sd.price ?? '0',
          compare_at_price: sd.compareAtPrice ?? undefined,
          currency: sd.currency ?? 'USD',
          price_position: sd.pricePosition ?? 'mid',
          product_format: sd.productFormat ?? sd.productType ?? '',
          key_features: sd.tags.slice(0, 10),
          key_benefits: [],  // will be enriched by the LLM in the compiled output
          guarantee_days: undefined,
          shipping_info: undefined,
          available_variants: sd.variants.map(v => ({
            name: v.title,
            price: v.price,
            available: v.available,
          })),
          product_images: sd.images.map(img => img.src),
        };
        if (sd.reviews.length > 0) {
          compiled.proof_inventory = {
            testimonials: sd.reviews
              .filter(r => r.rating >= 4 && r.body.length > 20)
              .slice(0, 15)
              .map(r => ({
                text: r.body.slice(0, 300),
                author: r.author,
                rating: r.rating,
                verified: true,
              })),
            average_rating: sd.reviewStats?.averageRating,
            total_reviews: sd.reviewStats?.totalReviews,
            data_points: [],
          };
        }
      }

      setDna(compiled);
      setEditJson(JSON.stringify(compiled, null, 2));
      setEditing(true);

      // Save to project (unlocked)
      const updated = { ...project, brandDNA: compiled };
      await saveProject(updated);
      setProject(updated);

      notifyGateEnd({
        gateId: 'brand-dna',
        projectId: project.id,
        projectName: project.name,
        durationMs: Date.now() - __bdnaStart,
        preview: extractPreview('brand-dna', compiled as unknown as Record<string, unknown>),
        status: 'pending_decisions',
      });
    } catch (error) {
      console.error('Compilation error:', error);
      alert('Compilation failed. Check console.');
      notifyGateError({
        gateId: 'brand-dna',
        projectId: project.id,
        projectName: project.name,
        durationMs: Date.now() - __bdnaStart,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setCompiling(false);
    }
  }, [project, projectId]);

  const handleLock = useCallback(async () => {
    if (!project || !dna) return;

    // Parse edited JSON if in edit mode
    let finalDna = dna;
    if (editing && editJson) {
      try {
        finalDna = JSON.parse(editJson);
      } catch {
        alert('Invalid JSON. Fix before locking.');
        return;
      }
    }

    finalDna = { ...finalDna, locked: true };
    const updated = {
      ...project,
      brandDNA: finalDna,
      gateStatuses: { ...project.gateStatuses, 'brand-dna': 'approved' as const, 'gate4': 'available' as const },
    };

    await saveProject(updated);
    setProject(updated);
    setDna(finalDna);
    setEditing(false);
  }, [project, dna, editing, editJson]);

  const handleUnlock = useCallback(async () => {
    if (!project || !dna) return;
    const unlocked = { ...dna, locked: false };
    const updated = { ...project, brandDNA: unlocked };
    await saveProject(updated);
    setProject(updated);
    setDna(unlocked);
  }, [project, dna]);

  // ======================================================================
  // Upload PDF / Markdown / .txt → extract text → /api/context/import →
  // populated BrandDNA → save to project (unlocked, user reviews then locks).
  // Mirrors the import-context flow but scoped to Brand DNA only — used when
  // the user already has a brand brief / pitch deck / founder memo and wants
  // to skip the gate compile path.
  // ======================================================================
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!project) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadStatus(`Extracting "${file.name}"…`);

    try {
      // Step 1: extract text via /api/extract/file (handles PDF + .md + .txt)
      const extractForm = new FormData();
      extractForm.append('file', file);
      const extractRes = await fetch('/api/extract/file', {
        method: 'POST',
        credentials: 'same-origin',
        body: extractForm,
      });
      const extractJson = await extractRes.json().catch(() => ({}));
      if (!extractRes.ok || !extractJson.ok) {
        throw new Error(extractJson.message ?? `extract failed (${extractRes.status})`);
      }
      const extractedText: string = extractJson.text;
      const charCount: number = extractJson.charCount;
      const pageCount: number | undefined = extractJson.pageCount;
      setUploadStatus(`Extracted ${charCount.toLocaleString()} chars${pageCount ? ` from ${pageCount} pages` : ''}. Parsing into Brand DNA…`);

      // Step 2: feed the extracted text to the existing /api/context/import
      // pipeline which already handles BrandDNA-shaped output.
      const bundle = `=== ${file.name} ===\n${extractedText}`;
      const importRes = await fetch('/api/context/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle,
          hints: {
            market: project.targetMarket || '',
            language: project.targetLanguage || '',
            product: project.productDescription || project.name || '',
          },
        }),
      });
      const importJson = await importRes.json().catch(() => ({}));
      if (!importRes.ok || !importJson.ok || !importJson.parsed) {
        throw new Error(importJson.message ?? `parse failed (${importRes.status})`);
      }

      // Step 3: hydrate + save BrandDNA. We only care about brand_dna here
      // (not core/sub_avatars — those belong to import-context's broader flow).
      // Fill missing required fields with sane defaults so the UI doesn't
      // crash on partial extractions.
      const parsed = importJson.parsed.brand_dna ?? {};
      const merged: BrandDNA = {
        version: '1.0',
        locked: false,
        product_name: parsed.product_name ?? project.productDescription ?? project.name ?? '',
        brand_name: parsed.brand_name ?? project.name ?? '',
        target_market: parsed.target_market ?? project.targetMarket ?? '',
        target_language: parsed.target_language ?? project.targetLanguage ?? '',
        locked_terms: parsed.locked_terms ?? {
          mechanism_name: '',
          root_cause_one_sentence: '',
          belief_error: '',
          mechanism_3_steps: [],
          product_descriptor: '',
          key_proof_points: [],
          guarantee_wording: '',
        },
        customer_language: parsed.customer_language ?? {
          pain_quotes: [],
          desire_quotes: [],
          objection_quotes: [],
          always_use: [],
          never_use: [],
          conditional_use: [],
        },
        emotional_arc: parsed.emotional_arc ?? {
          primary_emotion: '',
          secondary_emotion: '',
          resolution_emotion: '',
          funnel_arc: [],
          awareness_progression: { ad_level: '', advertorial_journey: '', lp_level: '' },
        },
        voice_profile: parsed.voice_profile ?? {
          vocabulary: [],
          sentence_style: '',
          formality_level: 5,
          emotional_tone: '',
          phrases_to_use: [],
          phrases_to_avoid: [],
          sample_paragraph: '',
        },
        visual_identity: parsed.visual_identity ?? {
          metaphor: null,
          color_associations: { problem: '', solution: '', brand: '' },
          product_image_rules: [],
        },
        product_specs: parsed.product_specs,
        proof_inventory: parsed.proof_inventory,
        sub_avatars: parsed.sub_avatars ?? [],
      };

      const updated = { ...project, brandDNA: merged };
      await saveProject(updated);
      setProject(updated);
      setDna(merged);
      setEditJson(JSON.stringify(merged, null, 2));
      setEditing(true);
      setUploadStatus(`✓ Brand DNA built from ${file.name} — review the JSON below, edit if needed, then Lock to deploy.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[brand-dna upload]', msg);
      setUploadError(msg);
      setUploadStatus(null);
    } finally {
      setUploading(false);
    }
  }, [project]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} activeGate="brand-dna" />

      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🧬</span>
            <h1 className="text-xl font-bold text-text-primary">Brand DNA</h1>
            {dna?.locked && (
              <span className="px-2 py-1 bg-success/20 text-success text-xs rounded-md font-semibold">
                🔒 LOCKED
              </span>
            )}
          </div>
          <p className="text-text-secondary text-sm">
            Single source of truth — compiled from Gates 1-3, used by Gates 4-9.
          </p>
        </div>

        {/* Upload widget — always visible, both for first-build and
            re-import. Accepts PDF/.md/.txt/.csv. */}
        <div className="mb-6 p-5 border border-dashed border-border rounded-xl bg-bg-secondary/40">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                📄 Import depuis un fichier (PDF / Markdown / Texte)
              </h3>
              <p className="text-xs text-text-secondary">
                Brief de marque, pitch deck, mémo fondateur, transcript… extraction automatique → Brand DNA.
              </p>
            </div>
            <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap ${uploading ? 'bg-bg-tertiary text-text-secondary cursor-wait' : 'bg-accent-blue text-white hover:bg-accent-blue/90'}`}>
              {uploading ? 'Traitement…' : 'Choisir un fichier'}
              <input
                type="file"
                accept=".pdf,.md,.markdown,.txt,.csv,application/pdf,text/markdown,text/plain"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          {uploadStatus && (
            <p className="text-xs text-text-primary mt-2 px-3 py-2 bg-bg-tertiary/40 rounded-md">
              {uploadStatus}
            </p>
          )}
          {uploadError && (
            <p className="text-xs text-error mt-2 px-3 py-2 bg-error/10 rounded-md">
              ❌ {uploadError}
            </p>
          )}
        </div>

        {/* No DNA yet */}
        {!dna && (
          <div className="text-center py-16">
            <p className="text-text-secondary mb-4">
              Complete Gates 1, 2, and 3 to compile the Brand DNA — or import from a file above.
            </p>
            <button
              onClick={handleCompile}
              disabled={compiling}
              className="px-8 py-3 bg-accent-orange text-white font-semibold rounded-xl hover:bg-accent-orange-hover disabled:opacity-50"
            >
              {compiling ? 'Compiling...' : 'Compile Brand DNA'}
            </button>
          </div>
        )}

        {/* DNA exists */}
        {dna && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {!dna.locked && (
                <>
                  <button
                    onClick={() => { setEditing(true); setEditJson(JSON.stringify(dna, null, 2)); }}
                    className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleCompile}
                    disabled={compiling}
                    className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm disabled:opacity-50"
                  >
                    🔄 Re-compile
                  </button>
                  <button
                    onClick={handleLock}
                    className="px-6 py-2 bg-success text-white font-semibold rounded-lg hover:bg-success/90 text-sm"
                  >
                    🔒 Lock Brand DNA
                  </button>
                </>
              )}
              {dna.locked && (
                <button
                  onClick={handleUnlock}
                  className="px-4 py-2 border border-warning rounded-lg text-warning hover:bg-warning/10 text-sm"
                >
                  🔓 Unlock for Editing
                </button>
              )}
            </div>

            {/* Edit mode */}
            {editing && !dna.locked && (
              <div className="bg-bg-card border border-accent-teal/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-accent-teal mb-3">Edit Brand DNA (JSON)</h3>
                <textarea
                  value={editJson}
                  onChange={(e) => setEditJson(e.target.value)}
                  rows={30}
                  className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-xs font-mono focus:outline-none focus:border-accent-teal resize-y"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(editJson);
                        setDna(parsed);
                        setEditing(false);
                        // Save
                        if (project) {
                          const updated = { ...project, brandDNA: parsed };
                          saveProject(updated);
                          setProject(updated);
                        }
                      } catch {
                        alert('Invalid JSON');
                      }
                    }}
                    className="px-4 py-2 bg-accent-teal text-white rounded-lg text-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-border rounded-lg text-text-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* DNA Display (card view) */}
            {!editing && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Locked Terms */}
                <DNACard title="🔒 Locked Terms" accent="orange">
                  <DNAField label="Mechanism Name" value={dna.locked_terms.mechanism_name} highlight />
                  <DNAField label="Root Cause" value={dna.locked_terms.root_cause_one_sentence} />
                  <DNAField label="Belief Error" value={dna.locked_terms.belief_error} />
                  <DNAField label="Product Descriptor" value={dna.locked_terms.product_descriptor} />
                  <div className="mt-2">
                    <p className="text-xs text-text-muted mb-1">3-Step Mechanism:</p>
                    {dna.locked_terms.mechanism_3_steps.map((s) => (
                      <div key={s.step} className="flex gap-2 text-xs mb-1">
                        <span className="text-accent-orange font-mono">#{s.step}</span>
                        <span className="text-text-primary font-medium">{s.name}:</span>
                        <span className="text-text-secondary">{s.description}</span>
                      </div>
                    ))}
                  </div>
                </DNACard>

                {/* Customer Language */}
                <DNACard title="💬 Customer Language" accent="teal">
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted">
                      Pain quotes: {dna.customer_language.pain_quotes.length} |
                      Desire quotes: {dna.customer_language.desire_quotes.length} |
                      Objections: {dna.customer_language.objection_quotes.length}
                    </p>
                    <div>
                      <p className="text-xs text-success mb-1">Always use:</p>
                      <div className="flex flex-wrap gap-1">
                        {dna.customer_language.always_use.map((w, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-success/20 text-success rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-error mb-1">Never use:</p>
                      <div className="flex flex-wrap gap-1">
                        {dna.customer_language.never_use.map((w, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-error/20 text-error rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </DNACard>

                {/* Voice Profile */}
                {dna.voice_profile && (
                  <DNACard title="🗣️ Voice Profile" accent="teal">
                    <DNAField label="Formality" value={`${dna.voice_profile.formality_level}/10`} />
                    <DNAField label="Emotional Tone" value={dna.voice_profile.emotional_tone} />
                    <DNAField label="Sentence Style" value={dna.voice_profile.sentence_style} />
                    <div className="mt-2">
                      <p className="text-xs text-text-muted mb-1">Sample paragraph:</p>
                      <p className="text-xs text-text-secondary italic bg-bg-primary p-2 rounded">
                        {dna.voice_profile.sample_paragraph}
                      </p>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-success mb-1">Use these phrases:</p>
                      <div className="flex flex-wrap gap-1">
                        {dna.voice_profile.phrases_to_use.slice(0, 8).map((p: string, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-success/20 text-success rounded">{p}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-error mb-1">Avoid these phrases:</p>
                      <div className="flex flex-wrap gap-1">
                        {dna.voice_profile.phrases_to_avoid.slice(0, 8).map((p: string, i: number) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 bg-error/20 text-error rounded">{p}</span>
                        ))}
                      </div>
                    </div>
                  </DNACard>
                )}

                {/* Emotional Arc */}
                <DNACard title="🎭 Emotional Arc" accent="orange">
                  <DNAField label="Primary Emotion" value={dna.emotional_arc.primary_emotion} />
                  <DNAField label="Secondary Emotion" value={dna.emotional_arc.secondary_emotion} />
                  <DNAField label="Resolution" value={dna.emotional_arc.resolution_emotion} />
                  {dna.emotional_arc.funnel_arc.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dna.emotional_arc.funnel_arc.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-text-muted w-20">{f.touchpoint}</span>
                          <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                            <div className="h-full bg-accent-orange rounded-full" style={{ width: `${f.intensity * 10}%` }} />
                          </div>
                          <span className="text-text-secondary">{f.emotion}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </DNACard>

                {/* Sub-Avatars */}
                <DNACard title="��� Sub-Avatars" accent="teal">
                  {dna.sub_avatars.map((sa) => (
                    <div key={sa.id} className="p-2 bg-bg-primary rounded-lg mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{sa.nickname || sa.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-accent-orange/20 text-accent-orange rounded">
                          Urgency: {sa.urgency_score}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        #{sa.launch_order} | {sa.primary_angle.name}
                      </p>
                    </div>
                  ))}
                </DNACard>

                {/* Visual Identity */}
                <DNACard title="🎨 Visual Identity" accent="orange">
                  <DNAField label="Metaphor" value={dna.visual_identity.metaphor || 'None'} />
                  <div className="flex gap-3 mt-2">
                    <ColorSwatch label="Problem" color={dna.visual_identity.color_associations.problem} />
                    <ColorSwatch label="Solution" color={dna.visual_identity.color_associations.solution} />
                    <ColorSwatch label="Brand" color={dna.visual_identity.color_associations.brand} />
                  </div>
                </DNACard>

                {/* Meta */}
                <DNACard title="📋 Meta" accent="teal">
                  <DNAField label="Product" value={dna.product_name} />
                  <DNAField label="Brand" value={dna.brand_name} />
                  <DNAField label="Market" value={dna.target_market} />
                  <DNAField label="Language" value={dna.target_language} />
                  <DNAField label="Version" value={dna.version} />
                </DNACard>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DNACard({ title, accent, children }: { title: string; accent: 'orange' | 'teal'; children: React.ReactNode }) {
  return (
    <div className={`bg-bg-card border rounded-xl p-4 ${accent === 'orange' ? 'border-accent-orange/20' : 'border-accent-teal/20'}`}>
      <h3 className={`text-sm font-semibold mb-3 ${accent === 'orange' ? 'text-accent-orange' : 'text-accent-teal'}`}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DNAField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="mb-2">
      <span className="text-xs text-text-muted">{label}: </span>
      <span className={`text-xs ${highlight ? 'text-accent-orange font-semibold' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: color }} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
