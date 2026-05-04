'use client'

import { joinWaitlist } from '@/server/actions/waitlist'
import { useState, useTransition } from 'react'

type Status = { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string }

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setStatus({ kind: 'idle' })
    startTransition(async () => {
      const result = await joinWaitlist({
        email: formData.get('email'),
        source: formData.get('source'),
      })
      if (result.ok) {
        setStatus({ kind: 'success' })
        setEmail('')
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    })
  }

  if (status.kind === 'success') {
    return <SuccessState />
  }

  return (
    <form action={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="source" value="landing" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@somewhere.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          aria-invalid={status.kind === 'error'}
          aria-describedby={status.kind === 'error' ? 'waitlist-error' : undefined}
          className="flex-1 h-12 rounded-md border border-border bg-background px-4 text-base text-text placeholder:text-text-faint focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-md bg-ember px-6 text-sm font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Sending…' : 'Join waitlist'}
        </button>
      </div>
      {status.kind === 'error' && (
        <p id="waitlist-error" role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
    </form>
  )
}

function SuccessState() {
  const shareText = encodeURIComponent(
    'Just signed up for @serverfoundry — self-hosted control plane for game servers. Bring your hardware, deploy in minutes.',
  )
  const shareUrl = `https://x.com/intent/post?text=${shareText}&url=https%3A%2F%2Fserversfoundry.app`

  return (
    <output aria-live="polite" className="block rounded-md border border-ember/40 bg-ember/5 p-6">
      <p className="font-serif text-2xl text-text">You’re in.</p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Check your inbox to confirm — the link expires in 24 hours.
      </p>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center font-mono text-xs uppercase tracking-[0.18em] text-ember hover:text-ember-soft transition-colors"
      >
        Share on X →
      </a>
    </output>
  )
}
