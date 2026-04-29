import { SectionEyebrow } from './section-eyebrow'
import { WaitlistForm } from './waitlist-form'

export function Waitlist() {
  return (
    <section id="waitlist" className="border-t border-border bg-surface/40 scroll-mt-20">
      <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <SectionEyebrow number="06" label="Be first" />

        <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl md:text-5xl">
          Be first to forge.
        </h2>

        <p className="mt-6 text-lg leading-relaxed text-text-muted">
          We’ll email you when the dashboard opens. No marketing, no list rentals, ever.
        </p>

        <div className="mt-10">
          <WaitlistForm />
        </div>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Your email · One confirmation · Never resold
        </p>
      </div>
    </section>
  )
}
