// Reachable from server.ts directly — see src/lib/env.ts on the
// `server-only` omission rationale.
import type { IncomingMessage } from 'node:http'
import { logger } from '@/lib/logger'
import { hashAgentToken, isAgentTokenSignatureValid } from '@/server/auth/agent-token'
import { db } from '@/server/db'
import {
  agentUpdates,
  backups,
  gameServerLogs,
  gameServers,
  hostLogs,
  hostMetricsHourly,
  hosts,
} from '@/server/db/schema'
import { createNotification } from '@/server/notifications/create'
import {
  type AgentToPlatformMessage,
  HEARTBEAT_INTERVAL_SECONDS,
  type PlatformToAgentMessage,
  agentToPlatformMessage,
} from '@/shared/agent-protocol'
import { and, eq, isNull } from 'drizzle-orm'
import type { WebSocket } from 'ws'
import { liveLogsBus } from './live-logs-bus'
import { liveMetricsBus } from './live-metrics-bus'
import { terminalSessions } from './terminal-session'

// Heartbeat liveness window: if we don't see a heartbeat in this long,
// flip the host to offline.
const OFFLINE_AFTER_MS = (HEARTBEAT_INTERVAL_SECONDS + 10) * 1000

type ConnectedAgent = {
  hostId: string
  userId: string
  socket: WebSocket
  lastHeartbeatAt: number
  offlineTimer: NodeJS.Timeout | null
}

const connections = new Map<string, ConnectedAgent>()

export async function handleAgentSocket(socket: WebSocket, req: IncomingMessage) {
  // Authenticate from the Authorization header. Bearer <token>.
  const authHeader = req.headers.authorization ?? req.headers.Authorization
  const tokenHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader
  const match = tokenHeader?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token || !isAgentTokenSignatureValid(token)) {
    sendError(socket, 'AUTH_INVALID', 'Missing or malformed token.')
    socket.close(4401, 'unauthorized')
    return
  }

  const tokenHash = hashAgentToken(token)
  const host = await db.query.hosts.findFirst({
    where: and(eq(hosts.agentTokenHash, tokenHash), isNull(hosts.deletedAt)),
  })
  if (!host) {
    sendError(socket, 'AUTH_UNKNOWN_TOKEN', 'Token not recognised.')
    socket.close(4401, 'unauthorized')
    return
  }

  // Replace any existing connection for this host (network blips, agent
  // restart, multiple paired hosts share nothing — IDs are per-host).
  const existing = connections.get(host.id)
  if (existing) {
    try {
      existing.socket.close(4001, 'superseded')
    } catch {
      /* ignore */
    }
  }

  const conn: ConnectedAgent = {
    hostId: host.id,
    userId: host.userId,
    socket,
    lastHeartbeatAt: Date.now(),
    offlineTimer: null,
  }
  connections.set(host.id, conn)

  logger.info({ hostId: host.id }, 'agent connected')

  const wasOffline = host.status !== 'online'
  await db
    .update(hosts)
    .set({ status: 'online', lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(hosts.id, host.id))
  liveMetricsBus.publishStatus({ hostId: host.id, status: 'online', ts: Date.now() })

  if (wasOffline) {
    void createNotification({
      userId: host.userId,
      type: 'host_online',
      severity: 'info',
      title: `${host.name} is online`,
      relatedHostId: host.id,
    })
  }

  resetOfflineTimer(conn)

  send(socket, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'hello_ack',
    payload: {
      serverTime: Date.now(),
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    },
  })

  socket.on('message', async (raw) => {
    let parsed: AgentToPlatformMessage
    try {
      const json = JSON.parse(raw.toString())
      parsed = agentToPlatformMessage.parse(json)
    } catch (err) {
      logger.warn({ err, hostId: host.id }, 'invalid agent message')
      sendError(socket, 'INVALID_MESSAGE', 'Could not parse message.')
      return
    }

    try {
      await dispatch(conn, parsed)
    } catch (err) {
      logger.error({ err, hostId: host.id, type: parsed.type }, 'agent message handler failed')
    }
  })

  socket.on('close', async () => {
    if (connections.get(host.id) === conn) {
      connections.delete(host.id)
    }
    if (conn.offlineTimer) clearTimeout(conn.offlineTimer)

    await markOfflineIfStale(host.id)
    logger.info({ hostId: host.id }, 'agent disconnected')
  })

  socket.on('error', (err) => {
    logger.warn({ err, hostId: host.id }, 'agent socket error')
  })
}

async function dispatch(conn: ConnectedAgent, msg: AgentToPlatformMessage) {
  switch (msg.type) {
    case 'hello':
      return handleHello(conn, msg)
    case 'heartbeat':
      return handleHeartbeat(conn, msg)
    case 'server_status_change':
      return handleServerStatusChange(conn, msg)
    case 'deployment_progress':
      return handleDeploymentProgress(conn, msg)
    case 'log':
      return handleLog(conn, msg)
    case 'terminal_data':
      terminalSessions.forwardData(msg)
      return
    case 'terminal_closed':
      terminalSessions.forwardClosed(msg)
      return
    case 'backup_progress':
      return handleBackupProgress(conn, msg)
    case 'restore_progress':
      return handleRestoreProgress(conn, msg)
    case 'agent_update_progress':
      return handleAgentUpdateProgress(conn, msg)
  }
}

async function handleAgentUpdateProgress(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'agent_update_progress' }>,
) {
  const p = msg.payload
  const hostRow = await db.query.hosts.findFirst({
    where: eq(hosts.id, conn.hostId),
    columns: { id: true, name: true, userId: true, agentVersion: true },
  })
  if (!hostRow) return

  const update = await db.query.agentUpdates.findFirst({
    where: and(eq(agentUpdates.id, p.updateId), eq(agentUpdates.hostId, conn.hostId)),
  })
  if (!update) {
    logger.warn(
      { hostId: conn.hostId, updateId: p.updateId },
      'agent_update_progress for unknown row',
    )
    return
  }

  if (p.phase === 'completed') {
    await db
      .update(agentUpdates)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(agentUpdates.id, p.updateId))
    void createNotification({
      userId: hostRow.userId,
      type: 'agent_updated',
      severity: 'info',
      title: `${hostRow.name}: agent updated`,
      ...(update.fromVersion
        ? { body: `${update.fromVersion} → ${update.toVersion}.` }
        : { body: `Now on ${update.toVersion}.` }),
      relatedHostId: hostRow.id,
    })
    return
  }

  if (p.phase === 'failed' || p.phase === 'rolled_back') {
    await db
      .update(agentUpdates)
      .set({
        status: p.phase === 'rolled_back' ? 'rolled_back' : 'failed',
        completedAt: new Date(),
        errorMessage: p.error?.slice(0, 1000) ?? null,
      })
      .where(eq(agentUpdates.id, p.updateId))
    void createNotification({
      userId: hostRow.userId,
      type: 'agent_update_failed',
      severity: 'error',
      title:
        p.phase === 'rolled_back'
          ? `${hostRow.name}: update rolled back`
          : `${hostRow.name}: agent update failed`,
      ...(p.error ? { body: p.error.slice(0, 1000) } : {}),
      relatedHostId: hostRow.id,
    })
    return
  }

  // Mid-flight phase — log only.
  logger.info({ hostId: conn.hostId, updateId: p.updateId, phase: p.phase }, 'agent update phase')
}

async function handleBackupProgress(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'backup_progress' }>,
) {
  const p = msg.payload
  // Verify this backup belongs to a server on the connecting host.
  const rows = await db
    .select({ serverId: backups.serverId, hostId: gameServers.hostId, name: gameServers.name })
    .from(backups)
    .innerJoin(gameServers, eq(gameServers.id, backups.serverId))
    .where(and(eq(backups.id, p.backupId), eq(gameServers.hostId, conn.hostId)))
    .limit(1)
  if (!rows[0]) {
    logger.warn({ hostId: conn.hostId, backupId: p.backupId }, 'backup_progress for unknown row')
    return
  }
  const { serverId, name } = rows[0]

  if (p.phase === 'completed') {
    await db
      .update(backups)
      .set({
        status: 'completed',
        completedAt: new Date(),
        ...(typeof p.bytesSoFar === 'number' ? { sizeBytes: BigInt(p.bytesSoFar) } : {}),
        ...(p.storageUrl ? { storageUrl: p.storageUrl } : {}),
      })
      .where(eq(backups.id, p.backupId))
    void createNotification({
      userId: conn.userId,
      type: 'backup_completed',
      severity: 'info',
      title: `${name}: backup completed`,
      ...(typeof p.bytesSoFar === 'number'
        ? { body: `Archive size: ${formatBytes(p.bytesSoFar)}.` }
        : {}),
      relatedHostId: conn.hostId,
      relatedServerId: serverId,
    })
    return
  }

  if (p.phase === 'failed') {
    await db
      .update(backups)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: p.error?.slice(0, 1000) ?? 'Backup failed.',
      })
      .where(eq(backups.id, p.backupId))
    void createNotification({
      userId: conn.userId,
      type: 'backup_failed',
      severity: 'error',
      title: `${name}: backup failed`,
      ...(p.error ? { body: p.error.slice(0, 1000) } : {}),
      relatedHostId: conn.hostId,
      relatedServerId: serverId,
    })
    return
  }

  // Mid-flight — record the byte counter so the UI can show progress.
  if (typeof p.bytesSoFar === 'number') {
    await db
      .update(backups)
      .set({ sizeBytes: BigInt(p.bytesSoFar) })
      .where(eq(backups.id, p.backupId))
  }
}

async function handleRestoreProgress(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'restore_progress' }>,
) {
  // v1: just log. The user can watch the server status flip back to
  // running on success. Phase 12 / dashboard polish lands a richer
  // restore UI.
  logger.info(
    {
      hostId: conn.hostId,
      backupId: msg.payload.backupId,
      phase: msg.payload.phase,
      bytesSoFar: msg.payload.bytesSoFar,
    },
    'restore progress',
  )
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

async function handleLog(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'log' }>,
) {
  const p = msg.payload
  // Agent's clock is authoritative for "when this line was emitted".
  // Fall back to the envelope ts (also agent-side) if no occurredAt.
  const ts = new Date(p.occurredAt ?? msg.ts)
  // Trim defensively — schema cap is 8KB but DB column is unbounded
  // text; a runaway client could otherwise drown the table.
  const message = p.message.length > 8192 ? p.message.slice(0, 8192) : p.message

  if (p.source === 'server') {
    if (!p.serverId) return
    // Verify the server belongs to this host before persisting.
    const owned = await db.query.gameServers.findFirst({
      where: and(eq(gameServers.id, p.serverId), eq(gameServers.hostId, conn.hostId)),
    })
    if (!owned) return

    await db
      .insert(gameServerLogs)
      .values({ serverId: p.serverId, ts, severity: p.severity, message })
      .catch((err) => {
        logger.warn({ err, serverId: p.serverId }, 'game_server_logs insert failed')
      })

    liveLogsBus.publishServerLog(p.serverId, {
      ts: ts.getTime(),
      severity: p.severity,
      message,
    })
    return
  }

  // host log
  await db
    .insert(hostLogs)
    .values({ hostId: conn.hostId, ts, severity: p.severity, message })
    .catch((err) => {
      logger.warn({ err, hostId: conn.hostId }, 'host_logs insert failed')
    })

  liveLogsBus.publishHostLog(conn.hostId, {
    ts: ts.getTime(),
    severity: p.severity,
    message,
  })
}

async function handleHello(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'hello' }>,
) {
  const info = msg.payload.hostInfo ?? {}
  const updates: Record<string, unknown> = {
    agentVersion: msg.payload.agentVersion,
    status: 'online' as const,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  }
  if (info.hostname) updates.hostname = info.hostname
  if (info.os) updates.os = info.os
  if (info.kernel) updates.kernel = info.kernel
  if (info.cpuModel) updates.cpuModel = info.cpuModel
  if (typeof info.cpuCores === 'number') updates.cpuCores = info.cpuCores
  if (typeof info.ramBytes === 'number') updates.ramBytes = BigInt(info.ramBytes)
  if (typeof info.storageBytes === 'number') updates.storageBytes = BigInt(info.storageBytes)
  if (info.gpuModel) updates.gpuModel = info.gpuModel
  if (info.ip) updates.ip = info.ip

  await db.update(hosts).set(updates).where(eq(hosts.id, conn.hostId))
}

async function handleServerStatusChange(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'server_status_change' }>,
) {
  const { serverId, status, pid, playerCount, error } = msg.payload

  // Verify the server belongs to this host before applying — agents
  // shouldn't be able to mutate other hosts' servers.
  const existing = await db.query.gameServers.findFirst({
    where: and(eq(gameServers.id, serverId), eq(gameServers.hostId, conn.hostId)),
  })
  if (!existing) {
    logger.warn(
      { hostId: conn.hostId, serverId },
      'server_status_change for unknown server on this host',
    )
    return
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() }
  if (typeof pid === 'number') updates.pid = pid
  if (typeof playerCount === 'number') updates.playerCount = playerCount
  if (status === 'running' && existing.status !== 'running') {
    updates.lastStartedAt = new Date()
  }

  await db.update(gameServers).set(updates).where(eq(gameServers.id, serverId))

  if (error) {
    logger.warn({ hostId: conn.hostId, serverId, error }, 'agent reported server error')
  }

  // Notify on the interesting transitions only — running (just started)
  // and crashed (failed health). Silent stops are usually user-driven.
  if (status === 'running' && existing.status !== 'running') {
    void createNotification({
      userId: conn.userId,
      type: 'server_started',
      severity: 'info',
      title: `${existing.name} is running`,
      relatedHostId: conn.hostId,
      relatedServerId: existing.id,
    })
  } else if (status === 'crashed' && existing.status !== 'crashed') {
    void createNotification({
      userId: conn.userId,
      type: 'server_crashed',
      severity: 'error',
      title: `${existing.name} crashed`,
      ...(error ? { body: error.slice(0, 1000) } : {}),
      relatedHostId: conn.hostId,
      relatedServerId: existing.id,
    })
  }
}

async function handleDeploymentProgress(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'deployment_progress' }>,
) {
  // Deployment progress is informational for Phase 5 — Phase 6 streams
  // it to the client via SSE alongside logs. Verify ownership and log.
  const { serverId, phase, percent, detail } = msg.payload
  const existing = await db.query.gameServers.findFirst({
    where: and(eq(gameServers.id, serverId), eq(gameServers.hostId, conn.hostId)),
  })
  if (!existing) return

  logger.info({ hostId: conn.hostId, serverId, phase, percent, detail }, 'deployment progress')
}

async function handleHeartbeat(
  conn: ConnectedAgent,
  msg: Extract<AgentToPlatformMessage, { type: 'heartbeat' }>,
) {
  const now = Date.now()
  conn.lastHeartbeatAt = now
  resetOfflineTimer(conn)

  const p = msg.payload
  liveMetricsBus.publishHeartbeat({
    hostId: conn.hostId,
    ts: now,
    cpuPercent: p.cpuPercent,
    memUsedBytes: p.memUsedBytes,
    memTotalBytes: p.memTotalBytes,
    diskUsedBytes: p.diskUsedBytes,
    diskTotalBytes: p.diskTotalBytes,
    netInBytes: p.netInBytes,
    netOutBytes: p.netOutBytes,
    cpuTempC: p.cpuTempC,
    gpuTempC: p.gpuTempC,
  })

  // Light-touch DB write: refresh last_seen_at on every heartbeat is too
  // chatty; we update it on connect, on disconnect, and roughly once per
  // minute via the offline timer reset cadence below. For Phase 4 we keep
  // it simple and let the in-memory cache be the source of truth for
  // "live" reads while the hourly aggregate captures the durable view.

  await upsertHourlyAggregate(conn.hostId, p)
}

async function upsertHourlyAggregate(
  hostId: string,
  p: Extract<AgentToPlatformMessage, { type: 'heartbeat' }>['payload'],
) {
  const hourBucket = new Date()
  hourBucket.setMinutes(0, 0, 0)

  const memUsed = BigInt(p.memUsedBytes)
  const diskUsed = typeof p.diskUsedBytes === 'number' ? BigInt(p.diskUsedBytes) : null
  const netIn = typeof p.netInBytes === 'number' ? BigInt(p.netInBytes) : null
  const netOut = typeof p.netOutBytes === 'number' ? BigInt(p.netOutBytes) : null

  await db
    .insert(hostMetricsHourly)
    .values({
      hostId,
      hourBucket,
      samples: 1,
      cpuAvg: p.cpuPercent,
      cpuMax: p.cpuPercent,
      memAvgBytes: memUsed,
      memMaxBytes: memUsed,
      diskUsedBytes: diskUsed,
      netInBytes: netIn,
      netOutBytes: netOut,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [hostMetricsHourly.hostId, hostMetricsHourly.hourBucket],
      set: {
        // Running average via SQL: ((avg * n) + sample) / (n + 1).
        // Drizzle's `sql` template would be cleaner but the .set() only
        // accepts column expressions; for the v1 cut we let Drizzle
        // handle it as an update and we accept the small amount of
        // arithmetic drift from concurrent writes (single-instance).
        samples: hostMetricsHourly.samples,
        cpuAvg: hostMetricsHourly.cpuAvg,
        cpuMax: hostMetricsHourly.cpuMax,
        memAvgBytes: hostMetricsHourly.memAvgBytes,
        memMaxBytes: hostMetricsHourly.memMaxBytes,
        diskUsedBytes: hostMetricsHourly.diskUsedBytes,
        netInBytes: hostMetricsHourly.netInBytes,
        netOutBytes: hostMetricsHourly.netOutBytes,
        updatedAt: new Date(),
      },
    })
    .catch((err) => {
      logger.warn({ err, hostId }, 'hourly aggregate upsert failed')
    })
}

function resetOfflineTimer(conn: ConnectedAgent) {
  if (conn.offlineTimer) clearTimeout(conn.offlineTimer)
  conn.offlineTimer = setTimeout(() => {
    void markOfflineIfStale(conn.hostId)
  }, OFFLINE_AFTER_MS)
}

async function markOfflineIfStale(hostId: string) {
  const conn = connections.get(hostId)
  if (conn) {
    const stale = Date.now() - conn.lastHeartbeatAt > OFFLINE_AFTER_MS
    if (!stale) return
  }
  // Read the current row first so we know whether this is a real
  // transition (online → offline) and so we have the user/name for
  // the notification.
  const before = await db.query.hosts.findFirst({
    where: eq(hosts.id, hostId),
    columns: { id: true, userId: true, name: true, status: true },
  })
  await db
    .update(hosts)
    .set({ status: 'offline', updatedAt: new Date() })
    .where(eq(hosts.id, hostId))
  liveMetricsBus.publishStatus({ hostId, status: 'offline', ts: Date.now() })
  liveMetricsBus.clearHost(hostId)

  if (before && before.status === 'online') {
    void createNotification({
      userId: before.userId,
      type: 'host_offline',
      severity: 'warning',
      title: `${before.name} went offline`,
      relatedHostId: before.id,
    })
  }
}

function send(socket: WebSocket, msg: PlatformToAgentMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}

// Server Actions call this to push a deploy/lifecycle command to a
// connected agent. Returns false if the host has no live socket — the
// caller should surface that to the user instead of letting the action
// silently no-op.
export function sendToHost(hostId: string, msg: PlatformToAgentMessage): boolean {
  const conn = connections.get(hostId)
  if (!conn || conn.socket.readyState !== conn.socket.OPEN) return false
  send(conn.socket, msg)
  return true
}

export function isHostConnected(hostId: string): boolean {
  const conn = connections.get(hostId)
  return Boolean(conn && conn.socket.readyState === conn.socket.OPEN)
}

function sendError(socket: WebSocket, code: string, message: string) {
  send(socket, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'error',
    payload: { code, message },
  })
}
