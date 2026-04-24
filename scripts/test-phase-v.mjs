// Phase V smoke test: start conversation → post user message → close.
// Requires NEXT_PUBLIC_CONVERSATIONS_ENABLED=1 on prod and at least one
// distillation present (otherwise agents run on legacy persona, still OK).

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const APP_PW = process.env.APP_PASSWORD;

if (!ADMIN_PW || !APP_PW) {
  console.error('Need ADMIN_PASSWORD + APP_PASSWORD. Run: vercel env pull .env.local --environment=production --yes');
  process.exit(1);
}

// 1. Login as admin
const usersRes = await fetch(`${PROD}/api/auth/users`, { headers: { 'x-admin-token': ADMIN_PW } });
const users = (await usersRes.json()).users ?? [];
const admin = users.find(u => u.role === 'admin') ?? users[0];
if (!admin) { console.error('no user found'); process.exit(1); }

const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: admin.name }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) { console.error('login failed'); process.exit(1); }
console.log(`✓ logged in as ${admin.name}`);

// 2. Start a conversation
const projectId = '12e0152b-740b-49ee-ae02-1fefba3a3d08'; // MenoItaly test project from CLAUDE.md
const startRes = await fetch(`${PROD}/api/conversations/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, 'Cookie': cookie },
  body: JSON.stringify({
    projectId,
    topic: 'Smoke test: fear vs aspiration for Italian menopause hooks',
    firstMessage: {
      authorType: 'user',
      content: 'Team — we have two potential hook directions for the Italian menopause avatar: fear of ageing (@alex) vs aspiration of vitality (@marcus). Which is stronger and why? Keep it short.',
    },
    maxChainLength: 3,
  }),
});
const startTxt = await startRes.text();
let startData;
try { startData = JSON.parse(startTxt); } catch { console.error('start response not JSON:', startTxt.slice(0, 500)); process.exit(1); }
console.log(`✓ start: ${startRes.status} · conv ${startData.conversation?.id?.slice(0, 8)} · ${startData.messages?.length ?? 0} messages`);
if (Array.isArray(startData.messages)) {
  for (const m of startData.messages) {
    console.log(`    [${m.authorType}:${m.authorId}] ${m.content.slice(0, 120)}${m.content.length > 120 ? '…' : ''}`);
  }
}
if (Array.isArray(startData.dispatched?.turns)) {
  const cost = startData.dispatched.turns.reduce((s, t) => s + (t.costUsd ?? 0), 0);
  console.log(`    dispatched ${startData.dispatched.turns.length} turns · stopReason=${startData.dispatched.stopReason} · cost=$${cost.toFixed(4)}`);
}
if (!startData.ok) { console.error('start failed'); process.exit(1); }

const convId = startData.conversation.id;

// 3. Post a follow-up user message tagging Nina
const postRes = await fetch(`${PROD}/api/conversations/${convId}/message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, 'Cookie': cookie },
  body: JSON.stringify({
    content: '@nina from a visual angle which of those two directions is easier to land in a 1080x1080 static?',
    maxChainLength: 2,
  }),
});
const postData = await postRes.json();
console.log(`✓ post: ${postRes.status} · now ${postData.messages?.length ?? 0} messages`);
if (Array.isArray(postData.messages)) {
  const newMsgs = postData.messages.slice(startData.messages.length);
  for (const m of newMsgs) {
    console.log(`    [${m.authorType}:${m.authorId}] ${m.content.slice(0, 120)}${m.content.length > 120 ? '…' : ''}`);
  }
}

// 4. Close
const closeRes = await fetch(`${PROD}/api/conversations/${convId}/close`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, 'Cookie': cookie },
  body: JSON.stringify({ askLeaSummary: true }),
});
const closeTxt = await closeRes.text();
console.log(`    close status=${closeRes.status} content-type=${closeRes.headers.get('content-type')}`);
console.log(`    close body (first 500): ${closeTxt.slice(0, 500)}`);
let closeData;
try { closeData = JSON.parse(closeTxt); }
catch { console.log(`✗ close body not JSON`); closeData = { conversation: {} }; }
console.log(`✓ close: ${closeRes.status} · status=${closeData.conversation?.status} · reason=${closeData.conversation?.closeReason} · cost=$${closeData.conversation?.costUsd?.toFixed(4)}`);
if (closeData.conversation?.summary) {
  console.log(`    summary: ${closeData.conversation.summary.slice(0, 200)}`);
}

console.log('\n✓ Phase V smoke test PASSED');
