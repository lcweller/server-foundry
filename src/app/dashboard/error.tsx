'use client'

// Error boundary for /dashboard/*. Caught by Next.js when a server-
// side render throws; the user sees this instead of a blank page.
// Brand-voice copy: warm, never blames the user, offers an action.

import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    // Surface to the browser console for local debugging; the digest
    // also lands in server logs for correlation.
    console.error('dashboard render failed', error)
  }, [error])

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <Surface className="p-2">
        <EmptyState
          eyebrow="Something snapped"
          title="We couldn't load this page."
          body={
            error.digest
              ? `Try again in a moment. If it keeps failing, send us this code: ${error.digest}`
              : 'Try again in a moment. If it keeps failing, refresh the dashboard.'
          }
          cta={
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-soft"
            >
              Try again
            </button>
          }
        />
      </Surface>
    </div>
  )
}
