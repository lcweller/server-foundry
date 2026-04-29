'use client'

import { AuthShell } from '@/components/auth/auth-shell'
import { TextField } from '@/components/auth/text-field'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function onSubmit(formData: FormData) {
    setError(null)
    const newPassword = String(formData.get('password') ?? '')
    const confirm = String(formData.get('confirm') ?? '')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords don’t match.')
      return
    }

    startTransition(async () => {
      const { error } = await authClient.resetPassword({ newPassword, token })
      if (error) {
        setError(error.message ?? 'Couldn’t reset your password.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 1500)
    })
  }

  if (done) {
    return (
      <AuthShell eyebrow="Done" title="Password updated." subtitle="Redirecting you to log in…">
        <div />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Set new password"
      title="Choose a new password."
      subtitle="At least 8 characters. Make it count."
      footer={
        <p>
          <Link href="/login" className="text-text-muted hover:text-text transition-colors">
            ← Back to log in
          </Link>
        </p>
      }
    >
      <form action={onSubmit} className="space-y-4" noValidate>
        <TextField
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
        <TextField
          name="confirm"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          required
          minLength={8}
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
          className="h-11 w-full rounded-md bg-ember px-6 text-sm font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    </AuthShell>
  )
}
