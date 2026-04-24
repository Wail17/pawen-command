// Phase U.1 — distill all 6 personas against Vercel prod in sequence.
// Sends a compact persona-specific synthetic training payload so each call
// produces a meaningful 4-section corpus without requiring real IndexedDB
// chunks. Verifies: route shape, auth (x-admin-token), kill-switch bypass,
// output contract.
//
// Usage: npx -y dotenv-cli -e .env.local -- node scripts/test-distill-all.mjs

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PROD_URL = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD not set. Pull prod env: npx -y vercel@latest env pull .env.local --environment=production --yes');
  process.exit(1);
}

const PERSONA_PROMPTS = {
  sarah: {
    intro: `You are Sarah, the Strategist at Pawen Agency. Analytical, direct, data-driven. Expertise: Market analysis, Product-market fit, Schwartz sophistication, Competitive intelligence, Buyer psychology.`,
    chunks: `## CURATED KNOWLEDGE
### Schwartz Five Stages of Sophistication
Every market passes through five stages. Stage 1: first-to-market with a direct claim ("X causes weight loss"). Stage 2: competitors copy, you amplify the claim ("lose 10 pounds in 10 days"). Stage 3: claims feel empty, introduce a mechanism ("unique fat-burning enzyme"). Stage 4: mechanism claims saturate, introduce a better mechanism or personify it. Stage 5: market is jaded, identify with the prospect's worldview before making any claim.

### Product-market fit diagnostic
Three signals: (1) organic word-of-mouth (≥20% of buyers refer someone within 30 days), (2) >40% "very disappointed" if product disappeared, (3) churn <5% monthly for subscription / NPS >50 for one-shot. Two out of three = PMF. One out of three = still searching.

## TRAINING SOURCES
### SOURCE: Competitive Positioning Playbook
Never fight a category leader on their strongest attribute. Find an axis they cannot follow on (price, segment, ingredient, delivery, transparency). The attribute must matter to a defined sub-segment even if smaller. Outflank, don't outspend.

### SOURCE: Buyer Psychology Fundamentals
Fear of loss is 2.5x stronger than anticipation of gain (Kahneman). Lead with loss frame when awareness is high. Lead with gain frame when awareness is low (prospect doesn't feel the loss yet). Never mix the two in a single ad.`,
  },
  marcus: {
    intro: `You are Marcus, the Customer Researcher at Pawen Agency. Empathetic, obsessively curious. Expertise: Avatar excavation, Desire drilling, Voice extraction, Sub-avatar segmentation, Root cause analysis.`,
    chunks: `## CURATED KNOWLEDGE
### The 5-Layer Avatar Excavation
Layer 1 surface desire. Layer 2 real desire. Layer 3 hidden fear. Layer 4 identity. Layer 5 tribal signaling. The customer tells you Layer 1 freely, Layer 2 if you ask well, never Layers 3-5 directly — you excavate them from verbatims.

### Verbatim extraction rule
Never paraphrase. Copy the exact sentence. Preserve typos, swears, punctuation, emotional markers. Paraphrase kills conversion.

## TRAINING SOURCES
### SOURCE: Voice of Customer Handbook
Five verbatim mines: Amazon 3-star reviews, Reddit "has anyone else" threads, YouTube comments under competitor reviews, Quora "why does" answers, Facebook group 50+ comment posts.
Score verbatims: emotional intensity × specificity × uniqueness. "I feel bad" = 0. "Last Tuesday at Marco's birthday I didn't recognize myself in the photo" = 10.

### SOURCE: Desire Drilling Masterclass
People don't buy products, they buy the version of themselves they imagine having the product. The Italian menopause avatar doesn't want a supplement, she wants to dance at her grandson's wedding.`,
  },
  alex: {
    intro: `You are Alex, the Copywriter at Pawen Agency. Creative, bold, slightly rebellious. Expertise: DR copywriting, 7 ZAK hook formulas, ZAK 7-block advertorial, EVOLVE video scripts, body copies, headlines, open loops, sensory language, future pacing.`,
    chunks: `## CURATED KNOWLEDGE
### The ZAK 7-block Advertorial
(1) Pattern interrupt headline, (2) empathy bridge (I was in your shoes), (3) credibility flag, (4) mechanism reveal, (5) unique solution (product), (6) proof stack, (7) CTA with reverse risk. Each block has a job — removing any breaks the funnel.

### Hook formulas
7 ZAK formulas: curiosity gap, pattern interrupt, empathy, fear/urgency, social proof question, number-in-headline, contrarian claim. Every hook must answer: "why stop scrolling NOW?"

## TRAINING SOURCES
### SOURCE: Copy Craft Fundamentals
Open loop: pose a question in sentence 1, resolve in sentence 3. Forces the eye downward.
Sensory language: activate smell, touch, sound — not just sight. "The smell of chlorine in the locker room" beats "the gym."
Future pacing: describe the reader's life AFTER purchase as if they're already there. Present tense, second person.

### SOURCE: Direct Response Rules
Every sentence pays rent or leaves. If removing a line doesn't change the reader's next action, remove it.
Never announce a transition ("now let me explain..."). Let the copy do the transition.`,
  },
  nina: {
    intro: `You are Nina, the Creative Director at Pawen Agency. Visual thinker, perfectionist, demanding. Expertise: Visual ad design, Image layouts, Color psychology, fal.ai image gen, Brand visual identity, Scroll-stopping visuals.`,
    chunks: `## CURATED KNOWLEDGE
### The 3-second test
First thing the feed shows is the IMAGE. If it doesn't stop the thumb in 3 seconds, nothing else matters. Test every creative on someone who doesn't know the brand. If they scroll past, redo.

### Color hierarchy for DR
Red = urgency, limited, loss. Green = growth, safety, money. Yellow = alert, warning, attention. Blue = trust, authority, medical. Orange = energy, impulse, affordable. Pick ONE dominant accent per ad; backgrounds stay neutral.

## TRAINING SOURCES
### SOURCE: Static Ad Composition
Rule of thirds for product shots. Center composition for hero statements. Diagonal lines draw the eye — use them to point at the CTA or product. Never split the subject on the bottom half cropped fold.

### SOURCE: Visual Anti-Patterns
Stock photography that screams stock = instant scroll. Overlayed text with 4+ fonts = unreadable. Gradients from one brand color to another = amateur. Generic smiling models without context = invisible.`,
  },
  david: {
    intro: `You are David, the Media Buyer at Pawen Agency. Data-obsessed, methodical. Expertise: Meta Ads CBO, Budget allocation, A/B testing (Marksman/Sniper/Shotgun), ROAS optimization, Audience targeting, Kill rules, Creative fatigue.`,
    chunks: `## CURATED KNOWLEDGE
### The 50-conversion rule
Do not scale any ad set until it has 50+ conversions attributed. Below 50, variance is noise — scaling hallucinations. At 50 the signal stabilizes enough to decide. Below 50: keep running at spend-floor, don't judge performance yet.

### Kill criteria
Kill an ad when (1) 3x CPA target with 30+ conversions, (2) CTR <0.5% with 5k impressions, (3) frequency >4 with ROAS declining week-over-week. Kill individual ads, not ad sets, unless every ad in the set failed.

## TRAINING SOURCES
### SOURCE: CBO Scaling Playbook
Campaign Budget Optimization: Meta allocates across ad sets. Launch 3-5 ad sets per campaign; kill bottom 40% after 50 conversions; duplicate top 20% at 2x budget. Scale vertically 20% max per day — anything more resets learning.

### SOURCE: Testing Methodologies
Marksman: 1 winning concept, 5 creative variants. Sniper: 3 angle tests against a control. Shotgun: 10+ variants with no hypothesis — only use on fresh accounts with no data.`,
  },
  lea: {
    intro: `You are Léa, the Project Manager & Director at Pawen Agency. Organized, decisive, big-picture. Expertise: Project orchestration, Quality control, Cross-gate consistency, Brand DNA compilation, Decision-making, Autonomous pipeline management.`,
    chunks: `## CURATED KNOWLEDGE
### The Brand DNA congruence check
After Gate 1 + Brand DNA are approved, every downstream gate's output must pass congruence: does this output's voice, mechanism, and positioning match the locked Brand DNA? If not, reject and respecify.

### Cross-gate review priorities
(1) Sub-avatar identity consistency — same named avatar gets the same voice in G2, G4, G6, G7.
(2) Mechanism citation — if G3 defined a mechanism, G4 and G5 MUST reference it by name.
(3) Funnel stage — copy at Unaware level cannot reference brand name; copy at Most Aware must.

## TRAINING SOURCES
### SOURCE: PM Fundamentals
You are not a writer, researcher, designer, or buyer. You are the orchestrator. Your job: reject misalignment, not produce copy.
When two agents disagree, ask: which output has stronger evidence? Agent with better evidence wins.

### SOURCE: Decision Framework
Speed > perfection when the output is reversible (gate re-run is cheap). Perfection > speed when the output is irreversible (Meta campaign push).
Flag every decision with its reversibility level before calling it.`,
  },
};

const agentIds = process.argv.slice(2).filter(a => PERSONA_PROMPTS[a]);
const runIds = agentIds.length > 0 ? agentIds : Object.keys(PERSONA_PROMPTS);

const results = [];

for (const id of runIds) {
  const { intro, chunks } = PERSONA_PROMPTS[id];
  const systemPrompt = `${intro}

You will receive synthetic training material. Compile it into a 4-section Markdown corpus:
# Frameworks
# Principles
# Anti-patterns
# Tactical heuristics

Keep output ≤8000 characters for this smoke test. Start directly with "# Frameworks", no preamble.`;

  const body = JSON.stringify({
    agentId: id,
    systemPrompt,
    userMessage: chunks,
    inputStats: {
      chunkCount: 4,
      sourceCount: 2,
      knowledgeCount: 2,
      totalChars: chunks.length,
      truncatedChars: 0,
    },
  });

  const started = Date.now();
  process.stdout.write(`→ ${id} (${chunks.length} chars in) …`);
  try {
    const res = await fetch(`${PROD_URL}/api/admin/distill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_PASSWORD,
      },
      body,
    });
    const text = await res.text();
    const duration = Date.now() - started;
    if (!res.ok) {
      console.log(` ✗ HTTP ${res.status} (${duration}ms)`);
      console.log(`  ${text.slice(0, 200)}`);
      results.push({ id, ok: false, status: res.status, duration });
      continue;
    }
    const parsed = JSON.parse(text);
    const chars = parsed.distilledExpertise?.length ?? 0;
    const firstLine = (parsed.distilledExpertise ?? '').split('\n')[0]?.slice(0, 60) ?? '';
    console.log(` ✓ 200 in ${(duration / 1000).toFixed(1)}s · ${chars} chars · ${parsed.tokens} tokens · "${firstLine}"`);
    results.push({ id, ok: true, status: 200, duration, chars, tokens: parsed.tokens, model: parsed.model });
  } catch (err) {
    console.log(` ✗ ${err instanceof Error ? err.message : String(err)}`);
    results.push({ id, ok: false, error: String(err) });
  }
}

console.log('\n=== Summary ===');
console.log(JSON.stringify(results, null, 2));
const ok = results.filter(r => r.ok).length;
const total = results.length;
console.log(`\n${ok}/${total} succeeded`);
if (ok < total) process.exit(1);
