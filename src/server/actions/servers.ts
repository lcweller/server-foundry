'use server'

import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/audit/record'
import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { gameCatalog, gameServers, hosts } from '@/server/db/schema'
import { sendToHost } from '@/server/ws/agent-handler'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

// Maximum length for human-facing fields. Keep generous for game-server
// names (people put their entire shrine to skeletons in there) but
// finite so we don't store unbounded strings.
const NAME_MAX = 64

const deployInput = z.object({
  hostId: z.string().regex(UUID_RE),
  gameId: z.string().regex(UUID_RE),
  name: z.string().trim().min(1).max(NAME_MAX),
  port: z.number().int().min(1).max(65535).optional(),
  // The deploy wizard validates per-game, server-side. Passing through
  // as opaque JSON is fine — agents enforce the actual game-side
  // contract.
  config: z.record(z.string(), z.unknown()).default({}),
})

const idInput = z.object({ serverId: z.string().regex(UUID_RE) })

async function loadOwnedServer(userId: string, serverId: string) {
  // Inner join hosts so we can verify ownership in a single query.
  const rows = await db
    .select({
      server: gameServers,
      host: hosts,
    })
    .from(gameServers)
    .innerJoin(hosts, eq(hosts.id, gameServers.hostId))
    .where(
      and(
        eq(gameServers.id, serverId),
        eq(hosts.userId, userId),
        isNull(gameServers.deletedAt),
        isNull(hosts.deletedAt),
      ),
    )
    .limit(1)
  return rows[0]
}

export async function deployServer(input: unknown): Promise<ActionResult<{ serverId: string }>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in to deploy a server.', code: 'UNAUTHENTICATED' }
  }

  const parsed = deployInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid deploy request.', code: 'VALIDATION' }
  }
  const { hostId, gameId, name, port, config } = parsed.data

  const host = await db.query.hosts.findFirst({
    where: and(eq(hosts.id, hostId), eq(hosts.userId, session.user.id), isNull(hosts.deletedAt)),
  })
  if (!host) return { ok: false, error: 'Host not found.', code: 'NOT_FOUND' }

  const game = await db.query.gameCatalog.findFirst({
    where: and(eq(gameCatalog.id, gameId), eq(gameCatalog.isEnabled, true)),
  })
  if (!game) return { ok: false, error: 'Game not available.', code: 'NOT_FOUND' }

  const desiredPort = port ?? game.defaultPort

  // Port-conflict check on the same host. Excludes soft-deleted servers
  // and any in `deleting` status (port frees once agent confirms).
  const conflict = await db.query.gameServers.findFirst({
    where: and(
      eq(gameServers.hostId, hostId),
      eq(gameServers.port, desiredPort),
      isNull(gameServers.deletedAt),
      ne(gameServers.status, 'deleting'),
    ),
  })
  if (conflict) {
    return {
      ok: false,
      error: `Port ${desiredPort} is already used by "${conflict.name}" on this host.`,
      code: 'PORT_IN_USE',
    }
  }

  const [created] = await db
    .insert(gameServers)
    .values({
      hostId,
      gameId,
      name,
      port: desiredPort,
      configJson: config,
      status: 'deploying',
    })
    .returning({ id: gameServers.id })

  if (!created) {
    return { ok: false, error: 'Couldn’t create server record.', code: 'INTERNAL' }
  }

  const sent = sendToHost(hostId, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'deploy_server',
    payload: {
      serverId: created.id,
      gameSlug: game.slug,
      ...(game.steamAppId != null ? { steamAppId: game.steamAppId } : {}),
      name,
      port: desiredPort,
      config,
    },
  })

  if (!sent) {
    // Host is paired but the agent isn't currently connected. Leave the
    // record as `deploying`; once the agent reconnects we'll resend
    // pending deploys (Phase 6 work). For now, surface the state to the
    // user so they don't think it silently succeeded.
    logger.warn(
      { hostId, serverId: created.id },
      'deploy queued but agent not connected — record left in deploying state',
    )
  }

  logger.info(
    { userId: session.user.id, hostId, serverId: created.id, dispatched: sent },
    'server deploy requested',
  )
  void recordAudit({
    userId: session.user.id,
    action: 'server_deployed',
    entityType: 'server',
    entityId: created.id,
    metadata: { hostId, gameId, port: desiredPort, dispatched: sent },
  })

  revalidatePath(`/dashboard/hosts/${hostId}`)
  revalidatePath(`/dashboard/servers/${created.id}`)
  return { ok: true, data: { serverId: created.id } }
}

async function lifecycle(
  serverId: string,
  type: 'start_server' | 'stop_server' | 'restart_server',
  ownerLog: string,
  auditAction: 'server_started' | 'server_stopped' | 'server_restarted',
): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in to manage servers.', code: 'UNAUTHENTICATED' }
  }

  const row = await loadOwnedServer(session.user.id, serverId)
  if (!row) return { ok: false, error: 'Server not found.', code: 'NOT_FOUND' }

  const sent = sendToHost(row.host.id, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type,
    payload: { serverId },
  })
  if (!sent) {
    return {
      ok: false,
      error: 'Host is offline — reconnect the agent to control this server.',
      code: 'HOST_OFFLINE',
    }
  }

  logger.info({ userId: session.user.id, serverId }, ownerLog)
  void recordAudit({
    userId: session.user.id,
    action: auditAction,
    entityType: 'server',
    entityId: serverId,
  })
  revalidatePath(`/dashboard/servers/${serverId}`)
  revalidatePath(`/dashboard/hosts/${row.host.id}`)
  return { ok: true, data: undefined }
}

export async function startServer(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }
  return lifecycle(parsed.data.serverId, 'start_server', 'server start requested', 'server_started')
}

export async function stopServer(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }
  return lifecycle(parsed.data.serverId, 'stop_server', 'server stop requested', 'server_stopped')
}

export async function restartServer(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }
  return lifecycle(
    parsed.data.serverId,
    'restart_server',
    'server restart requested',
    'server_restarted',
  )
}

export async function deleteServer(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in to delete a server.', code: 'UNAUTHENTICATED' }
  }
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }
  const { serverId } = parsed.data

  const row = await loadOwnedServer(session.user.id, serverId)
  if (!row) return { ok: false, error: 'Server not found.', code: 'NOT_FOUND' }

  // Mark deleting first so the UI reflects intent regardless of agent
  // reachability. Soft delete locally; agent confirms via
  // server_status_change('stopped') + we then null deletedAt? No — we
  // want a tombstone so port and name free up. Keep deletedAt set; the
  // agent's deletion confirms the on-disk cleanup.
  await db
    .update(gameServers)
    .set({ status: 'deleting', deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(gameServers.id, serverId))

  const sent = sendToHost(row.host.id, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'delete_server',
    payload: { serverId },
  })

  if (!sent) {
    logger.warn(
      { hostId: row.host.id, serverId },
      'delete queued but agent not connected — local record marked deleting',
    )
  }

  logger.info({ userId: session.user.id, serverId, dispatched: sent }, 'server delete requested')
  void recordAudit({
    userId: session.user.id,
    action: 'server_deleted',
    entityType: 'server',
    entityId: serverId,
    metadata: { dispatched: sent },
  })
  revalidatePath(`/dashboard/hosts/${row.host.id}`)
  revalidatePath(`/dashboard/servers/${serverId}`)
  return { ok: true, data: undefined }
}
