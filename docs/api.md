# API

Full API surface for Server Foundry. Three categories: Server Actions (preferred for user mutations), REST endpoints (where Server Actions don't fit), and the WebSocket protocol (agent ↔ platform).

## Server Actions (user-facing mutations)

Used for forms and dashboard interactions. Defined in `src/server/actions/*.ts`. All Server Actions:
- Are typed end-to-end with TypeScript inference
- Validate input with Zod
- Run on the server, never expose secrets to the client
- Use `revalidatePath` or `revalidateTag` to refresh affected RSC trees
- Throw typed errors that the client can handle

### Auth (handled by Better Auth, not custom Server Actions)
- `signUpWithEmail({ email, password, name })`
- `signInWithEmail({ email, password })`
- `signInWithProvider(provider: 'google' | 'github' | 'discord')`
- `signOut()`
- `requestPasswordReset({ email })`
- `resetPassword({ token, newPassword })`
- `verifyEmail({ token })`
- `linkOAuthAccount(provider)`
- `unlinkOAuthAccount(provider)`

### Waitlist (Phase 1 — landing page)
- `joinWaitlist({ email, source? })` — public, rate-limited per IP, sends confirmation email

### User account
- `updateProfile({ name?, avatar? })`
- `updateEmail({ newEmail, password })` — sends verification email
- `changePassword({ currentPassword, newPassword })`
- `deleteAccount({ password, confirmation })` — soft delete, cascades

### Hosts (Phase 3+)
- `createPairingCode()` — returns `{ code, expiresAt }`
- `renameHost({ hostId, name })`
- `removeHost({ hostId })` — soft delete, revokes agent token

### Game servers (Phase 5+)

Implemented in `src/server/actions/servers.ts`. All actions return
`{ ok: true, data } | { ok: false, error, code }` and are auth-gated +
ownership-checked against the host.

- `deployServer({ hostId, gameId, name, port?, config })` — `gameId` is
  the `game_catalog.id` (UUID); the server-side action looks up the
  matching slug and `steam_app_id` for the agent message. Returns
  `{ serverId }`. Port defaults to the catalog's `default_port` when
  omitted, with per-host port-conflict detection. Codes:
  `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND`, `PORT_IN_USE`,
  `INTERNAL`.
- `startServer({ serverId })` / `stopServer({ serverId })` /
  `restartServer({ serverId })` — dispatch to the connected agent.
  Codes: `UNAUTHENTICATED`, `VALIDATION`, `NOT_FOUND`, `HOST_OFFLINE`.
- `deleteServer({ serverId })` — marks the row `deleting` + sets
  `deleted_at` immediately so the UI reflects intent regardless of
  agent reachability; the agent confirms on-disk cleanup.
- `updateGameServerConfig` is planned for a later iteration; currently
  config can only be set at deploy time.

### Backups (Phase 9+)
- `triggerBackup({ serverId })`
- `restoreBackup({ serverId, backupId })`
- `updateBackupConfig({ serverId, config })`

### Notifications (Phase 8+)
- `markNotificationRead({ notificationId })`
- `markAllNotificationsRead()`
- `dismissNotification({ notificationId })`
- `updateNotificationPreferences({ preferences })`

## REST Endpoints

Used where Server Actions don't fit: webhooks, agent endpoints, public APIs, file downloads.

### Public — implemented
- `GET /` — landing page
- `GET /api/og?title=...` — dynamic OG image generation
- `GET /sitemap.xml`, `GET /robots.txt`

### Agent endpoints — implemented
- `POST /api/agent/pair` — exchange pairing code for long-lived agent
  token. Body: `{ code: string }`. Returns:
  `{ ok: true, token, hostId } | { ok: false, error, code }`. The
  token is HMAC-signed; subsequent WebSocket connects use it as a
  Bearer token.

### Dashboard streaming endpoints (SSE) — implemented
- `GET /api/stream/host/:id/metrics` — live host metrics (Phase 4)

### Planned (not yet implemented)
- `POST /api/webhooks/resend` — email delivery webhooks
- `GET /api/agent/update-manifest` — agent self-update channel (Phase 10)
- `GET /api/agent/games/:slug/binary` — signed binary download (Phase 5+
  per-game)
- `GET /api/stream/host/:id/logs` — host log SSE stream (Phase 6)
- `GET /api/stream/server/:id/logs` — server log SSE stream (Phase 6)
- `GET /api/hosts/:id/export` / `GET /api/server/:id/logs/export` —
  CSV exports (later)

## WebSocket Protocol (agent ↔ platform)

The persistent connection is at `wss://serversfoundry.app/ws/agent`. All messages are JSON, validated with Zod schemas defined in `src/shared/agent-protocol.ts` — that file is the source of truth; this section is human-readable summary.

### Connection lifecycle

1. Agent opens WebSocket with `Authorization: Bearer <agent_token>` header
2. Platform validates the token signature + DB lookup; rejects with `error` envelope + close code 4401 on failure
3. Agent sends `hello` message with current state
4. Platform responds with `hello_ack` carrying server time + heartbeat cadence
5. Agent maintains heartbeat every `HEARTBEAT_INTERVAL_SECONDS` (currently 3s)
6. On disconnect or stale heartbeat (interval + 10s grace), platform marks the host `offline`

### Message envelope

Every message has this shape:

```ts
{
  type: string,      // e.g., "heartbeat", "deploy_server"
  id: string,        // UUID for request/response correlation
  ts: number,        // unix ms
  payload: object    // type-specific
}
```

### Agent → Platform messages

#### `hello` — Phase 4
Sent once on connect.
```ts
payload: {
  agentVersion: string,
  hostInfo?: {
    hostname?, os?, kernel?, cpuModel?, cpuCores?,
    ramBytes?, storageBytes?, gpuModel?, ip?
  }
}
```

#### `heartbeat` — Phase 4
Sent every `HEARTBEAT_INTERVAL_SECONDS`. All fields flat (no nested
`cpu`/`memory` objects). Bytes are absolute counters; the SSE consumer
derives rates client-side.
```ts
payload: {
  cpuPercent: number,           // 0-100
  memUsedBytes: number,
  memTotalBytes: number,
  diskUsedBytes?: number,
  diskTotalBytes?: number,
  netInBytes?: number,
  netOutBytes?: number,
  cpuTempC?: number,
  gpuTempC?: number,
  uptimeSeconds?: number
}
```

#### `log` — accepted (Phase 6 will persist + stream)
```ts
payload: {
  source: 'host' | 'server',
  serverId?: string,            // required when source = 'server'
  severity: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  occurredAt?: number           // unix ms; envelope `ts` is the fallback
}
```
Currently the platform accepts and discards `log` messages so agents
that send them aren't surprised by errors. Phase 6 lands the
`game_server_logs` / `host_logs` writes plus the SSE streams.

#### `server_status_change` — Phase 5
Reports the lifecycle state of a deployed game server. Note: the agent
does not report `'deleting'` — that status is set by the platform when
`deleteServer` is called; the agent confirms cleanup by transitioning
to (eventually) a row hard-delete.
```ts
payload: {
  serverId: string,
  status: 'deploying' | 'running' | 'stopped' | 'crashed',
  pid?: number,
  playerCount?: number,
  error?: string                // optional context, not just for crashed
}
```

#### `deployment_progress` — Phase 5
Streaming progress during long deploys. Currently logged on the
platform side; the SSE bridge to the dashboard lands with logs in
Phase 6.
```ts
payload: {
  serverId: string,
  phase: 'queued' | 'downloading' | 'configuring' | 'starting' | 'done' | 'failed',
  percent?: number,             // 0-100, optional
  detail?: string
}
```

#### Planned (not yet implemented)
- `terminal_data` — Phase 6 (remote terminal)
- `backup_progress` — Phase 9 (backups)
- `command_response` — generic request/response correlation; will land
  alongside the first command that needs synchronous confirmation

### Platform → Agent messages

#### `hello_ack` — Phase 4
```ts
payload: {
  serverTime: number,                  // unix ms
  heartbeatIntervalSeconds: number     // currently 3
}
```
Pending-command replay and agent-update advertisement are deferred
until Phase 10 (agent self-update) and the first command that needs
queueing.

#### `error` — Phase 4
Authentication or message-level failures the platform wants the agent
to surface in its own logs.
```ts
payload: {
  code: string,        // e.g. "AUTH_INVALID", "INVALID_MESSAGE"
  message: string
}
```

#### `deploy_server` — Phase 5
```ts
payload: {
  serverId: string,
  gameSlug: string,
  steamAppId?: number,
  name: string,
  port: number,
  config: Record<string, unknown>      // opaque to the platform; per-game
}
```

#### `start_server` / `stop_server` / `restart_server` / `delete_server` — Phase 5
```ts
payload: { serverId: string }
```

#### Planned (not yet implemented)
- `update_server_config` — apply new config to a running server
- `backup_server` / `restore_server` — Phase 9 (backups)
- `open_terminal` / `close_terminal` / `terminal_input` /
  `terminal_resize` — Phase 6 (remote terminal)
- `update_agent` — Phase 10 (agent self-update)

## Error handling

- Every Server Action returns `{ ok: true, data }` or `{ ok: false, error }`
- Errors include a code (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, etc.) and a user-facing message
- WebSocket errors are sent as a `command_response` with `ok: false`
- Network errors retried with exponential backoff (agent side); platform side fails fast and surfaces the error

## Rate limiting

- Public endpoints (`/api/waitlist`): 5 requests/min/IP
- Auth endpoints: 10 attempts/15min/IP
- User Server Actions: 100 req/min/user
- Agent endpoints: 1000 req/min/agent
- WebSocket message rate: 100 msg/sec/agent (excluding heartbeats)

## Versioning

- All endpoints are unversioned at v1 (no `/v1/` prefix yet)
- When breaking changes are needed, add `/v2/` prefix and deprecate `/v1/` over 6 months
- WebSocket protocol: include `protocolVersion` in `hello` message; platform refuses connections with unsupported versions
