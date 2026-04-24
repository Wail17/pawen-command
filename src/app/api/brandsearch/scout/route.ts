// ============================================================
// PAWEN — AI Product Scout
// Searches BrandSearch + evaluates products using EVOLVE & ZAK
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const BS_BASE = 'https://api.brandsearch.co';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBrand(b: any) {
  if (!b) return b;
  return {
    id: b._id ?? b.id ?? b.name,
    name: b.title ?? b.name ?? b._id,
    url: b._id ?? b.name ?? b.url,
    description: b.description,
    country: b.country_code ?? b.country,
    platform: b.platform,
    monthly_visits: b.monthly_visits,
    meta_active_count: b.last_meta_active_count ?? b.meta_active_count,
    meta_total_count: b.last_meta_total_count ?? b.meta_total_count,
    meta_ads_active: (b.last_meta_active_count ?? 0) > 0,
    total_products: b.product_count ?? b.total_products,
    estimated_sales: b.estimated_sales,
    niche: b.niche ?? b.sub_niche,
    emails: b.emails,
    created_at: b.created_at,
  };
}

async function bsFetch(path: string, apiKey: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, BS_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`BrandSearch ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const bsKey = process.env.BRANDSEARCH_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!bsKey) return NextResponse.json({ message: 'BRANDSEARCH_API_KEY not configured' }, { status: 500 });
  if (!claudeKey) return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let body: { niche: string; query?: string; targetLanguage?: string; targetMarket?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.niche?.trim()) {
    return NextResponse.json({ message: 'niche is required' }, { status: 400 });
  }

  try {
    // STEP 1: Search BrandSearch across all 3 research families
    const searches = [
      // Fresh scalers — low traffic, active ads
      bsFetch('/v1/brands', bsKey, {
        q: body.query || body.niche,
        meta_ads_active: true,
        monthly_visits_min: 1000,
        monthly_visits_max: 50000,
        meta_total_min: 5,
        sort: 'last_meta_active_count',
        page_size: 8,
      }),
      // Momentum — mid traffic, consistent presence
      bsFetch('/v1/brands', bsKey, {
        q: body.query || body.niche,
        meta_ads_active: true,
        monthly_visits_min: 50000,
        monthly_visits_max: 500000,
        meta_total_min: 20,
        sort: 'estimated_sales',
        page_size: 8,
      }),
      // Established — high traffic, deep library
      bsFetch('/v1/brands', bsKey, {
        q: body.query || body.niche,
        meta_ads_active: true,
        monthly_visits_min: 500000,
        meta_total_min: 50,
        sort: 'monthly_visits',
        page_size: 8,
      }),
    ];

    const [freshRaw, momentumRaw, establishedRaw] = await Promise.allSettled(searches);

    const extract = (r: PromiseSettledResult<{ data?: unknown[] }>) =>
      r.status === 'fulfilled' ? (r.value.data ?? []).map(normalizeBrand) : [];

    const freshBrands = extract(freshRaw as PromiseSettledResult<{ data?: unknown[] }>);
    const momentumBrands = extract(momentumRaw as PromiseSettledResult<{ data?: unknown[] }>);
    const establishedBrands = extract(establishedRaw as PromiseSettledResult<{ data?: unknown[] }>);

    // Deduplicate by id
    const seen = new Set<string>();
    const allBrands: { brand: Record<string, unknown>; tier: string }[] = [];
    for (const [brands, tier] of [
      [freshBrands, 'fresh_scaler'],
      [momentumBrands, 'momentum'],
      [establishedBrands, 'established'],
    ] as [Record<string, unknown>[], string][]) {
      for (const b of brands) {
        const bid = (b.id ?? b.name) as string;
        if (!seen.has(bid)) {
          seen.add(bid);
          allBrands.push({ brand: b, tier });
        }
      }
    }

    if (allBrands.length === 0) {
      return NextResponse.json({ results: [], message: 'No brands found for this niche.' });
    }

    // STEP 2: Claude evaluates each brand using EVOLVE + ZAK
    const brandsJson = JSON.stringify(allBrands.slice(0, 20), null, 2);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: SCOUT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `NICHE: ${body.niche}
TARGET MARKET: ${body.targetMarket || 'Global'}
TARGET LANGUAGE: ${body.targetLanguage || 'en-US'}
${body.query ? `ADDITIONAL KEYWORDS: ${body.query}` : ''}

BRANDS FROM BRANDSEARCH (with tier classification):
${brandsJson}

Evaluate each brand. Return ONLY a JSON array (no markdown, no explanation).`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text().catch(() => 'Unknown');
      return NextResponse.json({ message: `Claude API error: ${errText}` }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const textBlock = claudeData.content?.find((c: { type: string }) => c.type === 'text');
    const rawText = textBlock?.text ?? '[]';

    // Parse JSON from Claude's response (may be wrapped in ```json ... ```)
    let evaluated: { brand_id: string; score: number; verdict: string; strengths: string[]; risks: string[]; angles: string[] }[];
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      evaluated = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON array
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        evaluated = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ message: 'Failed to parse scout evaluation', raw: rawText }, { status: 500 });
      }
    }

    // Merge brand data with evaluations
    const brandMap = new Map(allBrands.map(b => [(b.brand.id ?? b.brand.name) as string, b.brand]));
    const results = evaluated
      .map(e => ({
        brand: brandMap.get(e.brand_id) ?? { id: e.brand_id, name: e.brand_id, url: e.brand_id },
        verdict: e.verdict,
        score: e.score,
        strengths: e.strengths ?? [],
        risks: e.risks ?? [],
        angles: e.angles ?? [],
      }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Scout error: ${msg}` }, { status: 500 });
  }
}

const SCOUT_SYSTEM_PROMPT = `You are PAWEN AI Product Scout — an expert at evaluating e-commerce brands for Meta Ads scalability.

You use TWO proprietary frameworks:

=== EVOLVE FRAMEWORK (Product-Market Fit for Ads) ===
Score each brand on:
1. MASS INSTINCT ALIGNMENT — Does the product tap into the 6 mass instincts? (Health > Status > Sex > Comfort > Control > Belonging). Higher = more scalable.
2. DESIRE POWER — Scope (how many people want this) × Urgency (how desperately) × Staying Power (does the desire renew?). Max 1000.
3. ELEVATION POTENTIAL — Can messaging be moved UP the instinct hierarchy? A dog harness can go from "comfort" to "health/survival" = massive scale unlock.
4. 6 TECHNOLOGICAL PROBLEMS — Does the product solve Complexity, Overwhelm, Fragility, Maintenance, Incompatibility, or Obsolescence?
5. IDENTIFICATION MARKETING — Can buyers see themselves in the brand? (Where they want to BE, LOOK like, FEEL, PORTRAY?)

=== ZAK FRAMEWORK (Ad Creative Scalability) ===
Score each brand on:
1. PAIN vs DESIRE RATIO — High pain ratio (70%+ pain) = easier to write converting copy. Products that solve urgent pain > nice-to-have desires.
2. HOOK DIVERSITY — Can you write 7 ZAK hook types? (Question, Statement, Story, Statistic, Contradiction, Curiosity, Identity). More = longer creative lifespan.
3. EMOTIONAL INTENSITY — Does the audience have PRIMAL-level emotions? (fight-or-flight, desperation, constant thinking about the problem?)
4. BUYER vs USER DYNAMIC — Same person = simpler funnel. Different = need dual messaging. Gifting niches are gold (high emotional intent, low price sensitivity).
5. DAMAGING ADMISSION POTENTIAL — Can the brand make an honest confession that builds trust? ("We're not the cheapest..." "It won't work overnight...")

=== EVALUATION CRITERIA (SOP) ===
For each brand, determine:
- Is this a WINNING product for Meta Ads? Score 0-100.
- 80-100: Strong recommend — clear mass desire, provable mechanism, multiple ad angles, active scaling signals
- 60-79: Conditional — needs angle optimization or better positioning, but fundamentals are solid
- 40-59: Risky — narrow audience, weak desire, commodity positioning, or saturated angles
- 0-39: Avoid — no clear instinct alignment, impossible to differentiate, or dead market signals

SIGNALS TO WEIGHT:
- Active Meta ads = POSITIVE (someone is paying to advertise this, meaning it converts)
- High meta_active_count = brand is scaling aggressively
- Fresh scaler tier with active ads = POTENTIAL GOLDMINE (early mover advantage)
- Established tier with high ad count = PROVEN but competitive
- Shopify platform = easy to clone/compete with similar products
- High monthly_visits + low ad count = organic brand, may not respond to paid ads
- Product count matters: single hero product > scattered catalog for Meta Ads

For each brand, provide:
- brand_id: the brand's id field
- score: 0-100 overall Meta Ads scalability score
- verdict: 2-3 sentence evaluation explaining why this would/wouldn't work for Meta Ads
- strengths: 2-4 bullet points of competitive advantages
- risks: 1-3 bullet points of potential issues
- angles: 3-5 specific ad angles using ZAK hook formulas that would work for this product

Return ONLY a JSON array of objects. No markdown wrapping, no explanation outside the array.`;
