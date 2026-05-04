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

type WaitlistConfirmationProps = {
  confirmationUrl: string
}

export default function WaitlistConfirmation({ confirmationUrl }: WaitlistConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your spot on the Server Foundry waitlist</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Server Foundry</Heading>
          <Text style={paragraph}>
            Thanks for signing up. One quick step — confirm your email to lock in your spot.
          </Text>
          <Section style={buttonContainer}>
            <Button href={confirmationUrl} style={button}>
              Confirm my spot
            </Button>
          </Section>
          <Text style={paragraph}>
            Or paste this link into your browser:
            <br />
            <span style={muted}>{confirmationUrl}</span>
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't sign up, you can ignore this email.
            <br />
            Server Foundry · serversfoundry.app
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

WaitlistConfirmation.PreviewProps = {
  confirmationUrl: 'https://serversfoundry.app/waitlist/confirm?token=preview-token',
} satisfies WaitlistConfirmationProps

const body = {
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
  fontSize: '24px',
  fontWeight: '600',
  color: '#0a0a0a',
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

const buttonContainer = {
  margin: '32px 0',
}

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
