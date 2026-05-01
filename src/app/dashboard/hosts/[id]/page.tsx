import { LiveLogsPanel } from '@/components/app/live-logs'
import { LiveMetricsPanel } from '@/components/app/live-metrics'
import { ServerStatusBadge } from '@/components/app/server-status-pip'
import { StatusPip } from '@/components/app/status-pip'
import { TerminalPanel } from '@/components/app/terminal-panel'
import { UptimeHeatmap } from '@/components/app/uptime-heatmap'
import { Callsign } from '@/components/ui/callsign'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/section-header'
import { Surface } from '@/components/ui/surface'
import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  agentUpdates as agentUpdatesTable,
  gameCatalog as gameCatalogTable,
  gameServers as gameServersTable,
  hostMetricsHourly as hostMetricsHourlyTable,
  hosts as hostsTable,
} from '@/server/db/schema'
import { and, asc, desc, eq, gte, isNull } from 'drizzle-orm'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AgentUpdatesSection } from './agent-updates-section'
import { RemoveHostButton } from './remove-host-button'

export const metadata: Metadata = {
  title: 'Host',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'servers', label: 'Game servers' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' },
] as const

const HOUR_MS = 60 * 60 * 1000
const UPTIME_WINDOW_HOURS = 24

function formatBytes(bytes: bigint | null | undefined): string {
  if (bytes == null) return '—'
  const num = Number(bytes)
  const gb = num / 1024 ** 3
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(num / 1024 ** 2).toFixed(0)} MB`
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleString()
}

export default async function HostDetailPage({ params }: Props) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { user } = await requireUser()

  const host = await db.query.hosts.findFirst({
    where: and(eq(hostsTable.id, id), eq(hostsTable.userId, user.id), isNull(hostsTable.deletedAt)),
  })

  if (!host) notFound()

  const isOffline = host.status === 'offline'

  const servers = await db
    .select({
      id: gameServersTable.id,
      name: gameServersTable.name,
      port: gameServersTable.port,
      status: gameServersTable.status,
      playerCount: gameServersTable.playerCount,
      maxPlayers: gameServersTable.maxPlayers,
      gameName: gameCatalogTable.name,
      gameSlug: gameCatalogTable.slug,
    })
    .from(gameServersTable)
    .innerJoin(gameCatalogTable, eq(gameCatalogTable.id, gameServersTable.gameId))
    .where(and(eq(gameServersTable.hostId, host.id), isNull(gameServersTable.deletedAt)))
    .orderBy(asc(gameServersTable.createdAt))

  // Last 24 UTC-aligned hour buckets where the host reported metrics.
  // Used as a proxy for uptime — see uptime-heatmap.tsx for caveats.
  const uptimeCutoff = new Date(
    Math.floor(Date.now() / HOUR_MS) * HOUR_MS - (UPTIME_WINDOW_HOURS - 1) * HOUR_MS,
  )
  const uptimeRows = await db
    .select({ hourBucket: hostMetricsHourlyTable.hourBucket })
    .from(hostMetricsHourlyTable)
    .where(
      and(
        eq(hostMetricsHourlyTable.hostId, host.id),
        gte(hostMetricsHourlyTable.hourBucket, uptimeCutoff),
      ),
    )
  const presentHours = uptimeRows.map((r) => r.hourBucket.toISOString())

  const updateRows = await db
    .select({
      id: agentUpdatesTable.id,
      fromVersion: agentUpdatesTable.fromVersion,
      toVersion: agentUpdatesTable.toVersion,
      status: agentUpdatesTable.status,
      errorMessage: agentUpdatesTable.errorMessage,
      startedAt: agentUpdatesTable.startedAt,
      completedAt: agentUpdatesTable.completedAt,
    })
    .from(agentUpdatesTable)
    .where(eq(agentUpdatesTable.hostId, host.id))
    .orderBy(desc(agentUpdatesTable.startedAt))
    .limit(20)

  const updateItems = updateRows.map((u) => ({
    id: u.id,
    fromVersion: u.fromVersion,
    toVersion: u.toVersion,
    status: u.status,
    errorMessage: u.errorMessage,
    startedAt: u.startedAt.toISOString(),
    completedAt: u.completedAt ? u.completedAt.toISOString() : null,
  }))

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/dashboard"
        className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
      >
        ← All hosts
      </Link>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Callsign id={host.id} className="text-accent" />
            <span aria-hidden="true" className="text-text-faint">
              ·
            </span>
            <StatusPip status={host.status} />
          </div>
          <h1 className="mt-3 truncate text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            {host.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <p className="font-mono text-xs text-text-muted">{host.hostname || '—'}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
              {host.os || '—'}
            </p>
          </div>
        </div>
        <RemoveHostButton hostId={host.id} hostName={host.name} />
      </header>

      <nav aria-label="Host tabs" className="mt-10 border-b border-border">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                aria-current={tab.id === 'overview' ? 'page' : undefined}
                disabled={tab.id !== 'overview'}
                className="relative px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-text-muted disabled:cursor-not-allowed disabled:text-text-faint aria-[current=page]:text-text"
              >
                {tab.label}
                {tab.id === 'overview' ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-10">
        {isOffline ? <OfflineBanner /> : null}

        <section>
          <LiveMetricsPanel
            hostId={host.id}
            initialStatus={host.status}
            fallbackRamBytes={host.ramBytes != null ? Number(host.ramBytes) : null}
            fallbackStorageBytes={host.storageBytes != null ? Number(host.storageBytes) : null}
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Uptime"
            title="Last 24 hours"
            subtitle="Each cell is one hour. Lime: agent reported in. Muted: no data — host was offline, restarting, or simply not heartbeating."
          />
          <Surface className="p-5">
            <UptimeHeatmap presentHours={presentHours} />
          </Surface>
        </section>

        <section className="space-y-4">
          <SectionHeader eyebrow="Hardware" title="Machine" />
          <Surface className="p-5">
            <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="CPU" value={host.cpuModel ?? '—'} />
              <DetailItem label="Cores" value={host.cpuCores ? String(host.cpuCores) : '—'} />
              <DetailItem label="RAM" value={formatBytes(host.ramBytes)} />
              <DetailItem label="Storage" value={formatBytes(host.storageBytes)} />
              <DetailItem label="GPU" value={host.gpuModel ?? '—'} />
              <DetailItem label="Kernel" value={host.kernel ?? '—'} />
            </dl>
          </Surface>
        </section>

        <section className="space-y-4">
          <SectionHeader eyebrow="Connection" title="Link to platform" />
          <Surface className="p-5">
            <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="IP" value={host.ip ?? '—'} mono />
              <DetailItem label="Agent version" value={host.agentVersion ?? '—'} mono />
              <DetailItem label="Last seen" value={formatDate(host.lastSeenAt)} />
              <DetailItem label="Paired" value={formatDate(host.createdAt)} />
            </dl>
          </Surface>
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Game servers"
            title="Worlds on this host"
            action={
              <Link
                href={`/dashboard/hosts/${host.id}/deploy` as Route}
                className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-background transition-colors hover:bg-accent-soft"
              >
                Deploy server
              </Link>
            }
          />

          {servers.length === 0 ? (
            <Surface>
              <EmptyState
                eyebrow="Empty"
                title="No worlds running yet."
                body="Deploy a game server on this host — Valheim, Counter-Strike 2, Rust, and more are ready to go."
                cta={
                  <Link
                    href={`/dashboard/hosts/${host.id}/deploy` as Route}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-xs font-medium text-background transition-colors hover:bg-accent-soft"
                  >
                    Deploy your first server
                  </Link>
                }
              />
            </Surface>
          ) : (
            <Surface>
              <ul className="divide-y divide-border">
                {servers.map((server) => (
                  <li key={server.id}>
                    <Link
                      href={`/dashboard/servers/${server.id}` as Route}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-elevated/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text">{server.name}</p>
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                          {server.gameName} · port {server.port}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <ServerStatusBadge status={server.status} />
                        <span aria-hidden="true" className="text-text-faint">
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Surface>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Terminal"
            title="Remote shell"
            subtitle="Browser → platform → agent → PTY. Nothing's exposed publicly."
          />
          {host.status === 'online' ? (
            <TerminalPanel hostId={host.id} />
          ) : (
            <Surface className="p-5 text-sm">
              <p className="text-text">Terminal is unavailable while the host is offline.</p>
            </Surface>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Agent updates"
            title="Self-update history"
            subtitle="Verified, signed self-update flow. Health check rolls back automatically if the new agent fails to come online."
          />
          <AgentUpdatesSection
            hostId={host.id}
            currentVersion={host.agentVersion ?? null}
            initialUpdates={updateItems}
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Host logs"
            title="Live tail"
            subtitle="Agent + host events. Filter by severity to focus."
          />
          <LiveLogsPanel source="host" entityId={host.id} />
        </section>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">{label}</dt>
      <dd className={`mt-1.5 truncate text-sm text-text ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function OfflineBanner() {
  return (
    <Surface className="p-5 text-sm">
      <p className="text-text">This host hasn’t connected yet, or it went offline.</p>
      <p className="mt-1 text-text-muted">
        If you just paired it, check that the agent installed cleanly. Run{' '}
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-accent">
          systemctl status foundry-agent
        </code>{' '}
        on the host.
      </p>
    </Surface>
  )
}
