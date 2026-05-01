// Server-internal backup-row reaper. Lives outside the 'use server'
// action file so it can't be invoked as a client-callable RPC; the
// scheduler imports this directly.
//
// Hard-deletes backup rows whose retentionUntil has passed and whose
// status is terminal (not 'running'). The S3 object lifecycle is
// managed by the user's bucket policy in v1 — we don't issue DELETE
// requests against the bucket from here.

import 'server-only'
import { db } from '@/server/db'
import { backups } from '@/server/db/schema'
import { and, lt, ne } from 'drizzle-orm'

export async function sweepExpiredBackups(): Promise<void> {
  await db
    .delete(backups)
    .where(and(ne(backups.status, 'running'), lt(backups.retentionUntil, new Date())))
}
