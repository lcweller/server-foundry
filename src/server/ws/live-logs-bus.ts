// Reachable from server.ts via the WS handler — see src/lib/env.ts.
import { EventEmitter } from 'node:events'

// In-memory pub/sub for log streams. SSE consumers subscribe by host
// or server id; producers (the agent message handler) publish.
//
// Single-process design — same caveat as live-metrics-bus. When we
// scale past one Next.js instance, swap the EventEmitter for Redis
// pub/sub. Until then, this is correct and zero-dependency.

export type LogLine = {
  ts: number
  severity: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

class LiveLogsBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(1000)
  }

  publishHostLog(hostId: string, line: LogLine): void {
    this.emitter.emit(`host:${hostId}`, line)
  }

  publishServerLog(serverId: string, line: LogLine): void {
    this.emitter.emit(`server:${serverId}`, line)
  }

  onHostLog(hostId: string, listener: (line: LogLine) => void): () => void {
    const event = `host:${hostId}`
    this.emitter.on(event, listener)
    return () => this.emitter.off(event, listener)
  }

  onServerLog(serverId: string, listener: (line: LogLine) => void): () => void {
    const event = `server:${serverId}`
    this.emitter.on(event, listener)
    return () => this.emitter.off(event, listener)
  }
}

const globalForBus = globalThis as unknown as { __sfLogsBus?: LiveLogsBus }
export const liveLogsBus = globalForBus.__sfLogsBus ?? new LiveLogsBus()
if (!globalForBus.__sfLogsBus) globalForBus.__sfLogsBus = liveLogsBus
