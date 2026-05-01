import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Section title strip used at the top of every dashboard section:
// optional eyebrow (mono caps) + sans-serif title + optional subtitle
// + optional right-side action (button, link, etc.).
//
// Distinct from src/components/marketing/section-eyebrow — that one is
// for hero/landing typography (serif headlines, larger scale). This
// one is operational: tight, sans, data-density-friendly.

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, subtitle, action, className }: Props) {
  return (
    <header className={cn('flex items-end justify-between gap-4', className)}>
      <div className="flex flex-col gap-2">
        {eyebrow ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl tracking-tight text-text">{title}</h2>
        {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
