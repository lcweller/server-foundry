import { getCurrentSession } from '@/server/auth/session'
import { db } from '@/server/db'
import { hosts as hostsTable } from '@/server/db/schema'
import { type LiveMetrics, liveMetricsBus } from '@/server/ws/live-metrics-bus'
import { and, eq, isNull } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

// GET /api/stream/host/[id]/metrics
//
// Server-Sent Events stream of live host metrics. Subscribed by the
// dashboard Overview tab; one connection per (browser tab, host).
// Authentication is the regular Better Auth session cookie. The host
// must belong to the requesting user — enumeration would expose the
// existence of other users' host IDs otherwise.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const KEEPALIVE_INTERVAL_MS = 25_000

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

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Replay the cached latest reading immediately so the UI doesn't
      // wait up to one heartbeat to render.
      const cached = liveMetricsBus.getLatest(host.id)
      if (cached) send('metrics', cached)

      const offMetrics = liveMetricsBus.onMetrics(host.id, (metrics: LiveMetrics) => {
        send('metrics', metrics)
      })

      const offStatus = liveMetricsBus.onStatus(host.id, (status) => {
        send('status', status)
      })

      // SSE keepalive — comments don't fire client-side handlers but
      // keep proxies (Cloudflare, nginx) from idling the connection.
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`))
      }, KEEPALIVE_INTERVAL_MS)

      const cleanup = () => {
        clearInterval(keepAlive)
        offMetrics()
        offStatus()
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
