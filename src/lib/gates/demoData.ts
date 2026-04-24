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
    customer_language_extraction: {
      micro_specific_moments: [
        { id: 'cl-ms01', phrase: 'Lying awake at 2am replaying an email I sent 3 days ago', emotion: 'frustration', visual_score: 9, hook_potential: 9 },
        { id: 'cl-ms02', phrase: 'Watching my partner fall asleep in 30 seconds while I lie there fuming', emotion: 'jealousy', visual_score: 10, hook_potential: 10 },
        { id: 'cl-ms03', phrase: 'That moment when you check the clock and it\'s 4:17am and your alarm is at 6', emotion: 'dread', visual_score: 10, hook_potential: 9 },
        { id: 'cl-ms04', phrase: 'Getting up to pee at 3am and knowing — KNOWING — you won\'t fall back asleep', emotion: 'resignation', visual_score: 8, hook_potential: 8 },
        { id: 'cl-ms05', phrase: 'Your kid asks "mommy why do you always look tired" and you want to cry', emotion: 'shame', visual_score: 10, hook_potential: 10 },
        { id: 'cl-ms06', phrase: 'Opening your sleep tracker app and seeing 3h 42m for the fifth time this week', emotion: 'despair', visual_score: 9, hook_potential: 8 },
        { id: 'cl-ms07', phrase: 'Making your fourth coffee at 2pm because the first three didn\'t touch the fog', emotion: 'exhaustion', visual_score: 9, hook_potential: 8 },
        { id: 'cl-ms08', phrase: 'Canceling dinner plans because you\'re too zombie-brained to hold a conversation', emotion: 'isolation', visual_score: 8, hook_potential: 7 },
        { id: 'cl-ms09', phrase: 'Lying perfectly still pretending to sleep so you don\'t wake your partner with your tossing', emotion: 'loneliness', visual_score: 9, hook_potential: 8 },
        { id: 'cl-ms10', phrase: 'That mini heart attack when the alarm goes off and you realize you never actually slept', emotion: 'panic', visual_score: 10, hook_potential: 9 },
      ],
      internal_dialogue: [
        { id: 'cl-id01', phrase: 'Just stop thinking. Just stop thinking. JUST STOP THINKING.', emotion: 'desperation', hook_potential: 9 },
        { id: 'cl-id02', phrase: 'If I fall asleep RIGHT NOW I\'ll get 4 hours. Okay 3 hours 47 minutes.', emotion: 'anxiety', hook_potential: 10 },
        { id: 'cl-id03', phrase: 'Why am I like this? Normal people just... sleep.', emotion: 'shame', hook_potential: 10 },
        { id: 'cl-id04', phrase: 'Maybe I\'m just broken. Maybe this is who I am now.', emotion: 'hopelessness', hook_potential: 9 },
        { id: 'cl-id05', phrase: 'I bet everyone at tomorrow\'s meeting will know I didn\'t sleep.', emotion: 'paranoia', hook_potential: 8 },
        { id: 'cl-id06', phrase: 'What if this never gets better? What if I\'m like this forever?', emotion: 'existential dread', hook_potential: 9 },
        { id: 'cl-id07', phrase: 'I shouldn\'t need a pill to do something babies do naturally.', emotion: 'self-judgment', hook_potential: 8 },
        { id: 'cl-id08', phrase: 'I used to be a great sleeper. What happened to me?', emotion: 'grief', hook_potential: 9 },
        { id: 'cl-id09', phrase: 'Just one good night. That\'s all I\'m asking for. ONE night.', emotion: 'bargaining', hook_potential: 8 },
        { id: 'cl-id10', phrase: 'If I take another melatonin will it even matter? Probably not.', emotion: 'resignation', hook_potential: 7 },
      ],
      relationship_moments: [
        { id: 'cl-rm01', phrase: 'My husband said "you\'re always angry in the morning" and I realized he\'s right', emotion: 'shame', hook_potential: 9 },
        { id: 'cl-rm02', phrase: 'I snapped at my 4-year-old for asking me to play and hated myself all day', emotion: 'guilt', hook_potential: 10 },
        { id: 'cl-rm03', phrase: 'My boss pulled me aside and asked if "everything is okay at home"', emotion: 'embarrassment', hook_potential: 9 },
        { id: 'cl-rm04', phrase: 'I can\'t remember the last time I had the energy for sex. My partner doesn\'t say anything but I know.', emotion: 'shame', hook_potential: 8 },
        { id: 'cl-rm05', phrase: 'My mom said "you look exhausted" at Christmas and took a photo. I looked 10 years older.', emotion: 'shock', hook_potential: 9 },
        { id: 'cl-rm06', phrase: 'I moved to the guest room so I\'d stop keeping him awake with my tossing', emotion: 'loneliness', hook_potential: 8 },
        { id: 'cl-rm07', phrase: 'My friend canceled on me because I fell asleep mid-conversation at dinner', emotion: 'humiliation', hook_potential: 8 },
        { id: 'cl-rm08', phrase: 'My partner sleeps like the dead while I watch the ceiling. I fantasize about smothering him with a pillow (kidding... mostly)', emotion: 'dark humor', hook_potential: 9 },
        { id: 'cl-rm09', phrase: 'I missed my daughter\'s school play because I had to leave work to nap', emotion: 'guilt', hook_potential: 9 },
        { id: 'cl-rm10', phrase: 'My therapist said sleep is priority #1 but didn\'t offer a single solution that works', emotion: 'abandonment', hook_potential: 7 },
      ],
      humiliation_moments: [
        { id: 'cl-hm01', phrase: 'I fell asleep in a meeting with the CEO. Just... closed my eyes and drifted. Someone nudged me.', emotion: 'humiliation', hook_potential: 10 },
        { id: 'cl-hm02', phrase: 'Someone at work asked if I was hungover. I was just tired. Like every day.', emotion: 'shame', hook_potential: 9 },
        { id: 'cl-hm03', phrase: 'I nodded off while driving and hit the rumble strip on the highway', emotion: 'terror', hook_potential: 10 },
        { id: 'cl-hm04', phrase: 'I forgot my best friend\'s birthday because brain fog ate my memory', emotion: 'guilt', hook_potential: 8 },
        { id: 'cl-hm05', phrase: 'I cried in the pharmacy aisle staring at 14 different melatonin brands not knowing which one to try next', emotion: 'overwhelm', hook_potential: 9 },
        { id: 'cl-hm06', phrase: 'Had to pull over on the school run because I couldn\'t keep my eyes open. Kids in the backseat.', emotion: 'fear', hook_potential: 10 },
        { id: 'cl-hm07', phrase: 'My colleague asked if I was "having a rough week" and it\'s been a rough YEAR', emotion: 'bitterness', hook_potential: 8 },
        { id: 'cl-hm08', phrase: 'I used my kid\'s name wrong in front of other parents. Just blanked. Brain fog.', emotion: 'embarrassment', hook_potential: 8 },
        { id: 'cl-hm09', phrase: 'I skipped a friend\'s wedding because I couldn\'t face a full day running on 3 hours', emotion: 'isolation', hook_potential: 8 },
        { id: 'cl-hm10', phrase: 'My performance review mentioned "attention to detail has declined." I know exactly why.', emotion: 'dread', hook_potential: 9 },
      ],
      failed_solution_language: [
        { id: 'cl-fs01', phrase: 'I\'ve tried melatonin, CBD, magnesium, valerian, GABA, L-theanine, 5-HTP, and ashwagandha. I could open a supplement store.', emotion: 'exasperation', hook_potential: 9 },
        { id: 'cl-fs02', phrase: 'The meditation app just gave me something else to fail at', emotion: 'defeat', hook_potential: 9 },
        { id: 'cl-fs03', phrase: 'My doctor said "practice sleep hygiene" like I haven\'t been doing that for 3 years', emotion: 'anger', hook_potential: 10 },
        { id: 'cl-fs04', phrase: '"Just stop looking at your phone before bed" — oh WOW why didn\'t I think of that', emotion: 'sarcasm', hook_potential: 9 },
        { id: 'cl-fs05', phrase: 'Weighted blanket: $200. Result: still awake, just heavier.', emotion: 'dark humor', hook_potential: 10 },
        { id: 'cl-fs06', phrase: 'Sleep restriction therapy told me to only sleep 5 hours. I was already only sleeping 4.', emotion: 'absurdity', hook_potential: 8 },
        { id: 'cl-fs07', phrase: 'Lavender pillow spray. Chamomile tea. Warm bath. Blue light glasses. Magnesium lotion. I\'m a walking Pinterest board and STILL awake.', emotion: 'dark humor', hook_potential: 10 },
        { id: 'cl-fs08', phrase: 'The Huberman protocol gave me morning sunlight AND evening anxiety about whether I got enough morning sunlight', emotion: 'irony', hook_potential: 9 },
        { id: 'cl-fs09', phrase: 'CBT-I wants me to keep a sleep journal. Great, another thing to stress about at 3am.', emotion: 'frustration', hook_potential: 8 },
        { id: 'cl-fs10', phrase: 'Every "sleep expert" on YouTube says the same 5 things. None of them work.', emotion: 'cynicism', hook_potential: 8 },
      ],
      transformation_language: [
        { id: 'cl-tl01', phrase: 'I actually woke up BEFORE my alarm. I didn\'t even know that was possible anymore.', emotion: 'disbelief', hook_potential: 10 },
        { id: 'cl-tl02', phrase: 'My husband said "you seem like a different person" and I realized he was right', emotion: 'relief', hook_potential: 9 },
        { id: 'cl-tl03', phrase: 'I forgot what it felt like to just... fall asleep. Now I remember.', emotion: 'peace', hook_potential: 9 },
        { id: 'cl-tl04', phrase: 'I haven\'t reached for afternoon coffee in two weeks. That\'s never happened.', emotion: 'pride', hook_potential: 8 },
        { id: 'cl-tl05', phrase: 'For the first time in years, bedtime doesn\'t fill me with dread', emotion: 'freedom', hook_potential: 9 },
        { id: 'cl-tl06', phrase: 'I played with my kids after work instead of collapsing on the couch. They noticed.', emotion: 'joy', hook_potential: 10 },
        { id: 'cl-tl07', phrase: 'My Oura sleep score went from 54 to 87 in one week. ONE WEEK.', emotion: 'triumph', hook_potential: 9 },
        { id: 'cl-tl08', phrase: 'I read a book in bed and fell asleep by page 3. That used to be page 200.', emotion: 'contentment', hook_potential: 8 },
        { id: 'cl-tl09', phrase: 'Night 3 was the turning point. I slept 7 hours straight. I woke up and cried.', emotion: 'overwhelming relief', hook_potential: 10 },
        { id: 'cl-tl10', phrase: 'I got a promotion. My boss said my "energy is completely different." Yeah, because I SLEEP now.', emotion: 'vindication', hook_potential: 9 },
      ],
      trigger_phrases: [
        { id: 'cl-tp01', phrase: 'My husband thought I was depressed. Turns out I was just exhausted.', emotion: 'revelation', hook_potential: 10 },
        { id: 'cl-tp02', phrase: 'I almost fell asleep at the wheel with my kids in the car. That was my wake-up call.', emotion: 'terror', hook_potential: 10 },
        { id: 'cl-tp03', phrase: 'My doctor ran every test. Thyroid, iron, B12, hormones. All normal. "You\'re just stressed."', emotion: 'abandoned', hook_potential: 9 },
        { id: 'cl-tp04', phrase: 'They found out my "health routine" was actually making my sleep WORSE.', emotion: 'shock', hook_potential: 9 },
        { id: 'cl-tp05', phrase: 'I spent $3,000 on a new mattress thinking THAT was the problem. It wasn\'t.', emotion: 'regret', hook_potential: 9 },
        { id: 'cl-tp06', phrase: 'My friend said "have you tried just relaxing?" I almost punched her.', emotion: 'rage', hook_potential: 9 },
        { id: 'cl-tp07', phrase: 'The sleep study said I don\'t have apnea. Great. So what DO I have?', emotion: 'confusion', hook_potential: 8 },
        { id: 'cl-tp08', phrase: 'I calculated I\'ve lost 2,190 hours of sleep in the last 3 years. That\'s 91 days.', emotion: 'horror', hook_potential: 10 },
        { id: 'cl-tp09', phrase: 'My mother-in-law said "you look terrible" at Thanksgiving in front of everyone.', emotion: 'humiliation', hook_potential: 9 },
        { id: 'cl-tp10', phrase: 'I realized I can\'t remember the last time I woke up feeling good. Not one single morning.', emotion: 'grief', hook_potential: 9 },
      ],
      top_10_phrases: [
        { rank: 1, phrase: 'Your kid asks "mommy why do you always look tired" and you want to cry', category: 'micro_specific_moments', why_its_gold: 'Identity + shame + visual specificity — instant scroll stop for exhausted parents' },
        { rank: 2, phrase: 'I almost fell asleep at the wheel with my kids in the car', category: 'trigger_phrases', why_its_gold: 'Ultimate fear trigger — stakes are life-or-death' },
        { rank: 3, phrase: 'Watching my partner fall asleep in 30 seconds while I lie there fuming', category: 'micro_specific_moments', why_its_gold: 'Universal insomniac experience — 95% recognition rate' },
        { rank: 4, phrase: 'Weighted blanket: $200. Result: still awake, just heavier.', category: 'failed_solution_language', why_its_gold: 'Dark humor + failed solution = maximum relatability' },
        { rank: 5, phrase: 'Night 3 was the turning point. I slept 7 hours straight. I woke up and cried.', category: 'transformation_language', why_its_gold: 'Specific + emotional + temporal — creates timeline expectation' },
        { rank: 6, phrase: 'I fell asleep in a meeting with the CEO', category: 'humiliation_moments', why_its_gold: 'Professional fear + humiliation = visceral emotional response' },
        { rank: 7, phrase: 'Why am I like this? Normal people just... sleep.', category: 'internal_dialogue', why_its_gold: 'Identity crisis language — names the exact internal monologue' },
        { rank: 8, phrase: 'Lavender pillow spray. Chamomile tea. Warm bath. Blue light glasses. I\'m a walking Pinterest board and STILL awake.', category: 'failed_solution_language', why_its_gold: 'Stack of failures = instant credibility + humor + exhaustion' },
        { rank: 9, phrase: 'I snapped at my 4-year-old for asking me to play and hated myself all day', category: 'relationship_moments', why_its_gold: 'Guilt + parenting = deepest emotional wound' },
        { rank: 10, phrase: 'If I fall asleep RIGHT NOW I\'ll get 4 hours. Okay 3 hours 47 minutes.', category: 'internal_dialogue', why_its_gold: 'Real-time anxiety loop — every insomniac does this exact math' },
      ],
      total_phrases: 70,
    },
    hook_matrix: {
      total_hooks: 112,
      hooks_by_formula: { question: 16, statement: 16, story: 16, statistic: 16, contradiction: 16, curiosity: 16, identity: 16 },
      hooks_by_sub_avatar: [
        {
          sub_avatar_id: 'sa-1', sub_avatar_name: 'The Exhausted Overthinker',
          angles: [
            { angle: 'Cortisol Clock', hooks: [
              { id: 'h-001', formula: 'statement', hook_text: 'Your brain isn\'t broken — your cortisol clock is.', first_3_lines: { hook: 'Your brain isn\'t broken — your cortisol clock is.', anchor: 'That racing mind at 2am? It\'s not anxiety. It\'s a hormone that forgot to turn off.', open_loop: 'And the fix takes exactly 20 minutes...' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'Reframes insomnia from identity to biology. Removes self-blame.' },
              { id: 'h-002', formula: 'question', hook_text: 'What if your insomnia has nothing to do with your brain?', first_3_lines: { hook: 'What if your insomnia has nothing to do with your brain?', anchor: 'You\'ve been told to "calm your mind." Meditate. Do breathing exercises.', open_loop: 'But the real culprit is a hormone that peaks at exactly the wrong time...' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Challenges the "anxious brain" narrative with a biological alternative.' },
              { id: 'h-003', formula: 'story', hook_text: 'I tried 14 sleep aids. Only one stopped the racing thoughts.', first_3_lines: { hook: 'I tried 14 sleep aids. Only one stopped the racing thoughts.', anchor: 'Melatonin, CBD, magnesium, valerian, chamomile, GABA, L-theanine...', open_loop: 'They were all treating the symptom. Not one addressed the actual cause.' }, reptilian_triggers: ['curiosity', 'social_approval'], attention_hierarchy_level: 'identity', rationale: 'Failed-solution stack creates instant credibility.' },
              { id: 'h-004', formula: 'statistic', hook_text: '73% of melatonin users quit within 90 days. Here\'s what they\'re switching to.', first_3_lines: { hook: '73% of melatonin users quit within 90 days. Here\'s what they\'re switching to.', anchor: 'Melatonin doesn\'t stop working. It never addressed the real problem.', open_loop: 'The real problem? A hormone you\'ve probably never tested.' }, reptilian_triggers: ['curiosity', 'social_approval'], attention_hierarchy_level: 'specificity', rationale: 'Specific stat creates credibility. "Switching to" triggers FOMO.' },
              { id: 'h-005', formula: 'contradiction', hook_text: 'Melatonin is like whispering "sleep" while cortisol screams "WAKE UP."', first_3_lines: { hook: 'Melatonin is like whispering "sleep" while cortisol screams "WAKE UP."', anchor: '73% of users say melatonin "stops working" after a few weeks.', open_loop: 'It didn\'t stop working. It was never solving the right problem.' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Vivid metaphor creates instant understanding of the mechanism failure.' },
              { id: 'h-006', formula: 'curiosity', hook_text: 'If you\'re reading this at 2am, your cortisol is doing exactly what I\'m about to explain.', first_3_lines: { hook: 'If you\'re reading this at 2am, your cortisol is doing exactly what I\'m about to explain.', anchor: 'Right now, your "wake hormone" is at 3x the level it should be.', open_loop: 'And there\'s something you can do about it in the next 20 minutes.' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'Real-time relevance — if they\'re actually awake, it\'s personally targeting.' },
              { id: 'h-007', formula: 'identity', hook_text: 'You know you\'re an overthinker when bedtime feels like a punishment.', first_3_lines: { hook: 'You know you\'re an overthinker when bedtime feels like a punishment.', anchor: 'When you lie there replaying conversations from 2019...', open_loop: 'What if the overthinking isn\'t a character flaw — it\'s a chemical imbalance with a simple fix?' }, reptilian_triggers: ['social_approval', 'self-preservation'], attention_hierarchy_level: 'identity', rationale: 'Self-selection + identity recognition = strongest scroll-stop.' },
            ]},
            { angle: 'Failed Solutions', hooks: [
              { id: 'h-008', formula: 'statement', hook_text: 'You don\'t have a melatonin deficiency. You have a cortisol excess.', first_3_lines: { hook: 'You don\'t have a melatonin deficiency. You have a cortisol excess.', anchor: 'Every supplement you\'ve tried adds more "sleep signal."', open_loop: 'But nobody told you to remove the "wake signal" that\'s drowning it out.' }, reptilian_triggers: ['novelty', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Clean reversal of the standard supplement narrative.' },
              { id: 'h-009', formula: 'question', hook_text: 'What if every sleep supplement you\'ve tried was solving the wrong problem?', first_3_lines: { hook: 'What if every sleep supplement you\'ve tried was solving the wrong problem?', anchor: 'Melatonin. CBD. Magnesium. Valerian. They all add sleep signal.', open_loop: 'But your problem isn\'t too little sleep signal — it\'s too much wake signal.' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Reframes entire supplement category as fundamentally wrong.' },
              { id: 'h-010', formula: 'story', hook_text: 'Lavender spray. Chamomile tea. Blue light glasses. Weighted blanket. I was a walking Pinterest board — and still awake at 3am.', first_3_lines: { hook: 'Lavender spray. Chamomile tea. Blue light glasses. Weighted blanket. I was a walking Pinterest board — and still awake at 3am.', anchor: 'I\'d tried literally everything Instagram told me to try.', open_loop: 'Then a sleep researcher told me something that changed everything...' }, reptilian_triggers: ['social_approval', 'curiosity'], attention_hierarchy_level: 'identity', rationale: 'Stacking failed solutions creates massive relatability.' },
              { id: 'h-011', formula: 'statistic', hook_text: 'Americans spend $1.8 billion on melatonin every year. Insomnia rates have only gone UP.', first_3_lines: { hook: 'Americans spend $1.8 billion on melatonin every year. Insomnia rates have only gone UP.', anchor: 'If melatonin worked, the sleep crisis would be over.', open_loop: 'The reason it doesn\'t? Everyone\'s treating the wrong hormone.' }, reptilian_triggers: ['curiosity', 'novelty'], attention_hierarchy_level: 'contrast', rationale: 'Macro stat creates cognitive dissonance about melatonin.' },
              { id: 'h-012', formula: 'contradiction', hook_text: 'Your "sleep routine" is actually keeping you awake.', first_3_lines: { hook: 'Your "sleep routine" is actually keeping you awake.', anchor: 'The more you try to force sleep, the more cortisol you produce.', open_loop: 'The irony is brutal — and the fix is the opposite of what you\'ve been told.' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'contrast', rationale: 'Paradox creates instant attention. Challenges everything they\'ve done.' },
              { id: 'h-013', formula: 'curiosity', hook_text: 'The #1 sleep supplement in America does absolutely nothing for the #1 cause of insomnia.', first_3_lines: { hook: 'The #1 sleep supplement in America does absolutely nothing for the #1 cause of insomnia.', anchor: 'Melatonin treats melatonin deficiency. But that\'s not your problem.', open_loop: 'Your problem has a name. And once you learn it, everything changes.' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Gap between #1 supplement and #1 cause creates irresistible tension.' },
              { id: 'h-014', formula: 'identity', hook_text: 'If you\'ve tried "everything" and still can\'t sleep — you haven\'t tried the right thing.', first_3_lines: { hook: 'If you\'ve tried "everything" and still can\'t sleep — you haven\'t tried the right thing.', anchor: 'You\'ve tried everything to ADD sleep. Nothing to REMOVE wakefulness.', open_loop: 'There\'s a critical difference — and it\'s the reason nothing has worked.' }, reptilian_triggers: ['self-preservation', 'curiosity'], attention_hierarchy_level: 'identity', rationale: 'Validates their effort while offering a new category.' },
            ]},
            { angle: 'Identity Reframe', hooks: [
              { id: 'h-015', formula: 'statement', hook_text: 'You\'re not a "bad sleeper." You\'re a good sleeper with a broken cortisol clock.', first_3_lines: { hook: 'You\'re not a "bad sleeper." You\'re a good sleeper with a broken cortisol clock.', anchor: 'For years you\'ve been blaming yourself. Your willpower. Your anxiety.', open_loop: 'But what if none of that was the problem?' }, reptilian_triggers: ['self-preservation', 'comfort'], attention_hierarchy_level: 'identity', rationale: 'Identity liberation — removes self-blame, introduces hope.' },
              { id: 'h-016', formula: 'question', hook_text: 'When did you stop calling yourself a "good sleeper"?', first_3_lines: { hook: 'When did you stop calling yourself a "good sleeper"?', anchor: 'There was a time — maybe years ago — when sleep was just... easy.', open_loop: 'What changed wasn\'t your brain. It was one specific hormone.' }, reptilian_triggers: ['self-preservation', 'comfort'], attention_hierarchy_level: 'emotion', rationale: 'Nostalgia trigger. Forces them to recall their before-state.' },
              { id: 'h-017', formula: 'story', hook_text: 'I told my therapist I was "just an insomniac." She said: "No, you have elevated evening cortisol. There\'s a difference."', first_3_lines: { hook: 'I told my therapist I was "just an insomniac." She said: "No, you have elevated evening cortisol. There\'s a difference."', anchor: 'For 4 years I\'d accepted insomnia as part of my identity.', open_loop: 'Turns out I wasn\'t broken. I was just fighting the wrong enemy.' }, reptilian_triggers: ['social_approval', 'curiosity'], attention_hierarchy_level: 'identity', rationale: 'Authority figure (therapist) delivers the reframe. Credible + emotional.' },
              { id: 'h-018', formula: 'contradiction', hook_text: 'The most frustrating thing about insomnia? You\'re actually great at sleeping. Your cortisol just won\'t let you.', first_3_lines: { hook: 'The most frustrating thing about insomnia? You\'re actually great at sleeping. Your cortisol just won\'t let you.', anchor: 'Think about it: when you DO fall asleep, you sleep hard.', open_loop: 'The problem was never sleep itself — it was what happens 90 minutes before.' }, reptilian_triggers: ['novelty', 'self-preservation'], attention_hierarchy_level: 'contrast', rationale: 'Validates their sleep ability while explaining the blocker.' },
              { id: 'h-019', formula: 'identity', hook_text: 'POV: You stopped saying "I can\'t sleep" and started saying "my cortisol is out of sync."', first_3_lines: { hook: 'POV: You stopped saying "I can\'t sleep" and started saying "my cortisol is out of sync."', anchor: 'The language shift sounds small. The results were anything but.', open_loop: 'Here\'s what happened when I treated the hormone instead of blaming myself...' }, reptilian_triggers: ['social_approval', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'POV format + language reframe = TikTok-native identity hook.' },
            ]},
          ],
        },
        {
          sub_avatar_id: 'sa-2', sub_avatar_name: 'The Stressed Professional',
          angles: [
            { angle: 'Performance Bottleneck', hooks: [
              { id: 'h-020', formula: 'statement', hook_text: 'You\'ve optimized your diet, exercise, and supplements. Your sleep is still sabotaging everything.', first_3_lines: { hook: 'You\'ve optimized your diet, exercise, and supplements. Your sleep is still sabotaging everything.', anchor: 'HRV tanked. Sleep score: 54. Recovery: poor.', open_loop: 'The one variable your $500/month stack doesn\'t address...' }, reptilian_triggers: ['power', 'self-preservation'], attention_hierarchy_level: 'identity', rationale: 'Speaks directly to biohacker who\'s optimized everything else.' },
              { id: 'h-021', formula: 'question', hook_text: 'Why does your $500/month supplement stack still give you a 54 sleep score?', first_3_lines: { hook: 'Why does your $500/month supplement stack still give you a 54 sleep score?', anchor: 'You\'ve got the Oura ring, the WHOOP, the cold plunge.', open_loop: 'You\'re measuring the problem perfectly. And completely missing the cause.' }, reptilian_triggers: ['power', 'curiosity'], attention_hierarchy_level: 'specificity', rationale: 'Specific dollar amount + sleep score = instant recognition for biohackers.' },
              { id: 'h-022', formula: 'story', hook_text: 'My Oura ring gave me a 54 sleep score for the 47th night in a row. That\'s when I fired my entire supplement stack.', first_3_lines: { hook: 'My Oura ring gave me a 54 sleep score for the 47th night in a row. That\'s when I fired my entire supplement stack.', anchor: 'I was spending $487/month on supplements. My sleep was getting WORSE.', open_loop: 'I replaced it all with one thing. My sleep score hit 87 in 6 days.' }, reptilian_triggers: ['curiosity', 'power'], attention_hierarchy_level: 'specificity', rationale: 'Specific numbers create believability. Dramatic stack-replacement story.' },
              { id: 'h-023', formula: 'statistic', hook_text: 'CEOs who sleep 7+ hours outperform sleep-deprived CEOs by 29%. Where do you fall?', first_3_lines: { hook: 'CEOs who sleep 7+ hours outperform sleep-deprived CEOs by 29%. Where do you fall?', anchor: 'You\'re not lazy. You\'re not undisciplined. You\'re cortisol-compromised.', open_loop: 'And there\'s a 20-minute nightly protocol that fixes it.' }, reptilian_triggers: ['power', 'social_approval'], attention_hierarchy_level: 'specificity', rationale: 'Performance stat appeals to achievement-driven audience.' },
              { id: 'h-024', formula: 'contradiction', hook_text: 'The cold plunge that "boosts your energy" is actually destroying your sleep.', first_3_lines: { hook: 'The cold plunge that "boosts your energy" is actually destroying your sleep.', anchor: 'Late-day cold exposure spikes cortisol for 6+ hours.', open_loop: 'And that\'s just one of the 3 "healthy habits" keeping you up at night...' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'contrast', rationale: 'Attacks a sacred biohacker habit. Guaranteed attention.' },
              { id: 'h-025', formula: 'curiosity', hook_text: 'The one metric your Oura ring tracks that explains EVERYTHING about your bad sleep.', first_3_lines: { hook: 'The one metric your Oura ring tracks that explains EVERYTHING about your bad sleep.', anchor: 'It\'s not your sleep latency. It\'s not your deep sleep.', open_loop: 'It\'s a metric you probably scroll past every morning...' }, reptilian_triggers: ['curiosity', 'power'], attention_hierarchy_level: 'specificity', rationale: 'Device-specific hook pre-qualifies Oura users. Curiosity gap is strong.' },
              { id: 'h-026', formula: 'identity', hook_text: 'If you track your sleep but can\'t fix it — you have a data problem, not a discipline problem.', first_3_lines: { hook: 'If you track your sleep but can\'t fix it — you have a data problem, not a discipline problem.', anchor: 'You have the data. You\'re missing the variable.', open_loop: 'The variable? A hormone your tracker measures but your stack ignores.' }, reptilian_triggers: ['power', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'Validates their tracking habit while redirecting to the solution.' },
            ]},
          ],
        },
        {
          sub_avatar_id: 'sa-3', sub_avatar_name: 'The Anxious Night Watcher',
          angles: [
            { angle: '3AM Cortisol Spike', hooks: [
              { id: 'h-027', formula: 'statement', hook_text: 'The 3am wake-up isn\'t anxiety. It\'s a cortisol micro-spike. And it\'s fixable.', first_3_lines: { hook: 'The 3am wake-up isn\'t anxiety. It\'s a cortisol micro-spike. And it\'s fixable.', anchor: 'Every night, same time, eyes snap open, heart racing.', open_loop: 'Your doctor said "that\'s normal." It\'s not. Here\'s what\'s actually happening...' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'Names and explains the exact phenomenon. Removes the anxiety label.' },
              { id: 'h-028', formula: 'question', hook_text: 'Why do you always wake up between 2am and 4am? (It\'s not what you think.)', first_3_lines: { hook: 'Why do you always wake up between 2am and 4am? (It\'s not what you think.)', anchor: 'It\'s not your bladder. It\'s not random. It\'s not even stress exactly.', open_loop: 'It\'s a hormone spike that happens at the exact same time every night — and it has a name.' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'identity', rationale: 'Time-specific detail creates instant recognition.' },
              { id: 'h-029', formula: 'story', hook_text: 'For 3 years I woke up at 3:17am. Every. Single. Night. Then a sleep doctor said 6 words that changed everything.', first_3_lines: { hook: 'For 3 years I woke up at 3:17am. Every. Single. Night. Then a sleep doctor said 6 words that changed everything.', anchor: '"Your cortisol is crossing the wake threshold."', open_loop: 'I didn\'t even know cortisol had a "wake threshold." But once I did...' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'specificity', rationale: 'Hyper-specific time (3:17) + authority figure + numbered words = maximum credibility.' },
              { id: 'h-030', formula: 'statistic', hook_text: '68% of "middle insomnia" sufferers have cortisol levels 3x above normal between 2-4am.', first_3_lines: { hook: '68% of "middle insomnia" sufferers have cortisol levels 3x above normal between 2-4am.', anchor: 'Your falling asleep is fine. Your STAYING asleep is broken.', open_loop: 'And nobody\'s addressing the one hormone responsible...' }, reptilian_triggers: ['self-preservation', 'curiosity'], attention_hierarchy_level: 'specificity', rationale: 'Scientific stat validates their experience as a real medical phenomenon.' },
              { id: 'h-031', formula: 'contradiction', hook_text: 'Your doctor says the 3am wake-ups are "normal." They\'re not. They\'re a cortisol malfunction.', first_3_lines: { hook: 'Your doctor says the 3am wake-ups are "normal." They\'re not. They\'re a cortisol malfunction.', anchor: 'A healthy cortisol curve stays below the wake threshold all night.', open_loop: 'Yours doesn\'t. And there\'s a specific reason why...' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'contrast', rationale: 'Challenges medical authority — always gets attention.' },
              { id: 'h-032', formula: 'curiosity', hook_text: 'There\'s a specific hormone that spikes at 3am. Your doctor knows about it. But has no solution for it.', first_3_lines: { hook: 'There\'s a specific hormone that spikes at 3am. Your doctor knows about it. But has no solution for it.', anchor: 'It\'s called a cortisol micro-spike. It crosses your "wake threshold" mid-sleep.', open_loop: 'Prescription sleep aids don\'t touch it. But something else does.' }, reptilian_triggers: ['curiosity', 'self-preservation'], attention_hierarchy_level: 'specificity', rationale: 'Medical insider knowledge gap — they want to know what doctors can\'t solve.' },
              { id: 'h-033', formula: 'identity', hook_text: 'If you can fall asleep fine but always wake up at 3am — you have a completely different problem than insomniacs.', first_3_lines: { hook: 'If you can fall asleep fine but always wake up at 3am — you have a completely different problem than insomniacs.', anchor: 'It\'s called "middle insomnia" and it has a specific hormonal cause.', open_loop: 'The fix is completely different from what works for people who can\'t fall asleep at all.' }, reptilian_triggers: ['self-preservation', 'novelty'], attention_hierarchy_level: 'identity', rationale: 'Creates a new identity category. They\'re not generic insomniacs — they\'re "middle insomnia."' },
            ]},
          ],
        },
      ],
      top_20_scored: [
        { rank: 1, id: 'h-001', formula: 'statement', hook_text: 'Your brain isn\'t broken — your cortisol clock is.', sub_avatar_id: 'sa-1', angle: 'Cortisol Clock', reptilian_score: 9, hierarchy_score: 10, first_3_lines_score: 9, total_score: 28, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Identity-level: reframes their self-concept from "broken" to "fixable"', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Brain scan split: left chaotic red, right calm blue', text_hook: 'YOUR BRAIN ISN\'T BROKEN', audio_hook: '"What if I told you your brain works perfectly — it\'s your cortisol that\'s the problem?"' } },
        { rank: 2, id: 'h-029', formula: 'story', hook_text: 'For 3 years I woke up at 3:17am. Every. Single. Night.', sub_avatar_id: 'sa-3', angle: '3AM Cortisol Spike', reptilian_score: 9, hierarchy_score: 9, first_3_lines_score: 9, total_score: 27, reptilian_triggers_fired: ['curiosity', 'self-preservation'], hierarchy_justification: 'Specificity (3:17am) + Identity (exact experience mirroring)', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Clock showing 3:17am in dark bedroom', text_hook: '3:17 AM. EVERY. NIGHT.', audio_hook: 'Clock ticking sound, then silence, then "For three years..."' } },
        { rank: 3, id: 'h-003', formula: 'story', hook_text: 'I tried 14 sleep aids. Only one stopped the racing thoughts.', sub_avatar_id: 'sa-1', angle: 'Cortisol Clock', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 9, total_score: 26, reptilian_triggers_fired: ['curiosity', 'social_approval'], hierarchy_justification: 'Identity: mirrors their failed-solution journey', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Row of supplement bottles being knocked over like dominoes', text_hook: '14 SLEEP AIDS. 1 WINNER.', audio_hook: '"Melatonin. CBD. Magnesium. Valerian. I tried them ALL."' } },
        { rank: 4, id: 'h-007', formula: 'identity', hook_text: 'You know you\'re an overthinker when bedtime feels like a punishment.', sub_avatar_id: 'sa-1', angle: 'Cortisol Clock', reptilian_score: 8, hierarchy_score: 10, first_3_lines_score: 8, total_score: 26, reptilian_triggers_fired: ['social_approval', 'self-preservation'], hierarchy_justification: 'Pure identity hook — self-selection mechanism', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Person sitting on edge of bed, slumped, staring at pillow', text_hook: 'BEDTIME = PUNISHMENT?', audio_hook: '"You know that feeling when everyone else looks forward to bed... and you dread it?"' } },
        { rank: 5, id: 'h-022', formula: 'story', hook_text: 'My Oura ring gave me a 54 sleep score for the 47th night in a row.', sub_avatar_id: 'sa-2', angle: 'Performance Bottleneck', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 9, total_score: 26, reptilian_triggers_fired: ['power', 'curiosity'], hierarchy_justification: 'Hyper-specificity (54, 47th) + identity (quantified self)', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Oura ring screen showing 54 sleep score in red', text_hook: 'SLEEP SCORE: 54. AGAIN.', audio_hook: '"Day 47 of my Oura telling me what I already know."' } },
        { rank: 6, id: 'h-005', formula: 'contradiction', hook_text: 'Melatonin is like whispering "sleep" while cortisol screams "WAKE UP."', sub_avatar_id: 'sa-1', angle: 'Cortisol Clock', reptilian_score: 8, hierarchy_score: 8, first_3_lines_score: 9, total_score: 25, reptilian_triggers_fired: ['curiosity', 'self-preservation'], hierarchy_justification: 'Vivid contrast metaphor creates instant comprehension', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Split: tiny melatonin pill vs massive cortisol molecule', text_hook: 'MELATONIN WHISPERS. CORTISOL SCREAMS.', audio_hook: 'Whisper: "sleep..." then SHOUT: "WAKE UP!" contrast audio' } },
        { rank: 7, id: 'h-015', formula: 'statement', hook_text: 'You\'re not a "bad sleeper." You\'re a good sleeper with a broken cortisol clock.', sub_avatar_id: 'sa-1', angle: 'Identity Reframe', reptilian_score: 8, hierarchy_score: 10, first_3_lines_score: 7, total_score: 25, reptilian_triggers_fired: ['self-preservation', 'comfort'], hierarchy_justification: 'Identity liberation — reframes from defect to malfunction', recommended_placement: 'advertorial_headline', hook_stacking: { visual_hook: 'Person sleeping peacefully with faint clock overlay', text_hook: 'YOU\'RE NOT A BAD SLEEPER', audio_hook: '"What if I told you... you were never a bad sleeper?"' } },
        { rank: 8, id: 'h-010', formula: 'story', hook_text: 'I was a walking Pinterest board — and still awake at 3am.', sub_avatar_id: 'sa-1', angle: 'Failed Solutions', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 8, total_score: 25, reptilian_triggers_fired: ['social_approval', 'curiosity'], hierarchy_justification: 'Identity + dark humor = instant relatability', recommended_placement: 'social', hook_stacking: { visual_hook: 'Pinterest-style grid of sleep remedies all crossed out', text_hook: 'A WALKING PINTEREST BOARD. STILL AWAKE.', audio_hook: '"Lavender spray. Check. Chamomile tea. Check. Still. Awake."' } },
        { rank: 9, id: 'h-027', formula: 'statement', hook_text: 'The 3am wake-up isn\'t anxiety. It\'s a cortisol micro-spike.', sub_avatar_id: 'sa-3', angle: '3AM Cortisol Spike', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 8, total_score: 25, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Names their exact experience + gives it a scientific name', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Cortisol spike graph overlaid on sleeping person', text_hook: 'NOT ANXIETY. CORTISOL.', audio_hook: '"That 3am wake-up? It has a name. And it\'s not anxiety."' } },
        { rank: 10, id: 'h-008', formula: 'statement', hook_text: 'You don\'t have a melatonin deficiency. You have a cortisol excess.', sub_avatar_id: 'sa-1', angle: 'Failed Solutions', reptilian_score: 8, hierarchy_score: 8, first_3_lines_score: 9, total_score: 25, reptilian_triggers_fired: ['novelty', 'self-preservation'], hierarchy_justification: 'Clean binary reversal creates instant comprehension', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Melatonin arrow down, Cortisol arrow up — imbalanced scale', text_hook: 'NOT LOW MELATONIN. HIGH CORTISOL.', audio_hook: '"Everyone keeps adding melatonin. Nobody\'s removing cortisol."' } },
        { rank: 11, id: 'h-024', formula: 'contradiction', hook_text: 'The cold plunge that "boosts your energy" is actually destroying your sleep.', sub_avatar_id: 'sa-2', angle: 'Performance Bottleneck', reptilian_score: 8, hierarchy_score: 8, first_3_lines_score: 8, total_score: 24, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Attacks sacred biohacker habit — guaranteed controversy', recommended_placement: 'social', hook_stacking: { visual_hook: 'Ice bath with red "sleep destroyer" stamp', text_hook: 'YOUR COLD PLUNGE IS KILLING YOUR SLEEP', audio_hook: '"That cold plunge you love? Your cortisol hates it."' } },
        { rank: 12, id: 'h-017', formula: 'story', hook_text: 'My therapist said: "You\'re not an insomniac. You have elevated evening cortisol."', sub_avatar_id: 'sa-1', angle: 'Identity Reframe', reptilian_score: 7, hierarchy_score: 10, first_3_lines_score: 8, total_score: 25, reptilian_triggers_fired: ['social_approval', 'curiosity'], hierarchy_justification: 'Authority delivers identity reframe', recommended_placement: 'advertorial_headline', hook_stacking: { visual_hook: 'Therapy office scene, warm lighting', text_hook: '"YOU\'RE NOT AN INSOMNIAC."', audio_hook: 'Gentle voice: "What if you\'re not an insomniac at all?"' } },
        { rank: 13, id: 'h-011', formula: 'statistic', hook_text: '$1.8 billion on melatonin yearly. Insomnia rates: still going UP.', sub_avatar_id: 'sa-1', angle: 'Failed Solutions', reptilian_score: 7, hierarchy_score: 8, first_3_lines_score: 8, total_score: 23, reptilian_triggers_fired: ['curiosity', 'novelty'], hierarchy_justification: 'Macro contradiction creates distrust in current solutions', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Rising graph line labeled "melatonin sales" vs "insomnia rates" — both going up', text_hook: '$1.8 BILLION. ZERO IMPROVEMENT.', audio_hook: '"One point eight BILLION dollars spent on melatonin... and insomnia is worse than ever."' } },
        { rank: 14, id: 'h-021', formula: 'question', hook_text: 'Why does your $500/month supplement stack still give you a 54 sleep score?', sub_avatar_id: 'sa-2', angle: 'Performance Bottleneck', reptilian_score: 8, hierarchy_score: 8, first_3_lines_score: 7, total_score: 23, reptilian_triggers_fired: ['power', 'curiosity'], hierarchy_justification: 'Dollar amount + specific score = biohacker identity', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Supplement bottles vs sleep score of 54', text_hook: '$500/MONTH. SLEEP SCORE: 54.', audio_hook: '"Five hundred dollars. Every month. And your Oura still says \'poor.\'"' } },
        { rank: 15, id: 'h-028', formula: 'question', hook_text: 'Why do you always wake up between 2am and 4am?', sub_avatar_id: 'sa-3', angle: '3AM Cortisol Spike', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 7, total_score: 24, reptilian_triggers_fired: ['curiosity', 'self-preservation'], hierarchy_justification: 'Time-specific + universal experience', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Eyes snapping open in darkness, clock showing 3:00', text_hook: '2AM - 4AM. EVERY. NIGHT.', audio_hook: 'Alarm-like sound then: "Why this window? Why always the same time?"' } },
        { rank: 16, id: 'h-006', formula: 'curiosity', hook_text: 'If you\'re reading this at 2am, your cortisol is doing exactly what I\'m about to explain.', sub_avatar_id: 'sa-1', angle: 'Cortisol Clock', reptilian_score: 7, hierarchy_score: 10, first_3_lines_score: 8, total_score: 25, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Real-time targeting — if awake now, it\'s personally relevant', recommended_placement: 'social', hook_stacking: { visual_hook: 'Phone screen glowing in dark room', text_hook: 'READING THIS AT 2AM?', audio_hook: '"If you\'re seeing this right now... your cortisol is proving my point."' } },
        { rank: 17, id: 'h-019', formula: 'identity', hook_text: 'POV: You stopped saying "I can\'t sleep" and started saying "my cortisol is out of sync."', sub_avatar_id: 'sa-1', angle: 'Identity Reframe', reptilian_score: 7, hierarchy_score: 10, first_3_lines_score: 7, total_score: 24, reptilian_triggers_fired: ['social_approval', 'novelty'], hierarchy_justification: 'TikTok-native format + language reframe', recommended_placement: 'social', hook_stacking: { visual_hook: 'Text overlay with crossed out "I can\'t sleep" replaced by new text', text_hook: 'POV: THE LANGUAGE SHIFT', audio_hook: 'ASMR whisper: "It starts with how you talk about it..."' } },
        { rank: 18, id: 'h-033', formula: 'identity', hook_text: 'If you fall asleep fine but always wake at 3am — you have a completely different problem.', sub_avatar_id: 'sa-3', angle: '3AM Cortisol Spike', reptilian_score: 8, hierarchy_score: 9, first_3_lines_score: 7, total_score: 24, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Creates new identity category — "middle insomnia"', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Person peacefully asleep, then jarring 3am cut', text_hook: 'FALLING ASLEEP ISN\'T YOUR PROBLEM.', audio_hook: '"You can fall asleep just fine. It\'s the 3am part..."' } },
        { rank: 19, id: 'h-012', formula: 'contradiction', hook_text: 'Your "sleep routine" is actually keeping you awake.', sub_avatar_id: 'sa-1', angle: 'Failed Solutions', reptilian_score: 8, hierarchy_score: 8, first_3_lines_score: 7, total_score: 23, reptilian_triggers_fired: ['self-preservation', 'novelty'], hierarchy_justification: 'Paradox attacks their invested effort', recommended_placement: 'social', hook_stacking: { visual_hook: 'Sleep routine checklist all checked off, person still awake', text_hook: 'YOUR SLEEP ROUTINE IS THE PROBLEM', audio_hook: '"What if everything you do before bed... is the reason you can\'t sleep?"' } },
        { rank: 20, id: 'h-023', formula: 'statistic', hook_text: 'CEOs who sleep 7+ hours outperform by 29%. Where do you fall?', sub_avatar_id: 'sa-2', angle: 'Performance Bottleneck', reptilian_score: 7, hierarchy_score: 8, first_3_lines_score: 8, total_score: 23, reptilian_triggers_fired: ['power', 'social_approval'], hierarchy_justification: 'Performance stat + competitive question', recommended_placement: 'ad', hook_stacking: { visual_hook: 'Boardroom with one empty chair', text_hook: '29% PERFORMANCE GAP', audio_hook: '"The highest performers in the world have one thing in common... and it\'s not hustle."' } },
      ],
      recommended_copy_formats: {
        problem_aware: 'PAS (Problem-Agitation-Solution) — lead with named pain, agitate with cost of inaction, solve with mechanism',
        solution_aware: 'AIDA (Attention-Interest-Desire-Action) — they know solutions exist, differentiate via mechanism superiority',
        product_aware: '4P (Promise-Picture-Proof-Push) — they\'re comparing, so lead with proof and guarantee',
        format_reasoning: 'Gate 2 data shows 70% pain / 30% aspiration ratio. PAS outperforms for pain-dominant audiences. AIDA reserved for retargeting (already exposed to mechanism).',
      },
      trigger_phrases_used: {
        fear: ['destroying your sleep', 'stuck on daytime mode', 'sabotaging everything', 'crossed the wake threshold'],
        curiosity: ['one specific hormone', 'what they\'re switching to', 'a name you\'ve never heard', 'what your doctor knows but can\'t solve'],
        identity: ['you know you\'re an overthinker', 'walking Pinterest board', 'not a bad sleeper', 'quantified self'],
        pain: ['3am heart racing', 'brain won\'t shut up', 'ceiling staring', '14 sleep aids'],
      },
    },
    open_loops: {
      mystery: [
        { id: 'ol-m01', loop_text: 'There\'s a hormone your doctor measures every year but never thinks to connect to your insomnia...', emotion_triggered: 'curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-m02', loop_text: 'Sleep researchers discovered something about the 3am wake-up that the pharmaceutical industry doesn\'t want you to know...', emotion_triggered: 'intrigue', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-3' },
        { id: 'ol-m03', loop_text: 'The reason some people fall asleep in 30 seconds while you lie awake for 2 hours has nothing to do with their brain...', emotion_triggered: 'jealousy + curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-m04', loop_text: 'There\'s a 90-minute window before bedtime that determines your entire night. Most people have no idea it exists...', emotion_triggered: 'urgency', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-m05', loop_text: 'Your blood work shows it. Your wearable tracks it. But nobody connects it to why you can\'t sleep...', emotion_triggered: 'frustration + curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-m06', loop_text: 'Japan figured this out in 2019. America is just catching up now...', emotion_triggered: 'FOMO', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-m07', loop_text: 'There\'s a reason every sleep supplement starts working... and then stops. And it\'s not what the manufacturers tell you...', emotion_triggered: 'betrayal + curiosity', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-m08', loop_text: 'The military discovered a way to fall asleep in 2 minutes. The civilian version is even simpler...', emotion_triggered: 'curiosity', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-m09', loop_text: 'A neuroscientist at Stanford accidentally discovered why overthinkers can\'t sleep — while studying something completely unrelated...', emotion_triggered: 'serendipity + curiosity', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-m10', loop_text: 'The one thing insomniacs have in common isn\'t anxiety, stress, or screen time. It\'s something much simpler — and much more fixable...', emotion_triggered: 'hope + curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
      ],
      contradiction: [
        { id: 'ol-c01', loop_text: 'The "sleep hygiene" advice you follow religiously? It\'s based on a 1977 study that\'s been debunked 4 times...', emotion_triggered: 'betrayal', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c02', loop_text: 'Melatonin doesn\'t stop working after a few weeks. It never worked in the first place — for the actual problem...', emotion_triggered: 'anger + revelation', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c03', loop_text: 'The "wind-down routine" everyone recommends can actually increase the hormone that keeps you awake...', emotion_triggered: 'shock', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c04', loop_text: 'Your therapist tells you to "address the anxiety" to fix sleep. But what if sleep is causing the anxiety, not the other way around?', emotion_triggered: 'paradigm shift', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-3' },
        { id: 'ol-c05', loop_text: 'The warm bath before bed that "relaxes" you? It spikes your cortisol for the first 45 minutes...', emotion_triggered: 'betrayal', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c06', loop_text: 'Exercising in the morning for "better sleep" might actually be the worst time — depending on your cortisol curve...', emotion_triggered: 'confusion + curiosity', best_placement: 'social', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-c07', loop_text: 'The blue light glasses you bought? They block the wrong wavelength. The one that matters isn\'t even blue...', emotion_triggered: 'betrayal', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c08', loop_text: 'Reading before bed makes most people sleepy. For overthinkers, it does the exact opposite...', emotion_triggered: 'recognition', best_placement: 'social', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-c09', loop_text: 'Your Oura ring says "go to bed earlier." For you specifically, that\'s the worst possible advice...', emotion_triggered: 'vindication', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-c10', loop_text: 'The #1 rated "calming supplement" on Amazon actually raises cortisol in 40% of users after 2 weeks...', emotion_triggered: 'alarm', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
      ],
      personal_revelation: [
        { id: 'ol-p01', loop_text: 'I didn\'t find out until my bloodwork came back. The number that explained 3 years of insomnia was right there on page 2...', emotion_triggered: 'anticipation', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p02', loop_text: 'My husband was the one who finally said it: "You\'re not anxious. You\'re exhausted. And the exhaustion is making you anxious."', emotion_triggered: 'revelation', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p03', loop_text: 'I spent $4,200 on sleep solutions in one year. The thing that finally worked cost $39...', emotion_triggered: 'contrast + curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p04', loop_text: 'My sleep doctor fired me as a patient. Not because I was difficult — because she said I didn\'t need her anymore...', emotion_triggered: 'surprise + hope', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-3' },
        { id: 'ol-p05', loop_text: 'Night 3 I slept 7 hours straight. I lay in bed and cried. Not from sadness — from relief...', emotion_triggered: 'overwhelming emotion', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p06', loop_text: 'I almost didn\'t try it. I\'d been burned so many times that "just one more thing" felt like self-punishment...', emotion_triggered: 'vulnerability', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p07', loop_text: 'My 6-year-old said "mama you\'re smiling in the morning!" And I realized she\'d never seen that before...', emotion_triggered: 'tenderness + guilt', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p08', loop_text: 'I hid my insomnia from everyone. My coworkers, my friends, even my partner. Until one day I couldn\'t hide it anymore...', emotion_triggered: 'vulnerability', best_placement: 'advertorial_intro', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p09', loop_text: 'The pharmacist looked at my shopping cart and said something I\'ll never forget...', emotion_triggered: 'anticipation', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-p10', loop_text: 'My therapist asked "on a scale of 1-10 how rested do you feel?" I said 2. She didn\'t look surprised...', emotion_triggered: 'shared despair', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
      ],
      social_proof: [
        { id: 'ol-s01', loop_text: 'Why 47,000 women stopped taking melatonin in the last 6 months — and what they switched to...', emotion_triggered: 'FOMO + curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s02', loop_text: 'The Huberman Lab episode that\'s quietly changing how biohackers think about sleep...', emotion_triggered: 'insider knowledge', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-s03', loop_text: 'There\'s a reason this has 2,847 five-star reviews — and zero paid promotions...', emotion_triggered: 'trust + curiosity', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s04', loop_text: 'Scandinavian countries have a 60% lower insomnia rate. It\'s not the lifestyle — it\'s something they put in their evening routine...', emotion_triggered: 'geographic curiosity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s05', loop_text: '9 out of 10 sleep doctors recommend melatonin publicly. Here\'s what they take privately...', emotion_triggered: 'insider betrayal', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s06', loop_text: 'The r/insomnia post that went viral last month — 12,000 upvotes, 4,000 comments — all about one ingredient...', emotion_triggered: 'social proof + curiosity', best_placement: 'social', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s07', loop_text: 'Navy SEALs use this to fall asleep in hostile environments. The civilian version just hit the market...', emotion_triggered: 'authority + exclusivity', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-s08', loop_text: 'My friend who\'s a nurse said "this is the only one that actually makes sense pharmacologically"...', emotion_triggered: 'medical credibility', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s09', loop_text: 'There\'s a TikTok with 4.3 million views of a woman sobbing on Night 3. I thought it was fake. Then it happened to me...', emotion_triggered: 'curiosity + social proof', best_placement: 'social', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-s10', loop_text: 'Last month, 847 women in our community tracked their sleep score improvement. The average: +31 points in 7 days...', emotion_triggered: 'measurable hope', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
      ],
      time_bomb: [
        { id: 'ol-t01', loop_text: 'In 6 months, the FDA is expected to reclassify melatonin. If you\'re still using it, here\'s what to switch to now...', emotion_triggered: 'urgency', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t02', loop_text: 'Every night you don\'t sleep properly, your cortisol baseline rises by 2-3%. That\'s why it gets worse over time...', emotion_triggered: 'escalating fear', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t03', loop_text: 'New research links chronic cortisol elevation to brain shrinkage. They published the brain scans last month...', emotion_triggered: 'health alarm', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t04', loop_text: 'Your body has a "point of no return" with sleep debt. After 6 months of poor sleep, recovery takes 3x longer...', emotion_triggered: 'urgency', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t05', loop_text: 'We\'re running a 60-night trial right now. Once it closes, the price goes up to reflect the new study data...', emotion_triggered: 'scarcity', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t06', loop_text: 'The ashwagandha shortage is real. KSM-66 (the only form that works) is backordered globally through Q3...', emotion_triggered: 'supply scarcity', best_placement: 'email_subject', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-t07', loop_text: 'Your sleep quality at 40 is 60% worse than at 30. At 50, it drops another 40%. The window to fix it narrows every year...', emotion_triggered: 'aging anxiety', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t08', loop_text: 'Three major sleep supplement brands are about to reformulate with the same ingredient. Right now, only one has it...', emotion_triggered: 'first-mover advantage', best_placement: 'mid_copy', pairs_with_sub_avatar: 'sa-2' },
        { id: 'ol-t09', loop_text: 'The WHO just added "chronic sleep disruption" to its list of modifiable risk factors for dementia. Published last month.', emotion_triggered: 'deep health fear', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
        { id: 'ol-t10', loop_text: 'You\'re losing 91 days of sleep per year. That\'s 3 months of your life — gone. Every year it compounds...', emotion_triggered: 'life-is-passing', best_placement: 'ad_hook', pairs_with_sub_avatar: 'sa-1' },
      ],
      total_loops: 50,
    },
    sensory_language: {
      pain_state: {
        sight: ['The clock glows 3:17am and the ceiling becomes a movie screen for every mistake you\'ve ever made', 'Your partner\'s peaceful face in the blue phone glow looks like a personal insult', 'The bathroom mirror at 6am shows someone 10 years older staring back at you', 'Dark circles that concealer can\'t cover, that even good lighting can\'t hide', 'The world through brain fog — like looking through a dirty window that never gets clean'],
        sound: ['The deafening silence of 3am when every thought sounds like a loudspeaker', 'Your partner\'s slow, steady breathing — a rhythm you\'d give anything to match', 'The tinnitus hum that only appears in the dead of night', 'Your heartbeat pounding in your ear against the pillow — thump, thump, thump', 'The garbage truck at 5:30am — your signal that another sleepless night is officially over'],
        touch: ['The pillow that feels like concrete when your mind is a hurricane', 'Sheets that stick to you as you toss for the 47th time', 'The cold sweat at 3am — clammy skin that won\'t dry', 'That heavy, sand-behind-the-eyes exhaustion that coffee can\'t touch', 'The weighted blanket that was supposed to help — now it just makes you feel trapped'],
        taste: ['The stale, metallic taste of a mouth dry from stress-breathing all night', 'The bitterness of your fourth coffee that doesn\'t even taste good anymore', 'Chamomile tea — the taste of false hope at this point', 'That thick, foggy feeling in your mouth when you "wake up" without having slept'],
        emotion: ['The specific loneliness of being the only person awake in a sleeping house', 'That cocktail of exhaustion and dread when the sun starts coming up', 'The bone-deep tiredness that isn\'t sleepiness — you\'re tired but your brain is wired', 'The flash of rage when someone says "just try to relax"', 'The quiet despair of doing everything right and still lying awake'],
      },
      solution_state: {
        sight: ['That first morning waking before the alarm — golden light, clear eyes, actual energy in your face', 'Your sleep score hitting 87 for the first time in months — the number almost doesn\'t feel real', 'Your reflection looking 5 years younger because the dark circles are actually fading', 'Watching the sunrise by choice — not because you\'ve been up since 3am'],
        sound: ['Your alarm going off and thinking "wait, it\'s morning already?"', 'Your partner saying "you\'re different. You\'re... you again"', 'The silence of a mind at rest — no more 2am thought tornadoes', 'Your kid laughing and having the energy to actually play with them'],
        touch: ['Waking up cocooned in warmth, muscles soft, jaw unclenched for the first time in years', 'The cool pillow against your cheek as you drift off effortlessly', 'Stretching in bed — full, deep, satisfying stretching — because your body actually rested', 'The texture of a book you fell asleep reading by page 3'],
        emotion: ['The profound relief of realizing "I slept. I actually slept."', 'Confidence returning — sharp thinking, quick recall, presence in conversations', 'Bedtime becoming something you look forward to instead of dread', 'That unfamiliar feeling at 10pm: actual, genuine, natural drowsiness'],
      },
    },
    future_pacing: {
      scenes: [
        { id: 'fp-01', scene: 'Imagine waking up before your alarm. Not because you couldn\'t sleep — because you\'re done sleeping. Your body decided "that\'s enough rest" at 6:47am and you actually WANT to get up. You stretch. Your mind is clear. Your jaw isn\'t clenched. The coffee is a pleasure, not a lifeline. Your partner says "you\'re in a good mood." You are. For the first time in months, you just... are.', emotion: 'hope + peace', word_count: 72 },
        { id: 'fp-02', scene: 'Picture this: it\'s 10:15pm. You\'re reading in bed. The words start to blur — not from exhaustion, but from actual sleepiness. Your eyes close on page 3. When they open, it\'s 6:30am. Seven hours. Uninterrupted. No 3am heart-pound. No clock-watching. Just... sleep. The way it used to be. The way it\'s supposed to be.', emotion: 'nostalgia + relief', word_count: 62 },
        { id: 'fp-03', scene: 'Think about your next big presentation. But this time, you slept 8 hours. Your recall is instant. Your energy is steady. Your focus is laser. Your boss pulls you aside afterward and says "whatever you\'re doing, keep doing it." You smile because you know exactly what changed.', emotion: 'professional confidence', word_count: 51 },
      ],
    },
    bucket_brigades: [
      'But here\'s where it gets interesting...',
      'And that\'s not even the worst part.',
      'Wait — it gets better.',
      'So what actually works?',
      'Here\'s what nobody tells you...',
      'But there\'s a catch.',
      'And then everything changed.',
      'Let me explain why...',
      'Here\'s the part that blew my mind:',
      'But I was wrong. Dead wrong.',
      'Want to know the real reason?',
      'Here\'s what happened next...',
      'Now here\'s where it gets personal.',
      'Sound familiar? Keep reading.',
      'But that\'s only half the story.',
    ],
    takeaway_copy: [
      { id: 'tc-01', variant: 'scarcity', text: 'We only produce 3,000 bottles per batch because KSM-66 is sourced from a single farm in Rajasthan. When it\'s gone, it\'s gone until the next harvest.' },
      { id: 'tc-02', variant: 'qualification', text: 'Slapen isn\'t for everyone. If your sleep problem is just "too much Netflix" — save your money. This is for people whose brain won\'t shut off no matter what they try.' },
      { id: 'tc-03', variant: 'reversal', text: 'Honestly? We almost don\'t want to sell you this. Because once you try it, you\'ll never buy another sleep supplement again. And that makes the rest of the industry very nervous.' },
      { id: 'tc-04', variant: 'anti-pitch', text: 'Don\'t buy this if you\'re just looking for another pill to throw at the problem. This works differently — and it requires you to understand WHY it works. If you just want melatonin with better branding, this isn\'t for you.' },
      { id: 'tc-05', variant: 'insider', text: 'This was never supposed to be a consumer product. It started as a research protocol at a neuroscience lab. We just made it available in capsule form.' },
    ],
  };
}

function demoGate5(): Record<string, unknown> {
  return {
    advertorials: [
      {
        id: 'adv-1',
        target_sub_avatar: 'sa-1',
        archetype: 'Reluctant Hero',
        protagonist: 'Sarah, 34, marketing manager and mother of two',
        hook_sentence: 'I used to love bedtime. Then it became the worst part of my day.',
        story_block: 'For three years, I dreaded 10pm like most people dread Monday mornings. The moment my head hit the pillow, my brain turned into a courtroom — replaying every conversation, every email, every parenting decision I\'d made that day. My husband would fall asleep in literal seconds. I\'d lie there, jaw clenched, counting his breaths like a prison sentence.\n\nI tried melatonin (groggy mornings, same racing thoughts). CBD oil (expensive, inconsistent). The Calm app ($70/year to listen to someone tell me to "release my thoughts" — as if I hadn\'t tried that 4,000 times). Blue light glasses. Weighted blanket. Chamomile tea. Magnesium spray. Lavender pillow mist.\n\nI became a walking Pinterest board of sleep hacks. And I was still awake at 2:17am, calculating how many hours of sleep I\'d get "if I fall asleep RIGHT NOW."',
        root_cause_block: 'My doctor ran every test. Thyroid, iron, B12, cortisol. Everything came back "within normal range." She suggested sleep restriction therapy. I was already sleeping 4 hours — restricting it further felt like a punishment.\n\nThen a friend — a nurse who works night shifts — said something that stopped me cold: "Sarah, have you looked at WHEN your cortisol peaks? Normal range doesn\'t mean normal timing."\n\nShe was right. My cortisol wasn\'t too high overall. It was high AT THE WRONG TIME. While it should drop to near-zero by 10pm, mine was staying elevated until 1-2am. I wasn\'t anxious. I was chemically wired.',
        mechanism_block: 'The Dual-Phase Cortisol Reset works in two stages — and the "two stages" part is what makes it different from everything else I\'d tried.\n\nPhase 1 — "Cortisol Calm" — uses KSM-66 Ashwagandha (the only form with 14 clinical trials behind it) plus L-Theanine. Within 20-30 minutes of taking it, your evening cortisol drops by up to 23%. That\'s not me saying it — that\'s the KSM-66 clinical data published in the Journal of the American Nutraceutical Association.\n\nPhase 2 — "Sustained Shield" — kicks in during the night. Sustained-release Magnesium Glycinate plus Apigenin (the compound in chamomile, but at a therapeutic dose — not the trace amounts in tea) creates a cortisol ceiling. It prevents the 3am micro-spike that wakes you up with your heart pounding.\n\nHere\'s the thing most people miss: melatonin supplements add sleep signal. But if your cortisol is screaming "WAKE UP," adding a whisper of "sleep" does nothing. Slapen doesn\'t add sleep. It removes wakefulness. Completely different mechanism.',
        social_proof_block: '2,847 reviews. 4.8 out of 5 stars. But here\'s the review that made me cry:\n\n"Night 3 was the turning point. I slept 7 hours straight for the first time in 14 months. I woke up before my alarm. I didn\'t feel groggy. I just felt... normal. I forgot what normal felt like." — Jessica M., verified buyer\n\nI read that and thought: that\'s exactly what happened to me.',
        cta_block: 'Slapen offers a 60-night guarantee. Not 30 nights, not 14 nights — 60. Because they know the first night might not be the miracle. But by night 3-5, you\'ll feel the difference. And by week 2, you\'ll wonder why nobody told you about cortisol sooner.\n\nIf it doesn\'t work, they refund every cent. No questions, no "please tell us why," no return shipping. Just a refund.\n\nI wish I\'d found this three years ago. But I\'m glad I found it now.',
        emotional_arc: 'Desperation → Exhaustion → Failed attempts humor → Discovery (cortisol timing) → Understanding → Skeptical hope → First results → Relief → Advocacy',
        word_count: 687,
        estimated_read_time: '3-4 minutes',
        format: 'long_form_advertorial',
      },
      {
        id: 'adv-2',
        target_sub_avatar: 'sa-2',
        archetype: 'The Optimizer',
        protagonist: 'James, 41, tech founder and biohacker',
        hook_sentence: 'My $500/month supplement stack was doing everything right. Except the one thing that mattered most.',
        story_block: 'I track everything. Oura ring, WHOOP strap, continuous glucose monitor. My HRV, my resting heart rate, my deep sleep percentage — I have spreadsheets going back 3 years.\n\nMy diet is dialed. Protein at 1g per pound. Omega-3s, creatine, NAD+ precursors. I cold plunge at 6am, sauna at 6pm. Morning sunlight within 30 minutes of waking.\n\nI\'ve followed every protocol Huberman has ever suggested. Every podcast, every paper.\n\nAnd my Oura sleep score? 54. For the 47th consecutive night.\n\nI was spending $487/month on supplements. My sleep was getting WORSE. My HRV was tanking. My "recovery" score was permanently stuck on "pay attention." I was the most optimized person in the room — and the most exhausted.',
        root_cause_block: 'A friend who\'s a functional medicine doc looked at my protocol and said: "James, you\'re addressing every pathway except the one that gates all the others. Your evening cortisol is still at daytime levels at midnight."\n\nI pulled up my labs. She was right. My cortisol wasn\'t flagged because the TOTAL was normal. But the CURVE was broken. It should drop to near-zero by 9pm. Mine was still at 60% of peak at 11pm.\n\nEvery other supplement in my stack? Optimizing downstream of a broken cortisol rhythm. It\'s like putting premium fuel in a car with the parking brake on.',
        mechanism_block: 'The Dual-Phase Cortisol Reset did what $487/month in supplements couldn\'t. Phase 1 dropped my evening cortisol to baseline within 25 minutes (I tested with a DUTCH panel — verified). Phase 2 prevented my 3:30am spike entirely.\n\nDay 6: Oura sleep score hit 87. My HRV jumped 12 points. Deep sleep went from 45 minutes to 1 hour 38 minutes.\n\nI replaced my entire sleep stack with one product. Total cost: $39/month.',
        cta_block: 'Track it yourself. 60-night guarantee. If your Oura/WHOOP scores don\'t improve, full refund. No questions asked.',
        emotional_arc: 'Optimization pride → Data frustration → Expert revelation → Protocol simplification → Measurable results → Vindication',
        word_count: 412,
        estimated_read_time: '2 minutes',
        format: 'short_form_advertorial',
      },
      {
        id: 'adv-3',
        target_sub_avatar: 'sa-3',
        archetype: 'The Medical Mystery',
        protagonist: 'Priya, 38, teacher and anxiety sufferer',
        hook_sentence: 'Every night at 3:17am, my eyes snap open. Heart pounding. Mind racing. For two years straight.',
        story_block: 'I don\'t have trouble falling asleep. I fall asleep fine. The problem is what happens at 3am.\n\nEvery single night — and I mean EVERY night — my eyes snap open. Heart racing. Thoughts spiraling. Did I lock the door? Is my daughter okay? What about that email I forgot to send? Is this what a heart attack feels like?\n\nI\'d lie there until 5:30am, when it was "acceptable" to get up. Then I\'d drag myself through the day on 4-5 hours of broken sleep.\n\nMy doctor said: "That\'s just anxiety. Try CBT-I." My therapist said: "That\'s just cortisol. Have you tried supplements?" My pharmacist said: "Melatonin should help." Nobody agreed on the cause, and nothing they suggested helped.\n\nThe worst part? The anticipatory anxiety. I\'d start dreading the 3am wake-up at 8pm. Which made my cortisol spike. Which made the wake-up worse. A perfect, cruel loop.',
        root_cause_block: 'A sleep specialist finally explained it: "Priya, you have what we call a cortisol micro-spike. Your cortisol doesn\'t stay low overnight — it crosses the \'wake threshold\' between 2-4am. This is a physiological event, not a psychological one. Your anxiety at 3am is a SYMPTOM of the cortisol spike, not the CAUSE."\n\nSix words changed everything: "It\'s hormonal, not psychological."\n\nI wasn\'t crazy. I wasn\'t broken. My body was doing exactly what cortisol tells it to do — wake up. At the worst possible time.',
        mechanism_block: 'Slapen\'s Phase 2 (sustained-release Magnesium Glycinate + Apigenin) creates what the sleep specialist called a "cortisol ceiling" — it prevents cortisol from crossing the wake threshold during your sleep cycle.\n\nNight 1: woke at 3:45am (30 minutes later than usual). Fell back asleep in 10 minutes.\nNight 3: woke at 4:30am. Fell back asleep immediately.\nNight 7: slept through to 6:15am. No wake-up. No heart pounding. No 3am thought spiral.\n\nI cried. In bed. At 6:15am. Because I\'d slept through the night for the first time in two years.',
        cta_block: '60-night guarantee. If you still wake up at 3am, full refund. They\'re that confident.',
        emotional_arc: 'Normalizing the hell → Medical dismissal → The cruel loop → Scientific explanation → Night-by-night progress → Emotional release → Freedom',
        word_count: 445,
        estimated_read_time: '2-3 minutes',
        format: 'medium_form_advertorial',
      },
    ],
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
      { id: 'bc-1', concept: 'concept-1', format: 'PAS', primary_text: 'I spent 3 years believing I was just "a bad sleeper." Turns out, my cortisol was stuck on daytime mode — even at midnight. The Dual-Phase Cortisol Reset changed everything. Phase 1 calmed my racing mind in 20 minutes. Phase 2 kept me asleep until morning. No grogginess. No dependency. Just... sleep. The way it\'s supposed to be.\n\nTry Slapen risk-free for 60 nights.', word_count: 67 },
      { id: 'bc-2', concept: 'concept-2', format: 'PAS', primary_text: 'Your 3am wake-up isn\'t random.\n\nIt\'s a cortisol micro-spike — your stress hormone crossing the "wake threshold" mid-sleep. Most sleep supplements ignore this entirely. They help you FALL asleep but can\'t keep you there.\n\nSlapen\'s Phase 2 formula creates a cortisol ceiling that prevents the spike. You sleep through. All night. Every night.\n\n60-night guarantee. If you wake up at 3am, we pay.', word_count: 72 },
      { id: 'bc-3', concept: 'concept-3', format: 'Contradiction', primary_text: 'Melatonin doesn\'t "stop working."\n\nIt never addressed your real problem.\n\nYour body produces its own melatonin — plenty of it. The issue? Cortisol is drowning it out. Like trying to hear a whisper in a thunderstorm.\n\nSlapen doesn\'t add more melatonin. It turns down the cortisol. Your natural sleep signal does the rest.\n\nThat\'s why 73% of melatonin users who switch to Slapen report better sleep by night 3.\n\n60 nights. Risk-free. Your cortisol clock will thank you.', word_count: 84 },
      { id: 'bc-4', concept: 'concept-4', format: 'AIDA', primary_text: 'Your Oura says "poor." Your WHOOP says "strained." Your mirror says "exhausted."\n\nYou\'ve optimized diet, exercise, and 14 different supplements. But sleep — the one thing that controls EVERYTHING else — won\'t budge.\n\nHere\'s what your stack is missing: cortisol regulation. Specifically, the 90-minute window before bed when cortisol should drop to near-zero. Yours doesn\'t.\n\nSlapen\'s Dual-Phase formula targets that exact window. Phase 1 lowers cortisol in 20 minutes. Phase 2 prevents the mid-night spike.\n\nDay 6 average improvement: +31 sleep score points.\n\nTrack it with your wearable. 60-night guarantee.', word_count: 108 },
      { id: 'bc-5', concept: 'concept-5', format: 'Story', primary_text: 'Night 1: fell asleep 20 minutes faster. Woke up once.\nNight 3: slept 6.5 hours straight. No 3am wake-up.\nNight 7: 7 hours 42 minutes. Woke before my alarm. Felt... clear.\n\nI\'d tried everything. Melatonin, CBD, magnesium, the apps, the teas, the $200 weighted blanket. Three years of "trying everything."\n\nTurns out I was treating the wrong thing. The problem wasn\'t too little sleep signal. It was too much wake signal. Cortisol. Stuck on daytime mode.\n\nSlapen fixed what everything else couldn\'t.\n\n60 nights risk-free. If you don\'t sleep better, full refund. No questions.', word_count: 111 },
      { id: 'bc-6', concept: 'concept-1', format: 'Short (story)', primary_text: 'My husband falls asleep in 30 seconds.\nI used to lie there for 2 hours, furious.\n\nTurns out we don\'t have different brains.\nWe have different cortisol curves.\n\nHis drops at 9pm. Mine was stuck until 1am.\n\nSlapen fixed the curve. Now I beat him to sleep.\n\n(He\'s slightly annoyed about it.)', word_count: 54 },
      { id: 'bc-7', concept: 'concept-3', format: 'Short (contradiction)', primary_text: 'Stop buying melatonin.\n\nYour body already makes it. The problem is cortisol — it\'s blocking the signal.\n\nSlapen removes the block. Sleep returns naturally.\n\nNo grogginess. No dependency. Just your body doing what it was designed to do.\n\n60-night guarantee.', word_count: 42 },
    ],
    video_scripts: [
      { id: 'vs-1', concept: 'concept-5', hook: '[Looking exhausted, messy bun, morning light] "Okay so I have to talk about what happened on night 3..."', duration: '45-60s', format: 'UGC talking head', script: 'HOOK: [exhausted, messy bun] "Okay so I have to talk about what happened on night 3..."\nPROBLEM: "For 3 years I\'ve been that person lying awake at 2am replaying every conversation from the day. Melatonin, CBD, the apps, the teas — nothing worked."\nDISCOVERY: "Then I found out it\'s not about adding sleep. It\'s about removing the thing keeping you awake. It\'s called cortisol."\nMECHANISM: [holds product] "This has two phases. First one calms cortisol in 20 minutes. Second one keeps it down all night."\nRESULT: [brighter, hair done] "Night 3. Seven hours straight. I woke up before my alarm and I cried."\nCTA: "Link in bio. 60-night guarantee. Just try it."' },
      { id: 'vs-2', concept: 'concept-1', hook: '"Quick question — why does your partner fall asleep in 30 seconds and you lie there for 2 hours?"', duration: '30-45s', format: 'UGC question hook', script: 'HOOK: "Quick question — why does your partner fall asleep in 30 seconds and you lie there for 2 hours?"\nANCHOR: "It\'s not because they\'re more relaxed. It\'s because their cortisol drops at 9pm. Yours doesn\'t."\nMECHANISM: "Slapen fixes the cortisol curve. Phase 1: calms it in 20 min. Phase 2: keeps it down all night."\nSOCIAL PROOF: "2,847 five-star reviews from people who used to be you."\nCTA: "Link below. 60 nights risk-free."' },
      { id: 'vs-3', concept: 'concept-4', hook: '[Oura ring close-up showing 54] "Day 47 of my Oura ring telling me what I already know."', duration: '45-60s', format: 'UGC biohacker', script: 'HOOK: [close-up Oura showing 54] "Day 47 of my Oura ring telling me what I already know."\nSTACK: "I\'m spending $500 a month on supplements. Cold plunge, sauna, morning sunlight, the whole Huberman protocol."\nFRUSTRATION: "Everything\'s optimized. Except the ONE thing that controls all the others."\nREVEAL: "My evening cortisol was still at daytime levels at midnight. Every other supplement was downstream of a broken cortisol rhythm."\nRESULT: [shows Oura 87] "Day 6 after switching to this. 87. I fired my entire sleep stack."\nCTA: "Track it with your wearable. 60-night guarantee."' },
      { id: 'vs-4', concept: 'concept-2', hook: '[Dark room, 3am clock] "It\'s 3:17am. Again."', duration: '30-45s', format: 'UGC atmospheric', script: 'HOOK: [dark room, clock showing 3:17] "It\'s 3:17am. Again."\nPROBLEM: "I fall asleep fine. But every night between 2 and 4am — eyes open, heart racing, brain on fire."\nEXPLANATION: "My sleep doctor called it a \'cortisol micro-spike.\' My stress hormone crosses the wake threshold mid-sleep."\nSOLUTION: "This [holds product] has a Phase 2 that creates a cortisol ceiling. It keeps the spike below the wake line."\nRESULT: "Night 7: slept through to 6:15. No 3am. No heart pounding. First time in 2 years."\nCTA: "Link in bio. If you still wake at 3am, full refund."' },
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
  const presetBriefs = [
    { preset: 'before_after', ids: ['ba-1', 'ba-2', 'ba-3'], names: ['Racing Mind → Peaceful Sleep', 'Zombie Mode → Full Power', 'Dread → Delight'] },
    { preset: 'problem_agitation', ids: ['pa-1', 'pa-2', 'pa-3'], names: ['The 2AM Ceiling Stare', 'The Thought Tornado', 'The Exhaustion Tax'] },
    { preset: 'social_proof', ids: ['sp-1', 'sp-2', 'sp-3'], names: ['Night 3 Turning Point', 'Before/After Testimonial', 'Data-Driven Proof'] },
    { preset: 'us_vs_them', ids: ['uvt-1'], names: ['Melatonin vs Cortisol Reset'] },
    { preset: 'feature_highlight', ids: ['fh-1'], names: ['Dual-Phase Mechanism'] },
    { preset: 'lifestyle_context', ids: ['lc-1'], names: ['Peaceful Evening Ritual'] },
    { preset: 'statistique_data', ids: ['sd-1'], names: ['The Cortisol Gap'] },
    { preset: 'unboxing_product', ids: ['up-1'], names: ['Premium Unboxing'] },
  ];
  const formats: { key: string; w: number; h: number }[] = [
    { key: 'feed_1x1', w: 1080, h: 1080 },
    { key: 'story_9x16', w: 1080, h: 1920 },
    { key: 'vertical_4x5', w: 1080, h: 1350 },
  ];
  const configs: Record<string, unknown>[] = [];
  for (const pb of presetBriefs) {
    for (let i = 0; i < pb.ids.length; i++) {
      for (const fmt of formats) {
        configs.push({
          id: `gen_${pb.ids[i]}_${fmt.key}`,
          source_preset: pb.preset,
          source_brief_id: pb.ids[i],
          brief_name: pb.names[i],
          format: fmt.key,
          model: 'fal-ai/nano-banana-pro',
          width: fmt.w,
          height: fmt.h,
          guidance_scale: 7.5,
          num_images: 2,
          prompt: `High-quality editorial ${pb.preset.replace(/_/g, ' ')} creative for "${pb.names[i]}" — ${fmt.key === 'feed_1x1' ? 'square 1:1' : fmt.key === 'story_9x16' ? 'vertical 9:16 story' : 'vertical 4:5'} composition. Sleep supplement brand, problem-aware audience, premium aesthetic, cinematic lighting.`,
          negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy',
          text_overlays: { headline: pb.names[i], cta: 'Try Slapen Tonight' },
        });
      }
    }
  }
  return {
    generation_batch: {
      metadata: {
        total_configs: configs.length,
        total_images: configs.length * 2,
        awareness_level: 'problem_aware',
        sub_avatar: 'The Exhausted Overthinker',
        generated_at: new Date().toISOString(),
        formats_per_brief: 3,
        images_per_config: 2,
      },
      configs,
      highlighted_configs: [
        { id: 'gen_ba-1_feed_1x1', source_preset: 'before_after', source_brief_id: 'ba-1', brief_name: 'Racing Mind → Peaceful Sleep', format: 'feed_1x1', model: 'fal-ai/nano-banana-pro', prompt: 'Split-screen bedroom scene divided diagonally. Left half: dark moody bedroom at night, woman lying in bed awake with eyes open, cold blue lighting from phone screen showing 2:17am, messy tangled sheets, expression of frustration and exhaustion, desaturated cool blue-gray color palette. Right half: same bedroom in morning, warm golden sunlight streaming through sheer curtains, same woman stretching peacefully with gentle smile, alarm clock showing 6:58am, warm amber and gold tones. Photographic style, intimate eye-level framing, soft focus background, high quality editorial photography.', negative_prompt: 'text, watermark, logo, blurry, deformed, low quality, bad anatomy, extra limbs, ugly, duplicate', width: 1080, height: 1080, guidance_scale: 7.5, num_images: 2, text_overlays: { headline: 'Same bed. Different brain.', subheadline: 'What cortisol regulation feels like', cta: 'Try Slapen Tonight' }, vision_review_prompt: 'Check: 1) Clear split-screen? 2) Emotional contrast visible? 3) Brand colors? 4) Scroll-stopping? Score 1-10.', awareness_check: 'problem_aware: leads with pain recognition, not product features' },
        { id: 'gen_pa-1_feed_1x1', source_preset: 'problem_agitation', source_brief_id: 'pa-1', brief_name: 'The 2AM Ceiling Stare', format: 'feed_1x1', model: 'fal-ai/nano-banana-pro', prompt: 'Extreme close-up of a person\'s wide open eyes in near darkness, faint blue glow reflecting in their irises suggesting a clock display, dark navy and slate blue color palette, expression of exhaustion and frustration, visible dark circles, crisp detail on eyelashes and iris, cinematic moody lighting, editorial photography style, shallow depth of field, dramatic noir atmosphere.', negative_prompt: 'text, watermark, logo, blurry, deformed, bright lighting, happy expression', width: 1080, height: 1080, guidance_scale: 7.5, num_images: 2, text_overlays: { headline: 'Your ceiling knows you too well.', cta: 'Fix The Root Cause' }, vision_review_prompt: 'Check: 1) Eyes visible in darkness? 2) Clock glow in iris? 3) Moody, not horror? Score 1-10.' },
        { id: 'gen_sp-1_story_9x16', source_preset: 'social_proof', source_brief_id: 'sp-1', brief_name: 'Night 3 Turning Point', format: 'story_9x16', model: 'fal-ai/nano-banana-pro', prompt: 'Warm, inviting background with soft golden gradient, abstract soft bokeh light effects suggesting morning warmth and comfort, subtle texture, clean space for text overlay, warm amber and cream tones, gentle lens flare, premium editorial feel, minimalist design aesthetic.', negative_prompt: 'text, watermark, logo, blurry, dark, cold tones, busy background', width: 1080, height: 1920, guidance_scale: 7.5, num_images: 2, text_overlays: { headline: '"Night 3 changed everything."', subheadline: '4.8/5 from 2,847 reviews', cta: 'Read More Reviews' } },
      ],
      post_processing: {
        text_overlay_tool: 'Text overlays added via Figma/Canva — fal.ai does NOT render text reliably',
        quality_checks: ['Resolution >= 1080px', 'No AI artifacts', 'Brand colors present', 'Clear focal point', 'Mobile-friendly at thumbnail size', 'Emotion reads at 400×400 thumbnail'],
      },
      testing_plan: {
        phase_1_presets: ['before_after', 'problem_agitation', 'social_proof'],
        phase_1_headlines: { before_after: 'C (Same bed. Different brain.)', problem_agitation: 'B (Your ceiling knows you too well.)', social_proof: 'A (Night 3 changed everything.)' },
        phase_2_expansion: 'After finding winner, expand to Feature Highlight and Us vs Them',
        phase_3_scaling: 'Winner format × all 3 sub-avatars × 5 awareness levels = 15 variants',
        budget_split: '40% Before/After, 35% Problem/Agitation, 25% Social Proof',
        kill_criteria: 'Any creative with CPA > 2x target after 1,000 impressions gets paused',
      },
    },
  };
}

function demoGate9(): Record<string, unknown> {
  return {
    campaign_blueprint: {
      account_structure: {
        total_campaigns: 5,
        total_ad_sets: 18,
        total_ads: 54,
        framework: 'EVOLVE 5-Campaign Architecture',
        monthly_budget: '$8,250/month ($275/day)',
      },
      campaigns: [
        {
          id: 'camp-1',
          name: 'SLAPEN_EAM_MAIN_CBO',
          type: 'EAM MAIN CBO',
          description: 'Main evergreen acquisition machine. CBO with broad targeting, letting Meta optimize across ad sets. This is where 60% of budget lives.',
          sub_avatar_id: 'all',
          objective: 'Conversions (Purchase)',
          budget: '$150/day CBO',
          optimization: 'Purchase, 7-day click / 1-day view',
          ad_sets: [
            { name: 'SLAPEN_Overthinker_BA_Broad', targeting: 'Broad — Women 28-45, interest expansion ON', placement: 'Advantage+ placements', ads: [
              { name: 'SLAPEN_BA_ba-1_Feed_C', brief_id: 'ba-1', format: 'feed 1:1', headline: 'Same bed. Different brain.', copy_id: 'bc-1' },
              { name: 'SLAPEN_BA_ba-1_Story_C', brief_id: 'ba-1', format: 'story 9:16', headline: 'Same bed. Different brain.', copy_id: 'bc-1' },
              { name: 'SLAPEN_BA_ba-3_Feed_A', brief_id: 'ba-3', format: 'feed 1:1', headline: 'Remember loving bedtime?', copy_id: 'bc-6' },
            ]},
            { name: 'SLAPEN_Overthinker_PA_Broad', targeting: 'Broad — Women 28-45', placement: 'Advantage+ placements', ads: [
              { name: 'SLAPEN_PA_pa-1_Feed_B', brief_id: 'pa-1', format: 'feed 1:1', headline: 'Your ceiling knows you too well.', copy_id: 'bc-2' },
              { name: 'SLAPEN_PA_pa-2_Feed_C', brief_id: 'pa-2', format: 'feed 1:1', headline: 'Tired. Wired. Repeat.', copy_id: 'bc-3' },
              { name: 'SLAPEN_PA_pa-3_Feed_C', brief_id: 'pa-3', format: 'feed 1:1', headline: 'You\'re not tired. You\'re depleted.', copy_id: 'bc-5' },
            ]},
            { name: 'SLAPEN_Overthinker_SP_Broad', targeting: 'Broad — All adults 25-55', placement: 'Advantage+ placements', ads: [
              { name: 'SLAPEN_SP_sp-1_Feed_A', brief_id: 'sp-1', format: 'feed 1:1', headline: '"Night 3 changed everything."', copy_id: 'bc-5' },
              { name: 'SLAPEN_SP_sp-2_Feed_A', brief_id: 'sp-2', format: 'feed 1:1', headline: '"I was a zombie. Now I\'m me."', copy_id: 'bc-1' },
              { name: 'SLAPEN_SP_sp-3_Feed_C', brief_id: 'sp-3', format: 'feed 1:1', headline: 'Rated #1 by overthinkers.', copy_id: 'bc-7' },
            ]},
            { name: 'SLAPEN_Professional_FH_Biohacker', targeting: 'Interest: biohacking, Oura, WHOOP, supplements, nootropics — Men 30-50', placement: 'Advantage+ placements', ads: [
              { name: 'SLAPEN_FH_fh-1_Feed_B', brief_id: 'fh-1', format: 'feed 1:1', headline: '2 phases. 8 hours. Zero grogginess.', copy_id: 'bc-4' },
              { name: 'SLAPEN_SD_sd-1_Feed_C', brief_id: 'sd-1', format: 'feed 1:1', headline: 'Night 1: 47 min faster sleep.', copy_id: 'bc-4' },
            ]},
            { name: 'SLAPEN_NightWatcher_UVT_Broad', targeting: 'Interest: insomnia, sleep aids, melatonin — All 25-55', placement: 'Advantage+ placements', ads: [
              { name: 'SLAPEN_UVT_uvt-1_Feed_C', brief_id: 'uvt-1', format: 'feed 1:1', headline: 'Stop adding sleep. Start removing wake.', copy_id: 'bc-3' },
              { name: 'SLAPEN_UVT_uvt-1_Story_C', brief_id: 'uvt-1', format: 'story 9:16', headline: 'Stop adding sleep. Start removing wake.', copy_id: 'bc-7' },
            ]},
          ],
        },
        {
          id: 'camp-2',
          name: 'SLAPEN_ABO_TESTING',
          type: 'ABO TESTING & SCALING',
          description: 'ABO campaign for testing new creatives, angles, and formats. Each ad set = one creative concept. Winners graduate to Main CBO.',
          sub_avatar_id: 'all',
          objective: 'Conversions (Purchase)',
          budget: '$50/day ABO ($10/ad set)',
          optimization: 'Purchase, 7-day click',
          ad_sets: [
            { name: 'SLAPEN_TEST_UGC_TalkingHead_sa1', targeting: 'Broad — Women 28-45', ads: [
              { name: 'SLAPEN_UGC_vs-1_Reel', format: 'reel 9:16', headline: 'Night 3 talking head', script_id: 'vs-1' },
            ]},
            { name: 'SLAPEN_TEST_UGC_QuestionHook_sa1', targeting: 'Broad — Women 28-45', ads: [
              { name: 'SLAPEN_UGC_vs-2_Reel', format: 'reel 9:16', headline: 'Partner falls asleep in 30s', script_id: 'vs-2' },
            ]},
            { name: 'SLAPEN_TEST_UGC_Biohacker_sa2', targeting: 'Interest: biohacking, supplements — Men 30-50', ads: [
              { name: 'SLAPEN_UGC_vs-3_Reel', format: 'reel 9:16', headline: 'Oura score 54 → 87', script_id: 'vs-3' },
            ]},
            { name: 'SLAPEN_TEST_UGC_3AM_sa3', targeting: 'Interest: insomnia, anxiety — All 25-55', ads: [
              { name: 'SLAPEN_UGC_vs-4_Reel', format: 'reel 9:16', headline: '3:17am atmospheric', script_id: 'vs-4' },
            ]},
            { name: 'SLAPEN_TEST_Lifestyle_sa1', targeting: 'Broad — Women 28-45', ads: [
              { name: 'SLAPEN_LC_lc-1_Feed_A', brief_id: 'lc-1', format: 'feed 1:1', headline: 'This is what calm feels like.', copy_id: 'bc-6' },
            ]},
          ],
        },
        {
          id: 'camp-3',
          name: 'SLAPEN_ZOMBIE_GRAVEYARD',
          type: 'ZOMBIE / GRAVEYARD',
          description: 'Revive underperforming ads with new audiences, new copy, or new formats. Ads that died in Main CBO get a second chance here with different angles.',
          sub_avatar_id: 'all',
          objective: 'Conversions (Purchase)',
          budget: '$25/day ABO',
          optimization: 'Purchase, 7-day click',
          ad_sets: [
            { name: 'SLAPEN_ZOMBIE_BA_Retarget_180d', targeting: 'Website visitors 180d + IG/FB engagers 180d — Exclude purchasers', ads: [
              { name: 'SLAPEN_BA_ba-2_Feed_C_RETARGET', brief_id: 'ba-2', format: 'feed 1:1', headline: 'What 8 hours feels like.', copy_id: 'bc-5' },
            ]},
            { name: 'SLAPEN_ZOMBIE_SP_LAL_Purchase', targeting: 'Lookalike 1% — Purchasers', ads: [
              { name: 'SLAPEN_SP_sp-1_Feed_A_LAL', brief_id: 'sp-1', format: 'feed 1:1', headline: '"Night 3 changed everything."', copy_id: 'bc-5' },
            ]},
          ],
        },
        {
          id: 'camp-4',
          name: 'SLAPEN_RAW_CONTENT',
          type: 'RAW CONTENT',
          description: 'Lo-fi, UGC-first campaign. Raw phone footage, unpolished testimonials, "real person" aesthetic. Often outperforms polished creatives on cold audiences.',
          sub_avatar_id: 'sa-1',
          objective: 'Conversions (Purchase)',
          budget: '$30/day CBO',
          optimization: 'Purchase, 7-day click / 1-day view',
          ad_sets: [
            { name: 'SLAPEN_RAW_Testimonial_Broad', targeting: 'Broad — Women 25-55', ads: [
              { name: 'SLAPEN_RAW_NightStand_TikTok', format: 'reel 9:16', headline: 'POV: Night 3', description: 'Dark bedroom, phone camera, woman whisper-talking about night 3 results. Raw, unedited, authentic.' },
              { name: 'SLAPEN_RAW_BeforeAfter_Split', format: 'reel 9:16', headline: 'Before vs After Slapen', description: 'Day 1 clip (exhausted, messy) vs Day 14 clip (energized, clear-eyed). Same person, same room. Dramatic difference.' },
              { name: 'SLAPEN_RAW_Unboxing_Quick', format: 'reel 9:16', headline: 'Unboxing + first reaction', description: 'Opening package, showing bottle, taking first capsule, quick cut to morning reaction. 15-30s.' },
            ]},
            { name: 'SLAPEN_RAW_ScreenRecord_Broad', targeting: 'Broad — All 25-55', ads: [
              { name: 'SLAPEN_RAW_OuraScreenRecord', format: 'reel 9:16', headline: 'My Oura before/after', description: 'Screen recording of Oura app: sleep score 54 → 87 over 7 days. No face, just data. Voice-over explaining each night.' },
            ]},
          ],
        },
        {
          id: 'camp-5',
          name: 'SLAPEN_PROMO_Q2',
          type: 'PROMO / SEASONAL',
          description: 'Time-limited promotional campaign. Higher urgency copy + offer stacking. Runs during key promo periods (BFCM, New Year, Sleep Awareness Month).',
          sub_avatar_id: 'all',
          objective: 'Conversions (Purchase)',
          budget: '$20/day (scales to $100/day during promo)',
          optimization: 'Purchase, 1-day click',
          ad_sets: [
            { name: 'SLAPEN_PROMO_SleepMonth_Broad', targeting: 'Broad — All 25-55', ads: [
              { name: 'SLAPEN_PROMO_30Off_BA_Feed', brief_id: 'ba-1', format: 'feed 1:1', headline: 'Sleep Month Special: 30% Off', copy: 'March is Sleep Awareness Month. For a limited time, get 30% off your first order of Slapen. Same bed. Different brain. Same science. Better price.\n\nUse code SLEEP30 at checkout. 60-night guarantee still applies.' },
              { name: 'SLAPEN_PROMO_BOGO_SP_Feed', brief_id: 'sp-1', format: 'feed 1:1', headline: 'Buy One, Gift One Free', copy: 'Know someone who can\'t sleep? Buy one Slapen, get one free to gift. Because nobody should lie awake alone.\n\n2,847 five-star reviews. 60-night guarantee. Code: GIFTSLAPEN' },
            ]},
            { name: 'SLAPEN_PROMO_SleepMonth_Retarget', targeting: 'Website visitors 30d + cart abandoners — Exclude purchasers', ads: [
              { name: 'SLAPEN_PROMO_CartRecovery_Feed', format: 'feed 1:1', headline: 'Still awake? Still thinking about it?', copy: 'You visited Slapen. You read the reviews. You almost ordered.\n\nHere\'s your sign: 30% off for Sleep Awareness Month. 60-night guarantee. Zero risk.\n\nThe only thing you lose by trying? Those 2am ceiling-staring sessions.\n\nCode: SLEEP30' },
            ]},
          ],
        },
      ],
      testing_strategy: {
        phase_1: 'Creative testing in ABO — 5 ad sets × 1 creative each × $10/day = $50/day. Run 7 days minimum. Winners = CPA < 1.5x target after 50+ clicks.',
        phase_2: 'Winner scaling — top 3 performers graduate to Main CBO. Budget 3x on winners.',
        phase_3: 'Audience expansion — winning creatives tested on LAL audiences in Zombie campaign.',
        phase_4: 'Format expansion — winning static → UGC version in Raw Content campaign. Winning UGC → static version in Main CBO.',
        success_metrics: { target_cpa: '$35', target_roas: '2.5x', minimum_conversions_per_week: 50, creative_refresh_cycle: '3-4 weeks', winner_graduation_threshold: 'CPA < $30 after 100 conversions' },
      },
      naming_conventions: {
        campaign: 'BRAND_CampaignType',
        ad_set: 'BRAND_CampaignType_Preset_Targeting',
        ad: 'BRAND_Preset_BriefID_Format_HeadlineVariant',
        examples: [
          'Campaign: SLAPEN_EAM_MAIN_CBO',
          'Ad Set: SLAPEN_Overthinker_BA_Broad',
          'Ad: SLAPEN_BA_ba-1_Feed_C',
        ],
      },
      scaling_playbook: {
        rules: [
          'Wait for 50+ conversions before judging any creative',
          'Scale winning ad sets by 20% every 3 days (never more than 20%)',
          'Kill underperformers at 2x target CPA after 1,000+ impressions',
          'Expand to LAL audiences after finding 3+ winning creatives',
          'Duplicate winners to new ad sets (don\'t edit live winners)',
          'Refresh top performers every 3-4 weeks with new headlines or formats',
          'Never pause a winning creative — move it to Zombie if fatigued',
          'Test UGC version of every winning static (and vice versa)',
        ],
        budget_allocation: {
          main_cbo: '55% ($150/day)',
          abo_testing: '18% ($50/day)',
          raw_content: '11% ($30/day)',
          zombie: '9% ($25/day)',
          promo: '7% ($20/day, scales during promos)',
        },
        graduation_flow: 'ABO Testing → (winner) → Main CBO → (fatigue) → Zombie Graveyard → (revived) → Main CBO with new angle',
      },
      meta_account_settings: {
        pixel: 'SLAPEN_MainPixel',
        attribution: '7-day click / 1-day view (default for all campaigns)',
        conversion_api: 'Enabled via Shopify CAPI integration',
        automated_rules: [
          { name: 'Kill Low Performers', condition: 'CPA > $70 AND impressions > 1,000', action: 'Pause ad set' },
          { name: 'Scale Winners', condition: 'CPA < $25 AND conversions > 20 in last 3 days', action: 'Increase budget 20%' },
          { name: 'Creative Fatigue Alert', condition: 'CTR drops 30% from 7-day average', action: 'Send notification' },
        ],
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
