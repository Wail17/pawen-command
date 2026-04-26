// Quick: fetch each source briefly, output one real URL from each.

const PROD = 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

async function fetchOne(source, plan) {
  const r = await fetch(`${PROD}/api/scraping/fetch`, {
    method: 'POST', headers,
    body: JSON.stringify({ source, plan, language: 'en-US' }),
  });
  const d = await r.json();
  const items = d.data?.items ?? [];
  return items.slice(0, 2).map(it => it.url);
}

const [yt, am] = await Promise.all([
  fetchOne('youtube', { video_queries: ['senior dog probiotic'] }),
  fetchOne('amazon',  { product_queries: ['senior dog probiotic'], marketplace: 'amazon.com' }),
]);
console.log('YT:', yt);
console.log('AM:', am);
