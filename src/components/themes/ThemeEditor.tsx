'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ShopifyTheme, ThemeFile, ThemeEdit } from '@/lib/themes/types';
import { renderTemplate, wrapForPreview } from '@/lib/templates/renderer';
import type { CreativeContext } from '@/lib/gates/creativeContextAggregator';
import { buildTemplateVariables } from '@/lib/templates/contentInjector';

interface ThemeEditorProps {
  theme: ShopifyTheme;
  creativeContext: CreativeContext | null;
  onThemeChange: (theme: ShopifyTheme) => void;
}

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<PreviewDevice, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// Friendly page names from Shopify template filenames
const PAGE_LABELS: Record<string, { label: string; icon: string }> = {
  'index': { label: 'Home', icon: '🏠' },
  'product': { label: 'Product', icon: '🛍️' },
  'collection': { label: 'Collection', icon: '📦' },
  'collection.list': { label: 'All Collections', icon: '📋' },
  'blog': { label: 'Blog', icon: '📝' },
  'article': { label: 'Article', icon: '📰' },
  'page': { label: 'Page', icon: '📄' },
  'page.contact': { label: 'Contact', icon: '✉️' },
  'page.about': { label: 'About', icon: '👤' },
  'page.faq': { label: 'FAQ', icon: '❓' },
  'cart': { label: 'Cart', icon: '🛒' },
  'search': { label: 'Search', icon: '🔍' },
  '404': { label: '404', icon: '⚠️' },
  'password': { label: 'Password', icon: '🔒' },
  'gift_card': { label: 'Gift Card', icon: '🎁' },
  'customers/login': { label: 'Login', icon: '🔑' },
  'customers/account': { label: 'Account', icon: '👤' },
  'customers/register': { label: 'Register', icon: '📋' },
  'customers/order': { label: 'Order', icon: '📦' },
};

interface ThemePage {
  id: string;           // template file path
  name: string;         // e.g. "product"
  label: string;        // e.g. "Product"
  icon: string;         // emoji
  templatePath: string; // e.g. "templates/product.json"
  isJson: boolean;
}

export default function ThemeEditor({ theme, creativeContext, onThemeChange }: ThemeEditorProps) {
  const [showCode, setShowCode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [editSource, setEditSource] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build page list from templates/ folder
  const pages = useMemo<ThemePage[]>(() => {
    const templateFiles = theme.files.filter(f => f.path.startsWith('templates/'));
    const result: ThemePage[] = [];

    for (const f of templateFiles) {
      // Extract name: "templates/product.json" → "product", "templates/page.contact.json" → "page.contact"
      const basename = f.path.replace('templates/', '').replace(/\.(json|liquid)$/, '');
      // Skip customers/ subdirectory templates that are not in our list
      const lookupKey = basename;
      const info = PAGE_LABELS[lookupKey] || {
        label: basename.charAt(0).toUpperCase() + basename.slice(1).replace(/[._-]/g, ' '),
        icon: '📄',
      };

      result.push({
        id: f.path,
        name: basename,
        label: info.label,
        icon: info.icon,
        templatePath: f.path,
        isJson: f.path.endsWith('.json'),
      });
    }

    // Sort: Home first, then alphabetically
    return result.sort((a, b) => {
      if (a.name === 'index') return -1;
      if (b.name === 'index') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [theme.files]);

  // Active page
  const [activePageId, setActivePageId] = useState<string | null>(() => {
    // Default to home, then product, then first page
    const home = pages.find(p => p.name === 'index');
    if (home) return home.id;
    const product = pages.find(p => p.name === 'product');
    if (product) return product.id;
    return pages[0]?.id || null;
  });

  const activePage = pages.find(p => p.id === activePageId);
  const activeFile = theme.files.find(f => f.path === activePageId);

  // Sync editSource when active page changes
  useEffect(() => {
    if (activeFile) {
      setEditSource(activeFile.content);
    }
  }, [activeFile]);

  // Collect theme CSS from all .css files
  const themeCSS = useMemo(() =>
    theme.files
      .filter(f => f.path.endsWith('.css'))
      .map(f => `/* ${f.path} */\n${f.content}`)
      .join('\n'),
    [theme.files],
  );

  // Resolve a section group JSON (e.g. sections/header-group.json) into composed Liquid
  const resolveSectionGroup = useCallback((groupName: string): string => {
    // Try sections/{groupName}.json
    const groupFile = theme.files.find(
      f => f.path === `sections/${groupName}.json`,
    );
    if (!groupFile) return '';
    try {
      const json = JSON.parse(groupFile.content);
      const order: string[] = json.order || [];
      const sections: Record<string, { type?: string; settings?: Record<string, unknown> }> = json.sections || {};
      const parts: string[] = [];
      for (const key of order) {
        const sec = sections[key];
        if (!sec?.type) continue;
        const sectionFile = theme.files.find(f => f.path === `sections/${sec.type}.liquid`);
        if (sectionFile) {
          parts.push(`<!-- section-group ${groupName}: ${sec.type} -->\n${sectionFile.content}`);
        }
      }
      return parts.join('\n');
    } catch {
      return '';
    }
  }, [theme.files]);

  // Replace {% sections 'group' %} tags in layout with resolved content
  const resolveLayoutSectionGroups = useCallback((layoutSource: string): string => {
    return layoutSource.replace(
      /\{%[-\s]*sections\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
      (_match, groupName) => resolveSectionGroup(groupName),
    );
  }, [resolveSectionGroup]);

  // Strip metadata tags (doc/schema/stylesheet/javascript/style) from a block or snippet
  // file BEFORE inlining. Critical because {% doc %} comments in block files often contain
  // {% content_for 'block', type: X, id: Y %} @example tags — if left in, the sequential
  // regex passes in resolveContentFor will re-match them and inline blocks twice.
  // Also unwraps form/paginate (body kept) since liquidjs doesn't understand those tags.
  const cleanBlockFile = useCallback((content: string): string => {
    let v = content;
    v = v.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*stylesheet\s*-?%\}[\s\S]*?\{%-?\s*endstylesheet\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*style\s*-?%\}[\s\S]*?\{%-?\s*endstyle\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*form\b[^%]*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*endform\s*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*paginate\b[^%]*-?%\}/gi, '');
    v = v.replace(/\{%-?\s*endpaginate\s*-?%\}/gi, '');
    return v;
  }, []);

  // Resolve {% render 'name' %} and {% include 'name' %} with actual snippet content
  const resolveSnippets = useCallback((liquid: string, depth = 0): string => {
    if (depth > 4) return liquid; // prevent infinite recursion
    return liquid.replace(
      /\{%[-\s]*(?:render|include)\s+['"]([^'"]+)['"]\s*[^%]*%\}/gi,
      (_match, name) => {
        const snippetFile = theme.files.find(
          f => f.path === `snippets/${name}.liquid`,
        );
        if (snippetFile) {
          // Recursively resolve nested snippets
          return `<!-- snippet: ${name} -->\n${resolveSnippets(cleanBlockFile(snippetFile.content), depth + 1)}`;
        }
        // Not found — leave a small placeholder (renderer.ts will handle it)
        return _match;
      },
    );
  }, [theme.files, cleanBlockFile]);

  // Recursively resolve shopify:// URLs in any value to a visible placeholder
  const resolveShopifyUrls = useCallback((value: unknown): unknown => {
    if (typeof value === 'string') {
      if (value.startsWith('shopify://')) {
        const name = value.split('/').pop() || 'image';
        const label = name.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '').slice(0, 24);
        return `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(label)}`;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(resolveShopifyUrls);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = resolveShopifyUrls(v);
      }
      return out;
    }
    return value;
  }, []);

  // Recursively build a block drop with nested children
  type ShopifyBlockJson = {
    type?: string;
    settings?: Record<string, unknown>;
    blocks?: Record<string, ShopifyBlockJson>;
    block_order?: string[];
  };
  const buildBlockCtx = useCallback((b: ShopifyBlockJson, id: string): Record<string, unknown> => {
    const order = b.block_order || (b.blocks ? Object.keys(b.blocks) : []);
    const childBlocks = order
      .map(cid => (b.blocks?.[cid] ? buildBlockCtx(b.blocks[cid] as ShopifyBlockJson, cid) : null))
      .filter(Boolean) as Record<string, unknown>[];
    return {
      id,
      type: b.type || '',
      settings: resolveShopifyUrls(b.settings || {}) as Record<string, unknown>,
      blocks: childBlocks,
      blocks_count: childBlocks.length,
      shopify_attributes: '',
    };
  }, [resolveShopifyUrls]);

  // Build a Shopify-shaped section object (with recursively-nested blocks) from a JSON template entry
  const buildSectionContext = useCallback((
    key: string,
    sec: {
      type?: string;
      settings?: Record<string, unknown>;
      blocks?: Record<string, ShopifyBlockJson>;
      block_order?: string[];
    },
  ): Record<string, unknown> => {
    const blockOrder = sec.block_order || (sec.blocks ? Object.keys(sec.blocks) : []);
    const blocks = blockOrder
      .map(blockId => {
        const b = sec.blocks?.[blockId];
        if (!b) return null;
        return buildBlockCtx(b, blockId);
      })
      .filter(Boolean) as Record<string, unknown>[];
    return {
      id: key,
      settings: resolveShopifyUrls(sec.settings || {}) as Record<string, unknown>,
      blocks,
      blocks_count: blocks.length,
    };
  }, [resolveShopifyUrls, buildBlockCtx]);

  // Resolve {% content_for 'blocks' %} and {% content_for 'block', type, id %}
  // Shopify 2.0 — inline block template files from blocks/{type}.liquid recursively.
  // Walks nested child blocks (group → icon-with-text etc.), stashes each block drop
  // in extraVarsOut so liquidjs can access it. Emits {% assign product = __primary_product %}
  // after every {% assign block = %} so block-level `assign product = block.settings.product`
  // can't poison the outer `product` variable for sibling blocks and the main product section.
  const resolveContentFor = useCallback((
    liquid: string,
    ctx: Record<string, unknown>,
    varPrefix: string,
    depth: number,
    extraVarsOut: Record<string, unknown>,
  ): string => {
    if (depth > 6) return liquid;
    let out = liquid;

    // Pass 1: {% content_for 'blocks' %} — expand this ctx's own children
    out = out.replace(
      /\{%-?\s*content_for\s+['"]blocks['"]\s*-?%\}/gi,
      () => {
        const blocks = (ctx.blocks as Array<Record<string, unknown>>) || [];
        const parts: string[] = [];
        for (const b of blocks) {
          const btype = String(b.type || '');
          const bid = String(b.id || '');
          const blockFile = theme.files.find(f => f.path === `blocks/${btype}.liquid`)
            || theme.files.find(f => f.path === `blocks/_${btype}.liquid`);
          if (!blockFile) continue;
          const childVar = `${varPrefix}_${bid}`.replace(/[^a-z0-9_]/gi, '_');
          extraVarsOut[childVar] = b;
          const expanded = resolveContentFor(
            cleanBlockFile(blockFile.content),
            b,
            childVar,
            depth + 1,
            extraVarsOut,
          );
          parts.push(`{% assign block = ${childVar} %}\n{% assign product = __primary_product %}\n<!-- block: ${btype} id=${bid} -->\n${expanded}`);
        }
        return parts.join('\n\n');
      },
    );

    // Pass 2: {% content_for 'block', type: 'X', id: 'Y', ... %} — inline a specific block
    out = out.replace(
      /\{%-?\s*content_for\s+['"]block['"]\s*,\s*type:\s*['"]([^'"]+)['"]\s*,\s*id:\s*['"]([^'"]+)['"][^%]*-?%\}/gi,
      (_m, type: string, id: string) => {
        const blockFile = theme.files.find(f => f.path === `blocks/${type}.liquid`)
          || theme.files.find(f => f.path === `blocks/_${type}.liquid`);
        if (!blockFile) return '';
        const inlineVar = `__block_inline_${id}`.replace(/[^a-z0-9_]/gi, '_');
        if (!extraVarsOut[inlineVar]) {
          extraVarsOut[inlineVar] = { id, type, settings: {}, blocks: [], blocks_count: 0, shopify_attributes: '' };
        }
        const emptyCtx = { id, type, blocks: [] };
        const expanded = resolveContentFor(
          cleanBlockFile(blockFile.content),
          emptyCtx,
          inlineVar,
          depth + 1,
          extraVarsOut,
        );
        return `{% assign block = ${inlineVar} %}\n{% assign product = __primary_product %}\n<!-- inline block: ${type} id=${id} -->\n${expanded}`;
      },
    );

    return out;
  }, [theme.files, cleanBlockFile]);

  // Compose a JSON template into renderable Liquid + per-section context vars
  const composeTemplate = useCallback((
    source: string,
    filePath: string,
  ): { liquid: string; extraVars: Record<string, unknown> } => {
    const extraVars: Record<string, unknown> = {};

    // JSON templates: compose referenced sections
    if (filePath.endsWith('.json')) {
      try {
        const json = JSON.parse(source);
        const sectionOrder: string[] = json.order || [];
        const sections: Record<string, {
          type?: string;
          settings?: Record<string, unknown>;
          blocks?: Record<string, { type?: string; settings?: Record<string, unknown> }>;
          block_order?: string[];
        }> = json.sections || {};
        const parts: string[] = [];
        const layoutFile = theme.files.find(f => f.path === 'layout/theme.liquid');

        for (const key of sectionOrder) {
          const sec = sections[key];
          if (!sec?.type) continue;
          const sectionFile = theme.files.find(f => f.path === `sections/${sec.type}.liquid`);
          if (sectionFile) {
            const varName = `__section_${key.replace(/[^a-z0-9_]/gi, '_')}`;
            const sectionCtx = buildSectionContext(key, sec);
            extraVars[varName] = sectionCtx;
            const sectionVarPrefix = `__block_${key}`.replace(/[^a-z0-9_]/gi, '_');
            // Recursive content_for expansion — stashes every nested block in extraVars
            const withBlocks = resolveContentFor(
              sectionFile.content,
              sectionCtx,
              sectionVarPrefix,
              0,
              extraVars,
            );
            // Reset product after section assign so a prior block's `assign product = ...`
            // can't bleed into the next section.
            const scoped = `{% assign section = ${varName} %}\n{% assign product = __primary_product %}\n<!-- section: ${sec.type} -->\n${withBlocks}`;
            parts.push(scoped);
          } else {
            parts.push(`<div style="border:1px dashed #94a3b8;padding:12px;margin:8px 0;font-size:13px;color:#64748b;border-radius:6px;background:#f8fafc;">Section "${sec.type}" (file not found)</div>`);
          }
        }

        if (parts.length > 0) {
          const composed = parts.join('\n\n');
          if (layoutFile) {
            let layout = resolveLayoutSectionGroups(layoutFile.content);
            layout = layout.replace(
              /\{\{[\s]*content_for_layout[\s]*\}\}/gi,
              composed,
            );
            return { liquid: resolveSnippets(layout), extraVars };
          }
          return { liquid: resolveSnippets(composed), extraVars };
        }
        return {
          liquid: `<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;">This template has no sections to render</div>`,
          extraVars,
        };
      } catch {
        return {
          liquid: `<div style="padding:40px;text-align:center;color:#e74c3c;font-size:14px;">Could not parse template JSON</div>`,
          extraVars,
        };
      }
    }

    // .liquid templates: wrap in layout if available
    const layoutFile = theme.files.find(f => f.path === 'layout/theme.liquid');
    if (layoutFile && !filePath.startsWith('layout/')) {
      let layout = resolveLayoutSectionGroups(layoutFile.content);
      layout = layout.replace(
        /\{\{[\s]*content_for_layout[\s]*\}\}/gi,
        source,
      );
      return { liquid: resolveSnippets(layout), extraVars };
    }
    return { liquid: resolveSnippets(source), extraVars };
  }, [theme.files, resolveLayoutSectionGroups, resolveSnippets, buildSectionContext, resolveContentFor]);

  // Re-render preview when source or context changes
  useEffect(() => {
    if (!editSource || !activePageId) { setPreviewHtml(''); return; }
    const timer = setTimeout(async () => {
      const vars = creativeContext ? buildTemplateVariables({}, creativeContext) : {};
      const settings = theme.settingsData && typeof theme.settingsData === 'object'
        ? (theme.settingsData as Record<string, unknown>)
        : {};
      const { liquid: resolved, extraVars } = composeTemplate(editSource, activePageId);
      const html = await renderTemplate(resolved, { ...vars, ...settings, ...extraVars, settings });
      setPreviewHtml(wrapForPreview(html, themeCSS));
    }, 300);
    return () => clearTimeout(timer);
  }, [editSource, creativeContext, theme.settingsData, themeCSS, activePageId, composeTemplate]);

  // Save edits
  const saveCurrentFile = useCallback(() => {
    if (!activePageId || editSource === activeFile?.content) return;
    const updatedFiles = theme.files.map(f =>
      f.path === activePageId ? { ...f, content: editSource } : f
    );
    onThemeChange({
      ...theme,
      files: updatedFiles,
      activeFile: activePageId,
      updatedAt: new Date().toISOString(),
    });
  }, [activePageId, editSource, activeFile, theme, onThemeChange]);

  // Switch page
  const handlePageSelect = useCallback((pageId: string) => {
    saveCurrentFile();
    setActivePageId(pageId);
    setShowHistory(false);
    setShowCode(false);
  }, [saveCurrentFile]);

  // AI Chat edit — sends the composed section files, not just JSON
  const handleAiEdit = useCallback(async () => {
    if (!chatInput.trim() || !activeFile || chatLoading) return;
    setChatLoading(true);

    // For JSON templates, we need to send the section .liquid files that compose the page
    let editableSource = editSource;
    let editFilePaths: string[] = [activePageId!];

    if (activePage?.isJson) {
      try {
        const json = JSON.parse(editSource);
        const sectionOrder: string[] = json.order || [];
        const sections: Record<string, { type?: string }> = json.sections || {};
        const sectionSources: string[] = [];
        editFilePaths = [];

        for (const key of sectionOrder) {
          const sec = sections[key];
          if (!sec?.type) continue;
          const sectionFile = theme.files.find(f => f.path === `sections/${sec.type}.liquid`);
          if (sectionFile) {
            sectionSources.push(`=== FILE: sections/${sec.type}.liquid ===\n${sectionFile.content}`);
            editFilePaths.push(`sections/${sec.type}.liquid`);
          }
        }
        if (sectionSources.length > 0) {
          editableSource = sectionSources.join('\n\n');
        }
      } catch { /* use original source */ }
    }

    const referencedSnippets = extractReferencedSnippets(editableSource, theme.files);

    try {
      const res = await fetch('/api/template-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: chatInput,
          currentLiquid: editableSource,
          filePath: editFilePaths.join(', '),
          variables: creativeContext ? buildTemplateVariables({}, creativeContext) : {},
          creativeContext: creativeContext ? {
            product: creativeContext.product,
            brand: creativeContext.brand,
            funnel: creativeContext.funnel,
            headlines: creativeContext.headlines?.slice(0, 5),
            top_hooks: creativeContext.top_hooks?.slice(0, 5),
          } : null,
          themeContext: {
            referencedSnippets: referencedSnippets.slice(0, 3000),
            settingsSchema: theme.settingsSchema
              ? JSON.stringify(theme.settingsSchema).slice(0, 2000)
              : null,
          },
          editHistory: theme.editHistory.slice(-5),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'AI edit failed' }));
        alert(err.message || 'AI edit failed');
        setChatLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setChatLoading(false); return; }

      let fullResponse = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullResponse += parsed.content;
            } catch {
              fullResponse += data;
            }
          }
        }
      }

      // For JSON templates, AI edits the section files — update them individually
      if (activePage?.isJson && editFilePaths.length > 1) {
        // Extract multiple file blocks from AI response
        const fileBlocks = fullResponse.split(/=== FILE: ([^\s]+) ===/g);
        let updatedFiles = [...theme.files];
        const edits: ThemeEdit[] = [];

        for (let i = 1; i < fileBlocks.length; i += 2) {
          const filePath = fileBlocks[i];
          let content = fileBlocks[i + 1] || '';
          // Strip code fences
          const fenceMatch = content.match(/```(?:liquid|html)?\s*\n([\s\S]*?)```/);
          content = fenceMatch ? fenceMatch[1].trim() : content.trim();

          if (content.length > 20) {
            const existing = updatedFiles.find(f => f.path === filePath);
            if (existing) {
              edits.push({
                id: `edit-${Date.now()}-${filePath}`,
                filePath,
                instruction: chatInput,
                before: existing.content,
                after: content,
                timestamp: new Date().toISOString(),
              });
              updatedFiles = updatedFiles.map(f =>
                f.path === filePath ? { ...f, content } : f
              );
            }
          }
        }

        // Fallback: if no file blocks detected, treat entire response as first section edit
        if (edits.length === 0 && editFilePaths.length > 1) {
          const liquidMatch = fullResponse.match(/```(?:liquid|html)?\s*\n([\s\S]*?)```/);
          const newContent = liquidMatch ? liquidMatch[1].trim() : fullResponse.trim();
          const firstSection = editFilePaths[0];
          if (newContent.length > 50) {
            const existing = updatedFiles.find(f => f.path === firstSection);
            if (existing) {
              edits.push({
                id: `edit-${Date.now()}`,
                filePath: firstSection,
                instruction: chatInput,
                before: existing.content,
                after: newContent,
                timestamp: new Date().toISOString(),
              });
              updatedFiles = updatedFiles.map(f =>
                f.path === firstSection ? { ...f, content: newContent } : f
              );
            }
          }
        }

        if (edits.length > 0) {
          onThemeChange({
            ...theme,
            files: updatedFiles,
            editHistory: [...theme.editHistory.slice(-19), ...edits],
            updatedAt: new Date().toISOString(),
          });
          // Re-trigger preview by updating editSource
          setEditSource(prev => prev + ' ');
          setTimeout(() => {
            const f = updatedFiles.find(ff => ff.path === activePageId);
            if (f) setEditSource(f.content);
          }, 50);
        }
      } else {
        // Non-JSON: direct file edit
        const liquidMatch = fullResponse.match(/```(?:liquid|html)?\s*\n([\s\S]*?)```/);
        const newSource = liquidMatch ? liquidMatch[1].trim() : fullResponse.trim();

        if (newSource.length > 50) {
          const edit: ThemeEdit = {
            id: `edit-${Date.now()}`,
            filePath: activePageId!,
            instruction: chatInput,
            before: editSource,
            after: newSource,
            timestamp: new Date().toISOString(),
          };

          setEditSource(newSource);
          const updatedFiles = theme.files.map(f =>
            f.path === activePageId ? { ...f, content: newSource } : f
          );
          onThemeChange({
            ...theme,
            files: updatedFiles,
            editHistory: [...theme.editHistory.slice(-19), edit],
            updatedAt: new Date().toISOString(),
          });
        }
      }

      setChatInput('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI edit failed');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, activeFile, activePageId, activePage, editSource, theme, creativeContext, chatLoading, onThemeChange]);

  // Undo last edit for current page's sections
  const handleUndo = useCallback(() => {
    // Find last edit related to this page (could be a section file)
    const relevantPaths = new Set<string>([activePageId!]);
    if (activePage?.isJson) {
      try {
        const json = JSON.parse(activeFile?.content || '{}');
        const sections: Record<string, { type?: string }> = json.sections || {};
        for (const sec of Object.values(sections)) {
          if (sec?.type) relevantPaths.add(`sections/${sec.type}.liquid`);
        }
      } catch { /* skip */ }
    }

    const lastEdit = theme.editHistory
      .filter(e => relevantPaths.has(e.filePath))
      .pop();
    if (!lastEdit) return;

    const updatedFiles = theme.files.map(f =>
      f.path === lastEdit.filePath ? { ...f, content: lastEdit.before } : f
    );
    onThemeChange({
      ...theme,
      files: updatedFiles,
      editHistory: theme.editHistory.filter(e => e.id !== lastEdit.id),
      updatedAt: new Date().toISOString(),
    });
    // Refresh preview
    if (lastEdit.filePath === activePageId) {
      setEditSource(lastEdit.before);
    } else {
      // Section file changed — force re-render
      setEditSource(prev => prev + ' ');
      setTimeout(() => {
        if (activeFile) setEditSource(activeFile.content);
      }, 50);
    }
  }, [activePageId, activePage, activeFile, theme, onThemeChange]);

  // Export
  const handleExport = useCallback((type: 'html' | 'liquid') => {
    const content = type === 'html' ? previewHtml : editSource;
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePage?.name || 'page'}.${type === 'html' ? 'html' : 'liquid'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [previewHtml, editSource, activePage]);

  // Count edits for this page
  const pageEditPaths = useMemo(() => {
    const paths = new Set<string>([activePageId || '']);
    if (activePage?.isJson) {
      try {
        const json = JSON.parse(activeFile?.content || '{}');
        const sections: Record<string, { type?: string }> = json.sections || {};
        for (const sec of Object.values(sections)) {
          if (sec?.type) paths.add(`sections/${sec.type}.liquid`);
        }
      } catch { /* skip */ }
    }
    return paths;
  }, [activePageId, activePage, activeFile]);

  const editCount = theme.editHistory.filter(e => pageEditPaths.has(e.filePath)).length;

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 bg-bg-primary rounded-lg overflow-hidden border border-border">
      {/* LEFT: Page list */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-bold text-text-primary">{theme.name}</h3>
          <p className="text-[11px] text-text-muted mt-0.5">{pages.length} pages</p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => handlePageSelect(page.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                page.id === activePageId
                  ? 'bg-accent-teal/15 border-r-2 border-accent-teal'
                  : 'hover:bg-bg-primary'
              }`}
            >
              <span className="text-base flex-shrink-0">{page.icon}</span>
              <span className={`text-sm truncate ${
                page.id === activePageId
                  ? 'text-accent-teal font-semibold'
                  : 'text-text-primary'
              }`}>
                {page.label}
              </span>
            </button>
          ))}
        </div>

        {/* Bottom: show code toggle + actions */}
        <div className="border-t border-border p-2 space-y-1">
          <button
            onClick={() => setShowCode(!showCode)}
            className={`w-full px-3 py-1.5 text-xs rounded transition-colors ${
              showCode
                ? 'bg-accent-teal/15 text-accent-teal font-semibold'
                : 'bg-bg-primary text-text-muted hover:text-text-primary'
            }`}
          >
            {showCode ? 'Hide Code' : 'Show Code'}
          </button>
          <div className="flex gap-1">
            <button onClick={() => handleExport('html')} className="flex-1 px-2 py-1 text-[10px] bg-bg-primary text-text-muted border border-border rounded hover:bg-accent-teal/10">
              Export HTML
            </button>
            <button onClick={() => handleExport('liquid')} className="flex-1 px-2 py-1 text-[10px] bg-bg-primary text-text-muted border border-border rounded hover:bg-accent-teal/10">
              Export Liquid
            </button>
          </div>
        </div>
      </div>

      {/* MAIN: Preview + optional code */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-card">
          <div className="flex items-center gap-3">
            <span className="text-lg">{activePage?.icon}</span>
            <span className="text-sm font-semibold text-text-primary">{activePage?.label || 'Select a page'}</span>
            {editCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-accent-teal/20 text-accent-teal rounded-full font-semibold">
                {editCount} edit{editCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editCount > 0 && (
              <>
                <button onClick={handleUndo} className="px-2.5 py-1 text-xs bg-bg-primary border border-border rounded hover:bg-error/10 hover:text-error transition-colors">
                  Undo
                </button>
                <button onClick={() => setShowHistory(!showHistory)} className="px-2.5 py-1 text-xs bg-bg-primary border border-border rounded hover:bg-accent-teal/10 transition-colors">
                  History
                </button>
              </>
            )}
            <div className="flex bg-bg-primary rounded border border-border overflow-hidden ml-2">
              {(['desktop', 'tablet', 'mobile'] as PreviewDevice[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`px-2.5 py-1 text-[11px] transition-colors ${
                    device === d
                      ? 'bg-accent-teal text-white'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {d === 'desktop' ? '🖥' : d === 'tablet' ? '📱' : '📲'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {/* Code panel (toggleable) */}
          {showCode && (
            <div className="w-[45%] flex-shrink-0 flex flex-col border-r border-border">
              <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-bg-card">
                <span className="text-[11px] font-mono text-text-muted">{activePageId}</span>
                <button onClick={saveCurrentFile} className="px-2 py-0.5 text-[10px] bg-accent-teal text-white rounded">
                  Save
                </button>
              </div>

              {/* History overlay */}
              <div className="flex-1 overflow-hidden relative">
                {showHistory && (
                  <div className="absolute inset-0 z-10 bg-bg-card overflow-y-auto p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-text-primary">Edit History</h4>
                      <button onClick={() => setShowHistory(false)} className="text-xs text-text-muted hover:text-text-primary">Close</button>
                    </div>
                    {theme.editHistory.filter(e => pageEditPaths.has(e.filePath)).reverse().map(edit => (
                      <div key={edit.id} className="mb-2 p-2 bg-bg-primary border border-border rounded text-xs">
                        <div className="font-semibold text-accent-teal">&quot;{edit.instruction}&quot;</div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {edit.filePath.split('/').pop()} &middot; {new Date(edit.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {theme.editHistory.filter(e => pageEditPaths.has(e.filePath)).length === 0 && (
                      <p className="text-xs text-text-muted">No edits yet</p>
                    )}
                  </div>
                )}
                <textarea
                  value={editSource}
                  onChange={e => setEditSource(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full p-3 bg-bg-primary text-text-primary text-xs font-mono resize-none focus:outline-none leading-5"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="flex-1 bg-white flex items-start justify-center overflow-auto p-2">
            {previewHtml ? (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                className="border border-gray-200 bg-white transition-all duration-200"
                style={{
                  width: DEVICE_WIDTHS[device],
                  maxWidth: '100%',
                  height: '100%',
                  minHeight: '500px',
                }}
                title="Theme Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full text-text-muted text-sm">
                {chatLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-accent-teal/30 border-t-accent-teal rounded-full animate-spin" />
                    <span>Rendering preview...</span>
                  </div>
                ) : (
                  'Select a page to preview'
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Chat bar — always visible */}
        <div className="border-t border-border p-3 bg-bg-card">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiEdit()}
              placeholder={
                chatLoading
                  ? 'AI is editing...'
                  : activePage
                    ? `Edit "${activePage.label}" page... (ex: "change the headline to...", "add a testimonials section")`
                    : 'Select a page first'
              }
              disabled={chatLoading || !activePage}
              className="flex-1 px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 disabled:opacity-50 focus:border-accent-teal focus:outline-none transition-colors"
            />
            <button
              onClick={handleAiEdit}
              disabled={chatLoading || !chatInput.trim() || !activePage}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                chatLoading
                  ? 'bg-accent-orange/20 text-accent-orange cursor-wait'
                  : 'bg-accent-teal text-white hover:bg-accent-teal-hover disabled:opacity-50'
              }`}
            >
              {chatLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Editing...
                </span>
              ) : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function extractReferencedSnippets(source: string, files: ThemeFile[]): string {
  const refs = new Set<string>();
  const matches = source.matchAll(/\{%\s*(?:render|include)\s+['"]([^'"]+)['"]/g);
  for (const m of matches) {
    refs.add(m[1]);
  }
  const snippetContents: string[] = [];
  for (const name of refs) {
    const snippetPath = `snippets/${name}.liquid`;
    const file = files.find(f => f.path === snippetPath);
    if (file) {
      snippetContents.push(`--- ${snippetPath} ---\n${file.content.slice(0, 1500)}`);
    }
  }
  return snippetContents.join('\n\n');
}
