'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

export function DangerZoneSection() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function deleteAccount() {
    setError(null)
    startTransition(async () => {
      const { error } = await authClient.deleteUser({ callbackURL: '/' })
      if (error) {
        setError(error.message ?? 'Couldn’t delete your account.')
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <SettingsSection
      title="Delete account"
      description="Permanently removes your account, hosts, servers, and backups. This can’t be undone."
    >
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-10 rounded-md border border-danger/40 bg-transparent px-5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          Delete my account
        </button>
      ) : (
        <div className="space-y-4 rounded-md border border-danger/40 bg-danger/5 p-4">
          <p className="text-sm text-text">
            Type{' '}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-ember">
              delete my account
            </code>{' '}
            to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={pending}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text placeholder:text-text-faint focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/30"
            placeholder="delete my account"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={pending || confirmText.trim().toLowerCase() !== 'delete my account'}
              className="h-10 rounded-md bg-danger px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setConfirmText('')
                setError(null)
              }}
              disabled={pending}
              className="h-10 rounded-md border border-border bg-surface px-5 text-sm font-medium text-text transition-colors hover:bg-surface-elevated disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </SettingsSection>
  )
}
