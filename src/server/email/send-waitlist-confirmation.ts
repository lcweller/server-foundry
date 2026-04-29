import 'server-only'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { render } from '@react-email/components'
import WaitlistConfirmation from '../../../emails/WaitlistConfirmation'
import { FROM_EMAIL, resend } from './client'

type SendArgs = {
  to: string
  confirmationUrl: string
}

export async function sendWaitlistConfirmation({ to, confirmationUrl }: SendArgs) {
  const html = await render(WaitlistConfirmation({ confirmationUrl }))
  const text = await render(WaitlistConfirmation({ confirmationUrl }), { plainText: true })

  const result = await resend.emails.send({
    from: `Server Foundry <${FROM_EMAIL}>`,
    to,
    subject: 'Confirm your spot on the Server Foundry waitlist',
    html,
    text,
    replyTo: env.RESEND_FROM_EMAIL,
  })

  if (result.error) {
    logger.warn({ err: result.error }, 'waitlist confirmation email failed')
    throw new Error(result.error.message ?? 'Email send failed')
  }

  return result.data
}
