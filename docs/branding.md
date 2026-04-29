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

### Status: not yet locked

The landing page design exercise (Claude Design or another design pass) will produce 2-3 directions. Once one is chosen, document the system here.

### What we know we want
- Premium feel — bar is Linear, Vercel, Framer, Arc
- Distinct from generic dark-mode-emerald-green SaaS dashboards (we tried, it's everywhere)
- Should feel different on landing page vs dashboard — dashboard can be more cinematic/operational, landing page more inviting/promotional
- Open to: serif typography, unexpected color palettes, motion, asymmetric layouts

### What we know we don't want
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

Not locked. Once chosen, document:
- Primary background
- Surface (cards, panels)
- Border
- Text primary
- Text muted
- Accent (the signature color — the "lime" or "emerald" or whatever we land on)
- Semantic: success, warning, danger, info

The previous prototyping leaned on emerald/lime (#10b981, #a3ff3c) but this is NOT locked in. The landing page exercise should explore alternatives:
- Warm: terracotta, amber, rust
- Cool: ice blue, cyan, electric purple
- Unexpected: cream + black, sepia, deep navy + gold

## Typography

Not locked. Reference points:
- **Inter** — modern sans, current default for tech UI
- **Geist** (Vercel's typeface) — refined sans
- **Instrument Serif** — for dramatic headline moments
- **Söhne / National 2** — premium feels (commercial)
- **JetBrains Mono / Geist Mono** — for technical/data text

Decision point: Does Server Foundry's typography lean modern-sans throughout, or use a serif moment somewhere (e.g., headlines on landing page, sans everywhere else)?

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
