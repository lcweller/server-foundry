import Link from 'next/link'
import { SectionEyebrow } from './section-eyebrow'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ember glow at the bottom edge of the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgba(255,91,20,0.18),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-32 sm:pt-32 sm:pb-40">
        <SectionEyebrow number="01" label="Now in pre-launch" />

        <h1 className="mt-8 font-serif text-[3rem] leading-[1.05] tracking-tight text-text sm:text-7xl md:text-8xl">
          <span className="block italic">Forge</span>
          <span className="block">your world.</span>
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
          Run multiplayer game servers on hardware you already own. One command, then you’re online.
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <Link
            href="#waitlist"
            className="inline-flex h-12 items-center justify-center rounded-md bg-ember px-6 text-sm font-medium text-background transition-colors hover:bg-ember-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get on the waitlist
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center text-sm text-text-muted hover:text-text transition-colors"
          >
            How it works
            <span className="ml-2" aria-hidden="true">
              ↓
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
