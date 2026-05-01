// Reachable from server.ts directly — see src/lib/env.ts on the
// server-only omission rationale.
//
// Scheduled-backup loop. Runs every minute, queries enabled rows in
// backup_configs whose cron schedule matches the current minute and
// whose last run was outside the current minute window, then triggers
// a backup for each.
//
// Single-process: when we scale to multiple Next.js instances we'll
// move this to a dedicated worker with row-level locking. For now,
// one instance, one loop.

import { logger } from '@/lib/logger'
import { startBackup, sweepExpiredBackups } from '@/server/actions/backups'
import { db } from '@/server/db'
import {
  backupConfigs as backupConfigsTable,
  gameServers as gameServersTable,
  hosts as hostsTable,
} from '@/server/db/schema'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'

const TICK_MS = 60_000

let started = false
let timer: NodeJS.Timeout | null = null

export function startBackupScheduler(): void {
  if (started) return
  started = true
  logger.info('backup scheduler started')
  // Fire one tick immediately on boot so a 'every minute' schedule
  // doesn't have to wait up to a minute for the first run.
  void tick()
  timer = setInterval(tick, TICK_MS)
}

export function stopBackupScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
  started = false
}

async function tick(): Promise<void> {
  try {
    await scheduleDueBackups()
    await sweepExpiredBackups()
  } catch (err) {
    logger.error({ err }, 'backup scheduler tick failed')
  }
}

async function scheduleDueBackups(): Promise<void> {
  const now = new Date()

  const candidates = await db
    .select({
      serverId: backupConfigsTable.serverId,
      scheduleCron: backupConfigsTable.scheduleCron,
      lastRunAt: backupConfigsTable.lastRunAt,
      hostUserId: hostsTable.userId,
    })
    .from(backupConfigsTable)
    .innerJoin(gameServersTable, eq(gameServersTable.id, backupConfigsTable.serverId))
    .innerJoin(hostsTable, eq(hostsTable.id, gameServersTable.hostId))
    .where(
      and(
        eq(backupConfigsTable.isEnabled, true),
        isNotNull(backupConfigsTable.scheduleCron),
        isNull(gameServersTable.deletedAt),
        isNull(hostsTable.deletedAt),
      ),
    )

  for (const row of candidates) {
    if (!row.scheduleCron) continue
    if (!cronMatches(row.scheduleCron, now)) continue
    // Throttle: don't fire twice within the same minute window.
    if (row.lastRunAt && now.getTime() - row.lastRunAt.getTime() < TICK_MS) continue

    const result = await startBackup(row.hostUserId, row.serverId, 'scheduled')
    if (!result.ok) {
      logger.warn({ serverId: row.serverId, error: result.error }, 'scheduled backup not started')
    } else {
      logger.info(
        { serverId: row.serverId, backupId: result.data.backupId },
        'scheduled backup started',
      )
    }
  }
}

// ─── tiny cron parser ──────────────────────────────────────────────

// Standard 5-field cron: minute hour dom mon dow.
// Supports: '*', N, N-M, N,M,P, */S, N-M/S. No L/W/#/@reboot/aliases.
export function cronMatches(spec: string, when: Date): boolean {
  const parts = spec.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const [minute, hour, dom, mon, dow] = parts as [string, string, string, string, string]
  return (
    fieldMatches(minute, when.getMinutes(), 0, 59) &&
    fieldMatches(hour, when.getHours(), 0, 23) &&
    fieldMatches(dom, when.getDate(), 1, 31) &&
    fieldMatches(mon, when.getMonth() + 1, 1, 12) &&
    fieldMatches(dow, when.getDay(), 0, 6)
  )
}

function fieldMatches(spec: string, value: number, min: number, max: number): boolean {
  for (const part of spec.split(',')) {
    let range = part
    let step = 1
    const slashIdx = part.indexOf('/')
    if (slashIdx !== -1) {
      range = part.slice(0, slashIdx)
      const stepStr = part.slice(slashIdx + 1)
      const parsed = Number.parseInt(stepStr, 10)
      if (!Number.isInteger(parsed) || parsed <= 0) return false
      step = parsed
    }
    let lo = min
    let hi = max
    if (range !== '*' && range !== '') {
      const dashIdx = range.indexOf('-')
      if (dashIdx !== -1) {
        const a = Number.parseInt(range.slice(0, dashIdx), 10)
        const b = Number.parseInt(range.slice(dashIdx + 1), 10)
        if (!Number.isInteger(a) || !Number.isInteger(b)) return false
        lo = a
        hi = b
      } else {
        const n = Number.parseInt(range, 10)
        if (!Number.isInteger(n)) return false
        lo = n
        hi = n
      }
    }
    if (lo < min || hi > max || lo > hi) return false
    for (let v = lo; v <= hi; v += step) {
      if (v === value) return true
    }
  }
  return false
}
