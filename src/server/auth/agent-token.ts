// Reachable from server.ts via the WS handler — see src/lib/env.ts.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

// Agent tokens are HMAC-signed bearer credentials issued at pairing time.
// Format: `<random>.<hmac>` where:
//   <random> = 32 raw bytes, base64url encoded (~43 chars)
//   <hmac>   = HMAC-SHA256(<random>) under AGENT_HMAC_SECRET, base64url
// We never store the raw token — only its SHA-256 hash for compare-only
// validation. The HMAC is the integrity check (lets us reject malformed
// tokens before a DB hit).

const TOKEN_RANDOM_BYTES = 32

function getAgentHmacSecret(): string {
  if (!env.AGENT_HMAC_SECRET) {
    throw new Error('AGENT_HMAC_SECRET is not set — required to issue or validate agent tokens')
  }
  return env.AGENT_HMAC_SECRET
}

export function issueAgentToken(): { raw: string; hash: string } {
  const random = randomBytes(TOKEN_RANDOM_BYTES).toString('base64url')
  const hmac = createHmac('sha256', getAgentHmacSecret()).update(random).digest('base64url')
  const raw = `${random}.${hmac}`
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export function isAgentTokenSignatureValid(raw: string): boolean {
  const dot = raw.lastIndexOf('.')
  if (dot < 0) return false
  const random = raw.slice(0, dot)
  const presented = raw.slice(dot + 1)
  const expected = createHmac('sha256', getAgentHmacSecret()).update(random).digest('base64url')
  // Both strings are deterministic-length base64url HMAC-SHA256 outputs
  // (43 chars), so the lengths always match in well-formed input. Use
  // the platform's vetted constant-time compare rather than a hand-
  // rolled charCodeAt loop.
  const presentedBuf = Buffer.from(presented, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (presentedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(presentedBuf, expectedBuf)
}

export function hashAgentToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
