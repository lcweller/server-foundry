import { HostCard } from '@/components/app/host-card'
import { type ActivityRow, RecentActivity } from '@/components/app/recent-activity'
import { type FlowRow, TrafficFlow } from '@/components/app/traffic-flow'
import { type WorldRow, WorldsInSession } from '@/components/app/worlds-in-session'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { Surface } from '@/components/ui/surface'
import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  gameCatalog as gameCatalogTable,
  gameServers as gameServersTable,
  hosts as hostsTable,
  notifications as notificationsTable,
} from '@/server/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

const ACTIVITY_LIMIT = 8

export default async function DashboardPage() {
  const { user } = await requireUser()

  const hostList = await db
    .select({
      id: hostsTable.id,
      name: hostsTable.name,
      hostname: hostsTable.hostname,
      os: hostsTable.os,
      cpuCores: hostsTable.cpuCores,
      ramBytes: hostsTable.ramBytes,
      status: hostsTable.status,
      lastSeenAt: hostsTable.lastSeenAt,
    })
    .from(hostsTable)
    .where(and(eq(hostsTable.userId, user.id), isNull(hostsTable.deletedAt)))
    .orderBy(desc(hostsTable.createdAt))

  // Single LEFT-JOIN query feeds both the traffic-flow diagram AND
  // the worlds-in-session grid. LEFT JOIN keeps empty hosts in the
  // result so the Sankey shows them as nodes-without-edges.
  const flowRowsRaw = await db
    .select({
      hostId: hostsTable.id,
      hostName: hostsTable.name,
      serverId: gameServersTable.id,
      serverName: gameServersTable.name,
      serverPort: gameServersTable.port,
      serverStatus: gameServersTable.status,
      playerCount: gameServersTable.playerCount,
      maxPlayers: gameServersTable.maxPlayers,
      gameId: gameCatalogTable.id,
      gameName: gameCatalogTable.name,
    })
    .from(hostsTable)
    .leftJoin(
      gameServersTable,
      and(eq(gameServersTable.hostId, hostsTable.id), isNull(gameServersTable.deletedAt)),
    )
    .leftJoin(gameCatalogTable, eq(gameCatalogTable.id, gameServersTable.gameId))
    .where(and(eq(hostsTable.userId, user.id), isNull(hostsTable.deletedAt)))

  const flowRows: FlowRow[] = flowRowsRaw.map((r) => ({
    hostId: r.hostId,
    hostName: r.hostName,
    gameId: r.gameId,
    gameName: r.gameName,
    playerCount: r.playerCount ?? 0,
    serverCount: r.serverId ? 1 : 0,
  }))

  const worlds: WorldRow[] = flowRowsRaw
    .filter((r) => r.serverId && r.serverStatus === 'running')
    .map((r) => ({
      // serverId is non-null in this branch — assert type for the
      // mapped shape.
      serverId: r.serverId as string,
      serverName: r.serverName ?? '—',
      hostId: r.hostId,
      gameName: r.gameName ?? '—',
      port: r.serverPort ?? 0,
      playerCount: r.playerCount ?? 0,
      maxPlayers: r.maxPlayers,
    }))

  const notifRows = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      body: notificationsTable.body,
      severity: notificationsTable.severity,
      createdAt: notificationsTable.createdAt,
      relatedHostId: notificationsTable.relatedHostId,
      relatedServerId: notificationsTable.relatedServerId,
    })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.deletedAt)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(ACTIVITY_LIMIT)

  const activity: ActivityRow[] = notifRows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    severity: n.severity,
    createdAt: n.createdAt,
    relatedHostId: n.relatedHostId,
    relatedServerId: n.relatedServerId,
  }))

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <SectionHeader
        eyebrow="01 · Operations"
        title="Your fleet."
        action={
          <Link
            href="/dashboard/hosts/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-soft"
          >
            + Add host
          </Link>
        }
      />

      {hostList.length === 0 ? (
        <Surface className="mt-10">
          <EmptyState
            eyebrow="No hosts yet"
            title="Let's get you connected."
            body="Generate a pairing code, run one command on any Linux host you own, and it appears here."
            cta={
              <Link
                href="/dashboard/hosts/new"
                className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-background transition-colors hover:bg-accent-soft"
              >
                Add your first host
              </Link>
            }
          />
        </Surface>
      ) : (
        <div className="mt-10 space-y-12">
          {worlds.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Worlds in session"
                title="Running now"
                subtitle="Live game servers across your hosts. Click a card to manage one."
              />
              <WorldsInSession worlds={worlds} />
            </section>
          ) : null}

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Traffic flow"
              title="Hosts → Games → Players"
              subtitle="Where the players are right now. Stroke width tracks live player count."
            />
            <Surface className="p-6">
              <TrafficFlow rows={flowRows} />
            </Surface>
          </section>

          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <section className="space-y-4">
              <SectionHeader eyebrow="Hosts" title="All hosts" />
              <ul className="grid gap-4 sm:grid-cols-2">
                {hostList.map((host) => (
                  <li key={host.id}>
                    <HostCard host={host} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <SectionHeader eyebrow="Activity" title="Recent" />
              {activity.length === 0 ? (
                <Surface>
                  <EmptyState
                    title="Nothing happening yet."
                    body="Notifications about hosts, servers, backups, and updates will land here."
                  />
                </Surface>
              ) : (
                <Surface>
                  <RecentActivity rows={activity} />
                </Surface>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
