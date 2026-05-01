'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Severity = 'debug' | 'info' | 'warn' | 'error'

type LogLine = {
  ts: number
  severity: Severity
  message: string
}

type Props = {
  source: 'host' | 'server'
  // Host id when source='host', server id when source='server'.
  entityId: string
  className?: string
}

const SEVERITIES: Severity[] = ['debug', 'info', 'warn', 'error']
const RING_LIMIT = 1000

const severityClass: Record<Severity, string> = {
  debug: 'text-text-faint',
  info: 'text-text',
  warn: 'text-warning',
  error: 'text-danger',
}

export function LiveLogsPanel({ source, entityId, className }: Props) {
  const [lines, setLines] = useState<LogLine[]>([])
  const [streaming, setStreaming] = useState(false)
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [follow, setFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const path =
      source === 'host'
        ? `/api/stream/host/${entityId}/logs`
        : `/api/stream/server/${entityId}/logs`

    const es = new EventSource(path)
    setStreaming(true)

    es.addEventListener('log', (e) => {
      try {
        const line = JSON.parse((e as MessageEvent).data) as LogLine
        setLines((prev) => {
          const next = prev.length >= RING_LIMIT ? prev.slice(-RING_LIMIT + 1) : prev.slice()
          next.push(line)
          return next
        })
      } catch {
        /* ignore malformed event */
      }
    })

    es.onerror = () => {
      // EventSource reconnects automatically. Surface the gap so the
      // user knows we're catching up rather than silent.
      setStreaming(false)
    }
    es.onopen = () => setStreaming(true)

    return () => es.close()
  }, [source, entityId])

  // Auto-scroll on new lines while follow mode is on.
  useEffect(() => {
    if (!follow) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [follow])

  const visible = useMemo(() => {
    if (filter === 'all') return lines
    return lines.filter((l) => l.severity === filter)
  }, [lines, filter])

  return (
    <div className={`rounded-md border border-border bg-surface ${className ?? ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Logs</p>
          <span
            className={`font-mono text-[11px] uppercase tracking-[0.15em] ${
              streaming ? 'text-success' : 'text-text-muted'
            }`}
          >
            {streaming ? '● live' : '○ reconnecting'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SeverityFilter value={filter} onChange={setFilter} />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background accent-ember"
            />
            Follow
          </label>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="h-[420px] overflow-auto bg-background px-4 py-3 font-mono text-[12px] leading-relaxed"
        onScroll={(e) => {
          const el = e.currentTarget
          // If the user scrolls away from the bottom, drop follow.
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          if (!atBottom && follow) setFollow(false)
        }}
      >
        {visible.length === 0 ? (
          <p className="text-text-faint">No log lines yet.</p>
        ) : (
          visible.map((line, i) => (
            <div key={`${line.ts}-${i}`} className="flex gap-3 whitespace-pre-wrap break-words">
              <span className="shrink-0 text-text-faint">{formatTs(line.ts)}</span>
              <span className={`w-12 shrink-0 ${severityClass[line.severity]}`}>
                {line.severity}
              </span>
              <span className={severityClass[line.severity]}>{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SeverityFilter({
  value,
  onChange,
}: {
  value: Severity | 'all'
  onChange: (next: Severity | 'all') => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
      {(['all', ...SEVERITIES] as const).map((sev) => {
        const active = sev === value
        return (
          <button
            key={sev}
            type="button"
            onClick={() => onChange(sev)}
            className={`rounded px-2 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
              active ? 'bg-surface-elevated text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {sev}
          </button>
        )
      })}
    </div>
  )
}

function formatTs(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
