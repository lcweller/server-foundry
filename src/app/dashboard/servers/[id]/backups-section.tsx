'use client'

import { restoreBackup, triggerBackup, updateBackupConfig } from '@/server/actions/backups'
import { type FormEvent, useState, useTransition } from 'react'

type Backup = {
  id: string
  startedAt: string
  completedAt: string | null
  status: 'running' | 'completed' | 'failed'
  sizeBytes: string | null // serialized BigInt
  storageUrl: string | null
  errorMessage: string | null
  triggeredBy: string | null
}

type ConfigSnapshot = {
  isEnabled: boolean
  scheduleCron: string | null
  retentionCount: number
  destinationType: 'platform' | 's3'
  hasS3Credentials: boolean
}

type Props = {
  serverId: string
  initialConfig: ConfigSnapshot | null
  initialBackups: Backup[]
}

export function BackupsSection({ serverId, initialConfig, initialBackups }: Props) {
  const [config] = useState<ConfigSnapshot | null>(initialConfig)
  const [backups, setBackups] = useState<Backup[]>(initialBackups)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null)

  function onRunNow() {
    setError(null)
    startTransition(async () => {
      const result = await triggerBackup({ serverId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Optimistic insert; the server-side row already exists.
      setBackups((prev) => [
        {
          id: result.data.backupId,
          startedAt: new Date().toISOString(),
          completedAt: null,
          status: 'running',
          sizeBytes: null,
          storageUrl: null,
          errorMessage: null,
          triggeredBy: 'manual',
        },
        ...prev,
      ])
    })
  }

  function onRestore(backupId: string) {
    setError(null)
    startTransition(async () => {
      const result = await restoreBackup({ serverId, backupId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setConfirmingRestore(null)
    })
  }

  return (
    <div className="space-y-8">
      <BackupConfigForm serverId={serverId} initial={config} pending={pending} onError={setError} />

      <div className="rounded-md border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">History</p>
          <button
            type="button"
            onClick={onRunNow}
            disabled={pending || !config || config.destinationType === 'platform'}
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Working…' : 'Back up now'}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {backups.length === 0 ? (
          <p className="mt-6 text-sm text-text-muted">No backups yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={`text-sm ${statusClass(b.status)}`}>
                    {b.status} · {formatDate(b.startedAt)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    {b.triggeredBy ?? 'manual'} · {formatSize(b.sizeBytes)}
                  </p>
                  {b.errorMessage ? (
                    <p className="mt-1 text-xs text-danger">{b.errorMessage}</p>
                  ) : null}
                </div>
                {b.status === 'completed' ? (
                  confirmingRestore === b.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRestore(b.id)}
                        disabled={pending}
                        className="h-8 rounded-md bg-danger px-3 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                      >
                        {pending ? 'Restoring…' : 'Yes, restore'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRestore(null)}
                        disabled={pending}
                        className="text-xs text-text-muted hover:text-text"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingRestore(b.id)}
                      disabled={pending}
                      className="h-8 rounded-md border border-border bg-surface-elevated px-3 text-xs font-medium text-text hover:bg-background disabled:opacity-50"
                    >
                      Restore…
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Config form ──────────────────────────────────────────────────

function BackupConfigForm({
  serverId,
  initial,
  pending: parentPending,
  onError,
}: {
  serverId: string
  initial: ConfigSnapshot | null
  pending: boolean
  onError: (msg: string | null) => void
}) {
  const [destType, setDestType] = useState<'platform' | 's3'>(initial?.destinationType ?? 's3')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onError(null)
    const fd = new FormData(e.currentTarget)
    const isEnabled = fd.get('isEnabled') === 'on'
    const scheduleCronRaw = String(fd.get('scheduleCron') ?? '').trim()
    const retentionCount = Number.parseInt(String(fd.get('retentionCount') ?? '7'), 10)

    if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 365) {
      onError('Retention must be between 1 and 365.')
      return
    }

    let destination: { type: 'platform' } | { type: 's3'; credentials: Record<string, string> }
    if (destType === 's3') {
      const bucket = String(fd.get('bucket') ?? '').trim()
      const region = String(fd.get('region') ?? '').trim()
      const endpoint = String(fd.get('endpoint') ?? '').trim()
      const accessKeyId = String(fd.get('accessKeyId') ?? '').trim()
      const secretAccessKey = String(fd.get('secretAccessKey') ?? '').trim()
      if (!bucket || !accessKeyId || !secretAccessKey) {
        onError('Bucket, access key, and secret key are required for S3.')
        return
      }
      const credentials: Record<string, string> = { bucket, accessKeyId, secretAccessKey }
      if (region) credentials.region = region
      if (endpoint) credentials.endpoint = endpoint
      destination = { type: 's3', credentials }
    } else {
      destination = { type: 'platform' }
    }

    startTransition(async () => {
      const result = await updateBackupConfig({
        serverId,
        isEnabled,
        scheduleCron: scheduleCronRaw || null,
        retentionCount,
        destination,
      })
      if (!result.ok) {
        onError(result.error)
        return
      }
      setSavedAt(Date.now())
    })
  }

  const busy = pending || parentPending

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-border bg-surface p-6 space-y-5"
      aria-label="Backup configuration"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Configuration</p>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          name="isEnabled"
          defaultChecked={initial?.isEnabled ?? false}
          className="h-4 w-4 rounded border-border bg-background accent-accent"
        />
        Run backups on schedule
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cron schedule" hint="Standard 5-field cron, e.g. 0 3 * * * for 3am daily.">
          <input
            type="text"
            name="scheduleCron"
            defaultValue={initial?.scheduleCron ?? '0 3 * * *'}
            placeholder="0 3 * * *"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm text-text outline-none focus:border-accent"
          />
        </Field>
        <Field label="Retention (days)">
          <input
            type="number"
            name="retentionCount"
            min={1}
            max={365}
            defaultValue={initial?.retentionCount ?? 7}
            className="h-10 w-32 rounded-md border border-border bg-background px-3 font-mono text-sm text-text outline-none focus:border-accent"
          />
        </Field>
      </div>

      <Field label="Destination">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="radio"
              name="destType"
              value="s3"
              checked={destType === 's3'}
              onChange={() => setDestType('s3')}
              className="h-4 w-4 accent-accent"
            />
            S3-compatible
          </label>
          <label className="flex items-center gap-2 text-sm text-text-faint">
            <input
              type="radio"
              name="destType"
              value="platform"
              checked={destType === 'platform'}
              onChange={() => setDestType('platform')}
              disabled
              className="h-4 w-4 accent-accent"
            />
            Platform-managed (coming soon)
          </label>
        </div>
      </Field>

      {destType === 's3' ? (
        <fieldset className="grid gap-5 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
          <legend className="px-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
            S3 destination
          </legend>
          <Field label="Bucket">
            <input
              type="text"
              name="bucket"
              required
              maxLength={64}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </Field>
          <Field label="Region (optional)">
            <input
              type="text"
              name="region"
              maxLength={64}
              placeholder="us-east-1"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </Field>
          <Field
            label="Endpoint (optional)"
            hint="Override for non-AWS providers (Backblaze B2, Wasabi, MinIO)."
          >
            <input
              type="url"
              name="endpoint"
              placeholder="https://s3.us-west-002.backblazeb2.com"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </Field>
          <Field label="Access key ID">
            <input
              type="text"
              name="accessKeyId"
              required
              maxLength={128}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </Field>
          <Field
            label="Secret access key"
            hint={
              initial?.hasS3Credentials
                ? 'Saved encrypted at rest. Re-enter to overwrite.'
                : 'Saved encrypted at rest with BACKUP_ENCRYPTION_KEY.'
            }
          >
            <input
              type="password"
              name="secretAccessKey"
              required
              maxLength={256}
              autoComplete="off"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-accent"
            />
          </Field>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-xs font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save backup config'}
        </button>
        {savedAt ? <span className="text-xs text-success">Saved.</span> : null}
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="block font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

function statusClass(status: 'running' | 'completed' | 'failed'): string {
  if (status === 'running') return 'text-accent'
  if (status === 'completed') return 'text-text'
  return 'text-danger'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatSize(bytes: string | null): string {
  if (!bytes) return '—'
  const n = Number(bytes)
  if (!Number.isFinite(n)) return '—'
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}
