'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject, saveProject } from '@/lib/store/db';
import { createProject } from '@/lib/store/project-utils';
import Pipeline from '@/components/ui/Pipeline';
import type {
  BrandSearchBrand,
  BrandSearchAd,
  BrandSearchProduct,
  BrandSearchSort,
  BrandSearchAction,
} from '@/lib/brandsearch/types';

type Tab = 'search' | 'deep-dive' | 'ads' | 'products' | 'scout';
type AdPlatform = 'meta' | 'tiktok' | 'instagram';
type AdSort = 'spend' | 'reach' | 'active_time';
type ResearchFamily = 'fresh_scaler' | 'momentum' | 'established' | null;

// 3 research families for competitive intelligence
const RESEARCH_FAMILIES: { id: ResearchFamily; label: string; emoji: string; description: string; filters: { meta_ads_active?: boolean; monthly_visits_min?: number; monthly_visits_max?: number; meta_total_min?: number; meta_total_max?: number; sort: BrandSearchSort } }[] = [
  {
    id: 'fresh_scaler',
    label: 'Just Started Scaling',
    emoji: '\uD83D\uDE80',
    description: 'New brands scaling aggressively — low traffic, high ad spend. Sorted by AOV to find high-margin products early.',
    filters: { meta_ads_active: true, monthly_visits_min: 1000, monthly_visits_max: 50000, meta_total_min: 5, sort: 'avg_price' },
  },
  {
    id: 'momentum',
    label: 'Scaling 3-5 Months',
    emoji: '\uD83D\uDCC8',
    description: 'Brands in growth mode — moderate traffic, consistent ads. Sorted by AOV to study profitable product-market fits.',
    filters: { meta_ads_active: true, monthly_visits_min: 50000, monthly_visits_max: 500000, meta_total_min: 20, sort: 'avg_price' },
  },
  {
    id: 'established',
    label: 'Established (2+ Years)',
    emoji: '\uD83C\uDFDB\uFE0F',
    description: 'Stable brands with proven funnels — high traffic, deep ad libraries. Sorted by AOV for premium positioning intel.',
    filters: { meta_ads_active: true, monthly_visits_min: 500000, meta_total_min: 50, sort: 'avg_price' },
  },
];

async function fetchBrandSearch(body: BrandSearchAction) {
  const res = await fetch('/api/brandsearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `Error ${res.status}`);
  }
  return res.json();
}

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | undefined | null, currency?: string): string {
  if (n === undefined || n === null) return '-';
  const symbols: Record<string, string> = {
    USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', CNY: '\u00A5',
    KRW: '\u20A9', INR: '\u20B9', BRL: 'R$', CAD: 'C$', AUD: 'A$',
    CHF: 'CHF ', SEK: 'kr ', NOK: 'kr ', DKK: 'kr ', PLN: 'z\u0142',
    CZK: 'K\u010D', HUF: 'Ft ', RON: 'lei ', TRY: '\u20BA', MXN: 'MX$',
    ZAR: 'R', SGD: 'S$', HKD: 'HK$', TWD: 'NT$', THB: '\u0E3F',
    MYR: 'RM', PHP: '\u20B1', IDR: 'Rp', VND: '\u20AB', PKR: 'Rs',
    CLP: 'CL$', COP: 'COL$', PEN: 'S/', ARS: 'AR$', ILS: '\u20AA',
    AED: 'AED ', SAR: 'SAR ', EGP: 'E\u00A3', NGN: '\u20A6', KES: 'KSh',
  };
  const code = (currency || 'USD').toUpperCase();
  const sym = symbols[code] ?? `${code} `;
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: n < 100 ? 2 : 0 });
  return `${sym}${formatted}`;
}

function FunnelBadge({ type }: { type?: string }) {
  if (!type) return null;
  const colors: Record<string, string> = {
    TOF: 'bg-blue-500/20 text-blue-400',
    MOF: 'bg-yellow-500/20 text-yellow-400',
    BOF: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${colors[type] || 'bg-bg-primary text-text-muted'}`}>
      {type}
    </span>
  );
}

export default function BrandSearchPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUrl, setSearchUrl] = useState('');
  const [minVisits, setMinVisits] = useState('');
  const [minAov, setMinAov] = useState('');
  const [maxAov, setMaxAov] = useState('');
  const [metaAdsActive, setMetaAdsActive] = useState(false);
  const [sortBy, setSortBy] = useState<BrandSearchSort>('monthly_visits');
  const [searchResults, setSearchResults] = useState<BrandSearchBrand[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Selected brand state
  const [selectedBrand, setSelectedBrand] = useState<BrandSearchBrand | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);

  // Ads state
  const [ads, setAds] = useState<BrandSearchAd[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsPlatform, setAdsPlatform] = useState<AdPlatform>('meta');
  const [adsSort, setAdsSort] = useState<AdSort>('spend');
  const [adsPage, setAdsPage] = useState(1);
  const [adsHasMore, setAdsHasMore] = useState(false);

  // Products state
  const [products, setProducts] = useState<BrandSearchProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productType, setProductType] = useState<'all' | 'bestsellers' | 'latest'>('bestsellers');

  // Research family filter
  const [activeFamily, setActiveFamily] = useState<ResearchFamily>(null);

  // Saved brands
  const [savedBrandIds, setSavedBrandIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      // Load saved competitor brand IDs
      const existing = p.competitorBrands;
      if (existing) {
        setSavedBrandIds(new Set(existing.map(b => b.id)));
      }
      setLoading(false);
    })();
  }, [projectId, router]);

  // === Apply research family preset ===
  const handleFamilyClick = useCallback((familyId: ResearchFamily) => {
    if (familyId === activeFamily) {
      // Deselect — clear family filters
      setActiveFamily(null);
      return;
    }
    const family = RESEARCH_FAMILIES.find(f => f.id === familyId);
    if (!family) return;
    setActiveFamily(familyId);
    // Apply family filter values to state
    setMinVisits(family.filters.monthly_visits_min?.toString() ?? '');
    setMetaAdsActive(family.filters.meta_ads_active ?? false);
    setSortBy(family.filters.sort);
  }, [activeFamily]);

  // === Search brands ===
  const handleSearch = useCallback(async (page = 1) => {
    setSearching(true);
    setSearchError(null);
    try {
      if (searchUrl.trim()) {
        // Search by URL
        const data = await fetchBrandSearch({ action: 'get_brand_by_url', url: searchUrl.trim() });
        setSearchResults(data ? [data] : []);
        setHasMore(false);
        setSearchPage(1);
      } else {
        // Build search params — include family-specific filters if active
        const familyFilters = activeFamily
          ? RESEARCH_FAMILIES.find(f => f.id === activeFamily)?.filters
          : undefined;

        const data = await fetchBrandSearch({
          action: 'search_brands',
          query: searchQuery.trim() || undefined,
          monthly_visits_min: minVisits ? parseInt(minVisits) : undefined,
          monthly_visits_max: familyFilters?.monthly_visits_max,
          meta_ads_active: metaAdsActive || undefined,
          meta_total_min: familyFilters?.meta_total_min,
          meta_total_max: familyFilters?.meta_total_max,
          avg_price_min: minAov ? parseFloat(minAov) : undefined,
          avg_price_max: maxAov ? parseFloat(maxAov) : undefined,
          sort: sortBy,
          page,
          page_size: 20,
        });
        if (page === 1) {
          setSearchResults(data.brands || []);
        } else {
          setSearchResults(prev => [...prev, ...(data.brands || [])]);
        }
        setHasMore(data.has_more ?? false);
        setSearchPage(page);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchUrl, minVisits, minAov, maxAov, metaAdsActive, sortBy, activeFamily]);

  // === Select brand (deep dive) ===
  const handleSelectBrand = useCallback(async (brand: BrandSearchBrand) => {
    setBrandLoading(true);
    try {
      const data = await fetchBrandSearch({ action: 'get_brand', brand_id: brand.id });
      setSelectedBrand(data);
      setActiveTab('deep-dive');
    } catch {
      // Use the basic brand data we already have
      setSelectedBrand(brand);
      setActiveTab('deep-dive');
    } finally {
      setBrandLoading(false);
    }
  }, []);

  // === Load ads ===
  const handleLoadAds = useCallback(async (page = 1) => {
    if (!selectedBrand) return;
    setAdsLoading(true);
    try {
      const data = await fetchBrandSearch({
        action: 'get_ads',
        brand_id: selectedBrand.id,
        platform: adsPlatform,
        page,
        page_size: 20,
      });
      const newAds = data.ads || [];
      if (page === 1) {
        setAds(newAds);
      } else {
        setAds(prev => [...prev, ...newAds]);
      }
      setAdsHasMore(data.has_more ?? false);
      setAdsPage(page);
    } catch {
      // silent
    } finally {
      setAdsLoading(false);
    }
  }, [selectedBrand, adsPlatform]);

  // === Load products ===
  const handleLoadProducts = useCallback(async () => {
    if (!selectedBrand) return;
    setProductsLoading(true);
    try {
      const data = await fetchBrandSearch({
        action: 'get_products',
        brand_id: selectedBrand.id,
        product_type: productType,
      });
      setProducts(data.products || []);
    } catch {
      // silent
    } finally {
      setProductsLoading(false);
    }
  }, [selectedBrand, productType]);

  // Auto-load when switching tabs
  useEffect(() => {
    if (activeTab === 'ads' && selectedBrand && ads.length === 0) {
      handleLoadAds(1);
    }
  }, [activeTab, selectedBrand, ads.length, handleLoadAds]);

  useEffect(() => {
    if (activeTab === 'products' && selectedBrand && products.length === 0) {
      handleLoadProducts();
    }
  }, [activeTab, selectedBrand, products.length, handleLoadProducts]);

  // === Save brand to project ===
  const handleSaveBrand = useCallback(async (brand: BrandSearchBrand) => {
    if (!project) return;
    const existing = (project.competitorBrands) || [];
    if (existing.some(b => b.id === brand.id)) return; // already saved

    const updated = {
      ...project,
      competitorBrands: [...existing, brand],
    };
    await saveProject(updated);
    setProject(updated);
    setSavedBrandIds(prev => new Set([...prev, brand.id]));
  }, [project]);

  const handleRemoveBrand = useCallback(async (brandId: string) => {
    if (!project) return;
    const existing = (project.competitorBrands) || [];
    const updated = {
      ...project,
      competitorBrands: existing.filter(b => b.id !== brandId),
    };
    await saveProject(updated);
    setProject(updated);
    setSavedBrandIds(prev => {
      const next = new Set(prev);
      next.delete(brandId);
      return next;
    });
  }, [project]);

  // Auto-search when a research family is selected
  useEffect(() => {
    if (activeFamily) handleSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamily]);

  // === Start Pipeline from brand (go to Gate 1 with brand pre-filled) ===
  const handleStartPipeline = useCallback(async (brand: BrandSearchBrand) => {
    // Create a new project pre-filled with brand data
    const newProject = createProject(
      brand.name || brand.url || 'New Project',
      project?.targetLanguage ?? 'en-US',
      project?.targetMarket ?? 'United States',
    );
    // Pre-fill product info from brand
    newProject.productUrl = brand.url ? `https://${brand.url.replace(/^https?:\/\//, '')}` : '';
    newProject.productDescription = brand.description || brand.name || '';
    newProject.niche = brand.niche || brand.sub_niche || '';
    // Save the brand as a competitor reference
    newProject.competitorBrands = [brand];
    await saveProject(newProject);
    // Navigate to Gate 1
    router.push(`/project/${newProject.id}/gate/gate1`);
  }, [project, router]);

  // === AI Product Scout ===
  const [scoutQuery, setScoutQuery] = useState('');
  const [scoutNiche, setScoutNiche] = useState('');
  const [scoutRunning, setScoutRunning] = useState(false);
  const [scoutResults, setScoutResults] = useState<{ brand: BrandSearchBrand; verdict: string; score: number; strengths: string[]; risks: string[]; angles: string[] }[]>([]);
  const [scoutError, setScoutError] = useState<string | null>(null);

  const handleRunScout = useCallback(async () => {
    if (!scoutNiche.trim()) return;
    setScoutRunning(true);
    setScoutError(null);
    setScoutResults([]);
    try {
      const res = await fetch('/api/brandsearch/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: scoutNiche.trim(),
          query: scoutQuery.trim() || undefined,
          targetLanguage: project?.targetLanguage ?? 'en-US',
          targetMarket: project?.targetMarket ?? 'United States',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Scout failed' }));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setScoutResults(data.results || []);
    } catch (err) {
      setScoutError(err instanceof Error ? err.message : 'Scout failed');
    } finally {
      setScoutRunning(false);
    }
  }, [scoutNiche, scoutQuery, project]);

  // Sort ads client-side
  const sortedAds = [...ads].sort((a, b) => {
    if (adsSort === 'spend') return (b.eu_total_spend ?? 0) - (a.eu_total_spend ?? 0);
    if (adsSort === 'reach') return (b.eu_total_reach ?? 0) - (a.eu_total_reach ?? 0);
    return (b.total_active_time ?? 0) - (a.total_active_time ?? 0);
  });

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">BrandSearch Intel</h1>
          <p className="text-sm text-text-secondary mt-1">
            Research competitor brands, ads, and products before starting the pipeline
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { id: 'search' as Tab, label: 'Search Brands', color: 'bg-accent-orange' },
            { id: 'scout' as Tab, label: 'AI Product Scout', color: 'bg-gradient-to-r from-purple-600 to-accent-orange' },
            { id: 'deep-dive' as Tab, label: 'Brand Deep Dive', color: 'bg-accent-teal', disabled: !selectedBrand },
            { id: 'ads' as Tab, label: 'Competitor Ads', color: 'bg-purple-600', disabled: !selectedBrand },
            { id: 'products' as Tab, label: 'Products', color: 'bg-blue-600', disabled: !selectedBrand },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? `${tab.color} text-white`
                  : tab.disabled
                    ? 'bg-bg-card text-text-muted cursor-not-allowed opacity-40'
                    : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.id !== 'search' && !selectedBrand && (
                <span className="ml-1 text-[10px] opacity-60">(select a brand first)</span>
              )}
            </button>
          ))}
        </div>

        {/* Saved brands bar */}
        {savedBrandIds.size > 0 && (
          <div className="mb-4 p-3 bg-bg-card border border-border rounded-xl">
            <p className="text-xs text-text-muted mb-2">Saved competitor brands ({savedBrandIds.size})</p>
            <div className="flex flex-wrap gap-2">
              {(project.competitorBrands || []).map(b => (
                <button
                  key={b.id}
                  onClick={() => handleSelectBrand(b)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-xs text-text-secondary hover:border-accent-orange transition-colors"
                >
                  {b.logo_url && (
                    <img src={b.logo_url} alt="" className="w-4 h-4 rounded object-cover" />
                  )}
                  <span>{b.name}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); handleRemoveBrand(b.id); }}
                    className="text-text-muted hover:text-error cursor-pointer ml-1"
                  >
                    x
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ======== SEARCH TAB ======== */}
        {activeTab === 'search' && (
          <div>
            {/* Research Family Presets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {RESEARCH_FAMILIES.map(family => (
                <button
                  key={family.id}
                  onClick={() => handleFamilyClick(family.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    activeFamily === family.id
                      ? 'bg-accent-orange/10 border-accent-orange shadow-lg shadow-accent-orange/10'
                      : 'bg-bg-card border-border hover:border-accent-orange/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{family.emoji}</span>
                    <span className={`text-sm font-bold ${activeFamily === family.id ? 'text-accent-orange' : 'text-text-primary'}`}>
                      {family.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{family.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {family.filters.monthly_visits_min && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">
                        {formatNumber(family.filters.monthly_visits_min)}+ visits
                      </span>
                    )}
                    {family.filters.monthly_visits_max && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">
                        &lt;{formatNumber(family.filters.monthly_visits_max)} visits
                      </span>
                    )}
                    {family.filters.meta_total_min && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">
                        {family.filters.meta_total_min}+ Meta ads
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Search inputs */}
            <div className="p-4 bg-bg-card border border-border rounded-xl mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Search by brand name</label>
                  <input
                    placeholder="e.g. Huel, Athletic Greens, Casper..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Or search by URL</label>
                  <input
                    placeholder="e.g. huel.com"
                    value={searchUrl}
                    onChange={e => setSearchUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch(1)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted"
                  />
                </div>
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Min monthly visits</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={minVisits}
                    onChange={e => setMinVisits(e.target.value)}
                    className="w-36 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">AOV min ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={minAov}
                    onChange={e => setMinAov(e.target.value)}
                    className="w-28 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">AOV max ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={maxAov}
                    onChange={e => setMaxAov(e.target.value)}
                    className="w-28 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as BrandSearchSort)}
                    className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary"
                  >
                    <option value="monthly_visits">Monthly Visits</option>
                    <option value="last_meta_active_count">Meta Ads Count</option>
                    <option value="estimated_sales">Estimated Sales</option>
                    <option value="avg_price">AOV (Avg Price)</option>
                    <option value="interest_score">Interest Score</option>
                    <option value="combined_followers">Followers</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-0.5">
                  <input
                    type="checkbox"
                    checked={metaAdsActive}
                    onChange={e => setMetaAdsActive(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-text-secondary">Meta ads active only</span>
                </label>
                <button
                  onClick={() => handleSearch(1)}
                  disabled={searching}
                  className="px-5 py-2 bg-accent-orange text-white rounded-lg text-sm font-medium hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {searchError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-xl">
                <p className="text-sm text-error">{searchError}</p>
              </div>
            )}

            {/* Results grid */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {searchResults.map(brand => (
                  <div
                    key={brand.id}
                    className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent-orange transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-bg-primary" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-bg-primary flex items-center justify-center text-text-muted text-xs font-bold">
                          {brand.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary truncate">{brand.name}</h3>
                        <a
                          href={`https://${(brand.url || brand.id || '').replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent-teal hover:underline truncate block"
                          onClick={e => e.stopPropagation()}
                        >
                          {brand.url || brand.id} &#x2197;
                        </a>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">Monthly Visits</p>
                        <p className="text-sm font-bold text-text-primary">{formatNumber(brand.monthly_visits)}</p>
                      </div>
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">Meta Ads</p>
                        <p className="text-sm font-bold text-text-primary">
                          <span className="text-success">{brand.meta_active_count ?? 0}</span>
                          <span className="text-text-muted font-normal"> / {brand.meta_total_count ?? '?'}</span>
                        </p>
                      </div>
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">Est. Sales</p>
                        <p className="text-sm font-bold text-text-primary">{formatCurrency(brand.estimated_sales)}</p>
                      </div>
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">AOV / Avg Price</p>
                        <p className="text-sm font-bold text-accent-orange">
                          {brand.avg_price ? formatCurrency(brand.avg_price, brand.currency) : '-'}
                          {brand.currency && brand.avg_price ? <span className="text-[9px] text-text-muted font-normal ml-1">{brand.currency}</span> : null}
                        </p>
                      </div>
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">Products</p>
                        <p className="text-sm font-bold text-text-primary">{brand.total_products ?? '-'}</p>
                      </div>
                      <div className="bg-bg-primary rounded-lg p-2">
                        <p className="text-[10px] text-text-muted">Niche</p>
                        <p className="text-xs font-medium text-accent-teal truncate">{brand.niche || '-'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectBrand(brand)}
                        disabled={brandLoading}
                        className="flex-1 px-3 py-1.5 bg-accent-teal text-white rounded-lg text-xs font-medium hover:bg-accent-teal-hover transition-colors"
                      >
                        Deep Dive
                      </button>
                      <button
                        onClick={() => handleStartPipeline(brand)}
                        className="px-3 py-1.5 bg-accent-orange text-white rounded-lg text-xs font-medium hover:bg-accent-orange-hover transition-colors"
                        title="Create new project from this brand and go to Gate 1"
                      >
                        Gate 1 &rarr;
                      </button>
                      {savedBrandIds.has(brand.id) ? (
                        <button
                          onClick={() => handleRemoveBrand(brand.id)}
                          className="px-3 py-1.5 bg-error/20 text-error rounded-lg text-xs font-medium hover:bg-error/30 transition-colors"
                        >
                          Unsave
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveBrand(brand)}
                          className="px-3 py-1.5 bg-success/20 text-success rounded-lg text-xs font-medium hover:bg-success/30 transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => handleSearch(searchPage + 1)}
                  disabled={searching}
                  className="px-6 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-secondary hover:border-accent-orange transition-colors"
                >
                  {searching ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}

            {!searching && searchResults.length === 0 && searchQuery && (
              <p className="text-center text-text-muted text-sm mt-8">No brands found. Try a different search.</p>
            )}
          </div>
        )}

        {/* ======== AI PRODUCT SCOUT TAB ======== */}
        {activeTab === 'scout' && (
          <div>
            <div className="p-5 bg-bg-card border border-border rounded-xl mb-4">
              <h2 className="text-lg font-bold text-text-primary mb-1">AI Product Scout</h2>
              <p className="text-xs text-text-muted mb-4">
                An AI agent searches BrandSearch using EVOLVE &amp; ZAK frameworks to find winning products in your niche.
                It evaluates each brand on ad scalability, market positioning, and creative angles.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-text-muted block mb-1">Niche / Product Category *</label>
                  <input
                    placeholder="e.g. dog harnesses, skincare 40+, sleep supplements..."
                    value={scoutNiche}
                    onChange={e => setScoutNiche(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRunScout()}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Keywords (optional)</label>
                  <input
                    placeholder="e.g. organic, premium, budget-friendly..."
                    value={scoutQuery}
                    onChange={e => setScoutQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRunScout()}
                    className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted"
                  />
                </div>
              </div>
              <button
                onClick={handleRunScout}
                disabled={scoutRunning || !scoutNiche.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-accent-orange text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {scoutRunning ? 'Scouting... (this takes ~30s)' : 'Launch AI Scout'}
              </button>
            </div>

            {scoutError && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-xl">
                <p className="text-sm text-error">{scoutError}</p>
              </div>
            )}

            {scoutResults.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-text-muted">{scoutResults.length} products evaluated</p>
                {scoutResults.map((r, idx) => (
                  <div key={r.brand.id ?? idx} className="p-4 bg-bg-card border border-border rounded-xl">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                          r.score >= 80 ? 'bg-success' : r.score >= 60 ? 'bg-yellow-500' : 'bg-error'
                        }`}>
                          {r.score}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-text-primary">{r.brand.name}</h3>
                          <p className="text-xs text-text-muted">{r.brand.url}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectBrand(r.brand)}
                          className="px-3 py-1.5 bg-accent-teal text-white rounded-lg text-xs font-medium"
                        >
                          Deep Dive
                        </button>
                        <button
                          onClick={() => handleStartPipeline(r.brand)}
                          className="px-3 py-1.5 bg-accent-orange text-white rounded-lg text-xs font-medium"
                        >
                          Gate 1 &rarr;
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-text-secondary mb-3">{r.verdict}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-success font-semibold mb-1">STRENGTHS</p>
                        {r.strengths.map((s, i) => (
                          <p key={i} className="text-xs text-text-secondary mb-0.5">+ {s}</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-error font-semibold mb-1">RISKS</p>
                        {r.risks.map((s, i) => (
                          <p key={i} className="text-xs text-text-secondary mb-0.5">- {s}</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-[10px] text-accent-orange font-semibold mb-1">AD ANGLES (ZAK/EVOLVE)</p>
                        {r.angles.map((s, i) => (
                          <p key={i} className="text-xs text-text-secondary mb-0.5">&bull; {s}</p>
                        ))}
                      </div>
                    </div>

                    {/* Brand stats row */}
                    <div className="flex gap-3 mt-3 flex-wrap">
                      {r.brand.monthly_visits && (
                        <span className="text-[10px] px-2 py-0.5 bg-bg-primary rounded text-text-muted">
                          {formatNumber(r.brand.monthly_visits)} visits/mo
                        </span>
                      )}
                      {r.brand.meta_active_count && (
                        <span className="text-[10px] px-2 py-0.5 bg-bg-primary rounded text-text-muted">
                          {r.brand.meta_active_count} active Meta ads
                        </span>
                      )}
                      {r.brand.estimated_sales && (
                        <span className="text-[10px] px-2 py-0.5 bg-bg-primary rounded text-text-muted">
                          {formatCurrency(r.brand.estimated_sales)} est. sales
                        </span>
                      )}
                      {r.brand.platform && (
                        <span className="text-[10px] px-2 py-0.5 bg-bg-primary rounded text-text-muted">
                          {r.brand.platform}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!scoutRunning && scoutResults.length === 0 && scoutNiche && (
              <div className="text-center mt-8">
                <p className="text-text-muted text-sm">Click &quot;Launch AI Scout&quot; to find winning products</p>
              </div>
            )}
          </div>
        )}

        {/* ======== DEEP DIVE TAB ======== */}
        {activeTab === 'deep-dive' && selectedBrand && (
          <div className="space-y-4">
            {/* Brand header */}
            <div className="p-5 bg-bg-card border border-border rounded-xl">
              <div className="flex items-start gap-4 mb-4">
                {selectedBrand.logo_url ? (
                  <img src={selectedBrand.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover bg-bg-primary" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-bg-primary flex items-center justify-center text-text-muted text-xl font-bold">
                    {selectedBrand.name?.charAt(0) || '?'}
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-text-primary">{selectedBrand.name}</h2>
                  <a
                    href={`https://${(selectedBrand.url || selectedBrand.id || '').replace(/^https?:\/\//, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-teal hover:underline"
                  >
                    {selectedBrand.url || selectedBrand.id} &#x2197;
                  </a>
                  {selectedBrand.description && (
                    <p className="text-xs text-text-secondary mt-2 line-clamp-3">{selectedBrand.description}</p>
                  )}
                </div>
                {!savedBrandIds.has(selectedBrand.id) && (
                  <button
                    onClick={() => handleSaveBrand(selectedBrand)}
                    className="px-4 py-2 bg-success/20 text-success rounded-lg text-sm font-medium hover:bg-success/30 transition-colors"
                  >
                    Save to Project
                  </button>
                )}
              </div>

              {/* Location */}
              {(selectedBrand.country || selectedBrand.city) && (
                <p className="text-xs text-text-muted mb-2">
                  Location: {[selectedBrand.city, selectedBrand.state, selectedBrand.country].filter(Boolean).join(', ')}
                </p>
              )}

              {/* Niche badge */}
              {selectedBrand.niche && (
                <span className="inline-block px-2 py-1 bg-accent-teal/20 text-accent-teal text-xs rounded-md mr-2">
                  {selectedBrand.niche}
                </span>
              )}
              {selectedBrand.sub_niche && (
                <span className="inline-block px-2 py-1 bg-bg-primary text-text-secondary text-xs rounded-md">
                  {selectedBrand.sub_niche}
                </span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Monthly Visits" value={formatNumber(selectedBrand.monthly_visits)} trend={selectedBrand.monthly_visits_trend} />
              <StatCard label="Estimated Sales" value={formatCurrency(selectedBrand.estimated_sales)} />
              <StatCard label="Estimated Revenue" value={formatCurrency(selectedBrand.estimated_revenue)} />
              <StatCard label="Interest Score" value={selectedBrand.interest_score?.toString() || '-'} />
              <StatCard label="Active Meta Ads" value={String(selectedBrand.meta_active_count ?? 0)} />
              <StatCard label="Inactive Meta Ads" value={String(selectedBrand.meta_inactive_count ?? 0)} />
              <StatCard label="Total Meta Spend" value={formatCurrency(selectedBrand.meta_total_spend, 'EUR')} trend={selectedBrand.meta_spend_trend} />
              <StatCard label="Avg Spend/Ad" value={formatCurrency(selectedBrand.meta_avg_spend_per_ad, 'EUR')} />
              <StatCard label="Total Products" value={String(selectedBrand.total_products ?? 0)} />
              <StatCard label="Avg Price" value={formatCurrency(selectedBrand.avg_price, selectedBrand.currency)} />
              <StatCard label="Price Range" value={`${formatCurrency(selectedBrand.min_price, selectedBrand.currency)} - ${formatCurrency(selectedBrand.max_price, selectedBrand.currency)}`} />
              <StatCard label="Avg Rating" value={selectedBrand.avg_rating ? `${selectedBrand.avg_rating.toFixed(1)} / 5` : '-'} />
            </div>

            {/* Social followers */}
            <div className="p-4 bg-bg-card border border-border rounded-xl">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Social Media</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { name: 'Facebook', followers: selectedBrand.facebook_followers, url: selectedBrand.facebook_url },
                  { name: 'Instagram', followers: selectedBrand.instagram_followers, url: selectedBrand.instagram_url },
                  { name: 'TikTok', followers: selectedBrand.tiktok_followers, url: selectedBrand.tiktok_url },
                  { name: 'YouTube', followers: selectedBrand.youtube_subscribers, url: selectedBrand.youtube_url },
                  { name: 'Twitter', followers: selectedBrand.twitter_followers, url: selectedBrand.twitter_url },
                  { name: 'Pinterest', followers: selectedBrand.pinterest_followers, url: selectedBrand.pinterest_url },
                ].map(s => (
                  <div key={s.name} className="bg-bg-primary rounded-lg p-3">
                    <p className="text-[10px] text-text-muted">{s.name}</p>
                    <p className="text-sm font-bold text-text-primary">{formatNumber(s.followers)}</p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-teal hover:underline truncate block">
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {selectedBrand.combined_followers !== undefined && (
                <p className="text-xs text-text-muted mt-2">
                  Combined followers: <span className="text-text-primary font-semibold">{formatNumber(selectedBrand.combined_followers)}</span>
                </p>
              )}
            </div>

            {/* Brand analysis */}
            {(selectedBrand.usps?.length || selectedBrand.personas?.length || selectedBrand.ad_angle_taxonomy?.length) && (
              <div className="p-4 bg-bg-card border border-border rounded-xl">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Brand Analysis</h3>
                <div className="space-y-3">
                  {selectedBrand.brand_positioning && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Positioning</p>
                      <p className="text-sm text-text-primary">{selectedBrand.brand_positioning}</p>
                    </div>
                  )}
                  {selectedBrand.usps && selectedBrand.usps.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">USPs</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBrand.usps.map((u, i) => (
                          <span key={i} className="px-2 py-1 bg-success/10 text-success text-xs rounded-md">{u}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedBrand.personas && selectedBrand.personas.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Personas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBrand.personas.map((p, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-md">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedBrand.ad_angle_taxonomy && selectedBrand.ad_angle_taxonomy.length > 0 && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Ad Angle Taxonomy</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBrand.ad_angle_taxonomy.map((a, i) => (
                          <span key={i} className="px-2 py-1 bg-accent-orange/10 text-accent-orange text-xs rounded-md">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tech stack */}
            {(selectedBrand.platform || selectedBrand.theme || selectedBrand.tech_stack?.length) && (
              <div className="p-4 bg-bg-card border border-border rounded-xl">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedBrand.platform && (
                    <span className="px-2 py-1 bg-bg-primary text-text-secondary text-xs rounded-md">
                      Platform: {selectedBrand.platform}
                    </span>
                  )}
                  {selectedBrand.theme && (
                    <span className="px-2 py-1 bg-bg-primary text-text-secondary text-xs rounded-md">
                      Theme: {selectedBrand.theme}
                    </span>
                  )}
                  {selectedBrand.tech_stack?.map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-bg-primary text-text-secondary text-xs rounded-md">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======== ADS TAB ======== */}
        {activeTab === 'ads' && selectedBrand && (
          <div>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex gap-1">
                {(['meta', 'tiktok', 'instagram'] as AdPlatform[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setAdsPlatform(p); setAds([]); setAdsPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      adsPlatform === p
                        ? 'bg-purple-600 text-white'
                        : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([
                  { id: 'spend' as AdSort, label: 'By Spend' },
                  { id: 'reach' as AdSort, label: 'By Reach' },
                  { id: 'active_time' as AdSort, label: 'By Active Time' },
                ]).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setAdsSort(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      adsSort === s.id
                        ? 'bg-accent-orange text-white'
                        : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleLoadAds(1)}
                disabled={adsLoading}
                className="px-4 py-1.5 bg-accent-teal text-white rounded-lg text-xs font-medium hover:bg-accent-teal-hover disabled:opacity-50 transition-colors"
              >
                {adsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Ads grid */}
            {sortedAds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedAds.map(ad => (
                  <div key={ad.id} className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-purple-500/50 transition-colors">
                    {/* Media thumbnail */}
                    {(ad.media_path || ad.hd_media_path) && (
                      <div className="relative aspect-video bg-bg-primary">
                        {ad.is_video ? (
                          <video
                            src={ad.hd_media_path || ad.media_path}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={ad.hd_media_path || ad.media_path}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {ad.is_video && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-black/70 text-white rounded">
                              Video {ad.duration ? `${ad.duration}s` : ''}
                            </span>
                          )}
                          <FunnelBadge type={ad.funnel_type} />
                        </div>
                        {ad.status && (
                          <span className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            ad.status === 'active' ? 'bg-success/80 text-white' : 'bg-border text-text-muted'
                          }`}>
                            {ad.status}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-4">
                      {/* Ad copy */}
                      {ad.content && (
                        <p className="text-xs text-text-secondary line-clamp-4 mb-3">{ad.content}</p>
                      )}

                      {/* Carousel cards */}
                      {ad.cards && ad.cards.length > 0 && (
                        <div className="flex gap-1 mb-3 overflow-x-auto">
                          {ad.cards.slice(0, 5).map((card, i) => (
                            <div key={i} className="flex-shrink-0 w-24 bg-bg-primary rounded p-1.5">
                              {card.image_url && (
                                <img src={card.image_url} alt="" className="w-full aspect-square object-cover rounded mb-1" loading="lazy" />
                              )}
                              {card.title && (
                                <p className="text-[10px] text-text-primary font-medium truncate">{card.title}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <p className="text-[10px] text-text-muted">Spend</p>
                          <p className="text-xs font-bold text-text-primary">{formatCurrency(ad.eu_total_spend, 'EUR')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">Reach</p>
                          <p className="text-xs font-bold text-text-primary">{formatNumber(ad.eu_total_reach)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">Active</p>
                          <p className="text-xs font-bold text-text-primary">{ad.total_active_time ? `${ad.total_active_time}d` : '-'}</p>
                        </div>
                      </div>

                      {/* Targeting */}
                      <div className="flex flex-wrap gap-1">
                        {ad.language && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-bg-primary text-text-muted rounded">{ad.language}</span>
                        )}
                        {ad.target_gender && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-bg-primary text-text-muted rounded">{ad.target_gender}</span>
                        )}
                        {ad.target_ages && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-bg-primary text-text-muted rounded">{ad.target_ages}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !adsLoading ? (
              <p className="text-center text-text-muted text-sm mt-8">No ads found. Try a different platform.</p>
            ) : null}

            {adsLoading && (
              <p className="text-center text-text-muted text-sm mt-4">Loading ads...</p>
            )}

            {/* Load more */}
            {adsHasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => handleLoadAds(adsPage + 1)}
                  disabled={adsLoading}
                  className="px-6 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-secondary hover:border-purple-500 transition-colors"
                >
                  {adsLoading ? 'Loading...' : 'Load More Ads'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======== PRODUCTS TAB ======== */}
        {activeTab === 'products' && selectedBrand && (
          <div>
            {/* Product type filter */}
            <div className="flex gap-2 mb-4">
              {(['bestsellers', 'latest', 'all'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setProductType(t); setProducts([]); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    productType === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
              <button
                onClick={handleLoadProducts}
                disabled={productsLoading}
                className="px-4 py-1.5 bg-accent-teal text-white rounded-lg text-xs font-medium hover:bg-accent-teal-hover disabled:opacity-50 transition-colors"
              >
                {productsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Products grid */}
            {products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-blue-500/50 transition-colors">
                    {product.image_url && (
                      <div className="aspect-square bg-bg-primary">
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-text-primary line-clamp-2 mb-1">{product.title}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        {product.price !== undefined && (
                          <span className="text-sm font-bold text-accent-orange">
                            {formatCurrency(product.price, product.currency)}
                          </span>
                        )}
                        {product.compare_at_price !== undefined && product.compare_at_price > (product.price ?? 0) && (
                          <span className="text-xs text-text-muted line-through">
                            {formatCurrency(product.compare_at_price, product.currency)}
                          </span>
                        )}
                      </div>
                      {product.rating !== undefined && (
                        <p className="text-xs text-text-muted">
                          Rating: {product.rating.toFixed(1)} ({product.review_count ?? 0} reviews)
                        </p>
                      )}
                      {product.product_type && product.product_type !== 'all' && (
                        <span className={`inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          product.product_type === 'bestseller' ? 'bg-success/20 text-success' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {product.product_type}
                        </span>
                      )}
                      {product.url && (
                        <a href={product.url} target="_blank" rel="noopener noreferrer"
                          className="block mt-2 text-[10px] text-accent-teal hover:underline truncate">
                          View product
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : !productsLoading ? (
              <p className="text-center text-text-muted text-sm mt-8">No products found.</p>
            ) : null}

            {productsLoading && (
              <p className="text-center text-text-muted text-sm mt-4">Loading products...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// === Helper components ===

function StatCard({ label, value, trend }: { label: string; value: string; trend?: number }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-3">
      <p className="text-[10px] text-text-muted mb-1">{label}</p>
      <p className="text-sm font-bold text-text-primary">{value}</p>
      {trend !== undefined && trend !== null && (
        <p className={`text-[10px] font-medium ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? '+' : ''}{(trend * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}
