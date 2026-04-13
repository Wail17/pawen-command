'use client';

import { useState } from 'react';

interface PreviewFrameProps {
  html: string;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export default function PreviewFrame({ html }: PreviewFrameProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');

  return (
    <div className="flex flex-col h-full">
      {/* Device toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-bg-card">
        {(['desktop', 'tablet', 'mobile'] as DeviceMode[]).map(d => (
          <button
            key={d}
            onClick={() => setDevice(d)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              device === d
                ? 'bg-accent-teal text-white'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {d === 'desktop' ? 'Desktop' : d === 'tablet' ? 'Tablet' : 'Mobile'}
          </button>
        ))}
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-[#f5f5f5] flex justify-center p-4">
        <div
          style={{ width: DEVICE_WIDTHS[device], maxWidth: '100%' }}
          className="bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
        >
          <iframe
            srcDoc={html}
            title="Template Preview"
            className="w-full border-0"
            style={{ minHeight: '600px', height: '100%' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
