import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { notifications as notificationsTable } from '@/server/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// GET /api/notifications/latest
//
// Lightweight JSON poll for the bell. Returns unread count + the most
// recent 10 entries. Polled every 20s by the bell component — cheap
// enough to skip an SSE channel for v1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LATEST_LIMIT = 10

export async function GET(_req: NextRequest) {
  const session = await getCurrentSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    .where(
      and(eq(notificationsTable.userId, session.user.id), isNull(notificationsTable.deletedAt)),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(LATEST_LIMIT)

  const unreadCount = rows.filter((r) => r.readAt == null).length

  return NextResponse.json(
    {
      unreadCount,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        relatedHostId: r.relatedHostId,
        relatedServerId: r.relatedServerId,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
