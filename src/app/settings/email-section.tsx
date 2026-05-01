'use client'

import { TextField } from '@/components/auth/text-field'
import { authClient } from '@/lib/auth-client'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

type Props = {
  currentEmail: string
}

export function EmailSection({ currentEmail }: Props) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'sent' } | { kind: 'err'; msg: string }
  >({
    kind: 'idle',
  })

  function onSubmit(formData: FormData) {
    setStatus({ kind: 'idle' })
    const newEmail = String(formData.get('newEmail') ?? '')
      .trim()
      .toLowerCase()
    if (newEmail === currentEmail.toLowerCase()) {
      setStatus({ kind: 'err', msg: 'That’s already your email.' })
      return
    }

    startTransition(async () => {
      const { error } = await authClient.changeEmail({
        newEmail,
        callbackURL: '/settings',
      })
      if (error) {
        setStatus({ kind: 'err', msg: error.message ?? 'Couldn’t change email.' })
        return
      }
      setStatus({ kind: 'sent' })
    })
  }

  return (
    <SettingsSection
      title="Email"
      description="Used for sign-in and notifications. Changing it requires confirming the new address."
    >
      <p className="text-sm text-text-muted">
        Current: <span className="text-text">{currentEmail}</span>
      </p>

      <form action={onSubmit} className="space-y-4">
        <TextField
          name="newEmail"
          type="email"
          label="New email"
          autoComplete="email"
          required
          disabled={pending}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-accent px-5 text-sm font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? 'Sending…' : 'Change email'}
          </button>
          {status.kind === 'sent' ? (
            <span className="text-sm text-success">Confirmation sent — check the new address.</span>
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
