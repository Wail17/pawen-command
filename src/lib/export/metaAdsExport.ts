// ============================================================
// PAWEN — Meta Ads Export Engine
// Formats gate outputs into ready-to-use Meta Ads structures.
// Supports: structured JSON, CSV, clipboard copy.
// ============================================================

import { Project, GateOutput, BrandDNA } from '../types';
import { getAllGateOutputs } from '../store/db';

export interface MetaAdVariant {
  id: string;
  name: string;
  type: 'image' | 'video' | 'carousel';
  funnel: string;
  primary_text: string;
  headline: string;
  description: string;
  cta: string;
  image_brief?: string;
  video_script?: string;
  source_gate: string;
}

export interface MetaAdsExport {
  project: {
    name: string;
    product: string;
    niche: string;
    market: string;
    language: string;
    funnel: string;
  };
  brand: {
    product_name: string;
    mechanism: string;
    guarantee: string;
    price?: string;
  } | null;
  ads: MetaAdVariant[];
  copy_arsenal: {
    hooks: string[];
    headlines: string[];
    body_copies: string[];
    ctas: string[];
  };
  advertorial?: {
    headline: string;
    blocks: string[];
  };
  campaign_blueprint?: Record<string, unknown>;
  exported_at: string;
}

/**
 * Build a complete Meta Ads export from all gate outputs.
 */
export async function buildMetaAdsExport(project: Project): Promise<MetaAdsExport> {
  const outputs = await getAllGateOutputs(project.id);
  const outputMap: Record<string, GateOutput> = {};
  for (const o of outputs) {
    outputMap[o.gateId] = o;
  }

  const brandDNA = project.brandDNA;

  // Extract copy arsenal from Gate 4
  const copyArsenal = extractCopyArsenal(outputMap['gate4']);

  // Extract ads from Gate 6 + Gate 7
  const ads = [
    ...extractAdsFromGate6(outputMap['gate6']),
    ...extractAdsFromGate7(outputMap['gate7']),
  ];

  // Extract advertorial from Gate 5
  const advertorial = extractAdvertorial(outputMap['gate5']);

  // Extract campaign blueprint from Gate 9
  const campaignBlueprint = outputMap['gate9']?.data;

  return {
    project: {
      name: project.name,
      product: project.shopifyData?.productTitle || project.productDescription || '',
      niche: project.niche || '',
      market: project.targetMarket,
      language: project.targetLanguage,
      funnel: project.selectedFunnel || 'any',
    },
    brand: brandDNA ? {
      product_name: brandDNA.product_name,
      mechanism: brandDNA.locked_terms.mechanism_name,
      guarantee: brandDNA.locked_terms.guarantee_wording,
      price: brandDNA.product_specs?.price,
    } : null,
    ads,
    copy_arsenal: copyArsenal,
    advertorial,
    campaign_blueprint: campaignBlueprint,
    exported_at: new Date().toISOString(),
  };
}

function extractCopyArsenal(output: GateOutput | undefined) {
  const result = { hooks: [] as string[], headlines: [] as string[], body_copies: [] as string[], ctas: [] as string[] };
  if (!output?.data) return result;

  const data = output.data;
  // Try common field names from Gate 4 output
  result.hooks = extractStringArray(data, ['hooks', 'hook_arsenal', 'open_loops']);
  result.headlines = extractStringArray(data, ['headlines', 'headline_arsenal']);
  result.body_copies = extractStringArray(data, ['body_copies', 'body_copy', 'copies']);
  result.ctas = extractStringArray(data, ['ctas', 'call_to_action', 'calls_to_action']);

  return result;
}

function extractAdsFromGate6(output: GateOutput | undefined): MetaAdVariant[] {
  if (!output?.data) return [];
  const ads: MetaAdVariant[] = [];
  const data = output.data;

  // Gate 6 = Ad Scripts & Copy — look for structured ad entries
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === 'object' && item !== null) {
          const ad = extractAdFromObject(item as Record<string, unknown>, `g6_${key}_${i}`, 'gate6');
          if (ad) ads.push(ad);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      const ad = extractAdFromObject(value as Record<string, unknown>, `g6_${key}`, 'gate6');
      if (ad) ads.push(ad);
    }
  }

  return ads;
}

function extractAdsFromGate7(output: GateOutput | undefined): MetaAdVariant[] {
  if (!output?.data) return [];
  const ads: MetaAdVariant[] = [];
  const data = output.data;

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === 'object' && item !== null) {
          const ad = extractAdFromObject(item as Record<string, unknown>, `g7_${key}_${i}`, 'gate7');
          if (ad) ads.push({ ...ad, type: 'image' });
        }
      }
    }
  }

  return ads;
}

function extractAdvertorial(output: GateOutput | undefined) {
  if (!output?.data) return undefined;
  const data = output.data;

  const headline = findFirstString(data, ['headline', 'title', 'advertorial_headline']) || '';
  const blocks: string[] = [];

  for (const [, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 100) {
      blocks.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.length > 50) blocks.push(item);
        else if (typeof item === 'object' && item !== null) {
          const content = (item as Record<string, unknown>).content || (item as Record<string, unknown>).text;
          if (typeof content === 'string') blocks.push(content);
        }
      }
    }
  }

  return blocks.length > 0 ? { headline, blocks } : undefined;
}

function extractAdFromObject(obj: Record<string, unknown>, id: string, gate: string): MetaAdVariant | null {
  const primaryText = findFirstString(obj, ['primary_text', 'body', 'body_copy', 'text', 'copy', 'content']) || '';
  const headline = findFirstString(obj, ['headline', 'title', 'hook', 'name']) || '';

  if (!primaryText && !headline) return null;

  return {
    id,
    name: headline.slice(0, 60) || `Ad ${id}`,
    type: findFirstString(obj, ['type', 'format']) === 'video' ? 'video' : 'image',
    funnel: findFirstString(obj, ['funnel', 'awareness_level']) || 'any',
    primary_text: primaryText,
    headline,
    description: findFirstString(obj, ['description', 'subtitle', 'subheadline']) || '',
    cta: findFirstString(obj, ['cta', 'call_to_action']) || 'Learn More',
    image_brief: findFirstString(obj, ['image_brief', 'image_prompt', 'visual', 'image_description']),
    video_script: findFirstString(obj, ['video_script', 'script']),
    source_gate: gate,
  };
}

function findFirstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return undefined;
}

function extractStringArray(data: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const val = data[key];
    if (Array.isArray(val)) {
      return val
        .map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>;
            return (obj.text || obj.content || obj.hook || obj.headline || obj.copy || '') as string;
          }
          return '';
        })
        .filter(s => s.length > 0);
    }
  }
  return [];
}

/**
 * Format export as CSV (for bulk upload tools).
 */
export function exportToCSV(exp: MetaAdsExport): string {
  const headers = ['Ad Name', 'Type', 'Primary Text', 'Headline', 'Description', 'CTA', 'Funnel', 'Source Gate'];
  const rows = exp.ads.map(ad => [
    ad.name,
    ad.type,
    `"${ad.primary_text.replace(/"/g, '""')}"`,
    `"${ad.headline.replace(/"/g, '""')}"`,
    `"${ad.description.replace(/"/g, '""')}"`,
    ad.cta,
    ad.funnel,
    ad.source_gate,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Format export as formatted text (for clipboard paste).
 */
export function exportToText(exp: MetaAdsExport): string {
  const lines: string[] = [];
  lines.push(`=== ${exp.project.name} — Meta Ads Export ===`);
  lines.push(`Product: ${exp.project.product}`);
  lines.push(`Market: ${exp.project.market} (${exp.project.language})`);
  lines.push(`Funnel: ${exp.project.funnel}`);
  lines.push('');

  if (exp.copy_arsenal.hooks.length > 0) {
    lines.push('--- HOOKS ---');
    exp.copy_arsenal.hooks.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
    lines.push('');
  }

  if (exp.copy_arsenal.headlines.length > 0) {
    lines.push('--- HEADLINES ---');
    exp.copy_arsenal.headlines.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
    lines.push('');
  }

  if (exp.ads.length > 0) {
    lines.push('--- ADS ---');
    for (const ad of exp.ads) {
      lines.push(`\n[${ad.name}] (${ad.type})`);
      lines.push(`Primary Text: ${ad.primary_text}`);
      lines.push(`Headline: ${ad.headline}`);
      if (ad.description) lines.push(`Description: ${ad.description}`);
      lines.push(`CTA: ${ad.cta}`);
    }
  }

  return lines.join('\n');
}
