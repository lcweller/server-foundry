import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { hostLogs, hosts as hostsTable } from '@/server/db/schema'
import { type LogLine, liveLogsBus } from '@/server/ws/live-logs-bus'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

// GET /api/stream/host/[id]/logs
//
// Server-Sent Events stream of host log lines. Replays the most recent
// 200 entries from the DB on connect, then streams new lines from the
// in-memory bus. Same auth + ownership model as the metrics SSE.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const KEEPALIVE_INTERVAL_MS = 25_000
const REPLAY_LIMIT = 200

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Not found', { status: 404 })
  }

  const session = await getCurrentSession()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const host = await db.query.hosts.findFirst({
    where: and(
      eq(hostsTable.id, id),
      eq(hostsTable.userId, session.user.id),
      isNull(hostsTable.deletedAt),
    ),
    columns: { id: true },
  })
  if (!host) {
    return new Response('Not found', { status: 404 })
  }

  // Replay the last N rows oldest→newest so the UI can append to its
  // bottom without re-sorting.
  const recent = await db
    .select({
      ts: hostLogs.ts,
      severity: hostLogs.severity,
      message: hostLogs.message,
    })
    .from(hostLogs)
    .where(eq(hostLogs.hostId, host.id))
    .orderBy(desc(hostLogs.ts))
    .limit(REPLAY_LIMIT)
    .then((rows) => rows.reverse())

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      for (const row of recent) {
        send('log', {
          ts: row.ts.getTime(),
          severity: row.severity,
          message: row.message,
        } satisfies LogLine)
      }

      const off = liveLogsBus.onHostLog(host.id, (line) => {
        send('log', line)
      })

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`))
      }, KEEPALIVE_INTERVAL_MS)

      const cleanup = () => {
        clearInterval(keepAlive)
        off()
        try {
          controller.close()
        } catch {
          /* ignore — already closed */
        }
      }

      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// asc imported but not directly used — keep it next to desc for symmetry
// when the streaming UI later supports backfill in the other direction.
void asc
