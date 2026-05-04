import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type NotificationEmailProps = {
  name: string | null
  severity: 'info' | 'warning' | 'error'
  title: string
  body: string | null
  dashboardUrl: string
}

export default function NotificationEmail({
  name,
  severity,
  title,
  body,
  dashboardUrl,
}: NotificationEmailProps) {
  const accent = severity === 'error' ? '#b91c1c' : severity === 'warning' ? '#b45309' : '#0a0a0a'
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,'
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Heading style={{ ...heading, color: accent }}>Server Foundry</Heading>
          <Text style={paragraph}>{greeting}</Text>
          <Text style={{ ...paragraph, fontWeight: 600, color: accent }}>{title}</Text>
          {body ? <Text style={paragraph}>{body}</Text> : null}
          <Section style={section}>
            <Text style={paragraph}>
              Open the dashboard:
              <br />
              <span style={muted}>{dashboardUrl}</span>
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            You're getting this because you opted in to email notifications for this event type.
            Manage preferences in your account settings.
            <br />
            Server Foundry · serversfoundry.app
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

NotificationEmail.PreviewProps = {
  name: 'Alex',
  severity: 'warning',
  title: 'home-server.lan went offline',
  body: null,
  dashboardUrl: 'https://serversfoundry.app/dashboard',
} satisfies NotificationEmailProps

const bodyStyle = {
  backgroundColor: '#fafafa',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '560px',
}

const heading = {
  fontSize: '20px',
  fontWeight: '600',
  letterSpacing: '-0.01em',
  margin: '0 0 24px',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 16px',
}

const muted = {
  fontSize: '13px',
  color: '#71717a',
  wordBreak: 'break-all' as const,
}

const section = {
  margin: '24px 0',
}

const hr = {
  border: 'none',
  borderTop: '1px solid #e4e4e7',
  margin: '32px 0',
}

const footer = {
  fontSize: '13px',
  color: '#71717a',
  lineHeight: '20px',
  margin: 0,
}
