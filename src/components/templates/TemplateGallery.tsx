'use client';

import { useState } from 'react';
import { Template, TEMPLATE_CATEGORIES } from '@/lib/templates/types';
import { STARTER_TEMPLATES, StarterTemplate } from '@/lib/templates/starterTemplates';

interface TemplateGalleryProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (template: Template) => void;
  onStarterPick: (starter: StarterTemplate) => void;
}

export default function TemplateGallery({ templates, onSelect, onImport, onDelete, onDuplicate, onStarterPick }: TemplateGalleryProps) {
  const [showStarters, setShowStarters] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Your Templates</h2>
          <p className="text-sm text-text-muted mt-1">Import Shopify Liquid templates and edit them with AI</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStarters(!showStarters)}
            className="px-4 py-2.5 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover text-sm"
          >
            Starter Templates
          </button>
          <button
            onClick={onImport}
            className="px-5 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm"
          >
            + Import Template
          </button>
        </div>
      </div>

      {/* Starter Templates Picker */}
      {showStarters && (
        <div className="p-5 bg-bg-card border border-accent-teal/30 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Start from a Template</h3>
              <p className="text-xs text-text-muted mt-0.5">Production-ready templates with variable integration. Click to start editing.</p>
            </div>
            <button onClick={() => setShowStarters(false)} className="text-text-muted hover:text-text-primary text-sm">x</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STARTER_TEMPLATES.map((s, i) => {
              const cat = TEMPLATE_CATEGORIES[s.category];
              return (
                <button
                  key={i}
                  onClick={() => { onStarterPick(s); setShowStarters(false); }}
                  className="p-4 bg-bg-primary border border-border rounded-lg hover:border-accent-teal text-left transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 flex items-center justify-center bg-accent-teal/20 text-accent-teal text-[10px] font-bold rounded">
                      {cat.icon}
                    </span>
                    <span className="text-xs font-semibold text-text-primary group-hover:text-accent-teal transition-colors">{s.name}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{s.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {templates.length === 0 && !showStarters && (
        <div className="p-12 bg-bg-card border border-border border-dashed rounded-xl text-center">
          <p className="text-text-muted text-sm mb-4">No templates yet. Start from a starter template or import your own Liquid code.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowStarters(true)}
              className="px-6 py-2.5 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover text-sm"
            >
              Starter Templates
            </button>
            <button
              onClick={onImport}
              className="px-6 py-2.5 border border-border text-text-secondary rounded-lg hover:text-text-primary text-sm"
            >
              Import Custom
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => {
          const cat = TEMPLATE_CATEGORIES[t.category];
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t)}
              className="p-4 bg-bg-card border border-border rounded-xl hover:border-accent-teal cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center bg-accent-teal/20 text-accent-teal text-xs font-bold rounded-lg">
                    {cat.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-teal transition-colors">{t.name}</h3>
                    <p className="text-[11px] text-text-muted">{cat.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate(t); }}
                    className="text-text-muted hover:text-accent-teal text-xs px-1.5 py-0.5 rounded hover:bg-bg-primary"
                    title="Duplicate template"
                  >
                    dup
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    className="text-text-muted hover:text-error text-xs px-1.5 py-0.5 rounded hover:bg-bg-primary"
                    title="Delete template"
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-text-muted font-mono bg-bg-primary rounded p-2 max-h-20 overflow-hidden">
                {t.liquidSource.slice(0, 200)}...
              </div>

              <div className="flex items-center justify-between mt-3 text-[10px] text-text-muted">
                <span>{Object.keys(t.variableMap).length} variables mapped</span>
                <span>{t.editHistory.length} edits</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
