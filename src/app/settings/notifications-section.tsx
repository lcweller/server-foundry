'use client'

import { updateNotificationPreferences } from '@/server/actions/notifications'
import { useState, useTransition } from 'react'
import { SettingsSection } from './section'

type Severity = 'info' | 'warning' | 'error'

type Pref = {
  type: string
  inAppEnabled: boolean
  emailEnabled: boolean
}

type TypeMeta = {
  type: string
  label: string
  description: string
  severity: Severity
}

// Display order + copy. Match the enum in schema.ts.
const TYPE_META: TypeMeta[] = [
  {
    type: 'host_online',
    label: 'Host online',
    description: 'A host that was offline has reconnected.',
    severity: 'info',
  },
  {
    type: 'host_offline',
    label: 'Host offline',
    description: 'An online host stopped responding to heartbeats.',
    severity: 'warning',
  },
  {
    type: 'agent_updated',
    label: 'Agent updated',
    description: 'A host upgraded its agent successfully.',
    severity: 'info',
  },
  {
    type: 'agent_update_failed',
    label: 'Agent update failed',
    description: 'A host tried to upgrade its agent and rolled back.',
    severity: 'error',
  },
  {
    type: 'server_started',
    label: 'Server started',
    description: 'A game server transitioned to running.',
    severity: 'info',
  },
  {
    type: 'server_crashed',
    label: 'Server crashed',
    description: 'A game server exited with a non-clean status.',
    severity: 'error',
  },
  {
    type: 'server_updated',
    label: 'Server updated',
    description: 'A game server completed an update.',
    severity: 'info',
  },
  {
    type: 'server_update_failed',
    label: 'Server update failed',
    description: 'A game server failed to apply an update.',
    severity: 'error',
  },
  {
    type: 'backup_completed',
    label: 'Backup completed',
    description: 'A scheduled or on-demand backup finished.',
    severity: 'info',
  },
  {
    type: 'backup_failed',
    label: 'Backup failed',
    description: 'A backup job errored.',
    severity: 'error',
  },
  {
    type: 'memory_threshold',
    label: 'Memory threshold',
    description: 'A host exceeded a memory-usage threshold.',
    severity: 'warning',
  },
  {
    type: 'disk_threshold',
    label: 'Disk threshold',
    description: 'A host exceeded a disk-usage threshold.',
    severity: 'warning',
  },
  {
    type: 'pairing_used',
    label: 'Pairing code used',
    description: 'One of your pairing codes was redeemed.',
    severity: 'info',
  },
  {
    type: 'auth_failure',
    label: 'Auth failure',
    description: 'A failed sign-in attempt against your account.',
    severity: 'warning',
  },
]

type Props = {
  preferences: Pref[]
}

export function NotificationsSection({ preferences }: Props) {
  // Build a map keyed by type. Defaults: in_app=true, email=false.
  const initial = new Map<string, { inApp: boolean; email: boolean }>()
  for (const meta of TYPE_META) {
    const existing = preferences.find((p) => p.type === meta.type)
    initial.set(meta.type, {
      inApp: existing?.inAppEnabled ?? true,
      email: existing?.emailEnabled ?? false,
    })
  }

  const [state, setState] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'err'; msg: string }
  >({
    kind: 'idle',
  })

  function toggle(type: string, channel: 'inApp' | 'email', value: boolean) {
    setState((prev) => {
      const next = new Map(prev)
      const cur = next.get(type) ?? { inApp: true, email: false }
      next.set(type, { ...cur, [channel]: value })
      return next
    })
    setStatus({ kind: 'idle' })
  }

  function onSave() {
    setStatus({ kind: 'idle' })
    startTransition(async () => {
      const payload = TYPE_META.map((meta) => {
        const cur = state.get(meta.type) ?? { inApp: true, email: false }
        return {
          type: meta.type,
          inAppEnabled: cur.inApp,
          emailEnabled: cur.email,
        }
      })
      const result = await updateNotificationPreferences({ preferences: payload })
      if (!result.ok) {
        setStatus({ kind: 'err', msg: result.error })
        return
      }
      setStatus({ kind: 'saved' })
    })
  }

  return (
    <SettingsSection
      title="Notifications"
      description="In-app shows in the bell + inbox. Email goes to your account address. Errors and threshold alerts default to off-by-default for email so we don't spam you."
    >
      <ul className="space-y-3">
        {TYPE_META.map((meta) => {
          const cur = state.get(meta.type) ?? { inApp: true, email: false }
          return (
            <li
              key={meta.type}
              className="grid grid-cols-[1fr_auto_auto] items-start gap-x-6 gap-y-1"
            >
              <div className="min-w-0">
                <p className="text-sm text-text">{meta.label}</p>
                <p className="mt-0.5 text-xs text-text-muted">{meta.description}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={cur.inApp}
                  onChange={(e) => toggle(meta.type, 'inApp', e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background accent-ember"
                />
                In-app
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={cur.email}
                  onChange={(e) => toggle(meta.type, 'email', e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background accent-ember"
                />
                Email
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-ember px-5 text-xs font-medium text-background transition-colors hover:bg-ember-soft disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save preferences'}
        </button>
        {status.kind === 'saved' ? (
          <span className="text-xs text-success">Saved.</span>
        ) : status.kind === 'err' ? (
          <span className="text-xs text-danger">{status.msg}</span>
        ) : null}
      </div>
    </SettingsSection>
  )
}
