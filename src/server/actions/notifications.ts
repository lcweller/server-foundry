'use server'

import { logger } from '@/lib/logger'
import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  type NotificationType,
  notificationPreferences,
  notificationTypeEnum,
  notifications,
} from '@/server/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

const idInput = z.object({ notificationId: z.string().regex(UUID_RE) })

export async function markNotificationRead(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, parsed.data.notificationId),
        eq(notifications.userId, session.user.id),
        isNull(notifications.deletedAt),
        isNull(notifications.readAt),
      ),
    )

  revalidatePath('/dashboard/notifications')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function markAllNotificationsRead(): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
        isNull(notifications.deletedAt),
      ),
    )

  revalidatePath('/dashboard/notifications')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function dismissNotification(input: unknown): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = idInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.', code: 'VALIDATION' }

  await db
    .update(notifications)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(notifications.id, parsed.data.notificationId),
        eq(notifications.userId, session.user.id),
        isNull(notifications.deletedAt),
      ),
    )

  revalidatePath('/dashboard/notifications')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

const preferencesInput = z.object({
  preferences: z.array(
    z.object({
      type: z.enum(notificationTypeEnum.enumValues as [NotificationType, ...NotificationType[]]),
      inAppEnabled: z.boolean(),
      emailEnabled: z.boolean(),
    }),
  ),
})

export async function updateNotificationPreferences(
  input: unknown,
): Promise<ActionResult<undefined>> {
  const session = await getCurrentSession()
  if (!session?.user) {
    return { ok: false, error: 'Sign in.', code: 'UNAUTHENTICATED' }
  }
  const parsed = preferencesInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid preferences.', code: 'VALIDATION' }
  }

  try {
    await db.transaction(async (tx) => {
      for (const pref of parsed.data.preferences) {
        await tx
          .insert(notificationPreferences)
          .values({
            userId: session.user.id,
            type: pref.type,
            inAppEnabled: pref.inAppEnabled,
            emailEnabled: pref.emailEnabled,
          })
          .onConflictDoUpdate({
            target: [notificationPreferences.userId, notificationPreferences.type],
            set: {
              inAppEnabled: pref.inAppEnabled,
              emailEnabled: pref.emailEnabled,
              updatedAt: new Date(),
            },
          })
      }
    })
  } catch (err) {
    logger.error({ err, userId: session.user.id }, 'updateNotificationPreferences failed')
    return { ok: false, error: 'Something went wrong.', code: 'INTERNAL' }
  }

  revalidatePath('/settings')
  return { ok: true, data: undefined }
}
