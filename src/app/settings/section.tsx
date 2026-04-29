import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:gap-12">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-text">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
