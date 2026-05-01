'use server'

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/audit/record'
import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { agentUpdates, hosts } from '@/server/db/schema'
import { sendToHost } from '@/server/ws/agent-handler'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

const triggerInput = z.object({
  hostId: z.string().regex(UUID_RE),
  // Optional — if omitted we fall back to the env-driven manifest.
  version: z.string().min(1).max(64).optional(),
  downloadUrl: z.string().url().optional(),
  signature: z.string().max(512).optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
})

export async function triggerAgentUpdate(
  input: unknown,
): Promise<ActionResult<{ updateId: string }>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = triggerInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }

  const host = await db.query.hosts.findFirst({
    where: and(
      eq(hosts.id, parsed.data.hostId),
      eq(hosts.userId, session.user.id),
      isNull(hosts.deletedAt),
    ),
  })
  if (!host) return { ok: false, error: 'Host not found.', code: 'NOT_FOUND' }

  const version = parsed.data.version ?? env.AGENT_UPDATE_VERSION
  const downloadUrl = parsed.data.downloadUrl ?? env.AGENT_UPDATE_DOWNLOAD_URL
  const signature = parsed.data.signature ?? env.AGENT_UPDATE_SIGNATURE
  const sha256 = parsed.data.sha256 ?? env.AGENT_UPDATE_SHA256

  if (!version || !downloadUrl) {
    return {
      ok: false,
      error:
        'No update target. Set AGENT_UPDATE_VERSION + AGENT_UPDATE_DOWNLOAD_URL or pass version/downloadUrl in the trigger.',
      code: 'NO_UPDATE_TARGET',
    }
  }

  const [created] = await db
    .insert(agentUpdates)
    .values({
      hostId: host.id,
      fromVersion: host.agentVersion ?? null,
      toVersion: version,
      downloadUrl,
      status: 'running',
    })
    .returning({ id: agentUpdates.id })

  if (!created) {
    return { ok: false, error: 'Could not create update row.', code: 'INTERNAL' }
  }

  const sent = sendToHost(host.id, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'update_agent',
    payload: {
      updateId: created.id,
      version,
      downloadUrl,
      ...(signature ? { signature } : {}),
      ...(sha256 ? { sha256 } : {}),
    },
  })

  if (!sent) {
    await db
      .update(agentUpdates)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'Host offline when update was requested.',
      })
      .where(eq(agentUpdates.id, created.id))
    return { ok: false, error: 'Host is offline.', code: 'HOST_OFFLINE' }
  }

  logger.info({ hostId: host.id, updateId: created.id, version }, 'agent update dispatched')

  void recordAudit({
    userId: session.user.id,
    action: 'agent_update_triggered',
    entityType: 'host',
    entityId: host.id,
    metadata: { updateId: created.id, fromVersion: host.agentVersion ?? null, toVersion: version },
  })

  revalidatePath(`/dashboard/hosts/${host.id}`)
  return { ok: true, data: { updateId: created.id } }
}
