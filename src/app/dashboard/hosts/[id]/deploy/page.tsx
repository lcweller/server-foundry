import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { gameCatalog, hosts as hostsTable } from '@/server/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeployFlow } from './deploy-flow'

export const metadata: Metadata = {
  title: 'Deploy a server',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function DeployPage({ params }: Props) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { user } = await requireUser()

  const host = await db.query.hosts.findFirst({
    where: and(eq(hostsTable.id, id), eq(hostsTable.userId, user.id), isNull(hostsTable.deletedAt)),
  })
  if (!host) notFound()

  const games = await db
    .select({
      id: gameCatalog.id,
      slug: gameCatalog.slug,
      name: gameCatalog.name,
      description: gameCatalog.description,
      defaultPort: gameCatalog.defaultPort,
      minRamMb: gameCatalog.minRamMb,
      recRamMb: gameCatalog.recRamMb,
      configSchemaJson: gameCatalog.configSchemaJson,
    })
    .from(gameCatalog)
    .where(eq(gameCatalog.isEnabled, true))
    .orderBy(asc(gameCatalog.name))

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href={`/dashboard/hosts/${host.id}` as Route}
        className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted hover:text-text transition-colors"
      >
        ← Back to host
      </Link>

      <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <span className="text-ember">02</span>
        <span className="mx-2 text-text-faint">·</span>
        <span>Deploy</span>
      </p>
      <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
        Deploy a game server.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
        Choose a game, name the server, set the config. The agent on{' '}
        <span className="text-text">{host.name}</span> downloads, configures, and starts it.
      </p>

      <div className="mt-12">
        {host.status !== 'online' ? (
          <div className="mb-6 rounded-md border border-border bg-surface p-5 text-sm">
            <p className="text-text">This host is offline.</p>
            <p className="mt-1 text-text-muted">
              You can still queue a deploy — the agent will pick it up when it reconnects.
            </p>
          </div>
        ) : null}
        <DeployFlow hostId={host.id} hostName={host.name} games={games} />
      </div>
    </div>
  )
}
