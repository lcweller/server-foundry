import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      footer={
        <p>
          Remembered it?{' '}
          <Link href="/login" className="text-ember hover:text-ember-soft transition-colors">
            Back to log in
          </Link>
        </p>
      }
    />
  )
}
