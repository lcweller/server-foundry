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
  verifyUrl: string
}

export default function VerifyEmail({ name, verifyUrl }: Props) {
  const greeting = name?.trim() ? `Welcome, ${name}.` : 'Welcome.'
  return (
    <Html>
      <Head />
      <Preview>Confirm your email to finish setting up your Server Foundry account</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Server Foundry</Heading>
          <Text style={paragraph}>{greeting}</Text>
          <Text style={paragraph}>
            Confirm your email to finish setting up your account. The link expires in 1 hour.
          </Text>
          <Section style={buttonContainer}>
            <Button href={verifyUrl} style={button}>
              Confirm email
            </Button>
          </Section>
          <Text style={paragraph}>
            Or paste this into your browser:
            <br />
            <span style={muted}>{verifyUrl}</span>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn’t create this account, ignore this email.
            <br />
            Server Foundry · serverfoundry.gg
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

VerifyEmail.PreviewProps = {
  name: 'Test',
  verifyUrl: 'https://serverfoundry.gg/api/auth/verify-email?token=preview',
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
