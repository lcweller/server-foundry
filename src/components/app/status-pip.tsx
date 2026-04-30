import { cn } from '@/lib/utils'
import type { HostStatus } from '@/server/db/schema'

const statusMap: Record<HostStatus, { label: string; dot: string; text: string }> = {
  online: {
    label: 'Online',
    dot: 'bg-success',
    text: 'text-success',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-text-faint',
    text: 'text-text-muted',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-warning animate-pulse',
    text: 'text-warning',
  },
  updating: {
    label: 'Updating',
    dot: 'bg-ember animate-pulse',
    text: 'text-ember',
  },
}

type Props = {
  status: HostStatus
  className?: string
}

export function StatusPip({ status, className }: Props) {
  const cfg = statusMap[status]
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-xs', cfg.text, className)}
      aria-label={`Status: ${cfg.label}`}
    >
      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} aria-hidden="true" />
      <span className="font-mono uppercase tracking-[0.15em]">{cfg.label}</span>
    </span>
  )
}
