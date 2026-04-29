import { Footer } from '@/components/marketing/footer'
import { Nav } from '@/components/marketing/nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Server Foundry handles your data.',
}

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col">
        <article className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-32">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
            <span className="text-ember">P</span>
            <span className="mx-2 text-text-faint">·</span>
            <span>Privacy</span>
          </p>
          <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight text-text sm:text-5xl">
            Privacy.
          </h1>
          <p className="mt-8 text-base leading-relaxed text-text-muted">
            This is a placeholder. Before launch we will publish a real privacy policy covering what
            data we collect, how we use it, who we share it with (Resend for email; Cloudflare for
            hosting; nobody else), how long we retain it, and how to request deletion.
          </p>
          <p className="mt-6 text-base leading-relaxed text-text-muted">
            For now: we collect your email when you join the waitlist and we use it once to send a
            confirmation. We do not sell or rent it. We use Cloudflare Web Analytics, which is
            cookieless.
          </p>
        </article>
      </main>
      <Footer />
    </>
  )
}
