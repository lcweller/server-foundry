import { SectionEyebrow } from './section-eyebrow'

export function Problem() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <SectionEyebrow number="02" label="Why" />

        <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl md:text-5xl">
          Hosting is broken in two directions.
        </h2>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 sm:gap-16">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
              Managed hosts
            </p>
            <p className="text-lg leading-relaxed text-text-muted">
              Charge a premium for a panel you’ll never fully control. Cancel and your worlds go
              with them.
            </p>
          </div>
          <div className="space-y-4 sm:border-l sm:border-border sm:pl-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
              Doing it yourself
            </p>
            <p className="text-lg leading-relaxed text-text-muted">
              Free if your time is free. An afternoon of Linux config every time you want a new
              server.
            </p>
          </div>
        </div>

        <p className="mt-16 text-lg text-text-muted">There’s a third path.</p>
      </div>
    </section>
  )
}
