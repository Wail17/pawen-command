// ============================================================
// AutoEcom Lab — Mini-tools registry
// Standalone utilities (not gates, not tied to a project pipeline).
// Add a new tool by appending an entry below and creating its page
// at src/app/tools/{id}/page.tsx.
// ============================================================

export type MiniTool = {
  id: string;
  name: string;
  description: string;
  path: string;        // app route
  status: 'live' | 'beta' | 'soon';
  tagline: string;     // short one-liner shown on card
};

export const MINI_TOOLS: MiniTool[] = [
  {
    id: 'trustpilot',
    name: 'Trustpilot Review Analyzer',
    description:
      'Scrape les reviews Trustpilot d\'une marque et fait ressortir les plaintes récurrentes, les points positifs, et une démographie inférée des prénoms.',
    path: '/tools/trustpilot',
    status: 'live',
    tagline: 'Pain points & démographie depuis les reviews publiques',
  },
];
