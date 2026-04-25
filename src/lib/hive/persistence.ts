// ============================================================
// PAWEN — Phase W — Hive persistence (Neon)
// Lazy CREATE TABLE IF NOT EXISTS for `brands` + `winning_patterns`.
// All queries are idempotent + safe when HIVE_ENABLED=0.
// ============================================================

import 'server-only';
import { getSql } from '../db/client';
import type { Brand, WinningPattern } from './types';

export async function ensureHiveSchema(): Promise<void> {
  const sql = getSql();
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
  await sql`CREATE INDEX IF NOT EXISTS brands_owner_idx ON brands (owner_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS winning_patterns (
      id                   TEXT PRIMARY KEY,
      source_brand_id      TEXT NOT NULL,
      gate_id              TEXT NOT NULL,
      generalized_pattern  JSONB NOT NULL,
      metrics              JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS winning_patterns_brand_idx ON winning_patterns (source_brand_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS winning_patterns_gate_idx ON winning_patterns (gate_id, created_at DESC)`;

  // H.1 — additive column on projects_mirror so projects can be scoped
  // to a brand. Safe no-op if already applied. Legacy rows stay brand_id=NULL
  // (treated as "no brand" by the single-user flow).
  try {
    await sql`ALTER TABLE IF EXISTS projects_mirror ADD COLUMN IF NOT EXISTS brand_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS projects_mirror_brand_idx ON projects_mirror (brand_id)`;
  } catch {
    /* projects_mirror may not exist yet in dev — non-fatal */
  }
}

export async function upsertBrand(b: Brand): Promise<void> {
  await ensureHiveSchema();
  const sql = getSql();
  await sql`
    INSERT INTO brands (id, owner_id, name, niche, language, avatar_emoji, color_hex, shares_patterns, created_at, updated_at)
    VALUES (${b.id}, ${b.ownerId}, ${b.name}, ${b.niche ?? null}, ${b.language ?? null},
            ${b.avatarEmoji}, ${b.colorHex}, ${b.sharesPatterns}, ${b.createdAt}, ${b.updatedAt})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      niche = EXCLUDED.niche,
      language = EXCLUDED.language,
      avatar_emoji = EXCLUDED.avatar_emoji,
      color_hex = EXCLUDED.color_hex,
      shares_patterns = EXCLUDED.shares_patterns,
      updated_at = NOW()
  `;
}

export async function listBrands(): Promise<Brand[]> {
  try {
    await ensureHiveSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, owner_id, name, niche, language, avatar_emoji, color_hex,
             shares_patterns, created_at, updated_at
      FROM brands
      ORDER BY created_at ASC
      LIMIT 100
    `) as Array<{
      id: string; owner_id: string; name: string; niche: string | null; language: string | null;
      avatar_emoji: string; color_hex: string; shares_patterns: boolean;
      created_at: string; updated_at: string;
    }>;
    return rows.map(r => ({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      niche: r.niche ?? undefined,
      language: r.language ?? undefined,
      avatarEmoji: r.avatar_emoji,
      colorHex: r.color_hex,
      sharesPatterns: r.shares_patterns,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function getBrand(id: string): Promise<Brand | null> {
  try {
    await ensureHiveSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, owner_id, name, niche, language, avatar_emoji, color_hex,
             shares_patterns, created_at, updated_at
      FROM brands WHERE id = ${id} LIMIT 1
    `) as Array<{
      id: string; owner_id: string; name: string; niche: string | null; language: string | null;
      avatar_emoji: string; color_hex: string; shares_patterns: boolean;
      created_at: string; updated_at: string;
    }>;
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id, ownerId: r.owner_id, name: r.name,
      niche: r.niche ?? undefined, language: r.language ?? undefined,
      avatarEmoji: r.avatar_emoji, colorHex: r.color_hex, sharesPatterns: r.shares_patterns,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  } catch {
    return null;
  }
}

export async function insertWinningPattern(p: WinningPattern): Promise<void> {
  await ensureHiveSchema();
  const sql = getSql();
  await sql`
    INSERT INTO winning_patterns (id, source_brand_id, gate_id, generalized_pattern, metrics, created_at)
    VALUES (${p.id}, ${p.sourceBrandId}, ${p.gateId},
            ${JSON.stringify(p.generalizedPattern)}::jsonb,
            ${JSON.stringify(p.metrics)}::jsonb,
            ${p.createdAt})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function listWinningPatterns(opts: { brandId?: string; gateId?: string; limit?: number } = {}): Promise<WinningPattern[]> {
  try {
    await ensureHiveSchema();
    const sql = getSql();
    const limit = opts.limit ?? 50;
    let rows;
    if (opts.brandId) {
      rows = (await sql`
        SELECT id, source_brand_id, gate_id, generalized_pattern, metrics, created_at
        FROM winning_patterns
        WHERE source_brand_id = ${opts.brandId}
        ORDER BY created_at DESC LIMIT ${limit}
      `) as Array<{ id: string; source_brand_id: string; gate_id: string; generalized_pattern: WinningPattern['generalizedPattern']; metrics: WinningPattern['metrics']; created_at: string }>;
    } else if (opts.gateId) {
      rows = (await sql`
        SELECT id, source_brand_id, gate_id, generalized_pattern, metrics, created_at
        FROM winning_patterns
        WHERE gate_id = ${opts.gateId}
        ORDER BY created_at DESC LIMIT ${limit}
      `) as Array<{ id: string; source_brand_id: string; gate_id: string; generalized_pattern: WinningPattern['generalizedPattern']; metrics: WinningPattern['metrics']; created_at: string }>;
    } else {
      rows = (await sql`
        SELECT id, source_brand_id, gate_id, generalized_pattern, metrics, created_at
        FROM winning_patterns
        ORDER BY created_at DESC LIMIT ${limit}
      `) as Array<{ id: string; source_brand_id: string; gate_id: string; generalized_pattern: WinningPattern['generalizedPattern']; metrics: WinningPattern['metrics']; created_at: string }>;
    }
    return rows.map(r => ({
      id: r.id,
      sourceBrandId: r.source_brand_id,
      gateId: r.gate_id,
      generalizedPattern: r.generalized_pattern,
      metrics: r.metrics,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// Stub: full detection will sit behind HIVE_ENABLED and read from
// ad_performance_snapshots + gate outputs. Today a no-op.
export async function createWinningPattern(_args: { brandId: string; gateId: string }): Promise<WinningPattern | null> {
  return null;
}
