import { cn } from '@/lib/utils'
import type { ServerStatus } from '@/server/db/schema'

const statusMap: Record<ServerStatus, { label: string; dot: string; text: string }> = {
  deploying: { label: 'Deploying', dot: 'bg-info animate-pulse', text: 'text-info' },
  running: { label: 'Running', dot: 'bg-success', text: 'text-success' },
  stopped: { label: 'Stopped', dot: 'bg-text-faint', text: 'text-text-muted' },
  crashed: { label: 'Crashed', dot: 'bg-danger', text: 'text-danger' },
  deleting: { label: 'Deleting', dot: 'bg-warning animate-pulse', text: 'text-warning' },
}

type Props = {
  status: ServerStatus
  className?: string
}

export function ServerStatusBadge({ status, className }: Props) {
  const cfg = statusMap[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs transition-colors duration-300',
        cfg.text,
        className,
      )}
      aria-label={`Status: ${cfg.label}`}
    >
      <span
        className={cn('h-2 w-2 rounded-full transition-colors duration-300', cfg.dot)}
        aria-hidden="true"
      />
      <span className="font-mono uppercase tracking-[0.15em]">{cfg.label}</span>
    </span>
  )
}
