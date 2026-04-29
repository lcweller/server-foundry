'use client'

import { TextField } from '@/components/auth/text-field'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

type Props = {
  user: { name: string; image: string | null }
}

export function ProfileSection({ user }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'ok' } | { kind: 'err'; msg: string }
  >({ kind: 'idle' })

  function onSubmit(formData: FormData) {
    setStatus({ kind: 'idle' })
    const name = String(formData.get('name') ?? '').trim()
    const image = String(formData.get('image') ?? '').trim() || undefined

    startTransition(async () => {
      const { error } = await authClient.updateUser({ name, image })
      if (error) {
        setStatus({ kind: 'err', msg: error.message ?? 'Couldn’t save changes.' })
        return
      }
      setStatus({ kind: 'ok' })
      router.refresh()
    })
  }

  return (
    <SettingsSection title="Profile" description="Your name and avatar as they appear in the app.">
      <form action={onSubmit} className="space-y-4">
        <TextField
          name="name"
          label="Display name"
          defaultValue={user.name}
          autoComplete="name"
          disabled={pending}
        />
        <TextField
          name="image"
          label="Avatar URL"
          defaultValue={user.image ?? ''}
          inputMode="url"
          placeholder="https://…"
          hint="Optional. We’ll use the OAuth provider’s photo by default."
          disabled={pending}
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-ember px-5 text-sm font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? 'Saving…' : 'Save profile'}
          </button>
          {status.kind === 'ok' ? (
            <span className="text-sm text-success">Saved.</span>
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
