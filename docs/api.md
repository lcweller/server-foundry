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
- `deployGameServer({ hostId, gameSlug, name, port, config })`
- `startGameServer({ serverId })`
- `stopGameServer({ serverId })`
- `restartGameServer({ serverId })`
- `deleteGameServer({ serverId })`
- `updateGameServerConfig({ serverId, config })`

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

### Public
- `GET /` — landing page
- `GET /api/og?title=...` — dynamic OG image generation
- `POST /api/webhooks/resend` — email delivery webhooks

### Agent endpoints (HMAC-signed with agent token)

All agent REST endpoints live under `/api/agent/*` and require HMAC signature in the `X-Foundry-Signature` header.

- `POST /api/agent/pair` — exchange pairing code for long-lived token
  - Body: `{ code: string, hostInfo: { hostname, os, kernel, cpu, ram, storage, gpu? } }`
  - Returns: `{ token: string, agentVersion: string }`
- `GET /api/agent/update-manifest` — current recommended agent version + download URL
  - Returns: `{ version: string, downloadUrl: string, signature: string, releaseNotes: string }`
- `GET /api/agent/games/:slug/binary` — signed download URL for game server binary (if applicable)
  - Returns: `{ downloadUrl: string, expiresAt: string }`

### Dashboard streaming endpoints (SSE)

- `GET /api/stream/host/:id/metrics` — Server-Sent Events stream of live metrics for a host
- `GET /api/stream/host/:id/logs` — SSE stream of host logs
- `GET /api/stream/server/:id/logs` — SSE stream of game server logs

### Authenticated REST (where Server Actions don't fit)

- `GET /api/hosts/:id/export` — CSV export of host metrics
- `GET /api/server/:id/logs/export?from=&to=&format=` — log export

## WebSocket Protocol (agent ↔ platform)

The persistent connection is at `wss://serverfoundry.gg/ws/agent`. All messages are JSON, validated with Zod schemas defined in `src/shared/agent-protocol.ts`.

### Connection lifecycle

1. Agent opens WebSocket with `Authorization: Bearer <agent_token>` header
2. Platform validates token, accepts connection
3. Agent sends `hello` message with current state
4. Platform responds with `hello_ack` + any pending commands
5. Agent maintains heartbeat every 3s
6. On disconnect, platform marks host `offline` after 10s grace period

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

#### `hello`
Sent on connection. Establishes current state.
```ts
payload: {
  agentVersion: string,
  hostInfo: { hostname, os, kernel, cpu, ram, storage, gpu? },
  runningServers: Array<{ serverId, status, pid, playerCount }>
}
```

#### `heartbeat`
Sent every 3 seconds.
```ts
payload: {
  cpu: { usage: number, temp?: number },        // 0-100
  memory: { usedBytes: number, totalBytes: number },
  disk: Array<{ mount: string, usedBytes: number, totalBytes: number }>,
  network: { rxBps: number, txBps: number },
  gpu?: { temp: number, usage: number }
}
```

#### `log`
Single log line from host or game server.
```ts
payload: {
  source: 'host' | 'server',
  serverId?: string,           // when source = 'server'
  severity: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  timestamp: number
}
```

#### `server_status_change`
Game server status update.
```ts
payload: {
  serverId: string,
  status: 'deploying' | 'running' | 'stopped' | 'crashed' | 'deleting',
  pid?: number,
  playerCount?: number,
  error?: string                // when status = 'crashed'
}
```

#### `deployment_progress`
Streaming progress for long deployments.
```ts
payload: {
  serverId: string,
  stage: 'downloading' | 'configuring' | 'starting',
  percent: number,              // 0-100
  message: string
}
```

#### `terminal_data`
Output from a remote terminal session.
```ts
payload: {
  sessionId: string,
  data: string                  // base64-encoded raw bytes
}
```

#### `backup_progress`
Streaming progress for backups.
```ts
payload: {
  backupId: string,
  percent: number,
  bytesSoFar: number,
  message: string
}
```

#### `command_response`
Response to a command from platform (correlated by message `id`).
```ts
payload: {
  requestId: string,            // matches platform's command id
  ok: boolean,
  result?: unknown,
  error?: string
}
```

### Platform → Agent messages

#### `hello_ack`
Confirms hello, may request agent update.
```ts
payload: {
  serverTime: number,
  pendingCommands: Command[],   // any commands queued during disconnect
  agentUpdateAvailable?: { version, downloadUrl, signature }
}
```

#### `deploy_server`
Deploy a new game server.
```ts
payload: {
  serverId: string,
  gameSlug: string,
  port: number,
  config: object,               // game-specific
  steamAppId?: number
}
```

#### `start_server` / `stop_server` / `restart_server` / `delete_server`
```ts
payload: { serverId: string }
```

#### `update_server_config`
Apply new config to a running server (may require restart).
```ts
payload: {
  serverId: string,
  config: object,
  restartIfRunning: boolean
}
```

#### `backup_server`
Trigger a backup.
```ts
payload: {
  serverId: string,
  backupId: string,
  destination: { type: 'platform' | 's3', config: object }
}
```

#### `restore_server`
Restore from backup.
```ts
payload: {
  serverId: string,
  backupId: string,
  downloadUrl: string,
  signature: string
}
```

#### `open_terminal` / `close_terminal`
```ts
payload: {
  sessionId: string,
  cols?: number,
  rows?: number
}
```

#### `terminal_input`
Input from browser to remote shell.
```ts
payload: {
  sessionId: string,
  data: string                  // base64-encoded raw bytes
}
```

#### `terminal_resize`
```ts
payload: {
  sessionId: string,
  cols: number,
  rows: number
}
```

#### `update_agent`
Trigger a self-update on the agent.
```ts
payload: {
  version: string,
  downloadUrl: string,
  signature: string
}
```

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
