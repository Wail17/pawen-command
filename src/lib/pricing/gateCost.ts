// ============================================================
// PAWEN — Gate Cost Calculator
// Computes $ cost from generationLog entries using MODEL_REGISTRY
// pricing (costPerInputMTok / costPerOutputMTok). Pure arithmetic,
// no API calls.
// ============================================================

import { MODEL_REGISTRY } from '../ai/providers';
import { GenerationLogEntry } from '../types';

export interface CostBreakdown {
  totalUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  iterations: number;
  byLayer: {
    subAgent: { usd: number; input: number; output: number; calls: number };
    manager: { usd: number; input: number; output: number; calls: number };
    lead: { usd: number; input: number; output: number; calls: number };
    director: { usd: number; input: number; output: number; calls: number };
    reviewer: { usd: number; input: number; output: number; calls: number };
    congruence: { usd: number; input: number; output: number; calls: number };
    generator: { usd: number; input: number; output: number; calls: number };
  };
  byModel: Record<string, { usd: number; input: number; output: number; calls: number }>;
}

function priceFor(modelId: string): { inPrice: number; outPrice: number } {
  // Find model config by .model string (e.g. "claude-opus-4-6")
  for (const cfg of Object.values(MODEL_REGISTRY)) {
    if (cfg.model === modelId) {
      return { inPrice: cfg.costPerInputMTok, outPrice: cfg.costPerOutputMTok };
    }
  }
  // Fallback for unknown model: Sonnet pricing
  return { inPrice: 3, outPrice: 15 };
}

function emptyLayer() {
  return { usd: 0, input: 0, output: 0, calls: 0 };
}

export function computeGateCost(log: GenerationLogEntry[]): CostBreakdown {
  const breakdown: CostBreakdown = {
    totalUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    iterations: 0,
    byLayer: {
      subAgent: emptyLayer(),
      manager: emptyLayer(),
      lead: emptyLayer(),
      director: emptyLayer(),
      reviewer: emptyLayer(),
      congruence: emptyLayer(),
      generator: emptyLayer(),
    },
    byModel: {},
  };

  let maxIter = 0;
  const layerMap: Record<string, keyof CostBreakdown['byLayer']> = {
    'sub-agent': 'subAgent',
    manager: 'manager',
    lead: 'lead',
    director: 'director',
    reviewer: 'reviewer',
    congruence: 'congruence',
    generator: 'generator',
  };

  for (const entry of log) {
    const t = entry.tokens_used;
    if (!t) continue;
    const input = t.input || 0;
    const output = t.output || 0;
    if (input === 0 && output === 0) continue;

    const { inPrice, outPrice } = priceFor(entry.model);
    const cost = (input / 1_000_000) * inPrice + (output / 1_000_000) * outPrice;

    breakdown.totalUSD += cost;
    breakdown.totalInputTokens += input;
    breakdown.totalOutputTokens += output;
    if (entry.iteration > maxIter) maxIter = entry.iteration;

    const layerKey = layerMap[entry.agent];
    if (layerKey) {
      const layer = breakdown.byLayer[layerKey];
      layer.usd += cost;
      layer.input += input;
      layer.output += output;
      layer.calls += 1;
    }

    if (!breakdown.byModel[entry.model]) {
      breakdown.byModel[entry.model] = emptyLayer();
    }
    const mdl = breakdown.byModel[entry.model];
    mdl.usd += cost;
    mdl.input += input;
    mdl.output += output;
    mdl.calls += 1;
  }

  breakdown.iterations = maxIter;
  return breakdown;
}

export function formatUSD(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
