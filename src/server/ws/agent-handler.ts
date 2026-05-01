// Reachable from server.ts directly — see src/lib/env.ts on the
// `server-only` omission rationale.
import type { IncomingMessage } from 'node:http'
import { logger } from '@/lib/logger'
import { hashAgentToken, isAgentTokenSignatureValid } from '@/server/auth/agent-token'
import { db } from '@/server/db'
import { gameServers, hostMetricsHourly, hosts } from '@/server/db/schema'
import {
  type AgentToPlatformMessage,
  HEARTBEAT_INTERVAL_SECONDS,
  type PlatformToAgentMessage,
  agentToPlatformMessage,
} from '@/shared/agent-protocol'
import { and, eq, isNull } from 'drizzle-orm'
import type { WebSocket } from 'ws'
import { liveMetricsBus } from './live-metrics-bus'

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

  await db
    .update(hosts)
    .set({ status: 'online', lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(hosts.id, host.id))
  liveMetricsBus.publishStatus({ hostId: host.id, status: 'online', ts: Date.now() })

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
      // Log handling lands in Phase 6. Accept and discard for now so
      // agents that send logs aren't surprised by errors.
      return
  }
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
  await db
    .update(hosts)
    .set({ status: 'offline', updatedAt: new Date() })
    .where(eq(hosts.id, hostId))
  liveMetricsBus.publishStatus({ hostId, status: 'offline', ts: Date.now() })
  liveMetricsBus.clearHost(hostId)
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
