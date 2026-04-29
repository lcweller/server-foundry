'use client'

import { AuthDivider } from '@/components/auth/auth-divider'
import { AuthShell } from '@/components/auth/auth-shell'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { TextField } from '@/components/auth/text-field'
import { signUp } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'

export function SignupForm({ footer }: { footer?: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const name = String(formData.get('name') ?? '').trim() || email.split('@')[0] || 'Forge user'

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    startTransition(async () => {
      const { error } = await signUp.email({
        email,
        password,
        name,
        callbackURL: '/dashboard',
      })
      if (error) {
        setError(error.message ?? 'Sign up failed.')
        return
      }
      router.push(`/verify-email?email=${encodeURIComponent(email)}`)
    })
  }

  return (
    <AuthShell
      eyebrow="Sign up"
      title="Create your account."
      subtitle="Forge your worlds. Bring your own hardware."
      footer={footer}
    >
      <OAuthButtons callbackURL="/dashboard" />
      <AuthDivider />

      <form action={onSubmit} className="space-y-4" noValidate>
        <TextField
          name="name"
          type="text"
          label="Display name"
          autoComplete="name"
          placeholder="Optional — we'll use the part before the @ if blank."
          disabled={pending}
        />
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          disabled={pending}
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          hint="At least 8 characters."
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
          {pending ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-xs text-text-faint">
          By creating an account you agree to our terms and privacy policy.
        </p>
      </form>
    </AuthShell>
  )
}
