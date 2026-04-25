// ============================================================
// PAWEN — Canonical constants
//
// Single source of truth for magic numbers scattered across the
// codebase. Import from here rather than redeclaring inline.
// Additive only — legacy hardcoded values stay in place; new code
// should reference these.
// ============================================================

// --- Phase U (autonomy) ---
export const CONSTITUTION_REFRESH_DEFAULT = 10;                 // gate runs per agent
export const SCOUT_DAILY_CAP_DEFAULT = 20;                      // scout calls per project per day
export const SCOUT_PER_GATE_CAP_DEFAULT = 3;                    // scout calls per gate run
export const SCOUT_MAX_JOB_COST_USD_DEFAULT = 2;                // hard stop per Scout job

// --- Phase V (conversations) ---
export const CONVERSATION_COST_CEILING_USD_DEFAULT = 5;         // $/conversation
export const CONVERSATION_MAX_MESSAGES_DEFAULT = 30;            // hard cap on authored messages
export const CONVERSATION_THREAD_TRIM = 15;                     // last N messages shown to the model
export const CONVERSATION_PING_PONG_WINDOW = 4;                 // messages in the A-B-A-B detector window
export const CONVERSATION_SYSTEM_COOLDOWN_HOURS = 6;            // 1 system-trigger per project per 6h
export const CONVERSATION_MAX_CHAIN_DEFAULT = 5;                // agent turns per user post

// --- Phase U.4 (scraping) ---
export const SCRAPE_CACHE_TTL_HOURS_DEFAULT = 12;
export const EMBEDDING_DEDUP_THRESHOLD = 0.92;                  // cosine similarity → collapse
export const QUALITY_SCORE_HIGH = 60;                           // ≥ this = prioritized
export const QUALITY_SCORE_LOW  = 30;                           // < this = drop unless desperate
export const PROVIDER_HEALTH_TTL_MS = 60_000;                   // cache health checks 60s
export const DISTILLATION_MAX_INPUT_CHARS = 180_000;

// --- Phase W (Hive) — placeholder caps for when the flag flips on ---
export const HIVE_BRAND_CAP = 50;                               // brands per Hive
export const HIVE_WINNING_PATTERN_LIMIT = 50;                   // patterns per listing

// --- Auth / security ---
export const SESSION_MIN_SECRET_LEN = 32;
export const LOGIN_FAIL_WINDOW_MIN = 15;
export const LOGIN_MAX_FAILS = 5;
export const RATE_LIMIT_GLOBAL_PER_MIN = 120;
export const RATE_LIMIT_HEAVY_PER_MIN = 30;

// --- Vendor URLs (stable enough to centralize) ---
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const ANTHROPIC_BETA_CACHING = 'prompt-caching-2024-07-31';

// Phase U island avatar + color palettes (seed-hive-users.mjs references)
export const HIVE_ISLAND_EMOJIS = ['🏝️', '🌴', '⛰️', '🗿', '🏖️', '🌋'];
export const HIVE_ISLAND_COLORS = ['#FF8A00', '#2DD4BF', '#A78BFA', '#F472B6', '#FBBF24', '#EF4444'];
