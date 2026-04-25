# API Routes — auto-generated inventory

Generated: 2026-04-25. Source of truth: Next build output.

## Auth + Session

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/auth/login` | public (rate-limited 5/15min/IP) | Two-step: password + user |
| POST | `/api/auth/logout` | public | Clears session cookie |
| GET  | `/api/auth/me` | session | Current session info |
| GET  | `/api/auth/users` | public (audit flagged) | User list |

## Admin (god panel)

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/admin/login` | public (no rate-limit — audit flagged) | Returns admin token |
| GET  | `/api/admin/users` | admin | Full user list with roles |
| GET  | `/api/admin/projects` | admin | All users' projects |
| GET  | `/api/admin/projects/[id]` | admin | Drill-down |
| GET  | `/api/admin/overview` | admin | Counts + recent activity |
| GET  | `/api/admin/audit` | admin | Paginated audit log |
| GET  | `/api/admin/login-attempts` | admin | Failed login IPs |
| POST | `/api/admin/db-migrate` | admin (session OR x-admin-token) | Runs Drizzle migrations |
| POST | `/api/admin/env` | admin | Read/write env summary |
| POST | `/api/admin/watermark-check` | admin | Extract watermark from leak |
| POST | `/api/admin/distill` | admin (dual auth) | Phase U.1 — Opus distillation |
| POST | `/api/admin/update-constitution` | session | Phase U.2 — Sonnet constitution |
| GET  | `/api/admin/conversations-stats` | admin | Phase V.8 — 24h + 7d counts |
| GET  | `/api/admin/scraping-health` | admin | Phase U.4.8 — provider + source stats |

## Sync (Neon mirror)

| Method | Path | Auth | Notes |
| - | - | - | - |
| GET  | `/api/sync/bootstrap` | session | Hydrate IDB on fresh device |
| POST | `/api/sync/project` | session | Mirror project with watermark |
| POST | `/api/sync/gate-output` | session | Mirror gate output with watermark |
| POST,GET | `/api/sync/persona-distillation` | session | Phase U.1 mirror |
| POST,GET | `/api/sync/agent-constitution` | session | Phase U.2 mirror |

## Avatars (Gate 1 enrichments)

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/avatars/start` | session | Kick off excavation |
| POST | `/api/avatars/classify` | session | Sub-avatar classification |
| POST | `/api/avatars/awareness` | session | 5 Schwartz-level variant |
| POST | `/api/avatars/deep-dive` | session | Re-runnable deep dive |
| POST | `/api/avatars/enrich-reverse` | session | Reverse enrichment |
| POST | `/api/avatars/localize` | session | Cultural adaptation |
| GET  | `/api/avatars/jobs/*` | session | Job polling |

## Pipeline / Gates

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/generate` | session | Generic Claude call + advisor |
| POST | `/api/review` | session | Reviewer/director pass |
| POST | `/api/congruence` | session | Brand DNA congruence |
| POST | `/api/compile-dna` | session | Brand DNA compile |
| POST | `/api/curate` | session | Curate contributions |
| GET  | `/api/curated-prefix/*` | session | Curated knowledge per agent |

## Conversations (Phase V)

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/conversations/start` | session (+ flag) | Create conv + first message |
| POST | `/api/conversations/[id]/message` | session (+ flag) | User post + chain dispatch |
| GET  | `/api/conversations/[id]` | session | Full thread |
| GET  | `/api/conversations` | session | List for a project |
| POST | `/api/conversations/[id]/close` | session | User-initiated close |

## Scraping (Phase U.4)

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/scraping/fetch` | session | Unified source dispatcher |
| POST | `/api/scraping/feedback` | session | Utilization feedback |

## Sources (raw scrapers)

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/scrape` | session | Firecrawl |
| POST | `/api/search` | session | Tavily (legacy) |
| POST | `/api/reddit` | session | Reddit OAuth/Apify |
| POST | `/api/youtube` | session | YouTube Data API |
| POST | `/api/facebook` | session | |
| POST | `/api/instagram` | session | |
| POST | `/api/tiktok` | session | Apify TikTok (legacy) |
| POST | `/api/amazon-reviews` | session | Apify Amazon (legacy) |
| POST | `/api/shopify` | session | Public JSON |
| POST | `/api/shopify-oauth` | session | OAuth install flow |
| POST | `/api/shopify-theme` | session | Theme editor backend |
| POST | `/api/brandsearch` | session | BrandSearch API |
| POST | `/api/meta-ads` | session | Graph ads_archive (U.4) |
| GET  | `/api/tools/trustpilot` | session | |

## Creatives / Export

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/imagegen` | session | fal.ai proxy |
| POST | `/api/video/animate` | session | Video gen |
| POST | `/api/video/script` | session | Video script |
| POST | `/api/carousels/generate` | session | |
| POST | `/api/emails/generate` | session | |
| POST | `/api/ugc-briefs/generate` | session | |
| POST | `/api/offer-stack/generate` | session | |
| POST | `/api/translate` | session | |
| POST | `/api/analyze-ad` | session | Competitor ad analysis |
| POST | `/api/ad-cloner` | session | 3-step flow |
| POST | `/api/template-edit` | session | SSE streaming |
| POST | `/api/context/import` | session | |

## Phase U.3 — Autonomous ops

| Method | Path | Auth | Notes |
| - | - | - | - |
| GET  | `/api/cron/meta-perf` | x-cron-secret | Daily Meta perf pull |
| GET  | `/api/rerun/pending` | session | List pending reruns |
| POST | `/api/rerun/claim` | session | Claim / mark done |
| POST | `/api/scout` | session | Scout planning (Sonnet) |

## Ops

| Method | Path | Auth | Notes |
| - | - | - | - |
| POST | `/api/notify/discord` | session | Discord webhook |
| POST | `/api/presence` | session | Online ping |
| POST | `/api/contribute` | session | File upload → Blob |
