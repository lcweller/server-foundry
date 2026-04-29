'use server'

import { randomBytes } from 'node:crypto'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { db } from '@/server/db'
import { waitlistSignups } from '@/server/db/schema'
import { sendWaitlistConfirmation } from '@/server/email/send-waitlist-confirmation'
import { and, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: string }

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  source: z.string().trim().max(64).optional(),
})

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function getClientIp(headerList: Headers): string | null {
  // Cloudflare Tunnel sets cf-connecting-ip; fall back to x-forwarded-for.
  return (
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  )
}

export async function joinWaitlist(input: unknown): Promise<ActionResult> {
  let parsed: z.infer<typeof inputSchema>
  try {
    parsed = inputSchema.parse(input)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.errors[0]?.message ?? 'Invalid input.', code: 'VALIDATION' }
    }
    return { ok: false, error: 'Invalid input.', code: 'VALIDATION' }
  }

  const headerList = await headers()
  const ip = getClientIp(headerList)
  const userAgent = headerList.get('user-agent')

  const token = generateToken()

  try {
    // Insert or refresh the row. If the email exists and is already confirmed,
    // we leave confirmed_at intact and skip the email — the user is already in.
    const existing = await db.query.waitlistSignups.findFirst({
      where: eq(waitlistSignups.email, parsed.email),
    })

    let shouldSendEmail = true

    if (existing) {
      if (existing.confirmedAt) {
        // Already confirmed — silently succeed without resending.
        shouldSendEmail = false
      } else {
        // Re-issue token + bump metadata.
        await db
          .update(waitlistSignups)
          .set({
            confirmationToken: token,
            source: parsed.source ?? existing.source,
            ip: ip ?? existing.ip,
            userAgent: userAgent ?? existing.userAgent,
          })
          .where(and(eq(waitlistSignups.email, parsed.email), isNull(waitlistSignups.confirmedAt)))
      }
    } else {
      await db.insert(waitlistSignups).values({
        email: parsed.email,
        source: parsed.source,
        confirmationToken: token,
        ip,
        userAgent,
      })
    }

    if (shouldSendEmail) {
      const confirmationUrl = `${env.BETTER_AUTH_URL}/waitlist/confirm?token=${token}`
      await sendWaitlistConfirmation({ to: parsed.email, confirmationUrl })
    }

    logger.info({ email_hash: hashForLog(parsed.email), source: parsed.source }, 'waitlist signup')

    return { ok: true }
  } catch (err) {
    logger.error({ err }, 'waitlist signup failed')
    return {
      ok: false,
      error: 'Something went wrong. Try again in a moment.',
      code: 'INTERNAL',
    }
  }
}

// Hash the email for log lines so we can correlate without storing PII at info level.
function hashForLog(email: string): string {
  // Deterministic, short — not security-critical.
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

export async function confirmWaitlist(token: string): Promise<ActionResult> {
  if (!token || typeof token !== 'string' || token.length < 16) {
    return { ok: false, error: 'Invalid confirmation link.', code: 'INVALID_TOKEN' }
  }

  try {
    const row = await db.query.waitlistSignups.findFirst({
      where: eq(waitlistSignups.confirmationToken, token),
    })

    if (!row) {
      return { ok: false, error: 'This link is no longer valid.', code: 'NOT_FOUND' }
    }

    if (row.confirmedAt) {
      // Idempotent — re-clicking confirm is fine.
      return { ok: true }
    }

    await db
      .update(waitlistSignups)
      .set({ confirmedAt: new Date(), confirmationToken: null })
      .where(eq(waitlistSignups.id, row.id))

    logger.info({ id: row.id }, 'waitlist confirmation')
    return { ok: true }
  } catch (err) {
    logger.error({ err }, 'waitlist confirmation failed')
    return { ok: false, error: 'Something went wrong.', code: 'INTERNAL' }
  }
}
