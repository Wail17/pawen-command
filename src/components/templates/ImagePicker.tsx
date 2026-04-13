'use client';

import { useState } from 'react';

interface ImagePickerProps {
  shopifyImages: string[];
  gate8Images: Array<{ prompt: string; format: string }>;
  onInsert: (imageRef: string) => void;
  onClose: () => void;
}

export default function ImagePicker({ shopifyImages, gate8Images, onInsert, onClose }: ImagePickerProps) {
  const [tab, setTab] = useState<'shopify' | 'gate8'>('shopify');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Insert Image</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">x</button>
        </div>

        <div className="flex gap-1 px-5 py-2 border-b border-border">
          <button
            onClick={() => setTab('shopify')}
            className={`px-3 py-1 rounded text-xs font-medium ${tab === 'shopify' ? 'bg-accent-teal text-white' : 'text-text-muted'}`}
          >
            Shopify ({shopifyImages.length})
          </button>
          <button
            onClick={() => setTab('gate8')}
            className={`px-3 py-1 rounded text-xs font-medium ${tab === 'gate8' ? 'bg-accent-teal text-white' : 'text-text-muted'}`}
          >
            Gate 8 Configs ({gate8Images.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'shopify' && (
            <div className="grid grid-cols-3 gap-3">
              {shopifyImages.length === 0 && (
                <p className="col-span-3 text-xs text-text-muted text-center py-8">No Shopify images available</p>
              )}
              {shopifyImages.map((url, i) => (
                <div
                  key={i}
                  onClick={() => onInsert(url)}
                  className="aspect-square bg-bg-primary border border-border rounded-lg overflow-hidden cursor-pointer hover:border-accent-teal transition-colors"
                >
                  <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {tab === 'gate8' && (
            <div className="space-y-2">
              {gate8Images.length === 0 && (
                <p className="text-xs text-text-muted text-center py-8">No Gate 8 generation configs available. Run Gate 8 first.</p>
              )}
              {gate8Images.map((img, i) => (
                <div
                  key={i}
                  className="p-3 bg-bg-primary border border-border rounded-lg"
                >
                  <p className="text-xs text-text-primary mb-1">{img.prompt.slice(0, 100)}...</p>
                  <p className="text-[10px] text-text-muted">Format: {img.format}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
