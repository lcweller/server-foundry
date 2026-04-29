import { SectionEyebrow } from './section-eyebrow'

const points = [
  {
    label: 'Your hardware, your root',
    body: 'A home PC, a spare server, a rented box — anything Linux. The agent runs as a service, the platform never gets shell access without your say-so.',
  },
  {
    label: 'One command to enroll',
    body: 'Generate a pairing code, paste a curl line, done. No port forwarding, no firewall rules, no static IPs.',
  },
  {
    label: 'One dashboard for everything',
    body: 'Live vitals, deployments, logs, backups. Manage every host and every server from one screen, then close the laptop and play.',
  },
] as const

export function Solution() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <SectionEyebrow number="03" label="What we built" />

        <p className="mt-6 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl md:text-5xl">
          We built the third path.
        </p>

        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-text-muted">
          Server Foundry runs on hardware you already own. You keep ownership and root access. We
          handle the deployment, monitoring, and updates.
        </p>

        <ul className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {points.map((point) => (
            <li key={point.label} className="space-y-3">
              <p className="text-sm font-medium text-text">{point.label}</p>
              <p className="text-sm leading-relaxed text-text-muted">{point.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
