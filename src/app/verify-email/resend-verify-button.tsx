'use client'

import { authClient } from '@/lib/auth-client'
import { useState, useTransition } from 'react'

export function ResendVerifyButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  function resend() {
    setStatus('idle')
    startTransition(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/dashboard',
      })
      setStatus(error ? 'error' : 'sent')
    })
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={resend}
        disabled={pending || status === 'sent'}
        className="h-11 w-full rounded-md border border-border bg-surface px-6 text-sm font-medium text-text transition-colors hover:bg-surface-elevated disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending
          ? 'Sending…'
          : status === 'sent'
            ? 'Sent — check your inbox'
            : 'Resend confirmation'}
      </button>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          Couldn’t resend right now. Try again in a minute.
        </p>
      ) : null}
    </div>
  )
}
