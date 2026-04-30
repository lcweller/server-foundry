'use client'

import type { HostStatus } from '@/server/db/schema'
import { useEffect, useState } from 'react'

type LiveMetrics = {
  hostId: string
  ts: number
  cpuPercent: number
  memUsedBytes: number
  memTotalBytes: number
  diskUsedBytes?: number
  diskTotalBytes?: number
  netInBytes?: number
  netOutBytes?: number
  cpuTempC?: number
  gpuTempC?: number
}

type Props = {
  hostId: string
  initialStatus: HostStatus
  /**
   * Total RAM/storage from the host record — used as fallback denominators
   * when the heartbeat doesn't carry them (e.g., disk total reported once).
   */
  fallbackRamBytes: number | null
  fallbackStorageBytes: number | null
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  const gb = bytes / 1024 ** 3
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(0)}%`
}

export function LiveMetricsPanel({
  hostId,
  initialStatus,
  fallbackRamBytes,
  fallbackStorageBytes,
}: Props) {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [status, setStatus] = useState<HostStatus>(initialStatus)
  const [streaming, setStreaming] = useState(false)

  useEffect(() => {
    const source = new EventSource(`/api/stream/host/${hostId}/metrics`)
    setStreaming(true)

    source.addEventListener('metrics', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as LiveMetrics
        setMetrics(data)
      } catch {
        /* ignore malformed event */
      }
    })

    source.addEventListener('status', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: HostStatus }
        setStatus(data.status)
      } catch {
        /* ignore */
      }
    })

    source.onerror = () => {
      // EventSource auto-reconnects with backoff. Surface the gap to the
      // user — we mark the stream as stale rather than blanking values.
      setStreaming(false)
    }

    source.onopen = () => setStreaming(true)

    return () => source.close()
  }, [hostId])

  const memTotal = metrics?.memTotalBytes ?? fallbackRamBytes ?? null
  const memUsed = metrics?.memUsedBytes ?? null
  const memPercent = memTotal && memUsed != null ? (memUsed / memTotal) * 100 : null

  const diskTotal = metrics?.diskTotalBytes ?? fallbackStorageBytes ?? null
  const diskUsed = metrics?.diskUsedBytes ?? null
  const diskPercent = diskTotal && diskUsed != null ? (diskUsed / diskTotal) * 100 : null

  const cpu = metrics?.cpuPercent ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
          Live · {status}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
          {!streaming
            ? 'Reconnecting…'
            : metrics
              ? `Updated ${Math.max(0, Math.round((Date.now() - metrics.ts) / 1000))}s ago`
              : 'Awaiting first heartbeat…'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="CPU" value={formatPercent(cpu)} fillPercent={cpu} />
        <Stat
          label="Memory"
          value={
            memUsed != null && memTotal ? `${formatBytes(memUsed)} / ${formatBytes(memTotal)}` : '—'
          }
          fillPercent={memPercent}
        />
        <Stat
          label="Disk"
          value={
            diskUsed != null && diskTotal
              ? `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`
              : '—'
          }
          fillPercent={diskPercent}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SmallStat label="Net in" value={formatBytes(metrics?.netInBytes ?? null)} />
        <SmallStat label="Net out" value={formatBytes(metrics?.netOutBytes ?? null)} />
        <SmallStat
          label="CPU temp"
          value={metrics?.cpuTempC != null ? `${metrics.cpuTempC.toFixed(0)} °C` : '—'}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  fillPercent,
}: {
  label: string
  value: string
  fillPercent: number | null
}) {
  const fill = fillPercent != null ? Math.min(100, Math.max(0, fillPercent)) : 0
  const danger = fillPercent != null && fillPercent >= 85
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">{label}</p>
      <p className="mt-2 font-serif text-2xl text-text">{value}</p>
      <div
        aria-hidden="true"
        className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-border"
      >
        {fillPercent != null ? (
          <div
            className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${danger ? 'bg-danger' : 'bg-ember'}`}
            style={{ width: `${fill}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">{label}</p>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  )
}
