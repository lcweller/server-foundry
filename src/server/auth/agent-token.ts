// Reachable from server.ts via the WS handler — see src/lib/env.ts.
import { createHash, createHmac, randomBytes } from 'node:crypto'
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
  return timingSafeEqualString(presented, expected)
}

export function hashAgentToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
