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

export const serverStatusChangeMessage = baseEnvelope.extend({
  type: z.literal('server_status_change'),
  payload: z.object({
    serverId: z.string().uuid(),
    status: z.enum(['deploying', 'running', 'stopped', 'crashed']),
    pid: z.number().int().positive().optional(),
    playerCount: z.number().int().nonnegative().optional(),
    error: z.string().max(1024).optional(),
  }),
})

export const deploymentProgressMessage = baseEnvelope.extend({
  type: z.literal('deployment_progress'),
  payload: z.object({
    serverId: z.string().uuid(),
    phase: z.enum(['queued', 'downloading', 'configuring', 'starting', 'done', 'failed']),
    percent: z.number().min(0).max(100).optional(),
    detail: z.string().max(512).optional(),
  }),
})

// terminal_data carries raw PTY output (frequently non-UTF-8 bytes for
// escape sequences, control characters, etc). Base64-encoded so the
// JSON envelope stays valid.
export const terminalDataMessage = baseEnvelope.extend({
  type: z.literal('terminal_data'),
  payload: z.object({
    sessionId: z.string().uuid(),
    data: z.string().max(131072), // 128KB cap per chunk
  }),
})

export const terminalClosedMessage = baseEnvelope.extend({
  type: z.literal('terminal_closed'),
  payload: z.object({
    sessionId: z.string().uuid(),
    exitCode: z.number().int().optional(),
    signal: z.string().max(32).optional(),
  }),
})

export const agentToPlatformMessage = z.discriminatedUnion('type', [
  helloMessage,
  heartbeatMessage,
  logMessage,
  serverStatusChangeMessage,
  deploymentProgressMessage,
  terminalDataMessage,
  terminalClosedMessage,
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

export const deployServerMessage = baseEnvelope.extend({
  type: z.literal('deploy_server'),
  payload: z.object({
    serverId: z.string().uuid(),
    gameSlug: z.string().min(1).max(64),
    steamAppId: z.number().int().positive().optional(),
    name: z.string().min(1).max(128),
    port: z.number().int().min(1).max(65535),
    config: z.record(z.string(), z.unknown()),
  }),
})

export const startServerMessage = baseEnvelope.extend({
  type: z.literal('start_server'),
  payload: z.object({ serverId: z.string().uuid() }),
})

export const stopServerMessage = baseEnvelope.extend({
  type: z.literal('stop_server'),
  payload: z.object({ serverId: z.string().uuid() }),
})

export const restartServerMessage = baseEnvelope.extend({
  type: z.literal('restart_server'),
  payload: z.object({ serverId: z.string().uuid() }),
})

export const deleteServerMessage = baseEnvelope.extend({
  type: z.literal('delete_server'),
  payload: z.object({ serverId: z.string().uuid() }),
})

export const terminalOpenMessage = baseEnvelope.extend({
  type: z.literal('terminal_open'),
  payload: z.object({
    sessionId: z.string().uuid(),
    cols: z.number().int().min(1).max(1024),
    rows: z.number().int().min(1).max(1024),
  }),
})

export const terminalInputMessage = baseEnvelope.extend({
  type: z.literal('terminal_input'),
  payload: z.object({
    sessionId: z.string().uuid(),
    data: z.string().max(65536), // 64KB cap; keystrokes are tiny but
    // pasted blocks can be larger
  }),
})

export const terminalResizeMessage = baseEnvelope.extend({
  type: z.literal('terminal_resize'),
  payload: z.object({
    sessionId: z.string().uuid(),
    cols: z.number().int().min(1).max(1024),
    rows: z.number().int().min(1).max(1024),
  }),
})

export const terminalCloseMessage = baseEnvelope.extend({
  type: z.literal('terminal_close'),
  payload: z.object({ sessionId: z.string().uuid() }),
})

export const platformToAgentMessage = z.discriminatedUnion('type', [
  helloAckMessage,
  errorMessage,
  deployServerMessage,
  startServerMessage,
  stopServerMessage,
  restartServerMessage,
  deleteServerMessage,
  terminalOpenMessage,
  terminalInputMessage,
  terminalResizeMessage,
  terminalCloseMessage,
])

// ─── Inferred TS types ─────────────────────────────────────────────

export type HelloMessage = z.infer<typeof helloMessage>
export type HeartbeatMessage = z.infer<typeof heartbeatMessage>
export type LogMessage = z.infer<typeof logMessage>
export type ServerStatusChangeMessage = z.infer<typeof serverStatusChangeMessage>
export type DeploymentProgressMessage = z.infer<typeof deploymentProgressMessage>
export type TerminalDataMessage = z.infer<typeof terminalDataMessage>
export type TerminalClosedMessage = z.infer<typeof terminalClosedMessage>
export type AgentToPlatformMessage = z.infer<typeof agentToPlatformMessage>

export type HelloAckMessage = z.infer<typeof helloAckMessage>
export type ErrorMessage = z.infer<typeof errorMessage>
export type DeployServerMessage = z.infer<typeof deployServerMessage>
export type StartServerMessage = z.infer<typeof startServerMessage>
export type StopServerMessage = z.infer<typeof stopServerMessage>
export type RestartServerMessage = z.infer<typeof restartServerMessage>
export type DeleteServerMessage = z.infer<typeof deleteServerMessage>
export type TerminalOpenMessage = z.infer<typeof terminalOpenMessage>
export type TerminalInputMessage = z.infer<typeof terminalInputMessage>
export type TerminalResizeMessage = z.infer<typeof terminalResizeMessage>
export type TerminalCloseMessage = z.infer<typeof terminalCloseMessage>
export type PlatformToAgentMessage = z.infer<typeof platformToAgentMessage>

// ─── Constants ─────────────────────────────────────────────────────

export const HEARTBEAT_INTERVAL_SECONDS = 3
export const HEARTBEAT_GRACE_SECONDS = 10
