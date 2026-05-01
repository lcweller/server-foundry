import { Wordmark } from '@/components/marketing/wordmark'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  footer?: ReactNode
  children: ReactNode
}

export function AuthShell({ eyebrow, title, subtitle, footer, children }: Props) {
  return (
    <div data-surface="ops" className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="Server Foundry — home" className="-m-2 p-2">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            <span className="text-accent">{eyebrow}</span>
          </p>
          <h1 className="mt-4 text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-base leading-relaxed text-text-muted">{subtitle}</p>
          ) : null}

          <div className="mt-10">{children}</div>

          {footer ? <div className="mt-8 text-sm text-text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
