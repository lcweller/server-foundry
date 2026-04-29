'use client'

import { authClient } from '@/lib/auth-client'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

type Provider = 'google' | 'github' | 'discord'

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'discord', label: 'Discord' },
]

export function LinkedAccountsSection({ linkedProviders }: { linkedProviders: string[] }) {
  const [pending, setPending] = useState<Provider | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const linked = new Set(linkedProviders)

  async function link(provider: Provider) {
    setError(null)
    setPending(provider)
    try {
      await authClient.linkSocial({ provider, callbackURL: '/settings' })
    } catch (_err) {
      setError(`Couldn’t link ${provider}. Try again.`)
      setPending(null)
    }
  }

  function unlink(provider: Provider) {
    setError(null)
    setPending(provider)
    startTransition(async () => {
      const { error } = await authClient.unlinkAccount({ providerId: provider })
      if (error) {
        setError(error.message ?? `Couldn’t unlink ${provider}.`)
      }
      setPending(null)
    })
  }

  return (
    <SettingsSection
      title="Sign-in methods"
      description="Link a provider to log in with one click. You always need at least one method."
    >
      <ul className="divide-y divide-border rounded-md border border-border">
        {PROVIDERS.map((p) => {
          const isLinked = linked.has(p.id)
          return (
            <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-text">{p.label}</p>
                <p className="text-xs text-text-muted">{isLinked ? 'Linked' : 'Not linked'}</p>
              </div>
              {isLinked ? (
                <button
                  type="button"
                  onClick={() => unlink(p.id)}
                  disabled={pending === p.id}
                  className="h-9 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text disabled:opacity-60"
                >
                  {pending === p.id ? 'Unlinking…' : 'Unlink'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => link(p.id)}
                  disabled={pending === p.id}
                  className="h-9 rounded-md bg-ember px-3 text-xs font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60"
                >
                  {pending === p.id ? 'Linking…' : 'Link'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </SettingsSection>
  )
}
