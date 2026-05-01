'use client'

import { markNotificationRead } from '@/server/actions/notifications'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const INBOX_HREF = '/dashboard/notifications' as Route

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

const POLL_INTERVAL_MS = 20_000

const severityClass: Record<Severity, string> = {
  info: 'text-text',
  warning: 'text-warning',
  error: 'text-danger',
}

export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Poll the lightweight endpoint. AbortController so React strict-mode
  // re-renders don't double-fetch.
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = null

    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/notifications/latest', {
          signal: controller.signal,
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const data = (await res.json()) as { unreadCount: number; items: Item[] }
        setUnread(data.unreadCount)
        setItems(data.items)
      } catch {
        /* aborted or offline — try again next tick */
      }
    }

    void fetchLatest()
    timer = setInterval(fetchLatest, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [])

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function onClickItem(item: Item) {
    // Optimistic mark-as-read. Server Action revalidates so the
    // history page is fresh on navigation.
    if (item.readAt == null) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
      )
      setUnread((n) => Math.max(0, n - 1))
      await markNotificationRead({ notificationId: item.id })
    }
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-mono font-medium text-background">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[90vw] rounded-md border border-border bg-surface shadow-lg">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Inbox</p>
            <Link
              href={INBOX_HREF}
              onClick={() => setOpen(false)}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              See all →
            </Link>
          </header>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-border overflow-auto">
              {items.map((item) => {
                const detailHref = item.relatedServerId
                  ? (`/dashboard/servers/${item.relatedServerId}` as Route)
                  : item.relatedHostId
                    ? (`/dashboard/hosts/${item.relatedHostId}` as Route)
                    : null
                const inner = (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.readAt == null ? 'bg-accent' : 'bg-text-faint'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${severityClass[item.severity]}`}>
                        {item.title}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                        {formatRelative(item.createdAt)}
                      </p>
                    </div>
                  </div>
                )
                return (
                  <li key={item.id}>
                    {detailHref ? (
                      <Link
                        href={detailHref}
                        onClick={() => onClickItem(item)}
                        className="block transition-colors hover:bg-surface-elevated"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onClickItem(item)}
                        className="block w-full text-left transition-colors hover:bg-surface-elevated"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}
