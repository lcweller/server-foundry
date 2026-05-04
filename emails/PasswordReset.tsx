import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type Props = {
  name: string
  resetUrl: string
}

export default function PasswordReset({ name, resetUrl }: Props) {
  const greeting = name?.trim() ? `${name},` : 'Hello,'
  return (
    <Html>
      <Head />
      <Preview>Reset your Server Foundry password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Reset your password</Heading>
          <Text style={paragraph}>{greeting}</Text>
          <Text style={paragraph}>
            We got a request to reset the password on your Server Foundry account. Click below to
            choose a new one. The link expires in 15 minutes.
          </Text>
          <Section style={buttonContainer}>
            <Button href={resetUrl} style={button}>
              Reset password
            </Button>
          </Section>
          <Text style={paragraph}>
            Or paste this into your browser:
            <br />
            <span style={muted}>{resetUrl}</span>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn’t request a reset, you can safely ignore this email — your password won’t
            change.
            <br />
            Server Foundry · serversfoundry.app
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

PasswordReset.PreviewProps = {
  name: 'Test',
  resetUrl: 'https://serversfoundry.app/reset-password?token=preview',
} satisfies Props

const body = {
  backgroundColor: '#fafafa',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
}
const container = { margin: '0 auto', padding: '40px 24px', maxWidth: '560px' }
const heading = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#0a0a0a',
  letterSpacing: '-0.01em',
  margin: '0 0 24px',
}
const paragraph = { fontSize: '16px', lineHeight: '24px', color: '#3f3f46', margin: '0 0 16px' }
const muted = { fontSize: '13px', color: '#71717a', wordBreak: 'break-all' as const }
const buttonContainer = { margin: '32px 0' }
const button = {
  backgroundColor: '#0a0a0a',
  color: '#fafafa',
  fontSize: '15px',
  fontWeight: '500',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
}
const hr = { border: 'none', borderTop: '1px solid #e4e4e7', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#71717a', lineHeight: '20px', margin: 0 }
