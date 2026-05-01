'use client'

import { deleteServer, restartServer, startServer, stopServer } from '@/server/actions/servers'
import type { ServerStatus } from '@/server/db/schema'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type Props = {
  serverId: string
  status: ServerStatus
  hostOnline: boolean
}

export function ServerControls({ serverId, status, hostOnline }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const canStart = hostOnline && (status === 'stopped' || status === 'crashed')
  const canStop = hostOnline && status === 'running'
  const canRestart = hostOnline && status === 'running'
  const canDelete = status !== 'deleting'

  function run(
    fn: (input: { serverId: string }) => Promise<{ ok: boolean; error?: string }>,
    onSuccess?: () => void,
  ) {
    setError(null)
    startTransition(async () => {
      const result = await fn({ serverId })
      if (!result.ok) {
        setError(result.error ?? 'Action failed.')
        return
      }
      onSuccess?.()
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-border bg-surface p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Lifecycle</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <ActionButton
          label="Start"
          activeLabel="Starting…"
          disabled={!canStart || pending}
          pending={pending}
          variant="primary"
          onClick={() => run(startServer)}
        />
        <ActionButton
          label="Stop"
          activeLabel="Stopping…"
          disabled={!canStop || pending}
          pending={pending}
          variant="secondary"
          onClick={() => run(stopServer)}
        />
        <ActionButton
          label="Restart"
          activeLabel="Restarting…"
          disabled={!canRestart || pending}
          pending={pending}
          variant="secondary"
          onClick={() => run(restartServer)}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-8 border-t border-border pt-6">
        {!confirmingDelete ? (
          <button
            type="button"
            disabled={!canDelete || pending}
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-text-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete server
          </button>
        ) : (
          <div className="rounded-md border border-danger/40 bg-danger/5 p-4">
            <p className="text-sm text-text">
              Delete this server? The agent removes its files from the host and the record is
              archived.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(deleteServer, () => {
                    // After successful delete, the row gets marked
                    // deletedAt. router.refresh() re-renders the page
                    // which will 404 — let the user navigate back.
                    router.back()
                  })
                }
                className="h-9 rounded-md bg-danger px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingDelete(false)}
                className="h-9 rounded-md border border-border bg-surface px-4 text-xs font-medium text-text transition-colors hover:bg-surface-elevated disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type ActionButtonProps = {
  label: string
  activeLabel: string
  disabled: boolean
  pending: boolean
  variant: 'primary' | 'secondary'
  onClick: () => void
}

function ActionButton({
  label,
  activeLabel,
  disabled,
  pending,
  variant,
  onClick,
}: ActionButtonProps) {
  const base =
    'inline-flex h-10 items-center justify-center rounded-md px-5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const variantClass =
    variant === 'primary'
      ? 'bg-ember text-background hover:bg-ember-soft'
      : 'border border-border bg-surface-elevated text-text hover:bg-background'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass}`}
    >
      {pending ? activeLabel : label}
    </button>
  )
}
