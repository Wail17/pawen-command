// List recent BD snapshots per dataset to count actual scraped records today.
const KEY = process.env.BRIGHTDATA_API_KEY;
const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const datasets = {
  reddit_posts: process.env.BRIGHTDATA_DATASET_ID_REDDIT_POSTS,
  reddit_comments: process.env.BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS,
  amazon_search: process.env.BRIGHTDATA_DATASET_ID_AMAZON_SEARCH,
  amazon_products: process.env.BRIGHTDATA_DATASET_ID_AMAZON_PRODUCTS,
  amazon_reviews: process.env.BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS,
  tiktok_posts: process.env.BRIGHTDATA_DATASET_ID_TIKTOK_POSTS,
  tiktok_comments: process.env.BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS,
  youtube_videos: process.env.BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS,
  youtube_comments: process.env.BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS,
  quora: process.env.BRIGHTDATA_DATASET_ID_QUORA,
};

const today = new Date();
const todayStart = new Date(today.toISOString().slice(0, 10) + 'T00:00:00Z').getTime();

async function listSnapshots(name, id) {
  if (!id) { console.log(`${name}: NO ID`); return null; }
  // BD snapshots API
  const url = `https://api.brightdata.com/datasets/v3/snapshots?dataset_id=${id}&status=ready`;
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (r.status !== 200) {
    console.log(`${name} (${id}): HTTP ${r.status} ${text.slice(0, 200)}`);
    return null;
  }
  let snaps;
  try { snaps = JSON.parse(text); } catch { console.log(`${name}: parse fail`); return null; }
  if (!Array.isArray(snaps)) { console.log(`${name}:`, snaps); return null; }
  const todays = snaps.filter(s => {
    const ts = s.created ? new Date(s.created).getTime() : 0;
    return ts >= todayStart;
  });
  let totalRecords = 0;
  for (const s of todays) totalRecords += s.dataset_size ?? 0;
  console.log(`${name.padEnd(20)} today=${todays.length} snapshots, records=${totalRecords}`);
  return { count: todays.length, records: totalRecords, snapshots: todays };
}

let grand = 0;
for (const [name, id] of Object.entries(datasets)) {
  const r = await listSnapshots(name, id);
  if (r) grand += r.records;
}
console.log(`\nGRAND TOTAL today's records: ${grand}`);
