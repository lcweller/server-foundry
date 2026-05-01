'use client'

import { triggerAgentUpdate } from '@/server/actions/agent-updates'
import { useEffect, useState, useTransition } from 'react'

type Status = 'running' | 'completed' | 'failed' | 'rolled_back'

type Update = {
  id: string
  fromVersion: string | null
  toVersion: string
  status: Status
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
}

type Manifest =
  | { available: false; reason: string }
  | {
      available: true
      version: string
      downloadUrl: string
      signature: string | null
      sha256: string | null
    }

type Props = {
  hostId: string
  currentVersion: string | null
  initialUpdates: Update[]
}

const statusClass: Record<Status, string> = {
  running: 'text-info',
  completed: 'text-success',
  failed: 'text-danger',
  rolled_back: 'text-warning',
}

export function AgentUpdatesSection({ hostId, currentVersion, initialUpdates }: Props) {
  const [updates, setUpdates] = useState<Update[]>(initialUpdates)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Pull the manifest once on mount. Cheap GET; no auth needed.
  useEffect(() => {
    let cancelled = false
    fetch('/api/agent/update-manifest', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((m) => {
        if (!cancelled) setManifest(m as Manifest)
      })
      .catch(() => {
        if (!cancelled) setManifest({ available: false, reason: 'manifest unreachable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function onUpdate() {
    if (!manifest?.available) return
    setError(null)
    startTransition(async () => {
      const result = await triggerAgentUpdate({ hostId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const newRow: Update = {
        id: result.data.updateId,
        fromVersion: currentVersion ?? null,
        toVersion: manifest.version,
        status: 'running',
        errorMessage: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      }
      setUpdates((prev) => [newRow, ...prev])
      setConfirming(false)
    })
  }

  const upgradeAvailable = manifest?.available && manifest.version !== currentVersion

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
              Agent version
            </p>
            <p className="mt-2 font-mono text-sm text-text">{currentVersion ?? '—'}</p>
            {manifest === null ? (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                Checking manifest…
              </p>
            ) : manifest.available ? (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                Latest {manifest.version}
              </p>
            ) : (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                No update channel configured
              </p>
            )}
          </div>

          {confirming ? (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm text-text">
                Update agent to{' '}
                <span className="font-mono text-warning">
                  {manifest?.available ? manifest.version : ''}
                </span>
                ? The agent will restart; running game servers stay up.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onUpdate}
                  disabled={pending}
                  className="h-9 rounded-md bg-warning px-4 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? 'Dispatching…' : 'Yes, update'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="text-xs text-text-muted hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!upgradeAvailable || pending}
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {upgradeAvailable ? 'Update agent' : 'Up to date'}
            </button>
          )}
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {updates.length === 0 ? (
        <p className="text-sm text-text-muted">No update history yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {updates.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className={`text-sm ${statusClass[u.status]}`}>
                  {u.status} · {u.fromVersion ?? '—'} → {u.toVersion}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                  {formatDate(u.startedAt)}
                  {u.completedAt ? ` · finished ${formatDate(u.completedAt)}` : ''}
                </p>
                {u.errorMessage ? (
                  <p className="mt-1 text-xs text-danger">{u.errorMessage}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
