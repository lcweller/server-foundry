import { Footer } from '@/components/marketing/footer'
import { Nav } from '@/components/marketing/nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms of service for Server Foundry.',
}

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col">
        <article className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            <span className="text-ember">T</span>
            <span className="mx-2 text-text-faint">·</span>
            <span>Terms</span>
          </p>
          <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight text-text sm:text-5xl">
            Terms.
          </h1>
          <p className="mt-8 text-base leading-relaxed text-text-muted">
            This is a placeholder. Before launch we will publish real terms of service covering
            account responsibilities, acceptable use of the platform, the responsibilities you
            retain over your own hardware, and what we will and will not be liable for.
          </p>
        </article>
      </main>
      <Footer />
    </>
  )
}
