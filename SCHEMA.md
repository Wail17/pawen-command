# Database Schema — current state

All Postgres tables are created lazily via `CREATE TABLE IF NOT EXISTS` in the routes that first use them. No Drizzle-managed schema file is authoritative — the routes ARE the schema.

## Mermaid — Neon tables

```mermaid
erDiagram
  app_users ||--o{ projects_mirror : owns
  app_users ||--o{ gate_outputs_mirror : owns
  app_users ||--o{ login_attempts : tries
  app_users ||--o{ audit_log : acts

  projects_mirror ||--o{ gate_outputs_mirror : has
  projects_mirror ||--o{ conversations_mirror : hosts
  projects_mirror ||--o{ ad_performance_snapshots : tracks
  projects_mirror ||--o{ rerun_queue : queues
  projects_mirror ||--o{ scrape_health : logs

  conversations_mirror ||--o{ conversation_messages_mirror : contains

  persona_distillations_mirror ||--|| AGENT_PERSONAS : per-agent
  agent_constitutions_mirror ||--|| AGENT_PERSONAS : per-agent

  app_users {
    text name PK
    text password_hash
    text role
    boolean enabled
    timestamptz created_at
  }

  projects_mirror {
    text id PK
    text owner
    text name
    jsonb data
    timestamptz created_at
    timestamptz updated_at
  }

  gate_outputs_mirror {
    text id PK
    text project_id FK
    text gate_id
    text owner
    text status
    jsonb data
    timestamptz created_at
    timestamptz updated_at
  }

  conversations_mirror {
    text id PK
    text project_id FK
    text title
    text status
    text initiator
    text topic
    jsonb data
    timestamptz created_at
    timestamptz closed_at
    int message_count
    int token_cost
    numeric cost_usd
  }

  conversation_messages_mirror {
    text id PK
    text conversation_id FK
    text author_type
    text author_id
    text content
    jsonb data
    timestamptz created_at
  }

  persona_distillations_mirror {
    text agent_id PK
    int version
    jsonb data
    timestamptz generated_at
    timestamptz updated_at
  }

  agent_constitutions_mirror {
    text agent_id PK
    int version
    jsonb data
    timestamptz generated_at
    timestamptz updated_at
  }

  ad_performance_snapshots {
    bigserial id PK
    text project_id FK
    text campaign_id
    timestamptz pulled_at
    text window_preset
    numeric spend
    bigint impressions
    numeric ctr
    numeric cpa
    numeric roas
    bigint conversions
    jsonb raw
  }

  rerun_queue {
    bigserial id PK
    text project_id FK
    text gate_id
    text reason
    text severity
    text source
    text status
    timestamptz created_at
    timestamptz picked_at
    text claimed_by
  }

  scrape_cache {
    text url_hash PK
    text url
    text markdown
    jsonb metadata
    timestamptz fetched_at
    timestamptz expires_at
    int hit_count
  }

  scrape_health {
    bigserial id PK
    text source
    text provider
    boolean success
    int latency_ms
    int items
    numeric avg_quality
    int chunks_injected
    int chunks_used
    numeric utilization
    text error_message
    timestamptz created_at
  }

  login_attempts {
    bigserial id PK
    text ip
    boolean success
    timestamptz created_at
  }

  audit_log {
    bigserial id PK
    text user_name
    text action
    jsonb details
    text ip
    text user_agent
    timestamptz created_at
  }
```

## IndexedDB stores (client-side, version 10)

| Store | KeyPath | Indexes | Phase |
| - | - | - | - |
| `projects` | `id` | `by-updated` | v1 |
| `gateOutputs` | `_key` | `by-project` | v1 |
| `images` | `id` | `by-project` | v1 |
| `knowledge` | `id` | `by-source`, `by-category` | v2 |
| `trainingSources` | `id` | — | v2 |
| `agentMemory` | `id` | `by-agent`, `by-project` | v2 |
| `trainingChunks` | `id` | `by-source`, `by-similarity-hash` (v10) | v3 / v10 |
| `goldOutputs` | `id` | `by-gate`, `by-niche`, `by-project` | v4 |
| `learningProfile` | `id` | — | v4 |
| `templates` | `id` | `by-project`, `by-category` | v5 |
| `videoAds` | `id` | `by-project` | v6 |
| `swipeVault` | `id` | `by-status`, `by-niche`, `by-format`, `by-awareness` | v7 |
| `personaDistillations` | `agentId` | — | v8 (Phase U.1) |
| `agentConstitutions` | `agentId` | — | v8 (Phase U.2) |
| `scoutLedger` | `id` | `by-project`, `by-day` | v8 (Phase U.3) |
| `conversations` | `id` | `by-project`, `by-status` | v9 (Phase V) |
| `conversationMessages` | `id` | `by-conversation` | v9 (Phase V) |

Source of truth: `src/lib/store/db.ts`.
