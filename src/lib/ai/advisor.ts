// ============================================================
// PAWEN — Advisor Strategy Helper
// Pairs Sonnet/Haiku executors with Opus as a server-side advisor.
// The executor decides when to consult Opus for guidance — Anthropic
// handles the handoff internally within a single /v1/messages request.
//
// Blog:  https://www.anthropic.com/news/advisor-tool
// Beta:  anthropic-beta: advisor-tool-2026-03-01
//
// Usage pattern (any route that calls the Anthropic REST API):
//
//   import {
//     ADVISOR_TOOL,
//     shouldUseAdvisor,
//     withAdvisorHint,
//     composeBetaHeader,
//   } from '@/lib/ai/advisor';
//
//   const model = 'claude-sonnet-4-6';
//   const advisor = shouldUseAdvisor(model);
//
//   const requestBody = {
//     model,
//     max_tokens,
//     temperature,
//     system: [{ type: 'text', text: withAdvisorHint(systemPrompt, model),
//                cache_control: { type: 'ephemeral' } }],
//     messages,
//     ...(advisor ? { tools: [ADVISOR_TOOL] } : {}),
//   };
//
//   const headers = {
//     'Content-Type': 'application/json',
//     'x-api-key': apiKey,
//     'anthropic-version': '2023-06-01',
//     'anthropic-beta': composeBetaHeader({ caching: true, advisor }),
//   };
// ============================================================

// Anthropic beta flags we use across routes.
export const ANTHROPIC_BETA_CACHING = 'prompt-caching-2024-07-31';
export const ANTHROPIC_BETA_ADVISOR = 'advisor-tool-2026-03-01';

// The server-side advisor tool. Declared once in the tools array; the
// executor consults Opus when it hits a decision it can't reasonably
// solve on its own (ambiguity, tricky trade-off, missing frame).
export const ADVISOR_TOOL = {
  type: 'advisor_20260301' as const,
  name: 'advisor' as const,
  model: 'claude-opus-4-6' as const,
  max_uses: 3,
} as const;

export type AdvisorToolDescriptor = typeof ADVISOR_TOOL;

// Executor models that benefit from an Opus advisor. We intentionally
// exclude Opus itself — advising Opus with Opus would be recursive and
// defeat the cost/intelligence trade-off the advisor strategy is built on.
const EXECUTOR_MODELS: ReadonlySet<string> = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]);

export function shouldUseAdvisor(model: string): boolean {
  return EXECUTOR_MODELS.has(model);
}

// Short hint describing the escalation policy. Append to system prompts
// so the executor knows the tool exists and when to call it. Kept stable
// across calls so it doesn't bust the prompt cache.
export const ADVISOR_SYSTEM_HINT = `

---
Escalation: you have an "advisor" tool that routes a question to Claude Opus for a second opinion. Use it (max ${ADVISOR_TOOL.max_uses} calls per request) ONLY for high-leverage decisions you cannot reasonably solve on your own — genuine ambiguity, tricky trade-offs, or missing frames. Never for routine formatting, simple lookups, or boilerplate. When you consult the advisor, phrase the question concretely and give it the minimum context it needs. Integrate the plan it returns, then continue.`;

export function withAdvisorHint(systemPrompt: string, model: string): string {
  return shouldUseAdvisor(model) ? systemPrompt + ADVISOR_SYSTEM_HINT : systemPrompt;
}

// Compose the anthropic-beta header value from the set of flags a given
// call needs. Returns null when no beta features are enabled, so the
// caller can omit the header entirely.
export function composeBetaHeader(opts: {
  caching?: boolean;
  advisor?: boolean;
}): string | null {
  const flags: string[] = [];
  if (opts.advisor) flags.push(ANTHROPIC_BETA_ADVISOR);
  if (opts.caching) flags.push(ANTHROPIC_BETA_CACHING);
  return flags.length > 0 ? flags.join(',') : null;
}
