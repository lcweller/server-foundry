# Data Model

Drizzle schema for Server Foundry. Lives in `src/server/db/schema.ts`.

## Conventions

- Table names: `snake_case`, plural (e.g., `users`, `hosts`, `game_servers`)
- Column names: `snake_case`
- Primary keys: `id` of type `uuid`, default `gen_random_uuid()`
- Timestamps: `created_at`, `updated_at` of type `timestamptz`
- Foreign keys: `<table_singular>_id` (e.g., `user_id`, `host_id`)
- Booleans: prefixed with `is_` or `has_` (e.g., `is_verified`, `has_backups`)
- Enums: defined as Postgres enums via Drizzle, never as strings
- All tables have soft delete via `deleted_at` timestamp UNLESS hard delete is necessary (e.g., session tokens)

## Schema overview

```
users ──┬── sessions
        │
        ├── hosts ──┬── host_metrics_hourly
        │           ├── host_logs
        │           └── game_servers ──┬── game_server_logs
        │                              ├── backups
        │                              └── backup_configs
        │
        ├── pairing_codes
        ├── notifications
        ├── notification_preferences
        └── agent_updates

game_catalog (no user FK — global reference table)
waitlist_signups (no user FK — pre-signup capture)
```

## Tables

### users
Application users. Created via Better Auth.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | text unique not null | |
| `email_verified_at` | timestamptz | null until verified |
| `name` | text | display name |
| `avatar_url` | text | from OAuth or uploaded |
| `password_hash` | text | argon2id; null if OAuth-only |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

### oauth_accounts
Linked OAuth providers. Managed by Better Auth.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `provider` | enum | `google | github | discord` |
| `provider_account_id` | text | OAuth provider's user ID |
| `access_token` | text | encrypted at rest |
| `refresh_token` | text | encrypted at rest |
| `expires_at` | timestamptz | |
| `created_at` | timestamptz | |
| Unique on (`provider`, `provider_account_id`) | | |

### sessions
Active sessions. Managed by Better Auth.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `token_hash` | text not null | hashed session token |
| `expires_at` | timestamptz not null | |
| `user_agent` | text | |
| `ip` | inet | |
| `created_at` | timestamptz | |

### waitlist_signups
Pre-launch email capture from landing page.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | text unique not null | |
| `source` | text | UTM tag or referrer |
| `confirmed_at` | timestamptz | null until email confirmed |
| `created_at` | timestamptz | |
| `ip` | inet | |
| `user_agent` | text | |

### hosts
A user's connected machine running the agent.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `name` | text not null | display name, user-editable |
| `hostname` | text | from agent |
| `ip` | inet | |
| `os` | text | e.g., "Ubuntu 24.04" |
| `kernel` | text | |
| `cpu_model` | text | |
| `cpu_cores` | integer | |
| `ram_bytes` | bigint | total RAM |
| `storage_bytes` | bigint | total storage |
| `gpu_model` | text | nullable |
| `agent_version` | text | |
| `agent_token_hash` | text | hashed long-lived token |
| `status` | enum | `online | offline | connecting | updating` |
| `last_seen_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

### pairing_codes
Short-lived codes for new host enrollment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code` | text unique not null | format `XXXX-XXXX` |
| `user_id` | uuid FK → users | |
| `host_id` | uuid FK → hosts | nullable; set when consumed |
| `expires_at` | timestamptz not null | now + 15 min |
| `used_at` | timestamptz | nullable; set when consumed |
| `created_at` | timestamptz | |

### host_metrics_hourly
Aggregated metrics for charting (raw heartbeat data is not stored long-term).

| Column | Type | Notes |
|--------|------|-------|
| `host_id` | uuid FK → hosts | |
| `hour_bucket` | timestamptz not null | truncated to hour |
| `cpu_avg` | real | 0-100 |
| `cpu_max` | real | 0-100 |
| `mem_avg_bytes` | bigint | |
| `mem_max_bytes` | bigint | |
| `disk_used_bytes` | bigint | |
| `net_in_bytes` | bigint | total over the hour |
| `net_out_bytes` | bigint | total over the hour |
| Composite PK on (`host_id`, `hour_bucket`) | | |

### game_catalog
Global reference table of supported games.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `slug` | text unique not null | e.g., "valheim", "cs2" |
| `name` | text not null | display name |
| `description` | text | |
| `steam_app_id` | integer | nullable |
| `default_port` | integer | |
| `min_ram_mb` | integer | |
| `rec_ram_mb` | integer | |
| `config_schema_json` | jsonb | Zod schema as JSON |
| `logo_url` | text | |
| `is_enabled` | boolean | feature flag |

### game_servers
Deployed instances of a game on a host.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `host_id` | uuid FK → hosts | |
| `game_id` | uuid FK → game_catalog | |
| `name` | text not null | user-given world/server name |
| `port` | integer not null | |
| `config_json` | jsonb | game-specific settings |
| `status` | enum | `deploying | running | stopped | crashed | deleting` |
| `pid` | integer | process ID on host |
| `player_count` | integer | live, default 0 |
| `max_players` | integer | from config |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `last_started_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

### game_server_logs
Hot table, partitioned by week, archived after 7 days.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial PK | |
| `server_id` | uuid FK → game_servers | |
| `ts` | timestamptz not null | |
| `severity` | enum | `debug | info | warn | error` |
| `message` | text not null | |

### host_logs
Same shape as game_server_logs but for host-level events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial PK | |
| `host_id` | uuid FK → hosts | |
| `ts` | timestamptz not null | |
| `severity` | enum | `debug | info | warn | error` |
| `message` | text not null | |

### backups
Game server backup history.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `server_id` | uuid FK → game_servers | |
| `started_at` | timestamptz not null | |
| `completed_at` | timestamptz | nullable until done |
| `size_bytes` | bigint | |
| `storage_url` | text | signed URL or s3 path |
| `status` | enum | `running | completed | failed` |
| `error_message` | text | nullable |
| `retention_until` | timestamptz | |

### backup_configs
Per-server backup schedule and policy.

| Column | Type | Notes |
|--------|------|-------|
| `server_id` | uuid PK FK → game_servers | one config per server |
| `is_enabled` | boolean | default false |
| `schedule_cron` | text | e.g., "0 3 * * *" |
| `retention_count` | integer | default 7 |
| `destination_type` | enum | `platform | s3` |
| `destination_config_json` | jsonb | s3 creds (encrypted) when type=s3 |
| `updated_at` | timestamptz | |

### notifications
In-app + (opt-in) email notifications.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `type` | enum | one of the 14 notification types |
| `severity` | enum | `info | warning | error` |
| `title` | text not null | |
| `body` | text | |
| `related_host_id` | uuid FK → hosts | nullable |
| `related_server_id` | uuid FK → game_servers | nullable |
| `read_at` | timestamptz | nullable |
| `created_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |

### notification_preferences
Per-user, per-type opt-in for email notifications.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → users | |
| `type` | enum | matches notifications.type |
| `in_app_enabled` | boolean | default true |
| `email_enabled` | boolean | default false |
| Composite PK on (`user_id`, `type`) | | |

### agent_updates
Audit trail of agent version changes per host.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `host_id` | uuid FK → hosts | |
| `from_version` | text | |
| `to_version` | text | |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | nullable |
| `status` | enum | `running | completed | failed | rolled_back` |
| `error_message` | text | |

## Postgres enums

```sql
CREATE TYPE oauth_provider AS ENUM ('google', 'github', 'discord');
CREATE TYPE host_status AS ENUM ('online', 'offline', 'connecting', 'updating');
CREATE TYPE server_status AS ENUM ('deploying', 'running', 'stopped', 'crashed', 'deleting');
CREATE TYPE log_severity AS ENUM ('debug', 'info', 'warn', 'error');
CREATE TYPE backup_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE backup_destination AS ENUM ('platform', 's3');
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'error');
CREATE TYPE notification_type AS ENUM (
  'host_online', 'host_offline',
  'agent_updated', 'agent_update_failed',
  'server_started', 'server_crashed', 'server_updated', 'server_update_failed',
  'backup_completed', 'backup_failed',
  'memory_threshold', 'disk_threshold',
  'pairing_used', 'auth_failure'
);
CREATE TYPE update_status AS ENUM ('running', 'completed', 'failed', 'rolled_back');
```

## Indexes (besides primary keys)

- `users.email` — UNIQUE
- `oauth_accounts (provider, provider_account_id)` — UNIQUE
- `sessions.token_hash` — UNIQUE
- `sessions.user_id` — index for fast lookup of user's sessions
- `hosts.user_id` — index for fast list-hosts queries
- `pairing_codes.code` — UNIQUE
- `pairing_codes.expires_at` — index for cleanup job
- `host_metrics_hourly (host_id, hour_bucket DESC)` — composite for chart queries
- `game_servers.host_id` — index
- `game_server_logs (server_id, ts DESC)` — composite for log queries
- `host_logs (host_id, ts DESC)` — composite for log queries
- `notifications (user_id, created_at DESC)` — for inbox queries
- `notifications.read_at` WHERE read_at IS NULL — partial index for unread count

## Migration strategy

- Use `drizzle-kit generate` to produce migration SQL
- Review every migration before applying — never auto-apply schema changes in production
- Use transactions in migrations for multi-step changes
- Never drop columns in the same migration as adding their replacement; do it in two phases (add new → migrate data → drop old)
- Keep migrations idempotent where possible

## Soft delete handling

- Application-level filtering: every query that touches a table with `deleted_at` MUST include `WHERE deleted_at IS NULL` unless explicitly looking for deleted rows
- Drizzle: define a default scope or use a query helper to enforce this
- Hard delete only via background job that runs N days after soft delete (gives users a recovery window)
