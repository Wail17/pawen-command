// ============================================================
// PAWEN — Liquid Template Renderer (client-side via liquidjs)
// Handles Shopify-specific tags that liquidjs doesn't support
// ============================================================

import { Liquid } from 'liquidjs';

const engine = new Liquid({
  strictVariables: false,
  strictFilters: false,
  lenientIf: true,
});

// Register Shopify-specific BLOCK tags as no-ops (have matching end tags).
// form/paginate are NOT in this list — they're unwrapped (body preserved)
// because they contain renderable content like product-form fields.
const BLOCK_TAGS = ['schema', 'doc', 'stylesheet', 'javascript', 'style'];
for (const tag of BLOCK_TAGS) {
  engine.registerTag(tag, {
    parse(tagToken: unknown, remainTokens: { shift: () => { name?: string; raw?: string } }[]) {
      const tokens = remainTokens as unknown as { shift: () => { name?: string; raw?: string } | undefined };
      let token = tokens.shift();
      while (token) {
        if ('name' in (token || {}) && (token as { name?: string }).name === `end${tag}`) break;
        token = tokens.shift();
      }
    },
    render() { return ''; },
  } as never);
}

// Register Shopify-specific STANDALONE tags (no end tag)
const STANDALONE_TAGS = ['sections', 'section', 'content_for', 'layout'];
for (const tag of STANDALONE_TAGS) {
  // Only register if not already registered above as a block tag
  try {
    engine.registerTag(tag, {
      parse() { /* consume nothing — standalone tag */ },
      render() { return ''; },
    } as never);
  } catch { /* already registered */ }
}

// Register Shopify filters as best-effort shims so templates render something usable
// (instead of dumping raw strings like "reset.css base.css slider.css" when filters are ignored)
const toStr = (v: unknown): string => (v == null ? '' : String(v));
const asAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Default product object used when a product template is previewed with no real product.
// Shapes match Shopify Liquid product object so templates don't blow up on missing fields.
const DEFAULT_PRODUCT = {
  id: 1,
  title: 'Sample Product',
  handle: 'sample-product',
  description: '<p>Sample product description for preview. Replace with real Shopify data once linked.</p>',
  vendor: 'Preview Brand',
  type: 'Preview',
  tags: ['preview', 'sample'],
  price: 2990,
  price_min: 2990,
  price_max: 4990,
  price_varies: true,
  compare_at_price: 4990,
  compare_at_price_min: 4990,
  compare_at_price_max: 4990,
  compare_at_price_varies: false,
  available: true,
  url: '/products/sample-product',
  featured_image: { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Product', alt: 'Product', width: 800, height: 800, aspect_ratio: 1 },
  featured_media: { id: 1, media_type: 'image', src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Product', alt: 'Product', width: 800, height: 800, aspect_ratio: 1, preview_image: { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Product', width: 800, height: 800 } },
  images: [
    { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+1', alt: 'Image 1', width: 800, height: 800, aspect_ratio: 1 },
    { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+2', alt: 'Image 2', width: 800, height: 800, aspect_ratio: 1 },
    { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+3', alt: 'Image 3', width: 800, height: 800, aspect_ratio: 1 },
  ],
  media: [
    { id: 1, media_type: 'image', src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+1', alt: 'Image 1', width: 800, height: 800, aspect_ratio: 1, preview_image: { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+1', width: 800, height: 800 } },
    { id: 2, media_type: 'image', src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+2', alt: 'Image 2', width: 800, height: 800, aspect_ratio: 1, preview_image: { src: 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+2', width: 800, height: 800 } },
  ],
  options: ['Size'],
  options_with_values: [{ name: 'Size', position: 1, values: ['1 Pack', '3 Pack', '6 Pack'] }],
  variants: [
    { id: 101, title: '1 Pack', price: 2990, compare_at_price: 4990, available: true, sku: 'SKU-1', option1: '1 Pack', option2: null, option3: null, options: ['1 Pack'], inventory_quantity: 99, inventory_policy: 'deny', weight: 250, url: '/products/sample-product?variant=101', featured_image: null, selected: true, requires_shipping: true },
    { id: 102, title: '3 Pack', price: 7490, compare_at_price: 14970, available: true, sku: 'SKU-3', option1: '3 Pack', option2: null, option3: null, options: ['3 Pack'], inventory_quantity: 99, inventory_policy: 'deny', weight: 750, url: '/products/sample-product?variant=102', featured_image: null, selected: false, requires_shipping: true },
    { id: 103, title: '6 Pack', price: 11990, compare_at_price: 29940, available: true, sku: 'SKU-6', option1: '6 Pack', option2: null, option3: null, options: ['6 Pack'], inventory_quantity: 99, inventory_policy: 'deny', weight: 1500, url: '/products/sample-product?variant=103', featured_image: null, selected: false, requires_shipping: true },
  ],
  selected_variant: null,
  selected_or_first_available_variant: { id: 101, title: '1 Pack', price: 2990, compare_at_price: 4990, available: true, sku: 'SKU-1', option1: '1 Pack' },
  first_available_variant: { id: 101, title: '1 Pack', price: 2990, compare_at_price: 4990, available: true, sku: 'SKU-1', option1: '1 Pack' },
  has_only_default_variant: false,
  requires_selling_plan: false,
  selling_plan_groups: [],
  metafields: {},
  template_suffix: '',
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

// Resolve image-like inputs to a renderable URL.
// Handles: shopify://shop_images/foo.png, {image} objects, URLs, filenames, empty.
const resolveImgSrc = (input: unknown, w = 800, h = 600): string => {
  if (!input) return `https://placehold.co/${w}x${h}/e2e8f0/94a3b8?text=Image`;
  // Image object form {src, alt, width, height}
  if (typeof input === 'object' && input !== null && 'src' in input) {
    return resolveImgSrc((input as { src: unknown }).src, w, h);
  }
  const s = toStr(input).trim();
  if (!s) return `https://placehold.co/${w}x${h}/e2e8f0/94a3b8?text=Image`;
  // shopify://shop_images/xxx.png — extract filename and build a nice placeholder
  if (s.startsWith('shopify://')) {
    const name = s.split('/').pop() || 'image';
    const label = name.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '').slice(0, 24);
    return `https://placehold.co/${w}x${h}/e2e8f0/64748b?text=${encodeURIComponent(label)}`;
  }
  // Protocol-relative or absolute HTTP(S)
  if (/^(https?:)?\/\//.test(s) || s.startsWith('data:')) return s;
  // Bare filename → asset path
  if (/^[\w.\- ]+\.(png|jpg|jpeg|webp|gif|svg)$/i.test(s)) return `/assets/${s}`;
  return s;
};

engine.registerFilter('asset_url', (input: unknown) => `/assets/${toStr(input)}`);
engine.registerFilter('asset_img_url', (input: unknown) => `/assets/${toStr(input)}`);
engine.registerFilter('file_url', (input: unknown) => `/files/${toStr(input)}`);
engine.registerFilter('file_img_url', (input: unknown) => `/files/${toStr(input)}`);
engine.registerFilter('global_asset_url', (input: unknown) => `/global/${toStr(input)}`);
engine.registerFilter('shopify_asset_url', (input: unknown) => `/shopify/${toStr(input)}`);
engine.registerFilter('url_for_vendor', (input: unknown) => `/vendor/${toStr(input)}`);
engine.registerFilter('url_for_type', (input: unknown) => `/type/${toStr(input)}`);
engine.registerFilter('link_to', (label: unknown, url?: unknown) => `<a href="${asAttr(toStr(url) || '#')}">${toStr(label)}</a>`);
engine.registerFilter('link_to_type', (label: unknown) => toStr(label));
engine.registerFilter('link_to_vendor', (label: unknown) => toStr(label));
engine.registerFilter('link_to_tag', (label: unknown) => toStr(label));
engine.registerFilter('link_to_add_tag', (label: unknown) => toStr(label));
engine.registerFilter('link_to_remove_tag', (label: unknown) => toStr(label));
engine.registerFilter('within', (url: unknown) => toStr(url));
engine.registerFilter('stylesheet_tag', (url: unknown, media?: unknown) => {
  const m = toStr(media);
  return `<link rel="stylesheet" href="${asAttr(toStr(url))}"${m ? ` media="${asAttr(m)}"` : ''}>`;
});
engine.registerFilter('script_tag', (url: unknown) => `<script src="${asAttr(toStr(url))}"></script>`);
engine.registerFilter('preload_tag', (url: unknown, as?: unknown) => `<link rel="preload" href="${asAttr(toStr(url))}" as="${asAttr(toStr(as) || 'style')}">`);
engine.registerFilter('img_tag', (url: unknown, alt?: unknown, cls?: unknown) => `<img src="${asAttr(resolveImgSrc(url))}" alt="${asAttr(toStr(alt))}"${cls ? ` class="${asAttr(toStr(cls))}"` : ''}>`);
engine.registerFilter('image_tag', (url: unknown, alt?: unknown) => `<img src="${asAttr(resolveImgSrc(url))}" alt="${asAttr(toStr(alt))}">`);
engine.registerFilter('img_url', (input: unknown) => resolveImgSrc(input));
engine.registerFilter('image_url', (input: unknown) => resolveImgSrc(input));
engine.registerFilter('money', (input: unknown) => {
  const n = Number(input);
  if (Number.isFinite(n)) return `€${(n / 100).toFixed(2)}`;
  return `€${toStr(input)}`;
});
engine.registerFilter('money_with_currency', (input: unknown) => {
  const n = Number(input);
  if (Number.isFinite(n)) return `€${(n / 100).toFixed(2)} EUR`;
  return `€${toStr(input)} EUR`;
});
engine.registerFilter('money_without_currency', (input: unknown) => {
  const n = Number(input);
  if (Number.isFinite(n)) return `${(n / 100).toFixed(2)}`;
  return toStr(input);
});
engine.registerFilter('money_without_trailing_zeros', (input: unknown) => {
  const n = Number(input);
  if (Number.isFinite(n)) return `€${(n / 100).toFixed(0)}`;
  return `€${toStr(input)}`;
});
engine.registerFilter('t', (input: unknown) => toStr(input).replace(/^.*\./, ''));
engine.registerFilter('translate', (input: unknown) => toStr(input).replace(/^.*\./, ''));
engine.registerFilter('default_errors', () => '');
engine.registerFilter('default_pagination', () => '');
engine.registerFilter('highlight_active_tag', (input: unknown) => toStr(input));
engine.registerFilter('highlight', (input: unknown) => toStr(input));
engine.registerFilter('handleize', (input: unknown) => toStr(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('handle', (input: unknown) => toStr(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('md5', (input: unknown) => toStr(input));
engine.registerFilter('sha1', (input: unknown) => toStr(input));
engine.registerFilter('hmac_sha1', (input: unknown) => toStr(input));
engine.registerFilter('hmac_sha256', (input: unknown) => toStr(input));
engine.registerFilter('pluralize', (count: unknown, singular: unknown, plural?: unknown) => Number(count) === 1 ? toStr(singular) : toStr(plural || singular));
engine.registerFilter('customer_login_link', (label: unknown) => `<a href="#">${toStr(label)}</a>`);
engine.registerFilter('payment_type_img_url', (input: unknown) => `/payment/${toStr(input)}.svg`);
engine.registerFilter('placeholder_svg_tag', () => '<svg></svg>');
engine.registerFilter('inline_asset_content', (input: unknown) => toStr(input));
engine.registerFilter('external_video_url', (input: unknown) => toStr(input));
engine.registerFilter('external_video_tag', () => '');
engine.registerFilter('media_tag', () => '');
engine.registerFilter('video_tag', (input: unknown) => `<video src="${asAttr(toStr(input))}"></video>`);
engine.registerFilter('weight_with_unit', (input: unknown) => `${toStr(input)}g`);
engine.registerFilter('format_address', (input: unknown) => toStr(input));
engine.registerFilter('url_encode', (input: unknown) => encodeURIComponent(toStr(input)));
engine.registerFilter('url_escape', (input: unknown) => encodeURIComponent(toStr(input)));
engine.registerFilter('url_param_escape', (input: unknown) => encodeURIComponent(toStr(input)));
engine.registerFilter('class_list', (input: unknown) => toStr(input));
engine.registerFilter('image_position', () => 'center');
engine.registerFilter('image_preload_tag', (url: unknown) => `<link rel="preload" as="image" href="${asAttr(toStr(url))}">`);
engine.registerFilter('metafield_tag', (input: unknown) => toStr(input));
engine.registerFilter('metafield_text', (input: unknown) => toStr(input));
engine.registerFilter('structured_data', (input: unknown) => toStr(input));
engine.registerFilter('json', (input: unknown) => JSON.stringify(input));
engine.registerFilter('payment_button', () => '<button>Buy now</button>');
engine.registerFilter('payment_terms', () => '');
engine.registerFilter('time_tag', (input: unknown) => `<time>${toStr(input)}</time>`);

/**
 * Pre-process Shopify Liquid source before passing to liquidjs:
 * - Extract {% stylesheet %} blocks into CSS
 * - Strip {% schema %}, {% doc %} blocks
 * - Replace Shopify-specific objects with safe defaults
 */
function preprocessShopifyLiquid(source: string): { liquid: string; css: string } {
  let css = '';
  let liquid = source;

  // Extract {% stylesheet %} content (accepts {%- ... -%} trim markers)
  const stylesheetRegex = /\{%-?\s*stylesheet\s*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/gi;
  liquid = liquid.replace(stylesheetRegex, (_match, content) => {
    css += content + '\n';
    return '';
  });

  // Extract {% style %} content (inline styles in sections)
  const styleRegex = /\{%-?\s*style\s*-?%\}([\s\S]*?)\{%-?\s*endstyle\s*-?%\}/gi;
  liquid = liquid.replace(styleRegex, (_match, content) => {
    css += content + '\n';
    return '';
  });

  // Strip {% schema %} blocks entirely (theme editor config, not renderable)
  liquid = liquid.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/gi, '');

  // Strip {% doc %} blocks (documentation only)
  liquid = liquid.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/gi, '');

  // Strip {% javascript %} blocks for preview (they depend on Shopify's runtime)
  liquid = liquid.replace(/\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/gi, '');

  // Safety net: strip any orphan end-tags left behind (broken source, nested cases)
  liquid = liquid.replace(/\{%-?\s*end(?:doc|schema|stylesheet|style|javascript)\s*-?%\}/gi, '');
  liquid = liquid.replace(/\{%-?\s*(?:doc|schema|stylesheet|style|javascript)\s*-?%\}/gi, '');

  // Replace {{ block.shopify_attributes }} with empty string
  liquid = liquid.replace(/\{\{[\s]*block\.shopify_attributes[\s]*\}\}/gi, '');

  // Replace {% render 'snippet' %} with a placeholder showing snippet name
  liquid = liquid.replace(
    /\{%[-\s]*render\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
    (_match, name) => `<div style="border:1px dashed #ccc;padding:8px;margin:4px 0;font-size:12px;color:#888;border-radius:4px;">&#9654; ${escapeHtml(name)}</div>`
  );

  // Replace {% include 'snippet' %} similarly
  liquid = liquid.replace(
    /\{%[-\s]*include\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
    (_match, name) => `<div style="border:1px dashed #ccc;padding:8px;margin:4px 0;font-size:12px;color:#888;border-radius:4px;">&#9654; ${escapeHtml(name)}</div>`
  );

  // Replace {% section 'name' %} similarly
  liquid = liquid.replace(
    /\{%[-\s]*section\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
    (_match, name) => `<div style="border:1px dashed #94a3b8;padding:12px;margin:8px 0;font-size:13px;color:#64748b;border-radius:6px;background:#f8fafc;">&#9634; Section: ${escapeHtml(name)}</div>`
  );

  // Replace {% sections 'group-name' %} (section groups — header, footer, etc.)
  liquid = liquid.replace(
    /\{%[-\s]*sections\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
    (_match, name) => `<div style="border:1px dashed #94a3b8;padding:12px;margin:8px 0;font-size:13px;color:#64748b;border-radius:6px;background:#f8fafc;">&#9634; Section Group: ${escapeHtml(name)}</div>`
  );

  // Replace {{ content_for_header }} and {{ content_for_layout }} with placeholders
  liquid = liquid.replace(/\{\{[\s]*content_for_header[\s]*\}\}/gi, '<!-- content_for_header -->');
  liquid = liquid.replace(/\{\{[\s]*content_for_layout[\s]*\}\}/gi, '<div id="main-content"><!-- Page content renders here --></div>');

  // Handle t: translation filter — just show the key
  liquid = liquid.replace(/['"]t:([^'"]+)['"]\s*\|\s*t/g, '"$1"');

  return { liquid, css };
}

/**
 * Render a Shopify Liquid template with the given variables.
 */
export async function renderTemplate(
  liquidSource: string,
  variables: Record<string, unknown>,
): Promise<string> {
  try {
    const { liquid: preLiquid, css } = preprocessShopifyLiquid(liquidSource);
    // Safety: strip body-eating metadata/style/script tags that preprocessing might have missed.
    // form/paginate are UNWRAPPED (body kept) below — their inner content is renderable.
    const BODY_STRIP_TAGS = ['doc', 'schema', 'stylesheet', 'style', 'javascript'];
    let liquid = preLiquid;
    for (const name of BODY_STRIP_TAGS) {
      const balanced = new RegExp(`\\{%-?[\\s\\t]*${name}\\b[^%]*-?%\\}[\\s\\S]*?\\{%-?[\\s\\t]*end${name}[\\s\\t]*-?%\\}`, 'gi');
      liquid = liquid.replace(balanced, '');
      liquid = liquid.replace(new RegExp(`\\{%-?[\\s\\t]*end${name}[\\s\\t]*-?%\\}`, 'gi'), '');
      liquid = liquid.replace(new RegExp(`\\{%-?[\\s\\t]*${name}\\b[^%]*-?%\\}`, 'gi'), '');
    }
    // Unwrap form/paginate: drop open and close tags, keep body.
    for (const name of ['form', 'paginate']) {
      liquid = liquid.replace(new RegExp(`\\{%-?[\\s\\t]*${name}\\b[^%]*-?%\\}`, 'gi'), '');
      liquid = liquid.replace(new RegExp(`\\{%-?[\\s\\t]*end${name}[\\s\\t]*-?%\\}`, 'gi'), '');
    }
    if (typeof window !== 'undefined' && (liquid.includes('enddoc') || liquid.includes('{% doc') || liquid.includes('{%- doc'))) {
      console.warn('[renderer] doc tags still present after strip — dumping first match', liquid.match(/.{0,80}enddoc.{0,80}/)?.[0]);
    }
    const resolvedProduct = variables.product || DEFAULT_PRODUCT;
    const html = await engine.parseAndRender(liquid, {
      ...variables,
      // Provide common Shopify objects as safe defaults
      settings: variables.settings || {},
      block: { settings: {}, shopify_attributes: '', id: 'preview-block', ...(variables.block as Record<string, unknown> || {}) },
      section: { settings: {}, id: 'preview-section', blocks: [], ...(variables.section as Record<string, unknown> || {}) },
      request: { visual_preview_mode: false, page_type: 'product', locale: { iso_code: 'en' } },
      shop: { name: 'Preview Store', url: '#', currency: 'EUR', domain: 'preview.shop', email: 'contact@preview.shop', description: '', money_format: '€{{amount}}' },
      routes: { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', account_url: '/account', search_url: '/search', collections_url: '/collections', all_products_collection_url: '/collections/all' },
      template: { name: 'product', suffix: '' },
      page_title: 'Preview',
      canonical_url: '#',
      product: resolvedProduct,
      // Immutable anchor used by composer-injected `{% assign product = __primary_product %}` resets
      // after each block — stops `assign product = block.settings.product` from leaking across blocks.
      __primary_product: resolvedProduct,
      // Real Shopify resolves `closest.product` at the block scope — mock it so blocks that
      // do `assign product = closest.product | default: product` still get a valid product.
      closest: { product: resolvedProduct },
      collection: variables.collection || { title: 'Preview Collection', products: [], products_count: 0, handle: 'preview' },
      cart: { item_count: 0, total_price: 0, items: [], empty: true },
      customer: null,
      current_tags: [],
      powered_by_link: 'Shopify',
    });

    // Combine CSS + HTML, then post-process to catch any leftover shopify:// URLs
    // (e.g. referenced directly in HTML attributes without going through an image filter)
    const cssBlock = css.trim() ? `<style>${css}</style>` : '';
    const combined = cssBlock + html;
    return combined.replace(/shopify:\/\/shop_images\/([^"'\s<>]+)/g, (_m, name) => {
      const label = String(name).replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '').slice(0, 24);
      return `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(label)}`;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `<div style="color:#e74c3c;padding:20px;font-family:monospace;">
      <strong>Liquid render error:</strong><br/>${escapeHtml(message)}
    </div>`;
  }
}

/**
 * Wraps rendered HTML in a full document for iframe preview.
 * Includes theme CSS if available.
 */
export function wrapForPreview(html: string, themeCSS?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }
  </style>
  ${themeCSS ? `<style>${themeCSS}</style>` : ''}
</head>
<body>${html}</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
