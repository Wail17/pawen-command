// ============================================================
// AutoEcom Lab — Schema migration (idempotent)
// Run via: POST /api/admin/db-migrate (admin only).
// Using a route instead of a standalone script avoids the
// tsx/dotenv dance — Next.js already has DATABASE_URL loaded
// at runtime on Vercel.
// ============================================================

import 'server-only';
import { getSql } from './client';

// Initial user seed. Sykss is admin ("last word A-Z"); everyone else starts
// as a plain user with a generous default quota. The admin can edit any row
// from the god panel at /admin after first login.
const SEED_USERS: Array<{ name: string; role: 'admin' | 'user' }> = [
  { name: 'Sykss',    role: 'admin' },
  { name: 'AIO',      role: 'user'  },
  { name: 'Amlee',    role: 'user'  },
  { name: 'Mee6',     role: 'user'  },
  { name: 'Serum',    role: 'user'  },
  { name: 'Stavo',    role: 'user'  },
  { name: 'Suley',    role: 'user'  },
  { name: 'Zaza',     role: 'user'  },
  { name: 'Knd',      role: 'user'  },
  { name: 'Maghrabi', role: 'user'  },
  { name: 'Many',     role: 'user'  },
  { name: 'Seven',    role: 'user'  },
  { name: 'Soso',     role: 'user'  },
];

export async function runMigrations(): Promise<{ applied: string[] }> {
  const sql = getSql();
  const applied: string[] = [];

  // --- contributions -----------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS contributions (
      id               TEXT PRIMARY KEY,
      contributor      TEXT NOT NULL,
      agent_id         TEXT NOT NULL,
      type             TEXT NOT NULL,
      title            TEXT NOT NULL,
      content          TEXT NOT NULL,
      tags             TEXT[] NOT NULL DEFAULT '{}',
      attachment_url   TEXT,
      attachment_name  TEXT,
      attachment_size  BIGINT,
      attachment_type  TEXT,
      status           TEXT NOT NULL DEFAULT 'pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('contributions');

  await sql`CREATE INDEX IF NOT EXISTS contributions_agent_status_idx
            ON contributions (agent_id, status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS contributions_contributor_idx
            ON contributions (contributor, created_at DESC)`;

  // --- curated_knowledge -------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS curated_knowledge (
      id                       TEXT PRIMARY KEY,
      agent_id                 TEXT NOT NULL,
      type                     TEXT NOT NULL,
      title                    TEXT NOT NULL,
      content                  TEXT NOT NULL,
      tags                     TEXT[] NOT NULL DEFAULT '{}',
      source_contribution_ids  TEXT[] NOT NULL DEFAULT '{}',
      source_contributors      TEXT[] NOT NULL DEFAULT '{}',
      approved_by              TEXT NOT NULL,
      approved_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version                  INTEGER NOT NULL DEFAULT 1
    )
  `;
  applied.push('curated_knowledge');

  await sql`CREATE INDEX IF NOT EXISTS curated_agent_idx
            ON curated_knowledge (agent_id, approved_at DESC)`;

  // --- curation_runs -----------------------------------------
  await sql`
    CREATE TABLE IF NOT EXISTS curation_runs (
      id                TEXT PRIMARY KEY,
      agent_id          TEXT NOT NULL,
      pending_count     INTEGER NOT NULL DEFAULT 0,
      merged_count      INTEGER NOT NULL DEFAULT 0,
      approved_count    INTEGER NOT NULL DEFAULT 0,
      rejected_count    INTEGER NOT NULL DEFAULT 0,
      claude_reasoning  TEXT NOT NULL DEFAULT '',
      run_by            TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('curation_runs');

  // --- app_users ---------------------------------------------
  // Server-side user registry. The old hardcoded APP_USERS list in
  // src/lib/auth/users.ts was client-side only — anyone could forge
  // a user tag. This table is the authoritative source; proxy.ts
  // reads from it and the god panel /admin manages it.
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      name                TEXT PRIMARY KEY,
      role                TEXT NOT NULL DEFAULT 'user'
                          CHECK (role IN ('admin', 'user', 'blocked')),
      enabled             BOOLEAN NOT NULL DEFAULT TRUE,
      quota_monthly_usd   NUMERIC(10,4) NOT NULL DEFAULT 100.0,
      quota_used_usd      NUMERIC(10,4) NOT NULL DEFAULT 0.0,
      quota_reset_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes               TEXT NOT NULL DEFAULT '',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at        TIMESTAMPTZ,
      last_seen_ip        TEXT
    )
  `;
  applied.push('app_users');

  // Idempotent seed — ONLY inserts missing users, never overwrites
  // an existing row (so admin edits survive re-migrations).
  for (const u of SEED_USERS) {
    await sql`
      INSERT INTO app_users (name, role)
      VALUES (${u.name}, ${u.role})
      ON CONFLICT (name) DO NOTHING
    `;
  }
  applied.push('app_users_seed');

  // --- audit_log ---------------------------------------------
  // Every sensitive action writes one row. The god panel queries
  // this for the "who did what" view. JSONB for flexible payloads.
  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          BIGSERIAL PRIMARY KEY,
      user_name   TEXT NOT NULL,
      action      TEXT NOT NULL,
      details     JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip          TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('audit_log');

  await sql`CREATE INDEX IF NOT EXISTS audit_log_user_idx
            ON audit_log (user_name, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS audit_log_action_idx
            ON audit_log (action, created_at DESC)`;

  // --- projects_mirror ---------------------------------------
  // Server-side mirror of every Project a user creates locally in
  // IndexedDB. Written by /api/sync/project on every saveProject().
  // The god panel reads from here — this is how admin sees EVERY
  // avatar, sub-avatar and gate input across all users.
  await sql`
    CREATE TABLE IF NOT EXISTS projects_mirror (
      id          TEXT PRIMARY KEY,
      owner       TEXT NOT NULL,
      name        TEXT NOT NULL,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('projects_mirror');

  await sql`CREATE INDEX IF NOT EXISTS projects_mirror_owner_idx
            ON projects_mirror (owner, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS projects_mirror_updated_idx
            ON projects_mirror (updated_at DESC)`;

  // --- gate_outputs_mirror -----------------------------------
  // Server-side mirror of every GateOutput. Key is "projectId:gateId"
  // to match the IndexedDB keying. data JSONB holds the full output.
  await sql`
    CREATE TABLE IF NOT EXISTS gate_outputs_mirror (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      gate_id     TEXT NOT NULL,
      owner       TEXT NOT NULL,
      status      TEXT NOT NULL,
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('gate_outputs_mirror');

  await sql`CREATE INDEX IF NOT EXISTS gate_outputs_mirror_project_idx
            ON gate_outputs_mirror (project_id, gate_id)`;
  await sql`CREATE INDEX IF NOT EXISTS gate_outputs_mirror_owner_idx
            ON gate_outputs_mirror (owner, updated_at DESC)`;

  // --- login_attempts ----------------------------------------
  // Brute-force protection. proxy.ts / login route checks this
  // table before accepting a password attempt.
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id          BIGSERIAL PRIMARY KEY,
      ip          TEXT NOT NULL,
      success     BOOLEAN NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  applied.push('login_attempts');

  await sql`CREATE INDEX IF NOT EXISTS login_attempts_ip_idx
            ON login_attempts (ip, created_at DESC)`;

  return { applied };
}
