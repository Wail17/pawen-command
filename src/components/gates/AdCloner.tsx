'use client';

import { useState, useCallback, useMemo } from 'react';

interface ScrapedAd {
  id: string;
  page_name: string;
  headline: string;
  body: string;
  cta: string;
  image_url: string;
  link_url: string;
  platform: string;
  start_date: string;
  status: string;
}

interface TextMapping {
  original: string;
  translated: string;
  position: string;
  style: string;
}

interface TranslatedAd {
  id: string;
  translated_headline: string;
  translated_body: string;
  translated_cta: string;
  image_description?: string;
  nano_banana_prompt?: string;
  edit_prompt: string;
  recreate_prompt: string;
  negative_prompt?: string;
  text_map?: TextMapping[];
}

interface AdWithTranslation extends ScrapedAd {
  translation?: TranslatedAd;
  generated_image_url?: string;
  generated_model?: string;
  generating?: boolean;
  selected?: boolean;
  cloneStatus?: 'idle' | 'translating' | 'generating' | 'done' | 'error';
  cloneError?: string;
}

interface AdClonerProps {
  targetLanguage: string;
  targetMarket: string;
}

const AD_FORMATS = [
  { id: 'feed', label: 'Feed', w: 1080, h: 1080, icon: '◻' },
  { id: 'story', label: 'Story', w: 1080, h: 1920, icon: '▯' },
  { id: 'landscape', label: 'Landscape', w: 1200, h: 628, icon: '▬' },
] as const;

export default function AdCloner({ targetLanguage, targetMarket }: AdClonerProps) {
  const [brandInput, setBrandInput] = useState('');
  const [ads, setAds] = useState<AdWithTranslation[]>([]);
  const [step, setStep] = useState<'input' | 'scraped' | 'cloning' | 'done'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [format, setFormat] = useState<typeof AD_FORMATS[number]>(AD_FORMATS[0]);
  const [strength, setStrength] = useState(0.35);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedAds = useMemo(() => ads.filter(a => a.selected), [ads]);
  const selectedCount = selectedAds.length;
  const translatedCount = ads.filter(a => a.translation).length;
  const generatedCount = ads.filter(a => a.generated_image_url).length;

  const toggleSelect = (adId: string) => {
    setAds(prev => prev.map(a => a.id === adId ? { ...a, selected: !a.selected } : a));
  };

  const selectAll = () => {
    const allSelected = ads.every(a => a.selected);
    setAds(prev => prev.map(a => ({ ...a, selected: !allSelected })));
  };

  // Copy translated text to clipboard
  const copyTranslatedText = (ad: AdWithTranslation) => {
    if (!ad.translation) return;
    const text = [
      ad.translation.translated_headline,
      ad.translation.translated_body,
      ad.translation.translated_cta,
    ].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedId(ad.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Step 1: Scrape ads
  const handleScrape = useCallback(async () => {
    if (!brandInput.trim()) return;
    setLoading(true);
    setError('');
    setProgress('Scraping Meta Ad Library...');

    try {
      const isUrl = brandInput.trim().startsWith('http');
      const res = await fetch('/api/ad-cloner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'scrape',
          ...(isUrl ? { adLibraryUrl: brandInput.trim() } : { brandName: brandInput.trim() }),
          limit: 500,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Scraping failed');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data.ads || data.ads.length === 0) {
        setError('No ads found for this brand. Try a different name or URL.');
        setLoading(false);
        return;
      }

      setAds(data.ads.map((ad: ScrapedAd) => ({ ...ad, selected: false })));
      setStep('scraped');
      setProgress(`Found ${data.ads.length} ads — select the ones you want to clone`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [brandInput]);

  // Clone = Translate + Generate in one go
  const handleCloneSelected = useCallback(async () => {
    if (selectedCount === 0) return;
    setStep('cloning');
    setLoading(true);
    setError('');

    // --- Phase 1: Translate ---
    setProgress(`Translating ${selectedCount} ads to ${targetLanguage}...`);
    const adsToTranslate = selectedAds.filter(a => !a.translation);

    if (adsToTranslate.length > 0) {
      setAds(prev => prev.map(a =>
        a.selected && !a.translation ? { ...a, cloneStatus: 'translating' } : a
      ));

      try {
        const res = await fetch('/api/ad-cloner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'translate',
            ads: adsToTranslate,
            targetLanguage,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.message || 'Translation failed');
          setLoading(false);
          return;
        }

        const data = await res.json();
        const translations = data.translations as TranslatedAd[];

        setAds(prev => prev.map(ad => {
          const t = translations.find((tr: TranslatedAd) => tr.id === ad.id);
          return t ? { ...ad, translation: t, cloneStatus: 'generating' } : ad;
        }));

        setProgress(`Translated ${translations.length} ads. Generating images...`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Translation error');
        setLoading(false);
        return;
      }
    }

    // --- Phase 2: Generate images ---
    setAds(prev => {
      const toGenerate = prev.filter(a => a.selected && (a.translation?.edit_prompt || a.translation?.recreate_prompt || a.translation?.nano_banana_prompt) && !a.generated_image_url);
      if (toGenerate.length > 0) {
        generateImagesSequential(toGenerate.map(a => a.id));
      } else {
        setProgress('Done! All selected ads translated.');
        setStep('done');
        setLoading(false);
      }
      return prev;
    });
  }, [selectedAds, selectedCount, targetLanguage]);

  // Re-generate a single ad
  const regenerateAd = useCallback(async (adId: string) => {
    const currentAds = await new Promise<AdWithTranslation[]>(resolve => {
      setAds(prev => { resolve(prev); return prev; });
    });
    const ad = currentAds.find(a => a.id === adId);
    if (!ad?.translation) return;

    setAds(prev => prev.map(a =>
      a.id === adId ? { ...a, generating: true, generated_image_url: undefined, cloneStatus: 'generating', cloneError: undefined } : a
    ));

    try {
      const res = await fetch('/api/ad-cloner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'generate',
          editPrompt: ad.translation.edit_prompt,
          recreatePrompt: ad.translation.recreate_prompt,
          nanoBananaPrompt: ad.translation.nano_banana_prompt,
          imageDescription: ad.translation.image_description,
          negativePrompt: ad.translation.negative_prompt,
          originalImageUrl: ad.image_url || undefined,
          width: format.w,
          height: format.h,
          strength,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const imageUrl = data.images?.[0]?.url || '';
        if (imageUrl) {
          setAds(prev => prev.map(a =>
            a.id === adId ? { ...a, generated_image_url: imageUrl, generated_model: data.modelLabel || data.model || '', generating: false, cloneStatus: 'done' } : a
          ));
        } else {
          setAds(prev => prev.map(a =>
            a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: 'No image returned' } : a
          ));
        }
      } else {
        const errData = await res.json().catch(() => ({ message: 'Generation failed' }));
        const errorMsg = errData.errors?.length ? errData.errors.join(' | ') : errData.message || 'Generation failed';
        setAds(prev => prev.map(a =>
          a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: errorMsg } : a
        ));
      }
    } catch {
      setAds(prev => prev.map(a =>
        a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: 'Network error' } : a
      ));
    }
  }, [format, strength]);

  // Generate images one by one
  const generateImagesSequential = useCallback(async (adIds: string[]) => {
    let generated = 0;
    for (let i = 0; i < adIds.length; i++) {
      const adId = adIds[i];
      setProgress(`Generating image ${i + 1}/${adIds.length}...`);

      const currentAds = await new Promise<AdWithTranslation[]>(resolve => {
        setAds(prev => { resolve(prev); return prev; });
      });
      const ad = currentAds.find(a => a.id === adId);
      if (!ad?.translation?.edit_prompt && !ad?.translation?.recreate_prompt && !ad?.translation?.nano_banana_prompt) continue;

      setAds(prev => prev.map(a => a.id === adId ? { ...a, generating: true, cloneStatus: 'generating' } : a));

      try {
        const res = await fetch('/api/ad-cloner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: 'generate',
            editPrompt: ad.translation!.edit_prompt,
            recreatePrompt: ad.translation!.recreate_prompt,
            nanoBananaPrompt: ad.translation!.nano_banana_prompt,
            imageDescription: ad.translation!.image_description,
            negativePrompt: ad.translation!.negative_prompt,
            originalImageUrl: ad.image_url || undefined,
            width: format.w,
            height: format.h,
            strength,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const imageUrl = data.images?.[0]?.url || '';
          if (imageUrl) {
            generated++;
            setAds(prev => prev.map(a =>
              a.id === adId ? { ...a, generated_image_url: imageUrl, generated_model: data.modelLabel || data.model || '', generating: false, cloneStatus: 'done' } : a
            ));
          } else {
            setAds(prev => prev.map(a =>
              a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: 'No image returned' } : a
            ));
          }
        } else {
          const errData = await res.json().catch(() => ({ message: 'Generation failed' }));
          const errorMsg = errData.errors?.length ? errData.errors.join(' | ') : errData.message || 'Generation failed';
          setAds(prev => prev.map(a =>
            a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: errorMsg } : a
          ));
        }
      } catch {
        setAds(prev => prev.map(a =>
          a.id === adId ? { ...a, generating: false, cloneStatus: 'error', cloneError: 'Network error' } : a
        ));
      }
    }

    setProgress(`Done! ${generated}/${adIds.length} images generated`);
    setStep('done');
    setLoading(false);
  }, [format, strength]);

  // Download image
  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  // Download all as JSON
  const downloadAll = () => {
    const exportData = ads.filter(a => a.selected && (a.translation || a.generated_image_url)).map(ad => ({
      original: {
        headline: ad.headline,
        body: ad.body,
        cta: ad.cta,
        image_url: ad.image_url,
        link_url: ad.link_url,
      },
      translated: ad.translation ? {
        headline: ad.translation.translated_headline,
        body: ad.translation.translated_body,
        cta: ad.translation.translated_cta,
        text_map: ad.translation.text_map,
      } : null,
      generated_image_url: ad.generated_image_url || null,
      model: ad.generated_model || null,
      format: { width: format.w, height: format.h, name: format.label },
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-cloner-${brandInput.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-text-primary">Ad Cloner</h2>
        <p className="text-sm text-text-muted mt-1">
          Scrape competitor Meta ads, translate &amp; regenerate 1:1 for {targetMarket}
        </p>
      </div>

      {/* Workflow steps */}
      <div className="flex items-center gap-2">
        {(['Scrape', 'Select & Clone', 'Output'] as const).map((label, i) => {
          const stepMap = { input: 0, scraped: 1, cloning: 1, done: 2 };
          const stepIdx = stepMap[step];
          const isActive = i === stepIdx;
          const isDone = i < stepIdx || (i === stepIdx && step === 'done');
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${isDone ? 'bg-accent-teal' : 'bg-border'}`} />}
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                isActive && step === 'cloning' ? 'bg-accent-orange text-white animate-pulse' :
                isActive ? 'bg-accent-orange text-white' :
                isDone ? 'bg-accent-teal/20 text-accent-teal' :
                'bg-bg-card text-text-muted border border-border'
              }`}>
                {isDone ? '\u2713' : i + 1}. {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <label className="block text-xs font-semibold text-text-secondary mb-2">
          Brand name or Meta Ad Library URL
        </label>
        <div className="flex gap-3">
          <input
            value={brandInput}
            onChange={e => setBrandInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScrape()}
            placeholder="e.g. BrandName or https://www.facebook.com/ads/library/?q=BrandName"
            className="flex-1 px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
          />
          <button
            onClick={handleScrape}
            disabled={loading || !brandInput.trim()}
            className="px-6 py-3 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm disabled:opacity-50"
          >
            {loading && step === 'input' ? 'Scraping...' : 'Scrape Ads'}
          </button>
        </div>
        {error && <p className="text-xs text-error mt-2">{error}</p>}
        {progress && <p className="text-xs text-accent-teal mt-2">{progress}</p>}
      </div>

      {/* Controls: Format + Strength */}
      {ads.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-6">
          {/* Format selector */}
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wider">Format</label>
            <div className="flex gap-1.5">
              {AD_FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    format.id === f.id
                      ? 'bg-accent-orange text-white shadow-sm'
                      : 'bg-bg-primary border border-border text-text-secondary hover:border-accent-orange/50'
                  }`}
                >
                  <span className="mr-1.5">{f.icon}</span>
                  {f.label}
                  <span className="ml-1 text-[9px] opacity-70">{f.w}x{f.h}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Strength slider */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 tracking-wider">
              Image Fidelity
              <span className="ml-2 normal-case font-normal text-text-muted">
                {strength <= 0.25 ? 'Max fidelity (minimal changes)' :
                 strength <= 0.4 ? 'High fidelity (text only)' :
                 strength <= 0.6 ? 'Balanced' :
                 strength <= 0.8 ? 'Creative (more changes)' :
                 'Full regen'}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-text-muted">Keep original</span>
              <input
                type="range"
                min={0.15}
                max={0.9}
                step={0.05}
                value={strength}
                onChange={e => setStrength(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-border accent-accent-orange cursor-pointer"
              />
              <span className="text-[10px] text-text-muted">Regenerate</span>
              <span className="text-xs font-mono font-bold text-accent-orange w-10 text-right">{Math.round(strength * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Ads Grid */}
      {ads.length > 0 && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-text-secondary">
                <span className="font-bold text-text-primary">{ads.length}</span> ads
                {selectedCount > 0 && (
                  <span> &mdash; <span className="text-accent-orange font-bold">{selectedCount} selected</span></span>
                )}
                {translatedCount > 0 && (
                  <span> &mdash; <span className="text-accent-teal">{translatedCount} translated</span></span>
                )}
                {generatedCount > 0 && (
                  <span> &mdash; <span className="text-green-400">{generatedCount} images</span></span>
                )}
              </p>
              <button
                onClick={selectAll}
                className="px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:text-text-primary"
              >
                {ads.every(a => a.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex gap-2">
              {selectedCount > 0 && step !== 'cloning' && (
                <button
                  onClick={handleCloneSelected}
                  disabled={loading}
                  className="px-6 py-2.5 bg-accent-orange text-white font-bold rounded-lg hover:bg-accent-orange-hover text-sm disabled:opacity-50"
                >
                  {loading ? 'Cloning...' : `Clone ${selectedCount} Ads to ${targetLanguage}`}
                </button>
              )}
              {step === 'cloning' && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-orange/20 text-accent-orange rounded-lg text-sm font-medium">
                  <div className="w-4 h-4 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
                  Cloning...
                </div>
              )}
              {(translatedCount > 0 || generatedCount > 0) && (
                <button
                  onClick={downloadAll}
                  className="px-4 py-2.5 border border-border text-text-secondary rounded-lg hover:text-text-primary text-sm"
                >
                  Download All (JSON)
                </button>
              )}
            </div>
          </div>

          {/* Ad cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ads.map(ad => (
              <div
                key={ad.id}
                className={`bg-bg-card border-2 rounded-xl overflow-hidden transition-all ${
                  ad.selected ? 'border-accent-orange shadow-lg shadow-accent-orange/10' : 'border-border hover:border-border/80'
                }`}
              >
                {/* Checkbox + header */}
                <div
                  className="px-3 py-2 border-b border-border flex items-center justify-between cursor-pointer"
                  onClick={() => !loading && toggleSelect(ad.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                      ad.selected
                        ? 'bg-accent-orange border-accent-orange text-white'
                        : 'border-border text-transparent'
                    }`}>
                      {'\u2713'}
                    </div>
                    <span className="text-xs font-bold text-text-muted truncate max-w-[120px]">{ad.page_name}</span>
                  </div>
                  {/* Clone status badge */}
                  {ad.cloneStatus === 'translating' && (
                    <span className="text-[10px] px-2 py-0.5 bg-accent-teal/20 text-accent-teal rounded animate-pulse">Translating...</span>
                  )}
                  {ad.cloneStatus === 'generating' && (
                    <span className="text-[10px] px-2 py-0.5 bg-accent-orange/20 text-accent-orange rounded animate-pulse">Generating...</span>
                  )}
                  {ad.cloneStatus === 'done' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      ad.generated_model?.includes('edit') ? 'bg-green-500/20 text-green-400' :
                      ad.generated_model?.includes('nano-banana') ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-green-500/20 text-green-400'
                    }`} title={ad.generated_model || ''}>
                      {ad.generated_model?.includes('edit') ? 'NB Pro Edit' :
                       ad.generated_model?.includes('nano-banana') ? 'NB Pro' : 'Done'}
                    </span>
                  )}
                  {ad.cloneStatus === 'error' && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded">Error</span>
                  )}
                  {!ad.cloneStatus && (
                    <span className="text-[10px] px-2 py-0.5 bg-bg-primary rounded text-text-muted">{ad.platform}</span>
                  )}
                </div>

                {/* Images: original + generated side by side */}
                <div className="flex">
                  {ad.image_url && (
                    <div className={`${ad.generated_image_url || ad.generating ? 'w-1/2 border-r border-border' : 'w-full'}`}>
                      <p className="text-[10px] text-text-muted uppercase text-center py-0.5 bg-bg-primary font-semibold tracking-wider">Original</p>
                      <div className="aspect-square bg-bg-primary">
                        <img src={ad.image_url} alt="Original" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {ad.generated_image_url && (
                    <div className="w-1/2">
                      <div className={`text-[10px] font-bold uppercase text-center py-1 tracking-wider ${
                        ad.generated_model?.includes('edit') ? 'bg-green-500 text-white' :
                        ad.generated_model?.includes('nano-banana') ? 'bg-emerald-600 text-white' :
                        'bg-accent-teal text-white'
                      }`}>
                        {ad.generated_model?.includes('edit') ? 'NB PRO EDIT (img2img)' :
                         ad.generated_model?.includes('nano-banana') ? 'NB PRO (txt2img)' :
                         ad.generated_model || 'Cloned'}
                      </div>
                      <div className="aspect-square bg-bg-primary">
                        <img src={ad.generated_image_url} alt="Cloned" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {ad.generating && !ad.generated_image_url && (
                    <div className="w-1/2">
                      <p className="text-[10px] text-accent-orange uppercase text-center py-1 bg-bg-primary font-semibold tracking-wider">Generating</p>
                      <div className="aspect-square bg-bg-primary flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-[10px] text-text-muted mt-2">NB Pro...</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Copy + actions */}
                <div className="p-3 space-y-2">
                  {/* Original copy */}
                  {ad.headline && <p className="text-xs font-bold text-text-primary line-clamp-2">{ad.headline}</p>}
                  {ad.body && <p className="text-[11px] text-text-secondary line-clamp-3">{ad.body}</p>}
                  {ad.cta && (
                    <span className="inline-block px-2 py-0.5 bg-border rounded text-[10px] text-text-muted">{ad.cta}</span>
                  )}

                  {/* Translated copy */}
                  {ad.translation && (
                    <div className="p-2.5 bg-accent-teal/10 rounded-lg border border-accent-teal/30 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] text-accent-teal uppercase font-bold">{targetLanguage}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyTranslatedText(ad); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-accent-teal/20 text-accent-teal hover:bg-accent-teal/30 transition-colors"
                        >
                          {copiedId === ad.id ? 'Copied!' : 'Copy text'}
                        </button>
                      </div>
                      <p className="text-xs font-bold text-text-primary">{ad.translation.translated_headline}</p>
                      <p className="text-[11px] text-text-secondary mt-1 line-clamp-3">{ad.translation.translated_body}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-accent-teal/10 rounded text-[10px] text-accent-teal">
                        {ad.translation.translated_cta}
                      </span>
                    </div>
                  )}

                  {/* Error message */}
                  {ad.cloneError && (
                    <p className="text-[10px] text-red-400 mt-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20 max-h-20 overflow-y-auto break-all">{ad.cloneError}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    {/* Re-generate button */}
                    {ad.translation && !ad.generating && (
                      <button
                        onClick={() => regenerateAd(ad.id)}
                        className="py-1.5 px-3 text-[10px] font-bold bg-accent-orange/20 text-accent-orange rounded-lg hover:bg-accent-orange/30 transition-colors"
                        title={`Re-generate with strength ${Math.round(strength * 100)}% and ${format.label} format`}
                      >
                        {ad.generated_image_url ? 'Re-generate' : 'Generate'}
                      </button>
                    )}

                    {/* Download */}
                    {ad.generated_image_url && (
                      <>
                        <button
                          onClick={() => downloadImage(ad.generated_image_url!, `ad-${ad.id}-cloned.png`)}
                          className="py-1.5 px-3 text-[10px] font-bold bg-accent-teal text-white rounded-lg hover:bg-accent-teal-hover transition-colors"
                        >
                          Download
                        </button>
                        <a
                          href={ad.generated_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-3 text-[10px] font-medium border border-border text-text-secondary rounded-lg hover:text-text-primary transition-colors"
                        >
                          Full size
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
