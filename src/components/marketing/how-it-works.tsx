import { SectionEyebrow } from './section-eyebrow'

const steps = [
  {
    number: '01',
    title: 'Install the agent.',
    body: 'One command on any Linux host. The agent connects out to Server Foundry over a single TLS connection. No port forwarding, no firewall rules.',
  },
  {
    number: '02',
    title: 'Pick a game.',
    body: 'Choose from the catalog. Name your world, set your config, and Server Foundry handles the SteamCMD download and process supervision on your host.',
  },
  {
    number: '03',
    title: 'Play.',
    body: 'Your server is live. Watch the vitals, read the logs, and start, stop, or restart from anywhere. Then go play.',
  },
] as const

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <SectionEyebrow number="04" label="How" />

        <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl md:text-5xl">
          Three steps. No Linux degree required.
        </h2>

        <ol className="mt-16 space-y-16">
          {steps.map((step) => (
            <li key={step.number} className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-12">
              <p className="font-mono text-3xl text-ember">{step.number}</p>
              <div className="space-y-3">
                <p className="font-mono text-sm uppercase tracking-[0.15em] text-text">
                  {step.title}
                </p>
                <p className="max-w-2xl text-base leading-relaxed text-text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
