'use server'

import { randomInt } from 'node:crypto'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/audit/record'
import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { hosts, pairingCodes } from '@/server/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

// Pairing-code character set: avoids ambiguous glyphs (0, O, 1, I, L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PAIRING_TTL_MS = 15 * 60 * 1000

function generateCode(): string {
  // Format: XXXX-XXXX, 30^8 ≈ 6.5e11 combinations.
  const chars: string[] = []
  for (let i = 0; i < 8; i++) {
    chars.push(ALPHABET[randomInt(0, ALPHABET.length)] ?? 'X')
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

export async function createPairingCode(): Promise<
  ActionResult<{ code: string; expiresAt: string }>
> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in to add a host.', code: 'UNAUTHENTICATED' }
  }

  // Retry a few times on the unlikely chance of collision; 30^8 collisions are
  // statistically near-zero but the unique constraint is the source of truth.
  let attempts = 0
  while (attempts < 5) {
    const code = generateCode()
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS)
    try {
      await db.insert(pairingCodes).values({
        code,
        userId: session.user.id,
        expiresAt,
      })
      logger.info({ userId: session.user.id }, 'pairing code created')
      void recordAudit({
        userId: session.user.id,
        action: 'pairing_code_created',
        metadata: { expiresAt: expiresAt.toISOString() },
      })
      return { ok: true, data: { code, expiresAt: expiresAt.toISOString() } }
    } catch (err) {
      attempts++
      logger.warn({ err, attempts }, 'pairing code insert failed; retrying')
    }
  }
  return { ok: false, error: 'Couldn’t generate a code. Try again.', code: 'INTERNAL' }
}

export async function removeHost(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in to remove a host.', code: 'UNAUTHENTICATED' }
  }

  if (!input || typeof input !== 'object' || !('hostId' in input)) {
    return { ok: false, error: 'Missing host id.', code: 'VALIDATION' }
  }
  const hostId = String((input as { hostId: unknown }).hostId)
  if (!/^[0-9a-f-]{36}$/i.test(hostId)) {
    return { ok: false, error: 'Invalid host id.', code: 'VALIDATION' }
  }

  try {
    // Soft-delete — revokes the agent token (subsequent agent connections
    // can't authenticate because we'll filter on deletedAt IS NULL on the
    // agent side). Hard delete happens via background reaper later.
    const updated = await db
      .update(hosts)
      .set({
        deletedAt: new Date(),
        agentTokenHash: null,
        status: 'offline',
        updatedAt: new Date(),
      })
      .where(and(eq(hosts.id, hostId), eq(hosts.userId, session.user.id), isNull(hosts.deletedAt)))
      .returning({ id: hosts.id })

    if (updated.length === 0) {
      return { ok: false, error: 'Host not found.', code: 'NOT_FOUND' }
    }

    logger.info({ userId: session.user.id, hostId }, 'host removed')
    void recordAudit({
      userId: session.user.id,
      action: 'host_removed',
      entityType: 'host',
      entityId: hostId,
    })
    revalidatePath('/dashboard')
    return { ok: true, data: undefined }
  } catch (err) {
    logger.error({ err }, 'host remove failed')
    return { ok: false, error: 'Something went wrong.', code: 'INTERNAL' }
  }
}
