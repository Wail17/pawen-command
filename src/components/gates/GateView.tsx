'use client';

import { useState } from 'react';
import { GateOutput, GateId } from '@/lib/types';
import { ReviewPanel, CongruencePanel } from '@/components/ui/ReviewPanel';

interface GateViewProps {
  gateId: GateId;
  title: string;
  description: string;
  output: GateOutput | null;
  isGenerating: boolean;
  streamingText: string;
  inputMode: 'ai' | 'manual';
  onInputModeChange: (mode: 'ai' | 'manual') => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  children: React.ReactNode; // Gate-specific content (decision points, etc.)
  manualInput?: React.ReactNode; // Manual input form
  generationLog?: React.ReactNode; // Expandable generation log
}

export default function GateView({
  gateId,
  title,
  description,
  output,
  isGenerating,
  streamingText,
  inputMode,
  onInputModeChange,
  onGenerate,
  onRegenerate,
  onApprove,
  children,
  manualInput,
  generationLog,
}: GateViewProps) {
  const [showLog, setShowLog] = useState(false);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs px-2 py-1 bg-bg-card border border-border rounded-md text-text-muted">
            {gateId === 'brand-dna' ? '🧬' : gateId.replace('gate', 'GATE ')}
          </span>
          <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        </div>
        <p className="text-text-secondary text-sm">{description}</p>
      </div>

      {/* Input Mode Toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => onInputModeChange('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inputMode === 'ai'
              ? 'bg-accent-orange text-white'
              : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          AI Generate
        </button>
        <button
          onClick={() => onInputModeChange('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            inputMode === 'manual'
              ? 'bg-accent-teal text-white'
              : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          Manual Input
        </button>
      </div>

      {/* Manual Input Mode */}
      {inputMode === 'manual' && manualInput && (
        <div className="mb-6 p-4 bg-bg-card border border-accent-teal/30 rounded-xl">
          <h3 className="text-sm font-semibold text-accent-teal mb-3">Manual Input</h3>
          {manualInput}
        </div>
      )}

      {/* AI Mode: Generate button or streaming */}
      {inputMode === 'ai' && !output && !isGenerating && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={onGenerate}
            className="px-8 py-3 bg-accent-orange text-white font-semibold rounded-xl hover:bg-accent-orange-hover text-sm flex items-center gap-2"
          >
            <span>Generate with AI</span>
            <span className="text-xs opacity-70">(Opus 4.6)</span>
          </button>
        </div>
      )}

      {/* Streaming indicator */}
      {isGenerating && (
        <div className="mb-6 p-4 bg-bg-card border border-accent-orange/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-accent-orange rounded-full animate-pulse" />
            <span className="text-sm text-accent-orange font-medium">Generating...</span>
          </div>
          {streamingText && (
            <div className="mt-2 p-3 bg-bg-primary rounded-lg max-h-64 overflow-y-auto">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono streaming-cursor">
                {streamingText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Gate Content (decision points, output display) */}
      {(output || inputMode === 'manual') && (
        <div className="mb-6">{children}</div>
      )}

      {/* Review & Congruence panels */}
      {output && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <ReviewPanel review={output.reviewResult} />
          <CongruencePanel congruence={output.congruenceResult} />
        </div>
      )}

      {/* Action buttons */}
      {output && output.status !== 'generating' && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm disabled:opacity-50"
          >
            🔄 Re-generate
          </button>
          <button
            onClick={onApprove}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-success text-white font-semibold rounded-lg hover:bg-success/90 text-sm disabled:opacity-50"
          >
            ✅ Approve & Continue
          </button>
        </div>
      )}

      {/* Generation Log (accordion) */}
      {output && output.generationLog.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLog(!showLog)}
            className="w-full flex items-center justify-between px-4 py-3 bg-bg-card hover:bg-bg-card-hover text-sm"
          >
            <span className="text-text-secondary">
              Generation Log ({output.generationLog.length} entries)
            </span>
            <span className="text-text-muted">{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div className="p-4 bg-bg-primary space-y-2 max-h-64 overflow-y-auto">
              {output.generationLog.map((entry, i) => (
                <div key={i} className="p-2 bg-bg-card rounded-lg text-xs">
                  <div className="flex items-center gap-2 text-text-muted">
                    <span className="font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      entry.agent === 'generator' ? 'bg-accent-orange/20 text-accent-orange' :
                      entry.agent === 'reviewer' ? 'bg-accent-teal/20 text-accent-teal' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {entry.agent}
                    </span>
                    <span>{entry.model}</span>
                    {entry.score !== undefined && <span>Score: {entry.score}</span>}
                    {entry.tokens_used && (
                      <span>Tokens: {entry.tokens_used.input}in/{entry.tokens_used.output}out</span>
                    )}
                  </div>
                  <p className="text-text-secondary mt-1">{entry.output_summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extra generation log section */}
      {generationLog}
    </div>
  );
}
