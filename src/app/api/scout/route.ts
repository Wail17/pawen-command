// ============================================================
// PAWEN — /api/scout
//
// Phase U.3c — Scout agent server-side brain. Two modes:
//
//   POST { mode: 'plan', intent, agentId, projectContext }
//     → { ok, plan: { tools, queries, rationale, estimatedCostUsd }, tokens }
//
// The `plan` mode asks Sonnet to pick up to 3 tools from the toolbox
// and generate 2-5 queries per tool. Client then executes the plan.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';

export const maxDuration = 60;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const PLAN_MODEL = 'claude-sonnet-4-6';

const ALLOWED_TOOLS = [
  'tavily', 'firecrawl', 'reddit', 'youtube', 'tiktok',
  'amazon-reviews', 'meta-ads', 'shopify', 'brandsearch',
] as const;
type Tool = typeof ALLOWED_TOOLS[number];

const PLAN_SYSTEM_PROMPT = `You are Scout, Pawen's Signal Intelligence agent.

You receive a natural-language INTENT from another agent (e.g. "more voice-of-customer on fear of ageing for Italian menopause niche") and must decide how to scrape the web to satisfy it.

TOOLBOX (pick 1-3):
- tavily: general web search, news, articles. Best for: broad discovery, press, authority sites.
- firecrawl: scrape a specific URL → markdown. Best for: when you KNOW the URL.
- reddit: search Reddit threads. Best for: voice-of-customer, "has anyone else", emotional admissions.
- youtube: search YouTube video metadata + comments. Best for: product reviews, tutorials, reaction.
- tiktok: search TikTok via Apify. Best for: gen-z/millennial reactions, short-form VOC, trends.
- amazon-reviews: pull product reviews. Best for: buyer objections, feature critiques, real usage.
- meta-ads: search Meta Ad Library via Tavily. Best for: competitor creative intelligence.
- shopify: detect Shopify store + fetch product JSON. Best for: competitor product pages, price, reviews.
- brandsearch: brand/competitor discovery. Best for: finding competitors of a known brand.

OUTPUT CONTRACT — reply with VALID JSON ONLY, no preamble, no fences:
{
  "tools": ["tavily", "reddit"],
  "queries": {
    "tavily": ["query 1", "query 2"],
    "reddit": ["query 1", "query 2", "query 3"]
  },
  "rationale": "one sentence explaining WHY these tools + queries",
  "estimatedCostUsd": 0.12
}

RULES:
- Pick tools based on the intent. Don't use tiktok for "competitor ads" (use meta-ads). Don't use amazon-reviews for "new niche discovery" (use tavily/reddit).
- Queries must be specific, not generic. "menopause" is weak. "italian menopause women supplement reviews 2024" is strong.
- Keep queries per tool to 2-5 max.
- estimatedCostUsd: conservative guess. Reddit/youtube/shopify are free. Tavily ~$0.008/call. Firecrawl ~$0.02/call. TikTok ~$0.05/call. Amazon-reviews ~$0.02/call. Meta-ads ~$0.008/call.
- Hard cap: total estimatedCostUsd ≤ $2.00. If the intent would require more, cut tools/queries.`;

type PlanRequest = {
  mode: 'plan';
  intent: string;
  agentId?: string;
  projectContext?: {
    niche?: string;
    product?: string;
    language?: string;
    market?: string;
  };
};

type ScoutBody = PlanRequest | { mode: string };

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: ScoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  if (body.mode !== 'plan') {
    return NextResponse.json({ ok: false, message: `Unknown mode: ${String((body as { mode?: unknown }).mode ?? '')}` }, { status: 400 });
  }

  const planBody = body as PlanRequest;
  const { intent, agentId, projectContext } = planBody;
  if (typeof intent !== 'string' || intent.length < 10) {
    return NextResponse.json({ ok: false, message: 'intent required (≥10 chars)' }, { status: 400 });
  }

  const ctxLines: string[] = [];
  if (projectContext?.niche) ctxLines.push(`NICHE: ${projectContext.niche}`);
  if (projectContext?.product) ctxLines.push(`PRODUCT: ${projectContext.product}`);
  if (projectContext?.language) ctxLines.push(`LANGUAGE: ${projectContext.language}`);
  if (projectContext?.market) ctxLines.push(`MARKET: ${projectContext.market}`);
  const ctxBlock = ctxLines.length > 0 ? `\n\nPROJECT CONTEXT:\n${ctxLines.join('\n')}` : '';

  const userMessage = `INTENT: ${intent}${ctxBlock}\n\nREQUESTING AGENT: ${agentId ?? 'unknown'}\n\nReply with the JSON plan.`;

  const anthropicBody = {
    model: PLAN_MODEL,
    max_tokens: 1024,
    temperature: 0.4,
    system: [
      { type: 'text', text: PLAN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const started = Date.now();
  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { ok: false, message: `Anthropic error: ${upstream.status}`, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  type AnthropicMessage = {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
  const result = (await upstream.json()) as AnthropicMessage;

  const raw = (result.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  const parsed = extractJSON(raw) as {
    tools?: unknown;
    queries?: unknown;
    rationale?: unknown;
    estimatedCostUsd?: unknown;
  } | null;

  if (!parsed) {
    return NextResponse.json({ ok: false, message: 'Plan did not parse as JSON', raw: raw.slice(0, 500) }, { status: 502 });
  }

  // Validate shape
  const tools = Array.isArray(parsed.tools)
    ? parsed.tools.filter(t => typeof t === 'string' && (ALLOWED_TOOLS as readonly string[]).includes(t)) as Tool[]
    : [];

  const queries: Record<string, string[]> = {};
  if (parsed.queries && typeof parsed.queries === 'object') {
    for (const [k, v] of Object.entries(parsed.queries as Record<string, unknown>)) {
      if (!(ALLOWED_TOOLS as readonly string[]).includes(k)) continue;
      if (Array.isArray(v)) {
        queries[k] = v.filter(x => typeof x === 'string' && x.length > 0) as string[];
      }
    }
  }

  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : '';
  const estimatedCostUsd = typeof parsed.estimatedCostUsd === 'number' ? parsed.estimatedCostUsd : 0;

  if (tools.length === 0) {
    return NextResponse.json(
      { ok: false, message: 'Plan contains no valid tools', raw: raw.slice(0, 300) },
      { status: 502 },
    );
  }

  const usage = result.usage ?? {};
  const tokens =
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);

  await writeAudit(req, session.user, 'phase_u.scout.run', {
    intent: intent.slice(0, 120),
    agentId,
    tools,
    queryCount: Object.values(queries).reduce((s, a) => s + a.length, 0),
    estimatedCostUsd,
    tokens,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({
    ok: true,
    plan: { tools, queries, rationale, estimatedCostUsd },
    tokens,
  });
}
