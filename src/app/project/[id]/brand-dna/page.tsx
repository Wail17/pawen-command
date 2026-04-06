'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, BrandDNA } from '@/lib/types';
import { getProject, saveProject, getGateOutput } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';

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

    // Get all gate outputs for compilation
    const g1 = await getGateOutput(projectId, 'gate1');
    const g2 = await getGateOutput(projectId, 'gate2');
    const g3 = await getGateOutput(projectId, 'gate3');

    if (!g1 || !g2 || !g3) {
      alert('Gates 1, 2, and 3 must be completed before compiling Brand DNA.');
      setCompiling(false);
      return;
    }

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
- pain_quotes and desire_quotes MUST be REAL verbatim quotes from Gate 2 — minimum 5 each
- objection_quotes minimum 3
- always_use and never_use minimum 5 words each
- sub_avatars MUST match Gate 2 sub-avatars — maintain exact names and ids
- All fields MUST be populated — no empty strings, no empty arrays
- color_associations: use hex codes that emotionally match the problem/solution space`,
          userMessage: `Compile Brand DNA from these gate outputs:

=== GATE 1: PRODUCT INTELLIGENCE ===
${JSON.stringify(g1.data, null, 2)}

=== GATE 2: AVATAR DEEP DIVE ===
${JSON.stringify(g2.data, null, 2)}

=== GATE 3: ROOT CAUSE & SOLUTION MECHANISM ===
${JSON.stringify(g3.data, null, 2)}

=== PROJECT INFO ===
Product Name: ${project.name}
Target Market: ${project.targetMarket}
Target Language: ${project.targetLanguage}`,
          temperature: 0.3,
          maxTokens: 16384,
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
      let compiled: BrandDNA;

      try {
        let jsonStr = result.content;
        // Try to extract JSON from markdown fences first
        const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (fenceMatch) {
          jsonStr = fenceMatch[1];
        } else {
          // Find the outermost JSON object by matching balanced braces
          const startIdx = jsonStr.indexOf('{');
          if (startIdx !== -1) {
            let depth = 0;
            let endIdx = startIdx;
            for (let ci = startIdx; ci < jsonStr.length; ci++) {
              if (jsonStr[ci] === '{') depth++;
              else if (jsonStr[ci] === '}') { depth--; if (depth === 0) { endIdx = ci; break; } }
            }
            jsonStr = jsonStr.slice(startIdx, endIdx + 1);
          }
        }
        compiled = JSON.parse(jsonStr);
        compiled.locked = false;
        compiled.version = '1.0';
      } catch (parseErr) {
        console.error('Brand DNA parse error:', parseErr, 'Raw content:', result.content?.slice(0, 500));
        alert('Failed to parse Brand DNA JSON. Check console for details. Try re-compiling.');
        setCompiling(false);
        return;
      }

      setDna(compiled);
      setEditJson(JSON.stringify(compiled, null, 2));
      setEditing(true);

      // Save to project (unlocked)
      const updated = { ...project, brandDNA: compiled };
      await saveProject(updated);
      setProject(updated);
    } catch (error) {
      console.error('Compilation error:', error);
      alert('Compilation failed. Check console.');
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

        {/* No DNA yet */}
        {!dna && (
          <div className="text-center py-16">
            <p className="text-text-secondary mb-4">
              Complete Gates 1, 2, and 3 to compile the Brand DNA.
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
