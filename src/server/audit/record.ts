// Audit log writer. Insert-only — every privileged action funnels
// through here so we always have a forensic trail.
//
// Errors are logged but not raised; an audit-write failure should
// never block the user-visible action. (If audit logging itself is
// down we'd rather lose the line than refuse a legitimate request.)
//
// Reachable from server.ts via the backup scheduler chain
// (scheduler → actions/backups → here) — see src/lib/env.ts on
// the `server-only` omission rationale.

import { logger } from '@/lib/logger'
import { db } from '@/server/db'
import { type AuditAction, auditLog } from '@/server/db/schema'
import { headers } from 'next/headers'

export type AuditInput = {
  userId?: string | null
  action: AuditAction
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  // Override the request-scoped IP/UA — used by the WS handler where
  // there's no RSC headers() context.
  ip?: string
  userAgent?: string
}

export async function recordAudit(input: AuditInput): Promise<void> {
  let ip = input.ip
  let userAgent = input.userAgent

  if (ip === undefined || userAgent === undefined) {
    try {
      const h = await headers()
      ip ??=
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        h.get('x-real-ip') ??
        h.get('cf-connecting-ip') ??
        undefined
      userAgent ??= h.get('user-agent') ?? undefined
    } catch {
      // headers() is only available in request scopes (RSC, Server
      // Actions, route handlers). For other call sites the caller
      // should pass them explicitly.
    }
  }

  const row: {
    userId?: string | null
    action: AuditAction
    entityType?: string
    entityId?: string
    metadata?: Record<string, unknown>
    ip?: string
    userAgent?: string
  } = { action: input.action }
  if (input.userId !== undefined) row.userId = input.userId
  if (input.entityType) row.entityType = input.entityType
  if (input.entityId) row.entityId = input.entityId
  if (input.metadata && Object.keys(input.metadata).length > 0) row.metadata = input.metadata
  if (ip) row.ip = ip
  if (userAgent) row.userAgent = userAgent

  try {
    await db.insert(auditLog).values(row)
  } catch (err) {
    logger.warn({ err, action: input.action }, 'audit_log insert failed')
  }
}
