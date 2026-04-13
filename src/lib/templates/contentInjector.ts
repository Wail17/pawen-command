// ============================================================
// PAWEN — Content Injector for Templates
// Extracts Liquid variables, auto-maps to CreativeContext fields,
// and builds the final variable values for rendering.
// ============================================================

import { CreativeContext } from '../gates/creativeContextAggregator';

/**
 * Extract all Liquid variable names from a template source.
 * Matches {{ variable }}, {{ variable.property }}, etc.
 */
export function extractLiquidVariables(source: string): string[] {
  const matches = source.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.[\]]*)\s*(?:\|[^}]*)?\}\}/g);
  const vars = new Set<string>();
  for (const m of matches) {
    // Strip filters and array notation for the base variable name
    const name = m[1].split('.')[0].split('[')[0];
    vars.add(name);
  }
  // Also extract variables from {% for item in collection %} blocks
  const forMatches = source.matchAll(/\{%\s*for\s+\w+\s+in\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*%\}/g);
  for (const m of forMatches) {
    vars.add(m[1].split('.')[0]);
  }
  return [...vars].sort();
}

// Auto-mapping rules: variable name pattern → path in CreativeContext
const AUTO_MAP_RULES: Array<{ pattern: RegExp; path: string; extract: (ctx: CreativeContext) => unknown }> = [
  // Product
  { pattern: /^product.?name$/i,     path: 'product.name',          extract: ctx => ctx.product.name },
  { pattern: /^product.?desc/i,      path: 'product.description',   extract: ctx => ctx.product.description },
  { pattern: /^price$/i,             path: 'product.price',         extract: ctx => ctx.product.price },
  { pattern: /^currency$/i,          path: 'product.currency',      extract: ctx => ctx.product.currency },
  { pattern: /^features$/i,          path: 'product.features',      extract: ctx => ctx.product.features },
  { pattern: /^reviews$/i,           path: 'product.reviews',       extract: ctx => ctx.product.reviews },
  { pattern: /^avg.?rating$/i,       path: 'product.avg_rating',    extract: ctx => ctx.product.avg_rating },
  { pattern: /^images$/i,            path: 'product.images',        extract: ctx => ctx.product.images },
  { pattern: /^variants$/i,          path: 'product.variants',      extract: ctx => ctx.product.variants },

  // Headlines / hooks
  { pattern: /^headline$/i,          path: 'headlines[0]',          extract: ctx => ctx.headlines?.[0] },
  { pattern: /^headlines$/i,         path: 'headlines',             extract: ctx => ctx.headlines },
  { pattern: /^hook$/i,              path: 'top_hooks[0].hook',     extract: ctx => ctx.top_hooks?.[0]?.hook },
  { pattern: /^hooks$/i,             path: 'top_hooks',             extract: ctx => ctx.top_hooks?.map(h => h.hook) },
  { pattern: /^sub.?headline$/i,     path: 'headlines[1]',          extract: ctx => ctx.headlines?.[1] },

  // Body copy
  { pattern: /^body$/i,              path: 'body_copies[0]',        extract: ctx => ctx.body_copies?.[0] },
  { pattern: /^body.?cop/i,          path: 'body_copies',           extract: ctx => ctx.body_copies },

  // Brand / Mechanism
  { pattern: /^mechanism$/i,         path: 'brand.mechanism_name',  extract: ctx => ctx.brand.mechanism_name },
  { pattern: /^mechanism.?name$/i,   path: 'brand.mechanism_name',  extract: ctx => ctx.brand.mechanism_name },
  { pattern: /^root.?cause$/i,       path: 'brand.root_cause',      extract: ctx => ctx.brand.root_cause },
  { pattern: /^belief.?error$/i,     path: 'brand.belief_error',    extract: ctx => ctx.brand.belief_error },
  { pattern: /^guarantee$/i,         path: 'brand.guarantee',       extract: ctx => ctx.brand.guarantee },
  { pattern: /^proof.?points$/i,     path: 'brand.key_proof_points', extract: ctx => ctx.brand.key_proof_points },
  { pattern: /^mechanism.?steps$/i,  path: 'brand.mechanism_steps', extract: ctx => ctx.brand.mechanism_steps },

  // Sub-avatar
  { pattern: /^avatar.?name$/i,      path: 'sub_avatar.name',       extract: ctx => ctx.sub_avatar.name },
  { pattern: /^pain.?quote/i,        path: 'brand.pain_quotes[0]',  extract: ctx => ctx.brand.pain_quotes?.[0] },
  { pattern: /^pain.?quotes$/i,      path: 'brand.pain_quotes',     extract: ctx => ctx.brand.pain_quotes },
  { pattern: /^desire.?quote/i,      path: 'brand.desire_quotes[0]', extract: ctx => ctx.brand.desire_quotes?.[0] },
  { pattern: /^verbatims$/i,         path: 'sub_avatar.verbatim_quotes', extract: ctx => ctx.sub_avatar.verbatim_quotes },
  { pattern: /^triggers$/i,          path: 'sub_avatar.emotional_triggers', extract: ctx => ctx.sub_avatar.emotional_triggers },

  // Story arc
  { pattern: /^problem$/i,           path: 'sub_avatar.story_angle.problem',    extract: ctx => ctx.sub_avatar.story_angle.problem },
  { pattern: /^agitation$/i,         path: 'sub_avatar.story_angle.agitation',  extract: ctx => ctx.sub_avatar.story_angle.agitation },
  { pattern: /^solution$/i,          path: 'sub_avatar.story_angle.solution',   extract: ctx => ctx.sub_avatar.story_angle.solution },
  { pattern: /^cta$/i,               path: 'sub_avatar.story_angle.cta',        extract: ctx => ctx.sub_avatar.story_angle.cta },

  // Concepts
  { pattern: /^concepts$/i,          path: 'ad_concepts',           extract: ctx => ctx.ad_concepts },

  // Visual
  { pattern: /^color.?brand$/i,      path: 'brand.color_brand',     extract: ctx => ctx.brand.color_brand },
  { pattern: /^color.?problem$/i,    path: 'brand.color_problem',   extract: ctx => ctx.brand.color_problem },
  { pattern: /^color.?solution$/i,   path: 'brand.color_solution',  extract: ctx => ctx.brand.color_solution },
];

/**
 * Auto-map detected variable names to CreativeContext paths.
 * Returns a map of { variableName: contextPath }.
 */
export function autoMapVariables(variableNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const varName of variableNames) {
    for (const rule of AUTO_MAP_RULES) {
      if (rule.pattern.test(varName)) {
        map[varName] = rule.path;
        break;
      }
    }
  }
  return map;
}

/**
 * Build template variables from a variable map + CreativeContext.
 * Resolves each mapped path to its actual value.
 */
export function buildTemplateVariables(
  variableMap: Record<string, string>,
  ctx: CreativeContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [varName, path] of Object.entries(variableMap)) {
    // Find the auto-map rule that matches this path and extract the value
    const rule = AUTO_MAP_RULES.find(r => r.path === path);
    if (rule) {
      result[varName] = rule.extract(ctx);
    } else {
      // Fallback: try to resolve the path manually on the context
      result[varName] = resolvePath(ctx, path);
    }
  }

  return result;
}

/**
 * Get all available content for the variable mapping dropdown.
 * Returns grouped options by gate/source.
 */
export function getAvailableContentOptions(ctx: CreativeContext): Array<{
  group: string;
  options: Array<{ path: string; label: string; preview: string }>;
}> {
  const groups: Array<{ group: string; options: Array<{ path: string; label: string; preview: string }> }> = [];

  // Product
  const productOpts: Array<{ path: string; label: string; preview: string }> = [];
  if (ctx.product.name) productOpts.push({ path: 'product.name', label: 'Product Name', preview: ctx.product.name });
  if (ctx.product.description) productOpts.push({ path: 'product.description', label: 'Product Description', preview: ctx.product.description.slice(0, 60) + '...' });
  if (ctx.product.price) productOpts.push({ path: 'product.price', label: 'Price', preview: ctx.product.price });
  if (ctx.product.features) productOpts.push({ path: 'product.features', label: 'Features (array)', preview: `${ctx.product.features.length} features` });
  if (ctx.product.reviews) productOpts.push({ path: 'product.reviews', label: 'Reviews (array)', preview: `${ctx.product.reviews.length} reviews` });
  if (productOpts.length) groups.push({ group: 'Product', options: productOpts });

  // Headlines & Hooks
  const hookOpts: Array<{ path: string; label: string; preview: string }> = [];
  if (ctx.headlines) {
    ctx.headlines.forEach((h, i) => hookOpts.push({ path: `headlines[${i}]`, label: `Headline ${i + 1}`, preview: h.slice(0, 60) }));
  }
  if (ctx.top_hooks) {
    ctx.top_hooks.forEach((h, i) => hookOpts.push({ path: `top_hooks[${i}].hook`, label: `Hook ${i + 1} (score: ${h.score})`, preview: h.hook.slice(0, 60) }));
  }
  if (hookOpts.length) groups.push({ group: 'Headlines & Hooks', options: hookOpts });

  // Body Copy
  if (ctx.body_copies?.length) {
    groups.push({
      group: 'Body Copy',
      options: ctx.body_copies.map((b, i) => ({ path: `body_copies[${i}]`, label: `Body ${i + 1}`, preview: b.slice(0, 60) })),
    });
  }

  // Brand DNA
  const brandOpts: Array<{ path: string; label: string; preview: string }> = [];
  brandOpts.push({ path: 'brand.mechanism_name', label: 'Mechanism Name', preview: ctx.brand.mechanism_name });
  brandOpts.push({ path: 'brand.root_cause', label: 'Root Cause', preview: ctx.brand.root_cause.slice(0, 60) });
  brandOpts.push({ path: 'brand.belief_error', label: 'Belief Error', preview: ctx.brand.belief_error.slice(0, 60) });
  brandOpts.push({ path: 'brand.guarantee', label: 'Guarantee', preview: ctx.brand.guarantee.slice(0, 60) });
  brandOpts.push({ path: 'brand.key_proof_points', label: 'Proof Points (array)', preview: `${ctx.brand.key_proof_points.length} points` });
  groups.push({ group: 'Brand DNA', options: brandOpts });

  // Story Arc
  groups.push({
    group: 'Story Arc',
    options: [
      { path: 'sub_avatar.story_angle.problem', label: 'Problem', preview: ctx.sub_avatar.story_angle.problem.slice(0, 60) },
      { path: 'sub_avatar.story_angle.agitation', label: 'Agitation', preview: ctx.sub_avatar.story_angle.agitation.slice(0, 60) },
      { path: 'sub_avatar.story_angle.solution', label: 'Solution', preview: ctx.sub_avatar.story_angle.solution.slice(0, 60) },
      { path: 'sub_avatar.story_angle.mechanism', label: 'Mechanism', preview: ctx.sub_avatar.story_angle.mechanism.slice(0, 60) },
      { path: 'sub_avatar.story_angle.cta', label: 'CTA', preview: ctx.sub_avatar.story_angle.cta.slice(0, 60) },
    ],
  });

  // Verbatims
  if (ctx.sub_avatar.verbatim_quotes.length) {
    groups.push({
      group: 'Verbatims',
      options: ctx.sub_avatar.verbatim_quotes.slice(0, 5).map((q, i) => ({
        path: `sub_avatar.verbatim_quotes[${i}]`,
        label: `Quote ${i + 1}`,
        preview: q.slice(0, 60),
      })),
    });
  }

  return groups;
}

// Resolve a dot-path like "brand.mechanism_name" or "headlines[0]" on an object
function resolvePath(obj: unknown, path: string): unknown {
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}
