import { cn } from '@/lib/utils'

// Letter pool — drops I, L, O, 0-prone glyphs so callsigns stay
// legible at small sizes and aren't confused with each other.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Deterministic short identifier derived from a host UUID. Same host
 * always produces the same callsign — pure formatting, no schema.
 *
 * Format: 1 letter + 2 digits (e.g. A07, K42). Letter from the first
 * hex char of the dash-stripped UUID, two-digit number from the next
 * two hex chars mod 100. Collision possible but rare enough for the
 * single-tenant fleet sizes we expect; bump to two letters if it ever
 * becomes a UX problem.
 */
export function callsignFromId(id: string): string {
  const compact = id.replace(/-/g, '')
  const first = compact[0] ?? '0'
  const next = compact.slice(1, 3) || '00'
  const letterIdx = Number.parseInt(first, 16) % LETTERS.length
  const num = Number.parseInt(next, 16) % 100
  const letter = LETTERS[letterIdx] ?? 'X'
  return `${letter}${num.toString().padStart(2, '0')}`
}

type Props = {
  id: string
  className?: string
}

export function Callsign({ id, className }: Props) {
  return (
    <span
      className={cn('font-mono text-xs uppercase tracking-[0.15em] text-text-muted', className)}
    >
      {callsignFromId(id)}
    </span>
  )
}
