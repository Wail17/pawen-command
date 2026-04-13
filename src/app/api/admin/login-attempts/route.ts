// ============================================================
// PAWEN — /api/admin/login-attempts
// Shows all login attempts grouped by IP.
// Admin only.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const hours = parseInt(url.searchParams.get('hours') ?? '168', 10); // default 7 days

  try {
    const sql = getSql();

    // All login attempts (success + failure) with IP, grouped and detailed
    const attempts = await sql`
      SELECT ip, success, created_at
      FROM login_attempts
      WHERE created_at > NOW() - ${hours + ' hours'}::interval
      ORDER BY created_at DESC
      LIMIT 500
    `;

    // Audit log entries for login events (has username + details)
    const loginAudit = await sql`
      SELECT user_name, action, ip, user_agent, details, created_at
      FROM audit_log
      WHERE action IN ('login.success', 'login.failure', 'admin.login.success', 'admin.login.failure')
        AND created_at > NOW() - ${hours + ' hours'}::interval
      ORDER BY created_at DESC
      LIMIT 500
    `;

    // Aggregate by IP
    const ipMap = new Map<string, {
      ip: string;
      totalAttempts: number;
      successes: number;
      failures: number;
      lastAttempt: string;
      usernames: string[];
      userAgents: string[];
      events: { action: string; username: string; time: string; details: Record<string, unknown> }[];
    }>();

    for (const row of attempts as { ip: string; success: boolean; created_at: string }[]) {
      if (!ipMap.has(row.ip)) {
        ipMap.set(row.ip, {
          ip: row.ip,
          totalAttempts: 0,
          successes: 0,
          failures: 0,
          lastAttempt: row.created_at,
          usernames: [],
          userAgents: [],
          events: [],
        });
      }
      const entry = ipMap.get(row.ip)!;
      entry.totalAttempts++;
      if (row.success) entry.successes++;
      else entry.failures++;
      if (row.created_at > entry.lastAttempt) entry.lastAttempt = row.created_at;
    }

    for (const row of loginAudit as { user_name: string; action: string; ip: string; user_agent: string; details: Record<string, unknown>; created_at: string }[]) {
      if (!row.ip) continue;
      if (!ipMap.has(row.ip)) {
        ipMap.set(row.ip, {
          ip: row.ip,
          totalAttempts: 0,
          successes: 0,
          failures: 0,
          lastAttempt: row.created_at,
          usernames: [],
          userAgents: [],
          events: [],
        });
      }
      const entry = ipMap.get(row.ip)!;
      if (!entry.usernames.includes(row.user_name)) entry.usernames.push(row.user_name);
      if (row.user_agent && !entry.userAgents.includes(row.user_agent)) {
        entry.userAgents.push(row.user_agent.slice(0, 100));
      }
      entry.events.push({
        action: row.action,
        username: row.user_name,
        time: row.created_at,
        details: row.details || {},
      });
    }

    // Sort by most recent first
    const ipList = [...ipMap.values()].sort(
      (a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime(),
    );

    // Summary stats
    const totalUniqueIPs = ipList.length;
    const totalAttempts = ipList.reduce((s, e) => s + e.totalAttempts, 0);
    const totalFailures = ipList.reduce((s, e) => s + e.failures, 0);
    const suspiciousIPs = ipList.filter(e => e.failures >= 3);

    return NextResponse.json({
      ok: true,
      summary: {
        uniqueIPs: totalUniqueIPs,
        totalAttempts,
        totalFailures,
        suspiciousIPs: suspiciousIPs.length,
        periodHours: hours,
      },
      ips: ipList,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:login-attempts] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
