// Full-funnel smoke test — exercises every wired layer end-to-end
// against the local dev server. Outputs a pass/fail report.
//
// Run: npx -y dotenv-cli -e .env.local -- node scripts/test-full-funnel.mjs

const PROD = process.env.TEST_BASE_URL || 'http://localhost:3000';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_PW || !ADMIN_PW) {
  console.error('Missing APP_PASSWORD / ADMIN_PASSWORD');
  process.exit(1);
}

const results = [];
let cookie = '';

function step(name, fn) {
  return async () => {
    const t0 = Date.now();
    try {
      const out = await fn();
      const dur = Date.now() - t0;
      const ok = out?.ok !== false;
      results.push({ name, status: ok ? 'PASS' : 'FAIL', durationMs: dur, ...out });
      console.log(`${ok ? '✓' : '✗'} ${name.padEnd(45)} ${String(dur).padStart(5)}ms ${out?.note ?? ''}`);
      return out;
    } catch (e) {
      const dur = Date.now() - t0;
      results.push({ name, status: 'ERROR', durationMs: dur, error: e instanceof Error ? e.message : String(e) });
      console.log(`✗ ${name.padEnd(45)} ${String(dur).padStart(5)}ms ERROR: ${e instanceof Error ? e.message : e}`);
      return { ok: false };
    }
  };
}

console.log(`\n=== FULL FUNNEL — base=${PROD} ===\n`);

// --- 1. Auth ---
await step('1. List app users', async () => {
  const r = await fetch(`${PROD}/api/auth/users`, { headers: { 'x-admin-token': ADMIN_PW } });
  const d = await r.json();
  return { ok: r.ok && Array.isArray(d.users), note: `${d.users?.length} users` };
})();

await step('2. Login as Sykss', async () => {
  const r = await fetch(`${PROD}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
    body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
  });
  cookie = (r.headers.get('set-cookie') ?? '').split(';')[0];
  const d = await r.json();
  return { ok: r.ok && cookie && d.ok, note: cookie ? `cookie len=${cookie.length}` : 'NO COOKIE' };
})();

const auth = { 'x-admin-token': ADMIN_PW, 'Cookie': cookie };

// --- 2. Hive ---
let hiveState;
await step('3. Hive state', async () => {
  const r = await fetch(`${PROD}/api/hive/state`, { headers: auth });
  const d = await r.json();
  hiveState = d;
  return { ok: r.ok && d.ok && Array.isArray(d.brands), note: `${d.brands?.length} brands · enabled=${d.enabled}` };
})();

let hiveProjects;
await step('4. Hive projects (cross-brand list)', async () => {
  const r = await fetch(`${PROD}/api/hive/projects`, { headers: auth });
  const d = await r.json();
  hiveProjects = d;
  return { ok: r.ok && d.ok, note: `${d.projects?.length} projects across all brands` };
})();

const myProject = hiveProjects?.projects?.find(p => p.ownerId === 'Sykss') ?? hiveProjects?.projects?.[0];
console.log(`   → using project: ${myProject?.name?.slice(0,60)} (${myProject?.id?.slice(0,8)})`);

// --- 3. Conversations (Phase V) ---
let conversationId;
await step('5. Start team conversation', async () => {
  if (!myProject) return { ok: false, note: 'no project' };
  const r = await fetch(`${PROD}/api/conversations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      projectId: myProject.id,
      topic: 'E2E test — fear vs aspiration',
      firstMessage: { authorType: 'user', content: '@alex @marcus quick: which hook angle wins for this avatar — fear or aspiration? 1 sentence each.' },
      maxChainLength: 2,
    }),
  });
  const d = await r.json();
  conversationId = d.conversation?.id;
  const turns = d.dispatched?.turns?.length ?? 0;
  const cost = d.dispatched?.turns?.reduce((s, t) => s + (t.costUsd ?? 0), 0) ?? 0;
  return {
    ok: r.ok && d.ok && conversationId,
    note: `${d.messages?.length} msgs · ${turns} turns · $${cost.toFixed(4)}`,
  };
})();

await step('6. Post user message + chain', async () => {
  if (!conversationId) return { ok: false, note: 'no convId' };
  const r = await fetch(`${PROD}/api/conversations/${conversationId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ content: '@nina from a visual angle which is easier?', maxChainLength: 1 }),
  });
  const d = await r.json();
  return { ok: r.ok && d.ok, note: `now ${d.messages?.length} msgs` };
})();

await step('7. Close conversation (Léa summary)', async () => {
  if (!conversationId) return { ok: false, note: 'no convId' };
  const r = await fetch(`${PROD}/api/conversations/${conversationId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ askLeaSummary: true }),
  });
  const d = await r.json();
  return {
    ok: r.ok && d.ok && d.conversation?.status === 'closed',
    note: `status=${d.conversation?.status} · summary=${d.conversation?.summary?.slice(0, 80) ?? '?'}`,
  };
})();

// --- 4. 1-on-1 Agent chat ---
await step('8. Solo chat with Marcus', async () => {
  const r = await fetch(`${PROD}/api/agents/marcus/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'In 2 sentences: when researching a senior dog probiotics avatar in Spain, what\'s your top mining source?' }],
    }),
  });
  const d = await r.json();
  return { ok: r.ok && d.ok && d.reply?.length > 30, note: `${d.reply?.length ?? 0} chars · ${d.tokens ?? 0} tokens` };
})();

// --- 5. Pro-active triggers ---
await step('9. Hive checkin (login trigger)', async () => {
  const r = await fetch(`${PROD}/api/hive/checkin`, { method: 'POST', headers: auth });
  const d = await r.json();
  return {
    ok: r.ok,
    note: d.project ? `picked ${d.project.projectName}` : (d.ranAt ? 'no stale project' : 'disabled'),
  };
})();

await step('10. System-start (manual standup)', async () => {
  if (!myProject) return { ok: false, note: 'no project' };
  const r = await fetch(`${PROD}/api/conversations/system-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      projectId: myProject.id,
      trigger: 'STANDUP',
      topic: 'E2E test standup',
      opening: 'Team — quick standup, 1 sentence each on your area. Léa close with priorities.',
      maxChainLength: 2,
    }),
  });
  const d = await r.json();
  return {
    ok: r.ok,
    note: d.skipped ? `skipped (${d.skipped})` : (d.created ? 'fired new convo' : 'unknown'),
  };
})();

// --- 6. Phase U infrastructure (admin) ---
await step('11. Distillations admin endpoint reachable', async () => {
  const r = await fetch(`${PROD}/api/admin/distill`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  // Without proper body returns 400 — that's fine, route is alive
  return { ok: r.status === 400 || r.status === 200, note: `HTTP ${r.status}` };
})();

await step('12. Scraping health admin endpoint', async () => {
  const r = await fetch(`${PROD}/api/admin/scraping-health`, { headers: auth });
  const d = await r.json();
  return {
    ok: r.ok && d.ok && Array.isArray(d.providers),
    note: `${d.providers?.length} providers · ${d.providers?.filter(p => p.health.ok).length} healthy`,
  };
})();

await step('13. Conversation stats', async () => {
  const r = await fetch(`${PROD}/api/admin/conversations-stats`, { headers: auth });
  const d = await r.json();
  return { ok: r.ok && d.ok, note: `24h: ${d.last24h?.total} convos · $${d.last24h?.totalCostUsd?.toFixed(4)}` };
})();

// --- 7. Cron-protected ---
if (CRON_SECRET) {
  await step('14. Cron team-standup endpoint', async () => {
    const r = await fetch(`${PROD}/api/cron/team-standup`, {
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    const d = await r.json();
    return { ok: r.ok, note: d.project ? `picked ${d.project.projectName}` : (d.ranAt ? 'no stale' : 'fail') };
  })();

  await step('15. Cron meta-perf endpoint', async () => {
    const r = await fetch(`${PROD}/api/cron/meta-perf`, {
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    const d = await r.json();
    return { ok: r.ok, note: d.message?.includes?.('META_ACCESS_TOKEN') ? 'no Meta token (expected)' : `${d.projects} projects · standup: ${d.autoStandup?.project?.projectName ?? 'none'}` };
  })();
} else {
  console.log('⚠ CRON_SECRET missing → skipping cron tests 14, 15');
  results.push({ name: '14. Cron team-standup', status: 'SKIP', note: 'CRON_SECRET missing' });
  results.push({ name: '15. Cron meta-perf', status: 'SKIP', note: 'CRON_SECRET missing' });
}

// --- 8. Reports ---
console.log('\n=== SUMMARY ===\n');
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const err = results.filter(r => r.status === 'ERROR').length;
const skip = results.filter(r => r.status === 'SKIP').length;
console.log(`PASS: ${pass} · FAIL: ${fail} · ERROR: ${err} · SKIP: ${skip}\n`);

for (const r of results) {
  const sym = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '○' : '✗';
  console.log(`${sym} ${r.name.padEnd(45)} ${r.note ?? ''} ${r.error ? `→ ${r.error}` : ''}`);
}

console.log('\n=== JSON DUMP ===\n');
console.log(JSON.stringify(results, null, 2));

if (fail + err > 0) process.exit(1);
