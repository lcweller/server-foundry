import { SectionEyebrow } from './section-eyebrow'

const games = [
  { name: 'Valheim', genre: 'Survival co-op' },
  { name: 'Minecraft', genre: 'Sandbox · Java' },
  { name: 'Counter-Strike 2', genre: 'Tactical shooter' },
  { name: 'Rust', genre: 'Survival PvP' },
  { name: 'ARK', genre: 'Survival sandbox' },
  { name: 'Terraria', genre: '2D sandbox' },
  { name: 'Project Zomboid', genre: 'Survival sim' },
  { name: '7 Days to Die', genre: 'Survival horror' },
] as const

export function SupportedGames() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <SectionEyebrow number="05" label="Games" />

        <h2 className="mt-6 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl md:text-5xl">
          Eight games at launch.
        </h2>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-muted">
          More land based on what you ask for. Tell us what you’re running on the waitlist.
        </p>

        <ul
          className="mt-16 grid grid-cols-2 gap-px bg-border sm:grid-cols-4"
          aria-label="Supported games at launch"
        >
          {games.map((game) => (
            <li
              key={game.name}
              className="group bg-background p-6 transition-colors hover:bg-surface"
            >
              <p className="font-serif text-2xl tracking-tight text-text-muted transition-colors group-hover:text-text">
                {game.name}
              </p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-faint transition-colors group-hover:text-ember">
                {game.genre}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
