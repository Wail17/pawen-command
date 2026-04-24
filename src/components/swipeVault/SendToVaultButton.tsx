'use client';

import { useState } from 'react';
import { addSwipeEntry } from '@/lib/store/db';
import type { SwipeStatus, SwipeVaultEntry } from '@/lib/swipeVault/types';
import type { Project } from '@/lib/types';

interface Props {
  project?: Project;
  sourceGateId?: string;
  draft: Partial<SwipeVaultEntry>;
  className?: string;
  label?: string;
}

const STATUSES: { id: SwipeStatus; label: string; chip: string }[] = [
  { id: 'winning', label: '✓ Winner', chip: 'bg-success/15 text-success border-success/40' },
  { id: 'big_swing', label: '🎯 Big Swing', chip: 'bg-accent-orange/15 text-accent-orange border-accent-orange/40' },
  { id: 'reference', label: '📌 Reference', chip: 'bg-accent-teal/15 text-accent-teal border-accent-teal/40' },
  { id: 'losing', label: '✗ Loser', chip: 'bg-warning/15 text-warning border-warning/40' },
];

export default function SendToVaultButton({ project, sourceGateId, draft, className, label }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SwipeStatus>('winning');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [overrideImage, setOverrideImage] = useState<string>('');

  const save = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const entry: SwipeVaultEntry = {
        id: crypto.randomUUID(),
        status,
        source: 'generated',
        sourceProjectId: project?.id,
        sourceGateId,
        niche: project?.niche,
        awarenessLevel: project?.selectedFunnel,
        note: note || undefined,
        createdAt: now,
        updatedAt: now,
        ...draft,
        ...(overrideImage ? { imageUrl: overrideImage } : {}),
      };
      await addSwipeEntry(entry);
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setNote(''); }, 1000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={className ?? 'px-2 py-1 text-xs rounded bg-bg-primary border border-border hover:border-accent-orange/60 text-text-muted hover:text-accent-orange'}
        title="Send to Swipe Vault"
      >
        {label ?? '🗃️ Vault'}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">Send to Swipe Vault</h3>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-2 block">How did this creative perform?</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className={`text-xs px-3 py-2 rounded border transition ${status === s.id ? s.chip : 'bg-bg-primary border-border text-text-muted hover:border-accent-orange/40'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted">Why? (agents learn from this)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={status === 'winning' ? 'e.g. Identity hook + specific low-point + mechanism payoff' : status === 'losing' ? 'e.g. Too generic, no emotional anchor, cliche claim' : 'Notes...'}
                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1"
              />
            </div>

            <div className="text-xs text-text-muted bg-bg-primary border border-border rounded p-2">
              <div><b>Hook:</b> {draft.hook || '—'}</div>
              {draft.headline && <div><b>Headline:</b> {draft.headline}</div>}
              {draft.niche && <div><b>Niche:</b> {draft.niche}</div>}
              {draft.format && <div><b>Format:</b> {draft.format}</div>}
            </div>

            <div>
              <label className="text-xs text-text-muted">Image (upload or use generated)</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setOverrideImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                  className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accent-orange file:text-bg-primary file:text-[10px] file:font-semibold file:cursor-pointer"
                />
                {overrideImage && (
                  <button onClick={() => setOverrideImage('')} className="px-2 py-1 text-xs text-text-muted hover:text-warning border border-border rounded">clear</button>
                )}
              </div>
              {(overrideImage || draft.imageUrl) && (
                <img src={overrideImage || draft.imageUrl} alt="" className="mt-2 max-h-24 rounded border border-border object-cover" />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
              <button onClick={save} disabled={saving || done} className="px-4 py-2 rounded-lg bg-accent-orange text-bg-primary font-semibold hover:bg-accent-orange/90 disabled:opacity-50">
                {done ? '✓ Saved' : saving ? 'Saving…' : 'Save to Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
