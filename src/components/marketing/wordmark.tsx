import { cn } from '@/lib/utils'

type Props = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
} as const

export function Wordmark({ className, size = 'md' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-semibold tracking-tight text-text',
        sizeMap[size],
        className,
      )}
    >
      <span>Server</span>
      <span className="font-serif italic font-normal text-ember">Foundry</span>
    </span>
  )
}
