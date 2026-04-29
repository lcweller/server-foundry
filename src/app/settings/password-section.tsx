'use client'

import { TextField } from '@/components/auth/text-field'
import { authClient } from '@/lib/auth-client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

type Props = {
  hasPassword: boolean
}

export function PasswordSection({ hasPassword }: Props) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'ok' } | { kind: 'err'; msg: string }
  >({
    kind: 'idle',
  })

  function onSubmit(formData: FormData) {
    setStatus({ kind: 'idle' })
    const currentPassword = String(formData.get('currentPassword') ?? '')
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirm = String(formData.get('confirm') ?? '')

    if (newPassword.length < 8) {
      setStatus({ kind: 'err', msg: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirm) {
      setStatus({ kind: 'err', msg: 'Passwords don’t match.' })
      return
    }

    startTransition(async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        setStatus({ kind: 'err', msg: error.message ?? 'Couldn’t change password.' })
        return
      }
      setStatus({ kind: 'ok' })
    })
  }

  if (!hasPassword) {
    return (
      <SettingsSection
        title="Password"
        description="You signed in with an OAuth provider. Set a password if you’d like to log in with email."
      >
        <p className="text-sm text-text-muted">
          Use{' '}
          <Link
            href="/forgot-password"
            className="text-ember hover:text-ember-soft transition-colors"
          >
            password reset
          </Link>{' '}
          to set your first password.
        </p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Password"
      description="Changing your password signs you out of every other device."
    >
      <form action={onSubmit} className="space-y-4">
        <TextField
          name="currentPassword"
          type="password"
          label="Current password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
        <TextField
          name="newPassword"
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
          label="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-ember px-5 text-sm font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? 'Updating…' : 'Update password'}
          </button>
          {status.kind === 'ok' ? (
            <span className="text-sm text-success">Updated.</span>
          ) : status.kind === 'err' ? (
            <span role="alert" className="text-sm text-danger">
              {status.msg}
            </span>
          ) : null}
        </div>
      </form>
    </SettingsSection>
  )
}
