'use client';

import { useState } from 'react';
import type { Project, GateId } from '@/lib/types';
import { saveProject } from '@/lib/store/db';
import { GATE_GENERATION_SCHEMAS, estimateGateCost } from '@/lib/gates/generationConfigSchemas';

interface Props {
  gateId: GateId;
  project: Project;
  onSaved: (updated: Project) => void;
}

export default function GateGenerationConfigPanel({ gateId, project, onSaved }: Props) {
  const schema = GATE_GENERATION_SCHEMAS[gateId];
  const savedValues = (project.gateConfigs?.[gateId] ?? {}) as Record<string, number | undefined>;

  const initial: Record<string, number> = {};
  for (const k of schema?.knobs ?? []) {
    const v = savedValues[k.key];
    initial[k.key] = typeof v === 'number' && !isNaN(v) ? v : k.default;
  }
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [saving, setSaving] = useState(false);

  if (!schema) return null;

  const { total, baseline, knobsCost } = estimateGateCost(gateId, values);

  const update = async (key: string, value: number) => {
    const knob = schema.knobs.find(k => k.key === key);
    if (!knob) return;
    const clamped = Math.min(knob.max, Math.max(knob.min, value));
    const next = { ...values, [key]: clamped };
    setValues(next);
    setSaving(true);
    const updated: Project = {
      ...project,
      gateConfigs: { ...(project.gateConfigs ?? {}), [gateId]: next },
      updatedAt: new Date().toISOString(),
    };
    await saveProject(updated);
    onSaved(updated);
    setSaving(false);
  };

  return (
    <div className="p-4 bg-bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">Generation config</div>
          <div className="text-[11px] text-text-muted">
            {schema.knobs.length > 0
              ? 'Ajuste les quantités — le coût se met à jour en live. Sauvegardé sur le projet.'
              : 'Pas de knobs sur ce gate. Estimation de coût uniquement.'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-text-muted">Est. cost</div>
          <div className="text-2xl font-bold text-accent-orange font-mono">${total.toFixed(2)}</div>
          {knobsCost > 0 && (
            <div className="text-[10px] text-text-muted font-mono">
              base ${baseline.toFixed(2)} + knobs ${knobsCost.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {schema.knobs.length > 0 && (
        <div className="space-y-1">
          {schema.knobs.map(knob => {
            const v = values[knob.key] ?? knob.default;
            return (
              <div key={knob.key} className="flex items-center justify-between gap-3 py-2 border-t border-border/50 first:border-t-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary">{knob.label}</div>
                  <div className="text-[11px] text-text-muted">{knob.hint}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => update(knob.key, v - 1)}
                    disabled={v <= knob.min || saving}
                    className="w-7 h-7 rounded bg-bg-elevated border border-border text-text-primary hover:bg-bg-hover disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-mono text-accent-orange">{v}</span>
                  <button
                    type="button"
                    onClick={() => update(knob.key, v + 1)}
                    disabled={v >= knob.max || saving}
                    className="w-7 h-7 rounded bg-bg-elevated border border-border text-text-primary hover:bg-bg-hover disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 mt-3 border-t border-border text-[11px] text-text-muted leading-relaxed">
        Baseline = coût observé avec valeurs par défaut (sub-agents + lead + director inclus).
        Chaque +1 au-dessus du défaut ajoute son coût unitaire.
        Itérations (review fail → re-gen) ajoutent +60-100% sur le total.
        {gateId === 'gate8' && <> Coûts fal.ai pour la génération d&apos;images <strong>non inclus</strong> (≈ $0.05/image).</>}
      </div>
    </div>
  );
}
