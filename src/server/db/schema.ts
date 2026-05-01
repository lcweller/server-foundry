import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
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

export const serverStatusEnum = pgEnum('server_status', [
  'deploying',
  'running',
  'stopped',
  'crashed',
  'deleting',
])

export const logSeverityEnum = pgEnum('log_severity', ['debug', 'info', 'warn', 'error'])

export const notificationSeverityEnum = pgEnum('notification_severity', [
  'info',
  'warning',
  'error',
])

// Notification types — closed list, expanded as new event sources land.
// Order is roughly grouped by source (host, agent, server, backup,
// resource, security).
export const backupStatusEnum = pgEnum('backup_status', ['running', 'completed', 'failed'])

export const backupDestinationEnum = pgEnum('backup_destination', ['platform', 's3'])

export const notificationTypeEnum = pgEnum('notification_type', [
  'host_online',
  'host_offline',
  'agent_updated',
  'agent_update_failed',
  'server_started',
  'server_crashed',
  'server_updated',
  'server_update_failed',
  'backup_completed',
  'backup_failed',
  'memory_threshold',
  'disk_threshold',
  'pairing_used',
  'auth_failure',
])

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
// game_catalog — global reference table of supported games (Phase 5)
//
// Seeded via src/server/db/seed.ts. is_enabled gates which games
// appear in the deploy flow. config_schema_json is the per-game form
// shape (rendered server-side in the deploy wizard).
// ─────────────────────────────────────────────────────────────────────

export const gameCatalog = pgTable('game_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  steamAppId: integer('steam_app_id'),
  defaultPort: integer('default_port').notNull(),
  minRamMb: integer('min_ram_mb'),
  recRamMb: integer('rec_ram_mb'),
  configSchemaJson: jsonb('config_schema_json'),
  logoUrl: text('logo_url'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// game_servers — deployed instances of a game on a host (Phase 5)
// ─────────────────────────────────────────────────────────────────────

export const gameServers = pgTable(
  'game_servers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => gameCatalog.id),
    name: text('name').notNull(),
    port: integer('port').notNull(),
    configJson: jsonb('config_json'),
    status: serverStatusEnum('status').notNull().default('deploying'),
    pid: integer('pid'),
    playerCount: integer('player_count').notNull().default(0),
    maxPlayers: integer('max_players'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    hostIdx: index('game_servers_host_id_idx').on(table.hostId),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// host_logs — host-level log lines (Phase 6)
//
// High-volume table. Composite (host_id, ts DESC) index supports the
// common "tail last N for this host" query. We store ts as the agent's
// occurredAt when supplied, otherwise the receive time.
// ─────────────────────────────────────────────────────────────────────

export const hostLogs = pgTable(
  'host_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    severity: logSeverityEnum('severity').notNull(),
    message: text('message').notNull(),
  },
  (table) => ({
    byHostTs: index('host_logs_host_ts_idx').on(table.hostId, table.ts.desc()),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// game_server_logs — game-server stdout/stderr (Phase 6)
//
// Same shape as host_logs but keyed by server. Cascade delete on the
// owning game_servers row.
// ─────────────────────────────────────────────────────────────────────

export const gameServerLogs = pgTable(
  'game_server_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => gameServers.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    severity: logSeverityEnum('severity').notNull(),
    message: text('message').notNull(),
  },
  (table) => ({
    byServerTs: index('game_server_logs_server_ts_idx').on(table.serverId, table.ts.desc()),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// backup_configs — per-server backup schedule + destination (Phase 9)
//
// One row per game_server. destination_config_json is encrypted with
// BACKUP_ENCRYPTION_KEY when destination_type='s3' (so an attacker who
// gets read access to the DB still can't lift S3 keys out).
// ─────────────────────────────────────────────────────────────────────

export const backupConfigs = pgTable('backup_configs', {
  serverId: uuid('server_id')
    .primaryKey()
    .references(() => gameServers.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').notNull().default(false),
  scheduleCron: text('schedule_cron'),
  retentionCount: integer('retention_count').notNull().default(7),
  destinationType: backupDestinationEnum('destination_type').notNull().default('platform'),
  // Opaque encrypted JSON when destination_type='s3'. Null for platform
  // destination (which has no per-user config in v1).
  destinationConfigJson: jsonb('destination_config_json'),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────
// backups — backup history (Phase 9)
// ─────────────────────────────────────────────────────────────────────

export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => gameServers.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }),
    storageUrl: text('storage_url'),
    status: backupStatusEnum('status').notNull().default('running'),
    errorMessage: text('error_message'),
    retentionUntil: timestamp('retention_until', { withTimezone: true }),
    triggeredBy: text('triggered_by'), // 'manual' | 'scheduled'
  },
  (table) => ({
    byServerStarted: index('backups_server_started_idx').on(table.serverId, table.startedAt.desc()),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// notifications — in-app feed + (opt-in) email (Phase 8)
//
// Soft-delete via deleted_at so dismissed notifications can be
// distinguished from never-issued ones for analytics. Composite index
// on (user_id, created_at DESC) keeps the inbox query fast; partial
// index on read_at IS NULL accelerates the unread badge.
// ─────────────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    severity: notificationSeverityEnum('severity').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    relatedHostId: uuid('related_host_id').references(() => hosts.id, { onDelete: 'set null' }),
    relatedServerId: uuid('related_server_id').references(() => gameServers.id, {
      onDelete: 'set null',
    }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    byUserCreated: index('notifications_user_created_idx').on(table.userId, table.createdAt.desc()),
  }),
)

// ─────────────────────────────────────────────────────────────────────
// notification_preferences — per-user, per-type opt-in (Phase 8)
// ─────────────────────────────────────────────────────────────────────

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.type] }),
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
export type GameCatalog = typeof gameCatalog.$inferSelect
export type NewGameCatalog = typeof gameCatalog.$inferInsert
export type GameServer = typeof gameServers.$inferSelect
export type NewGameServer = typeof gameServers.$inferInsert
export type ServerStatus = (typeof serverStatusEnum.enumValues)[number]
export type HostLog = typeof hostLogs.$inferSelect
export type NewHostLog = typeof hostLogs.$inferInsert
export type GameServerLog = typeof gameServerLogs.$inferSelect
export type NewGameServerLog = typeof gameServerLogs.$inferInsert
export type LogSeverity = (typeof logSeverityEnum.enumValues)[number]
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number]
export type NotificationSeverity = (typeof notificationSeverityEnum.enumValues)[number]
export type Backup = typeof backups.$inferSelect
export type NewBackup = typeof backups.$inferInsert
export type BackupConfig = typeof backupConfigs.$inferSelect
export type NewBackupConfig = typeof backupConfigs.$inferInsert
export type BackupStatus = (typeof backupStatusEnum.enumValues)[number]
export type BackupDestination = (typeof backupDestinationEnum.enumValues)[number]

// Notes on tables intentionally NOT defined here (introduced in later phases):
//   agent_updates
