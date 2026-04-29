import Link from 'next/link'
import { Wordmark } from './wordmark'

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col gap-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark size="lg" />
            <div className="mt-3 h-px w-12 bg-brass" aria-hidden="true" />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-text-muted">
              Self-hosted control plane for multiplayer game servers. Bring your hardware, forge
              your worlds.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-3 text-sm sm:items-end">
            <a
              href="https://x.com/serverfoundry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text transition-colors"
            >
              X / Twitter ↗
            </a>
            <a
              href="https://github.com/serverfoundry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text transition-colors"
            >
              GitHub ↗
            </a>
            <Link href="/privacy" className="text-text-muted hover:text-text transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-text-muted hover:text-text transition-colors">
              Terms
            </Link>
          </nav>
        </div>

        <p className="mt-16 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          © {new Date().getFullYear()} Server Foundry · Forged on hardware we own
        </p>
      </div>
    </footer>
  )
}
