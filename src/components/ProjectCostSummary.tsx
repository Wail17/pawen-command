'use client';

import { useEffect, useState } from 'react';
import { getAllGateOutputs } from '@/lib/store/db';
import { computeGateCost, formatUSD, formatTokens } from '@/lib/pricing/gateCost';
import { GATE_LABELS } from '@/lib/store/project-utils';
import type { GateId } from '@/lib/types';

interface ProjectCostSummaryProps {
  projectId: string;
  funnelLabel?: string;
}

interface GateCostRow {
  gateId: GateId;
  label: string;
  usd: number;
  input: number;
  output: number;
  iterations: number;
}

export default function ProjectCostSummary({ projectId, funnelLabel }: ProjectCostSummaryProps) {
  const [rows, setRows] = useState<GateCostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const outputs = await getAllGateOutputs(projectId);
      const next: GateCostRow[] = [];
      let sum = 0;
      for (const out of outputs) {
        if (!out.generationLog?.length) continue;
        const c = computeGateCost(out.generationLog);
        if (c.totalUSD === 0) continue;
        next.push({
          gateId: out.gateId,
          label: GATE_LABELS[out.gateId] ?? out.gateId,
          usd: c.totalUSD,
          input: c.totalInputTokens,
          output: c.totalOutputTokens,
          iterations: c.iterations,
        });
        sum += c.totalUSD;
      }
      next.sort((a, b) => a.gateId.localeCompare(b.gateId));
      setRows(next);
      setTotal(sum);
    })();
  }, [projectId]);

  if (rows.length === 0) return null;

  return (
    <div className="p-4 bg-bg-card border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs uppercase text-text-muted">Total AI cost{funnelLabel ? ` · ${funnelLabel}` : ''}</span>
          <span className="text-2xl font-bold text-accent-orange">{formatUSD(total)}</span>
          <span className="text-xs text-text-muted">
            {rows.length} gate{rows.length > 1 ? 's' : ''} runs
          </span>
        </div>
        <span className="text-xs text-text-muted">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {rows.map(r => (
            <div key={r.gateId} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {r.label}{' '}
                {r.iterations > 1 && (
                  <span className="text-yellow-400">· {r.iterations} iter</span>
                )}
              </span>
              <span className="font-mono text-text-primary">
                {formatUSD(r.usd)}{' '}
                <span className="text-text-muted">
                  · {formatTokens(r.input)}/{formatTokens(r.output)}
                </span>
              </span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-border text-[11px] text-text-muted leading-relaxed">
            <strong className="text-text-secondary">Pourquoi ce total:</strong> somme des tokens facturés Anthropic pour tous les gates run de ce funnel.
            Itérations multiples = review loop (output refusé, re-généré). Opus coûte $5/$25 per M tokens, Sonnet $3/$15.
          </div>
        </div>
      )}
    </div>
  );
}
