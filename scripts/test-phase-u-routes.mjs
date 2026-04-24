// Phase U smoke test against Vercel prod for all routes added
// in iterations 4-8 (constitution + cron + rerun queue + scout).
// Uses prod ADMIN_PASSWORD + a session cookie-free path: cron uses
// its own CRON_SECRET bypass, scout/update-constitution/rerun/... need
// a session. So we additionally log in as the admin app-user first.

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const APP_PW = process.env.APP_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;

if (!ADMIN_PW || !APP_PW) {
  console.error('Missing ADMIN_PASSWORD / APP_PASSWORD. Pull prod env: vercel env pull .env.local --environment=production --yes');
  process.exit(1);
}

const results = [];

// 1. Cron route (no session needed, uses CRON_SECRET)
async function testCron() {
  if (!CRON_SECRET) {
    results.push({ name: 'cron', skip: 'CRON_SECRET not set locally (prod env may have it)' });
    return;
  }
  const res = await fetch(`${PROD}/api/cron/meta-perf`, {
    method: 'GET',
    headers: { 'x-cron-secret': CRON_SECRET },
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 300); }
  results.push({ name: 'cron/meta-perf', status: res.status, body: parsed });
}

// 2. Constitution update + sync/agent-constitution need a session cookie.
//    Admin panel login flow: POST /api/admin/login with {password}
//    This returns {ok, token} but does NOT set an app-user session cookie.
//    For session-scoped routes we need app-user login via /api/auth/login.
async function getSessionCookie() {
  // First list users to find an admin (public endpoint)
  const listRes = await fetch(`${PROD}/api/auth/users`, {
    method: 'GET',
    headers: { 'x-admin-token': ADMIN_PW },
  });
  const listData = await listRes.json();
  if (!listData || !Array.isArray(listData.users)) {
    return { cookie: null, error: `auth/users: ${JSON.stringify(listData)}` };
  }
  const admin = listData.users.find(u => u.role === 'admin') ?? listData.users[0];
  // Single-shot login: {password, user}
  const loginRes = await fetch(`${PROD}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
    body: JSON.stringify({ password: APP_PW, user: admin.name }),
  });
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const loginData = await loginRes.json();
  if (!loginData.ok) return { cookie: null, error: `login: ${JSON.stringify(loginData)}` };
  return { cookie: setCookie.split(';')[0], user: admin.name };
}

// 3. Pending rerun — expect 200 with empty rows on fresh env
async function testRerunPending(cookie) {
  const res = await fetch(`${PROD}/api/rerun/pending`, {
    method: 'GET',
    headers: {
      'x-admin-token': ADMIN_PW,
      'Cookie': cookie,
    },
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 200); }
  results.push({ name: 'rerun/pending', status: res.status, body: parsed });
}

// 4. Scout plan — smoke-test it picks tools for a real intent
async function testScoutPlan(cookie) {
  const res = await fetch(`${PROD}/api/scout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_PW,
      'Cookie': cookie,
    },
    body: JSON.stringify({
      mode: 'plan',
      intent: 'Need more voice-of-customer on menopausal weight gain from Italian forums — specifically fear-driven verbatims',
      agentId: 'marcus',
      projectContext: {
        niche: 'menopause supplements',
        product: 'MenoItaly probiotic',
        language: 'it-IT',
        market: 'Italy',
      },
    }),
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 400); }
  results.push({
    name: 'scout/plan',
    status: res.status,
    tools: parsed?.plan?.tools ?? null,
    queryCount: parsed?.plan?.queries ? Object.values(parsed.plan.queries).flat().length : null,
    rationale: parsed?.plan?.rationale ?? null,
    estimatedCostUsd: parsed?.plan?.estimatedCostUsd ?? null,
    tokens: parsed?.tokens ?? null,
  });
}

// 5. Update constitution — with minimal synthetic corpus (not meaningful output,
//    but proves route works end-to-end)
async function testConstitution(cookie) {
  const systemPrompt = `You are Marcus, the Customer Researcher at Pawen Agency. You will receive a corpus and must write a first-person constitution with three sections: # Do, # Don't, # Watch-out. Max 2000 characters for this smoke test. Start directly with "# Do".`;
  const userMessage = `CORPUS\n\nRecent outputs: you have produced 3 sub-avatar profiles this week. Reviewer scored two at 85% and one at 60%. The 60% output was rejected because you paraphrased verbatims instead of quoting them.\n\nRejections: BH-22: "Marcus sanitized the Reddit quote — LOST the emotional punch". Never do this again.\n\nGold picks: human picked "I didn't recognize myself in the photo" as a headline hook in three separate projects.\n\nWrite the constitution.`;

  const res = await fetch(`${PROD}/api/admin/update-constitution`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_PW,
      'Cookie': cookie,
    },
    body: JSON.stringify({
      agentId: 'marcus',
      systemPrompt,
      userMessage,
      stats: { outputCount: 3, rejectionCount: 1, errorCount: 0, goldCount: 3, avgScore: 76, approvalRate: 0.66 },
      basedOnGates: ['gate1', 'gate2', 'gate3'],
      priorVersion: 0,
    }),
  });
  const txt = await res.text();
  let parsed;
  try { parsed = JSON.parse(txt); } catch { parsed = txt.slice(0, 300); }
  results.push({
    name: 'admin/update-constitution',
    status: res.status,
    chars: parsed?.constitution?.length ?? null,
    first200: parsed?.constitution?.slice(0, 200) ?? null,
    tokens: parsed?.tokens ?? null,
  });
}

// Run sequence
await testCron();
const { cookie, error } = await getSessionCookie();
if (!cookie) {
  console.error(`Session login failed: ${error}`);
  results.push({ name: 'session-login', error });
} else {
  await testRerunPending(cookie);
  await testScoutPlan(cookie);
  await testConstitution(cookie);
}

console.log('\n=== Summary ===');
console.log(JSON.stringify(results, null, 2));

const failed = results.filter(r => r.status && r.status >= 400).length;
if (failed > 0) process.exit(1);
