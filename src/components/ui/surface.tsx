import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef } from 'react'

// Frosted-glass card — the base spatial primitive of the Cinematic
// Operations register. Renders against the dashboard's ambient glow
// layer (see [data-surface="ops"]::before in globals.css), so the
// backdrop-blur picks up the lime/cool-blue ambience underneath.
//
// Variants:
//   flat        — static container, no shadow, no hover
//   elevated    — raised with a soft shadow, still static
//   interactive — adds a 1px lift + accent border glow on hover

type Variant = 'flat' | 'elevated' | 'interactive'

type Props = ComponentPropsWithoutRef<'div'> & {
  variant?: Variant
}

const baseClasses = 'rounded-lg border border-border bg-surface/60 backdrop-blur-md'

const variantClasses: Record<Variant, string> = {
  flat: '',
  elevated: 'shadow-lg shadow-black/40',
  interactive:
    'transition-[transform,border-color,box-shadow] hover:-translate-y-px hover:border-accent/40 hover:shadow-[0_0_24px_-12px] hover:shadow-accent/40',
}

export function Surface({ variant = 'flat', className, children, ...props }: Props) {
  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} {...props}>
      {children}
    </div>
  )
}
