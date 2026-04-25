// ============================================================
// PAWEN — /api/conversations/system-start   (Phase V proactive)
//
// Lets the client (or any server-side hook) trigger a system-initiated
// conversation with a Léa-authored opening, without going through the
// full /start flow. Respects the 6h cooldown per project.
//
// POST { projectId, trigger, topic, opening, participants?, maxChainLength? }
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { isConversationsEnabled } from '@/lib/learning/autonomousMode';
import { startSystemConversation } from '@/lib/conversations/systemStart';

export const maxDuration = 180;

const ALLOWED_TRIGGERS = new Set([
  'GATE_APPROVED',         // user approved a gate output
  'GOLD_PICK',             // user ★ picked a high-value item
  'SCOUT_RESULTS_LANDED',  // scout brought fresh intel
  'STANDUP',               // manual user-initiated standup
  'IDLE_CHECKIN',          // user inactive for a while
  'META_DROP_CRITICAL',    // already used by cron, kept for completeness
  'DISTILLATION_COMPLETE',
]);

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  if (!isConversationsEnabled()) {
    return NextResponse.json({ ok: false, message: 'Conversations not enabled' }, { status: 503 });
  }

  let body: {
    projectId?: string;
    trigger?: string;
    topic?: string;
    opening?: string;
    participants?: string[];
    maxChainLength?: number;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: 'invalid JSON' }, { status: 400 }); }

  if (!body.projectId || !body.trigger || !body.topic || !body.opening) {
    return NextResponse.json({ ok: false, message: 'projectId + trigger + topic + opening required' }, { status: 400 });
  }
  if (!ALLOWED_TRIGGERS.has(body.trigger)) {
    return NextResponse.json({ ok: false, message: `trigger must be one of: ${[...ALLOWED_TRIGGERS].join(', ')}` }, { status: 400 });
  }

  const result = await startSystemConversation({
    projectId: body.projectId,
    trigger: body.trigger,
    topic: body.topic.slice(0, 500),
    openingMessage: body.opening.slice(0, 2000),
    participants: body.participants,
    maxChainLength: body.maxChainLength ?? 3,
  });

  return NextResponse.json({ ok: true, ...result });
}
