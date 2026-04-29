'use client'

import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string | undefined
  hint?: string
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          'h-11 rounded-md border bg-background px-3 text-base text-text placeholder:text-text-faint focus:outline-none focus:ring-2',
          error
            ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-border focus:border-ember focus:ring-ember/30',
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
