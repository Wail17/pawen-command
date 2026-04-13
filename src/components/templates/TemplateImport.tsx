'use client';

import { useState } from 'react';
import { TemplateCategory, TEMPLATE_CATEGORIES } from '@/lib/templates/types';

interface TemplateImportProps {
  onImport: (data: { name: string; category: TemplateCategory; liquidSource: string }) => void;
  onClose: () => void;
}

export default function TemplateImport({ onImport, onClose }: TemplateImportProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('advertorial');
  const [liquidSource, setLiquidSource] = useState('');

  const canImport = name.trim().length > 0 && liquidSource.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Import Liquid Template</h3>
            <p className="text-xs text-text-muted mt-1">Paste your Shopify Liquid template code below</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">x</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Template Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Main Advertorial v1"
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-teal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-teal"
              >
                {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; description: string }][]).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label} — {cat.description}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Liquid Template Code *
            </label>
            <textarea
              value={liquidSource}
              onChange={e => setLiquidSource(e.target.value)}
              placeholder={'Paste your Shopify Liquid template here...\n\n<section class="hero">\n  <h1>{{ headline }}</h1>\n  <p>{{ body }}</p>\n  <a href="{{ cta_url }}">{{ cta }}</a>\n</section>'}
              rows={16}
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-accent-teal resize-y"
            />
            <p className="text-[10px] text-text-muted mt-1">
              Supports standard Liquid syntax: {'{{ variables }}'}, {'{% if %}'}, {'{% for %}'}, filters.
              Detected variables will be auto-mapped to your gate content.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => canImport && onImport({ name: name.trim(), category, liquidSource })}
            disabled={!canImport}
            className="flex-1 py-2.5 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover text-sm disabled:opacity-50"
          >
            Import & Edit
          </button>
        </div>
      </div>
    </div>
  );
}
