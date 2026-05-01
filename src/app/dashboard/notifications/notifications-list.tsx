'use client'

import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/server/actions/notifications'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type Severity = 'info' | 'warning' | 'error'

type Item = {
  id: string
  type: string
  severity: Severity
  title: string
  body: string | null
  relatedHostId: string | null
  relatedServerId: string | null
  readAt: string | null
  createdAt: string
}

type Filter = 'all' | 'unread'

const severityClass: Record<Severity, string> = {
  info: 'text-text',
  warning: 'text-warning',
  error: 'text-danger',
}

export function NotificationsList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    if (filter === 'unread') return items.filter((i) => i.readAt == null)
    return items
  }, [items, filter])

  function onMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      router.refresh()
    })
  }

  function onMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead({ notificationId: id })
      router.refresh()
    })
  }

  function onDismiss(id: string) {
    startTransition(async () => {
      await dismissNotification({ notificationId: id })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
                f === filter ? 'bg-surface-elevated text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onMarkAll}
          disabled={pending || items.every((i) => i.readAt != null)}
          className="text-xs text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-8 text-center text-sm text-text-muted">
          {filter === 'unread' ? 'Everything’s read.' : 'No notifications yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {visible.map((item) => {
            const unread = item.readAt == null
            const detailHref = item.relatedServerId
              ? (`/dashboard/servers/${item.relatedServerId}` as Route)
              : item.relatedHostId
                ? (`/dashboard/hosts/${item.relatedHostId}` as Route)
                : null
            return (
              <li key={item.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    unread ? 'bg-accent' : 'bg-text-faint'
                  }`}
                  aria-label={unread ? 'Unread' : 'Read'}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${severityClass[item.severity]}`}>{item.title}</p>
                  {item.body ? <p className="mt-1 text-xs text-text-muted">{item.body}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    <span>{formatDate(item.createdAt)}</span>
                    <span>{item.type.replace(/_/g, ' ')}</span>
                    {detailHref ? (
                      <Link
                        href={detailHref}
                        className="text-text-muted hover:text-text transition-colors"
                      >
                        View →
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {unread ? (
                    <button
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                      disabled={pending}
                      className="text-xs text-text-muted hover:text-text transition-colors disabled:opacity-40"
                    >
                      Mark read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDismiss(item.id)}
                    disabled={pending}
                    className="text-xs text-text-muted hover:text-danger transition-colors disabled:opacity-40"
                    aria-label={`Dismiss ${item.title}`}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
