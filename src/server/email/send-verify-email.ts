// Reachable from server.ts via auth/index.ts (Better Auth wires this
// into the email-verification + change-email callbacks) — see
// src/lib/env.ts on the `server-only` omission rationale.
import { logger } from '@/lib/logger'
import { render } from '@react-email/components'
import VerifyEmail from '../../../emails/VerifyEmail'
import { FROM_EMAIL, resend } from './client'

type Args = { to: string; name: string; url: string }

export async function sendVerifyEmail({ to, name, url }: Args) {
  const html = await render(VerifyEmail({ name, verifyUrl: url }))
  const text = await render(VerifyEmail({ name, verifyUrl: url }), { plainText: true })

  const result = await resend.emails.send({
    from: `Server Foundry <${FROM_EMAIL}>`,
    to,
    subject: 'Confirm your Server Foundry email',
    html,
    text,
  })

  if (result.error) {
    logger.warn({ err: result.error }, 'verify email send failed')
    throw new Error(result.error.message ?? 'Email send failed')
  }
  return result.data
}
