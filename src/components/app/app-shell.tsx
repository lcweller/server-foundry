import { Wordmark } from '@/components/marketing/wordmark'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { UserMenu } from './user-menu'

type Props = {
  user: { id: string; email: string; name: string; image: string | null }
  children: ReactNode
}

export function AppShell({ user, children }: Props) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" aria-label="Server Foundry" className="-m-2 p-2">
              <Wordmark />
            </Link>
            <nav aria-label="Primary" className="hidden gap-6 sm:flex">
              <Link
                href="/dashboard"
                className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>
          <UserMenu user={user} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
