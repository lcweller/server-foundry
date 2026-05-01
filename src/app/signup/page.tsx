import type { Metadata } from 'next'
import Link from 'next/link'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Sign up',
  robots: { index: false, follow: false },
}

export default function SignupPage() {
  return (
    <SignupForm
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:text-accent-soft transition-colors">
            Log in
          </Link>
        </p>
      }
    />
  )
}
