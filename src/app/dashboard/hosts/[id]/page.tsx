import { LiveLogsPanel } from '@/components/app/live-logs'
import { LiveMetricsPanel } from '@/components/app/live-metrics'
import { ServerStatusBadge } from '@/components/app/server-status-pip'
import { StatusPip } from '@/components/app/status-pip'
import { TerminalPanel } from '@/components/app/terminal-panel'
import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  agentUpdates as agentUpdatesTable,
  gameCatalog as gameCatalogTable,
  gameServers as gameServersTable,
  hosts as hostsTable,
} from '@/server/db/schema'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
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
          <h1 className="truncate font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            {host.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusPip status={host.status} />
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
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-ember" />
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

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Hardware</p>
          <dl className="mt-4 grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="CPU" value={host.cpuModel ?? '—'} />
            <DetailItem label="Cores" value={host.cpuCores ? String(host.cpuCores) : '—'} />
            <DetailItem label="RAM" value={formatBytes(host.ramBytes)} />
            <DetailItem label="Storage" value={formatBytes(host.storageBytes)} />
            <DetailItem label="GPU" value={host.gpuModel ?? '—'} />
            <DetailItem label="Kernel" value={host.kernel ?? '—'} />
          </dl>
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Connection</p>
          <dl className="mt-4 grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="IP" value={host.ip ?? '—'} mono />
            <DetailItem label="Agent version" value={host.agentVersion ?? '—'} mono />
            <DetailItem label="Last seen" value={formatDate(host.lastSeenAt)} />
            <DetailItem label="Paired" value={formatDate(host.createdAt)} />
          </dl>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
              Game servers
            </p>
            <Link
              href={`/dashboard/hosts/${host.id}/deploy` as Route}
              className="inline-flex h-9 items-center justify-center rounded-md bg-ember px-4 text-xs font-medium text-background transition-colors hover:bg-ember-soft"
            >
              Deploy server
            </Link>
          </div>

          {servers.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">No servers deployed yet on this host.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-surface">
              {servers.map((server) => (
                <li key={server.id}>
                  <Link
                    href={`/dashboard/servers/${server.id}` as Route}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-elevated"
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
          )}
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Terminal</p>
          <p className="mt-2 mb-4 text-xs text-text-muted">
            Shell on the host as the foundry user. Tunnel goes browser → platform → agent → PTY;
            nothing is exposed publicly.
          </p>
          {host.status === 'online' ? (
            <TerminalPanel hostId={host.id} />
          ) : (
            <div className="rounded-md border border-border bg-surface p-5 text-sm">
              <p className="text-text">Terminal is unavailable while the host is offline.</p>
            </div>
          )}
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
            Agent updates
          </p>
          <p className="mt-2 mb-4 text-xs text-text-muted">
            Verified, signed self-update flow. Health check rolls back automatically if the new
            agent fails to come online.
          </p>
          <AgentUpdatesSection
            hostId={host.id}
            currentVersion={host.agentVersion ?? null}
            initialUpdates={updateItems}
          />
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Host logs</p>
          <p className="mt-2 mb-4 text-xs text-text-muted">
            Live tail of agent + host events. Filter by severity to focus.
          </p>
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
    <div className="rounded-md border border-border bg-surface p-5 text-sm">
      <p className="text-text">This host hasn’t connected yet, or it went offline.</p>
      <p className="mt-1 text-text-muted">
        If you just paired it, check that the agent installed cleanly. Run{' '}
        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-ember">
          systemctl status foundry-agent
        </code>{' '}
        on the host.
      </p>
    </div>
  )
}
