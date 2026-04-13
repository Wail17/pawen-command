'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { Template, TemplateEdit, TEMPLATE_CATEGORIES } from '@/lib/templates/types';
import { CreativeContext } from '@/lib/gates/creativeContextAggregator';
import { extractLiquidVariables, buildTemplateVariables } from '@/lib/templates/contentInjector';
import { renderTemplate, wrapForPreview } from '@/lib/templates/renderer';
import PreviewFrame from './PreviewFrame';
import VariableMapper from './VariableMapper';

interface TemplateEditorProps {
  template: Template;
  creativeCtx: CreativeContext | null;
  onUpdate: (template: Template) => void;
  onBack: () => void;
}

export default function TemplateEditor({ template, creativeCtx, onUpdate, onBack }: TemplateEditorProps) {
  const [liquidSource, setLiquidSource] = useState(template.liquidSource);
  const [variableMap, setVariableMap] = useState<Record<string, string>>(template.variableMap);
  const [previewHtml, setPreviewHtml] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showVars, setShowVars] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [editHistory, setEditHistory] = useState<TemplateEdit[]>(template.editHistory);
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  const detectedVars = extractLiquidVariables(liquidSource);

  // Render preview whenever source or variables change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const values = creativeCtx ? buildTemplateVariables(variableMap, creativeCtx) : {};
      const rendered = await renderTemplate(liquidSource, values);
      if (!cancelled) setPreviewHtml(wrapForPreview(rendered));
    })();
    return () => { cancelled = true; };
  }, [liquidSource, variableMap, creativeCtx]);

  // Persist changes
  const persistTemplate = useCallback((source: string, map: Record<string, string>, history: TemplateEdit[]) => {
    const updated: Template = {
      ...template,
      liquidSource: source,
      variableMap: map,
      editHistory: history.slice(-20), // keep last 20
      updatedAt: new Date().toISOString(),
    };
    onUpdate(updated);
  }, [template, onUpdate]);

  // Handle manual source editing
  const handleSourceChange = useCallback((value: string) => {
    setLiquidSource(value);
    persistTemplate(value, variableMap, editHistory);
  }, [variableMap, editHistory, persistTemplate]);

  // Handle variable map change
  const handleMapChange = useCallback((newMap: Record<string, string>) => {
    setVariableMap(newMap);
    persistTemplate(liquidSource, newMap, editHistory);
  }, [liquidSource, editHistory, persistTemplate]);

  // AI Chat edit
  const handleAiEdit = useCallback(async () => {
    if (!chatInput.trim() || isEditing) return;
    setIsEditing(true);

    const instruction = chatInput.trim();
    setChatInput('');
    const beforeSource = liquidSource;

    try {
      const response = await fetch('/api/template-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          currentLiquid: liquidSource,
          variables: variableMap,
          creativeContext: creativeCtx ? summarizeContext(creativeCtx) : null,
          editHistory: editHistory.slice(-5).map(e => ({ instruction: e.instruction, timestamp: e.timestamp })),
        }),
      });

      if (!response.ok) {
        console.error('AI edit failed:', response.status);
        setIsEditing(false);
        return;
      }

      // Collect the full streamed response
      const reader = response.body?.getReader();
      if (!reader) { setIsEditing(false); return; }

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
              }
            } catch { /* skip */ }
          }
        }
      }

      if (fullContent.trim()) {
        // Strip markdown fencing if the AI wrapped it
        let cleaned = fullContent.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        }

        const edit: TemplateEdit = {
          id: uuid(),
          instruction,
          before: beforeSource,
          after: cleaned,
          timestamp: new Date().toISOString(),
        };

        const newHistory = [...editHistory, edit];
        setLiquidSource(cleaned);
        setEditHistory(newHistory);
        persistTemplate(cleaned, variableMap, newHistory);
      }
    } catch (err) {
      console.error('AI edit error:', err);
    } finally {
      setIsEditing(false);
    }
  }, [chatInput, isEditing, liquidSource, variableMap, creativeCtx, editHistory, persistTemplate]);

  // Undo to a previous version
  const handleUndo = useCallback((edit: TemplateEdit) => {
    setLiquidSource(edit.before);
    persistTemplate(edit.before, variableMap, editHistory);
  }, [variableMap, editHistory, persistTemplate]);

  const cat = TEMPLATE_CATEGORIES[template.category];
  const [copyFeedback, setCopyFeedback] = useState('');

  const downloadFile = useCallback((content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportHtml = useCallback(() => {
    downloadFile(previewHtml, `${template.name.replace(/\s+/g, '-').toLowerCase()}.html`, 'text/html');
  }, [previewHtml, template.name, downloadFile]);

  const handleExportLiquid = useCallback(() => {
    downloadFile(liquidSource, `${template.name.replace(/\s+/g, '-').toLowerCase()}.liquid`, 'text/plain');
  }, [liquidSource, template.name, downloadFile]);

  const handleCopyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(previewHtml);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Failed');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  }, [previewHtml]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-card">
        <button
          onClick={onBack}
          className="text-text-muted hover:text-text-primary text-sm"
        >
          &larr; Back
        </button>
        <span className="w-7 h-7 flex items-center justify-center bg-accent-teal/20 text-accent-teal text-[10px] font-bold rounded">
          {cat.icon}
        </span>
        <h1 className="text-sm font-semibold text-text-primary">{template.name}</h1>
        <span className="text-[10px] text-text-muted">{cat.label}</span>
        <div className="flex-1" />

        {/* Export buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportHtml}
            className="px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-primary border border-border rounded hover:border-accent-teal hover:text-accent-teal transition-colors"
            title="Download rendered HTML"
          >
            HTML
          </button>
          <button
            onClick={handleExportLiquid}
            className="px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-primary border border-border rounded hover:border-accent-teal hover:text-accent-teal transition-colors"
            title="Download Liquid source"
          >
            Liquid
          </button>
          <button
            onClick={handleCopyHtml}
            className="px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-primary border border-border rounded hover:border-accent-teal hover:text-accent-teal transition-colors"
            title="Copy HTML to clipboard"
          >
            {copyFeedback || 'Copy'}
          </button>
        </div>

        <span className="text-[10px] text-text-muted ml-2">{detectedVars.length} vars</span>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE — Controls */}
        <div className="w-[45%] min-w-[360px] border-r border-border flex flex-col overflow-hidden">
          {/* Sections toggle */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-bg-card">
            <button
              onClick={() => { setShowVars(true); setShowCode(false); setShowHistory(false); }}
              className={`px-3 py-1 rounded text-xs font-medium ${showVars && !showCode && !showHistory ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Variables
            </button>
            <button
              onClick={() => { setShowCode(true); setShowVars(false); setShowHistory(false); }}
              className={`px-3 py-1 rounded text-xs font-medium ${showCode ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Code
            </button>
            <button
              onClick={() => { setShowHistory(true); setShowVars(false); setShowCode(false); }}
              className={`px-3 py-1 rounded text-xs font-medium ${showHistory ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-secondary'}`}
            >
              History ({editHistory.length})
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Variable Mapper */}
            {showVars && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-secondary">Variable Mapping</h3>
                <VariableMapper
                  detectedVars={detectedVars}
                  variableMap={variableMap}
                  creativeCtx={creativeCtx}
                  onChange={handleMapChange}
                />
              </div>
            )}

            {/* Code editor */}
            {showCode && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-secondary">Liquid Source</h3>
                <textarea
                  ref={sourceRef}
                  value={liquidSource}
                  onChange={e => handleSourceChange(e.target.value)}
                  className="w-full h-[calc(100vh-280px)] px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-xs font-mono focus:outline-none focus:border-accent-teal resize-none"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Edit history */}
            {showHistory && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-secondary">Edit History</h3>
                {editHistory.length === 0 && (
                  <p className="text-xs text-text-muted">No edits yet. Use the AI chat below to make changes.</p>
                )}
                {[...editHistory].reverse().map(edit => (
                  <div key={edit.id} className="p-2 bg-bg-card border border-border rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-text-primary">&ldquo;{edit.instruction}&rdquo;</p>
                      <button
                        onClick={() => handleUndo(edit)}
                        className="text-[10px] text-accent-teal hover:underline whitespace-nowrap"
                      >
                        Undo
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      {new Date(edit.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Chat Bar — always visible */}
          <div className="px-3 py-3 border-t border-border bg-bg-card">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiEdit()}
                placeholder={isEditing ? 'AI is editing...' : 'Ask AI to edit: "change the headline", "add a CTA section"...'}
                disabled={isEditing}
                className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange disabled:opacity-50"
              />
              <button
                onClick={handleAiEdit}
                disabled={isEditing || !chatInput.trim()}
                className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm disabled:opacity-50"
              >
                {isEditing ? '...' : 'Edit'}
              </button>
            </div>
            {isEditing && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-accent-orange rounded-full animate-pulse" />
                <span className="text-xs text-accent-orange">AI is modifying your template...</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE — Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PreviewFrame html={previewHtml} />
        </div>
      </div>
    </div>
  );
}

// Summarize creative context for the AI prompt (keep it concise)
function summarizeContext(ctx: CreativeContext): Record<string, unknown> {
  return {
    product: ctx.product,
    mechanism: ctx.brand.mechanism_name,
    root_cause: ctx.brand.root_cause,
    belief_error: ctx.brand.belief_error,
    guarantee: ctx.brand.guarantee,
    proof_points: ctx.brand.key_proof_points,
    headlines: ctx.headlines?.slice(0, 5),
    hooks: ctx.top_hooks?.slice(0, 5).map(h => h.hook),
    body_copies: ctx.body_copies?.slice(0, 3),
    story_arc: ctx.sub_avatar.story_angle,
    verbatims: ctx.sub_avatar.verbatim_quotes.slice(0, 5),
    pain_quotes: ctx.brand.pain_quotes?.slice(0, 3),
    avatar_name: ctx.sub_avatar.name,
    color_brand: ctx.brand.color_brand,
    color_problem: ctx.brand.color_problem,
    color_solution: ctx.brand.color_solution,
  };
}
