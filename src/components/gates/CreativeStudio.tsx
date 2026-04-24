// ============================================================
// PAWEN — Creative Studio (Gate 7)
// 3-style creative brief generator: Niche DR / Big Brand / Native.
// Each style runs a dedicated SOP prompt, auto-fed with the full
// CreativeContext (sub-avatar + verbatims + root cause + mechanism
// + deep dive + raw signal + customer language + Brand DNA).
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import type { Project, GateOutput } from '@/lib/types';
import { buildCreaStudioPrompt, CREA_STYLE_LABELS, type CreaStyle } from '@/lib/prompts/creaStudio';
import { getAllGateOutputs } from '@/lib/store/db';

type Dict = Record<string, unknown>;

interface Props {
  project: Project;
  existingData?: Dict;
  humanDecisions?: Dict;
  onDecisionsChange?: (next: Dict) => void;
  onRunComplete?: (style: CreaStyle, markdown: string) => void;
}

export default function CreativeStudio({ project, existingData, humanDecisions, onDecisionsChange, onRunComplete }: Props) {
  const [activeStyle, setActiveStyle] = useState<CreaStyle | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Outputs by style — persisted in humanDecisions.creaStudio
  const studioOutputs = (humanDecisions?.creaStudio as Record<CreaStyle, string> | undefined) || ({} as Record<CreaStyle, string>);

  // Existing Gate 7 data (static ad studio briefs) — kept visible as reference
  const hasExistingBriefs = existingData && Object.keys(existingData).length > 0;

  const run = useCallback(async (style: CreaStyle) => {
    setActiveStyle(style);
    setIsRunning(true);
    setStreamedText('');
    setError(null);

    try {
      const allOutputs = await getAllGateOutputs(project.id);
      const previousOutputs: Record<string, unknown> = {};
      for (const o of allOutputs) {
        if (o && typeof o === 'object' && 'gateId' in o && 'data' in o) {
          const go = o as GateOutput;
          previousOutputs[go.gateId] = go.data;
        }
      }

      const { systemPrompt, userMessage, model, maxTokens } = buildCreaStudioPrompt(style, project, previousOutputs);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          systemPrompt,
          userMessage,
          maxTokens,
          temperature: 0.75,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => 'Unknown error');
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              accumulated += parsed.delta.text;
              setStreamedText(accumulated);
            }
          } catch {
            // ignore non-JSON SSE lines
          }
        }
      }

      // Persist into humanDecisions.creaStudio[style]
      const nextStudio = { ...studioOutputs, [style]: accumulated };
      onDecisionsChange?.({ ...(humanDecisions || {}), creaStudio: nextStudio });
      onRunComplete?.(style, accumulated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }, [project, humanDecisions, studioOutputs, onDecisionsChange, onRunComplete]);

  const displayText = isRunning ? streamedText : (activeStyle && studioOutputs[activeStyle]) || streamedText;

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="bg-gradient-to-br from-accent-orange/15 to-accent-teal/10 border border-accent-orange/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-1">
          Creative Studio
        </div>
        <div className="text-lg text-text-primary font-bold">Choose a creative style — prompts are fed with your full project data</div>
        <p className="text-sm text-text-secondary mt-2">
          Each style runs a real SOP prompt (ZAK / EVOLVE / NATIVE) auto-injected with your sub-avatar verbatims, root cause, mechanism, deep dive, raw signal, customer language bank, Brand DNA, and Shopify data.
        </p>
      </div>

      {/* STYLE SELECTOR */}
      <div className="grid md:grid-cols-3 gap-3">
        {(Object.keys(CREA_STYLE_LABELS) as CreaStyle[]).map((style) => {
          const meta = CREA_STYLE_LABELS[style];
          const hasOutput = Boolean(studioOutputs[style]);
          const isActive = activeStyle === style;
          return (
            <button
              key={style}
              onClick={() => run(style)}
              disabled={isRunning}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                isActive
                  ? 'border-accent-orange bg-accent-orange/10'
                  : hasOutput
                  ? 'border-accent-teal/40 bg-accent-teal/5 hover:border-accent-teal'
                  : 'border-border bg-bg-card hover:border-accent-orange'
              } ${isRunning ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-bold text-text-primary">{meta.label}</div>
                {hasOutput && <span className="text-xs bg-accent-teal/20 text-accent-teal px-2 py-0.5 rounded-full">✓ ready</span>}
              </div>
              <div className="text-xs text-accent-orange mb-2">{meta.tagline}</div>
              <p className="text-xs text-text-secondary leading-relaxed">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {/* STATUS / STREAM */}
      {isRunning && activeStyle && (
        <div className="bg-bg-card border border-accent-orange/40 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-accent-orange mb-2">
            <span className="animate-pulse">●</span>
            <span>Running {CREA_STYLE_LABELS[activeStyle].label}…</span>
          </div>
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono max-h-[500px] overflow-auto">
            {streamedText || 'Waiting for first token…'}
          </pre>
        </div>
      )}

      {error && (
        <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 text-sm text-warning">
          Error: {error}
        </div>
      )}

      {/* OUTPUT VIEWER */}
      {!isRunning && activeStyle && studioOutputs[activeStyle] && (
        <div className="bg-bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold">
                {CREA_STYLE_LABELS[activeStyle].label} — output
              </div>
              <div className="text-xs text-text-muted mt-1">
                {studioOutputs[activeStyle].length.toLocaleString()} chars
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(studioOutputs[activeStyle])}
                className="px-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg hover:border-accent-orange"
              >
                Copy
              </button>
              <button
                onClick={() => run(activeStyle)}
                className="px-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg hover:border-accent-orange"
              >
                Regenerate
              </button>
            </div>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono max-h-[700px] overflow-auto bg-bg-primary border border-border rounded p-4">
              {studioOutputs[activeStyle]}
            </pre>
          </div>
        </div>
      )}

      {/* REFERENCE — existing Gate 7 briefs are still available via tab switcher */}
      {!activeStyle && hasExistingBriefs && (
        <div className="bg-bg-card border border-border rounded-lg p-4 text-sm text-text-muted">
          💡 Existing PRISM preset briefs are preserved in <code className="text-accent-teal">project data</code>. Pick a style above to generate SOP-driven copy, or keep using the prior briefs.
        </div>
      )}
    </div>
  );
}
