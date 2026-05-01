import { Callsign } from '@/components/ui/callsign'
import { Surface } from '@/components/ui/surface'
import type { Host } from '@/server/db/schema'
import Link from 'next/link'
import { StatusPip } from './status-pip'

function formatBytes(bytes: bigint | null | undefined): string {
  if (bytes == null) return '—'
  const num = Number(bytes)
  const gb = num / 1024 ** 3
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(num / 1024 ** 2).toFixed(0)} MB`
}

function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return 'never'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

type Props = {
  host: Pick<
    Host,
    'id' | 'name' | 'hostname' | 'os' | 'cpuCores' | 'ramBytes' | 'status' | 'lastSeenAt'
  >
}

export function HostCard({ host }: Props) {
  return (
    <Link
      href={`/dashboard/hosts/${host.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
    >
      <Surface variant="interactive" className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Callsign id={host.id} className="text-accent" />
            <p className="mt-2 truncate text-xl text-text">{host.name}</p>
            <p className="mt-1 truncate font-mono text-xs text-text-muted">
              {host.hostname || '—'}
            </p>
          </div>
          <StatusPip status={host.status} />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-4 text-xs">
          <div>
            <dt className="font-mono uppercase tracking-[0.15em] text-text-faint">OS</dt>
            <dd className="mt-1 truncate text-text-muted">{host.os || '—'}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.15em] text-text-faint">CPU</dt>
            <dd className="mt-1 text-text-muted">
              {host.cpuCores ? `${host.cpuCores} cores` : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.15em] text-text-faint">RAM</dt>
            <dd className="mt-1 text-text-muted">{formatBytes(host.ramBytes)}</dd>
          </div>
        </dl>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
          Last seen {formatRelativeTime(host.lastSeenAt)}
        </p>
      </Surface>
    </Link>
  )
}
