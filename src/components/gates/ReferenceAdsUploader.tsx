'use client';

import { useState, useCallback } from 'react';
import type { Project, AnalyzedAd } from '@/lib/types';

interface ReferenceAdsUploaderProps {
  project: Project;
  onProjectChange: (p: Project) => void;
}

export default function ReferenceAdsUploader({ project, onProjectChange }: ReferenceAdsUploaderProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ads = project.referenceAds || [];

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setAnalyzing(true);

    const newAds: AnalyzedAd[] = [...ads];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      try {
        // Read as base64
        const base64 = await fileToBase64(file);
        const mediaType = file.type;

        // Create thumbnail data URL for display
        const thumbnail = await createThumbnail(base64, mediaType, 200);

        // Send to Claude vision API
        const res = await fetch('/api/analyze-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mediaType,
            targetLanguage: project.targetLanguage || 'en',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.message || `Failed to analyze ${file.name}`);
          continue;
        }

        const { analysis } = await res.json();

        newAds.push({
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          imageDataUrl: thumbnail,
          analyzedAt: new Date().toISOString(),
          headline: analysis.headline || '',
          visual_description: analysis.visual_description || '',
          layout_structure: analysis.layout_structure || '',
          color_palette: analysis.color_palette || [],
          mood: analysis.mood || '',
          format_type: analysis.format_type || '',
          why_it_works: analysis.why_it_works || '',
          pattern_name: analysis.pattern_name || '',
          target_emotion: analysis.target_emotion || '',
          copywriting_elements: analysis.copywriting_elements || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    onProjectChange({ ...project, referenceAds: newAds, updatedAt: new Date().toISOString() });
    setAnalyzing(false);
    // Reset file input
    e.target.value = '';
  }, [ads, project, onProjectChange]);

  const handleRemove = useCallback((id: string) => {
    const filtered = ads.filter(a => a.id !== id);
    onProjectChange({ ...project, referenceAds: filtered, updatedAt: new Date().toISOString() });
  }, [ads, project, onProjectChange]);

  return (
    <div className="p-4 bg-bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Reference Ads ({ads.length})
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Upload your winning static ads — Claude analyses each one and uses them as creative templates
          </p>
        </div>
        <label className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
          analyzing
            ? 'bg-accent-orange/20 text-accent-orange cursor-wait'
            : 'bg-accent-teal text-white hover:bg-accent-teal-hover'
        }`}>
          {analyzing ? 'Analyzing...' : 'Upload Images'}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            disabled={analyzing}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
          {error}
        </div>
      )}

      {ads.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ads.map((ad) => (
            <div key={ad.id} className="relative group bg-bg-primary border border-border rounded-lg overflow-hidden">
              {/* Thumbnail */}
              <div className="aspect-square bg-black/5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.imageDataUrl}
                  alt={ad.headline || 'Reference ad'}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium text-text-primary truncate">
                  {ad.headline || 'No headline detected'}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-accent-teal/10 text-accent-teal rounded">
                    {ad.pattern_name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-accent-orange/10 text-accent-orange rounded">
                    {ad.format_type}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted mt-1 line-clamp-2">
                  {ad.why_it_works}
                </p>
              </div>

              {/* Colors */}
              {ad.color_palette.length > 0 && (
                <div className="flex px-2 pb-2 gap-0.5">
                  {ad.color_palette.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-sm border border-border"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemove(ad.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {ads.length === 0 && !analyzing && (
        <div className="text-center py-6 text-text-muted">
          <p className="text-sm">No reference ads yet</p>
          <p className="text-xs mt-1">Export your winning Canva ads as PNG/JPG and upload them here</p>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createThumbnail(dataUrl: string, _mediaType: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}
