import type { Metadata } from 'next'
import Link from 'next/link'
import { AddHostFlow } from './add-host-flow'

export const metadata: Metadata = {
  title: 'Add host',
  robots: { index: false, follow: false },
}

export default function AddHostPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
      >
        ← Back to dashboard
      </Link>

      <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <span className="text-accent">01</span>
        <span className="mx-2 text-text-faint">·</span>
        <span>Add host</span>
      </p>
      <h1 className="mt-3 text-3xl leading-tight tracking-tight text-text sm:text-4xl">
        Pair a Linux host.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
        Generate a single-use pairing code. Paste the install command on any Linux host you own. The
        agent connects out to Server Foundry over a single TLS connection — no port forwarding, no
        firewall rules.
      </p>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-faint">
        New hardware?{' '}
        <a
          href="https://github.com/serverfoundry/server-foundry-os/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-soft transition-colors"
        >
          Download GameServerOS
        </a>{' '}
        — a hardened Debian 12 ISO with the agent baked in. Boot from USB, walk through six screens,
        paste your pairing code, done.
      </p>

      <div className="mt-12">
        <AddHostFlow />
      </div>
    </div>
  )
}
