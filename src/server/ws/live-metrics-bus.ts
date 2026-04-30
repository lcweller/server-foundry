// Reachable from server.ts via the WS handler — see src/lib/env.ts.
import { EventEmitter } from 'node:events'

// In-memory live metrics cache + pub/sub for SSE consumers.
//
// Single-process design: when we scale past one Next.js instance we'll
// swap the EventEmitter for Redis pub/sub and the Map for a Redis hash.
// Until then, this is correct and zero-dependency.

export type LiveMetrics = {
  hostId: string
  ts: number
  cpuPercent: number
  memUsedBytes: number
  memTotalBytes: number
  diskUsedBytes?: number | undefined
  diskTotalBytes?: number | undefined
  netInBytes?: number | undefined
  netOutBytes?: number | undefined
  cpuTempC?: number | undefined
  gpuTempC?: number | undefined
}

type StatusEvent = {
  hostId: string
  status: 'online' | 'offline' | 'connecting' | 'updating'
  ts: number
}

class LiveMetricsBus {
  private readonly emitter = new EventEmitter()
  private readonly cache = new Map<string, LiveMetrics>()

  constructor() {
    // SSE consumers may attach many listeners on the same process.
    this.emitter.setMaxListeners(1000)
  }

  publishHeartbeat(metrics: LiveMetrics): void {
    this.cache.set(metrics.hostId, metrics)
    this.emitter.emit(`metrics:${metrics.hostId}`, metrics)
  }

  getLatest(hostId: string): LiveMetrics | undefined {
    return this.cache.get(hostId)
  }

  publishStatus(event: StatusEvent): void {
    this.emitter.emit(`status:${event.hostId}`, event)
  }

  onMetrics(hostId: string, listener: (m: LiveMetrics) => void): () => void {
    const event = `metrics:${hostId}`
    this.emitter.on(event, listener)
    return () => this.emitter.off(event, listener)
  }

  onStatus(hostId: string, listener: (s: StatusEvent) => void): () => void {
    const event = `status:${hostId}`
    this.emitter.on(event, listener)
    return () => this.emitter.off(event, listener)
  }

  clearHost(hostId: string): void {
    this.cache.delete(hostId)
  }
}

const globalForBus = globalThis as unknown as { __sfBus?: LiveMetricsBus }
export const liveMetricsBus = globalForBus.__sfBus ?? new LiveMetricsBus()
if (!globalForBus.__sfBus) globalForBus.__sfBus = liveMetricsBus
