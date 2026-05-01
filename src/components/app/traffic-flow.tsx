// Hosts → Games → Players flow visualization.
//
// Hand-rolled SVG over a strict-sankey library (d3-sankey) for v1 —
// our scale is small (handful of hosts, handful of game types) so the
// simpler renderer reads cleanly without the layout overhead. If the
// fleet grows past ~15 nodes per column or links start crossing
// unreadably, swap to d3-sankey then.
//
// Three columns:
//   Hosts (left)   — labeled by callsign
//   Games (mid)    — labeled by game name
//   Players (right) — single aggregate cap; the values flowing in are
//                     the per-game player_count totals
//
// Each link's stroke width is proportional to the player count on
// that path. Links with zero players still render at minimum width
// so the topology is visible.

import { callsignFromId } from '@/components/ui/callsign'
import { cn } from '@/lib/utils'

export type FlowRow = {
  hostId: string
  hostName: string
  gameId: string | null
  gameName: string | null
  playerCount: number
  serverCount: number
}

type Props = {
  rows: FlowRow[]
  className?: string
}

// Visual constants — tuned for a 1024×420 viewport. Scales via
// preserveAspectRatio.
const WIDTH = 1024
const HEIGHT = 420
const NODE_W = 130
const NODE_PAD = 12
const COL_X = [40, 440, 880]
const MIN_LINK = 1.5

type Node = {
  key: string
  label: string
  sublabel?: string
  y: number
  h: number
  col: 0 | 1 | 2
}

type Link = {
  from: string
  to: string
  width: number
}

export function TrafficFlow({ rows, className }: Props) {
  const { nodes, links, hasFlow } = computeLayout(rows)

  if (!hasFlow) {
    return (
      <div
        className={cn(
          'flex h-[200px] items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-text-faint',
          className,
        )}
      >
        No live traffic — deploy a server to see the flow.
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Hosts to games to players traffic flow"
      className={cn('h-auto w-full', className)}
    >
      <title>Hosts → Games → Players</title>

      {/* Column labels */}
      {(['Hosts', 'Games', 'Players'] as const).map((label, i) => (
        <text
          key={label}
          x={(COL_X[i] ?? 0) + NODE_W / 2}
          y={20}
          textAnchor="middle"
          className="fill-text-faint font-mono text-[10px] uppercase tracking-[0.2em]"
        >
          {label}
        </text>
      ))}

      {/* Links — drawn before nodes so nodes overlap their endpoints. */}
      {/* Decorative paths; the parent <svg role="img"> carries the */}
      {/* accessible name. */}
      <g>
        {links.map((link) => {
          const from = nodes.find((n) => n.key === link.from)
          const to = nodes.find((n) => n.key === link.to)
          if (!from || !to) return null
          const x1 = (COL_X[from.col] ?? 0) + NODE_W
          const y1 = from.y + from.h / 2
          const x2 = COL_X[to.col] ?? 0
          const y2 = to.y + to.h / 2
          const cx1 = x1 + (x2 - x1) * 0.5
          const cx2 = x1 + (x2 - x1) * 0.5
          return (
            <path
              key={`${link.from}->${link.to}`}
              d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
              fill="none"
              className="stroke-accent/30"
              strokeWidth={Math.max(MIN_LINK, link.width)}
              strokeLinecap="round"
            />
          )
        })}
      </g>

      {/* Nodes */}
      {nodes.map((node) => (
        <g key={node.key}>
          <rect
            x={COL_X[node.col]}
            y={node.y}
            width={NODE_W}
            height={node.h}
            rx={3}
            className="fill-surface stroke-border"
            strokeWidth={1}
          />
          <text
            x={(COL_X[node.col] ?? 0) + 10}
            y={node.y + 16}
            className="fill-text font-mono text-[11px]"
          >
            {node.label}
          </text>
          {node.sublabel ? (
            <text
              x={(COL_X[node.col] ?? 0) + 10}
              y={node.y + 30}
              className="fill-text-faint font-mono text-[9px] uppercase tracking-[0.18em]"
            >
              {node.sublabel}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}

function computeLayout(rows: FlowRow[]): {
  nodes: Node[]
  links: Link[]
  hasFlow: boolean
} {
  // Aggregate per-host (sum player counts across all that host's
  // servers) and per-game (sum across all hosts running that game).
  type HostAgg = { id: string; name: string; players: number; servers: number }
  type GameAgg = { id: string; name: string; players: number; servers: number }
  const hostMap = new Map<string, HostAgg>()
  const gameMap = new Map<string, GameAgg>()
  let totalPlayers = 0
  let totalServers = 0

  for (const r of rows) {
    if (!hostMap.has(r.hostId)) {
      hostMap.set(r.hostId, { id: r.hostId, name: r.hostName, players: 0, servers: 0 })
    }
    if (r.gameId && !gameMap.has(r.gameId)) {
      gameMap.set(r.gameId, {
        id: r.gameId,
        name: r.gameName ?? 'Unknown',
        players: 0,
        servers: 0,
      })
    }
    const host = hostMap.get(r.hostId)
    const game = r.gameId ? gameMap.get(r.gameId) : undefined
    if (host) {
      host.players += r.playerCount
      host.servers += r.serverCount
    }
    if (game) {
      game.players += r.playerCount
      game.servers += r.serverCount
    }
    totalPlayers += r.playerCount
    totalServers += r.serverCount
  }

  const hostsList = [...hostMap.values()]
  const gamesList = [...gameMap.values()]

  // No edges to draw at all? Caller renders the placeholder.
  if (hostsList.length === 0 || (gamesList.length === 0 && totalServers === 0)) {
    return { nodes: [], links: [], hasFlow: false }
  }

  // Vertical layout — distribute each column evenly within HEIGHT
  // minus a top-margin for the column labels.
  const topMargin = 36
  const usableH = HEIGHT - topMargin - 16

  const hostNodes: Node[] = layoutColumn(hostsList, 0, topMargin, usableH, (h) =>
    callsignFromId(h.id),
  ).map((n, i) => ({
    ...n,
    sublabel: `${hostsList[i]?.servers ?? 0} servers`,
  }))

  const gameNodes: Node[] = layoutColumn(gamesList, 1, topMargin, usableH, (g) => g.name).map(
    (n, i) => ({
      ...n,
      sublabel: `${gamesList[i]?.players ?? 0} players`,
    }),
  )

  const playerNodes: Node[] =
    totalPlayers === 0 && totalServers === 0
      ? []
      : [
          {
            key: 'players',
            label: String(totalPlayers),
            sublabel: 'live',
            col: 2,
            y: topMargin + usableH / 2 - 24,
            h: 48,
          },
        ]

  // Links: host → game weighted by that host's contribution to that
  // game's players. host → game with zero players still renders at
  // MIN_LINK so the topology shows.
  const linkSet = new Map<string, Link>()
  for (const r of rows) {
    if (!r.gameId) continue
    const key = `host:${r.hostId}->game:${r.gameId}`
    const existing = linkSet.get(key)
    const widthDelta = Math.max(MIN_LINK, scalePlayerWidth(r.playerCount))
    if (existing) {
      existing.width = Math.max(existing.width, widthDelta)
    } else {
      linkSet.set(key, {
        from: `host:${r.hostId}`,
        to: `game:${r.gameId}`,
        width: widthDelta,
      })
    }
  }
  // game → players aggregate
  for (const g of gamesList) {
    linkSet.set(`game:${g.id}->players`, {
      from: `game:${g.id}`,
      to: 'players',
      width: Math.max(MIN_LINK, scalePlayerWidth(g.players)),
    })
  }

  return {
    nodes: [...hostNodes, ...gameNodes, ...playerNodes],
    links: [...linkSet.values()],
    hasFlow: hostsList.length > 0,
  }
}

function layoutColumn<T extends { id: string }>(
  items: T[],
  col: 0 | 1 | 2,
  topMargin: number,
  usableH: number,
  labelOf: (item: T) => string,
): Node[] {
  if (items.length === 0) return []
  const totalPad = NODE_PAD * (items.length - 1)
  const baseH = Math.max(36, Math.min(72, (usableH - totalPad) / items.length))
  const totalH = baseH * items.length + totalPad
  const startY = topMargin + (usableH - totalH) / 2
  return items.map((item, i) => ({
    key: `${col === 0 ? 'host' : col === 1 ? 'game' : 'players'}:${item.id}`,
    label: labelOf(item),
    col,
    y: startY + i * (baseH + NODE_PAD),
    h: baseH,
  }))
}

function scalePlayerWidth(players: number): number {
  // Smooth-ish curve so 0 players still shows the topology and
  // 50+ players doesn't blow out the diagram.
  return Math.min(18, MIN_LINK + Math.sqrt(players) * 1.6)
}
