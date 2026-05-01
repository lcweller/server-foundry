import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { notifications as notificationsTable } from '@/server/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NotificationsList } from './notifications-list'

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
}

const PAGE_SIZE = 100

export default async function NotificationsPage() {
  const { user } = await requireUser()

  const rows = await db
    .select({
      id: notificationsTable.id,
      type: notificationsTable.type,
      severity: notificationsTable.severity,
      title: notificationsTable.title,
      body: notificationsTable.body,
      relatedHostId: notificationsTable.relatedHostId,
      relatedServerId: notificationsTable.relatedServerId,
      readAt: notificationsTable.readAt,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.deletedAt)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(PAGE_SIZE)

  const items = rows.map((r) => ({
    id: r.id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    body: r.body,
    relatedHostId: r.relatedHostId,
    relatedServerId: r.relatedServerId,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link
        href="/dashboard"
        className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
      >
        ← Dashboard
      </Link>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            <span className="text-accent">00</span>
            <span className="mx-2 text-text-faint">·</span>
            <span>Notifications</span>
          </p>
          <h1 className="mt-3 text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            Inbox.
          </h1>
        </div>
      </header>

      <div className="mt-10">
        <NotificationsList items={items} />
      </div>
    </div>
  )
}
