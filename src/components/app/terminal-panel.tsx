'use client'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'

type Status =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'closed'; reason: string }
  | { kind: 'error'; message: string }

type Props = {
  hostId: string
}

export function TerminalPanel({ hostId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'connecting' })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#0b0b0e',
        foreground: '#e6e1d8',
        cursor: '#ff7a45',
        cursorAccent: '#0b0b0e',
      },
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const initialCols = term.cols
    const initialRows = term.rows

    // Build the WS URL with the same host as the page; the server.ts
    // upgrade router accepts /ws/terminal here.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws/terminal?hostId=${encodeURIComponent(hostId)}&cols=${initialCols}&rows=${initialRows}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      // session 'open' arrives as a JSON message — keep status as
      // connecting until then.
    }

    ws.onmessage = (e) => {
      let msg: { type: string; data?: string; code?: string; message?: string }
      try {
        msg = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data))
      } catch {
        return
      }
      if (msg.type === 'open') {
        setStatus({ kind: 'open' })
        return
      }
      if (msg.type === 'data' && typeof msg.data === 'string') {
        // Agent sends raw PTY bytes base64-encoded.
        try {
          const bin = atob(msg.data)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          term.write(bytes)
        } catch {
          /* malformed — drop */
        }
        return
      }
      if (msg.type === 'closed') {
        setStatus({ kind: 'closed', reason: 'pty-exited' })
        return
      }
      if (msg.type === 'error') {
        setStatus({ kind: 'error', message: msg.message ?? msg.code ?? 'error' })
        return
      }
    }

    ws.onclose = () => {
      setStatus((prev) =>
        prev.kind === 'closed' || prev.kind === 'error'
          ? prev
          : { kind: 'closed', reason: 'disconnected' },
      )
    }

    ws.onerror = () => {
      setStatus({ kind: 'error', message: 'WebSocket error' })
    }

    const onData = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const onResize = () => {
      try {
        fit.fit()
      } catch {
        /* container detached */
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      onData.dispose()
      window.removeEventListener('resize', onResize)
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      term.dispose()
      termRef.current = null
      fitRef.current = null
      wsRef.current = null
    }
  }, [hostId])

  return (
    <div className="rounded-md border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Terminal</p>
        <StatusBadge status={status} />
      </header>
      <div ref={containerRef} className="h-[480px] w-full bg-[#0b0b0e] p-2" />
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const text =
    status.kind === 'connecting'
      ? 'connecting'
      : status.kind === 'open'
        ? '● live'
        : status.kind === 'closed'
          ? `closed (${status.reason})`
          : `error: ${status.message}`
  const color =
    status.kind === 'open'
      ? 'text-success'
      : status.kind === 'connecting'
        ? 'text-text-muted'
        : status.kind === 'closed'
          ? 'text-text-muted'
          : 'text-danger'
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.15em] ${color}`}>{text}</span>
  )
}
