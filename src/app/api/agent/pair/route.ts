import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/audit/record'
import { issueAgentToken } from '@/server/auth/agent-token'
import { db } from '@/server/db'
import { hosts, pairingCodes } from '@/server/db/schema'
import { createNotification } from '@/server/notifications/create'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// POST /api/agent/pair
//
// Public endpoint — exchanges a pairing code for a long-lived agent token.
// The agent posts host info and the user-generated pairing code; we
// validate it (single-use, not expired, owned by some user), create a host
// row owned by that user, issue an HMAC-signed token, and return it.
//
// HMAC signature on this initial request is not feasible (the agent has no
// token yet — that's what it's asking for). Subsequent agent traffic
// requires the token. Defense at this entry point: opaque random codes
// with 30^8 entropy + 15-minute TTL + single-use semantics.

export const runtime = 'nodejs'

const AGENT_VERSION = '0.1.0'

const requestSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  hostInfo: z.object({
    hostname: z.string().max(253).optional(),
    ip: z.string().max(64).optional(),
    os: z.string().max(128).optional(),
    kernel: z.string().max(128).optional(),
    cpu: z
      .object({
        model: z.string().max(128).optional(),
        cores: z.number().int().nonnegative().max(2048).optional(),
      })
      .optional(),
    ram: z.number().int().nonnegative().optional(),
    storage: z.number().int().nonnegative().optional(),
    gpu: z.string().max(128).optional(),
  }),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request.',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    )
  }

  const { code, hostInfo } = parsed.data

  try {
    const result = await db.transaction(async (tx) => {
      const codeRow = await tx.query.pairingCodes.findFirst({
        where: eq(pairingCodes.code, code),
      })

      if (!codeRow) {
        return { error: 'Invalid pairing code.', status: 404 } as const
      }
      if (codeRow.usedAt) {
        return { error: 'Pairing code already used.', status: 409 } as const
      }
      if (codeRow.expiresAt.getTime() < Date.now()) {
        return { error: 'Pairing code expired.', status: 410 } as const
      }

      // Issue the agent token now so we can persist its hash atomically
      // with the host row.
      const token = issueAgentToken()
      const displayName = hostInfo.hostname?.trim() || `Host ${codeRow.id.slice(0, 8)}`

      const [host] = await tx
        .insert(hosts)
        .values({
          userId: codeRow.userId,
          name: displayName,
          hostname: hostInfo.hostname,
          ip: hostInfo.ip,
          os: hostInfo.os,
          kernel: hostInfo.kernel,
          cpuModel: hostInfo.cpu?.model,
          cpuCores: hostInfo.cpu?.cores,
          ramBytes: typeof hostInfo.ram === 'number' ? BigInt(hostInfo.ram) : null,
          storageBytes: typeof hostInfo.storage === 'number' ? BigInt(hostInfo.storage) : null,
          gpuModel: hostInfo.gpu,
          agentVersion: AGENT_VERSION,
          agentTokenHash: token.hash,
          status: 'connecting',
          lastSeenAt: new Date(),
        })
        .returning({ id: hosts.id })

      if (!host) {
        return { error: 'Failed to create host.', status: 500 } as const
      }

      await tx
        .update(pairingCodes)
        .set({ usedAt: new Date(), hostId: host.id })
        .where(and(eq(pairingCodes.id, codeRow.id), isNull(pairingCodes.usedAt)))

      return {
        hostId: host.id,
        token: token.raw,
        userId: codeRow.userId,
        displayName,
      } as const
    })

    if ('error' in result) {
      void recordAudit({
        action: 'auth_failure',
        entityType: 'pairing_code',
        metadata: { reason: result.error, codePrefix: code.slice(0, 4) },
      })
      return NextResponse.json({ error: result.error }, { status: result.status as number })
    }

    logger.info({ hostId: result.hostId }, 'host paired')

    void recordAudit({
      userId: result.userId,
      action: 'host_paired',
      entityType: 'host',
      entityId: result.hostId,
      metadata: { displayName: result.displayName },
    })

    // Notify the host's owner that their pairing code was consumed.
    // Useful confirmation if they shared the code remotely.
    void createNotification({
      userId: result.userId,
      type: 'pairing_used',
      severity: 'info',
      title: 'Pairing code used',
      body: `A new host paired using your code (${result.displayName}).`,
      relatedHostId: result.hostId,
    })

    return NextResponse.json({
      token: result.token,
      hostId: result.hostId,
      agentVersion: AGENT_VERSION,
    })
  } catch (err) {
    logger.error({ err }, 'agent pair failed')
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}

// Block GET so a curious browser doesn't surface anything useful.
export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
