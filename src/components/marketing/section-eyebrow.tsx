import { cn } from '@/lib/utils'

type Props = {
  number: string
  label: string
  className?: string
}

export function SectionEyebrow({ number, label, className }: Props) {
  return (
    <p className={cn('font-mono text-xs uppercase tracking-[0.2em] text-text-muted', className)}>
      <span className="text-ember">{number}</span>
      <span className="mx-2 text-text-faint">·</span>
      <span>{label}</span>
    </p>
  )
}
