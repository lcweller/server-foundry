'use client'

import { AuthDivider } from '@/components/auth/auth-divider'
import { AuthShell } from '@/components/auth/auth-shell'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { TextField } from '@/components/auth/text-field'
import { signIn } from '@/lib/auth-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'

export function LoginForm({ footer }: { footer?: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')

    startTransition(async () => {
      const { error } = await signIn.email({ email, password, callbackURL: '/dashboard' })
      if (error) {
        setError(error.message ?? 'Invalid email or password.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <AuthShell
      eyebrow="Log in"
      title="Welcome back."
      subtitle="Sign in to your Server Foundry account."
      footer={footer}
    >
      <OAuthButtons callbackURL="/dashboard" />
      <AuthDivider />

      <form action={onSubmit} className="space-y-4" noValidate>
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          disabled={pending}
        />
        <div>
          <TextField
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
            disabled={pending}
            minLength={8}
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

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
          {pending ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}
