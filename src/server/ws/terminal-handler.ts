// Reachable from server.ts directly — see src/lib/env.ts on the
// `server-only` omission rationale.
//
// Browser-facing /ws/terminal WebSocket. Authenticates via the existing
// Better Auth session cookie, verifies the user owns the requested
// host, then opens a terminal session via terminal-session.

import type { IncomingMessage } from 'node:http'
import { logger } from '@/lib/logger'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { hosts as hostsTable } from '@/server/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { WebSocket } from 'ws'
import { terminalSessions } from './terminal-session'

type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function handleTerminalSocket(socket: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url ?? '/', 'http://internal')
  const hostId = url.searchParams.get('hostId') ?? ''
  const cols = clampInt(url.searchParams.get('cols'), 80, 1, 1024)
  const rows = clampInt(url.searchParams.get('rows'), 24, 1, 1024)

  if (!UUID_RE.test(hostId)) {
    sendErr(socket, 'INVALID_HOST', 'Missing or malformed hostId.')
    socket.close(4400, 'bad-request')
    return
  }

  // Auth via session cookie. Better Auth's getSession reads from Headers;
  // wrap the upgrade request's headers into a fetch-style Headers map.
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v)
    else if (Array.isArray(v) && v[0]) headers.set(k, v[0])
  }
  const session = await auth.api.getSession({ headers })
  if (!session?.user) {
    sendErr(socket, 'AUTH_REQUIRED', 'Sign in to open a terminal.')
    socket.close(4401, 'unauthorized')
    return
  }

  const host = await db.query.hosts.findFirst({
    where: and(
      eq(hostsTable.id, hostId),
      eq(hostsTable.userId, session.user.id),
      isNull(hostsTable.deletedAt),
    ),
    columns: { id: true, status: true },
  })
  if (!host) {
    sendErr(socket, 'NOT_FOUND', 'Host not found.')
    socket.close(4404, 'not-found')
    return
  }
  if (host.status !== 'online') {
    sendErr(socket, 'HOST_OFFLINE', 'Host is offline.')
    socket.close(4503, 'host-offline')
    return
  }

  const sessionId = terminalSessions.bind({ hostId, browser: socket, cols, rows })
  if (!sessionId) {
    sendErr(socket, 'AGENT_OFFLINE', "Couldn't reach the agent — try again in a moment.")
    socket.close(4503, 'agent-offline')
    return
  }

  // Tell the browser the session is up so xterm can clear "connecting…".
  try {
    socket.send(JSON.stringify({ type: 'open', sessionId }))
  } catch {
    /* socket already gone — clean-up handled below */
  }

  socket.on('message', (raw) => {
    let parsed: ClientMessage
    try {
      parsed = JSON.parse(raw.toString()) as ClientMessage
    } catch {
      return
    }
    switch (parsed.type) {
      case 'input':
        if (typeof parsed.data === 'string') terminalSessions.sendInput(sessionId, parsed.data)
        return
      case 'resize':
        if (Number.isInteger(parsed.cols) && Number.isInteger(parsed.rows)) {
          terminalSessions.sendResize(sessionId, parsed.cols, parsed.rows)
        }
        return
    }
  })

  socket.on('close', () => {
    terminalSessions.endSession(sessionId, { reason: 'browser-disconnect' })
  })

  socket.on('error', (err) => {
    logger.warn({ err, sessionId }, 'browser terminal socket error')
  })
}

function sendErr(socket: WebSocket, code: string, message: string) {
  try {
    socket.send(JSON.stringify({ type: 'error', code, message }))
  } catch {
    /* socket already closed */
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
