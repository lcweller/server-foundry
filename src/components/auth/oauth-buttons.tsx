'use client'

import { signIn } from '@/lib/auth-client'
import { useState } from 'react'

type Provider = 'google' | 'github' | 'discord'

const providers: Array<{ id: Provider; label: string }> = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'github', label: 'Continue with GitHub' },
  { id: 'discord', label: 'Continue with Discord' },
]

export function OAuthButtons({ callbackURL = '/dashboard' }: { callbackURL?: string }) {
  const [pending, setPending] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleOAuth(provider: Provider) {
    setPending(provider)
    setError(null)
    try {
      await signIn.social({ provider, callbackURL })
    } catch (_err) {
      setError(`Couldn’t connect to ${provider}. Try again or use email.`)
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleOAuth(p.id)}
          disabled={pending !== null}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-surface text-sm font-medium text-text transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <ProviderIcon id={p.id} />
          <span>{pending === p.id ? 'Redirecting…' : p.label}</span>
        </button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ProviderIcon({ id }: { id: Provider }) {
  const common = 'h-4 w-4'
  if (id === 'google') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <title>Google</title>
        <path d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.22-4.74 3.22-8.32z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23z" />
        <path d="M5.85 14.1A6.59 6.59 0 0 1 5.5 12c0-.73.13-1.43.35-2.1V7.06H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.94l3.69-2.84z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.06l3.69 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    )
  }
  if (id === 'github') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <title>GitHub</title>
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9 0-6.3-5.2-11.5-11.5-11.5z" />
      </svg>
    )
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <title>Discord</title>
      <path d="M19.7 4.5C18.2 3.8 16.5 3.3 14.7 3c-.2.4-.5.9-.7 1.3-1.9-.3-3.8-.3-5.7 0-.2-.4-.5-.9-.7-1.3-1.8.3-3.5.8-5 1.5-3.2 4.7-4 9.3-3.6 13.8 2 1.5 4 2.4 5.9 3 .5-.6.9-1.4 1.2-2.1-.7-.3-1.4-.6-2-1 .2-.1.3-.2.5-.4 4 1.8 8.4 1.8 12.4 0 .2.1.3.2.5.4-.6.4-1.3.7-2 1 .4.7.8 1.5 1.2 2.1 2-.6 4-1.5 5.9-3 .5-5.2-.8-9.7-3.6-13.8zM8.5 14.6c-1.2 0-2.2-1.1-2.2-2.4S7.3 9.7 8.5 9.7s2.2 1.1 2.2 2.4-1 2.5-2.2 2.5zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  )
}
