import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Log in',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <LoginForm
      footer={
        <p>
          New here?{' '}
          <Link href="/signup" className="text-ember hover:text-ember-soft transition-colors">
            Create an account
          </Link>
        </p>
      }
    />
  )
}
