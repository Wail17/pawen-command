// Seed the Hive with 6 default brands + app_users.
// Idempotent: ON CONFLICT DO NOTHING on inserts. Safe to re-run.
//
// Usage:
//   npx -y dotenv-cli -e .env.local -- node scripts/seed-hive-users.mjs
//
// Prints the generated temp passwords to stdout ONCE. Store them in your
// password manager immediately — they are hashed before going to the DB.
//
// NOTE: HIVE_ENABLED can be OFF when running this. Seeding the tables is
// independent of the feature flag. Flip the flag after seeding.

import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const USERS = [
  { username: 'sykss',    brandName: 'Sykss',    emoji: '🏝️', color: '#FF8A00' },
  { username: 'maghrabi', brandName: 'Maghrabi', emoji: '🌴', color: '#2DD4BF' },
  { username: 'suley',    brandName: 'Suley',    emoji: '⛰️', color: '#A78BFA' },
  { username: 'stavo',    brandName: 'Stavo',    emoji: '🗿', color: '#F472B6' },
  { username: 'many',     brandName: 'Many',     emoji: '🏖️', color: '#FBBF24' },
  { username: 'amlee',    brandName: 'Amlee',    emoji: '🌋', color: '#EF4444' },
];

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error('DATABASE_URL missing. Run via: npx -y dotenv-cli -e .env.local -- node scripts/seed-hive-users.mjs');
  process.exit(1);
}
const sql = neon(DB);

// Same scheme as existing app_users: PBKDF2-SHA256, 100k iters, 16-byte salt.
// See src/lib/auth/session.ts for the hashing scheme reference.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return `pbkdf2$sha256$100000$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function genPassword() {
  // 16 chars, URL-safe base64, cryptographically random.
  return crypto.randomBytes(12).toString('base64url');
}

function uuid() {
  return crypto.randomUUID();
}

async function ensureSchema() {
  // app_users is assumed to already exist in prod. Brands is Phase W new.
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      name           TEXT PRIMARY KEY,
      password_hash  TEXT,
      role           TEXT NOT NULL DEFAULT 'user',
      enabled        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS brands (
      id              TEXT PRIMARY KEY,
      owner_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      niche           TEXT,
      language        TEXT,
      avatar_emoji    TEXT NOT NULL DEFAULT '🏝️',
      color_hex       TEXT NOT NULL DEFAULT '#FF8A00',
      shares_patterns BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS brands_owner_uniq ON brands (owner_id)`;
}

async function main() {
  await ensureSchema();

  // Login uses a single global APP_PASSWORD env var; app_users is just the
  // pickable username registry. The hashPassword helper is kept for if/when
  // per-user passwords land, but is unused today.
  void hashPassword; void genPassword;

  console.log('\n=== Hive seed — creating brands + app_user rows ===\n');
  for (const u of USERS) {
    await sql`
      INSERT INTO app_users (name, role, enabled)
      VALUES (${u.username}, ${u.username === 'sykss' ? 'admin' : 'user'}, TRUE)
      ON CONFLICT (name) DO NOTHING
    `;

    const brandId = uuid();
    await sql`
      INSERT INTO brands (id, owner_id, name, avatar_emoji, color_hex, shares_patterns)
      VALUES (${brandId}, ${u.username}, ${u.brandName}, ${u.emoji}, ${u.color}, TRUE)
      ON CONFLICT DO NOTHING
    `;
    // Fetch the actual row (in case one existed already with a different id)
    const rows = await sql`SELECT id FROM brands WHERE owner_id = ${u.username} LIMIT 1`;
    const actualId = rows[0]?.id ?? brandId;

    console.log(`  ${u.emoji}  ${u.username.padEnd(10)}  brand=${u.brandName.padEnd(10)}  brand_id=${actualId}`);
  }
  console.log('\nDone. Login uses APP_PASSWORD globally — pick username at login screen.\n');
}

await main();
