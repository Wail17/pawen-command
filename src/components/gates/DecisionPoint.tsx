'use client';

import { useState, useCallback } from 'react';
import { DecisionPointConfig } from '@/lib/types';

interface DecisionPointProps {
  config: DecisionPointConfig;
  options: Array<{ id: string; label: string; description?: string; data?: Record<string, unknown> }>;
  value: unknown;
  onChange: (value: unknown) => void;
}

export default function DecisionPoint({ config, options, value, onChange }: DecisionPointProps) {
  switch (config.type) {
    case 'pick':
      return <PickDecision config={config} options={options} value={value as string[]} onChange={onChange} />;
    case 'reorder':
      return <ReorderDecision config={config} options={options} value={value as string[]} onChange={onChange} />;
    case 'edit':
      return <EditDecision config={config} value={value as string} onChange={onChange} />;
    case 'choose':
      return <ChooseDecision config={config} options={options} value={value as string} onChange={onChange} />;
    case 'toggle':
      return <ToggleDecision config={config} value={value as boolean} onChange={onChange} />;
    default:
      return null;
  }
}

// === PICK (select multiple cards) ===
function PickDecision({
  config,
  options,
  value,
  onChange,
}: {
  config: DecisionPointConfig;
  options: Array<{ id: string; label: string; description?: string; data?: Record<string, unknown> }>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selected = value || [];

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      if (config.maxSelections && selected.length >= config.maxSelections) return;
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">{config.label}</h4>
          <p className="text-xs text-text-muted">{config.description}</p>
        </div>
        <span className="text-xs text-text-muted">
          {selected.length} selected
          {config.minSelections ? ` (min ${config.minSelections})` : ''}
          {config.maxSelections ? ` (max ${config.maxSelections})` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`
                p-4 rounded-xl border text-left transition-all
                ${isSelected
                  ? 'border-accent-orange bg-accent-orange/10'
                  : 'border-border bg-bg-card hover:border-text-muted'}
              `}
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-accent-orange bg-accent-orange' : 'border-border'
                }`}>
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
              {opt.description && (
                <p className="text-xs text-text-muted mt-2">{opt.description}</p>
              )}
              {opt.data && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(opt.data).map(([key, val]) => (
                    <span key={key} className="text-xs px-1.5 py-0.5 bg-bg-primary rounded text-text-secondary">
                      {key}: {String(val)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// === REORDER (drag and drop) ===
function ReorderDecision({
  config,
  options,
  value,
  onChange,
}: {
  config: DecisionPointConfig;
  options: Array<{ id: string; label: string; description?: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const order = value || options.map((o) => o.id);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const moveItem = useCallback((from: number, to: number) => {
    const newOrder = [...order];
    const [item] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, item);
    onChange(newOrder);
  }, [order, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">{config.label}</h4>
        <p className="text-xs text-text-muted">{config.description}</p>
      </div>
      <div className="space-y-1">
        {order.map((id, idx) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (dragIdx !== null) moveItem(dragIdx, idx); setDragIdx(null); }}
              className={`
                flex items-center gap-3 px-4 py-3 bg-bg-card border border-border rounded-lg cursor-grab
                ${dragIdx === idx ? 'opacity-50' : ''}
              `}
            >
              <span className="text-text-muted font-mono text-xs w-6">{idx + 1}.</span>
              <span className="text-text-muted cursor-grab">⠿</span>
              <div className="flex-1">
                <span className="text-sm text-text-primary">{opt.label}</span>
                {opt.description && (
                  <p className="text-xs text-text-muted">{opt.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => idx > 0 && moveItem(idx, idx - 1)}
                  disabled={idx === 0}
                  className="text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => idx < order.length - 1 && moveItem(idx, idx + 1)}
                  disabled={idx === order.length - 1}
                  className="text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === EDIT (text editing) ===
function EditDecision({
  config,
  value,
  onChange,
}: {
  config: DecisionPointConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-text-primary">{config.label}</h4>
      <p className="text-xs text-text-muted">{config.description}</p>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y font-mono"
      />
    </div>
  );
}

// === CHOOSE (single select) ===
function ChooseDecision({
  config,
  options,
  value,
  onChange,
}: {
  config: DecisionPointConfig;
  options: Array<{ id: string; label: string; description?: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">{config.label}</h4>
        <p className="text-xs text-text-muted">{config.description}</p>
      </div>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`
              w-full p-4 rounded-xl border text-left
              ${value === opt.id
                ? 'border-accent-orange bg-accent-orange/10'
                : 'border-border bg-bg-card hover:border-text-muted'}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 ${
                value === opt.id ? 'border-accent-orange bg-accent-orange' : 'border-border'
              }`}>
                {value === opt.id && <div className="w-full h-full rounded-full bg-white scale-[0.35]" />}
              </div>
              <div>
                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                {opt.description && (
                  <p className="text-xs text-text-muted mt-0.5">{opt.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// === TOGGLE ===
function ToggleDecision({
  config,
  value,
  onChange,
}: {
  config: DecisionPointConfig;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-bg-card border border-border rounded-xl">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">{config.label}</h4>
        <p className="text-xs text-text-muted">{config.description}</p>
      </div>
      <div
        className={`relative w-10 h-5 rounded-full cursor-pointer ${value ? 'bg-accent-orange' : 'bg-border'}`}
        onClick={() => onChange(!value)}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </div>
    </div>
  );
}
