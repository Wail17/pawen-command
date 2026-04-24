'use client';

import { useMemo, useState } from 'react';
import { GenerationLogEntry } from '@/lib/types';
import { computeGateCost, formatUSD, formatTokens } from '@/lib/pricing/gateCost';

interface GateCostBadgeProps {
  log: GenerationLogEntry[];
  gateLabel?: string;
}

export default function GateCostBadge({ log, gateLabel }: GateCostBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const cost = useMemo(() => computeGateCost(log), [log]);

  if (cost.totalUSD === 0 && cost.totalInputTokens === 0) return null;

  const layers = [
    { key: 'subAgent', label: 'Sub-agents', data: cost.byLayer.subAgent },
    { key: 'manager', label: 'Manager', data: cost.byLayer.manager },
    { key: 'lead', label: 'Lead compiler', data: cost.byLayer.lead },
    { key: 'director', label: 'Director (Léa)', data: cost.byLayer.director },
    { key: 'reviewer', label: 'Reviewer', data: cost.byLayer.reviewer },
    { key: 'congruence', label: 'Congruence', data: cost.byLayer.congruence },
    { key: 'generator', label: 'Generator', data: cost.byLayer.generator },
  ].filter(l => l.data.calls > 0);

  return (
    <div className="mb-4 p-3 bg-bg-card border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-bold text-accent-orange">
            {formatUSD(cost.totalUSD)}
          </span>
          <span className="text-xs text-text-muted">
            {gateLabel ? `${gateLabel} · ` : ''}
            {cost.iterations} iteration{cost.iterations > 1 ? 's' : ''} ·{' '}
            {formatTokens(cost.totalInputTokens)} in / {formatTokens(cost.totalOutputTokens)} out
          </span>
          {cost.iterations > 1 && (
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
              Looped — check why
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div>
            <div className="text-[10px] uppercase text-text-muted mb-1.5">By agent layer</div>
            <div className="space-y-1">
              {layers.map(l => (
                <div key={l.key} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {l.label} <span className="text-text-muted">({l.data.calls} call{l.data.calls > 1 ? 's' : ''})</span>
                  </span>
                  <span className="font-mono text-text-primary">
                    {formatUSD(l.data.usd)}{' '}
                    <span className="text-text-muted">
                      · {formatTokens(l.data.input)}/{formatTokens(l.data.output)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase text-text-muted mb-1.5 mt-2">By model</div>
            <div className="space-y-1">
              {Object.entries(cost.byModel).map(([model, d]) => (
                <div key={model} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {model} <span className="text-text-muted">({d.calls} call{d.calls > 1 ? 's' : ''})</span>
                  </span>
                  <span className="font-mono text-text-primary">{formatUSD(d.usd)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 mt-2 border-t border-border text-[11px] text-text-muted leading-relaxed">
            <strong className="text-text-secondary">Pourquoi ce coût:</strong>{' '}
            {cost.iterations > 1
              ? `${cost.iterations} itérations (review loop) — l'output a été re-généré pour atteindre le score requis. `
              : `1 itération clean — passé au premier run. `}
            {cost.byLayer.subAgent.calls > 0 && `${cost.byLayer.subAgent.calls} sub-agents en parallèle. `}
            {cost.byLayer.lead.calls > 0 && `Lead compiler merge tous les outputs. `}
            Tokens facturés aux prix Anthropic (Opus $5/$25 per M, Sonnet $3/$15 per M).
          </div>
        </div>
      )}
    </div>
  );
}
