// ============================================================
// AutoEcom Lab — Curated prefix fetcher
// GET /api/curated-prefix?agent=marcus
// Returns { prefix: string, count: number } — used by client-side
// pipelines to inject the team's curated KB as a cached system
// prefix before running agent calls.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { fetchCuratedForAgent, renderCuratedAsPrefix } from '@/lib/db/curatedKnowledge';
import { AGENT_IDS, type AgentId } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const agentRaw = req.nextUrl.searchParams.get('agent');
    if (!agentRaw || !AGENT_IDS.includes(agentRaw as AgentId)) {
      return NextResponse.json({ ok: false, message: 'Invalid or missing agent' }, { status: 400 });
    }
    const agent = agentRaw as AgentId;
    const entries = await fetchCuratedForAgent(agent);
    const prefix = renderCuratedAsPrefix(agent, entries);
    return NextResponse.json({ ok: true, agent, count: entries.length, prefix });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[curated-prefix] error:', err);
    // Graceful fallback — never block the pipeline on curated KB failure
    return NextResponse.json({ ok: true, count: 0, prefix: '', warning: message });
  }
}
