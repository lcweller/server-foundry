// Shared agent ↔ platform message protocol.
//
// Every message carries an envelope and a typed payload. Both sides
// validate against these schemas with Zod on send and receive — there is
// no implicit trust between the platform and any agent.
//
// This file is intentionally pure (no server-only / browser-only imports)
// so the future agent repo can import it directly.

import { z } from 'zod'

// ─── Envelope ───────────────────────────────────────────────────────

const baseEnvelope = z.object({
  id: z.string().uuid(),
  ts: z.number().int().nonnegative(),
})

// ─── agent → platform ──────────────────────────────────────────────

export const helloMessage = baseEnvelope.extend({
  type: z.literal('hello'),
  payload: z.object({
    agentVersion: z.string().min(1).max(64),
    hostInfo: z
      .object({
        hostname: z.string().max(253).optional(),
        os: z.string().max(128).optional(),
        kernel: z.string().max(128).optional(),
        cpuModel: z.string().max(128).optional(),
        cpuCores: z.number().int().nonnegative().max(2048).optional(),
        ramBytes: z.number().int().nonnegative().optional(),
        storageBytes: z.number().int().nonnegative().optional(),
        gpuModel: z.string().max(128).optional(),
        ip: z.string().max(64).optional(),
      })
      .optional(),
  }),
})

export const heartbeatMessage = baseEnvelope.extend({
  type: z.literal('heartbeat'),
  payload: z.object({
    cpuPercent: z.number().min(0).max(100),
    memUsedBytes: z.number().int().nonnegative(),
    memTotalBytes: z.number().int().nonnegative(),
    diskUsedBytes: z.number().int().nonnegative().optional(),
    diskTotalBytes: z.number().int().nonnegative().optional(),
    netInBytes: z.number().int().nonnegative().optional(),
    netOutBytes: z.number().int().nonnegative().optional(),
    cpuTempC: z.number().optional(),
    gpuTempC: z.number().optional(),
    uptimeSeconds: z.number().int().nonnegative().optional(),
  }),
})

export const logMessage = baseEnvelope.extend({
  type: z.literal('log'),
  payload: z.object({
    source: z.enum(['host', 'server']),
    serverId: z.string().uuid().optional(),
    severity: z.enum(['debug', 'info', 'warn', 'error']),
    message: z.string().max(8192),
    occurredAt: z.number().int().nonnegative().optional(),
  }),
})

export const agentToPlatformMessage = z.discriminatedUnion('type', [
  helloMessage,
  heartbeatMessage,
  logMessage,
])

// ─── platform → agent ──────────────────────────────────────────────

export const helloAckMessage = baseEnvelope.extend({
  type: z.literal('hello_ack'),
  payload: z.object({
    serverTime: z.number().int().nonnegative(),
    heartbeatIntervalSeconds: z.number().int().positive(),
  }),
})

export const errorMessage = baseEnvelope.extend({
  type: z.literal('error'),
  payload: z.object({
    code: z.string().min(1).max(64),
    message: z.string().max(1024),
  }),
})

export const platformToAgentMessage = z.discriminatedUnion('type', [helloAckMessage, errorMessage])

// ─── Inferred TS types ─────────────────────────────────────────────

export type HelloMessage = z.infer<typeof helloMessage>
export type HeartbeatMessage = z.infer<typeof heartbeatMessage>
export type LogMessage = z.infer<typeof logMessage>
export type AgentToPlatformMessage = z.infer<typeof agentToPlatformMessage>

export type HelloAckMessage = z.infer<typeof helloAckMessage>
export type ErrorMessage = z.infer<typeof errorMessage>
export type PlatformToAgentMessage = z.infer<typeof platformToAgentMessage>

// ─── Constants ─────────────────────────────────────────────────────

export const HEARTBEAT_INTERVAL_SECONDS = 3
export const HEARTBEAT_GRACE_SECONDS = 10
