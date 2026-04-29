import { Footer } from '@/components/marketing/footer'
import { Nav } from '@/components/marketing/nav'
import { confirmWaitlist } from '@/server/actions/waitlist'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Confirm your spot',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function ConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams
  const result = await confirmWaitlist(token ?? '')

  return (
    <>
      <Nav />
      <main className="flex flex-1 items-center justify-center px-6 py-32">
        <div className="max-w-xl text-center">
          {result.ok ? (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Confirmed</p>
              <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-text sm:text-5xl">
                You’re in.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-text-muted">
                We’ll email you when the dashboard opens. In the meantime, watch the build come
                together.
              </p>
              <Link
                href="/"
                className="mt-10 inline-flex items-center font-mono text-xs uppercase tracking-[0.18em] text-text-muted hover:text-text transition-colors"
              >
                ← Back to home
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-danger">
                Couldn’t confirm
              </p>
              <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-text sm:text-5xl">
                {result.error}
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-text-muted">
                The link may have expired or already been used. Sign up again from the home page and
                we’ll send a fresh confirmation.
              </p>
              <Link
                href="/#waitlist"
                className="mt-10 inline-flex h-12 items-center justify-center rounded-md bg-ember px-6 text-sm font-medium text-background transition-colors hover:bg-ember-soft"
              >
                Try again
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
