// 24-hour uptime strip — one cell per hour, oldest on the left.
//
// Source: presence/absence of host_metrics_hourly rows for the host
// in the last 24 UTC-aligned hour buckets. A row exists iff the agent
// reported at least one heartbeat that hour, which we use as a proxy
// for "host was online at some point during that hour".
//
// Cells are tri-state:
//   present — accent (lime). Host was alive that hour.
//   absent  — muted neutral. We don't know — render uncertain, NOT
//             offline. Don't fabricate.
//   future  — n/a (we never render hours past "now").
//
// TODO(phase12-backlog): replace this proxy with a strict-uptime
// table populated by agent-handler.ts on connect/disconnect. That
// gives sub-hour fidelity ("alive 47 of 60 minutes this hour") and
// distinguishes "agent reported in" from "agent was actually online".
// Schema work, out of scope for the UI-only Phase 12 cut.

import { cn } from '@/lib/utils'

type Props = {
  // ISO timestamps of hour buckets that have data (UTC-aligned).
  presentHours: string[]
  className?: string
}

const HOUR_MS = 60 * 60 * 1000
const WINDOW_HOURS = 24

function utcHourBucket(ms: number): Date {
  return new Date(Math.floor(ms / HOUR_MS) * HOUR_MS)
}

function formatHourLabel(d: Date): string {
  // Local-time hour label — e.g. "14:00", helpful when scrubbing the
  // strip. Date itself stays UTC-aligned to match what's in the DB.
  const h = d.getHours().toString().padStart(2, '0')
  return `${h}:00`
}

export function UptimeHeatmap({ presentHours, className }: Props) {
  const now = Date.now()
  const currentBucket = utcHourBucket(now)
  const presentSet = new Set(presentHours)

  const cells: { iso: string; present: boolean; label: string }[] = []
  for (let i = WINDOW_HOURS - 1; i >= 0; i--) {
    const bucket = new Date(currentBucket.getTime() - i * HOUR_MS)
    const iso = bucket.toISOString()
    cells.push({
      iso,
      present: presentSet.has(iso),
      label: formatHourLabel(bucket),
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex h-6 gap-px" role="img" aria-label="Last 24 hours uptime">
        {cells.map((cell) => (
          <div
            key={cell.iso}
            title={`${cell.label} — ${cell.present ? 'reported' : 'no data'}`}
            className={cn(
              'flex-1 rounded-sm transition-colors',
              cell.present ? 'bg-accent/70' : 'bg-text-faint/15',
            )}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
        <span>−24h</span>
        <span>now</span>
      </div>
    </div>
  )
}
