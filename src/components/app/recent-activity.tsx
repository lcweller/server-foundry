// Tail of the user's notification feed. Same data the bell + inbox
// use; we just truncate to the most recent entries here.
//
// Severity ↔ palette:
//   info    → text-text-muted (decorative; nothing to flag)
//   warning → text-warning
//   error   → text-danger

import { cn } from '@/lib/utils'
import type { NotificationSeverity } from '@/server/db/schema'
import type { Route } from 'next'
import Link from 'next/link'

export type ActivityRow = {
  id: string
  title: string
  body: string | null
  severity: NotificationSeverity
  createdAt: Date
  relatedHostId: string | null
  relatedServerId: string | null
}

type Props = {
  rows: ActivityRow[]
}

const severityDot: Record<NotificationSeverity, string> = {
  info: 'bg-text-faint',
  warning: 'bg-warning',
  error: 'bg-danger',
}

const severityText: Record<NotificationSeverity, string> = {
  info: 'text-text-muted',
  warning: 'text-warning',
  error: 'text-danger',
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

function rowHref(row: ActivityRow): Route | null {
  if (row.relatedServerId) return `/dashboard/servers/${row.relatedServerId}` as Route
  if (row.relatedHostId) return `/dashboard/hosts/${row.relatedHostId}` as Route
  return null
}

export function RecentActivity({ rows }: Props) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const href = rowHref(row)
        const content = (
          <div className="flex items-start gap-3 px-4 py-3">
            <span
              className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', severityDot[row.severity])}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm', severityText[row.severity])}>{row.title}</p>
              {row.body ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-text-faint">{row.body}</p>
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint tabular-nums">
              {formatRelativeTime(row.createdAt)}
            </span>
          </div>
        )
        return (
          <li key={row.id}>
            {href ? (
              <Link
                href={href}
                className="block transition-colors hover:bg-surface-elevated/40 focus-visible:bg-surface-elevated/40 focus-visible:outline-none"
              >
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}
