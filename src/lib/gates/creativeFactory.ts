// ============================================================
// PAWEN — Creative Factory (Usine à Créa)
//
// Combinatorial explosion engine: extracts ALL unique headlines
// from Gate 7 (ZAK + EVOLVE tracks), Gate 4 hooks, Gate 6
// headlines, then crosses them with the 8 presets. Each combo
// gets the best-matching brief's visual prompt as its template.
// ============================================================

export interface FactoryHeadline {
  text: string;
  source: 'zak' | 'evolve' | 'brief_option' | 'gate4_hook' | 'gate6';
  score?: number;
}

export interface FactoryCombo {
  id: string;
  headline: string;
  headlineSource: FactoryHeadline['source'];
  presetId: string;
  presetName: string;
  presetIcon: string;
  briefId: string;
  prompt: string;
  negativePrompt: string;
  format: 'feed_1x1' | 'story_9x16' | 'vertical_4x5';
  width: number;
  height: number;
  colorPalette: string[];
  emotionalIntent: string;
}

const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  feed_1x1: { w: 1080, h: 1080 },
  story_9x16: { w: 1080, h: 1920 },
  vertical_4x5: { w: 1080, h: 1350 },
};

const PRESET_META: Record<string, { icon: string; name: string }> = {
  before_after: { icon: '🔄', name: 'Before / After' },
  feature_highlight: { icon: '✨', name: 'Feature Highlight' },
  lifestyle_context: { icon: '🌿', name: 'Lifestyle' },
  problem_agitation: { icon: '⚡', name: 'Problem / Agitation' },
  social_proof: { icon: '⭐', name: 'Social Proof' },
  statistique_data: { icon: '📊', name: 'Statistique' },
  unboxing_product: { icon: '📦', name: 'Unboxing / Product' },
  us_vs_them: { icon: '⚔️', name: 'Us vs Them' },
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dig(obj: any, ...paths: string[]): unknown {
  for (const p of paths) {
    let cur = obj;
    for (const k of p.split('.')) {
      if (cur == null) break;
      cur = cur[k];
    }
    if (cur != null) return cur;
  }
  return undefined;
}

export function extractAllHeadlines(
  gate7Data: Record<string, unknown>,
  gate4Data?: Record<string, unknown>,
  gate6Data?: Record<string, unknown>,
): FactoryHeadline[] {
  const seen = new Set<string>();
  const headlines: FactoryHeadline[] = [];

  function add(text: unknown, source: FactoryHeadline['source'], score?: number) {
    if (typeof text !== 'string' || text.length < 4) return;
    const clean = text.trim();
    const key = normalize(clean);
    if (seen.has(key)) return;
    seen.add(key);
    headlines.push({ text: clean, source, score });
  }

  const studio = dig(gate7Data, 'static_ad_studio') as Record<string, unknown> | undefined;
  if (!studio) return headlines;

  // 1. Brief headline options (A/B/C from all 24 briefs)
  const presets = (studio.presets ?? {}) as Record<string, unknown>;
  for (const preset of Object.values(presets)) {
    const briefs = (preset as Record<string, unknown>)?.briefs;
    if (!Array.isArray(briefs)) continue;
    for (const brief of briefs) {
      const opts = (brief as Record<string, unknown>)?.headline_options;
      if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        for (const val of Object.values(opts as Record<string, unknown>)) {
          const v = val as Record<string, unknown>;
          add(v?.text ?? val, 'brief_option', (v?.score as Record<string, unknown>)?.total as number | undefined);
        }
      } else if (Array.isArray(opts)) {
        for (const h of opts) add(h, 'brief_option');
      }
      add((brief as Record<string, unknown>)?.recommended_headline, 'brief_option');
    }
  }

  // 2. ZAK headlines (metadata.zak_headlines or from sub-agent output)
  const metadata = studio.metadata as Record<string, unknown> | undefined;
  const zakRaw = dig(studio, 'zak_headlines', 'metadata.zak_headlines_raw');
  if (Array.isArray(zakRaw)) {
    for (const h of zakRaw) add(typeof h === 'string' ? h : (h as Record<string, unknown>)?.text, 'zak');
  }

  // 3. EVOLVE concepts
  const evolveRaw = dig(studio, 'evolve_concepts', 'metadata.evolve_concepts_raw');
  if (Array.isArray(evolveRaw)) {
    for (const c of evolveRaw) {
      const concept = c as Record<string, unknown>;
      add(concept?.headline ?? concept?.name, 'evolve');
    }
  }

  // 4. Winning angles (can have headlines embedded)
  const angles = studio.winning_angles;
  if (Array.isArray(angles)) {
    for (const a of angles as Record<string, unknown>[]) {
      add(a?.name, 'evolve');
      add(a?.reason_to_buy, 'evolve');
    }
  }

  // 5. Gate 4 hooks (trimmed to ≤12 words)
  if (gate4Data) {
    const hooks = dig(gate4Data, 'hooks', 'top_hooks', 'hook_bank') as unknown[];
    if (Array.isArray(hooks)) {
      for (const h of hooks) {
        const hook = typeof h === 'string' ? h : (h as Record<string, unknown>)?.hook ?? (h as Record<string, unknown>)?.text;
        if (typeof hook === 'string') {
          const trimmed = hook.split(/\s+/).slice(0, 12).join(' ');
          add(trimmed, 'gate4_hook', (h as Record<string, unknown>)?.score as number | undefined);
        }
      }
    }
  }

  // 6. Gate 6 headlines
  if (gate6Data) {
    const g6headlines = dig(gate6Data, 'headlines', 'ad_copy.headlines', 'headline_bank') as unknown[];
    if (Array.isArray(g6headlines)) {
      for (const h of g6headlines) add(typeof h === 'string' ? h : (h as Record<string, unknown>)?.text, 'gate6');
    }
  }

  // Sort: scored first (descending), then brief_option, then others
  headlines.sort((a, b) => {
    if (a.score != null && b.score != null) return b.score - a.score;
    if (a.score != null) return -1;
    if (b.score != null) return 1;
    return 0;
  });

  return headlines;
}

interface BriefTemplate {
  id: string;
  presetId: string;
  prompt: string;
  negativePrompt: string;
  colorPalette: string[];
  emotionalIntent: string;
}

function extractBriefTemplates(gate7Data: Record<string, unknown>): BriefTemplate[] {
  const studio = dig(gate7Data, 'static_ad_studio') as Record<string, unknown> | undefined;
  if (!studio) return [];
  const presets = (studio.presets ?? {}) as Record<string, unknown>;
  const templates: BriefTemplate[] = [];

  for (const [presetId, preset] of Object.entries(presets)) {
    const briefs = (preset as Record<string, unknown>)?.briefs;
    if (!Array.isArray(briefs)) continue;
    for (const brief of briefs as Record<string, unknown>[]) {
      const prompt =
        (brief.ai_generation_prompt as string) ??
        (brief.visual_direction as Record<string, unknown>)?.scene_description as string ??
        '';
      if (!prompt) continue;
      const vd = (brief.visual_direction ?? {}) as Record<string, unknown>;
      templates.push({
        id: (brief.id as string) ?? `${presetId}-unknown`,
        presetId,
        prompt,
        negativePrompt: (brief.negative_prompt as string) ?? 'text, watermark, blurry, deformed, low quality',
        colorPalette: Array.isArray(vd.color_palette) ? (vd.color_palette as string[]) : [],
        emotionalIntent: (brief.emotional_intent as string) ?? '',
      });
    }
  }
  return templates;
}

export function buildFactoryCombos(
  headlines: FactoryHeadline[],
  selectedPresets: string[],
  selectedFormats: string[],
  gate7Data: Record<string, unknown>,
): FactoryCombo[] {
  const templates = extractBriefTemplates(gate7Data);
  if (templates.length === 0 || headlines.length === 0) return [];

  const combos: FactoryCombo[] = [];
  let idx = 0;

  for (const hl of headlines) {
    for (const presetId of selectedPresets) {
      const meta = PRESET_META[presetId];
      if (!meta) continue;

      // Pick the best brief template for this preset
      const match = templates.find((t) => t.presetId === presetId) ?? templates[0];

      for (const fmt of selectedFormats) {
        const dims = FORMAT_DIMS[fmt];
        if (!dims) continue;
        combos.push({
          id: `factory-${idx++}`,
          headline: hl.text,
          headlineSource: hl.source,
          presetId,
          presetName: meta.name,
          presetIcon: meta.icon,
          briefId: match.id,
          prompt: match.prompt,
          negativePrompt: match.negativePrompt,
          format: fmt as FactoryCombo['format'],
          width: dims.w,
          height: dims.h,
          colorPalette: match.colorPalette,
          emotionalIntent: match.emotionalIntent,
        });
      }
    }
  }

  return combos;
}

export function comboCountEstimate(
  headlineCount: number,
  presetCount: number,
  formatCount: number,
): number {
  return headlineCount * presetCount * formatCount;
}
