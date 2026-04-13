'use client';

// ============================================================
// PAWEN — TranslateToggle
// Tiny per-item toggle that fetches a translation (via /api/translate)
// and reveals it below the original text. Original is NEVER hidden.
// Used inside SmartGateOutput, DeepDiveBlock and RawSignalView so users
// reading Italian/French/ES/DE output can peek at an English version
// without losing the native voice.
// ============================================================

import { useState, useCallback, createContext, useContext } from 'react';

// Context so callers only need to set the source language once at a high
// level; any nested <InlineTranslate> will pick it up.
export const TranslateCtx = createContext<string | null>(null);

export function shouldOfferTranslation(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const n = lang.trim().toLowerCase();
  if (!n) return false;
  return !['english', 'en', 'en-us', 'en-gb'].includes(n);
}

// Auto-suppressing variant: renders nothing if the source language is
// English or if the text is numeric/too short to bother.
export function InlineTranslate({
  text,
  size = 'sm',
}: {
  text: string;
  size?: 'sm' | 'md';
}) {
  const lang = useContext(TranslateCtx);
  if (!shouldOfferTranslation(lang)) return null;
  if (!text || text.trim().length < 4) return null;
  if (/^[\d\s.,%$€£¥-]+$/.test(text)) return null;
  return <TranslateToggle text={text} targetLanguage="English" size={size} />;
}

interface TranslateToggleProps {
  text: string;
  targetLanguage?: string;
  // Visual density — 'sm' for inline rows, 'md' for blocks
  size?: 'sm' | 'md';
}

export default function TranslateToggle({
  text,
  targetLanguage = 'English',
  size = 'sm',
}: TranslateToggleProps) {
  const [open, setOpen] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async () => {
    // Already fetched → just toggle visibility
    if (translation) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'Translation failed');
      } else {
        setTranslation(data.translation || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [text, translation, targetLanguage]);

  if (!text || text.trim().length < 3) return null;

  const btnClass =
    size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5'
      : 'text-[11px] px-2 py-1';

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`${btnClass} inline-flex items-center gap-1 rounded bg-bg-primary border border-accent-teal/40 text-accent-teal hover:bg-accent-teal/10 disabled:opacity-50`}
        title={`Translate to ${targetLanguage}`}
      >
        <span>🌐</span>
        <span>
          {loading
            ? 'Translating…'
            : open
            ? 'Hide translation'
            : `Translate → ${targetLanguage}`}
        </span>
      </button>
      {open && !loading && (translation || error) && (
        <div
          className={`mt-1 p-2 rounded border border-accent-teal/30 bg-accent-teal/5 text-accent-teal/90 ${
            size === 'sm' ? 'text-[11px]' : 'text-xs'
          } leading-snug`}
        >
          {error ? (
            <span className="text-error">⚠ {error}</span>
          ) : (
            <>
              <span className="text-[9px] uppercase font-bold tracking-wider opacity-70 mr-1">
                {targetLanguage}:
              </span>
              <span className="italic">{translation}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
