// ============================================================
// PAWEN — Template Editor Types
// ============================================================

export type TemplateCategory =
  | 'advertorial'
  | 'landing_page'
  | 'product_page'
  | 'email'
  | 'squeeze_page'
  | 'custom';

export interface Template {
  id: string;
  projectId: string;
  name: string;
  category: TemplateCategory;
  liquidSource: string;           // raw Shopify Liquid code
  compiledHtml: string;           // last rendered HTML
  variables: Record<string, string>; // current variable values
  variableMap: Record<string, string>; // liquid var name → gate content path
  editHistory: TemplateEdit[];    // last 20, FIFO
  createdAt: string;
  updatedAt: string;
}

export interface TemplateEdit {
  id: string;
  instruction: string;            // user's natural language request
  before: string;                 // liquid source before edit
  after: string;                  // liquid source after edit
  timestamp: string;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; icon: string; description: string }> = {
  advertorial:  { label: 'Advertorial',   icon: 'A',  description: 'Native-style ad content pages' },
  landing_page: { label: 'Landing Page',  icon: 'LP', description: 'Conversion-focused landing pages' },
  product_page: { label: 'Product Page',  icon: 'PP', description: 'E-commerce product detail pages' },
  email:        { label: 'Email',         icon: 'E',  description: 'Email sequences and broadcasts' },
  squeeze_page: { label: 'Squeeze Page',  icon: 'SP', description: 'Lead capture pages' },
  custom:       { label: 'Custom',        icon: 'C',  description: 'Any other template type' },
};
