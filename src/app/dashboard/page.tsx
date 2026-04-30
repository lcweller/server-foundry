import { HostCard } from '@/components/app/host-card'
import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { hosts as hostsTable } from '@/server/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
}

export default async function DashboardPage() {
  const { user } = await requireUser()

  const hosts = await db
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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            <span className="text-ember">01</span>
            <span className="mx-2 text-text-faint">·</span>
            <span>Hosts</span>
          </p>
          <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
            Your hosts.
          </h1>
        </div>
        <Link
          href="/dashboard/hosts/new"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-ember px-4 text-sm font-medium text-background transition-colors hover:bg-ember-soft"
        >
          + Add host
        </Link>
      </div>

      <div className="mt-10">
        {hosts.length === 0 ? <EmptyState /> : <HostsGrid hosts={hosts} />}
      </div>
    </div>
  )
}

type HostListItem = Parameters<typeof HostCard>[0]['host']

function HostsGrid({ hosts }: { hosts: HostListItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {hosts.map((host) => (
        <li key={host.id}>
          <HostCard host={host} />
        </li>
      ))}
    </ul>
  )
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface/40 p-12 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">No hosts yet</p>
      <h2 className="mt-3 font-serif text-2xl text-text">Let’s get you connected.</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-muted">
        Generate a pairing code, run one command on any Linux host you own, and it appears here.
      </p>
      <Link
        href="/dashboard/hosts/new"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-ember px-6 text-sm font-medium text-background transition-colors hover:bg-ember-soft"
      >
        Add your first host
      </Link>
    </div>
  )
}
