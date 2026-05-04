// Reachable from server.ts via the auth → email-sender chain — see
// src/lib/env.ts on the `server-only` omission rationale.
import { env } from '@/lib/env'
import { Resend } from 'resend'

export const resend = new Resend(env.RESEND_API_KEY)

export const FROM_EMAIL = env.RESEND_FROM_EMAIL
