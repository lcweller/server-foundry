'use client'

import { createPairingCode } from '@/server/actions/hosts'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'ready'; code: string; expiresAt: number }
  | { kind: 'error'; message: string }

export function AddHostFlow() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  function generate() {
    setStatus({ kind: 'generating' })
    startTransition(async () => {
      const result = await createPairingCode()
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error })
        return
      }
      setStatus({
        kind: 'ready',
        code: result.data.code,
        expiresAt: new Date(result.data.expiresAt).getTime(),
      })
    })
  }

  if (status.kind === 'idle' || status.kind === 'generating' || status.kind === 'error') {
    return (
      <div className="rounded-md border border-border bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Step 1 of 2</p>
        <h2 className="mt-3 text-2xl text-text">Generate a pairing code.</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
          The code expires in 15 minutes and works once. We’ll show the install command after it’s
          generated.
        </p>

        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Generating…' : 'Generate code'}
        </button>

        {status.kind === 'error' ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {status.message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <PairingCodeView
      code={status.code}
      expiresAt={status.expiresAt}
      onRefresh={() => router.refresh()}
    />
  )
}

function PairingCodeView({
  code,
  expiresAt,
  onRefresh,
}: {
  code: string
  expiresAt: number
  onRefresh: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState<'code' | 'cmd' | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const remainingMs = Math.max(0, expiresAt - now)
  const minutes = Math.floor(remainingMs / 60_000)
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
  const expired = remainingMs === 0

  const installCmd = `curl -fsSL https://serverfoundry.gg/install.sh | FOUNDRY_PAIR=${code} bash`

  async function copy(text: string, kind: 'code' | 'cmd') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Older browsers — silently fail; the user can select+copy manually.
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-border bg-surface p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
              Step 1 of 2 — Pairing code
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Single-use. Expires in{' '}
              <span className={expired ? 'text-danger' : 'text-text'}>
                {expired
                  ? 'expired'
                  : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-text-muted hover:text-text transition-colors"
          >
            New code →
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <code className="rounded-md border border-border bg-background px-6 py-4 font-mono text-3xl tracking-[0.2em] text-text">
            {code}
          </code>
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            disabled={expired}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-elevated px-4 text-xs font-medium text-text transition-colors hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
          Step 2 of 2 — Install
        </p>
        <h2 className="mt-3 text-2xl text-text">Run this on your Linux host.</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
          The agent installs as a systemd service, connects out, and shows up on your dashboard.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs text-text">
            <code>{installCmd}</code>
          </pre>
          <button
            type="button"
            onClick={() => copy(installCmd, 'cmd')}
            disabled={expired}
            className="self-start inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface-elevated px-4 text-xs font-medium text-text transition-colors hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied === 'cmd' ? 'Copied' : 'Copy command'}
          </button>
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          The install script lives at serverfoundry.gg/install.sh — published with the agent in
          Phase 4. The pairing code itself is live now.
        </p>
      </section>
    </div>
  )
}
