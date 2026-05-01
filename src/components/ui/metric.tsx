import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Compact metric block — label (eyebrow) + value (mono) + optional
// delta. Used wherever a single number wants to be readable at a
// glance: CPU%, RAM, port, uptime, byte counts.
//
// Delta semantics map onto our palette: 'up' wins green (== accent),
// 'down' wins danger red, 'flat' is muted neutral. Caller decides
// which direction is good — for "errors", up is bad, so caller passes
// kind='down' for the visually-good case.

type DeltaKind = 'up' | 'down' | 'flat'

type Props = {
  label: string
  value: ReactNode
  delta?: { kind: DeltaKind; text: string }
  className?: string
}

const deltaClasses: Record<DeltaKind, string> = {
  up: 'text-accent',
  down: 'text-danger',
  flat: 'text-text-muted',
}

export function Metric({ label, value, delta, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
        {label}
      </span>
      <span className="font-mono text-base text-text tabular-nums">{value}</span>
      {delta ? (
        <span className={cn('font-mono text-xs tabular-nums', deltaClasses[delta.kind])}>
          {delta.text}
        </span>
      ) : null}
    </div>
  )
}
