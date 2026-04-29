import Link from 'next/link'
import { Wordmark } from './wordmark'

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/80 border-b border-border">
      <nav className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
        <Link href="/" aria-label="Server Foundry — home" className="-m-2 p-2">
          <Wordmark />
        </Link>
        <Link
          href="#waitlist"
          className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
        >
          Join waitlist
        </Link>
      </nav>
    </header>
  )
}
