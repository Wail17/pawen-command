// ============================================================
// PAWEN — Demo Data for All Gates
// Loads realistic mock data so the UI can be previewed
// without running AI generation. Product: "Slapen" sleep supplement.
// ============================================================

import type { GateId, BrandDNA } from '../types';
import type { AvatarRunResult, SubAvatarV2, RawSignal } from '../avatars/types';

// -------- Gate 1: Avatar Excavation --------

function demoSubAvatars(): SubAvatarV2[] {
  return [
    {
      id: 'sa-1',
      name: 'The Exhausted Overthinker',
      nickname: 'racing-mind mom',
      dominant_category: 'emotion',
      surface_desire: 'I just want to fall asleep without my brain going 100mph',
      description: 'Women 28-45 who lie awake replaying conversations, planning tomorrow, worrying about things they can\'t control. They\'ve tried melatonin, meditation apps, and "sleep hygiene" — nothing stops the mental chatter. They\'re exhausted but wired.',
      tam_estimate: '12M+ in Western markets',
      urgency_score: 9,
      scope_score: 8,
      staying_power_score: 9,
      verbatim_quotes: [
        { quote: 'My brain just won\'t shut up. I lie there for 2 hours just thinking about NOTHING important.', source_url: 'https://reddit.com/r/insomnia', source_type: 'reddit', emotion_tag: 'frustration' },
        { quote: 'I\'m so tired during the day but the second I hit the pillow my mind goes into overdrive', source_url: 'https://reddit.com/r/sleep', source_type: 'reddit', emotion_tag: 'exhaustion' },
        { quote: 'Melatonin makes me groggy but doesn\'t stop the racing thoughts', source_url: 'https://quora.com', source_type: 'quora', emotion_tag: 'frustration' },
        { quote: 'I\'ve tried every app, every tea, every "trick" — my anxiety just laughs at all of them', source_url: 'https://reddit.com/r/anxiety', source_type: 'reddit', emotion_tag: 'desperation' },
        { quote: 'I used to be a great sleeper. Now I dread bedtime because I know I\'ll just lie there', source_url: 'https://forum.sleep.org', source_type: 'forums', emotion_tag: 'fear' },
        { quote: 'My husband falls asleep in 5 minutes and I want to scream', source_url: 'https://reddit.com/r/insomnia', source_type: 'reddit', emotion_tag: 'anger' },
        { quote: 'I feel like a zombie at work. My boss asked if I was okay and I almost cried', source_url: 'https://quora.com', source_type: 'quora', emotion_tag: 'shame' },
        { quote: 'The worst part is knowing you NEED to sleep makes it even harder to fall asleep', source_url: 'https://reddit.com/r/sleep', source_type: 'reddit', emotion_tag: 'frustration' },
      ],
      emotional_triggers: ['racing thoughts at bedtime', 'morning exhaustion', 'comparison with partner\'s easy sleep', 'fear of another sleepless night', 'work performance anxiety'],
      past_attempts_failures: ['Melatonin (groggy, doesn\'t stop thoughts)', 'Meditation apps (can\'t focus)', 'Sleep hygiene tips (already doing them all)', 'Prescription sleep aids (afraid of dependency)', 'CBD oil (inconsistent results)'],
      implicit_demographics: ['Women 28-45', 'Professional/working mother', 'Middle-to-upper income', 'Health-conscious', 'Anxiety-prone'],
      angles: {
        positioning: { framework: 'new_mechanism', description: 'The problem isn\'t that you can\'t sleep — it\'s that your cortisol stays elevated past sunset. Slapen\'s dual-phase formula addresses the root cause.', rationale: 'Reframes from "I have insomnia" to "my cortisol cycle is broken" — removes identity attachment to the problem.' },
        hooks: [
          'Your brain isn\'t broken — your cortisol clock is.',
          'What if falling asleep was as easy as it used to be?',
          'The real reason you can\'t stop thinking at bedtime',
          'I tried 14 sleep aids before I found the one that actually works',
          'Why "just relax" is the worst sleep advice ever given',
        ],
        story_angle: {
          problem: 'Every night the same torture — lights off, brain on. Hours of ceiling-staring while your partner snores peacefully beside you.',
          agitation: 'You\'ve tried everything. Melatonin, magnesium, meditation apps, weighted blankets, no screens, chamomile tea. Nothing stops the mental hurricane.',
          solution: 'What nobody told you: the problem isn\'t your "sleep hygiene." It\'s your cortisol rhythm — it peaks when it should drop.',
          mechanism: 'Slapen\'s dual-phase formula works with your body\'s natural rhythm: Phase 1 calms cortisol in 20 minutes. Phase 2 sustains deep sleep for 7+ hours.',
          cta: 'Try Slapen risk-free for 60 nights. If you\'re not sleeping better, we refund every cent.',
        },
      },
      source_references: ['reddit', 'quora', 'forums', 'youtube'],
      source_subreddits: ['r/insomnia', 'r/sleep', 'r/anxiety', 'r/Supplements'],
      launch_order: 1,
      recommended_for_test: true,
      recommendation_reason: 'Highest urgency (9/10) + massive TAM + emotionally charged verbatims. The "racing thoughts" angle is under-exploited by competitors.',
      awareness_variants: [],
      deep_dives: [{
        id: 'dd-1',
        generated_at: new Date().toISOString(),
        tokens_used: 4200,
        focus: 'identity and buying objections',
        new_verbatims: [
          { quote: 'I don\'t want to become dependent on another pill', source_url: 'https://reddit.com/r/insomnia', source_type: 'reddit' as const, emotion_tag: 'fear' },
          { quote: 'What if it stops working after a few weeks like everything else?', source_url: 'https://quora.com', source_type: 'quora' as const, emotion_tag: 'skepticism' },
        ],
        hidden_fears: ['Becoming dependent on sleep aids', 'That their insomnia is permanent/genetic', 'Being seen as "weak" for needing help sleeping', 'Missing important moments because they\'re too exhausted'],
        contradictions: ['Says they\'ve "tried everything" but won\'t try prescription meds', 'Wants a natural solution but expects pharmaceutical-level results', 'Skeptical of supplements but spends $200/month on wellness products'],
        sharper_triggers: ['The 3am panic when you realize you have a big meeting tomorrow', 'When your child asks "why do you always look tired, mama?"'],
        micro_segments: [],
        buying_objections: ['Is it habit-forming?', 'Will I feel groggy in the morning?', 'Does it interact with my anxiety medication?', 'How is this different from melatonin?'],
        meta_story: 'The overthinker\'s journey from "I\'m just a bad sleeper" to "my body was fighting against an invisible enemy (cortisol) — and now I have the weapon."',
        claude_notes: 'This sub-avatar has an identity crisis: they\'ve started to define themselves as "someone who can\'t sleep." The mechanism must break this identity attachment.',
        identity_map: { self_image: 'exhausted but high-functioning', anti_identity: 'pill-popper, lazy person who needs a crutch', aspiration: 'the naturally healthy sleeper who wakes refreshed', tribal_markers: ['exhausted moms who power through', '#insomnia community'] },
        linguistic_dna: { power_words: ['finally', 'actually', 'real'], emotional_vocabulary: ['wired', 'drained', 'zombie'], metaphors_used: ['brain won\'t shut off', 'mental hurricane', 'wired but tired'], recurring_phrases: ['tried everything', 'racing thoughts', 'can\'t turn off my brain'] },
        transformation_narrative: { before_state: 'Dreading bedtime, snapping at family, brain fog at work', turning_point: 'Discovering the cortisol connection', after_state: 'Falling asleep naturally, waking refreshed, being present', proof_they_need: 'Clinical studies on cortisol reduction + real user testimonials with sleep tracker data' },
        dark_funnel: { influencers: ['Andrew Huberman', 'Matthew Walker'], content_consumed: ['r/insomnia', 'r/sleep', 'Huberman Lab podcast'], trusted_sources: ['Reddit threads', 'Amazon reviews', 'friend recommendations'], peer_pressure: 'Partner/family commenting on exhaustion and irritability' },
        objection_hierarchy: [
          { objection: 'Is it habit-forming?', severity: 'deal_breaker' as const, counter_argument: '100% non-habit-forming. Unlike prescription sleep aids, Slapen works WITH your body\'s natural cortisol rhythm, not against it.' },
          { objection: 'Will I feel groggy?', severity: 'hesitation' as const, counter_argument: 'Zero grogginess. Phase 2 is metabolized by your body within 6 hours, so you wake clear-headed.' },
        ],
      }],
    },
    {
      id: 'sa-2',
      name: 'The Stressed Professional',
      nickname: 'burnout exec',
      dominant_category: 'behavior',
      surface_desire: 'I need to perform at 100% but I\'m running on 60% because I can\'t sleep',
      description: 'Men and women 30-50 in demanding careers. They see sleep as a performance tool, not a luxury. They\'ve optimized everything else (diet, exercise, supplements) but can\'t crack sleep.',
      tam_estimate: '8M+',
      urgency_score: 8,
      scope_score: 7,
      staying_power_score: 8,
      verbatim_quotes: [
        { quote: 'I track everything — HRV, sleep stages, temperature — but my sleep score is still garbage', source_url: 'https://reddit.com/r/biohacking', source_type: 'reddit', emotion_tag: 'frustration' },
        { quote: 'I can\'t afford to have a bad night. One bad sleep and my entire next day is wrecked', source_url: 'https://quora.com', source_type: 'quora', emotion_tag: 'fear' },
        { quote: 'I spend $500/month on supplements but still wake up at 3am staring at the ceiling', source_url: 'https://reddit.com/r/Supplements', source_type: 'reddit', emotion_tag: 'frustration' },
        { quote: 'My Oura ring keeps telling me my sleep is "poor" and I\'m like YEAH I KNOW', source_url: 'https://reddit.com/r/ouraring', source_type: 'reddit', emotion_tag: 'anger' },
        { quote: 'Sleep is my last bottleneck. Fix this and everything else levels up', source_url: 'https://forum.biohacker.com', source_type: 'forums', emotion_tag: 'hope' },
        { quote: 'I\'ve tried Huberman\'s protocol, the cold plunge, morning sunlight — still can\'t stay asleep past 4am', source_url: 'https://reddit.com/r/biohacking', source_type: 'reddit', emotion_tag: 'desperation' },
      ],
      emotional_triggers: ['performance anxiety', 'Oura/Whoop poor sleep scores', 'competitor outperforming them', 'brain fog in important meetings'],
      past_attempts_failures: ['Huberman protocol (partial improvement)', 'Magnesium glycinate (helps a bit)', 'Blue light glasses (marginal)', 'Cold plunge/sauna protocols (feels good but doesn\'t fix sleep)', 'GABA supplements (inconsistent)'],
      implicit_demographics: ['Men 30-50', 'High-income ($150k+)', 'Tech/finance/entrepreneurship', 'Biohacker mindset', 'Data-driven'],
      angles: {
        positioning: { framework: 'new_information', description: 'You\'ve optimized everything EXCEPT the one thing that controls all the others: your cortisol-to-melatonin transition window.', rationale: 'Speaks their language (optimization, data) while introducing a novel concept they haven\'t encountered.' },
        hooks: [
          'Your Oura ring is screaming at you and you\'re ignoring the real signal',
          'The $500/month supplement stack that\'s missing one $39 ingredient',
          'Why biohackers are getting worse sleep than their grandparents',
        ],
        story_angle: {
          problem: 'You\'ve optimized diet, exercise, and work — but sleep is the bottleneck killing your performance.',
          agitation: 'Every stack, protocol, and gadget gives marginal gains. Your sleep score hasn\'t budged in months.',
          solution: 'The cortisol-melatonin handoff is the one transition no supplement stack addresses.',
          mechanism: 'Slapen targets the 90-minute cortisol-melatonin transition window that determines your entire night\'s sleep architecture.',
          cta: '60-night performance guarantee. Track it with your Oura/Whoop.',
        },
      },
      source_references: ['reddit', 'quora', 'forums'],
      launch_order: 2,
      recommended_for_test: true,
      recommendation_reason: 'High willingness to pay + already buying supplements + data-driven (will track and share results). Great for social proof.',
    },
    {
      id: 'sa-3',
      name: 'The Anxious Night Watcher',
      nickname: '3am spiral',
      dominant_category: 'experience',
      surface_desire: 'I want to stop waking up at 3am with my heart pounding',
      description: 'People who fall asleep okay but wake up at 2-4am with anxiety, heart racing, and can\'t fall back asleep. The "middle insomnia" sufferer. Often linked to cortisol spikes.',
      tam_estimate: '15M+',
      urgency_score: 9,
      scope_score: 9,
      staying_power_score: 7,
      verbatim_quotes: [
        { quote: 'I fall asleep fine but then BAM — 3am, heart racing, mind spinning. Every single night.', source_url: 'https://reddit.com/r/insomnia', source_type: 'reddit', emotion_tag: 'desperation' },
        { quote: 'The 3am wake-ups are destroying my life. I\'m a shell of who I used to be.', source_url: 'https://forum.sleep.org', source_type: 'forums', emotion_tag: 'desperation' },
        { quote: 'I literally have anxiety ABOUT waking up at 3am which makes me wake up at 3am', source_url: 'https://reddit.com/r/anxiety', source_type: 'reddit', emotion_tag: 'frustration' },
        { quote: 'My doctor said "that\'s just cortisol" and didn\'t offer any solution. Thanks doc.', source_url: 'https://quora.com', source_type: 'quora', emotion_tag: 'anger' },
        { quote: 'I wake up at 3am and then just lie there watching the clock until 6. Pure torture.', source_url: 'https://reddit.com/r/sleep', source_type: 'reddit', emotion_tag: 'exhaustion' },
      ],
      emotional_triggers: ['3am cortisol spike', 'heart pounding at night', 'watching the clock', 'dread of next-day exhaustion'],
      past_attempts_failures: ['Melatonin (helps fall asleep, doesn\'t prevent wake-ups)', 'Magnesium (mild improvement)', 'CBT-I (too time-consuming)', 'Prescription benzos (afraid of dependency)'],
      implicit_demographics: ['All genders 25-55', 'Stress-related jobs', 'Often have anxiety diagnosis', 'Health-seeking behavior'],
      angles: {
        positioning: { framework: 'new_mechanism', description: 'The 3am wake-up isn\'t random — it\'s a cortisol micro-spike. Slapen Phase 2 prevents cortisol from crossing the wake threshold during your sleep cycle.', rationale: 'Names and explains the exact phenomenon they experience, making the product feel like it was designed specifically for them.' },
        hooks: [
          'There\'s a scientific name for why you wake up at 3am every night',
          'Your doctor was right — it IS cortisol. Here\'s what they didn\'t tell you.',
          'The 3am wake-up trap: why it gets worse the more you worry about it',
        ],
        story_angle: {
          problem: 'Every night, same horror movie: eyes snap open at 3am, heart pounding, mind racing.',
          agitation: 'You can fall asleep just fine — it\'s STAYING asleep that\'s impossible. And no one seems to have an answer.',
          solution: 'The 3am wake-up is a cortisol micro-spike — your stress hormone crosses the "wake threshold" mid-sleep.',
          mechanism: 'Slapen\'s Phase 2 sustained-release formula keeps cortisol below the wake threshold for 7+ hours.',
          cta: 'Sleep through the night or your money back. 60-night guarantee.',
        },
      },
      source_references: ['reddit', 'forums', 'quora'],
      launch_order: 3,
      recommended_for_test: false,
      recommendation_reason: 'Largest TAM (15M+) but may be harder to convert — needs more education about cortisol mechanism.',
    },
  ];
}

function demoRawSignal(): RawSignal {
  return {
    generated_at: new Date().toISOString(),
    items: [],
    total_items: 847,
    total_char_count: 234560,
    source_breakdown: { reddit: 340, quora: 180, forums: 120, youtube: 95, searchWide: 112 },
    top_unigrams: [
      { gram: 'sleep', count: 234, sources: 3 },
      { gram: 'melatonin', count: 156, sources: 2 },
      { gram: 'anxiety', count: 134, sources: 2 },
      { gram: 'tired', count: 128, sources: 3 },
      { gram: 'waking', count: 112, sources: 2 },
    ],
    top_bigrams: [
      { gram: 'fall asleep', count: 89, sources: 3 },
      { gram: 'racing thoughts', count: 67, sources: 2 },
      { gram: 'can\'t sleep', count: 63, sources: 2 },
      { gram: 'sleep quality', count: 58, sources: 3 },
      { gram: 'wake up', count: 54, sources: 2 },
    ],
    top_trigrams: [
      { gram: 'can\'t fall asleep', count: 45, sources: 2 },
      { gram: 'middle of night', count: 38, sources: 2 },
      { gram: 'tried everything still', count: 29, sources: 2 },
      { gram: 'brain won\'t stop', count: 27, sources: 2 },
    ],
    top_phrases: [
      { gram: 'my brain won\'t shut off', count: 18, sources: 2 },
      { gram: 'tired but can\'t sleep', count: 15, sources: 2 },
      { gram: 'racing thoughts at bedtime', count: 12, sources: 2 },
    ],
    emotion_markers: [
      { category: 'frustration', phrase: 'can\'t sleep', lang: 'en', count: 63, sources: 3 },
      { category: 'desperation', phrase: 'tried everything', lang: 'en', count: 29, sources: 2 },
      { category: 'exhaustion', phrase: 'so tired', lang: 'en', count: 45, sources: 2 },
      { category: 'fear', phrase: 'afraid of dependency', lang: 'en', count: 18, sources: 1 },
      { category: 'anger', phrase: 'nothing works', lang: 'en', count: 22, sources: 2 },
      { category: 'shame', phrase: 'can\'t function', lang: 'en', count: 15, sources: 1 },
      { category: 'hope', phrase: 'finally found', lang: 'en', count: 8, sources: 1 },
    ],
    scored_phrases: [
      { phrase: 'brain won\'t shut off', score: 92, count: 18, sources: 3, tags: ['identity', 'high_emotion'] },
      { phrase: 'tried everything still can\'t', score: 88, count: 15, sources: 2, tags: ['buying_signal', 'high_emotion'] },
      { phrase: 'wired but tired', score: 85, count: 12, sources: 3, tags: ['identity', 'high_emotion'] },
      { phrase: 'racing thoughts at bedtime', score: 82, count: 12, sources: 2, tags: ['identity'] },
      { phrase: '3am wake up heart racing', score: 79, count: 9, sources: 2, tags: ['high_emotion'] },
    ],
    identity_markers: [
      { pattern: 'I\'m just a bad sleeper', type: 'self_identify', source_type: 'reddit', count: 14 },
      { pattern: 'I\'m not someone who takes pills', type: 'anti_identify', source_type: 'reddit', count: 9 },
      { pattern: 'I want to be a morning person', type: 'aspiration', source_type: 'quora', count: 7 },
      { pattern: 'us insomniacs', type: 'tribal', source_type: 'forums', count: 11 },
    ],
    buying_signals: [
      { pattern: 'has anyone tried', type: 'recommendation_seeking', count: 23, sources: 3 },
      { pattern: 'is it worth the price', type: 'price_sensitivity', count: 12, sources: 2 },
      { pattern: 'where can I buy', type: 'purchase_intent', count: 8, sources: 2 },
      { pattern: 'better than melatonin', type: 'comparison', count: 18, sources: 2 },
    ],
    golden_sentences: [
      { sentence: 'I lie there for 2 hours replaying conversations from 10 years ago while my husband snores peacefully', source_type: 'reddit', source_url: 'https://reddit.com/r/insomnia', emotion_tags: ['frustration', 'anger', 'isolation'], score: 95 },
      { sentence: 'The worst part about insomnia is the anxiety about insomnia itself — it\'s a trap you can\'t escape', source_type: 'forums', source_url: 'https://forum.sleep.org', emotion_tags: ['desperation', 'fear'], score: 91 },
      { sentence: 'I used to love bedtime. Now I dread it like a dentist appointment I can\'t cancel.', source_type: 'reddit', source_url: 'https://reddit.com/r/sleep', emotion_tags: ['fear', 'frustration'], score: 88 },
      { sentence: 'Every morning I wake up feeling like I ran a marathon in my sleep. This isn\'t living, it\'s surviving.', source_type: 'quora', source_url: 'https://quora.com', emotion_tags: ['exhaustion', 'desperation'], score: 86 },
    ],
  };
}

export function demoGate1(): AvatarRunResult {
  return {
    core_avatar: {
      surface_desire: 'I want to fall asleep fast and stay asleep all night without pills',
      niche: 'Natural sleep supplements',
      product: 'Slapen — dual-phase cortisol regulation sleep supplement',
      market: 'USA + Europe',
      language: 'English',
    },
    discovery_plan: {
      reddit: { subreddits: ['r/insomnia', 'r/sleep', 'r/anxiety', 'r/Supplements', 'r/biohacking'], queries: ['can\'t sleep racing thoughts', 'natural sleep aid that actually works'] },
      amazon: { product_queries: ['natural sleep supplement', 'ashwagandha sleep'], marketplace: 'amazon.com' },
      youtube: { video_queries: ['insomnia tips', 'sleep supplement review'] },
      tiktok: { hashtags: ['#insomnia', '#sleeptips'], search_queries: ['sleep supplement'] },
      quora: { queries: ['why can\'t I sleep even when tired', 'best natural sleep supplements'] },
      forums: { domains: ['forum.sleep.org', 'forum.biohacker.com'], queries: ['insomnia solutions'] },
      reviews: { sites: ['trustpilot.com'], queries: ['calm sleep', 'olly sleep', 'natrol melatonin'] },
      searchWide: { queries: ['insomnia help reddit', 'natural sleep supplement reviews'] },
      shopify: { store_urls: [], product_queries: ['sleep supplement'] },
      instagram: { hashtags: ['#insomnia', '#sleeptips'], search_queries: ['natural sleep help'] },
      facebook: { page_urls: [], search_queries: ['insomnia support group'] },
    },
    sub_avatars: demoSubAvatars(),
    comparative_table: [
      { sub_avatar_id: 'sa-1', nickname: 'racing-mind mom', tam: '12M+', urgency: 9, scope: 8, staying_power: 9, recommended: true },
      { sub_avatar_id: 'sa-2', nickname: 'burnout exec', tam: '8M+', urgency: 8, scope: 7, staying_power: 8, recommended: true },
      { sub_avatar_id: 'sa-3', nickname: '3am spiral', tam: '15M+', urgency: 9, scope: 9, staying_power: 7, recommended: false },
    ],
    final_recommendation: {
      first_to_test: 'sa-1',
      reason: 'The Exhausted Overthinker combines highest emotional intensity with massive TAM and under-exploited competitive angles.',
      strategy: 'Start with sa-1 (Overthinker) for emotional hook testing, then expand to sa-2 (Professional) for higher-ticket angles.',
    },
    metadata: {
      sources_used: ['reddit', 'quora', 'forums', 'youtube', 'searchWide'] as const,
      total_verbatims: 156,
      total_items_scraped: 847,
      run_duration_ms: 182000,
      cost_estimate_usd: 2.45,
      phase_timings: { discovery_ms: 12000, fetch_ms: 98000, analyze_ms: 45000, compile_ms: 27000 },
    },
    raw_signal: demoRawSignal(),
  };
}

// -------- Gate 2-9 + Brand DNA: output data --------

export function demoGateData(gateId: GateId): Record<string, unknown> {
  switch (gateId) {
    case 'gate2': return demoGate2();
    case 'gate3': return demoGate3();
    case 'gate4': return demoGate4();
    case 'gate5': return demoGate5();
    case 'gate6': return demoGate6();
    case 'gate7': return demoGate7();
    case 'gate8': return demoGate8();
    case 'gate9': return demoGate9();
    case 'brand-dna': return demoBrandDNA() as unknown as Record<string, unknown>;
    default: return {};
  }
}

function demoGate2(): Record<string, unknown> {
  return {
    avatar_deep_dive: {
      core_problems: ['Chronic inability to fall asleep due to racing thoughts', 'Morning exhaustion affecting work and relationships', 'Fear of dependency on sleep medication'],
      daily_struggles: ['Dreading bedtime every evening', '2+ hours lying awake', 'Brain fog during morning meetings', 'Irritability with family', 'Over-consuming caffeine to compensate'],
      emotional_impact: ['Feeling broken/defective', 'Jealousy toward easy sleepers', 'Shame about needing help', 'Hopelessness after failed solutions', 'Identity crisis: "I\'m just a bad sleeper"'],
      failed_solutions: ['Melatonin (groggy mornings)', 'Meditation apps (can\'t focus)', 'Sleep restriction therapy (too extreme)', 'CBD oil (inconsistent)', 'Weighted blanket (helps anxiety not sleep)'],
      trigger_moments: ['Sunday night before work week', 'After a stressful meeting', 'When partner falls asleep instantly', 'When someone says "just relax"'],
      core_desires: ['To fall asleep within 15 minutes', 'To wake up feeling refreshed', 'To stop dreading bedtime', 'To be present for family instead of zombified'],
    },
    desire_research: {
      surface_desires: ['Better sleep', 'More energy', 'Less grogginess'],
      middle_desires: ['To stop the racing thoughts', 'To feel like a normal sleeper', 'To perform at work without brain fog'],
      core_desires: ['To reclaim their identity — they used to be a great sleeper and want that person back', 'To stop feeling broken', 'To enjoy evenings again instead of dreading them'],
      big_4: {
        new_only: 'A cortisol-regulation approach nobody in their circle has tried',
        easy_anybody: 'Take 2 capsules 30 minutes before bed — no lifestyle changes needed',
        safe_predictable: 'Non-habit-forming, clinically studied ingredients, 60-day guarantee',
        big_fast: 'Feel the difference on night 1. Sleep score improvement within 7 days.',
      },
    },
    voice_profile: {
      vocabulary: ['exhausted', 'wired', 'racing', 'brain fog', 'zombie', 'broken', 'spiral', 'dread', 'groggy', 'desperate'],
      sentence_style: 'Short, punchy, frustrated bursts. Heavy use of em-dashes and ellipses. Self-deprecating humor.',
      formality_level: 3,
      emotional_tone: 'Frustrated-hopeful with dark humor undertones',
      phrases_to_use: ['my brain won\'t shut up', 'tired but wired', 'tried everything', 'finally', 'actually works', 'not just another'],
      phrases_to_avoid: ['sleep hygiene', 'just relax', 'have you tried', 'revolutionary', 'life-changing miracle'],
      sample_paragraph: 'Look, I\'ve tried everything. The apps, the teas, the breathing exercises, the stupid lavender pillow spray. Nothing stops the 2am thought tornado. I don\'t need another "tip" — I need something that actually works.',
    },
    customer_language_mining: [
      { category: 'micro_specific_moments', phrases: ['lying awake at 2am replaying an email I sent 3 days ago', 'watching my partner fall asleep in 30 seconds while I lie there fuming', 'that moment when you check the clock and it\'s 4:17am and your alarm is at 6'] },
      { category: 'internal_dialogue', phrases: ['just stop thinking just stop thinking just stop', 'if I fall asleep RIGHT NOW I\'ll get 4 hours', 'why am I like this? normal people just... sleep'] },
      { category: 'transformation_language', phrases: ['I actually woke up before my alarm', 'I forgot what it felt like to just... fall asleep', 'my husband said I seem like a different person'] },
    ],
    angle_candidates: [
      { angle: 'The cortisol clock is broken', ev: 9, ma: 8, ws: 9, total: 26 },
      { angle: 'Your brain isn\'t the problem — your hormones are', ev: 8, ma: 9, ws: 7, total: 24 },
      { angle: 'The insomnia identity trap', ev: 9, ma: 7, ws: 8, total: 24 },
    ],
    quote_bank: {
      pain: ['My brain just won\'t shut up', 'I\'m so tired but the second I hit the pillow my mind goes into overdrive', 'I dread bedtime more than Monday mornings'],
      desire: ['I just want to feel rested ONE morning', 'I want to be the person who falls asleep in 5 minutes', 'I want my old self back'],
      objection: ['Is it habit-forming?', 'Will I feel groggy?', 'How is this different from melatonin?', 'Another supplement that probably doesn\'t work'],
      transformation: ['I actually slept 7 hours straight for the first time in months', 'I forgot what it felt like to wake up refreshed', 'Night 3 was the turning point'],
    },
  };
}

function demoGate3(): Record<string, unknown> {
  return {
    root_cause: {
      mainstream_explanation: 'Poor sleep hygiene, too much screen time, stress',
      hidden_root_cause: 'Dysregulated cortisol rhythm — cortisol stays elevated past its natural sunset decline, preventing the cortisol-to-melatonin handoff that triggers sleep onset',
      one_sentence: 'Your body\'s cortisol clock is stuck on "daytime mode" even after sunset, blocking the natural sleep switch.',
      aha_moment: 'Melatonin supplements don\'t work because they\'re adding sleep signal on top of an active wake signal — it\'s like putting your foot on the brake AND the gas.',
      six_grade_explanation: 'Your body has a "wake hormone" (cortisol) and a "sleep hormone" (melatonin). They\'re supposed to take turns — cortisol during the day, melatonin at night. But when you\'re stressed, cortisol doesn\'t go away at night. It\'s like trying to sleep with the lights on inside your body.',
    },
    belief_error: {
      what_they_believe: 'I need more melatonin / I need to relax more / I have bad sleep hygiene',
      why_its_wrong: 'Adding melatonin to an elevated cortisol state is like whispering "sleep" while someone screams "WAKE UP" — the cortisol always wins',
      what_it_costs: 'Years of groggy mornings, wasted money on supplements that don\'t address the root cause, growing belief that they\'re "broken"',
      corrected_belief: 'You don\'t need MORE sleep signal — you need LESS wake signal. Fix the cortisol, and melatonin does its job naturally.',
      aha_sentence: 'You don\'t have a melatonin deficiency — you have a cortisol excess.',
    },
    mechanism: {
      name: 'Dual-Phase Cortisol Reset',
      tagline: 'Phase 1 calms. Phase 2 sustains.',
      positioning: 'The only sleep formula that addresses BOTH falling asleep AND staying asleep by regulating cortisol at two critical points in your sleep cycle.',
      three_steps: [
        { step: 1, name: 'Cortisol Calm', description: 'Phase 1 ingredients (Ashwagandha KSM-66 + L-Theanine) reduce cortisol by 23% within 30 minutes, opening the melatonin window.', ingredient: 'Ashwagandha KSM-66', timeframe: '20-30 minutes' },
        { step: 2, name: 'Sleep Switch', description: 'With cortisol lowered, your body\'s natural melatonin production kicks in — no synthetic melatonin needed.', ingredient: 'Natural melatonin response', timeframe: '30-45 minutes' },
        { step: 3, name: 'Sustained Shield', description: 'Phase 2 sustained-release Magnesium Glycinate + Apigenin prevents the 3am cortisol micro-spike that causes middle-of-night wake-ups.', ingredient: 'Magnesium Glycinate + Apigenin', timeframe: '6-8 hours' },
      ],
    },
    villains: {
      hidden_enemy: { name: 'Elevated Evening Cortisol', description: 'The invisible stress hormone that stays high when it should drop, blocking your body\'s natural sleep mechanism' },
      the_system: { name: 'The Melatonin Industry', description: 'A $1.8B industry selling you the wrong solution — adding sleep signal instead of removing the wake signal' },
      the_self_saboteur: { name: 'The Anxiety-Insomnia Loop', description: 'Worrying about not sleeping raises cortisol, which prevents sleep, which causes more worry — a self-reinforcing trap' },
    },
    ugc_talking_points: {
      root_cause_hooks: ['Did you know most sleep supplements completely ignore cortisol?', 'The reason melatonin doesn\'t work for you isn\'t because you need more...', 'Your body makes its own melatonin — IF cortisol gets out of the way'],
      mechanism_scripts: ['Here\'s what happens when you take Slapen: Phase 1 kicks in after 20 minutes...', 'It\'s like two bodyguards — one helps you fall asleep, one makes sure you STAY asleep'],
    },
  };
}

function demoGate4(): Record<string, unknown> {
  return {
    hook_matrix: {
      total_hooks: 42,
      top_20_hooks: [
        { id: 'h-1', hook: 'Your brain isn\'t broken — your cortisol clock is.', formula: 'Statement', reptilian_trigger: 'self-preservation', attention_level: 'Identity', first_3_lines: { hook: 'Your brain isn\'t broken — your cortisol clock is.', anchor: 'That racing mind at 2am? It\'s not anxiety. It\'s a hormone that forgot to turn off.', open_loop: 'And the fix takes exactly 20 minutes...' }, score: { reptilian: 9, hierarchy: 10, first_lines: 9, total: 28 } },
        { id: 'h-2', hook: 'I tried 14 sleep aids. Only one stopped the racing thoughts.', formula: 'Story', reptilian_trigger: 'curiosity', attention_level: 'Identity', first_3_lines: { hook: 'I tried 14 sleep aids. Only one stopped the racing thoughts.', anchor: 'Melatonin, CBD, magnesium, valerian, chamomile, GABA...', open_loop: 'But they were all solving the WRONG problem.' }, score: { reptilian: 8, hierarchy: 9, first_lines: 9, total: 26 } },
        { id: 'h-3', hook: 'Why do you wake up at 3am every single night?', formula: 'Question', reptilian_trigger: 'self-preservation', attention_level: 'Identity', first_3_lines: { hook: 'Why do you wake up at 3am every single night?', anchor: 'It\'s not random. It\'s not your bladder. It\'s not stress (well, not exactly).', open_loop: 'There\'s a specific hormone spike at 3am that your doctor never told you about.' }, score: { reptilian: 9, hierarchy: 10, first_lines: 8, total: 27 } },
        { id: 'h-4', hook: 'Melatonin is like whispering "sleep" while cortisol screams "WAKE UP"', formula: 'Contradiction', reptilian_trigger: 'curiosity', attention_level: 'Contrast', first_3_lines: { hook: 'Melatonin is like whispering "sleep" while cortisol screams "WAKE UP"', anchor: 'That\'s why 73% of melatonin users say it "stops working" after a few weeks.', open_loop: 'The solution isn\'t more melatonin — it\'s less of something else entirely.' }, score: { reptilian: 8, hierarchy: 8, first_lines: 9, total: 25 } },
        { id: 'h-5', hook: 'If you\'re reading this at 2am, your cortisol is doing exactly what I\'m about to explain.', formula: 'Curiosity', reptilian_trigger: 'curiosity', attention_level: 'Identity', first_3_lines: { hook: 'If you\'re reading this at 2am, your cortisol is doing exactly what I\'m about to explain.', anchor: 'Right now, your "wake hormone" is at 3x the level it should be.', open_loop: 'And there\'s a 30-second thing you can do about it tonight.' }, score: { reptilian: 7, hierarchy: 10, first_lines: 8, total: 25 } },
        { id: 'h-6', hook: 'You know you\'re an overthinker when bedtime feels like a punishment.', formula: 'Identity', reptilian_trigger: 'social_approval', attention_level: 'Identity', first_3_lines: { hook: 'You know you\'re an overthinker when bedtime feels like a punishment.', anchor: 'When you lie there replaying conversations from 2019...', open_loop: 'What if I told you the overthinking isn\'t a character flaw — it\'s a chemical imbalance with a simple fix?' }, score: { reptilian: 8, hierarchy: 10, first_lines: 8, total: 26 } },
        { id: 'h-7', hook: '73% of melatonin users quit within 90 days. Here\'s what they switch to.', formula: 'Statistic', reptilian_trigger: 'curiosity', attention_level: 'Specificity', first_3_lines: { hook: '73% of melatonin users quit within 90 days. Here\'s what they switch to.', anchor: 'The problem isn\'t that melatonin is bad. It\'s that it treats the symptom, not the cause.', open_loop: 'The cause? A hormone you\'ve probably never tested.' }, score: { reptilian: 7, hierarchy: 6, first_lines: 9, total: 22 } },
      ],
    },
    open_loops: ['And the fix takes exactly 20 minutes...', 'But they were all solving the WRONG problem.', 'A hormone you\'ve probably never tested.'],
    sensory_language: ['The clock glows 3:17am and your heart hammers against your ribs', 'That heavy, sand-behind-the-eyes exhaustion that coffee can\'t touch', 'The pillow feels like concrete when your mind is a hurricane'],
    future_pacing: ['Imagine waking up before your alarm, actually wanting to get out of bed', 'Picture telling your partner "I slept 8 hours straight" and meaning it', 'Think about how your mornings would change if brain fog just... disappeared'],
  };
}

function demoGate5(): Record<string, unknown> {
  return {
    advertorial: {
      archetype: 'Reluctant Hero',
      protagonist: 'Sarah, 34, marketing manager and mother of two',
      hook_sentence: 'I used to love bedtime. Then it became the worst part of my day.',
      story_block: 'For three years, I dreaded 10pm like most people dread Monday mornings. The moment my head hit the pillow, my brain turned into a courtroom — replaying every conversation, every email, every parenting decision I\'d made that day...',
      root_cause_block: 'My doctor said something that changed everything: "Sarah, you don\'t have a melatonin problem. You have a cortisol problem." It was like someone turned on the lights in a dark room...',
      mechanism_block: 'The Dual-Phase Cortisol Reset works in two stages. Phase 1 — the "Cortisol Calm" — uses KSM-66 Ashwagandha to lower cortisol by 23% in just 30 minutes...',
      emotional_arc: 'Desperation → Discovery → Hope → Skepticism → First win → Transformation',
    },
  };
}

function demoGate6(): Record<string, unknown> {
  return {
    ad_concepts: [
      { id: 'concept-1', name: 'The Cortisol Clock', target_sub_avatar_id: 'sa-1', angle: 'Your cortisol clock is broken', psychological_mechanism: 'Cognitive reframing — shifts blame from self to biology', emotional_territory: 'Relief + curiosity', hook_direction: '"Your brain isn\'t broken" identity reframe', visual_direction: 'Split screen: chaotic brain visual vs calm brain visual', body_copy_direction: 'Problem → root cause reveal → mechanism → CTA' },
      { id: 'concept-2', name: 'The 3AM Wake-Up', target_sub_avatar_id: 'sa-3', angle: 'The 3am cortisol spike', psychological_mechanism: 'Pattern recognition — names their exact experience', emotional_territory: 'Shock + validation', hook_direction: '"Why you always wake up at 3am" curiosity hook', visual_direction: 'Dark bedroom, clock showing 3:17am, person sitting up', body_copy_direction: 'Symptom naming → scientific explanation → mechanism → proof → CTA' },
      { id: 'concept-3', name: 'The Melatonin Trap', target_sub_avatar_id: 'sa-1', angle: 'Melatonin doesn\'t fix the real problem', psychological_mechanism: 'Belief disruption — challenges assumed solution', emotional_territory: 'Anger + vindication', hook_direction: '"Melatonin is lying to you" contradiction hook', visual_direction: 'Melatonin bottle with red X, cortisol graph overlay', body_copy_direction: 'Belief error → why it\'s wrong → what to do instead → proof → CTA' },
      { id: 'concept-4', name: 'The Performance Bottleneck', target_sub_avatar_id: 'sa-2', angle: 'Sleep is your last bottleneck', psychological_mechanism: 'Status threat — performance gap awareness', emotional_territory: 'Ambition + frustration', hook_direction: '"The $500/month stack missing one ingredient" specificity hook', visual_direction: 'Oura ring showing poor sleep score, supplement stack in background', body_copy_direction: 'Biohacker angle → what they\'re missing → data → mechanism → CTA' },
      { id: 'concept-5', name: 'Night 3 Transformation', target_sub_avatar_id: 'sa-1', angle: 'Transformation story — first week results', psychological_mechanism: 'Narrative transportation + social proof', emotional_territory: 'Hope + belonging', hook_direction: '"Night 3 was the turning point" story hook', visual_direction: 'UGC-style, woman talking to camera, cozy bedroom background', body_copy_direction: 'Personal story → skepticism → trying it → results → invitation to join' },
    ],
    headlines: [
      { id: 'hl-1', primary: 'Your brain isn\'t broken.', secondary: 'Your cortisol clock is.', benefit_led: 'Fall asleep in 20 minutes — naturally.', curiosity_led: 'The hormone nobody tests that controls your sleep.' },
      { id: 'hl-2', primary: 'Still awake at 2am?', secondary: 'There\'s a reason — and it\'s not what you think.', benefit_led: 'Sleep through the night, every night.', curiosity_led: 'Why melatonin stops working after 3 weeks.' },
      { id: 'hl-3', primary: 'Night 3 changed everything.', secondary: 'A skeptic\'s honest review.', benefit_led: 'Wake up actually feeling rested.', curiosity_led: 'What 14 sleep aids couldn\'t do, this one ingredient did.' },
    ],
    body_copies: [
      { id: 'bc-1', concept: 'concept-1', primary_text: 'I spent 3 years believing I was just "a bad sleeper." Turns out, my cortisol was stuck on daytime mode — even at midnight. The Dual-Phase Cortisol Reset changed everything. Phase 1 calmed my racing mind in 20 minutes. Phase 2 kept me asleep until morning. No grogginess. No dependency. Just... sleep. The way it\'s supposed to be.\n\nTry Slapen risk-free for 60 nights.', word_count: 67 },
      { id: 'bc-2', concept: 'concept-2', primary_text: 'Your 3am wake-up isn\'t random.\n\nIt\'s a cortisol micro-spike — your stress hormone crossing the "wake threshold" mid-sleep. Most sleep supplements ignore this entirely. They help you FALL asleep but can\'t keep you there.\n\nSlapen\'s Phase 2 formula creates a cortisol ceiling that prevents the spike. You sleep through. All night. Every night.\n\n60-night guarantee. If you wake up at 3am, we pay.', word_count: 72 },
    ],
    video_scripts: [
      { id: 'vs-1', concept: 'concept-5', hook: '[Looking exhausted, messy bun, morning light] "Okay so I have to talk about what happened on night 3..."', duration: '45-60s', format: 'UGC talking head' },
    ],
  };
}

function demoGate7(): Record<string, unknown> {
  return {
    static_ad_studio: {
      metadata: { total_presets: 8, total_briefs: 24, awareness_level: 'problem_aware', sub_avatar: 'sa-1', generated_at: new Date().toISOString() },
      presets: {
        before_after: {
          preset_name: 'Before / After', preset_icon: '🔄', quality: 'high',
          briefs: [
            { id: 'ba-1', name: 'Racing Mind → Peaceful Sleep', headline_options: { A: { text: 'Before: 2am thought spiral', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } }, B: { text: 'From wired to rested', score: { curiosity: 6, clarity: 10, punch: 7, total: 23 } }, C: { text: 'Same bed. Different brain.', score: { curiosity: 9, clarity: 8, punch: 9, total: 26 } } }, recommended_headline: 'C', subheadline: 'What cortisol regulation feels like', cta_text: 'Try Slapen Tonight', body_text: 'Left: 2am, eyes open, mind racing. Right: 7am, alarm goes off, feeling human.', visual_direction: { scene_description: 'Split-screen image. Left side: dark, moody bedroom scene — woman lying awake, eyes open, phone showing 2:17am, blue light on her face, messy sheets, sense of frustration. Color palette is cold blues and grays. Right side: same bedroom, morning golden light streaming through curtains, woman stretching with a peaceful smile, alarm clock showing 6:58am, warm tones. The visual metaphor is night-to-morning transformation through cortisol regulation.', mood: 'Left: anxiety/frustration → Right: peace/relief', lighting: 'Left: cold blue phone glow. Right: warm golden morning light', color_palette: ['#1a2744', '#3d5a80', '#f4a261', '#e9c46a', '#2a9d8f'], composition: 'Perfect 50/50 split with subtle diagonal divider', focal_point: 'The woman\'s expression in each half — pain vs peace', style: 'photographic', camera_angle: 'eye-level, intimate framing' }, ai_generation_prompt: 'Split-screen bedroom scene divided diagonally. Left half: dark moody bedroom at night, woman lying in bed awake with eyes open, cold blue lighting from phone screen showing 2:17am, messy tangled sheets, expression of frustration and exhaustion, desaturated cool blue-gray color palette. Right half: same bedroom in morning, warm golden sunlight streaming through sheer curtains, same woman stretching peacefully with gentle smile, alarm clock showing 6:58am, warm amber and gold tones, neat comfortable bedding. Photographic style, intimate eye-level framing, soft focus background, high quality editorial photography.', negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy, extra limbs, ugly, duplicate', layout: { headline_position: 'overlay', text_alignment: 'center', text_background: 'gradient', headline_size: 'xlarge', max_text_coverage_pct: 20 }, emotional_intent: 'Transformation contrast — from suffering to relief', why_it_works: 'Identity recognition on the left (that\'s me), aspiration on the right (that could be me)', awareness_fit: 'Problem aware: they recognize the before state, the after gives them hope without naming the product too early' },
            { id: 'ba-2', name: 'Zombie Mode → Full Power', headline_options: { A: { text: 'Running on 40% battery?', score: { curiosity: 8, clarity: 9, punch: 7, total: 24 } }, B: { text: 'Same you. Fully charged.', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } }, C: { text: 'What 8 hours feels like.', score: { curiosity: 8, clarity: 10, punch: 8, total: 26 } } }, recommended_headline: 'C', subheadline: 'Night 7 vs Night 1', cta_text: 'Sleep Better Tonight', visual_direction: { scene_description: 'Before: exhausted person at desk, head in hands, coffee cups everywhere, gray office lighting. After: same person energized, standing, bright natural light, clean desk, confident posture.', mood: 'Defeat → Victory', lighting: 'Left: harsh fluorescent. Right: bright natural', color_palette: ['#6b7280', '#9ca3af', '#10b981', '#34d399', '#fbbf24'], style: 'photographic', camera_angle: 'medium shot' }, ai_generation_prompt: 'Split image office scene. Left: exhausted professional at desk, head resting on hand, multiple empty coffee cups, harsh fluorescent overhead lighting, gray desaturated tones, slumped posture, dark circles visible, cluttered desk with papers. Right: same person standing confidently at same desk, bright natural window light, warm tones, clean organized desk, energized expression, good posture, single water bottle instead of coffees. Professional editorial photography, medium shot, shallow depth of field.', negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy', layout: { headline_position: 'bottom', text_alignment: 'center', text_background: 'solid', headline_size: 'large', max_text_coverage_pct: 25 }, emotional_intent: 'Performance transformation', why_it_works: 'Shows the tangible daily-life impact of sleep improvement — not abstract, but real', awareness_fit: 'Problem aware: shows the cost of their current state and what fixing it looks like' },
            { id: 'ba-3', name: 'Dread → Delight', headline_options: { A: { text: 'Remember loving bedtime?', score: { curiosity: 8, clarity: 9, punch: 9, total: 26 } }, B: { text: 'Bedtime used to be torture.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: 'From dreading to craving sleep.', score: { curiosity: 7, clarity: 8, punch: 8, total: 23 } } }, recommended_headline: 'A', subheadline: 'You will again.', cta_text: 'Reclaim Your Nights', visual_direction: { scene_description: 'Before: person sitting on edge of bed looking anxious, dark room, hands gripping sheets. After: person snuggled in bed with content expression, warm lamplight, cozy atmosphere.', mood: 'Anxiety → Comfort', lighting: 'Left: stark shadows. Right: warm lamp glow', color_palette: ['#1f2937', '#4b5563', '#fde68a', '#f59e0b', '#7c3aed'], style: 'photographic', camera_angle: 'close-up emotional' }, ai_generation_prompt: 'Split bedroom scene. Left: person sitting on edge of bed in dark room, hunched posture, hands gripping mattress edge, anxious expression, harsh shadows, cold blue-gray tones, feeling of dread and isolation. Right: same person lying comfortably in bed, warm amber lamplight, content peaceful expression, soft cozy blankets, warm inviting color palette, relaxed body language, pillows arranged comfortably. Emotional close-up photography, cinematic lighting, high quality.', negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy', layout: { headline_position: 'top', text_alignment: 'center', text_background: 'blur', headline_size: 'xlarge', max_text_coverage_pct: 20 }, emotional_intent: 'Nostalgia + restoration — remembering when sleep was easy', why_it_works: 'Taps into loss aversion — they HAD good sleep and lost it, which is more motivating than never having had it', awareness_fit: 'Problem aware: names the emotion (dread) they feel but might not have articulated' },
          ],
        },
        problem_agitation: {
          preset_name: 'Problem / Agitation', preset_icon: '⚡', quality: 'high',
          briefs: [
            { id: 'pa-1', name: 'The 2AM Ceiling Stare', headline_options: { A: { text: 'Still awake. Again.', score: { curiosity: 6, clarity: 10, punch: 9, total: 25 } }, B: { text: 'Your ceiling knows you too well.', score: { curiosity: 8, clarity: 8, punch: 9, total: 25 } }, C: { text: 'How many hours lost this week?', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } } }, recommended_headline: 'B', visual_direction: { scene_description: 'Extreme close-up of wide-open eyes in the dark, clock reflection showing 2:47am in the iris, moody dark blue tones', mood: 'Desperation, isolation', lighting: 'Minimal — faint clock glow only', color_palette: ['#0f172a', '#1e3a5f', '#94a3b8'], style: 'photographic', camera_angle: 'extreme close-up' }, ai_generation_prompt: 'Extreme close-up of a person\'s wide open eyes in near darkness, faint blue glow reflecting in their irises suggesting a clock display, dark navy and slate blue color palette, expression of exhaustion and frustration, visible dark circles, crisp detail on eyelashes and iris, cinematic moody lighting, editorial photography style, shallow depth of field, dramatic noir atmosphere.', negative_prompt: 'text, watermark, logo, blurry, deformed, bright lighting, happy expression', layout: { headline_position: 'bottom', text_alignment: 'center', text_background: 'gradient', headline_size: 'xlarge', max_text_coverage_pct: 20 }, emotional_intent: 'Visceral recognition — this is EXACTLY what their night looks like', why_it_works: 'Mirror neuron activation — seeing their own experience reflected stops the scroll instantly' },
            { id: 'pa-2', name: 'The Thought Tornado', headline_options: { A: { text: 'Your brain at 2am:', score: { curiosity: 8, clarity: 9, punch: 7, total: 24 } }, B: { text: 'When your mind won\'t shut up.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: 'Tired. Wired. Repeat.', score: { curiosity: 6, clarity: 10, punch: 9, total: 25 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Abstract visualization of chaos inside a silhouetted head — swirling thoughts, words, clocks, emails — dark moody background', mood: 'Mental chaos, overwhelm', color_palette: ['#1a1a2e', '#e94560', '#16213e', '#533483'], style: 'mixed media' }, ai_generation_prompt: 'Dark artistic portrait of a silhouetted human head in profile against deep navy background, inside the head a chaotic swirl of abstract elements representing racing thoughts — scattered clock faces, swirling lines, fragmented geometric shapes, warm red and purple energy, sense of mental chaos and overwhelm, surreal mixed media style, high contrast, moody atmospheric lighting, conceptual art photography.', negative_prompt: 'text, watermark, logo, blurry, cheerful, bright, realistic brain anatomy', layout: { headline_position: 'center', text_alignment: 'center', text_background: 'none', headline_size: 'xlarge', max_text_coverage_pct: 15 }, emotional_intent: 'Externalize the internal chaos — make the invisible visible', why_it_works: 'Gives visual form to an internal experience — "YES that\'s exactly what it feels like"' },
            { id: 'pa-3', name: 'The Exhaustion Tax', headline_options: { A: { text: 'Bad sleep costs you everything.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, B: { text: 'Running on empty isn\'t brave.', score: { curiosity: 7, clarity: 8, punch: 9, total: 24 } }, C: { text: 'You\'re not tired. You\'re depleted.', score: { curiosity: 8, clarity: 9, punch: 9, total: 26 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Person staring at empty coffee cup, morning light, bags under eyes, blurred world around them', mood: 'Depletion, heaviness', color_palette: ['#374151', '#6b7280', '#d1d5db'], style: 'photographic' }, ai_generation_prompt: 'Close-up portrait of exhausted person staring into empty coffee cup on desk, visible dark circles under eyes, morning light from window creating long shadows, desaturated muted color palette, everything slightly out of focus except the person\'s tired expression, sense of heaviness and depletion, professional editorial photography, shallow depth of field, melancholic mood.', negative_prompt: 'text, watermark, logo, blurry, happy, energetic, bright colors', layout: { headline_position: 'overlay', text_alignment: 'left', text_background: 'gradient', headline_size: 'large', max_text_coverage_pct: 25 }, emotional_intent: 'Reframe exhaustion as a cost, not a badge of honor', why_it_works: 'Challenges the "I\'m fine, just tired" narrative and makes them face the real cost' },
          ],
        },
        social_proof: {
          preset_name: 'Social Proof / Testimonial', preset_icon: '⭐', quality: 'high',
          briefs: [
            { id: 'sp-1', name: 'Night 3 Turning Point', headline_options: { A: { text: '"Night 3 changed everything."', score: { curiosity: 9, clarity: 8, punch: 9, total: 26 } }, B: { text: '"I actually slept 8 hours."', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: '"My husband noticed first."', score: { curiosity: 9, clarity: 7, punch: 8, total: 24 } } }, recommended_headline: 'A', subheadline: '4.8/5 from 2,847 reviews', cta_text: 'Read More Reviews', visual_direction: { scene_description: 'Quote card design: large quotation marks, review stars, warm background, testimonial text', mood: 'Trust, warmth', color_palette: ['#fef3c7', '#f59e0b', '#92400e', '#ffffff'], style: 'graphic design' }, ai_generation_prompt: 'Warm, inviting background with soft golden gradient, abstract soft bokeh light effects suggesting morning warmth and comfort, subtle texture, clean space for text overlay, warm amber and cream tones, gentle lens flare, premium editorial feel, minimalist design aesthetic, high quality.', negative_prompt: 'text, watermark, logo, blurry, dark, cold tones, busy background', layout: { headline_position: 'center', text_alignment: 'center', text_background: 'solid', headline_size: 'xlarge', max_text_coverage_pct: 40 }, emotional_intent: 'Trust through real customer voice — "someone like me tried it and it worked"', why_it_works: 'Social proof combined with specificity ("night 3") makes the claim believable and creates timeline expectation' },
            { id: 'sp-2', name: 'Before/After Testimonial', headline_options: { A: { text: '"I was a zombie. Now I\'m me."', score: { curiosity: 8, clarity: 9, punch: 9, total: 26 } }, B: { text: '"From dreading to craving bedtime."', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } }, C: { text: '"14 supplements failed. This didn\'t."', score: { curiosity: 9, clarity: 8, punch: 9, total: 26 } } }, recommended_headline: 'A', visual_direction: { scene_description: 'UGC-style photo of a real-looking woman smiling confidently, morning light, holding coffee, relaxed posture', mood: 'Authentic, relatable', color_palette: ['#f5f5f4', '#78716c', '#0d9488', '#f97316'], style: 'photographic' }, ai_generation_prompt: 'Natural lifestyle photo of a woman in her mid-30s sitting at kitchen counter in morning light, holding warm beverage, genuine relaxed smile, well-rested appearance, casual comfortable clothing, bright airy kitchen background, warm natural lighting through windows, authentic UGC aesthetic, not overly styled or posed, candid feel, soft warm color grading.', negative_prompt: 'text, watermark, logo, blurry, overly styled, model-like, stock photo feel, heavy makeup', layout: { headline_position: 'bottom', text_alignment: 'left', text_background: 'solid', headline_size: 'large', max_text_coverage_pct: 30 }, emotional_intent: 'Authentic transformation — "she looks like me but rested"', why_it_works: 'UGC aesthetic bypasses ad blindness; real person creates parasocial trust' },
            { id: 'sp-3', name: 'Data-Driven Proof', headline_options: { A: { text: '2,847 five-star nights.', score: { curiosity: 7, clarity: 9, punch: 7, total: 23 } }, B: { text: '94% sleep through the night.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: 'Rated #1 by overthinkers.', score: { curiosity: 8, clarity: 9, punch: 9, total: 26 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Clean infographic style with large number, star rating, minimal design', mood: 'Authority, confidence', color_palette: ['#1e293b', '#f8fafc', '#0ea5e9', '#f59e0b'], style: '3D' }, ai_generation_prompt: 'Clean minimal premium background with deep navy blue gradient, subtle geometric shapes suggesting data and precision, golden accent elements, professional and trustworthy aesthetic, abstract 3D elements floating softly, premium product photography feel, high-end brand visual, sharp clean lines.', negative_prompt: 'text, watermark, logo, blurry, busy, cluttered, cheap-looking', layout: { headline_position: 'center', text_alignment: 'center', text_background: 'solid', headline_size: 'xlarge', max_text_coverage_pct: 35 }, emotional_intent: 'Volume-based trust — if thousands of people use it, it must work', why_it_works: 'Large numbers create social proof cascade; "overthinkers" identity label creates self-selection' },
          ],
        },
        us_vs_them: {
          preset_name: 'Us vs Them', preset_icon: '⚔️', quality: 'high',
          briefs: [
            { id: 'uvt-1', name: 'Melatonin vs Cortisol Reset', headline_options: { A: { text: 'Melatonin treats symptoms. We fix causes.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, B: { text: 'Old way vs. new science.', score: { curiosity: 7, clarity: 9, punch: 7, total: 23 } }, C: { text: 'Stop adding sleep. Start removing wake.', score: { curiosity: 9, clarity: 7, punch: 9, total: 25 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Two-column comparison. Left: melatonin bottle with faded red X overlay. Right: Slapen with vibrant green checkmark. Clear visual hierarchy.', mood: 'Clarity, conviction', color_palette: ['#ef4444', '#6b7280', '#10b981', '#1e293b'], style: 'graphic design' }, ai_generation_prompt: 'Clean two-column comparison layout background, left side in muted gray-red desaturated tones suggesting the old failed approach, right side in vibrant green-teal tones suggesting the new solution, subtle dividing line in center, professional product photography lighting, premium brand aesthetic, clean minimal background, editorial quality.', negative_prompt: 'text, watermark, logo, blurry, cluttered, busy', layout: { headline_position: 'top', text_alignment: 'center', text_background: 'solid', headline_size: 'large', max_text_coverage_pct: 30 }, emotional_intent: 'Differentiation through mechanism superiority', why_it_works: 'Positions existing solution as outdated, making prospect feel smart for discovering the alternative' },
          ],
        },
        feature_highlight: {
          preset_name: 'Feature Highlight', preset_icon: '✨', quality: 'dynamic',
          briefs: [
            { id: 'fh-1', name: 'Dual-Phase Mechanism', headline_options: { A: { text: 'Phase 1 calms. Phase 2 sustains.', score: { curiosity: 8, clarity: 10, punch: 7, total: 25 } }, B: { text: '2 phases. 8 hours. Zero grogginess.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: 'The 2-step cortisol reset.', score: { curiosity: 8, clarity: 9, punch: 7, total: 24 } } }, recommended_headline: 'B', subheadline: 'Dual-Phase Cortisol Reset Technology', cta_text: 'See How It Works', visual_direction: { scene_description: 'Clean product hero shot with two-phase visual — capsule split showing two colors, numbered steps floating around it, scientific/premium aesthetic', mood: 'Scientific clarity, premium', lighting: 'Studio, soft diffused', color_palette: ['#f8fafc', '#0d9488', '#6366f1', '#1e293b'], style: 'photographic' }, ai_generation_prompt: 'Premium product photography of a sophisticated supplement capsule on clean white surface, capsule showing two distinct colors (teal and indigo) representing two phases, soft studio lighting with gentle shadows, clean minimal background, scientific premium aesthetic, subtle floating molecular structure elements in background, high-end cosmetic photography style, sharp focus on product, soft bokeh background.', negative_prompt: 'text, watermark, logo, blurry, cheap, cluttered, pharmacy aesthetic', layout: { headline_position: 'bottom', text_alignment: 'center', text_background: 'solid', headline_size: 'large', max_text_coverage_pct: 25 }, emotional_intent: 'Scientific confidence — this isn\'t random, it\'s engineered', why_it_works: 'Two-phase concept is simple to understand and creates perception of sophistication over single-ingredient competitors' },
          ],
        },
        lifestyle_context: {
          preset_name: 'Lifestyle / Product in Context', preset_icon: '🌿', quality: 'high',
          briefs: [
            { id: 'lc-1', name: 'Peaceful Evening Ritual', headline_options: { A: { text: 'This is what calm feels like.', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } }, B: { text: 'Bedtime, reimagined.', score: { curiosity: 8, clarity: 8, punch: 7, total: 23 } }, C: { text: 'Your new favorite part of the day.', score: { curiosity: 7, clarity: 9, punch: 8, total: 24 } } }, recommended_headline: 'A', visual_direction: { scene_description: 'Cozy nightstand scene: Slapen bottle, warm lamp, book, soft blanket texture, evening light', mood: 'Warmth, ritual, self-care', lighting: 'Warm amber lamp glow', color_palette: ['#fef3c7', '#92400e', '#78350f', '#fafaf9'], style: 'photographic', camera_angle: 'overhead flat-lay' }, ai_generation_prompt: 'Overhead flat-lay photo of a cozy nightstand scene, warm ambient lamp lighting, small elegant supplement bottle, open book with reading glasses, ceramic mug, soft knit blanket edge visible, wooden nightstand surface, warm amber and cream color palette, cozy self-care ritual aesthetic, lifestyle editorial photography, shallow depth of field on edges, golden hour warmth.', negative_prompt: 'text, watermark, logo, blurry, cold tones, clinical, pharmacy', layout: { headline_position: 'top', text_alignment: 'left', text_background: 'blur', headline_size: 'medium', max_text_coverage_pct: 15 }, emotional_intent: 'Aspiration — bedtime as a ritual you LOOK FORWARD to', why_it_works: 'Product placed naturally in aspirational context triggers desire without hard selling' },
          ],
        },
        statistique_data: {
          preset_name: 'Statistique / Data Visual', preset_icon: '📊', quality: 'high',
          briefs: [
            { id: 'sd-1', name: 'The Cortisol Gap', headline_options: { A: { text: '23% less cortisol in 30 min.', score: { curiosity: 7, clarity: 10, punch: 7, total: 24 } }, B: { text: '94% sleep through the night.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } }, C: { text: 'Night 1: 47 min faster sleep.', score: { curiosity: 8, clarity: 10, punch: 8, total: 26 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Clean data visualization — cortisol curve graph showing the drop after Slapen, before/after comparison, minimal clean design', mood: 'Authority, proof', color_palette: ['#1e293b', '#f8fafc', '#0ea5e9', '#10b981'], style: '3D' }, ai_generation_prompt: 'Clean minimal dark background with abstract data visualization elements, subtle glowing graph lines in teal and blue, scientific premium aesthetic, floating 3D geometric elements suggesting data and precision, dark navy gradient background, modern infographic feel without actual text or numbers, futuristic clean design.', negative_prompt: 'text, watermark, logo, blurry, cluttered, cheap, busy', layout: { headline_position: 'center', text_alignment: 'center', text_background: 'solid', headline_size: 'xlarge', max_text_coverage_pct: 35 }, emotional_intent: 'Data-backed authority — skeptics respond to numbers', why_it_works: 'Specific numbers (47 min, not "faster sleep") create credibility and measurable expectation' },
          ],
        },
        unboxing_product: {
          preset_name: 'Unboxing / Product Shot', preset_icon: '📦', quality: 'dynamic',
          briefs: [
            { id: 'up-1', name: 'Premium Unboxing', headline_options: { A: { text: 'Your best sleep, delivered.', score: { curiosity: 7, clarity: 9, punch: 7, total: 23 } }, B: { text: '60 nights of deep sleep inside.', score: { curiosity: 8, clarity: 9, punch: 8, total: 25 } }, C: { text: 'Open. Take 2. Sleep 8.', score: { curiosity: 7, clarity: 10, punch: 8, total: 25 } } }, recommended_headline: 'C', visual_direction: { scene_description: 'Premium product shot: bottle emerging from elegant packaging, capsules scattered artfully, clean background with brand color accents', mood: 'Premium, desire, tactile', lighting: 'Studio, soft directional', color_palette: ['#0d9488', '#1e293b', '#f8fafc', '#d4d4d8'], style: 'photographic' }, ai_generation_prompt: 'Premium product photography of an elegant supplement bottle with minimalist design, bottle emerging from premium matte black packaging box, a few capsules scattered artfully on clean white surface, soft directional studio lighting creating elegant shadows, teal and dark navy brand colors, high-end beauty product aesthetic, sharp focus on product details, clean white marble surface, premium branding feel.', negative_prompt: 'text, watermark, logo, blurry, cheap packaging, pharmacy aesthetic, cluttered', layout: { headline_position: 'bottom', text_alignment: 'center', text_background: 'gradient', headline_size: 'large', max_text_coverage_pct: 20 }, emotional_intent: 'Tactile desire — makes them want to hold it', why_it_works: 'Premium packaging photography signals quality and justifies price point' },
          ],
        },
      },
      rankings: {
        top_5_briefs: [
          { brief_id: 'ba-1', preset: 'before_after', headline: 'Same bed. Different brain.', predicted_ctr_rank: 1, reason: 'Strongest identity hook + visual contrast' },
          { brief_id: 'pa-1', preset: 'problem_agitation', headline: 'Your ceiling knows you too well.', predicted_ctr_rank: 2, reason: 'Visceral recognition — instant scroll-stop' },
          { brief_id: 'sp-1', preset: 'social_proof', headline: 'Night 3 changed everything.', predicted_ctr_rank: 3, reason: 'Specificity + social proof = believable' },
          { brief_id: 'pa-3', preset: 'problem_agitation', headline: 'You\'re not tired. You\'re depleted.', predicted_ctr_rank: 4, reason: 'Reframes their self-narrative powerfully' },
          { brief_id: 'uvt-1', preset: 'us_vs_them', headline: 'Stop adding sleep. Start removing wake.', predicted_ctr_rank: 5, reason: 'Mechanism differentiation in 7 words' },
        ],
        best_per_preset: { before_after: 'ba-1', problem_agitation: 'pa-1', social_proof: 'sp-1', us_vs_them: 'uvt-1', feature_highlight: 'fh-1', lifestyle_context: 'lc-1', statistique_data: 'sd-1', unboxing_product: 'up-1' },
      },
      creative_director_notes: {
        variety_assessment: 'Strong variety across emotional territories. Before/After and Problem/Agitation cover the pain spectrum, Social Proof and Feature Highlight cover the trust spectrum, Us vs Them differentiates.',
        awareness_consistency: 'All briefs calibrated for Problem Aware — no awareness drift detected. Copy leads with pain recognition, not product features.',
        emotional_coverage: ['frustration', 'desperation', 'hope', 'trust', 'ambition', 'relief', 'curiosity', 'identity-recognition'],
        missing_angles: 'Could add a humor-based preset — self-deprecating insomnia humor performs well on Meta.',
        testing_priority: ['before_after', 'problem_agitation', 'social_proof', 'feature_highlight', 'us_vs_them', 'statistique_data', 'lifestyle_context', 'unboxing_product'],
      },
    },
  };
}

function demoGate8(): Record<string, unknown> {
  return {
    generation_batch: {
      metadata: { total_configs: 36, total_images: 72, awareness_level: 'problem_aware', sub_avatar: 'The Exhausted Overthinker', generated_at: new Date().toISOString() },
      configs: [
        { id: 'gen_ba-1_feed', source_preset: 'before_after', source_brief_id: 'ba-1', brief_name: 'Racing Mind → Peaceful Sleep', format: 'feed_1x1', model: 'fal-ai/flux-pro/v1.1', prompt: 'Split-screen bedroom scene divided diagonally. Left half: dark moody bedroom at night, woman lying awake with eyes open, cold blue lighting, 2am atmosphere. Right half: same bedroom bathed in warm golden morning light, woman stretching peacefully. Photographic style, intimate framing, editorial quality.', negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy, extra limbs', width: 1080, height: 1080, guidance_scale: 7.5, num_images: 2, seed: null, text_overlays: { headline: 'Same bed. Different brain.', subheadline: 'What cortisol regulation feels like', cta: 'Try Slapen Tonight' }, vision_review_prompt: 'Check: 1) Clear split-screen with distinct before/after states? 2) Emotional contrast visible? 3) Brand colors present? 4) Would stop the scroll? Score 1-10.' },
        { id: 'gen_ba-1_story', source_preset: 'before_after', source_brief_id: 'ba-1', brief_name: 'Racing Mind → Peaceful Sleep', format: 'story_9x16', model: 'fal-ai/flux-pro/v1.1', prompt: 'Vertical split-screen bedroom scene. Top half: dark moody nighttime, woman awake in bed, cold blue tones, 2am feeling. Bottom half: warm golden morning, same woman stretching peacefully. Vertical composition optimized for 9:16 format.', negative_prompt: 'text, watermark, logo, blurry, deformed', width: 1080, height: 1920, guidance_scale: 7.5, num_images: 2, seed: null },
        { id: 'gen_pa-1_feed', source_preset: 'problem_agitation', source_brief_id: 'pa-1', brief_name: 'The 2AM Ceiling Stare', format: 'feed_1x1', model: 'fal-ai/flux-pro/v1.1', prompt: 'Extreme close-up of wide open eyes in near darkness, faint blue clock glow reflecting in irises, dark navy tones, expression of exhaustion, cinematic noir lighting.', negative_prompt: 'text, watermark, logo, blurry, bright, happy', width: 1080, height: 1080, guidance_scale: 7.5, num_images: 2, seed: null },
      ],
      post_processing: {
        text_overlay_tool: 'Text overlays added via Figma/Canva — fal.ai does NOT render text reliably',
        quality_checks: ['Resolution >= 1080px', 'No AI artifacts', 'Brand colors present', 'Clear focal point', 'Mobile-friendly at thumbnail size'],
      },
      testing_plan: {
        phase_1_presets: ['before_after', 'problem_agitation', 'social_proof'],
        phase_1_headlines: { before_after: 'C (Same bed. Different brain.)', problem_agitation: 'B (Your ceiling knows you too well.)', social_proof: 'A (Night 3 changed everything.)' },
        phase_2_expansion: 'After finding winner, expand to Feature Highlight and Us vs Them',
        budget_split: '40% Before/After, 35% Problem/Agitation, 25% Social Proof',
      },
    },
  };
}

function demoGate9(): Record<string, unknown> {
  return {
    campaign_blueprint: {
      campaigns: [
        { name: 'SLAPEN_Overthinker_CBO', sub_avatar_id: 'sa-1', objective: 'Conversions', budget: '$100/day', ad_sets: [
          { name: 'SLAPEN_Overthinker_BA_Broad', targeting: 'Broad — Women 28-45, interest: sleep, wellness', ads: ['ba-1 (feed)', 'ba-1 (story)', 'ba-3 (feed)'] },
          { name: 'SLAPEN_Overthinker_PA_Broad', targeting: 'Broad — Women 28-45', ads: ['pa-1 (feed)', 'pa-2 (feed)', 'pa-3 (feed)'] },
          { name: 'SLAPEN_Overthinker_SP_Broad', targeting: 'Broad — All adults 25-55', ads: ['sp-1 (feed)', 'sp-2 (feed)'] },
        ]},
        { name: 'SLAPEN_Professional_CBO', sub_avatar_id: 'sa-2', objective: 'Conversions', budget: '$75/day', ad_sets: [
          { name: 'SLAPEN_Professional_FH_Biohacker', targeting: 'Interest: biohacking, Oura ring, supplements, nootropics', ads: ['fh-1 (feed)', 'sd-1 (feed)'] },
        ]},
      ],
      testing_strategy: {
        phase_1: 'Creative testing — 3 presets × 3 headline variants × 2 formats = 18 ad variations. Run for 7 days, $50/day per CBO.',
        phase_2: 'Winner scaling — top 3 performing ads get dedicated CBO, budget 3x.',
        success_metrics: { target_cpa: '$35', target_roas: '2.5x', minimum_conversions_per_week: 50 },
      },
      naming_conventions: {
        campaign: 'BRAND_SubAvatar_CBO',
        ad_set: 'BRAND_SubAvatar_Preset_Targeting',
        ad: 'BRAND_Preset_BriefID_Format_HeadlineVariant',
      },
      scaling_playbook: {
        rules: ['Wait for 50+ conversions before judging', 'Scale winning ad sets by 20% every 3 days', 'Kill underperformers at 2x target CPA', 'Expand to lookalikes after finding 3+ winning creatives'],
      },
    },
  };
}

export function demoBrandDNA(): BrandDNA {
  return {
    version: '1.0',
    locked: true,
    product_name: 'Slapen',
    brand_name: 'Slapen',
    target_market: 'USA + Europe',
    target_language: 'English',
    locked_terms: {
      mechanism_name: 'Dual-Phase Cortisol Reset',
      root_cause_one_sentence: 'Your cortisol clock is stuck on daytime mode, blocking the natural cortisol-to-melatonin handoff.',
      belief_error: 'You don\'t have a melatonin deficiency — you have a cortisol excess.',
      mechanism_3_steps: [
        { step: 1, name: 'Cortisol Calm', description: 'KSM-66 Ashwagandha + L-Theanine reduce cortisol by 23% in 30 minutes' },
        { step: 2, name: 'Sleep Switch', description: 'Natural melatonin production activates once cortisol drops below threshold' },
        { step: 3, name: 'Sustained Shield', description: 'Sustained-release Magnesium Glycinate + Apigenin prevents 3am cortisol spike' },
      ],
      product_descriptor: 'dual-phase cortisol regulation sleep formula',
      key_proof_points: ['23% cortisol reduction in 30 minutes (KSM-66 study)', '94% of users sleep through the night by day 7', '4.8/5 average from 2,847 reviews', 'Non-habit-forming — 100% natural ingredients'],
      guarantee_wording: '60-night risk-free guarantee. Sleep better or get a full refund. No questions asked.',
    },
    customer_language: {
      pain_quotes: [
        { quote: 'My brain just won\'t shut up', source: 'Reddit r/insomnia', emotion: 'frustration', sub_avatar_id: 'sa-1' },
        { quote: 'I\'m so tired but the second I hit the pillow my mind goes into overdrive', source: 'Reddit r/sleep', emotion: 'exhaustion', sub_avatar_id: 'sa-1' },
      ],
      desire_quotes: [
        { quote: 'I just want to fall asleep without fighting my own brain', source: 'Reddit', depth: 'surface' },
        { quote: 'I want to feel like myself again — I used to be a great sleeper', source: 'Forum', depth: 'core' },
      ],
      objection_quotes: [
        { quote: 'Is it habit-forming?', handler: 'Zero dependency risk. Works WITH your body\'s natural cortisol rhythm, not against it.' },
        { quote: 'How is this different from melatonin?', handler: 'Melatonin adds sleep signal. Slapen removes wake signal. Completely different mechanism.' },
      ],
      always_use: ['cortisol', 'dual-phase', 'racing thoughts', 'actually works', 'sleep through the night', 'no grogginess'],
      never_use: ['miracle', 'revolutionary', 'life-changing', 'just relax', 'sleep hygiene', 'game-changer', 'hack'],
      conditional_use: [],
    },
    emotional_arc: {
      primary_emotion: 'frustrated-hopeful',
      secondary_emotion: 'validated',
      resolution_emotion: 'relieved-empowered',
      funnel_arc: [
        { touchpoint: 'ad', emotion: 'recognition', intensity: 8 },
        { touchpoint: 'advertorial', emotion: 'hope', intensity: 7 },
        { touchpoint: 'landing_page', emotion: 'confidence', intensity: 9 },
      ],
      awareness_progression: {
        ad_level: 'Problem Aware → Solution Aware',
        advertorial_journey: 'Root cause revelation → Mechanism discovery → Social proof → Offer',
        lp_level: 'Product Aware → Most Aware → Purchase',
      },
    },
    voice_profile: {
      vocabulary: ['exhausted', 'wired', 'racing', 'brain fog', 'finally', 'actually', 'cortisol', 'dual-phase', 'natural', 'no grogginess'],
      sentence_style: 'Short, punchy, conversational. Em-dashes for emphasis. Direct address ("you"). Dark humor okay.',
      formality_level: 3,
      emotional_tone: 'Empathetic authority — "I get it AND I have the answer"',
      phrases_to_use: ['your brain isn\'t broken', 'tired but wired', 'actually works', 'fall asleep in minutes', 'sleep through the night'],
      phrases_to_avoid: ['just relax', 'sleep hygiene', 'miracle cure', 'revolutionary', 'life hack', 'game-changer'],
      sample_paragraph: 'Look, you\'ve tried everything. The apps, the teas, the breathing exercises. Nothing stops the 2am thought tornado. Here\'s what nobody told you: the problem isn\'t your brain — it\'s your cortisol. And there\'s a fix.',
    },
    visual_identity: {
      metaphor: 'The cortisol dimmer switch — turning down the wake signal so sleep can rise naturally',
      color_associations: { problem: '#1a2744 (midnight navy)', solution: '#0d9488 (calm teal)', brand: '#6366f1 (trust indigo)' },
      product_image_rules: ['Always premium, never clinical', 'Warm lighting for solution states', 'Cool blue for problem states', 'Product never alone — always in lifestyle context or with mechanism visual'],
    },
    sub_avatars: [
      { id: 'sa-1', name: 'The Exhausted Overthinker', nickname: 'racing-mind mom', urgency_score: 9, launch_order: 1, primary_angle: { name: 'Cortisol Clock', description: 'Your cortisol clock is stuck on daytime mode' } },
      { id: 'sa-2', name: 'The Stressed Professional', nickname: 'burnout exec', urgency_score: 8, launch_order: 2, primary_angle: { name: 'Performance Bottleneck', description: 'Sleep is the last un-optimized variable' } },
      { id: 'sa-3', name: 'The Anxious Night Watcher', nickname: '3am spiral', urgency_score: 9, launch_order: 3, primary_angle: { name: '3AM Cortisol Spike', description: 'The 3am wake-up is a cortisol micro-spike' } },
    ],
  };
}

// -------- UGC Creator Briefs --------

export interface UgcBriefSection {
  overview: {
    product_name: string;
    target_audience: string;
    key_message: string;
    tone: string;
  };
  script_structure: { timing: string; beat: string; description: string }[];
  talking_points: string[];
  emotional_beats: { timing: string; emotion: string; direction: string }[];
  broll_shot_list: { shot: string; duration: string; notes: string }[];
  dos_and_donts: { dos: string[]; donts: string[] };
  wardrobe_setting: { wardrobe: string; setting: string; props: string[] };
  cta_instructions: { script: string; delivery: string; visual: string };
  technical_specs: {
    aspect_ratio: string;
    min_duration: string;
    max_duration: string;
    lighting: string;
    audio: string;
  };
}

export interface UgcBrief {
  id: string;
  format: 'talking_head' | 'grwm' | 'unboxing_review';
  format_label: string;
  duration: string;
  brief: UgcBriefSection;
}

export function demoUgcBriefs(): UgcBrief[] {
  return [
    {
      id: 'ugc-brief-1',
      format: 'talking_head',
      format_label: 'Talking Head (60s)',
      duration: '45-60s',
      brief: {
        overview: {
          product_name: 'Slapen',
          target_audience: 'Women 28-45 who lie awake with racing thoughts, exhausted moms and professionals who have tried everything',
          key_message: 'Your brain isn\'t broken — your cortisol clock is. Slapen fixes the ROOT cause of sleeplessness in 20 minutes.',
          tone: 'Relatable, slightly vulnerable, then confident. Like talking to your best friend who finally found THE answer.',
        },
        script_structure: [
          { timing: '0-3s', beat: 'HOOK', description: 'Look exhausted, messy bun, dim lighting. Say the hook line directly to camera with raw honesty.' },
          { timing: '3-8s', beat: 'PROBLEM', description: 'Describe the nightly torture — racing thoughts, ceiling staring, clock watching. Use first person.' },
          { timing: '8-15s', beat: 'FAILED SOLUTIONS', description: 'Quick list of everything you\'ve tried that didn\'t work. Show genuine frustration.' },
          { timing: '15-22s', beat: 'DISCOVERY', description: 'The turning point — "then I found out something that changed everything." Shift energy from defeated to curious.' },
          { timing: '22-35s', beat: 'MECHANISM', description: 'Explain the cortisol connection simply. "It\'s not that you CAN\'T sleep — your cortisol is stuck on daytime mode." Show the product.' },
          { timing: '35-45s', beat: 'TRANSFORMATION', description: 'Describe night 3 results. Brighter lighting, hair done, energy shift. "I actually slept 7 hours straight."' },
          { timing: '45-55s', beat: 'SOCIAL PROOF', description: 'Mention reviews/ratings briefly. "And I\'m not the only one — 2,800+ five-star reviews."' },
          { timing: '55-60s', beat: 'CTA', description: 'Direct call to action with urgency. Hold product up. Genuine smile.' },
        ],
        talking_points: [
          '"Okay so I have to talk about what happened on night 3..."',
          '"I used to lie awake for HOURS replaying conversations from like 3 days ago"',
          '"I tried melatonin, CBD, magnesium, those sleep teas, meditation apps — nothing worked"',
          '"Then I learned it\'s not about adding sleep — it\'s about removing the thing keeping you awake"',
          '"It\'s called cortisol, and mine was basically stuck on daytime mode even at midnight"',
          '"Slapen has this dual-phase thing — phase 1 calms the cortisol in like 20 minutes, phase 2 keeps you asleep"',
          '"Night 3 was the turning point. I slept 7 hours STRAIGHT. I woke up before my alarm. I cried."',
          '"Link is in my bio — they have a 60-night guarantee so there\'s literally zero risk"',
        ],
        emotional_beats: [
          { timing: '0-3s', emotion: 'Raw vulnerability', direction: 'Look tired, speak softly, slight eye contact break as if confessing something' },
          { timing: '3-15s', emotion: 'Frustration building to desperation', direction: 'Voice gets slightly faster, hands gesturing, authentic exasperation' },
          { timing: '15-22s', emotion: 'Curiosity + cautious hope', direction: 'Lean in slightly, lower voice as if sharing a secret, eyebrows raised' },
          { timing: '22-35s', emotion: 'Growing confidence', direction: 'Sit up straighter, voice becomes steady, eye contact is firm' },
          { timing: '35-55s', emotion: 'Joy + relief', direction: 'Genuine smile, eyes light up, voice lifts. This is the real transformation moment.' },
          { timing: '55-60s', emotion: 'Warm encouragement', direction: 'Like recommending something to a friend. Casual, not salesy.' },
        ],
        broll_shot_list: [
          { shot: 'Clock showing 2:17 AM in dark room', duration: '2s', notes: 'Low light, blue tint, slightly out of focus' },
          { shot: 'Hands reaching for phone on nightstand', duration: '1.5s', notes: 'Phone screen glowing in darkness' },
          { shot: 'Close-up of tired eyes', duration: '1.5s', notes: 'Natural, no makeup, authentic exhaustion' },
          { shot: 'Melatonin bottle being pushed aside', duration: '1s', notes: 'Subtle dismissal gesture' },
          { shot: 'Slapen product hero shot on nightstand', duration: '2s', notes: 'Warm lighting, cozy bedroom context, book + lamp nearby' },
          { shot: 'Pouring capsules into hand', duration: '1.5s', notes: 'Close-up, steady hand, clean nails' },
          { shot: 'Peaceful sleeping shot', duration: '2s', notes: 'Soft morning light, relaxed expression, cozy bedding' },
          { shot: 'Alarm going off, person waking with a smile', duration: '2s', notes: 'Golden morning light, stretching, genuine smile' },
        ],
        dos_and_donts: {
          dos: [
            'Speak naturally — like texting your best friend, not reading a script',
            'Show real emotion — the frustration, the relief, the joy',
            'Use the exact phrases from talking points (they\'re tested)',
            'Film in your actual bedroom for authenticity',
            'Show the product naturally — on your nightstand, in your hand',
            'Use natural lighting or warm lamp light',
            'Include at least 3 seconds of genuine reaction when describing results',
          ],
          donts: [
            'DON\'T use the word "revolutionary" or "life-changing" — too salesy',
            'DON\'T read from a script — memorize key beats and improvise',
            'DON\'T use ring light for the "before" portion — it should look tired/natural',
            'DON\'T mention specific medical claims or diagnose conditions',
            'DON\'T say "sleep hygiene" — the audience hates that phrase',
            'DON\'T rush the transformation moment — let it breathe',
            'DON\'T film in a studio — needs to feel like real UGC',
          ],
        },
        wardrobe_setting: {
          wardrobe: 'Opening: oversized t-shirt or hoodie, messy hair, no makeup. Transformation: same casual style but hair brushed, slightly brighter appearance (NOT glam — just "rested")',
          setting: 'Real bedroom. Nightstand with warm lamp, a book, cozy bedding. NOT a perfectly styled influencer room — slightly lived-in is better.',
          props: ['Slapen bottle', 'Other sleep supplements (for the "tried everything" moment)', 'Phone on nightstand', 'Coffee mug (for the "morning zombie" reference)', 'Cozy blanket'],
        },
        cta_instructions: {
          script: '"If you\'re tired of being tired — link is in my bio. They do a 60-night money-back guarantee so you literally have nothing to lose. Try it. Trust me."',
          delivery: 'Hold product at chest level, slight head tilt, genuine smile. Don\'t look at the product — look at the camera like you\'re talking to a friend.',
          visual: 'Product visible but not centered. You are the focus. Warm lighting. End with a small nod.',
        },
        technical_specs: {
          aspect_ratio: '9:16 (vertical, TikTok/Reels/Stories)',
          min_duration: '45 seconds',
          max_duration: '60 seconds',
          lighting: 'Opening: dim/natural bedroom light (authenticity). Middle: standard room light. Closing: warm, slightly brighter (transformation). Avoid ring light — too polished.',
          audio: 'Direct to camera audio. No background music during filming (added in post). Minimize echo — film in a carpeted room or use soft furnishings.',
        },
      },
    },
    {
      id: 'ugc-brief-2',
      format: 'grwm',
      format_label: 'Get Ready With Me (GRWM)',
      duration: '60-90s',
      brief: {
        overview: {
          product_name: 'Slapen',
          target_audience: 'Women 25-40 on TikTok/Instagram who watch GRWM content, health-conscious, relate to sleep struggles',
          key_message: 'My morning routine changed when my SLEEP changed. Slapen is the secret weapon behind looking and feeling rested.',
          tone: 'Chatty, casual, aspirational but relatable. Classic GRWM energy — sharing a "secret" while getting ready.',
        },
        script_structure: [
          { timing: '0-5s', beat: 'HOOK', description: 'Start mid-routine (applying moisturizer or doing hair). Hook is casual, like a friend noticing something: "People keep asking me what changed..."' },
          { timing: '5-15s', beat: 'CONTEXT', description: 'Continue getting ready while explaining the sleep struggle backstory. "I used to wake up looking like a zombie..."' },
          { timing: '15-30s', beat: 'THE STRUGGLE', description: 'Apply concealer under eyes or similar. Talk about how bad sleep affected your skin, energy, appearance. Relatable details.' },
          { timing: '30-45s', beat: 'DISCOVERY + PRODUCT', description: 'Casually show Slapen on vanity/counter. "Then my friend told me about this cortisol thing..." Explain briefly while continuing routine.' },
          { timing: '45-60s', beat: 'RESULTS', description: 'Show finished look. "Now I actually wake up looking rested because I AM rested." Confidence radiates.' },
          { timing: '60-75s', beat: 'HOW I USE IT', description: 'Quick nighttime routine clip — taking Slapen, getting into bed, reading. Show the ritual.' },
          { timing: '75-90s', beat: 'CTA', description: 'Back to morning look. "Link in bio, 60-night guarantee." Casual sign-off.' },
        ],
        talking_points: [
          '"Everyone keeps asking what I changed about my skincare — it\'s not skincare, it\'s SLEEP"',
          '"I used to need three layers of concealer just to look alive"',
          '"No amount of retinol fixes what 4 hours of sleep does to your face"',
          '"My friend told me about this thing called the cortisol-melatonin handoff — basically your stress hormone was blocking your sleep hormone"',
          '"I take two of these about 30 minutes before bed and I literally fall asleep before I finish my chapter"',
          '"The difference in my under-eyes alone is insane — and I\'m not using any new products"',
          '"It\'s non-habit-forming which was huge for me because I did NOT want to depend on something"',
          '"Okay but seriously — link in bio. 60-night guarantee. You\'re welcome."',
        ],
        emotional_beats: [
          { timing: '0-5s', emotion: 'Conspiratorial excitement', direction: 'Like you\'re about to share the best secret. Slight smirk, raised eyebrow.' },
          { timing: '5-30s', emotion: 'Relatable frustration + humor', direction: 'Self-deprecating about the zombie phase. Light-hearted, not heavy.' },
          { timing: '30-45s', emotion: 'Genuine discovery energy', direction: 'Eyes widen when mentioning the cortisol thing. "Wait, THAT\'s why?"' },
          { timing: '45-75s', emotion: 'Confident satisfaction', direction: 'Glow-up energy. You KNOW you look good because you feel good.' },
          { timing: '75-90s', emotion: 'Warm recommendation', direction: 'Genuine "girl-to-girl" energy. Not selling — sharing.' },
        ],
        broll_shot_list: [
          { shot: 'Hands applying moisturizer in mirror', duration: '3s', notes: 'Well-lit vanity, morning light, clean aesthetic' },
          { shot: 'Close-up of under-eye area (before reference)', duration: '2s', notes: 'Honest, no filter, natural skin' },
          { shot: 'Slapen bottle sitting on bathroom counter among skincare', duration: '2s', notes: 'Product placed naturally among other products' },
          { shot: 'Night routine: taking capsules with water', duration: '2s', notes: 'Cozy bedroom lighting, nightstand setup' },
          { shot: 'Tucking into bed with a book', duration: '2s', notes: 'Warm lamp light, peaceful vibes' },
          { shot: 'Morning alarm, eyes opening naturally', duration: '2s', notes: 'Golden light, no jarring alarm sound' },
          { shot: 'Finished GRWM look — confident smile in mirror', duration: '3s', notes: 'Natural makeup, glowing skin, genuine energy' },
        ],
        dos_and_donts: {
          dos: [
            'Film actual GRWM routine — the audience can tell if it\'s staged',
            'Keep talking while doing your routine — don\'t stop to address camera formally',
            'Use trending GRWM audio/music in the background (add in post)',
            'Show the product casually, not as a "reveal" — it should feel organic',
            'Include the nighttime routine clip as a flashback/insert',
            'Use natural makeup — the "no-makeup makeup" look sells the transformation better',
          ],
          donts: [
            'DON\'T make the entire video about the product — it\'s a GRWM with a product mention',
            'DON\'T hold the product up to camera like a traditional ad',
            'DON\'T use heavy filters — authenticity is the whole point',
            'DON\'T skip the "before" context — the contrast is what makes it work',
            'DON\'T use clinical language — keep it conversational',
            'DON\'T mention competitors by name',
          ],
        },
        wardrobe_setting: {
          wardrobe: 'Start in pajamas or robe (getting-ready look). End in casual-chic outfit. The transformation is subtle but real.',
          setting: 'Bathroom vanity or bedroom vanity with good natural light. Products visible but not overly organized. Real GRWM setup.',
          props: ['Slapen bottle', 'Skincare products (existing routine)', 'Makeup products', 'Hair tools', 'Coffee or water glass', 'Mirror'],
        },
        cta_instructions: {
          script: '"Okay the link is literally in my bio — and they have a 60-night guarantee so if it doesn\'t work you get your money back. But trust me, night 3 is when it clicks."',
          delivery: 'Say it while doing a final check in the mirror. Casual, almost an afterthought. Then look at camera and give a knowing look.',
          visual: 'You looking great in the mirror. Product visible on counter in background. Natural morning light.',
        },
        technical_specs: {
          aspect_ratio: '9:16 (vertical)',
          min_duration: '60 seconds',
          max_duration: '90 seconds',
          lighting: 'Vanity lighting or natural window light for morning routine. Warm lamp for nighttime insert. Consistent, flattering, but NOT studio-grade.',
          audio: 'Voiceover-style or direct-to-camera chat. Background music added in post (trending audio preferred). Clear voice, no echo.',
        },
      },
    },
    {
      id: 'ugc-brief-3',
      format: 'unboxing_review',
      format_label: 'Unboxing / Review',
      duration: '45-75s',
      brief: {
        overview: {
          product_name: 'Slapen',
          target_audience: 'Supplement-curious consumers 25-50 who research products before buying, comparison shoppers, biohackers',
          key_message: 'Honest first impressions + 7-day results. This isn\'t like other sleep supplements — it targets cortisol, not just melatonin.',
          tone: 'Honest reviewer energy. Skeptical at first, increasingly impressed. Think "I was doubtful but here are my ACTUAL results."',
        },
        script_structure: [
          { timing: '0-3s', beat: 'HOOK', description: 'Product box in hands. "I\'ve been lied to by every sleep supplement... let\'s see if this one\'s different."' },
          { timing: '3-12s', beat: 'UNBOXING', description: 'Open packaging slowly. React to quality. Read ingredients/claims on box. Show healthy skepticism.' },
          { timing: '12-20s', beat: 'FIRST IMPRESSION', description: 'Examine capsules, smell, packaging quality. Note the "dual-phase" claim. "Okay, interesting — so it\'s not just melatonin..."' },
          { timing: '20-30s', beat: 'MECHANISM EXPLAIN', description: 'Read or explain the cortisol angle. "So their whole thing is that cortisol is the real enemy, not a melatonin deficiency." Show genuine curiosity.' },
          { timing: '30-45s', beat: 'RESULTS (DAY 1-7)', description: 'Cut to day-by-day reactions. Day 1: "Fell asleep faster but woke up once." Day 3: "Okay something is happening." Day 7: "I\'m a convert."' },
          { timing: '45-60s', beat: 'HONEST ASSESSMENT', description: 'Pros and cons format. Be real. "Is it perfect? No. Is it the best sleep supplement I\'ve tried? By far."' },
          { timing: '60-75s', beat: 'CTA + RATING', description: 'Give a rating (e.g., 8.5/10). Mention the guarantee. Link in bio.' },
        ],
        talking_points: [
          '"Alright so someone sent me this and normally I\'m super skeptical of sleep supplements"',
          '"The packaging is actually really nice — not the usual sketchy supplement vibes"',
          '"Dual-Phase Cortisol Reset — okay that\'s a different approach. Most sleep stuff is just melatonin."',
          '"So the science behind this is that cortisol — your stress hormone — stays high at night and blocks melatonin"',
          '"Day 1: I fell asleep in maybe 25 minutes instead of my usual hour-plus. Still woke up around 4am though."',
          '"Day 3: THIS is when it kicked in. I slept from 11pm to 6:30am straight. I literally checked my tracker twice."',
          '"Day 7: I\'m sleeping 7+ hours consistently. No grogginess. No weird dreams. Just... sleep."',
          '"Pros: actually works, no grogginess, non-habit-forming, the cortisol approach makes sense. Cons: takes 2-3 nights to fully kick in, slightly pricey but there\'s a 60-night guarantee."',
          '"I\'m giving this an 8.5 out of 10. Link below if you want to try it — the guarantee makes it risk-free."',
        ],
        emotional_beats: [
          { timing: '0-3s', emotion: 'Skeptical curiosity', direction: 'Raised eyebrow, slight smirk. "Here we go again" energy but open-minded.' },
          { timing: '3-20s', emotion: 'Genuine surprise', direction: 'Pleasantly surprised by packaging/quality. Let it show naturally.' },
          { timing: '20-30s', emotion: 'Intellectual interest', direction: 'Lean in, nodding. The cortisol angle genuinely intrigues you.' },
          { timing: '30-45s', emotion: 'Building excitement', direction: 'Day-by-day energy grows. Day 1: cautious. Day 3: eyes wide. Day 7: beaming.' },
          { timing: '45-60s', emotion: 'Honest credibility', direction: 'Balanced, thoughtful. Not overselling. This builds trust.' },
          { timing: '60-75s', emotion: 'Confident recommendation', direction: 'Genuine endorsement energy. You\'d recommend this to your mom.' },
        ],
        broll_shot_list: [
          { shot: 'Package arriving / in hands', duration: '2s', notes: 'Clean background, natural light, excitement building' },
          { shot: 'Box opening — slow reveal', duration: '3s', notes: 'ASMR-adjacent. Crisp packaging sounds. Close-up hands.' },
          { shot: 'Product bottle hero shot', duration: '2s', notes: 'Clean surface, good lighting, show label clearly' },
          { shot: 'Capsules poured into hand close-up', duration: '2s', notes: 'Show two-tone capsule design if visible. Clean hands.' },
          { shot: 'Reading ingredient label', duration: '2s', notes: 'Close-up of label, finger pointing to key ingredients' },
          { shot: 'Night 1 setup: taking capsules before bed', duration: '2s', notes: 'Nightstand, water, dim lighting' },
          { shot: 'Sleep tracker screenshot (Day 3 vs Day 1)', duration: '3s', notes: 'Phone screen showing improvement. Real or simulated Oura/Apple Health data.' },
          { shot: 'Day 7 morning: waking up refreshed', duration: '2s', notes: 'Natural light, genuine smile, stretching' },
          { shot: 'Product on desk/counter for final verdict', duration: '2s', notes: 'Clean, well-lit, product is the star' },
        ],
        dos_and_donts: {
          dos: [
            'Be genuinely skeptical at first — the audience relates to doubt',
            'Show real reactions — don\'t script the surprise',
            'Include specific day-by-day results (Day 1, Day 3, Day 7)',
            'Give an honest pro/con assessment — one con makes 5 pros believable',
            'Show the actual product clearly — label, capsules, packaging',
            'Use a clean, well-lit surface for product shots',
            'Include a numerical rating — audiences love quantified opinions',
          ],
          donts: [
            'DON\'T pretend you\'ve never seen the product if it was sent to you',
            'DON\'T skip the skepticism — going straight to praise kills credibility',
            'DON\'T hide that it takes 2-3 nights — honesty builds trust',
            'DON\'T compare directly to named competitors',
            'DON\'T use overly produced lighting — slightly raw is more trustworthy for reviews',
            'DON\'T make medical claims — say "in my experience" not "this cures"',
          ],
        },
        wardrobe_setting: {
          wardrobe: 'Casual and clean. T-shirt or simple top. Approachable "reviewer" look — not influencer glam.',
          setting: 'Clean desk or kitchen counter for unboxing. Bedroom for usage shots. Neutral background. Good natural light from a window.',
          props: ['Slapen box + bottle', 'Other sleep supplements for comparison (optional)', 'Phone showing sleep tracker', 'Glass of water', 'Nightstand setup'],
        },
        cta_instructions: {
          script: '"8.5 out of 10 from me. If you struggle with sleep — especially the racing-thoughts, waking-up-at-3am kind — I\'d say give it a shot. Link in my bio, and they have a 60-night money-back guarantee so worst case you get your money back."',
          delivery: 'Direct to camera, product visible on desk beside you. Honest, measured tone. Nod at the end. Slight smile — you mean it.',
          visual: 'Medium shot, you and product in frame. Clean background. Good eye contact with camera.',
        },
        technical_specs: {
          aspect_ratio: '9:16 (vertical for TikTok/Reels) or 16:9 (horizontal for YouTube)',
          min_duration: '45 seconds',
          max_duration: '75 seconds (can extend to 3-5 min for YouTube long-form)',
          lighting: 'Natural window light preferred. Ring light acceptable for product close-ups only. Avoid harsh overhead fluorescent.',
          audio: 'Direct to camera. Clear voiceover for B-roll sections. Minimal background noise. Optional: subtle unboxing ASMR sounds.',
        },
      },
    },
  ];
}

// -------- Offer Stack Demo Data --------

export interface OfferStackBonus {
  id: string;
  name: string;
  description: string;
  perceivedValue: number;
  format: string;
  painPointAddressed: string;
}

export interface OfferStackGuarantee {
  type: '30-day' | '60-day' | '90-day' | 'lifetime' | 'double-money-back';
  headline: string;
  body: string;
  powerPhrase: string;
  badgeLine: string;
}

export interface OfferStackUrgency {
  scarcityType: 'limited-stock' | 'limited-time' | 'exclusive-access' | 'fast-action-bonus';
  headline: string;
  body: string;
  countdownLabel: string;
  ctaText: string;
  fastActionBonus?: {
    name: string;
    description: string;
    perceivedValue: number;
  };
}

export interface OfferStackPricing {
  totalPerceivedValue: number;
  anchorPrice: number;
  actualPrice: number;
  valueStackIntro: string;
  dailyCostComparison: string;
  opportunityCostLine: string;
  priceRevealLine: string;
  ctaWithPrice: string;
}

export interface OfferStack {
  productName: string;
  productDescription: string;
  retailValue: number;
  bonuses: OfferStackBonus[];
  guarantee: OfferStackGuarantee;
  urgency: OfferStackUrgency;
  pricing: OfferStackPricing;
}

export function demoOfferStack(): OfferStack {
  return {
    productName: 'Slapen — 30-Day Supply',
    productDescription: 'Dual-phase natural sleep formula that calms cortisol in 20 minutes (Phase 1) and sustains deep, restorative sleep for 7+ hours (Phase 2). No melatonin dependency. No morning grogginess. Just the deep, refreshing sleep your body has been craving.',
    retailValue: 79,
    bonuses: [
      {
        id: 'bonus-1',
        name: 'The Sleep Optimization Blueprint',
        description: 'A 47-page guide revealing the exact evening protocol used by sleep researchers to fall asleep in under 15 minutes. Includes the "Cortisol Sunset Sequence" — a 3-step wind-down that primes your brain for Phase 1 of Slapen. Most people see results from the guide alone on Night 1.',
        perceivedValue: 67,
        format: 'guide',
        painPointAddressed: 'Not knowing what habits amplify or sabotage sleep quality',
      },
      {
        id: 'bonus-2',
        name: 'Cortisol Reset Meditation Audio Series',
        description: 'Five 12-minute audio sessions designed by a neuroscience-trained meditation instructor. Unlike generic "sleep meditation" apps, these target the specific cortisol pathways that keep overthinkers wired at bedtime. Works synergistically with Slapen\'s Phase 1 for a "double calm" effect.',
        perceivedValue: 97,
        format: 'audio',
        painPointAddressed: 'Racing thoughts and inability to quiet the mind at bedtime',
      },
      {
        id: 'bonus-3',
        name: '90-Day Sleep Tracker Journal',
        description: 'A beautifully designed printable journal that tracks your sleep quality, energy levels, mood, and cognitive performance over 90 days. Includes weekly reflection prompts and a "Sleep Score" algorithm so you can SEE your transformation in hard numbers. Watch your score climb from the red zone to green.',
        perceivedValue: 47,
        format: 'tracker',
        painPointAddressed: 'Lack of awareness about sleep patterns and progress tracking',
      },
      {
        id: 'bonus-4',
        name: 'The 3AM Emergency Protocol Card',
        description: 'A laminated quick-reference card with the exact 4-step sequence to use if you wake up at 3am. Based on cognitive behavioral therapy for insomnia (CBT-I) principles, adapted for Slapen users. Keep it on your nightstand. Most users report falling back asleep within 8 minutes.',
        perceivedValue: 29,
        format: 'checklist',
        painPointAddressed: 'Middle-of-the-night wake-ups and inability to fall back asleep',
      },
      {
        id: 'bonus-5',
        name: 'Caffeine & Cortisol Timing Calculator',
        description: 'An interactive tool that calculates YOUR optimal caffeine cutoff time based on your genetics, wake time, and cortisol sensitivity. Most people are drinking coffee 3-4 hours too late without realizing it. This single adjustment amplifies Slapen\'s effectiveness by up to 40%.',
        perceivedValue: 57,
        format: 'toolkit',
        painPointAddressed: 'Unknown caffeine interference with natural sleep cycles',
      },
    ],
    guarantee: {
      type: '60-day',
      headline: 'The "Sleep Like a Kid Again" 60-Night Guarantee',
      body: 'Try Slapen for a full 60 nights. If you don\'t experience noticeably deeper sleep, faster sleep onset, and more refreshed mornings — or if you simply decide it\'s not for you for ANY reason — send us one email and we\'ll refund every penny. No forms. No interrogation. No restocking fees. You don\'t even need to send it back. We\'ll eat the cost because we KNOW what this formula does.',
      powerPhrase: 'You either sleep better or you pay nothing. The risk is entirely on us.',
      badgeLine: '60-Night Money-Back Guarantee — Zero Risk',
    },
    urgency: {
      scarcityType: 'fast-action-bonus',
      headline: 'Fast-Action Bonus: Order in the Next 24 Hours',
      body: 'Because this is a new formula launch, we\'re including an exclusive bonus for fast-action customers only. Once we hit 500 orders (or 24 hours, whichever comes first), this bonus disappears permanently. We literally cannot offer it later because the licensing agreement expires.',
      countdownLabel: 'Fast-action bonus expires in',
      ctaText: 'Claim My Slapen + All Bonuses Now',
      fastActionBonus: {
        name: 'The Deep Sleep Masterclass (Video Series)',
        description: 'A 4-part video masterclass featuring Dr. Sarah Chen on the neuroscience of sleep architecture, cortisol regulation, and how to build an "unbreakable" sleep routine. Valued at $197 — yours FREE if you order today.',
        perceivedValue: 197,
      },
    },
    pricing: {
      totalPerceivedValue: 573,
      anchorPrice: 297,
      actualPrice: 39,
      valueStackIntro: 'When you add it all up, you\'re getting $573 worth of proven sleep transformation tools...',
      dailyCostComparison: 'That\'s just $1.30/night — less than a single melatonin gummy that doesn\'t even work.',
      opportunityCostLine: 'Consider this: one more month of terrible sleep costs you $2,000+ in lost productivity, brain fog mistakes, and stress-eating. Slapen pays for itself in the first WEEK.',
      priceRevealLine: 'But you won\'t pay $573. You won\'t even pay $297 (which would STILL be a steal). Today, your total investment is just $39/month.',
      ctaWithPrice: 'Start Sleeping Better Tonight — Just $39/month',
    },
  };
}

// -------- Email Sequences Demo Data --------

export interface EmailSequenceEmail {
  id: string;
  position: number;
  subject_lines: { variant: 'A' | 'B' | 'C'; text: string }[];
  preview_text: string;
  body: string;
  cta_text: string;
  send_timing: string;
}

export interface EmailSequence {
  type: string;
  label: string;
  emails: EmailSequenceEmail[];
}

export type EmailSequencesMap = Record<string, EmailSequence>;

export function demoEmailSequences(): EmailSequencesMap {
  return {
    welcome: {
      type: 'welcome',
      label: 'Welcome Series',
      emails: [
        {
          id: 'wel-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'Your Slapen is on its way (+ the one thing to do tonight)' },
            { variant: 'B', text: 'Welcome to your first real night of sleep' },
            { variant: 'C', text: 'The racing thoughts end here — your Slapen guide inside' },
          ],
          preview_text: 'Here\'s exactly how to use Slapen for maximum results from night one.',
          body: '<p>You just made a decision your future self is going to thank you for.</p><p>While your Slapen is on its way, here\'s what you need to know:</p><p><strong>The Dual-Phase Cortisol Reset works in two stages:</strong></p><p>Phase 1 (first 30 minutes): KSM-66 Ashwagandha and L-Theanine begin calming your cortisol levels. You\'ll feel the racing thoughts slow down — like someone finally turned the volume knob on your brain.</p><p>Phase 2 (through the night): Sustained-release Magnesium Glycinate and Apigenin keep cortisol below the "wake threshold" so you don\'t snap awake at 3am.</p><p><strong>Your first night tip:</strong> Take Slapen 30 minutes before your target bedtime. Not when you\'re already in bed frustrated — 30 minutes BEFORE. This gives Phase 1 time to work.</p><p>Tomorrow morning, you\'ll know the difference.</p>',
          cta_text: 'Read Your Quick-Start Guide',
          send_timing: 'Immediately after purchase',
        },
        {
          id: 'wel-2', position: 2,
          subject_lines: [
            { variant: 'A', text: 'Night 1 done — here\'s what just happened in your body' },
            { variant: 'B', text: 'Did you feel it? The cortisol drop is real.' },
            { variant: 'C', text: 'Your cortisol clock is resetting (here\'s the science)' },
          ],
          preview_text: 'The first night is just the beginning. Here\'s what\'s happening beneath the surface.',
          body: '<p>How was last night?</p><p>If you slept better than usual — that\'s Phase 1 doing its job. Your cortisol dropped below the "mental chatter threshold" and your brain finally got permission to shut down.</p><p>If it wasn\'t a dramatic difference yet — that\'s normal too. Here\'s why:</p><p>Your cortisol rhythm has been stuck in "daytime mode" for weeks, months, maybe years. One night doesn\'t fully reset the pattern. But here\'s the good news: <strong>clinical studies show KSM-66 reduces cortisol by 23% within the first week of consistent use.</strong></p><p>The key word is <em>consistent</em>.</p><p>Nights 1-3: Phase 1 calms acute cortisol. You fall asleep faster.<br/>Nights 4-7: Phase 2 starts preventing mid-sleep cortisol spikes. The 3am wake-ups decrease.<br/>Nights 8-14: Your full cortisol rhythm begins to normalize. This is where the magic happens.</p><p>Keep going. Your body is learning to sleep again.</p>',
          cta_text: 'Track Your Sleep Progress',
          send_timing: '+24 hours',
        },
        {
          id: 'wel-3', position: 3,
          subject_lines: [
            { variant: 'A', text: '2,847 people felt exactly what you\'re feeling right now' },
            { variant: 'B', text: '"I actually slept through the night for the first time in years"' },
            { variant: 'C', text: 'What happens when the racing thoughts finally stop' },
          ],
          preview_text: 'Real stories from people who were exactly where you are.',
          body: '<p>By night 3 or 4, most people hit what we call "the clarity morning."</p><p>It\'s the first time you wake up and think: <em>"Wait... I actually slept."</em></p><p>Here\'s what that moment looked like for others:</p><p><strong>Sarah M., 34:</strong> "I woke up before my alarm. Not in a panic — just... naturally. I couldn\'t remember the last time that happened. I actually cried in the shower."</p><p><strong>David K., 42:</strong> "My Oura score went from 62 to 84 in five days. My wife asked what I was doing differently because I stopped tossing and turning."</p><p><strong>Maria L., 29:</strong> "The racing thoughts used to start the SECOND I closed my eyes. Last night I remember thinking \'I should worry about tomorrow\'s meeting\' and then... nothing. I just fell asleep."</p><p>These aren\'t outliers. <strong>94% of Slapen users report sleeping through the night by day 7.</strong></p><p>Your cortisol rhythm is resetting. Trust the process.</p>',
          cta_text: 'Join the Slapen Community',
          send_timing: '+72 hours',
        },
        {
          id: 'wel-4', position: 4,
          subject_lines: [
            { variant: 'A', text: 'The mistake that ruins Slapen results (don\'t do this)' },
            { variant: 'B', text: 'Why some people get 10x better results with Slapen' },
            { variant: 'C', text: '3 things that amplify the Dual-Phase Cortisol Reset' },
          ],
          preview_text: 'Small tweaks that compound your results dramatically.',
          body: '<p>Quick check-in: how are nights 4-5 going?</p><p>By now you should notice a pattern: faster onset, fewer wake-ups, and mornings that don\'t feel like a punishment.</p><p>But here\'s the thing — there are 3 simple amplifiers that make the Dual-Phase Cortisol Reset work even better:</p><p><strong>1. The 30-Minute Rule</strong><br/>Take Slapen exactly 30 minutes before your target bedtime. Not 10 minutes. Not an hour. 30 minutes is the sweet spot for Phase 1 cortisol reduction.</p><p><strong>2. The Screen Cutoff</strong><br/>Blue light spikes cortisol. If you\'re taking Slapen but scrolling your phone in bed, you\'re pressing the gas and brake at the same time. Cut screens 20 minutes before your Slapen dose.</p><p><strong>3. The Cool Room</strong><br/>Your body temperature drop signals sleep. 65-68F (18-20C) is optimal. Even cracking a window helps.</p><p><strong>The mistake to avoid:</strong> Skipping nights because "you feel better." Your cortisol rhythm needs 14+ consecutive nights to fully reset. Skipping resets the clock.</p>',
          cta_text: 'Get the Full Sleep Optimization Guide',
          send_timing: '+5 days',
        },
        {
          id: 'wel-5', position: 5,
          subject_lines: [
            { variant: 'A', text: 'Your 7-day check-in (+ a question for you)' },
            { variant: 'B', text: 'One week of real sleep — how does it feel?' },
            { variant: 'C', text: 'Day 7: The cortisol reset is taking hold' },
          ],
          preview_text: 'You\'re one week in. Let\'s talk about what comes next.',
          body: '<p>It\'s been 7 days.</p><p>If you\'ve been consistent, your cortisol rhythm is actively resetting. The racing thoughts are quieter. The 3am wake-ups are fading. Mornings feel different.</p><p>Here\'s what the next 3 weeks look like:</p><p><strong>Week 2:</strong> Deep sleep increases. You\'ll notice better focus, less brain fog, more patience with people around you.<br/><strong>Week 3:</strong> The cortisol reset compounds. Many users start dreaming vividly again — a sign of proper REM cycles returning.<br/><strong>Week 4:</strong> Full rhythm normalization. This is when Slapen feels less like a supplement and more like your natural state.</p><p>Quick question: <strong>has anyone in your life noticed the difference yet?</strong></p><p>Partners, coworkers, friends — they often spot the change before you do.</p><p>If someone in your life could use the same transformation, we\'d love to help them too.</p>',
          cta_text: 'Share Slapen & Get 15% Off Your Next Order',
          send_timing: '+7 days',
        },
      ],
    },
    abandon_cart: {
      type: 'abandon_cart',
      label: 'Abandon Cart',
      emails: [
        {
          id: 'ac-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'You left something behind (your cortisol didn\'t)' },
            { variant: 'B', text: 'Still thinking about it? Your brain won\'t stop tonight either.' },
            { variant: 'C', text: 'Your Slapen is waiting — but your racing thoughts aren\'t' },
          ],
          preview_text: 'Your cart is saved. Your cortisol levels aren\'t.',
          body: '<p>We noticed you started your order but didn\'t finish.</p><p>No pressure — we get it. You\'ve probably tried other sleep solutions that promised the world and delivered nothing.</p><p>But here\'s the thing: <strong>Slapen doesn\'t work like melatonin, magnesium, or any sleep aid you\'ve tried before.</strong></p><p>Those target the SLEEP signal. Slapen targets the WAKE signal — the cortisol that keeps your brain running at full speed when it should be shutting down.</p><p>That\'s the Dual-Phase Cortisol Reset. And it\'s the reason 94% of users sleep through the night by day 7.</p><p>Your cart is still saved. Ready when you are.</p>',
          cta_text: 'Complete Your Order',
          send_timing: '+1 hour',
        },
        {
          id: 'ac-2', position: 2,
          subject_lines: [
            { variant: 'A', text: 'The real reason you can\'t decide (it\'s not what you think)' },
            { variant: 'B', text: '"Is it habit-forming?" and other questions we hear daily' },
            { variant: 'C', text: 'Your top 3 questions about Slapen — answered honestly' },
          ],
          preview_text: 'Every concern you have, addressed head-on. No fluff.',
          body: '<p>If you\'re on the fence, you probably have one of these concerns:</p><p><strong>"Is it habit-forming?"</strong><br/>Zero dependency risk. Slapen works WITH your body\'s natural cortisol rhythm, not against it. You\'re not adding a sleep chemical — you\'re removing a wake chemical.</p><p><strong>"How is this different from melatonin?"</strong><br/>Melatonin adds sleep signal. Slapen removes wake signal. Completely different mechanism. That\'s why melatonin makes you groggy but doesn\'t stop racing thoughts.</p><p><strong>"Will I feel groggy in the morning?"</strong><br/>The opposite. Phase 2\'s sustained-release formula is fully metabolized within 6 hours. You wake up clear-headed because your cortisol naturally rises at the right time — morning.</p><p>Still not sure? That\'s what the <strong>60-night guarantee</strong> is for. Sleep better or get every cent back. No questions asked.</p>',
          cta_text: 'Try Slapen Risk-Free',
          send_timing: '+24 hours',
        },
        {
          id: 'ac-3', position: 3,
          subject_lines: [
            { variant: 'A', text: 'Tonight is going to be the same as last night. Unless...' },
            { variant: 'B', text: 'How many more nights of ceiling-staring?' },
            { variant: 'C', text: 'Your brain is going to do the same thing tonight at 2am' },
          ],
          preview_text: 'Every night you wait is another night of broken sleep.',
          body: '<p>Let\'s be honest for a second.</p><p>Tonight, around 11pm, the same thing is going to happen. You\'ll get into bed. Close your eyes. And your brain will light up like a switchboard.</p><p>The meeting tomorrow. The thing you said last week. The bills. The kids. The thing you forgot to do.</p><p>And you\'ll lie there. Tired but wired. Watching the hours tick by.</p><p>That\'s cortisol. It\'s not going to fix itself.</p><p><strong>Every night you wait is a night where your cortisol rhythm digs deeper into its broken pattern.</strong> The longer the pattern runs, the harder it is to break.</p><p>Slapen\'s Dual-Phase Cortisol Reset starts working from night one. 23% cortisol reduction in 30 minutes. And it\'s backed by a 60-night guarantee.</p><p>The only risk is another night like last night.</p>',
          cta_text: 'Break the Pattern Tonight',
          send_timing: '+48 hours',
        },
        {
          id: 'ac-4', position: 4,
          subject_lines: [
            { variant: 'A', text: 'Last chance: 15% off Slapen (expires midnight)' },
            { variant: 'B', text: 'We saved your cart + added something special' },
            { variant: 'C', text: 'Your cortisol doesn\'t take days off. Neither should your solution.' },
          ],
          preview_text: '15% off your first order. Expires at midnight.',
          body: '<p>We\'re not going to pretend we don\'t want you to try Slapen.</p><p>We\'ve seen what happens when people finally break the cortisol cycle. The emails we get — from exhausted moms, burned-out executives, people who haven\'t slept properly in YEARS — they\'re the reason we exist.</p><p>So here\'s our final offer:</p><p><strong>15% off your first order with code SLEEPTONIGHT.</strong></p><p>That\'s on top of the 60-night money-back guarantee. So you\'re paying less AND you\'re fully protected.</p><p>This code expires at midnight. After that, it\'s full price.</p><p>2,847 five-star reviews. 94% sleep-through rate by day 7. Non-habit-forming. No grogginess.</p><p>One decision stands between you and real sleep.</p>',
          cta_text: 'Use Code SLEEPTONIGHT for 15% Off',
          send_timing: '+72 hours',
        },
      ],
    },
    post_purchase: {
      type: 'post_purchase',
      label: 'Post-Purchase',
      emails: [
        {
          id: 'pp-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'Your Slapen shipped! Here\'s your tracking + night 1 plan' },
            { variant: 'B', text: 'It\'s on its way — and so is your first real night of sleep' },
            { variant: 'C', text: 'Shipped! Plus: the 30-minute rule that makes everything work' },
          ],
          preview_text: 'Your order is on its way. Here\'s exactly what to do when it arrives.',
          body: '<p>Great news — your Slapen just shipped!</p><p>While you wait, here\'s your Night 1 game plan:</p><p><strong>Step 1:</strong> Choose your target bedtime (the time you WANT to be asleep).<br/><strong>Step 2:</strong> Take 2 Slapen capsules exactly 30 minutes before that time.<br/><strong>Step 3:</strong> Put your phone in another room. Seriously.<br/><strong>Step 4:</strong> Notice the racing thoughts slow down. That\'s Phase 1 — cortisol dropping below the mental chatter threshold.</p><p>Most people notice a difference from night 1. But the real transformation happens over 7-14 days as your full cortisol rhythm resets.</p><p>We\'ll check in after your first night. You\'ve got this.</p>',
          cta_text: 'Track Your Package',
          send_timing: 'On shipment',
        },
        {
          id: 'pp-2', position: 2,
          subject_lines: [
            { variant: 'A', text: 'How was your first week? (We actually want to know)' },
            { variant: 'B', text: '7 nights in — your cortisol rhythm is shifting' },
            { variant: 'C', text: 'Quick check-in: are the racing thoughts quieter yet?' },
          ],
          preview_text: 'Your feedback matters. Plus: what to expect in week 2.',
          body: '<p>You\'re one week in with Slapen. How\'s it going?</p><p>By now, most people report:</p><ul><li>Falling asleep 2-3x faster than before</li><li>Fewer (or zero) middle-of-the-night wake-ups</li><li>Mornings that don\'t feel like a hostage situation</li></ul><p>If that sounds like you — amazing. Your cortisol rhythm is actively resetting.</p><p>If you\'re not there yet — don\'t worry. Some cortisol patterns take 10-14 days to fully reset, especially if you\'ve been dealing with chronic stress.</p><p><strong>Week 2 is where the compound effect kicks in.</strong> Deep sleep stages get longer. REM cycles normalize. You might start dreaming vividly again — that\'s a sign of proper sleep architecture returning.</p><p>We\'d love to hear how it\'s going. Hit reply and tell us.</p>',
          cta_text: 'Share Your Experience',
          send_timing: '+7 days after delivery',
        },
        {
          id: 'pp-3', position: 3,
          subject_lines: [
            { variant: 'A', text: 'Your 30-day results (+ never run out again)' },
            { variant: 'B', text: 'One month of real sleep. What\'s changed?' },
            { variant: 'C', text: 'The cortisol reset is complete. Here\'s what to do next.' },
          ],
          preview_text: 'Your cortisol rhythm has reset. Let\'s keep it that way.',
          body: '<p>It\'s been 30 days.</p><p>Think back to a month ago. The racing thoughts. The 3am wake-ups. The morning brain fog. The "tired but wired" feeling that never left.</p><p>How does NOW compare?</p><p>If you\'re like 94% of Slapen users, the answer is: dramatically different. Your cortisol rhythm has reset. The Dual-Phase formula has taught your body what "real sleep" feels like again.</p><p>Here\'s the important part: <strong>consistency is what got you here, and consistency is what keeps you here.</strong></p><p>Your bottle is getting low. And a gap in your routine can partially reset the cortisol pattern you\'ve worked so hard to normalize.</p><p>That\'s why we created Subscribe & Save — <strong>20% off every month, delivered automatically</strong>, so you never have a gap night.</p>',
          cta_text: 'Subscribe & Save 20%',
          send_timing: '+30 days after delivery',
        },
        {
          id: 'pp-4', position: 4,
          subject_lines: [
            { variant: 'A', text: 'Leave a review, help someone like you' },
            { variant: 'B', text: 'Your words could end someone else\'s sleepless nights' },
            { variant: 'C', text: '60 seconds to help another exhausted overthinker' },
          ],
          preview_text: 'Your experience could change someone\'s life. We\'re not exaggerating.',
          body: '<p>When you were deciding whether to try Slapen, what convinced you?</p><p>For most people, it was the reviews. Real stories from real people who were exactly where they were.</p><p><strong>Now you\'re one of those people.</strong></p><p>Your experience — good, bad, or somewhere in between — helps someone else make the decision you made. Someone who\'s lying awake right now at 2am, scrolling their phone, wondering if anything will actually work.</p><p>It takes 60 seconds. And it genuinely matters.</p><p>As a thank you, we\'ll send you a <strong>$10 credit</strong> toward your next order.</p>',
          cta_text: 'Write a Quick Review',
          send_timing: '+45 days after delivery',
        },
      ],
    },
    winback: {
      type: 'winback',
      label: 'Winback',
      emails: [
        {
          id: 'wb-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'We miss you. So does your cortisol rhythm.' },
            { variant: 'B', text: 'Are the racing thoughts back?' },
            { variant: 'C', text: 'It\'s been a while — how are you sleeping?' },
          ],
          preview_text: 'Your cortisol rhythm needs consistency to stay reset. Let\'s check in.',
          body: '<p>It\'s been a while since your last order.</p><p>We\'re not here to guilt you. But we do want to ask: <strong>how are you sleeping?</strong></p><p>If the answer is "great" — amazing. That means the cortisol reset took hold permanently.</p><p>But if the answer is "it\'s creeping back..." — that\'s the cortisol pattern re-establishing itself. Without continued Phase 2 support, the 3am wake-ups and racing thoughts can return within 2-3 weeks.</p><p>The good news: restarting is faster than starting from scratch. Your cortisol rhythm remembers the reset pattern. Most returning users are back to full results within 3-5 nights.</p><p>No pressure. Just wanted you to know we\'re here if you need us.</p>',
          cta_text: 'Restart Your Slapen Routine',
          send_timing: '60 days after last purchase',
        },
        {
          id: 'wb-2', position: 2,
          subject_lines: [
            { variant: 'A', text: '25% off to come back (because sleep shouldn\'t be optional)' },
            { variant: 'B', text: 'We made it easy to restart: 25% off inside' },
            { variant: 'C', text: 'Your exclusive return offer: 25% off Slapen' },
          ],
          preview_text: 'A special offer because we know what it\'s like to go back to broken sleep.',
          body: '<p>We\'ll keep this short.</p><p>If the sleepless nights are creeping back, we want to make it as easy as possible to fix it.</p><p><strong>25% off your next order with code COMEBACK25.</strong></p><p>That\'s on top of the same 60-night guarantee you had before. Full refund if it doesn\'t work. No questions.</p><p>Your cortisol rhythm remembers the reset. Returning users typically see results in 3-5 nights instead of 7-14.</p><p>One order. A few nights. Back to sleeping through the night.</p>',
          cta_text: 'Use Code COMEBACK25',
          send_timing: '+7 days',
        },
        {
          id: 'wb-3', position: 3,
          subject_lines: [
            { variant: 'A', text: 'Last email from us (unless you want to sleep again)' },
            { variant: 'B', text: 'We won\'t email again. But your cortisol will.' },
            { variant: 'C', text: 'Final check-in: the offer expires tomorrow' },
          ],
          preview_text: 'This is our last email. The 25% off expires tomorrow.',
          body: '<p>This is our last email about this.</p><p>We respect your inbox and your decisions. But we also know that the gap between "I should restart Slapen" and actually doing it can stretch into weeks and months of broken sleep.</p><p>The <strong>25% off code (COMEBACK25) expires tomorrow</strong>.</p><p>After that, we\'ll stop emailing about it. The next time you hear from us, it\'ll be because we have something genuinely new to share.</p><p>But if tonight is another ceiling-staring session — you know where to find us.</p><p>Sleep well (we mean that).</p>',
          cta_text: 'Last Chance: 25% Off',
          send_timing: '+14 days',
        },
      ],
    },
    browse_abandonment: {
      type: 'browse_abandonment',
      label: 'Browse Abandonment',
      emails: [
        {
          id: 'ba-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'Researching sleep solutions? Here\'s what nobody tells you.' },
            { variant: 'B', text: 'You were looking at Slapen — here\'s why it\'s different' },
            { variant: 'C', text: 'The sleep supplement that actually addresses WHY you can\'t sleep' },
          ],
          preview_text: 'Most sleep supplements treat symptoms. Slapen treats the cause.',
          body: '<p>We noticed you were checking out Slapen. Smart move — you\'re clearly someone who does their research before buying.</p><p>So let us give you the one piece of information that changes everything:</p><p><strong>You don\'t have a melatonin deficiency. You have a cortisol excess.</strong></p><p>That\'s the belief error that keeps millions of people stuck on sleep supplements that don\'t work. Melatonin, magnesium, valerian, chamomile — they all try to ADD sleep signal. But if your cortisol is still elevated, adding sleep signal is like whispering in a hurricane.</p><p>Slapen\'s Dual-Phase Cortisol Reset works differently:</p><ul><li><strong>Phase 1:</strong> Reduces cortisol by 23% in 30 minutes (KSM-66 study)</li><li><strong>Phase 2:</strong> Sustained-release formula prevents the 3am cortisol spike</li></ul><p>That\'s why 94% of users sleep through the night by day 7. Not because we added more sleep signal — because we removed the wake signal.</p>',
          cta_text: 'See How It Works',
          send_timing: '+2 hours after browse',
        },
        {
          id: 'ba-2', position: 2,
          subject_lines: [
            { variant: 'A', text: 'Still comparing sleep supplements? Let us save you time.' },
            { variant: 'B', text: 'Slapen vs. everything else (honest comparison)' },
            { variant: 'C', text: 'Why people switch to Slapen after trying 5+ other sleep aids' },
          ],
          preview_text: 'An honest comparison of Slapen vs melatonin, magnesium, and prescription sleep aids.',
          body: '<p>If you\'re comparing options, here\'s the honest breakdown:</p><p><strong>Melatonin:</strong> Adds sleep signal. Doesn\'t address cortisol. Often causes morning grogginess. Works for jet lag, not for chronic sleep issues.</p><p><strong>Magnesium alone:</strong> Mild muscle relaxation. Helpful but insufficient for cortisol-driven insomnia.</p><p><strong>Prescription sleep aids:</strong> Sedation, not sleep. Suppresses natural sleep architecture. Dependency risk.</p><p><strong>CBD/THC:</strong> Sedation-adjacent. Suppresses REM sleep. Tolerance builds quickly.</p><p><strong>Slapen:</strong> Targets the root cause (cortisol excess). Phase 1 calms cortisol in 30 min. Phase 2 prevents cortisol spikes through the night. Non-habit-forming. No grogginess. 4.8/5 from 2,847 reviews.</p><p>We\'re biased, obviously. But the 60-night guarantee means you can verify it yourself with zero risk.</p>',
          cta_text: 'Try Slapen Risk-Free for 60 Nights',
          send_timing: '+24 hours',
        },
        {
          id: 'ba-3', position: 3,
          subject_lines: [
            { variant: 'A', text: 'Your racing thoughts tonight are the reason we built Slapen' },
            { variant: 'B', text: 'How many more nights before you try something that actually works?' },
            { variant: 'C', text: 'The cost of another month of broken sleep' },
          ],
          preview_text: 'Bad sleep costs you more than you think. Slapen costs $1.30/night.',
          body: '<p>Let\'s do some quick math on bad sleep:</p><p><strong>Productivity loss:</strong> Studies show sleep-deprived workers lose 11.3 days of productivity per year. At even a modest salary, that\'s thousands of dollars.<br/><strong>Health costs:</strong> Chronic poor sleep increases risk of heart disease, diabetes, and cognitive decline.<br/><strong>Relationship cost:</strong> Irritability, low patience, brain fog — your relationships absorb the damage of every bad night.</p><p>Slapen costs <strong>$1.30 per night.</strong></p><p>For less than a cup of coffee, you get the Dual-Phase Cortisol Reset that 94% of users say changed their sleep within 7 days.</p><p>And if it doesn\'t work? Full refund. 60 nights. No questions.</p><p>The only cost of trying is $0 if it doesn\'t work. The cost of NOT trying is... well, you already know what that feels like.</p>',
          cta_text: 'Start Sleeping Better for $1.30/Night',
          send_timing: '+48 hours',
        },
      ],
    },
    vip_nurture: {
      type: 'vip_nurture',
      label: 'VIP Nurture',
      emails: [
        {
          id: 'vip-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'You\'re in the top 5% of Slapen customers (here\'s what that means)' },
            { variant: 'B', text: 'Welcome to Slapen Insiders — exclusive access unlocked' },
            { variant: 'C', text: 'Your loyalty earned you something special' },
          ],
          preview_text: 'Exclusive access, early products, and VIP-only pricing. You earned this.',
          body: '<p>You\'ve been with Slapen through multiple orders now. That puts you in the <strong>top 5% of our customers</strong> — and we want to treat you like it.</p><p>Welcome to <strong>Slapen Insiders.</strong></p><p>Here\'s what that means for you:</p><ul><li><strong>VIP pricing:</strong> Permanent 20% off every order (applied automatically)</li><li><strong>Early access:</strong> New products ship to Insiders 2 weeks before public launch</li><li><strong>Direct line:</strong> Reply to any email and reach our founder directly</li><li><strong>Input matters:</strong> We\'ll ask your opinion on new formulas before we finalize them</li></ul><p>This isn\'t a marketing gimmick. You\'re here because you stuck with the process, trusted the science, and your cortisol rhythm is proof that it works.</p><p>Thank you for being part of this.</p>',
          cta_text: 'Access Your VIP Dashboard',
          send_timing: 'After 3rd purchase',
        },
        {
          id: 'vip-2', position: 2,
          subject_lines: [
            { variant: 'A', text: '[Insiders Only] The new formula we\'re testing — your opinion needed' },
            { variant: 'B', text: 'We need your input before we launch this (VIP access)' },
            { variant: 'C', text: 'Sneak peek: Slapen PM+ (insiders-only preview)' },
          ],
          preview_text: 'A new formulation is in development. We want your feedback first.',
          body: '<p>As a Slapen Insider, you get to see things before anyone else.</p><p>We\'ve been developing a new companion formula: <strong>Slapen PM+</strong></p><p>It\'s designed for the "second layer" of sleep optimization — once your cortisol rhythm is reset, PM+ targets sleep QUALITY:</p><ul><li>Deeper slow-wave sleep (the physically restorative stage)</li><li>Extended REM cycles (cognitive processing and emotional regulation)</li><li>Morning alertness without caffeine dependency</li></ul><p>We\'re in the final testing phase and want your input:</p><p><strong>What\'s the #1 thing you\'d improve about your sleep NOW that the cortisol issue is handled?</strong></p><p>Hit reply and tell us. Every response shapes the final formula.</p>',
          cta_text: 'Share Your #1 Sleep Wish',
          send_timing: '+30 days',
        },
        {
          id: 'vip-3', position: 3,
          subject_lines: [
            { variant: 'A', text: 'Your sleep data is impressive (VIP report inside)' },
            { variant: 'B', text: '[Insiders] Your personal sleep transformation in numbers' },
            { variant: 'C', text: 'From "tired but wired" to this — your 90-day snapshot' },
          ],
          preview_text: 'A look back at your journey from broken sleep to real sleep.',
          body: '<p>You\'ve been using Slapen for 90+ days. Let\'s look at what the data says about customers at your stage:</p><p><strong>Average improvements at 90 days:</strong></p><ul><li>Sleep onset: 47 minutes faster than pre-Slapen</li><li>Night wake-ups: reduced by 82%</li><li>Morning energy: rated 4.2/5 (up from 1.8/5)</li><li>Afternoon brain fog: reduced by 71%</li></ul><p>These aren\'t your individual numbers — but they\'re the average across Insiders who\'ve been consistent for 90+ days.</p><p><strong>Here\'s what excites us:</strong> at 90 days, your cortisol rhythm is fully normalized. The Dual-Phase formula isn\'t creating an artificial sleep state — it\'s supporting your body\'s restored natural rhythm.</p><p>You\'re sleeping the way you were designed to sleep. And that changes everything downstream: focus, mood, relationships, health markers.</p><p>Thank you for trusting the process.</p>',
          cta_text: 'Share Your Results on Social',
          send_timing: '+90 days',
        },
        {
          id: 'vip-4', position: 4,
          subject_lines: [
            { variant: 'A', text: 'Gift a better night\'s sleep (VIP exclusive: buy 2 get 1 free)' },
            { variant: 'B', text: 'Someone you love is lying awake right now' },
            { variant: 'C', text: '[Insiders Only] The gift that changes everything: Slapen BOGO' },
          ],
          preview_text: 'Buy 2, get 1 free. Because you know someone who needs this.',
          body: '<p>You know what it\'s like to finally sleep through the night. You also probably know someone who doesn\'t.</p><p>The partner who tosses and turns. The friend who\'s always "so tired." The parent who hasn\'t slept properly since retirement stress hit.</p><p>As an Insider, you get an exclusive offer:</p><p><strong>Buy 2 bottles, get 1 free.</strong> Gift code: SLEEPGIFT</p><p>That\'s three months of sleep transformation for the price of two. Use the free bottle for yourself or give it to someone who needs it.</p><p>We built Slapen because we believe everyone deserves to sleep without fighting their own brain. Help us reach one more person.</p><p>This offer is VIP-only and expires in 7 days.</p>',
          cta_text: 'Claim Your Free Bottle',
          send_timing: '+120 days',
        },
      ],
    },
    launch: {
      type: 'launch',
      label: 'Launch Sequence',
      emails: [
        {
          id: 'ls-1', position: 1,
          subject_lines: [
            { variant: 'A', text: 'We discovered why you can\'t sleep (it\'s not what you think)' },
            { variant: 'B', text: 'The $3.7 billion sleep industry has been lying to you' },
            { variant: 'C', text: 'There\'s a reason melatonin never worked for you' },
          ],
          preview_text: 'The sleep industry has been treating the wrong problem. We found the real one.',
          body: '<p>Quick question: have you ever wondered why melatonin doesn\'t work for you?</p><p>Not "didn\'t help you fall asleep" — but didn\'t stop the racing thoughts, the 3am wake-ups, the "tired but wired" feeling?</p><p>It\'s not because you need a higher dose. It\'s not because you bought the wrong brand.</p><p><strong>It\'s because melatonin treats the wrong problem.</strong></p><p>The $3.7 billion sleep supplement industry is built on a false assumption: that poor sleep = low melatonin. But for the 50+ million Americans with stress-related sleep issues, the problem isn\'t a melatonin deficiency.</p><p><strong>It\'s a cortisol excess.</strong></p><p>Your stress hormone stays elevated past sunset, blocking the natural cortisol-to-melatonin handoff. Adding melatonin on top of elevated cortisol is like whispering in a hurricane.</p><p>Over the next few days, we\'re going to show you something different. Something that addresses the ROOT CAUSE of your sleepless nights.</p><p>Stay tuned. This changes everything.</p>',
          cta_text: 'Learn About the Cortisol Connection',
          send_timing: 'Launch Day -3',
        },
        {
          id: 'ls-2', position: 2,
          subject_lines: [
            { variant: 'A', text: 'The Dual-Phase Cortisol Reset (how it actually works)' },
            { variant: 'B', text: 'Phase 1 calms your brain in 30 minutes. Phase 2 keeps you asleep.' },
            { variant: 'C', text: 'Inside the mechanism that makes cortisol-driven insomnia obsolete' },
          ],
          preview_text: 'The science behind the first sleep formula that targets cortisol, not melatonin.',
          body: '<p>Yesterday we told you the sleep industry has been targeting the wrong problem.</p><p>Today, let us show you the solution.</p><p>It\'s called the <strong>Dual-Phase Cortisol Reset</strong>, and it works in two stages:</p><p><strong>Phase 1: Cortisol Calm (first 30 minutes)</strong><br/>KSM-66 Ashwagandha and L-Theanine begin reducing cortisol levels. Clinical studies show a 23% reduction within 30 minutes. This is when the racing thoughts slow down. The mental chatter fades.</p><p><strong>Phase 2: Sustained Shield (through the night)</strong><br/>Sustained-release Magnesium Glycinate and Apigenin prevent cortisol from crossing the "wake threshold" during your sleep cycles. This is what stops the 3am wake-ups.</p><p>Two phases. One formula. Addressing both the ONSET problem (can\'t fall asleep) and the MAINTENANCE problem (can\'t stay asleep).</p><p>Tomorrow: we\'ll share the real results. Not lab data — real people, real sleep trackers, real transformations.</p>',
          cta_text: 'See the Full Science Breakdown',
          send_timing: 'Launch Day -2',
        },
        {
          id: 'ls-3', position: 3,
          subject_lines: [
            { variant: 'A', text: '"I haven\'t slept like this since before kids" — Sarah, day 5' },
            { variant: 'B', text: '94% sleep through the night by day 7 (real data, real people)' },
            { variant: 'C', text: 'The reviews that made us cry (literally)' },
          ],
          preview_text: 'Real stories from the 2,847 people who tried the Dual-Phase Cortisol Reset.',
          body: '<p>Numbers are one thing. Stories are another.</p><p>Here are three that represent what we hear every single day:</p><p><strong>Sarah M., 34, exhausted mom:</strong><br/>"Night 1 I thought it was a placebo. Night 3 I slept through my alarm for the first time in 3 years. By week 2, my husband said I seemed like a different person. I\'m not a different person — I\'m just finally sleeping."</p><p><strong>David K., 42, tech executive:</strong><br/>"I\'ve spent $10K+ on biohacking. Oura ring, Whoop, cold plunge, sauna, every supplement known to man. My sleep score never budged past 65. After 10 days on Slapen it hit 87. It\'s the cortisol. It was always the cortisol."</p><p><strong>Maria L., 29, anxious overthinker:</strong><br/>"The racing thoughts used to start the SECOND I closed my eyes. I dreaded bedtime. Now I look forward to it. I take my Slapen, read for 20 minutes, and I\'m out. It\'s like being a kid again."</p><p><strong>The numbers:</strong> 4.8/5 average from 2,847 reviews. 94% sleep through the night by day 7. Non-habit-forming.</p><p>Tomorrow: the moment you\'ve been waiting for.</p>',
          cta_text: 'Read All 2,847 Reviews',
          send_timing: 'Launch Day -1',
        },
        {
          id: 'ls-4', position: 4,
          subject_lines: [
            { variant: 'A', text: 'Slapen is LIVE. Launch pricing ends in 48 hours.' },
            { variant: 'B', text: 'It\'s here. The cortisol solution launches NOW.' },
            { variant: 'C', text: 'Your last sleepless night starts now (Slapen is live)' },
          ],
          preview_text: 'Slapen is officially available. Launch pricing: 30% off for 48 hours only.',
          body: '<p><strong>Slapen is live.</strong></p><p>After months of development, clinical testing, and 2,847 beta reviews — the Dual-Phase Cortisol Reset formula is officially available to everyone.</p><p>And for the next 48 hours, you get <strong>launch pricing: 30% off with code LAUNCH30.</strong></p><p>Here\'s what you get:</p><ul><li>30-day supply of Slapen (60 capsules)</li><li>The Dual-Phase Cortisol Reset: Phase 1 (cortisol calm) + Phase 2 (sustained shield)</li><li>KSM-66 Ashwagandha, L-Theanine, Magnesium Glycinate, Apigenin</li><li>100% non-habit-forming, zero grogginess</li><li><strong>60-night money-back guarantee</strong> — sleep better or get a full refund</li></ul><p>30% off. 60-night guarantee. Zero risk.</p><p>The only question is: how many more nights of ceiling-staring do you want?</p>',
          cta_text: 'Order Now -- 30% Off Launch Price',
          send_timing: 'Launch Day',
        },
        {
          id: 'ls-5', position: 5,
          subject_lines: [
            { variant: 'A', text: '12 hours left. Then launch pricing is gone.' },
            { variant: 'B', text: 'The 30% off disappears at midnight. Your insomnia won\'t.' },
            { variant: 'C', text: 'Final call: Slapen launch price expires tonight' },
          ],
          preview_text: 'Launch pricing (30% off) expires at midnight. Last chance.',
          body: '<p>Quick update: the <strong>30% launch discount expires at midnight tonight.</strong></p><p>After that, Slapen goes to full price. No exceptions, no extensions.</p><p>If you\'ve been following this series, you know:</p><ul><li>The problem isn\'t melatonin — it\'s cortisol</li><li>The Dual-Phase Cortisol Reset addresses both falling asleep AND staying asleep</li><li>23% cortisol reduction in 30 minutes (KSM-66 clinical data)</li><li>94% of users sleep through the night by day 7</li><li>4.8/5 from 2,847 reviews</li><li>60-night money-back guarantee (zero risk)</li></ul><p>The launch price of 30% off makes this less than $1/night.</p><p>For less than a dollar, you could fall asleep without racing thoughts, sleep through the night without 3am wake-ups, and wake up clear-headed for the first time in months.</p><p>Code: <strong>LAUNCH30</strong><br/>Expires: <strong>midnight tonight</strong></p><p>After tonight, this price is gone. Your cortisol isn\'t.</p>',
          cta_text: 'Last Chance: 30% Off Before Midnight',
          send_timing: 'Launch Day +1',
        },
      ],
    },
  };
}
