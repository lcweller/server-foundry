// Reachable from server.ts via auth/index.ts (Better Auth wires this
// into the password-reset callback) — see src/lib/env.ts on the
// `server-only` omission rationale.
import { logger } from '@/lib/logger'
import { render } from '@react-email/components'
import PasswordReset from '../../../emails/PasswordReset'
import { FROM_EMAIL, resend } from './client'

type Args = { to: string; name: string; url: string }

export async function sendPasswordReset({ to, name, url }: Args) {
  const html = await render(PasswordReset({ name, resetUrl: url }))
  const text = await render(PasswordReset({ name, resetUrl: url }), { plainText: true })

  const result = await resend.emails.send({
    from: `Server Foundry <${FROM_EMAIL}>`,
    to,
    subject: 'Reset your Server Foundry password',
    html,
    text,
  })

  if (result.error) {
    logger.warn({ err: result.error }, 'password reset email send failed')
    throw new Error(result.error.message ?? 'Email send failed')
  }
  return result.data
}
