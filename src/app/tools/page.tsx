'use client';

import Link from 'next/link';
import { MINI_TOOLS } from '@/lib/tools/registry';

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Tools</h1>
            <p className="text-text-muted text-xs">Mini-utilitaires standalone — pas liés à un projet</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted text-sm"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MINI_TOOLS.map((tool) => {
            const isLive = tool.status === 'live';
            const CardInner = (
              <div
                className={`bg-bg-card border border-border rounded-xl p-5 h-full ${
                  isLive ? 'hover:bg-bg-card-hover hover:border-border-active group' : 'opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3
                    className={`font-semibold text-text-primary ${
                      isLive ? 'group-hover:text-accent-orange' : ''
                    }`}
                  >
                    {tool.name}
                  </h3>
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded-md ${
                      tool.status === 'live'
                        ? 'bg-accent-orange/20 text-accent-orange'
                        : tool.status === 'beta'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-bg-primary text-text-muted'
                    }`}
                  >
                    {tool.status}
                  </span>
                </div>
                <p className="text-text-secondary text-sm mt-2">{tool.tagline}</p>
                <p className="text-text-muted text-xs mt-3 leading-relaxed">{tool.description}</p>
              </div>
            );

            return isLive ? (
              <Link key={tool.id} href={tool.path} className="block">
                {CardInner}
              </Link>
            ) : (
              <div key={tool.id}>{CardInner}</div>
            );
          })}
        </div>

        {MINI_TOOLS.length === 0 && (
          <div className="text-center py-20 text-text-secondary">Aucun tool encore.</div>
        )}
      </main>
    </div>
  );
}
