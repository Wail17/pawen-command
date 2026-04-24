// ============================================================
// PAWEN — Meta Ads CSV Parser
// Parses CSV exports from Meta Ads Manager into structured data
// Handles multiple Meta export formats + custom CSV
// ============================================================

export interface AdRow {
  // Identity
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;

  // Date
  date: string; // YYYY-MM-DD

  // Core metrics (raw from Meta, no recalculation)
  impressions: number;
  reach: number;
  frequency: number;
  spend: number;
  clicks: number;
  link_clicks: number;
  ctr: number;       // % as decimal (e.g. 2.5 = 2.5%)
  cpc: number;
  cpm: number;
  cpp: number;       // cost per 1000 people reached
  conversions: number;
  conversion_value: number;
  cpa: number;
  roas: number;

  // Engagement
  video_views_3s?: number;
  video_views_thruplay?: number;
  post_reactions?: number;
  post_comments?: number;
  post_shares?: number;
  post_saves?: number;

  // Funnel classification
  funnel_stage?: 'tof' | 'mof' | 'bof' | 'retarget' | 'unknown';

  // Currency (from Meta export or detected)
  currency?: string;
}

export interface ParsedAdsData {
  rows: AdRow[];
  campaigns: string[];
  adsets: string[];
  ads: string[];
  dateRange: { min: string; max: string };
  currency: string;
  totalSpend: number;
  totalConversions: number;
  errors: string[];
}

// Map Meta Ads Manager column names to our field names
// Meta exports vary by language, account settings, and export type
const COLUMN_MAP: Record<string, keyof AdRow> = {
  // English
  'campaign name': 'campaign_name',
  'campaign_name': 'campaign_name',
  'ad set name': 'adset_name',
  'adset name': 'adset_name',
  'adset_name': 'adset_name',
  'ad name': 'ad_name',
  'ad_name': 'ad_name',
  'campaign id': 'campaign_id',
  'campaign_id': 'campaign_id',
  'ad set id': 'adset_id',
  'adset id': 'adset_id',
  'adset_id': 'adset_id',
  'ad id': 'ad_id',
  'ad_id': 'ad_id',
  'day': 'date',
  'date': 'date',
  'reporting starts': 'date',
  'reporting_start': 'date',
  'impressions': 'impressions',
  'reach': 'reach',
  'frequency': 'frequency',
  'amount spent': 'spend',
  'amount spent (usd)': 'spend',
  'amount spent (eur)': 'spend',
  'spend': 'spend',
  'cost': 'spend',
  'clicks (all)': 'clicks',
  'clicks': 'clicks',
  'link clicks': 'link_clicks',
  'link_clicks': 'link_clicks',
  'ctr (all)': 'ctr',
  'ctr (link click-through rate)': 'ctr',
  'ctr': 'ctr',
  'cpc (all)': 'cpc',
  'cpc (cost per link click)': 'cpc',
  'cpc': 'cpc',
  'cpm (cost per 1,000 impressions)': 'cpm',
  'cpm': 'cpm',
  'cpp (cost per 1,000 people reached)': 'cpp',
  'cpp': 'cpp',
  'results': 'conversions',
  'conversions': 'conversions',
  'purchases': 'conversions',
  'purchase': 'conversions',
  'actions:omni_purchase': 'conversions',
  'website purchases': 'conversions',
  'conversion value': 'conversion_value',
  'purchase roas': 'roas',
  'roas': 'roas',
  'website purchase roas': 'roas',
  'cost per result': 'cpa',
  'cost per purchase': 'cpa',
  'cost_per_result': 'cpa',
  'cpa': 'cpa',
  'cost per action': 'cpa',
  '3-second video views': 'video_views_3s',
  'video views': 'video_views_3s',
  'thruplay': 'video_views_thruplay',
  'thruplays': 'video_views_thruplay',
  'post reactions': 'post_reactions',
  'post comments': 'post_comments',
  'post shares': 'post_shares',
  'post saves': 'post_saves',

  // French (Meta exports in French)
  'nom de la campagne': 'campaign_name',
  'nom de l\'ensemble de publicités': 'adset_name',
  'nom de la publicité': 'ad_name',
  'montant dépensé': 'spend',
  'montant dépensé (eur)': 'spend',
  'montant dépensé (usd)': 'spend',
  'clics (tous)': 'clicks',
  'clics sur le lien': 'link_clicks',
  'portée': 'reach',
  'fréquence': 'frequency',
  'résultats': 'conversions',
  'valeur de conversion': 'conversion_value',
  'coût par résultat': 'cpa',
  'achats sur le site web': 'conversions',
  'roas des achats': 'roas',
  'jour': 'date',

  // Spanish
  'nombre de la campaña': 'campaign_name',
  'nombre del conjunto de anuncios': 'adset_name',
  'nombre del anuncio': 'ad_name',
  'importe gastado': 'spend',
  'importe gastado (usd)': 'spend',
  'importe gastado (eur)': 'spend',
  'clics (todos)': 'clicks',
  'clics en el enlace': 'link_clicks',
  'impresiones': 'impressions',
  'alcance': 'reach',
  'frecuencia': 'frequency',
  'resultados': 'conversions',
  'valor de conversión': 'conversion_value',
  'costo por resultado': 'cpa',
  'compras en el sitio web': 'conversions',
  'roas de las compras': 'roas',
  'día': 'date',
  'fecha': 'date',

  // German
  'kampagnenname': 'campaign_name',
  'name der anzeigengruppe': 'adset_name',
  'anzeigenname': 'ad_name',
  'ausgegebener betrag': 'spend',
  'ausgegebener betrag (eur)': 'spend',
  'ausgegebener betrag (usd)': 'spend',
  'klicks (alle)': 'clicks',
  'link-klicks': 'link_clicks',
  'impressionen': 'impressions',
  'reichweite': 'reach',
  'frequenz': 'frequency',
  'ergebnisse': 'conversions',
  'conversion-wert': 'conversion_value',
  'kosten pro ergebnis': 'cpa',
  'website-käufe': 'conversions',
  'roas (käufe)': 'roas',
  'tag': 'date',
  'datum': 'date',

  // Italian
  'nome della campagna': 'campaign_name',
  'nome del gruppo di inserzioni': 'adset_name',
  'nome dell\'inserzione': 'ad_name',
  'importo speso': 'spend',
  'importo speso (eur)': 'spend',
  'importo speso (usd)': 'spend',
  'clic (tutti)': 'clicks',
  'clic sul link': 'link_clicks',
  'impressioni': 'impressions',
  'copertura': 'reach',
  'frequenza': 'frequency',
  'risultati': 'conversions',
  'valore di conversione': 'conversion_value',
  'costo per risultato': 'cpa',
  'acquisti sul sito web': 'conversions',
  'roas degli acquisti': 'roas',
  'giorno': 'date',
  'data': 'date',

  // Portuguese
  'nome da campanha': 'campaign_name',
  'nome do conjunto de anúncios': 'adset_name',
  'nome do anúncio': 'ad_name',
  'valor gasto': 'spend',
  'valor gasto (brl)': 'spend',
  'valor gasto (usd)': 'spend',
  'cliques (todos)': 'clicks',
  'cliques no link': 'link_clicks',
  'impressões': 'impressions',
  // 'alcance' / 'resultados' already mapped via Spanish (same words in PT)
  'frequência': 'frequency',
  'valor da conversão': 'conversion_value',
  'custo por resultado': 'cpa',
  'compras no site': 'conversions',
  'roas de compras': 'roas',
  'dia': 'date',
};

function parseNumber(val: string | undefined): number {
  if (!val || val === '-' || val === '' || val === 'N/A') return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = val.replace(/[$€£¥₹,\s]/g, '').replace(/\u00A0/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(val: string | undefined): string {
  if (!val) return '';
  // Handle various date formats
  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  // DD/MM/YYYY (European)
  const euMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
  // MM/DD/YYYY (US)
  const usMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  // Mon DD, YYYY
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const namedMatch = val.match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (namedMatch) {
    const m = monthNames[namedMatch[1].toLowerCase()];
    if (m) return `${namedMatch[3]}-${m}-${namedMatch[2].padStart(2, '0')}`;
  }
  return val;
}

function detectCurrency(headers: string[], firstRow: Record<string, string>): string {
  // Check column names for currency hints
  for (const h of headers) {
    const match = h.match(/\((usd|eur|gbp|cad|aud|jpy|chf|sek|nok|dkk|pln|czk|huf|brl|mxn|inr|try)\)/i);
    if (match) return match[1].toUpperCase();
  }
  // Check values for currency symbols
  const spendKey = Object.keys(firstRow).find(k => COLUMN_MAP[k.toLowerCase()] === 'spend');
  if (spendKey) {
    const val = firstRow[spendKey];
    if (val?.includes('€')) return 'EUR';
    if (val?.includes('£')) return 'GBP';
    if (val?.includes('¥')) return 'JPY';
    if (val?.includes('₹')) return 'INR';
  }
  return 'USD';
}

// Detect funnel stage from campaign/adset naming conventions
function detectFunnelStage(campaignName: string, adsetName: string): AdRow['funnel_stage'] {
  const text = `${campaignName} ${adsetName}`.toLowerCase();

  // BOF patterns
  if (/\b(bof|bot(tom)?[\s_-]?(of)?[\s_-]?funnel|retarget|remarket|rmk|rt\b|dpa|catalog|dynamic|conversion|purchase|abo.*purchase)/i.test(text)) {
    return text.includes('retarget') || text.includes('rmk') || text.includes('rt ') ? 'retarget' : 'bof';
  }
  // MOF patterns
  if (/\b(mof|mid(dle)?[\s_-]?(of)?[\s_-]?funnel|consideration|engage|video[\s_-]?view|traffic|warm|atc|add[\s_-]?to[\s_-]?cart)/i.test(text)) {
    return 'mof';
  }
  // TOF patterns
  if (/\b(tof|top[\s_-]?(of)?[\s_-]?funnel|prospect|cold|awareness|reach|broad|lal|lookalike|interest|discovery)/i.test(text)) {
    return 'tof';
  }

  return 'unknown';
}

// Parse CSV string (handles quoted fields, newlines in quotes)
function parseCSVString(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\t' || char === ';') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // skip \n after \r
      } else {
        currentField += char;
      }
    }
  }

  // Don't forget last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function parseMetaAdsCSV(csvString: string): ParsedAdsData {
  const errors: string[] = [];
  const parsed = parseCSVString(csvString);

  if (parsed.length < 2) {
    return {
      rows: [], campaigns: [], adsets: [], ads: [],
      dateRange: { min: '', max: '' }, currency: 'USD',
      totalSpend: 0, totalConversions: 0, errors: ['CSV has less than 2 rows'],
    };
  }

  const headerRow = parsed[0];
  const dataRows = parsed.slice(1);

  // Map headers to field names
  const fieldMap: Array<{ index: number; field: keyof AdRow }> = [];
  const unmappedHeaders: string[] = [];

  for (let i = 0; i < headerRow.length; i++) {
    const raw = headerRow[i].toLowerCase().trim();
    const field = COLUMN_MAP[raw];
    if (field) {
      fieldMap.push({ index: i, field });
    } else if (raw) {
      unmappedHeaders.push(headerRow[i]);
    }
  }

  if (fieldMap.length === 0) {
    return {
      rows: [], campaigns: [], adsets: [], ads: [],
      dateRange: { min: '', max: '' }, currency: 'USD',
      totalSpend: 0, totalConversions: 0,
      errors: ['Could not map any CSV columns. Expected Meta Ads Manager export format.'],
    };
  }

  // Detect currency from headers
  const firstRowObj: Record<string, string> = {};
  if (dataRows[0]) {
    for (let i = 0; i < headerRow.length; i++) {
      firstRowObj[headerRow[i].toLowerCase().trim()] = dataRows[0][i] ?? '';
    }
  }
  const currency = detectCurrency(headerRow, firstRowObj);

  // Parse each row
  const rows: AdRow[] = [];
  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const rawRow = dataRows[rowIdx];
    if (!rawRow || rawRow.every(cell => !cell)) continue;

    const obj: Record<string, string> = {};
    for (const { index, field } of fieldMap) {
      obj[field] = rawRow[index] ?? '';
    }

    const row: AdRow = {
      campaign_name: obj.campaign_name || `Campaign ${rowIdx + 1}`,
      adset_name: obj.adset_name || '',
      ad_name: obj.ad_name || '',
      campaign_id: obj.campaign_id || undefined,
      adset_id: obj.adset_id || undefined,
      ad_id: obj.ad_id || undefined,
      date: parseDate(obj.date),
      impressions: parseNumber(obj.impressions),
      reach: parseNumber(obj.reach),
      frequency: parseNumber(obj.frequency),
      spend: parseNumber(obj.spend),
      clicks: parseNumber(obj.clicks),
      link_clicks: parseNumber(obj.link_clicks),
      ctr: parseNumber(obj.ctr),
      cpc: parseNumber(obj.cpc),
      cpm: parseNumber(obj.cpm),
      cpp: parseNumber(obj.cpp),
      conversions: parseNumber(obj.conversions),
      conversion_value: parseNumber(obj.conversion_value),
      cpa: parseNumber(obj.cpa),
      roas: parseNumber(obj.roas),
      video_views_3s: obj.video_views_3s ? parseNumber(obj.video_views_3s) : undefined,
      video_views_thruplay: obj.video_views_thruplay ? parseNumber(obj.video_views_thruplay) : undefined,
      post_reactions: obj.post_reactions ? parseNumber(obj.post_reactions) : undefined,
      post_comments: obj.post_comments ? parseNumber(obj.post_comments) : undefined,
      post_shares: obj.post_shares ? parseNumber(obj.post_shares) : undefined,
      post_saves: obj.post_saves ? parseNumber(obj.post_saves) : undefined,
      currency,
    };

    // Detect funnel stage
    row.funnel_stage = detectFunnelStage(row.campaign_name, row.adset_name);

    rows.push(row);
  }

  if (unmappedHeaders.length > 0 && unmappedHeaders.length <= 10) {
    errors.push(`Unmapped columns: ${unmappedHeaders.join(', ')}`);
  }

  const campaigns = [...new Set(rows.map(r => r.campaign_name).filter(Boolean))];
  const adsets = [...new Set(rows.map(r => r.adset_name).filter(Boolean))];
  const ads = [...new Set(rows.map(r => r.ad_name).filter(Boolean))];
  const dates = rows.map(r => r.date).filter(Boolean).sort();

  return {
    rows,
    campaigns,
    adsets,
    ads,
    dateRange: { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' },
    currency,
    totalSpend: rows.reduce((s, r) => s + r.spend, 0),
    totalConversions: rows.reduce((s, r) => s + r.conversions, 0),
    errors,
  };
}

// Aggregate rows by date for time-series charts
export function aggregateByDate(rows: AdRow[]): Array<{
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
}> {
  const byDate = new Map<string, AdRow[]>();
  for (const r of rows) {
    if (!r.date) continue;
    const bucket = byDate.get(r.date) ?? [];
    bucket.push(r);
    byDate.set(r.date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => {
      const spend = dayRows.reduce((s, r) => s + r.spend, 0);
      const impressions = dayRows.reduce((s, r) => s + r.impressions, 0);
      const clicks = dayRows.reduce((s, r) => s + r.clicks, 0);
      const conversions = dayRows.reduce((s, r) => s + r.conversions, 0);
      const conversion_value = dayRows.reduce((s, r) => s + r.conversion_value, 0);
      const reach = dayRows.reduce((s, r) => s + r.reach, 0);
      return {
        date,
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        conversions,
        conversion_value: Math.round(conversion_value * 100) / 100,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
        cpa: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
        roas: spend > 0 ? Math.round((conversion_value / spend) * 100) / 100 : 0,
        frequency: reach > 0 ? Math.round((impressions / reach) * 100) / 100 : 0,
      };
    });
}

// Aggregate rows by funnel stage
export function aggregateByFunnel(rows: AdRow[]): Array<{
  stage: string;
  label: string;
  color: string;
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpa: number;
  roas: number;
  adCount: number;
}> {
  const stages: Array<{ key: AdRow['funnel_stage']; label: string; color: string }> = [
    { key: 'tof', label: 'TOF (Top)', color: '#3b82f6' },
    { key: 'mof', label: 'MOF (Middle)', color: '#f59e0b' },
    { key: 'bof', label: 'BOF (Bottom)', color: '#10b981' },
    { key: 'retarget', label: 'Retarget', color: '#8b5cf6' },
    { key: 'unknown', label: 'Unclassified', color: '#6b7280' },
  ];

  return stages.map(({ key, label, color }) => {
    const stageRows = rows.filter(r => r.funnel_stage === key);
    const spend = stageRows.reduce((s, r) => s + r.spend, 0);
    const impressions = stageRows.reduce((s, r) => s + r.impressions, 0);
    const clicks = stageRows.reduce((s, r) => s + r.clicks, 0);
    const conversions = stageRows.reduce((s, r) => s + r.conversions, 0);
    const conversion_value = stageRows.reduce((s, r) => s + r.conversion_value, 0);
    const adNames = new Set(stageRows.map(r => r.ad_name));
    return {
      stage: key ?? 'unknown',
      label,
      color,
      spend: Math.round(spend * 100) / 100,
      conversions,
      impressions,
      clicks,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
      cpa: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
      roas: spend > 0 ? Math.round((conversion_value / spend) * 100) / 100 : 0,
      adCount: adNames.size,
    };
  }).filter(s => s.spend > 0);
}

// Detect underperforming ads
export interface PerfAlert {
  level: 'critical' | 'warning' | 'info';
  ad_name: string;
  campaign_name: string;
  metric: string;
  message: string;
  value: number;
  threshold: number;
}

export function detectUnderperformers(rows: AdRow[]): PerfAlert[] {
  const alerts: PerfAlert[] = [];

  // Group by ad name, compute aggregates
  const byAd = new Map<string, AdRow[]>();
  for (const r of rows) {
    const key = r.ad_name || r.adset_name || r.campaign_name;
    const bucket = byAd.get(key) ?? [];
    bucket.push(r);
    byAd.set(key, bucket);
  }

  for (const [adName, adRows] of byAd) {
    const totalSpend = adRows.reduce((s, r) => s + r.spend, 0);
    const totalImpressions = adRows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = adRows.reduce((s, r) => s + r.clicks, 0);
    const totalConversions = adRows.reduce((s, r) => s + r.conversions, 0);
    const totalReach = adRows.reduce((s, r) => s + r.reach, 0);
    const campaign = adRows[0].campaign_name;

    if (totalSpend < 5) continue; // Skip ads with negligible spend

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const frequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    // High frequency = ad fatigue
    if (frequency > 4) {
      alerts.push({
        level: frequency > 6 ? 'critical' : 'warning',
        ad_name: adName,
        campaign_name: campaign,
        metric: 'frequency',
        message: `Frequency ${frequency.toFixed(1)}x — audience fatigue, creative refresh needed`,
        value: frequency,
        threshold: 4,
      });
    }

    // Very low CTR
    if (ctr < 0.5 && totalImpressions > 1000) {
      alerts.push({
        level: ctr < 0.3 ? 'critical' : 'warning',
        ad_name: adName,
        campaign_name: campaign,
        metric: 'ctr',
        message: `CTR ${ctr.toFixed(2)}% — hook/creative not resonating`,
        value: ctr,
        threshold: 0.5,
      });
    }

    // High CPM (above $30)
    if (cpm > 30) {
      alerts.push({
        level: cpm > 50 ? 'critical' : 'warning',
        ad_name: adName,
        campaign_name: campaign,
        metric: 'cpm',
        message: `CPM $${cpm.toFixed(2)} — targeting too narrow or auction competition`,
        value: cpm,
        threshold: 30,
      });
    }

    // Spend without conversions
    if (totalSpend > 50 && totalConversions === 0) {
      alerts.push({
        level: totalSpend > 100 ? 'critical' : 'warning',
        ad_name: adName,
        campaign_name: campaign,
        metric: 'no_conversions',
        message: `$${totalSpend.toFixed(0)} spent, 0 conversions — consider killing this ad`,
        value: totalSpend,
        threshold: 50,
      });
    }

    // Declining performance (last 3 days vs first 3 days)
    if (adRows.length >= 6) {
      const sorted = [...adRows].sort((a, b) => a.date.localeCompare(b.date));
      const first3 = sorted.slice(0, 3);
      const last3 = sorted.slice(-3);
      const first3CTR = first3.reduce((s, r) => s + r.impressions, 0) > 0
        ? (first3.reduce((s, r) => s + r.clicks, 0) / first3.reduce((s, r) => s + r.impressions, 0)) * 100
        : 0;
      const last3CTR = last3.reduce((s, r) => s + r.impressions, 0) > 0
        ? (last3.reduce((s, r) => s + r.clicks, 0) / last3.reduce((s, r) => s + r.impressions, 0)) * 100
        : 0;

      if (first3CTR > 0 && last3CTR < first3CTR * 0.6) {
        alerts.push({
          level: 'warning',
          ad_name: adName,
          campaign_name: campaign,
          metric: 'ctr_decline',
          message: `CTR dropped ${Math.round((1 - last3CTR / first3CTR) * 100)}% — creative fatigue`,
          value: last3CTR,
          threshold: first3CTR * 0.6,
        });
      }
    }
  }

  // Sort: critical first, then warning, then info
  const levelOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
}
