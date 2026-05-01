import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Standard "nothing here yet" panel. Centred, mono-eyebrow, sans
// headline, muted body, optional CTA. Copy follows brand voice rules
// (warm, direct, never blames the user, no "no resources found"
// language).

type Props = {
  eyebrow?: string
  title: string
  body?: ReactNode
  cta?: ReactNode
  className?: string
}

export function EmptyState({ eyebrow, title, body, cta, className }: Props) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}
    >
      {eyebrow ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      ) : null}
      <h3 className="text-xl tracking-tight text-text">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-text-muted">{body}</p> : null}
      {cta ? <div className="mt-2">{cta}</div> : null}
    </div>
  )
}
