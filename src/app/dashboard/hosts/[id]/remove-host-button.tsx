'use client'

import { removeHost } from '@/server/actions/hosts'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Props = {
  hostId: string
  hostName: string
}

export function RemoveHostButton({ hostId, hostName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onRemove() {
    setError(null)
    startTransition(async () => {
      const result = await removeHost({ hostId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-xs font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
      >
        Remove host
      </button>
    )
  }

  return (
    <div className="rounded-md border border-danger/40 bg-danger/5 p-4">
      <p className="text-sm text-text">
        Remove <span className="font-medium">{hostName}</span>? The agent token is revoked
        immediately and the host stops appearing on this dashboard.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="h-9 rounded-md bg-danger px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Removing…' : 'Yes, remove'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="h-9 rounded-md border border-border bg-surface px-4 text-xs font-medium text-text transition-colors hover:bg-surface-elevated disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
