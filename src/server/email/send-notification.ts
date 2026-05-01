import 'server-only'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { render } from '@react-email/components'
import NotificationEmail from '../../../emails/Notification'
import { FROM_EMAIL, resend } from './client'

type SendArgs = {
  to: string
  name: string | null
  severity: 'info' | 'warning' | 'error'
  title: string
  body: string | null
}

export async function sendNotificationEmail({ to, name, severity, title, body }: SendArgs) {
  const dashboardUrl = `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/dashboard`
  const props = { name, severity, title, body, dashboardUrl }

  const html = await render(NotificationEmail(props))
  const text = await render(NotificationEmail(props), { plainText: true })

  const subject = severity === 'error' ? `[!] ${title}` : title

  const result = await resend.emails.send({
    from: `Server Foundry <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
    replyTo: env.RESEND_FROM_EMAIL,
  })

  if (result.error) {
    logger.warn({ err: result.error, to }, 'notification email failed')
    throw new Error(result.error.message ?? 'Email send failed')
  }

  return result.data
}
