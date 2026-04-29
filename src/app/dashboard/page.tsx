import { requireUser } from '@/server/auth/session'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const { user } = await requireUser()
  const firstName = user.name?.split(/\s+/)[0] || user.email.split('@')[0]

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <span className="text-ember">00</span>
        <span className="mx-2 text-text-faint">·</span>
        <span>Welcome</span>
      </p>
      <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
        {firstName}, your dashboard is forming.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted">
        Phase 3 brings host pairing, live vitals, and the deploy flow. For now, your account is live
        and your email is verified — the foundry is yours when it opens.
      </p>

      <div className="mt-12 rounded-md border border-border bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">What’s next</p>
        <ul className="mt-4 space-y-3 text-sm text-text-muted">
          <li>
            <span className="text-ember">·</span> Add a host (Phase 3): generate a pairing code, run
            the install on your Linux box, see it appear here.
          </li>
          <li>
            <span className="text-ember">·</span> Deploy a game server (Phase 5): pick from the
            catalog, configure, ship.
          </li>
          <li>
            <span className="text-ember">·</span> Logs, terminal, backups — coming after deployment
            lands.
          </li>
        </ul>
      </div>

      <div className="mt-8 text-sm text-text-muted">
        <Link href="/settings" className="text-ember hover:text-ember-soft transition-colors">
          Settings →
        </Link>
      </div>
    </div>
  )
}
