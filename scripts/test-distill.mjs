// One-off: exercises /api/admin/distill on prod with a synthetic training
// payload (so we don't need real training chunks in IndexedDB).
// Reads ADMIN_PASSWORD from .env.local via dotenv-cli.
// Usage: npx -y dotenv-cli -e .env.local -- node scripts/test-distill.mjs

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PROD_URL = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const AGENT_ID = process.env.TEST_AGENT_ID || 'marcus';

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD not set. Run via: npx -y dotenv-cli -e .env.local -- node scripts/test-distill.mjs');
  process.exit(1);
}

const systemPrompt = `You are compiling the baked-in expertise corpus for Marcus, the Customer Researcher at Pawen Agency.

Empathetic and obsessively curious. Marcus spends hours reading forums, reviews, and Reddit threads because he genuinely cares about understanding people.

YOUR EXPERTISE DOMAIN: Avatar deep dive research · Desire drilling & mass psychology · Voice extraction & customer language · Sub-avatar segmentation · Root cause & belief error analysis

You will receive training material and compress it into a 4-section Markdown corpus:
# Frameworks
# Principles
# Anti-patterns
# Tactical heuristics

Keep output ≤8000 characters for this smoke test. Start directly with "# Frameworks", no preamble.`;

const userMessage = `## CURATED KNOWLEDGE ENTRIES

### The 5-Layer Avatar Excavation [avatar_research | critical]
Key takeaway: The customer doesn't know what they want — you excavate it.
Layer 1: surface desire (what they say they want). Layer 2: real desire (what the surface is a proxy for). Layer 3: hidden fear (what they won't admit). Layer 4: identity (who they are trying to be/not be). Layer 5: tribal signaling (who they want to be seen as).

### Verbatim extraction over paraphrase [avatar_research | critical]
Key takeaway: Use the customer's exact words. Paraphrase kills conversion.
Copy the exact sentence from a forum/review. Preserve punctuation, typos, emotional markers. If the customer says "I'm sick of being the fat aunt at weddings", use that. Do not rewrite to "She feels insecure about her weight at social events" — that's marketer voice.

### The root-cause rule [root_cause | critical]
Key takeaway: Find the upstream mechanism or you're just treating symptoms.
If the customer complains about weight gain, the real mechanism might be estrobolome dysbiosis (gut bacteria affecting estrogen metabolism). Surface problem: weight. Real mechanism: gut health. Advertorial leverage: mechanism.

## TRAINING SOURCE EXCERPTS

### SOURCE: Desire Drilling Masterclass

--- chunk 0 ---
There are three desires in every avatar: what they tell their friends, what they tell themselves in the mirror, and what they won't admit even in their own head. The last one is where copy gold lives. If you can verbalize what the avatar won't say out loud, you have bought their attention for life.

--- chunk 1 ---
Mass psychology maxim: people don't buy the product, they buy the version of themselves they imagine having the product. The Italian menopause avatar doesn't want "a supplement", she wants to be the woman who dances at her grandson's wedding again.

--- chunk 2 ---
Anti-pattern: asking the avatar what they want. They don't know. They will tell you the surface desire (lose weight) but will never volunteer the real driver (shame at being seen as old). Research is about reading between the lines.

### SOURCE: Voice of Customer Handbook

--- chunk 0 ---
Five places to mine verbatims: (1) Amazon 3-star reviews — most honest, mixed feelings exposed, (2) Reddit threads asking "has anyone else experienced…", (3) YouTube video comments under competitor product reviews, (4) Quora answers to "why does…" questions, (5) Facebook group posts with 50+ comments.

--- chunk 1 ---
Rank verbatims by emotional intensity × specificity × uniqueness. A generic "I feel bad" is worthless. "Last Tuesday at Marco's birthday I saw a photo and didn't recognize myself" is gold. Preserve the date, the name, the concrete moment.

--- chunk 2 ---
Never sanitize. If the verbatim contains a swear word, a typo, or a grammatical error, preserve it. The imperfection is the signal of authenticity. A polished verbatim is a suspicious verbatim.`;

const body = JSON.stringify({
  agentId: AGENT_ID,
  systemPrompt,
  userMessage,
  inputStats: {
    chunkCount: 6,
    sourceCount: 2,
    knowledgeCount: 3,
    totalChars: userMessage.length,
    truncatedChars: 0,
  },
});

const url = `${PROD_URL}/api/admin/distill`;
console.log(`POST ${url}`);
console.log(`x-admin-token: <${ADMIN_PASSWORD.length} chars>`);
console.log(`body bytes: ${body.length}`);
console.log(`systemPrompt chars: ${systemPrompt.length}`);
console.log(`userMessage chars: ${userMessage.length}`);

const started = Date.now();

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_PASSWORD,
    },
    body,
  });

  const duration = Date.now() - started;
  const text = await res.text();
  console.log(`\n--- Response ---`);
  console.log(`status: ${res.status} ${res.statusText}`);
  console.log(`duration: ${duration}ms`);
  console.log(`content-type: ${res.headers.get('content-type')}`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.log(`body (raw, first 2000 chars):`);
    console.log(text.slice(0, 2000));
    process.exit(1);
  }

  if (!res.ok) {
    console.log(`body (error):`);
    console.log(JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  const distilled = parsed.distilledExpertise ?? '';
  console.log(`model: ${parsed.model}`);
  console.log(`tokens: ${parsed.tokens}`);
  console.log(`distilledExpertise chars: ${distilled.length}`);
  console.log(`\n--- First 800 chars of distillation ---`);
  console.log(distilled.slice(0, 800));
  console.log(`\n--- Last 200 chars ---`);
  console.log(distilled.slice(-200));
} catch (err) {
  console.error('fetch failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
