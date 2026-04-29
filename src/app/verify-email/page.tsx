import { AuthShell } from '@/components/auth/auth-shell'
import type { Metadata } from 'next'
import { ResendVerifyButton } from './resend-verify-button'

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams
  return (
    <AuthShell
      eyebrow="Confirm email"
      title="Check your inbox."
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Click it to finish setting up your account.`
          : 'We sent you a confirmation link. Click it to finish setting up your account.'
      }
    >
      <p className="text-sm text-text-muted">
        The link expires in 1 hour. If you don’t see it, check your spam folder, or resend it below.
      </p>

      {email ? <ResendVerifyButton email={email} /> : null}
    </AuthShell>
  )
}
