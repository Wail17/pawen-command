'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ShopifyTheme, ThemeFile } from '@/lib/themes/types';
import { categorizeFile } from '@/lib/themes/types';
import { parseThemeZip } from '@/lib/themes/parseZip';

interface ThemeUploaderProps {
  projectId: string;
  onThemeLoaded: (theme: ShopifyTheme) => void;
}

type Tab = 'upload' | 'oauth' | 'manual';

export default function ThemeUploader({ projectId, onThemeLoaded }: ThemeUploaderProps) {
  const [tab, setTab] = useState<Tab>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OAuth tab state
  const [oauthShop, setOauthShop] = useState('');
  const [oauthConnected, setOauthConnected] = useState(false);
  const [oauthStore, setOauthStore] = useState('');
  const [oauthThemes, setOauthThemes] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [oauthSelectedTheme, setOauthSelectedTheme] = useState<number | null>(null);

  // Manual tab state
  const [storeUrl, setStoreUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [themes, setThemes] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);

  // Check OAuth connection on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/shopify-oauth/status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.connected) {
          setOauthConnected(true);
          setOauthStore(data.shop);
          setOauthThemes(data.themes || []);
          if (data.themes?.length > 0) {
            const live = data.themes.find((t: { role: string }) => t.role === 'main');
            setOauthSelectedTheme(live?.id || data.themes[0].id);
          }
          setTab('oauth'); // Auto-switch to OAuth tab if connected
        }
      } catch {
        // Not connected, no problem
      }
    })();
  }, []);

  // ── ZIP Upload ──
  const handleZipUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file (Shopify theme export)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const files = parseThemeZip(buffer);

      if (files.length === 0) {
        setError('No Liquid/JSON/CSS files found in the ZIP. Is this a Shopify theme?');
        setLoading(false);
        return;
      }

      const settingsSchema = files.find(f => f.path === 'config/settings_schema.json');
      const settingsData = files.find(f => f.path === 'config/settings_data.json');

      const theme: ShopifyTheme = {
        id: `theme-${Date.now()}`,
        projectId,
        name: file.name.replace('.zip', ''),
        source: 'upload',
        files,
        settingsSchema: settingsSchema ? safeJsonParse(settingsSchema.content) : undefined,
        settingsData: settingsData ? safeJsonParse(settingsData.content) : undefined,
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onThemeLoaded(theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse ZIP');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [projectId, onThemeLoaded]);

  // ── OAuth: Connect ──
  const handleOAuthConnect = useCallback(() => {
    if (!oauthShop) {
      setError('Enter your store URL');
      return;
    }
    // Redirect to OAuth authorize endpoint
    const shop = oauthShop.replace(/^https?:\/\//, '').replace(/\/$/, '');
    window.location.href = `/api/shopify-oauth/authorize?shop=${encodeURIComponent(shop)}&projectId=${encodeURIComponent(projectId)}`;
  }, [oauthShop, projectId]);

  // ── OAuth: Download theme ──
  const handleOAuthDownload = useCallback(async () => {
    if (!oauthSelectedTheme) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/shopify-oauth/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'download', themeId: oauthSelectedTheme }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to download theme');
        return;
      }
      const data = await res.json();
      const rawFiles = data.files as Array<{ path: string; content: string; size: number }>;

      const files: ThemeFile[] = rawFiles.map(f => ({
        path: f.path,
        content: f.content,
        type: categorizeFile(f.path),
        size: f.size,
      }));

      const settingsSchema = files.find(f => f.path === 'config/settings_schema.json');
      const settingsData = files.find(f => f.path === 'config/settings_data.json');
      const themeName = oauthThemes.find(t => t.id === oauthSelectedTheme)?.name || 'Shopify Theme';

      const theme: ShopifyTheme = {
        id: `theme-${Date.now()}`,
        projectId,
        name: themeName,
        source: 'api',
        storeUrl: oauthStore,
        files,
        settingsSchema: settingsSchema ? safeJsonParse(settingsSchema.content) : undefined,
        settingsData: settingsData ? safeJsonParse(settingsData.content) : undefined,
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onThemeLoaded(theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }, [oauthSelectedTheme, oauthThemes, oauthStore, projectId, onThemeLoaded]);

  // ── Manual: List themes ──
  const handleListThemes = useCallback(async () => {
    if (!storeUrl || !accessToken) {
      setError('Store URL and Access Token required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/shopify-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'list', storeUrl, accessToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to list themes');
        return;
      }
      const data = await res.json();
      setThemes(data.themes || []);
      if (data.themes?.length > 0) {
        const live = data.themes.find((t: { role: string }) => t.role === 'main');
        setSelectedThemeId(live?.id || data.themes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, [storeUrl, accessToken]);

  // ── Manual: Download theme ──
  const handleDownloadTheme = useCallback(async () => {
    if (!selectedThemeId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/shopify-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'download', storeUrl, accessToken, themeId: selectedThemeId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to download theme');
        return;
      }
      const data = await res.json();
      const rawFiles = data.files as Array<{ path: string; content: string; size: number }>;

      const files: ThemeFile[] = rawFiles.map(f => ({
        path: f.path,
        content: f.content,
        type: categorizeFile(f.path),
        size: f.size,
      }));

      const settingsSchema = files.find(f => f.path === 'config/settings_schema.json');
      const settingsData = files.find(f => f.path === 'config/settings_data.json');
      const themeName = themes.find(t => t.id === selectedThemeId)?.name || 'Shopify Theme';

      const theme: ShopifyTheme = {
        id: `theme-${Date.now()}`,
        projectId,
        name: themeName,
        source: 'api',
        storeUrl,
        files,
        settingsSchema: settingsSchema ? safeJsonParse(settingsSchema.content) : undefined,
        settingsData: settingsData ? safeJsonParse(settingsData.content) : undefined,
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onThemeLoaded(theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }, [selectedThemeId, storeUrl, accessToken, themes, projectId, onThemeLoaded]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'upload'
              ? 'bg-accent-teal text-white'
              : 'bg-bg-card text-text-muted hover:text-text-primary'
          }`}
        >
          Upload ZIP
        </button>
        <button
          onClick={() => setTab('oauth')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'oauth'
              ? 'bg-[#96bf48] text-white'
              : 'bg-bg-card text-text-muted hover:text-text-primary'
          }`}
        >
          {oauthConnected ? `Connected (${oauthStore})` : 'Connect Shopify'}
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'manual'
              ? 'bg-accent-orange text-white'
              : 'bg-bg-card text-text-muted hover:text-text-primary'
          }`}
        >
          Manual Token
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* ── Upload ZIP tab ── */}
      {tab === 'upload' && (
        <div className="bg-bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-bold text-text-primary mb-2">Upload Your Theme</h3>
          <p className="text-sm text-text-muted mb-4">
            Shopify Admin &rarr; Online Store &rarr; Themes &rarr; &quot;...&quot; &rarr; <strong>Download theme file</strong>.
            Upload the .zip here.
          </p>

          <label className={`block w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            loading
              ? 'border-accent-orange/50 bg-accent-orange/5 cursor-wait'
              : 'border-border hover:border-accent-teal hover:bg-accent-teal/5'
          }`}>
            {loading ? (
              <div className="text-accent-orange">
                <div className="text-2xl mb-2">Parsing theme...</div>
                <div className="text-sm">Extracting Liquid, JSON, CSS files</div>
              </div>
            ) : (
              <div className="text-text-muted">
                <div className="text-3xl mb-2">+</div>
                <div className="text-sm font-semibold">Drop your theme .zip here</div>
                <div className="text-xs mt-1">or click to browse</div>
              </div>
            )}
            <input
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* ── OAuth Connect tab ── */}
      {tab === 'oauth' && (
        <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          {oauthConnected ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <h3 className="text-lg font-bold text-text-primary">Connected to {oauthStore}</h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Select Theme</label>
                <select
                  value={oauthSelectedTheme ?? ''}
                  onChange={e => setOauthSelectedTheme(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                >
                  {oauthThemes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.role === 'main' ? '(LIVE)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleOAuthDownload}
                disabled={loading || !oauthSelectedTheme}
                className="w-full py-2.5 bg-[#96bf48] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Downloading theme files...' : 'Download & Open Theme'}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-text-primary mb-2">Connect with Shopify</h3>
              <p className="text-sm text-text-muted mb-4">
                One-click login. You&apos;ll be redirected to Shopify to authorize access to your themes.
              </p>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Store URL</label>
                <input
                  type="text"
                  value={oauthShop}
                  onChange={e => setOauthShop(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/50"
                />
              </div>

              <button
                onClick={handleOAuthConnect}
                disabled={!oauthShop}
                className="w-full py-3 bg-[#96bf48] hover:bg-[#7ea53d] text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 3.415c-.283-.084-.575.003-.748.215-.006.009-.576.701-.576.701s-1.06-.234-1.137-.252c.009-.042.554-3.214-2.241-3.214l-.205-.001C9.8.273 9.12 0 8.545 0 5.509 0 3.915 3.555 3.385 5.361l-2.088.648c-.614.195-.633.214-.714.795C.497 7.376 0 11.586 0 11.586l11.301 2.128L24 11.283s-5.535-7.22-8.663-7.868zM9.998 4.98l-1.737.539c.335-1.3.979-2.575 2.195-2.862-.29.644-.458 1.479-.458 2.323zm-2.05-2.18c.145 0 .264.013.366.04-1.044.494-2.164 1.735-2.637 4.219L3.963 7.6c.542-1.819 1.74-4.8 3.985-4.8zm-.49 10.695L5.2 11.665c0-.002 1.04-6.587 1.127-7.07.069.054.148.101.236.139 0 0-.108 2.148 1.037 3.559l-1.842.569 1.7.612zm2.093-.533l-1.598-.575 2.01-.624c-.214.536-.352 1.096-.412 1.199zm.486-3.017c-.14-.17-.256-.4-.343-.686.002-.015 1.012-.313 1.012-.313s-.463 1.092-1.015 1.578l.346-.579zm6.093 1.338L13.6 12.7l-.258-.94c1.391-.27 2.108-1.044 2.513-1.72l.275 1.243z"/>
                </svg>
                Connect with Shopify
              </button>

              <p className="text-xs text-text-muted text-center">
                Requires a Shopify Partner app with <code className="bg-bg-primary px-1 rounded">read_themes</code> scope
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Manual Token tab ── */}
      {tab === 'manual' && (
        <div className="bg-bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-bold text-text-primary mb-2">Manual Connection</h3>
          <p className="text-sm text-text-muted mb-4">
            Create a custom app in Shopify Admin &rarr; Settings &rarr; Apps &rarr; Develop apps.
            Give it <strong>read_themes</strong> scope and paste the access token here.
          </p>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1">Admin API Access Token</label>
            <input
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/50"
            />
          </div>

          {themes.length === 0 ? (
            <button
              onClick={handleListThemes}
              disabled={loading || !storeUrl || !accessToken}
              className="w-full py-2.5 bg-accent-orange text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Connect & List Themes'}
            </button>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Select Theme</label>
                <select
                  value={selectedThemeId ?? ''}
                  onChange={e => setSelectedThemeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                >
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.role === 'main' ? '(LIVE)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleDownloadTheme}
                disabled={loading || !selectedThemeId}
                className="w-full py-2.5 bg-accent-orange text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Downloading theme files...' : 'Download & Open Theme'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function safeJsonParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return undefined; }
}
