// ============================================================
// PAWEN — Shopify Theme Editor Types
// ============================================================

export interface ThemeFile {
  path: string;          // e.g. "sections/main-product.liquid"
  content: string;       // raw file content
  type: ThemeFileType;
  size: number;
}

export type ThemeFileType =
  | 'layout'
  | 'template'
  | 'section'
  | 'snippet'
  | 'asset'
  | 'config'
  | 'locale'
  | 'other';

export interface ShopifyTheme {
  id: string;
  projectId: string;
  name: string;
  source: 'upload' | 'api';        // how theme was imported
  storeUrl?: string;                // if from API
  files: ThemeFile[];
  settingsSchema?: unknown;         // parsed config/settings_schema.json
  settingsData?: unknown;           // parsed config/settings_data.json
  activeFile?: string;              // currently open file path
  editHistory: ThemeEdit[];
  createdAt: string;
  updatedAt: string;
}

export interface ThemeEdit {
  id: string;
  filePath: string;
  instruction: string;
  before: string;
  after: string;
  timestamp: string;
}

// Folder structure for the file tree
export interface ThemeFolder {
  name: string;
  type: ThemeFileType;
  files: ThemeFile[];
}

export function categorizeFile(path: string): ThemeFileType {
  if (path.startsWith('layout/')) return 'layout';
  if (path.startsWith('templates/')) return 'template';
  if (path.startsWith('sections/')) return 'section';
  if (path.startsWith('snippets/')) return 'snippet';
  if (path.startsWith('assets/')) return 'asset';
  if (path.startsWith('config/')) return 'config';
  if (path.startsWith('locales/')) return 'locale';
  return 'other';
}

export function buildFolderTree(files: ThemeFile[]): ThemeFolder[] {
  const folders = new Map<ThemeFileType, ThemeFile[]>();
  for (const f of files) {
    const existing = folders.get(f.type) || [];
    existing.push(f);
    folders.set(f.type, existing);
  }

  const order: ThemeFileType[] = ['layout', 'template', 'section', 'snippet', 'config', 'locale', 'asset', 'other'];
  const labels: Record<ThemeFileType, string> = {
    layout: 'Layout',
    template: 'Templates',
    section: 'Sections',
    snippet: 'Snippets',
    config: 'Config',
    locale: 'Locales',
    asset: 'Assets',
    other: 'Other',
  };

  return order
    .filter(type => folders.has(type))
    .map(type => ({
      name: labels[type],
      type,
      files: folders.get(type)!.sort((a, b) => a.path.localeCompare(b.path)),
    }));
}
