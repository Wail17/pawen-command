// ============================================================
// PAWEN — /api/hive/state   (Phase W stub)
// Returns the full hive snapshot: brands + live status. When
// HIVE_ENABLED=0 returns a mocked payload the UI can render.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { isHiveEnabled } from '@/lib/learning/autonomousMode';
import { listBrands } from '@/lib/hive/persistence';
import type { Brand, BrandLiveStatus } from '@/lib/hive/types';

export const maxDuration = 15;

const MOCK_BRANDS: Brand[] = [
  { id: 'mock-1', ownerId: 'sykss',     name: 'Sykss',       avatarEmoji: '🏝️', colorHex: '#FF8A00', sharesPatterns: true, createdAt: '', updatedAt: '' },
  { id: 'mock-2', ownerId: 'maghrabi',  name: 'Maghrabi',    avatarEmoji: '🌴', colorHex: '#2DD4BF', sharesPatterns: true, createdAt: '', updatedAt: '' },
  { id: 'mock-3', ownerId: 'suley',     name: 'Suley',       avatarEmoji: '⛰️', colorHex: '#A78BFA', sharesPatterns: true, createdAt: '', updatedAt: '' },
  { id: 'mock-4', ownerId: 'alex',      name: 'Alex (8lab)', avatarEmoji: '🌊', colorHex: '#06B6D4', sharesPatterns: true, createdAt: '', updatedAt: '' },
  { id: 'mock-5', ownerId: 'road',      name: 'Road',        avatarEmoji: '🏔️', colorHex: '#10B981', sharesPatterns: true, createdAt: '', updatedAt: '' },
  { id: 'mock-6', ownerId: 'bradriley', name: 'Brad Riley',  avatarEmoji: '🍍', colorHex: '#F97316', sharesPatterns: true, createdAt: '', updatedAt: '' },
];

function mockStatus(b: Brand): BrandLiveStatus {
  return {
    brandId: b.id,
    activeAgents: [],
    projectsCount: 0,
    winningPatternCount: 0,
    lastActivityAt: undefined,
  };
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  if (!isHiveEnabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      brands: MOCK_BRANDS,
      statuses: MOCK_BRANDS.map(mockStatus),
      note: 'HIVE_ENABLED=0 — returning mock data so /hive can render in dev.',
    });
  }

  const brands = await listBrands();
  return NextResponse.json({
    ok: true,
    enabled: true,
    brands,
    statuses: brands.map(mockStatus), // live status still a placeholder — Phase W.next
  });
}
