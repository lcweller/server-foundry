import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────

export const hostStatusEnum = pgEnum('host_status', ['online', 'offline', 'connecting', 'updating'])

// ─────────────────────────────────────────────────────────────────────
// users — application users (managed by Better Auth)
//
// Field shape matches Better Auth's expected user schema. Drizzle's
// `casing: 'snake_case'` setting translates camelCase TS names to
// snake_case PG columns at query time.
// ─────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name').notNull().default(''),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Server Foundry-specific — not part of Better Auth's expected schema.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// ─────────────────────────────────────────────────────────────────────
// sessions — active sessions (managed by Better Auth)
// ─────────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// accounts — auth accounts (email/password + OAuth providers)
//
// Replaces Phase 0's oauth_accounts. Better Auth stores both the
// "credential" (email/password) account and OAuth provider links here.
// providerId is the string discriminator: "credential", "google",
// "github", "discord".
// ─────────────────────────────────────────────────────────────────────

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// verifications — short-lived verification tokens
//
// Used by Better Auth for email verification and password reset.
// `identifier` is typically the email; `value` is the token.
// ─────────────────────────────────────────────────────────────────────

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// hosts — a user's connected machine running the Foundry agent (Phase 3)
// ─────────────────────────────────────────────────────────────────────

export const hosts = pgTable(
  'hosts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hostname: text('hostname'),
    ip: text('ip'),
    os: text('os'),
    kernel: text('kernel'),
    cpuModel: text('cpu_model'),
    cpuCores: integer('cpu_cores'),
    ramBytes: bigint('ram_bytes', { mode: 'bigint' }),
    storageBytes: bigint('storage_bytes', { mode: 'bigint' }),
    gpuModel: text('gpu_model'),
    agentVersion: text('agent_version'),
    agentTokenHash: text('agent_token_hash'),
    status: hostStatusEnum('status').notNull().default('offline'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('hosts_user_id_idx').on(table.userId),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// pairing_codes — short-lived codes for new host enrollment (Phase 3)
//
// Format `XXXX-XXXX`, single-use, 15-min expiry. The agent posts this
// code to /api/agent/pair to exchange for a long-lived token.
// ─────────────────────────────────────────────────────────────────────

export const pairingCodes = pgTable(
  'pairing_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id').references(() => hosts.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    expiresIdx: index('pairing_codes_expires_at_idx').on(table.expiresAt),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// host_metrics_hourly — aggregated host vitals (Phase 4)
//
// Raw heartbeat data (every 3s) is not stored long-term. The WS handler
// aggregates into hourly buckets keyed by (host_id, hour_bucket). 30-day
// retention; reaper job lands later.
// ─────────────────────────────────────────────────────────────────────

export const hostMetricsHourly = pgTable(
  'host_metrics_hourly',
  {
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    hourBucket: timestamp('hour_bucket', { withTimezone: true }).notNull(),
    samples: integer('samples').notNull().default(0),
    cpuAvg: real('cpu_avg'),
    cpuMax: real('cpu_max'),
    memAvgBytes: bigint('mem_avg_bytes', { mode: 'bigint' }),
    memMaxBytes: bigint('mem_max_bytes', { mode: 'bigint' }),
    diskUsedBytes: bigint('disk_used_bytes', { mode: 'bigint' }),
    netInBytes: bigint('net_in_bytes', { mode: 'bigint' }),
    netOutBytes: bigint('net_out_bytes', { mode: 'bigint' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.hostId, table.hourBucket] }),
    hostHourIdx: index('host_metrics_hourly_host_hour_idx').on(table.hostId, table.hourBucket),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// waitlist_signups — pre-launch email capture (Phase 1)
//
// Server Foundry-specific, unrelated to Better Auth.
// ─────────────────────────────────────────────────────────────────────

export const waitlistSignups = pgTable('waitlist_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  source: text('source'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmationToken: text('confirmation_token'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// Type exports — inferred from schema
// ─────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Verification = typeof verifications.$inferSelect
export type WaitlistSignup = typeof waitlistSignups.$inferSelect
export type NewWaitlistSignup = typeof waitlistSignups.$inferInsert
export type Host = typeof hosts.$inferSelect
export type NewHost = typeof hosts.$inferInsert
export type HostStatus = (typeof hostStatusEnum.enumValues)[number]
export type PairingCode = typeof pairingCodes.$inferSelect
export type NewPairingCode = typeof pairingCodes.$inferInsert
export type HostMetricsHourly = typeof hostMetricsHourly.$inferSelect
export type NewHostMetricsHourly = typeof hostMetricsHourly.$inferInsert

// Notes on tables intentionally NOT defined here (introduced in later phases):
//   host_metrics_hourly, game_catalog, game_servers, game_server_logs,
//   host_logs, backups, backup_configs, notifications,
//   notification_preferences, agent_updates
