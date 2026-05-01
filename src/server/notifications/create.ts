// Reachable from server.ts via the WS handler — see src/lib/env.ts on
// the server-only omission rationale.
//
// Notification creator. The single entry point for adding rows to the
// notifications table. Honours the user's per-type preferences for
// in-app + email; if both are disabled, the call is a no-op (we'd
// rather skip the row than persist invisible noise).
//
// Email send is fire-and-forget (caller doesn't await) — a failed
// SMTP/Resend round-trip should never block the WS path that produced
// the event.

import { logger } from '@/lib/logger'
import { db } from '@/server/db'
import {
  type NotificationSeverity,
  type NotificationType,
  notificationPreferences,
  notifications,
  users,
} from '@/server/db/schema'
import { and, eq } from 'drizzle-orm'

export type CreateNotificationInput = {
  userId: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  body?: string
  relatedHostId?: string
  relatedServerId?: string
}

// Default opt-in for in-app, opt-out for email — applies when the user
// has no row in notification_preferences for this type.
function defaultsFor(_type: NotificationType): { inApp: boolean; email: boolean } {
  return { inApp: true, email: false }
}

async function loadPreference(userId: string, type: NotificationType) {
  const row = await db.query.notificationPreferences.findFirst({
    where: and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)),
  })
  if (row) return { inApp: row.inAppEnabled, email: row.emailEnabled }
  return defaultsFor(type)
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const pref = await loadPreference(input.userId, input.type)

  if (!pref.inApp && !pref.email) {
    return
  }

  if (pref.inApp) {
    const row: {
      userId: string
      type: NotificationType
      severity: NotificationSeverity
      title: string
      body?: string
      relatedHostId?: string
      relatedServerId?: string
    } = {
      userId: input.userId,
      type: input.type,
      severity: input.severity,
      title: input.title,
    }
    if (input.body) row.body = input.body
    if (input.relatedHostId) row.relatedHostId = input.relatedHostId
    if (input.relatedServerId) row.relatedServerId = input.relatedServerId
    await db
      .insert(notifications)
      .values(row)
      .catch((err) => {
        logger.warn({ err, type: input.type }, 'notification insert failed')
      })
  }

  if (pref.email) {
    // Fire and forget — load the user's email + dispatch.
    void sendEmailFor(input).catch((err) => {
      logger.warn({ err, type: input.type, userId: input.userId }, 'notification email failed')
    })
  }
}

async function sendEmailFor(input: CreateNotificationInput): Promise<void> {
  // Lazy-import the email sender so this module stays usable in
  // contexts where Resend isn't configured (tests, dev with no key).
  const [{ sendNotificationEmail }, userRow] = await Promise.all([
    import('@/server/email/send-notification'),
    db.query.users.findFirst({
      where: eq(users.id, input.userId),
      columns: { email: true, name: true },
    }),
  ])
  if (!userRow?.email) return
  await sendNotificationEmail({
    to: userRow.email,
    name: userRow.name ?? null,
    severity: input.severity,
    title: input.title,
    body: input.body ?? null,
  })
}
