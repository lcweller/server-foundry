# Architecture

Server Foundry consists of three components that work together. Understanding how they communicate is essential before making changes to any of them.

## High-level diagram

```
                       Internet
                          │
                  Cloudflare Tunnel
                          │
              ┌───────────┴───────────┐
              │   Unraid Server       │
              │                       │
              │  ┌─────────────────┐  │
              │  │  Server Foundry │  │  ← Next.js app (this repo)
              │  │  (Docker)       │  │
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────┴────────┐  │
              │  │   Postgres      │  │
              │  │   (Docker)      │  │
              │  └─────────────────┘  │
              └───────────────────────┘
                          │
                          │ WebSocket
                          │ (outbound from agent)
                          ▼
              ┌───────────────────────┐
              │  User's Hardware      │
              │  ┌─────────────────┐  │
              │  │  Foundry Agent  │  │  ← Node.js binary (separate package)
              │  │  (Linux)        │  │
              │  └────────┬────────┘  │
              │           │           │
              │  ┌────────┴────────┐  │
              │  │  Game Servers   │  │  ← Valheim, CS2, MC, etc.
              │  │  (SteamCMD)     │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

## Component 1: Web platform (this repo)

### Stack
- Next.js 16 (App Router, React Server Components)
- React 19 (Server Actions, use() API)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- Drizzle ORM
- Postgres (containerized, separate)
- Better Auth (email + Google + GitHub + Discord)
- Resend (transactional email)
- WebSocket server (using `ws` package, integrated into Next.js custom server)
- Bun or Node 22 runtime

### Responsibilities
- Public-facing landing page with waitlist signup
- User authentication and account management
- Dashboard UI for managing hosts and game servers
- REST API + Server Actions for the dashboard
- WebSocket server for agent connections
- Database access (single tenant per user)
- Email delivery (welcome, notifications, alerts)

### Routing structure
- `/` — landing page (public)
- `/login`, `/signup` — auth
- `/dashboard/*` — authenticated app
- `/api/*` — REST endpoints (where Server Actions don't fit)
- `/ws/agent` — WebSocket endpoint for agents

### Deployment
- Built as a single Docker image via GitHub Actions
- Pushed to GitHub Container Registry (ghcr.io)
- Pulled and run on Unraid via the Docker tab
- Exposed publicly via Cloudflare Tunnel
- Postgres runs in a separate container on the same Unraid host

## Component 2: Foundry Agent

### Status
**Not part of this initial repo.** Will live in a separate repo (`server-foundry-agent`) and be built later. Documented here for context only.

### Stack
- Node.js 22 (or Bun) bundled via esbuild into a single binary
- WebSocket client (`ws`)
- `dockerode` for container management
- `node-pty` for remote terminal sessions
- `systeminformation` for vitals collection

### Responsibilities
- Connect outbound to platform via WebSocket (no inbound ports needed on user's network)
- Send heartbeat every 3 seconds with system vitals
- Receive deployment commands and manage game server processes
- Stream logs back to platform
- Provide a tunneled remote shell on demand
- Self-update when platform publishes a new agent version

### Connection flow
1. User generates a pairing code on dashboard (8 chars, format `XXXX-XXXX`, 15-min expiry)
2. User runs `curl https://serverfoundry.gg/install.sh | bash` on their Linux host with `FOUNDRY_PAIR=XXXX-XXXX` env var
3. Install script downloads agent binary, installs systemd service, starts it
4. Agent connects to `wss://serverfoundry.gg/ws/agent` with pairing code
5. Platform validates code, issues long-lived agent token (HMAC-signed), agent stores it in `/etc/foundry/credentials`
6. Agent reconnects with token after this; pairing code is single-use and expires

## Component 3: GameServerOS

### Status
**Not part of this initial repo or even the second one.** Phase 3 deliverable. Documented for context.

### What it is
A custom Debian 12-based bootable ISO that comes with the agent pre-installed and a first-boot TUI installer. Users can boot a spare PC from this ISO, walk through the installer, enter a pairing code, and have a fully managed game server host with no Linux experience needed.

### Stack
- Debian 12 base via `live-build`
- Hardened kernel parameters (sysctl)
- nftables firewall (default deny inbound except agent + SSH)
- AppArmor profiles for game server processes
- Agent pre-baked, auto-configures from pairing code at first boot
- Whiptail-based TUI installer

## Communication protocols

### User ↔ Platform
- HTTPS via Cloudflare Tunnel
- Server Actions for most mutations (preferred over REST)
- REST endpoints only where Server Actions don't fit (webhooks, public API, agent endpoints)
- WebSocket for live dashboard updates (subscribes to host metrics streams)

### Agent ↔ Platform
- WebSocket over WSS (TLS)
- All messages JSON, schema-validated with Zod on both sides
- Bidirectional: agent pushes telemetry/logs, platform pushes commands
- HMAC-signed messages using agent token
- See `docs/api.md` for full message protocol

### Dashboard ↔ Platform (real-time updates)
- Server-Sent Events (SSE) preferred for one-way streaming (host metrics, log tail)
- WebSocket only when bidirectional (terminal sessions)
- React Server Components for static dashboard data, suspended for streaming

## Why these architectural choices

**Why agent connects outbound (not platform inbound):**
- Users don't have to configure port forwarding or firewall rules
- Works behind NAT, behind corporate networks, behind everything
- Single TLS connection, easier to secure than exposing inbound services
- Same pattern used by Cloudflare Tunnel, Tailscale, ngrok — proven approach

**Why three separate components (not a monolith):**
- Web platform can be updated independently of agents in the field
- Agent is a small, single-purpose binary — easier to harden and audit
- GameServerOS can be developed and released on its own cadence
- Different language/runtime trade-offs per component

**Why Server Actions over REST for most things:**
- Type-safe end-to-end with TypeScript
- Co-located with the components that call them
- Less boilerplate than `fetch + handler + types`
- Built-in CSRF protection and progressive enhancement

**Why Postgres (not SQLite or NoSQL):**
- Strong relational integrity for user → host → server hierarchies
- JSONB for flexible config schemas without losing query power
- Mature ecosystem, easy to back up, easy to scale later if needed
- Containerized for portability

**Why self-hosted on Unraid (not Vercel):**
- User preference: already has the infrastructure
- Cost: $0 incremental vs Vercel's metered pricing
- Control: agent WebSocket connections need long-lived connections, which work better outside serverless
- Cloudflare Tunnel handles the public exposure cleanly

## Scaling considerations

For the launch and first hundreds of users, the Unraid setup is more than sufficient. When scale becomes a real concern, the migration paths are:

- Move Postgres to a managed service (Neon, Supabase, RDS) — Drizzle abstracts this
- Move web app to Vercel/Fly.io for horizontal scale — code stays the same, just change deployment target
- Add Redis for session/cache layer if needed
- Migrate WebSocket fleet to a dedicated service (PartyKit, Cloudflare Durable Objects) if connection count grows past Unraid's capacity

None of this is needed for v1. Document these paths so future-Claude knows they exist.
