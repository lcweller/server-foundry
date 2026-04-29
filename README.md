# Server Foundry

Self-hosted control plane for multiplayer game servers. Bring your hardware, deploy in minutes, manage everything from a single dashboard.

> Phase 0 — Foundation. The skeleton is up. The landing page comes next.

---

## What this is

Server Foundry is **not** a managed game server host. You bring the hardware — a home PC, a spare server, a rented VPS — and the platform handles the rest: agent install, deployment, monitoring, updates, backups.

The platform consists of three components, only one of which lives in this repo:

1. **Web platform** (this repo) — Next.js 16 dashboard, self-hosted on Unraid behind Cloudflare Tunnel.
2. **Foundry Agent** — Node binary that runs on your Linux host, connects out to the platform via WebSocket. (Separate repo, future.)
3. **GameServerOS** — custom Debian 12 ISO with the agent pre-installed. (Future.)

See [`docs/architecture.md`](./docs/architecture.md) for the full picture.

## Tech stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind 4 · shadcn/ui · Drizzle ORM · Postgres 16 · Better Auth · Resend · Biome · Vitest · Docker.

Full rationale and version pins in [`docs/tech-stack.md`](./docs/tech-stack.md).

## Quickstart

Requires Node 22+ (or Bun) and Docker.

```bash
# Install dependencies (Bun preferred for dev, npm fine)
bun install   # or: npm install

# Spin up Postgres locally
docker compose up -d postgres

# Configure environment
cp .env.example .env.local
# then fill in BETTER_AUTH_SECRET, RESEND_API_KEY, etc.

# Apply database migrations
bun run db:generate
bun run db:migrate

# Start the dev server
bun run dev   # → http://localhost:3000
```

## Quality gates

```bash
bun run lint        # Biome lint
bun run typecheck   # tsc --noEmit
bun run test        # Vitest
bun run build       # Next.js production build
```

All four must pass before commit. CI enforces this on every PR.

## Project layout

```
src/
├── app/                    # Next.js App Router (pages + route handlers)
├── components/             # React components (server + client)
├── lib/                    # Utilities, env, logger
└── server/
    ├── actions/            # Server Actions
    ├── auth/               # Better Auth config
    ├── db/                 # Drizzle schema + client
    └── email/              # Resend client + helpers
emails/                     # React Email templates
drizzle/migrations/         # Generated SQL migrations
docs/                       # Architecture, conventions, security, etc.
```

## Documentation

The full doc set is in [`docs/`](./docs/). Start with [`CLAUDE.md`](./CLAUDE.md) for an overview of the rules, then read the doc that matches your task.

| Doc | When to read |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | Before touching the system topology |
| [`docs/tech-stack.md`](./docs/tech-stack.md) | Before adding or upgrading dependencies |
| [`docs/data-model.md`](./docs/data-model.md) | Before changing the schema |
| [`docs/api.md`](./docs/api.md) | Before adding endpoints or actions |
| [`docs/security.md`](./docs/security.md) | Before touching auth, secrets, or user data |
| [`docs/conventions.md`](./docs/conventions.md) | When unsure how to structure code |
| [`docs/roadmap.md`](./docs/roadmap.md) | To understand what's built and what's next |
| [`docs/branding.md`](./docs/branding.md) | Before writing any user-facing copy |
| [`docs/deployment.md`](./docs/deployment.md) | Before touching CI, Docker, or Unraid setup |

## License

To be decided before public release.
