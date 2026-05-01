'use client'

import { AuthShell } from '@/components/auth/auth-shell'
import { TextField } from '@/components/auth/text-field'
import { authClient } from '@/lib/auth-client'
import { type ReactNode, useState, useTransition } from 'react'

export function ForgotPasswordForm({ footer }: { footer?: ReactNode }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '').trim()
    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })
      if (error) {
        setError(error.message ?? 'Something went wrong. Try again.')
        return
      }
      setStatus('sent')
    })
  }

  if (status === 'sent') {
    return (
      <AuthShell
        eyebrow="Reset sent"
        title="Check your inbox."
        subtitle="If an account exists for that email, we sent a reset link. The link expires in 15 minutes."
        footer={footer}
      >
        <div />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send you a link to set a new one."
      footer={footer}
    >
      <form action={onSubmit} className="space-y-4" noValidate>
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          disabled={pending}
        />

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-md bg-accent px-6 text-sm font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}
