'use client'

import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Props = {
  user: { id: string; email: string; name: string; image: string | null }
}

export function UserMenu({ user }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (user.name?.[0] ?? user.email[0] ?? '?').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-text transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {user.image ? (
          <img src={user.image} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-border bg-surface-elevated shadow-lg shadow-black/40',
          )}
        >
          <div className="border-b border-border p-3">
            <p className="truncate text-sm font-medium text-text">{user.name || 'No name'}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-3 py-2 text-sm text-text hover:bg-background"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-background"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
