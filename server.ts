// Custom Next.js server with WebSocket upgrade routing.
//
// Why a custom server: Next.js route handlers can't perform a WebSocket
// upgrade (no access to the underlying http.Server). The Foundry agent
// connects to /ws/agent and the platform pushes commands back over the
// same socket — bidirectional WS is the right primitive for that, so we
// wrap Next with a thin http server and dispatch upgrades ourselves.
//
// docs/architecture.md describes this exact arrangement: "WebSocket
// server (using `ws` package, integrated into Next.js custom server)".

import { type IncomingMessage, createServer } from 'node:http'
import next from 'next'
import { WebSocketServer } from 'ws'
import { startBackupScheduler } from './src/server/backups/scheduler'
import { handleAgentSocket } from './src/server/ws/agent-handler'
import { handleTerminalSocket } from './src/server/ws/terminal-handler'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)

async function main() {
  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()

  const httpServer = createServer((req, res) => {
    void handle(req, res)
  })

  // Upgrade routing — /ws/agent for paired hosts, /ws/terminal for
  // browser xterm sessions. Anything else gets the socket destroyed.
  const agentWss = new WebSocketServer({ noServer: true })
  const terminalWss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url ?? ''
    const pathname = url.split('?')[0] ?? '/'

    if (pathname === '/ws/agent') {
      agentWss.handleUpgrade(req, socket, head, (ws) => {
        void handleAgentSocket(ws, req)
      })
      return
    }

    if (pathname === '/ws/terminal') {
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        void handleTerminalSocket(ws, req)
      })
      return
    }

    // Next dev HMR uses its own upgrade hooks attached to this http
    // server during app.prepare(). Anything not /ws/agent that falls
    // through to here in production is unrecognised — close it.
    if (!dev) {
      socket.destroy()
    }
  })

  httpServer.listen(port, hostname, () => {
    // biome-ignore lint/suspicious/noConsole: server boot log
    console.log(`> Server Foundry ready on http://${hostname}:${port} (dev=${dev})`)
  })

  // Background scheduled-backup loop. Single-process; safe to run from
  // every Next instance because triggerBackup is idempotent on the
  // per-minute window (lastRunAt throttle).
  startBackupScheduler()
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: fatal boot error
  console.error('Fatal: server boot failed', err)
  process.exit(1)
})
