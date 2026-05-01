# Branding

The name, voice, and visual identity guide for Server Foundry. This doc gets updated as branding decisions are made.

## Name

**Server Foundry** (locked in)

The "foundry" metaphor: a place where things are forged, crafted, built with care. Game servers as worlds you cast and shape, not boxes you rent.

Domain: `serverfoundry.gg` (preferred — `.gg` reads as gaming-native and modern)
Fallback: `serverfoundry.com`, `serverfoundry.io`

## Tagline

To be decided. Working candidates (in order of current preference):

1. "Forge your world." — short, evocative, on-metaphor
2. "Game servers, forged for you." — slightly more literal
3. "Host the worlds you love." — emotional, less branded

## Voice

### Personality
- Confident, not cocky
- Technical, not jargon-heavy
- Warm, not cutesy
- Premium, not enterprise

### Tone variations
- **Marketing copy**: bold, evocative, short sentences
- **In-app copy**: clear, direct, second-person ("Your hosts", "You'll need...")
- **Error messages**: human, helpful, never blame the user
- **Emails**: friendly but professional, signed from the product (not a fake person)

### Words to use
forge, host, deploy, world, server, control, command, your, owned

### Words to avoid
gamer-bro slang ("epic", "sick", "GG"), enterprise-speak ("synergy", "leverage", "stakeholders"), cliches ("game-changing", "next-gen", "revolutionary")

### Examples

**Hero headline (good)**: "Forge your world. Run your servers."
**Hero headline (bad)**: "Next-gen game server hosting platform for the modern gamer"

**Empty state (good)**: "No servers yet. Let's get you connected."
**Empty state (bad)**: "You haven't created any resources. Click the button to start."

**Error (good)**: "We couldn't reach your host. It might be offline — check the agent status."
**Error (bad)**: "Error 500: Internal Server Error. Please try again later."

## Visual identity

### Status: locked (split register)

Two registers ship today, split by surface:

- **Forge Heat** — warm dark stone, ember (#ff5b14) accent. Used on
  the marketing landing page (`/`, `/privacy`, `/terms`,
  `/waitlist/confirm`) and any other pre-account surface. Inviting,
  promotional, feels like a brand more than a tool.
- **Cinematic Operations** — cool charcoal, lime (#a3ff3c) accent.
  Used everywhere behind the auth wall: `/dashboard/*`, `/settings`,
  and all auth pages (`/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `/verify-email`). Cinematic, operational, dense.

Same Tailwind utility names (`bg-background`, `text-text`,
`bg-accent`, etc.) resolve to different values via a
`[data-surface="ops"]` attribute on `<AppShell>` and `<AuthShell>`
roots. See `src/app/globals.css`.

### What we know we want (still)
- Premium feel — bar is Linear, Vercel, Framer, Arc
- Distinct from generic dark-mode-emerald-green SaaS dashboards
- Different feel on landing page vs dashboard — Forge Heat invites,
  Cinematic Operations operates. The split below makes that real.

### What we know we don't want (still)
- Cartoonish gaming aesthetics (pixel art, chunky 80s, RGB rainbow)
- Generic SaaS dashboard with rounded cards and emerald accents
- Tech-bro neon cyberpunk
- Overly serious enterprise tones (gray-blue-corporate)

## Logo

Not designed yet. Brief for the eventual designer (or design AI):

- The "foundry" concept — could be molten metal, sparks, an anvil, a forge mark, abstract geometric foundry imagery
- Wordmark or combined mark (logo + wordmark together)
- Should work as small favicon (16px)
- Should work in monochrome (one-color print)
- Distinctive enough to be recognizable without text

## Color palette

Locked. Two registers, same Tailwind utility names, different values
under `[data-surface="ops"]`. Source of truth: `src/app/globals.css`.

### Forge Heat (marketing default)

| Role | Token | Value |
|---|---|---|
| Background | `--color-background` | `#0e0d0c` |
| Surface | `--color-surface` | `#16140f` |
| Surface elevated | `--color-surface-elevated` | `#1f1b14` |
| Border | `--color-border` | `#2a251d` |
| Border strong | `--color-border-strong` | `#3a3328` |
| Text | `--color-text` | `#f5f1e8` |
| Text muted | `--color-text-muted` | `#8a8278` |
| Text faint | `--color-text-faint` | `#5c564e` |
| Ember (accent) | `--color-ember` | `#ff5b14` |
| Ember soft | `--color-ember-soft` | `#ff7f3c` |
| Brass | `--color-brass` | `#d4af6a` |
| Success | `--color-success` | `#5ba770` |
| Warning | `--color-warning` | `#e5a645` |
| Danger | `--color-danger` | `#d9594c` |

`--color-accent` aliases ember at this register; `--color-info`
aliases brass.

### Cinematic Operations (dashboard, auth, settings)

| Role | Token | Value |
|---|---|---|
| Background | `--color-background` | `#0a0a0c` |
| Surface | `--color-surface` | `#12131a` |
| Surface elevated | `--color-surface-elevated` | `#1a1c26` |
| Border | `--color-border` | `#252836` |
| Border strong | `--color-border-strong` | `#3a3f54` |
| Text | `--color-text` | `#e6e8f0` |
| Text muted | `--color-text-muted` | `#7a8092` |
| Text faint | `--color-text-faint` | `#4a4f60` |
| Accent (lime) | `--color-accent` | `#a3ff3c` |
| Accent soft | `--color-accent-soft` | `#c8ff85` |
| Info | `--color-info` | `#7ab8ff` |
| Warning | `--color-warning` | `#f5c451` |
| Danger | `--color-danger` | `#ff5a52` |

**"Alive == accent"** — `--color-success` collapses to `--color-accent`
at this register. There is no separate green for success; lime IS
the operational "running / healthy" colour. Status pips that show
in-flight/transient states (deploying, updating, connecting) use
info or warning, never accent — those animate with `animate-pulse`.

### Ambient glow

Every surface under `[data-surface="ops"]` gets a fixed-position
radial-gradient pseudo-element pinned to the viewport: lime + cool-
blue, sub-5% opacity, never moves on scroll. Provides depth without
becoming wallpaper. Defined in `globals.css`.

### Contrast

All AA at body text size. text-faint (`#4a4f60`) on background fails
AA at 2.5:1 — by design, only used for decorative eyebrows and
de-emphasised labels, never paragraph text.

## Typography

Locked. Same fonts shipped today, used differently per register.

| Family | Token | Where |
|---|---|---|
| Geist Sans | `--font-sans` | All body, all UI labels, dashboard headlines |
| Geist Mono | `--font-mono` | Technical data only — callsigns, IPs, ports, byte counts, log lines, IDs, timestamps |
| Instrument Serif | `--font-serif` | Marketing landing hero + section headlines ONLY. NOT used in dashboard or auth — Cinematic Operations is operational, not dramatic. |

The serif moment lives entirely on Forge Heat surfaces. Anything
behind `[data-surface="ops"]` is sans-only — there are no `font-serif`
class references in dashboard, auth, or settings code today.

## Sound and motion

### Sound
None planned. Add only if it serves the product (e.g., subtle chime on critical alert).

### Motion
Use sparingly. Reference Arc Browser's "considered, not constant" approach.
- Page transitions: minimal, fast
- Status changes: a brief animation (server starts → green pulse, server crashes → red flash)
- Hover states: 150ms ease

## Audience profile

### Primary: Gamers with hosts
- Age 18-40
- Plays at least one of our supported games regularly
- Hosts (or has tried to host) for friends
- Comfortable with `curl | bash` but not interested in becoming a sysadmin
- Cares about ownership, control, and not paying recurring subscriptions

### Secondary: Discord community admins
- Manages a server / community of 50-500 people
- Wants reliable hosting without the upcharge of managed services
- Often tech-adjacent (dev, IT, etc.) but not always

### Both share:
- Visual taste — appreciates good design but isn't precious about it
- Distrust of "gamer marketing" (RGB everything, "epic" buzzwords)
- Wants the product to feel premium AND playful

## Positioning

### One-line description
"Server Foundry is a self-hosted control plane for multiplayer game servers. Bring your hardware, deploy in minutes, manage everything from a single dashboard."

### Comparison to competitors

| | Server Foundry | Traditional hosts (Nitrado, GTXGaming) | DIY (raw VPS + manual install) |
|---|---|---|---|
| Cost | Hardware + Domain | $10-50/month per server | Low if you have a VPS |
| Setup | Single command | Web form, immediate | Hours of Linux config |
| Control | Full root + dashboard | Limited admin panel | Full root |
| Ownership | Yours, on your hardware | Theirs, leased to you | Yours |
| Updates | One-click | Often manual or auto | You manage |
| Hardware | Use what you have | Their boxes | Bring your own |

### Why this matters
The market is bifurcated: managed hosts charge a premium for convenience, DIY is free but painful. Server Foundry collapses that gap — keep ownership and cost control, gain the convenience.

## Branding that gets revisited later

These decisions can wait until we have the design exercise complete:

- Final logo
- Final color palette
- Final typography pairing
- Brand guidelines document (logo usage, spacing, no-no's)
- Social media identity (avatar, banner, Twitter handle, Discord branding)
- Email signature templates
- Press kit (when applicable)
