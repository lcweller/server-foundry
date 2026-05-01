// Reachable from server.ts directly — see src/lib/env.ts.
//
// Terminal session manager. Owns the bridge between browser-side
// WebSockets (xterm.js sessions) and the platform→agent WS.
//
// Lifecycle:
//   1. Browser opens /ws/terminal?hostId=… (auth via session cookie).
//   2. Platform creates a sessionId, calls bind() to attach the browser
//      socket, then sends `terminal_open` to the agent over the existing
//      agent socket.
//   3. Agent spawns a PTY, streams `terminal_data` back; platform routes
//      each chunk to the bound browser WS.
//   4. Browser sends keystrokes (raw text) and resize events (JSON)
//      directly over its WS; the bridge translates into `terminal_input`
//      / `terminal_resize` agent messages.
//   5. On browser close → platform sends `terminal_close` to the agent.
//      On agent `terminal_closed` → platform closes the browser socket.

import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import type { TerminalClosedMessage, TerminalDataMessage } from '@/shared/agent-protocol'
import type { WebSocket } from 'ws'
import { sendToHost } from './agent-handler'

type TerminalSession = {
  sessionId: string
  hostId: string
  browser: WebSocket
}

class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSession>()

  bind(opts: {
    hostId: string
    browser: WebSocket
    cols: number
    rows: number
  }): string | null {
    const sessionId = randomUUID()
    const sent = sendToHost(opts.hostId, {
      id: randomUUID(),
      ts: Date.now(),
      type: 'terminal_open',
      payload: { sessionId, cols: opts.cols, rows: opts.rows },
    })
    if (!sent) return null

    this.sessions.set(sessionId, { sessionId, hostId: opts.hostId, browser: opts.browser })
    logger.info({ sessionId, hostId: opts.hostId }, 'terminal session opened')
    return sessionId
  }

  // Browser → agent: send keystrokes.
  sendInput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    sendToHost(session.hostId, {
      id: randomUUID(),
      ts: Date.now(),
      type: 'terminal_input',
      payload: { sessionId, data },
    })
  }

  // Browser → agent: resize the PTY.
  sendResize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    sendToHost(session.hostId, {
      id: randomUUID(),
      ts: Date.now(),
      type: 'terminal_resize',
      payload: { sessionId, cols, rows },
    })
  }

  // Agent → browser: forward PTY output. Returns false if the session
  // is gone (caller can ignore).
  forwardData(msg: TerminalDataMessage): boolean {
    const session = this.sessions.get(msg.payload.sessionId)
    if (!session) return false
    if (session.browser.readyState !== session.browser.OPEN) {
      this.endSession(msg.payload.sessionId, { reason: 'browser-closed' })
      return false
    }
    try {
      session.browser.send(JSON.stringify({ type: 'data', data: msg.payload.data }))
      return true
    } catch (err) {
      logger.warn({ err, sessionId: msg.payload.sessionId }, 'terminal forward failed')
      return false
    }
  }

  // Agent → browser: PTY exited. Close the browser socket and drop state.
  forwardClosed(msg: TerminalClosedMessage): void {
    const session = this.sessions.get(msg.payload.sessionId)
    if (!session) return
    try {
      session.browser.send(
        JSON.stringify({
          type: 'closed',
          exitCode: msg.payload.exitCode ?? null,
          signal: msg.payload.signal ?? null,
        }),
      )
    } catch {
      /* ignore — the close below is what matters */
    }
    try {
      session.browser.close(1000, 'pty-exited')
    } catch {
      /* ignore */
    }
    this.sessions.delete(msg.payload.sessionId)
    logger.info({ sessionId: msg.payload.sessionId }, 'terminal session closed (agent)')
  }

  // Browser disconnect → tell the agent to kill the PTY.
  endSession(sessionId: string, opts: { reason: string }): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    sendToHost(session.hostId, {
      id: randomUUID(),
      ts: Date.now(),
      type: 'terminal_close',
      payload: { sessionId },
    })
    this.sessions.delete(sessionId)
    logger.info({ sessionId, reason: opts.reason }, 'terminal session closed (browser)')
  }
}

const globalForBus = globalThis as unknown as { __sfTerminalMgr?: TerminalSessionManager }
export const terminalSessions = globalForBus.__sfTerminalMgr ?? new TerminalSessionManager()
if (!globalForBus.__sfTerminalMgr) globalForBus.__sfTerminalMgr = terminalSessions
