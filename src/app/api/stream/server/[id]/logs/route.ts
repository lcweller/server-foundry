import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  gameServerLogs,
  gameServers as gameServersTable,
  hosts as hostsTable,
} from '@/server/db/schema'
import { type LogLine, liveLogsBus } from '@/server/ws/live-logs-bus'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

// GET /api/stream/server/[id]/logs
//
// SSE stream of game-server stdout/stderr. Same shape as the host
// stream — last 200 rows then live tail. Ownership check joins through
// hosts since game_servers don't carry user_id directly.

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

  const owned = await db
    .select({ id: gameServersTable.id })
    .from(gameServersTable)
    .innerJoin(hostsTable, eq(hostsTable.id, gameServersTable.hostId))
    .where(
      and(
        eq(gameServersTable.id, id),
        eq(hostsTable.userId, session.user.id),
        isNull(gameServersTable.deletedAt),
        isNull(hostsTable.deletedAt),
      ),
    )
    .limit(1)

  if (!owned[0]) {
    return new Response('Not found', { status: 404 })
  }

  const recent = await db
    .select({
      ts: gameServerLogs.ts,
      severity: gameServerLogs.severity,
      message: gameServerLogs.message,
    })
    .from(gameServerLogs)
    .where(eq(gameServerLogs.serverId, id))
    .orderBy(desc(gameServerLogs.ts))
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

      const off = liveLogsBus.onServerLog(id, (line) => {
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
