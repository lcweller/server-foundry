import { AuthShell } from '@/components/auth/auth-shell'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = {
  title: 'Set new password',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ token?: string; error?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams

  if (error || !token) {
    return (
      <AuthShell
        eyebrow="Reset password"
        title="This link is no longer valid."
        subtitle="Reset links expire in 15 minutes. Request a new one and try again."
        footer={
          <p>
            <Link
              href="/forgot-password"
              className="text-ember hover:text-ember-soft transition-colors"
            >
              Request a new reset link
            </Link>
          </p>
        }
      >
        <div />
      </AuthShell>
    )
  }

  return <ResetPasswordForm token={token} />
}
