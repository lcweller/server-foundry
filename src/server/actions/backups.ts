'use server'

import { logger } from '@/lib/logger'
import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  type Backup,
  type BackupConfig,
  backupConfigs,
  backups,
  gameServers,
  hosts,
} from '@/server/db/schema'
import { decryptJson, encryptJson, isCryptoConfigured } from '@/server/lib/crypto'
import { sendToHost } from '@/server/ws/agent-handler'
import { and, asc, desc, eq, isNull, lt, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

// ─── ownership check ────────────────────────────────────────────

async function loadOwnedServer(userId: string, serverId: string) {
  const rows = await db
    .select({ server: gameServers, host: hosts })
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

// ─── updateBackupConfig ─────────────────────────────────────────

const s3CredentialsSchema = z.object({
  bucket: z.string().min(1).max(64),
  region: z.string().max(64).optional(),
  endpoint: z.string().url().optional(),
  accessKeyId: z.string().min(8).max(128),
  secretAccessKey: z.string().min(8).max(256),
})

const updateConfigInput = z.object({
  serverId: z.string().regex(UUID_RE),
  isEnabled: z.boolean(),
  scheduleCron: z.string().max(128).nullable(),
  retentionCount: z.number().int().min(1).max(365),
  destination: z.discriminatedUnion('type', [
    z.object({ type: z.literal('platform') }),
    z.object({ type: z.literal('s3'), credentials: s3CredentialsSchema }),
  ]),
})

export async function updateBackupConfig(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = updateConfigInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid backup config.', code: 'VALIDATION' }

  const owned = await loadOwnedServer(session.user.id, parsed.data.serverId)
  if (!owned) return { ok: false, error: 'Server not found.', code: 'NOT_FOUND' }

  // S3 destination requires the at-rest encryption key. Refuse rather
  // than silently storing creds plaintext.
  if (parsed.data.destination.type === 's3' && !isCryptoConfigured()) {
    return {
      ok: false,
      error: 'BACKUP_ENCRYPTION_KEY must be configured before saving S3 credentials.',
      code: 'CRYPTO_NOT_CONFIGURED',
    }
  }

  const destinationConfigJson =
    parsed.data.destination.type === 's3' ? encryptJson(parsed.data.destination.credentials) : null

  await db
    .insert(backupConfigs)
    .values({
      serverId: parsed.data.serverId,
      isEnabled: parsed.data.isEnabled,
      scheduleCron: parsed.data.scheduleCron,
      retentionCount: parsed.data.retentionCount,
      destinationType: parsed.data.destination.type,
      destinationConfigJson,
    })
    .onConflictDoUpdate({
      target: backupConfigs.serverId,
      set: {
        isEnabled: parsed.data.isEnabled,
        scheduleCron: parsed.data.scheduleCron,
        retentionCount: parsed.data.retentionCount,
        destinationType: parsed.data.destination.type,
        destinationConfigJson,
        updatedAt: new Date(),
      },
    })

  revalidatePath(`/dashboard/servers/${parsed.data.serverId}`)
  return { ok: true, data: undefined }
}

// ─── triggerBackup ──────────────────────────────────────────────

const triggerInput = z.object({ serverId: z.string().regex(UUID_RE) })

export async function triggerBackup(input: unknown): Promise<ActionResult<{ backupId: string }>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = triggerInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }

  return startBackup(session.user.id, parsed.data.serverId, 'manual')
}

// Internal entry point used by both the user-facing trigger and the
// scheduled backup loop. userId is the host's owner.
export async function startBackup(
  userId: string,
  serverId: string,
  triggeredBy: 'manual' | 'scheduled',
): Promise<ActionResult<{ backupId: string }>> {
  const owned = await loadOwnedServer(userId, serverId)
  if (!owned) return { ok: false, error: 'Server not found.', code: 'NOT_FOUND' }

  const cfg = await db.query.backupConfigs.findFirst({
    where: eq(backupConfigs.serverId, serverId),
  })
  if (!cfg) {
    return {
      ok: false,
      error: 'Configure backup destination first.',
      code: 'NO_BACKUP_CONFIG',
    }
  }

  let destination: { type: 'platform' } | (z.infer<typeof s3CredentialsSchema> & { type: 's3' })
  if (cfg.destinationType === 's3') {
    if (!cfg.destinationConfigJson || typeof cfg.destinationConfigJson !== 'string') {
      return { ok: false, error: 'S3 credentials missing.', code: 'NO_BACKUP_CONFIG' }
    }
    try {
      const decoded = decryptJson<z.infer<typeof s3CredentialsSchema>>(cfg.destinationConfigJson)
      destination = { type: 's3', ...decoded }
    } catch (err) {
      logger.error({ err, serverId }, 'failed to decrypt S3 credentials')
      return {
        ok: false,
        error: 'Could not decrypt S3 credentials. Re-save them.',
        code: 'DECRYPT_FAILED',
      }
    }
  } else {
    return {
      ok: false,
      error: 'Platform-managed backup storage isn’t available yet. Configure S3 instead.',
      code: 'PLATFORM_STORAGE_UNAVAILABLE',
    }
  }

  const retentionUntil = new Date()
  retentionUntil.setDate(retentionUntil.getDate() + cfg.retentionCount)

  const [created] = await db
    .insert(backups)
    .values({
      serverId,
      status: 'running',
      retentionUntil,
      triggeredBy,
    })
    .returning({ id: backups.id })

  if (!created) {
    return { ok: false, error: 'Could not create backup row.', code: 'INTERNAL' }
  }

  const objectKey = `foundry-backups/${serverId}/${created.id}.tar.gz`

  const sent = sendToHost(owned.host.id, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'backup_server',
    payload: {
      backupId: created.id,
      serverId,
      objectKey,
      destination:
        destination.type === 's3'
          ? {
              type: 's3',
              bucket: destination.bucket,
              ...(destination.region ? { region: destination.region } : {}),
              ...(destination.endpoint ? { endpoint: destination.endpoint } : {}),
              accessKeyId: destination.accessKeyId,
              secretAccessKey: destination.secretAccessKey,
            }
          : destination,
    },
  })

  if (!sent) {
    await db
      .update(backups)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'Host offline when backup was requested.',
      })
      .where(eq(backups.id, created.id))
    return { ok: false, error: 'Host is offline.', code: 'HOST_OFFLINE' }
  }

  // Mark the config so the scheduler doesn't fire again immediately.
  await db
    .update(backupConfigs)
    .set({ lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(backupConfigs.serverId, serverId))

  revalidatePath(`/dashboard/servers/${serverId}`)
  return { ok: true, data: { backupId: created.id } }
}

// ─── restoreBackup ──────────────────────────────────────────────

const restoreInput = z.object({
  serverId: z.string().regex(UUID_RE),
  backupId: z.string().regex(UUID_RE),
})

export async function restoreBackup(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = restoreInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }

  const owned = await loadOwnedServer(session.user.id, parsed.data.serverId)
  if (!owned) return { ok: false, error: 'Server not found.', code: 'NOT_FOUND' }

  const backup = await db.query.backups.findFirst({
    where: and(
      eq(backups.id, parsed.data.backupId),
      eq(backups.serverId, parsed.data.serverId),
      eq(backups.status, 'completed'),
    ),
  })
  if (!backup || !backup.storageUrl) {
    return { ok: false, error: 'Completed backup not found.', code: 'NOT_FOUND' }
  }

  const cfg = await db.query.backupConfigs.findFirst({
    where: eq(backupConfigs.serverId, parsed.data.serverId),
  })
  if (!cfg || cfg.destinationType !== 's3' || !cfg.destinationConfigJson) {
    return { ok: false, error: 'Backup destination not configured.', code: 'NO_BACKUP_CONFIG' }
  }

  let creds: z.infer<typeof s3CredentialsSchema>
  try {
    creds = decryptJson<z.infer<typeof s3CredentialsSchema>>(cfg.destinationConfigJson as string)
  } catch (err) {
    logger.error({ err, serverId: parsed.data.serverId }, 'failed to decrypt S3 credentials')
    return { ok: false, error: 'Could not decrypt S3 credentials.', code: 'DECRYPT_FAILED' }
  }

  // Reuse the storage URL as the object key (the agent uploaded it
  // there originally; it knows how to reconstruct the URL from the
  // bucket + objectKey if needed).
  const objectKey = backup.storageUrl.replace(/^[a-z0-9]+:\/\/[^/]+\//i, '')

  const sent = sendToHost(owned.host.id, {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type: 'restore_server',
    payload: {
      backupId: parsed.data.backupId,
      serverId: parsed.data.serverId,
      objectKey,
      destination: {
        type: 's3',
        bucket: creds.bucket,
        ...(creds.region ? { region: creds.region } : {}),
        ...(creds.endpoint ? { endpoint: creds.endpoint } : {}),
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    },
  })

  if (!sent) {
    return { ok: false, error: 'Host is offline.', code: 'HOST_OFFLINE' }
  }

  revalidatePath(`/dashboard/servers/${parsed.data.serverId}`)
  return { ok: true, data: undefined }
}

// ─── helpers used by the UI ─────────────────────────────────────

export async function listBackups(serverId: string): Promise<Backup[]> {
  // Read-only; no auth here — caller should pre-check ownership in the
  // server component that queries this.
  return db
    .select()
    .from(backups)
    .where(eq(backups.serverId, serverId))
    .orderBy(desc(backups.startedAt))
    .limit(50)
}

export async function loadBackupConfig(serverId: string): Promise<BackupConfig | null> {
  const row = await db.query.backupConfigs.findFirst({
    where: eq(backupConfigs.serverId, serverId),
  })
  return row ?? null
}

// ─── retention sweep helper (called by the scheduler) ───────────

// Hard-delete rows whose retentionUntil has passed and whose status
// is terminal. The S3 object lifecycle is managed by the user's bucket
// policy in v1 — we don't issue DELETE requests against it from here.
export async function sweepExpiredBackups(): Promise<void> {
  await db
    .delete(backups)
    .where(and(ne(backups.status, 'running'), lt(backups.retentionUntil, new Date())))
}

// asc/isNull imported for symmetry — unused locally but keep the import
// list consistent with other actions files.
void asc
void isNull
