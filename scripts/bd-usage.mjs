// Probe BrightData API for usage / billing / spend info.
// BD uses Bearer auth. Try several endpoints.
const KEY = process.env.BRIGHTDATA_API_KEY;
if (!KEY) { console.error('BRIGHTDATA_API_KEY missing'); process.exit(1); }
const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function probe(label, url, init = {}) {
  console.log(`\n→ ${label}`);
  console.log(`  ${url}`);
  try {
    const r = await fetch(url, { headers, ...init });
    const text = await r.text();
    console.log(`  HTTP ${r.status}`);
    if (text) {
      try {
        const j = JSON.parse(text);
        console.log(`  ${JSON.stringify(j).slice(0, 800)}`);
      } catch {
        console.log(`  ${text.slice(0, 400)}`);
      }
    }
  } catch (e) {
    console.log(`  ERR ${e.message}`);
  }
}

// Datasets API — typical billing/account endpoints
await probe('account info', 'https://api.brightdata.com/customer');
await probe('billing summary', 'https://api.brightdata.com/customer/balance');
await probe('account v3', 'https://api.brightdata.com/v3/customer');
await probe('dca status', 'https://api.brightdata.com/dca/status');
await probe('datasets list', 'https://api.brightdata.com/datasets/list');
await probe('datasets v3 list', 'https://api.brightdata.com/datasets/v3/list');
await probe('snapshots latest', 'https://api.brightdata.com/dca/snapshots');
await probe('zone usage', 'https://api.brightdata.com/zone/balance');

// Today's usage — try common date-range endpoints
const today = new Date().toISOString().slice(0, 10);
await probe('usage today', `https://api.brightdata.com/customer/usage?from=${today}&to=${today}`);
await probe('billing usage', `https://api.brightdata.com/billing/usage?from=${today}&to=${today}`);
