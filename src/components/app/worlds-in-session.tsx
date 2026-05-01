// Compact grid of currently-running game servers across all hosts.
// One card per server. Player count is a snapshot from
// game_servers.player_count (updated by the agent's server status
// stream). Empty if nothing is running.

import { Callsign } from '@/components/ui/callsign'
import { Surface } from '@/components/ui/surface'
import type { Route } from 'next'
import Link from 'next/link'

export type WorldRow = {
  serverId: string
  serverName: string
  hostId: string
  gameName: string
  port: number
  playerCount: number
  maxPlayers: number | null
}

type Props = {
  worlds: WorldRow[]
}

const VISIBLE_LIMIT = 8

export function WorldsInSession({ worlds }: Props) {
  const visible = worlds.slice(0, VISIBLE_LIMIT)
  const overflow = worlds.length - visible.length

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((w) => (
        <Link
          key={w.serverId}
          href={`/dashboard/servers/${w.serverId}` as Route}
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
        >
          <Surface variant="interactive" className="p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                Live
              </span>
              <Callsign id={w.hostId} />
            </div>
            <p className="mt-3 truncate text-sm text-text">{w.serverName}</p>
            <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
              {w.gameName} · :{w.port}
            </p>
            <p className="mt-3 font-mono text-base tabular-nums text-text">
              {w.playerCount}
              {w.maxPlayers ? <span className="text-text-faint">/{w.maxPlayers}</span> : null}
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint">
                players
              </span>
            </p>
          </Surface>
        </Link>
      ))}
      {overflow > 0 ? (
        <Surface className="flex items-center justify-center p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
            +{overflow} more
          </p>
        </Surface>
      ) : null}
    </div>
  )
}
