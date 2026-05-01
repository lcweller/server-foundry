import { LiveLogsPanel } from '@/components/app/live-logs'
import { ServerStatusBadge } from '@/components/app/server-status-pip'
import { listBackups, loadBackupConfig } from '@/server/actions/backups'
import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import {
  gameCatalog as gameCatalogTable,
  gameServers as gameServersTable,
  hosts as hostsTable,
} from '@/server/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BackupsSection } from './backups-section'
import { ServerControls } from './server-controls'

export const metadata: Metadata = {
  title: 'Server',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleString()
}

export default async function ServerDetailPage({ params }: Props) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { user } = await requireUser()

  const rows = await db
    .select({
      server: gameServersTable,
      game: gameCatalogTable,
      host: hostsTable,
    })
    .from(gameServersTable)
    .innerJoin(gameCatalogTable, eq(gameCatalogTable.id, gameServersTable.gameId))
    .innerJoin(hostsTable, eq(hostsTable.id, gameServersTable.hostId))
    .where(
      and(
        eq(gameServersTable.id, id),
        eq(hostsTable.userId, user.id),
        isNull(gameServersTable.deletedAt),
        isNull(hostsTable.deletedAt),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) notFound()
  const { server, game, host } = row

  const hostOnline = host.status === 'online'

  const [backupRows, backupConfig] = await Promise.all([
    listBackups(server.id),
    loadBackupConfig(server.id),
  ])
  const backupItems = backupRows.map((b) => ({
    id: b.id,
    startedAt: b.startedAt.toISOString(),
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    status: b.status,
    sizeBytes: b.sizeBytes != null ? b.sizeBytes.toString() : null,
    storageUrl: b.storageUrl,
    errorMessage: b.errorMessage,
    triggeredBy: b.triggeredBy,
  }))
  const backupConfigSnapshot = backupConfig
    ? {
        isEnabled: backupConfig.isEnabled,
        scheduleCron: backupConfig.scheduleCron,
        retentionCount: backupConfig.retentionCount,
        destinationType: backupConfig.destinationType,
        hasS3Credentials:
          backupConfig.destinationType === 's3' &&
          typeof backupConfig.destinationConfigJson === 'string',
      }
    : null

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href={`/dashboard/hosts/${host.id}` as Route}
        className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
      >
        ← {host.name}
      </Link>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
            {game.name}
          </p>
          <h1 className="mt-2 truncate font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            {server.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <ServerStatusBadge status={server.status} />
            <p className="font-mono text-xs text-text-muted">port {server.port}</p>
          </div>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {!hostOnline ? (
          <div className="rounded-md border border-border bg-surface p-5 text-sm">
            <p className="text-text">
              The host is offline. Start, stop, restart, and delete will be unavailable until the
              agent reconnects.
            </p>
          </div>
        ) : null}

        <section>
          <ServerControls serverId={server.id} status={server.status} hostOnline={hostOnline} />
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Status</p>
          <dl className="mt-4 grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label="Players"
              value={`${server.playerCount}${server.maxPlayers ? ` / ${server.maxPlayers}` : ''}`}
            />
            <DetailItem label="PID" value={server.pid != null ? String(server.pid) : '—'} mono />
            <DetailItem label="Last started" value={formatDate(server.lastStartedAt)} />
            <DetailItem label="Created" value={formatDate(server.createdAt)} />
          </dl>
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Game</p>
          <dl className="mt-4 grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Game" value={game.name} />
            <DetailItem label="Port" value={String(server.port)} mono />
            <DetailItem
              label="Recommended RAM"
              value={game.recRamMb ? `${game.recRamMb} MB` : '—'}
            />
          </dl>
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">Backups</p>
          <p className="mt-2 mb-4 text-xs text-text-muted">
            Tar+gzip the install directory and ship it to your S3-compatible bucket. Schedule via
            cron; restore from the history list.
          </p>
          <BackupsSection
            serverId={server.id}
            initialConfig={backupConfigSnapshot}
            initialBackups={backupItems}
          />
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
            Server logs
          </p>
          <p className="mt-2 mb-4 text-xs text-text-muted">
            Live stdout + stderr from the game server process.
          </p>
          <LiveLogsPanel source="server" entityId={server.id} />
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
