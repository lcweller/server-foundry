// AES-256-GCM envelope crypto for at-rest secrets (currently used for
// per-server S3 backup credentials).
//
// Keying: BACKUP_ENCRYPTION_KEY is a 64-char hex string (32 random
// bytes encoded). Each call uses a fresh 12-byte nonce; output is
// versioned so we can rotate the algorithm later without ambiguity.
//
//   stored = "v1:" + base64(nonce || ciphertext || authTag)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

const ALGO = 'aes-256-gcm'
const VERSION_PREFIX = 'v1:'
const NONCE_BYTES = 12
const TAG_BYTES = 16

function loadKey(): Buffer {
  const raw = env.BACKUP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to .env.',
    )
  }
  if (raw.length !== 64 || !/^[0-9a-f]+$/i.test(raw)) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hex chars (32 bytes).')
  }
  return Buffer.from(raw, 'hex')
}

export function isCryptoConfigured(): boolean {
  return Boolean(env.BACKUP_ENCRYPTION_KEY)
}

export function encryptJson(value: unknown): string {
  const key = loadKey()
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGO, key, nonce)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return VERSION_PREFIX + Buffer.concat([nonce, encrypted, tag]).toString('base64')
}

export function decryptJson<T = unknown>(blob: string): T {
  if (!blob.startsWith(VERSION_PREFIX)) {
    throw new Error('Unrecognised ciphertext version.')
  }
  const key = loadKey()
  const buf = Buffer.from(blob.slice(VERSION_PREFIX.length), 'base64')
  if (buf.length < NONCE_BYTES + TAG_BYTES + 1) {
    throw new Error('Ciphertext too short.')
  }
  const nonce = buf.subarray(0, NONCE_BYTES)
  const tag = buf.subarray(buf.length - TAG_BYTES)
  const ciphertext = buf.subarray(NONCE_BYTES, buf.length - TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key, nonce)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8')) as T
}
