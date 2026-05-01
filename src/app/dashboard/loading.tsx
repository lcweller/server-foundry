import { Surface } from '@/components/ui/surface'

// Generic dashboard skeleton — shown during initial render of any
// /dashboard/* segment that doesn't ship its own loading.tsx.
// Pulses muted surface tiles in roughly the same spatial layout as
// the most-common pages (overview, host detail, server detail).

const WORLD_KEYS = ['w1', 'w2', 'w3', 'w4'] as const
const HOST_KEYS = ['h1', 'h2', 'h3', 'h4'] as const

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-surface" />
          <div className="h-9 w-64 animate-pulse rounded bg-surface" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded bg-surface" />
      </div>

      <div className="mt-12 space-y-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WORLD_KEYS.map((key) => (
            <Surface key={key} className="h-28 animate-pulse" />
          ))}
        </div>

        <Surface className="h-[420px] animate-pulse" />

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {HOST_KEYS.map((key) => (
              <Surface key={key} className="h-44 animate-pulse" />
            ))}
          </div>
          <Surface className="h-[440px] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
