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
Lives in the sibling repo `server-foundry-agent`. Phases 4–11 are
shipped (heartbeats, deploy/start/stop, logs, terminal, backups,
self-update, security hardening).

### Stack
- Node.js 22 + tsx (no esbuild bundle yet — runs source directly)
- WebSocket client (`ws`)
- `node-pty` for remote terminal sessions
- `systeminformation` for vitals collection
- `aws4fetch` for S3-compatible backup destinations
- Per-host SteamCMD for game installs

### Responsibilities
- Connect outbound to platform via WebSocket (no inbound ports needed on user's network)
- Send heartbeat every 3 seconds with system vitals
- Receive deployment commands and manage game server units via
  systemd (Phase 11) — see "Game-server process model" below
- Stream logs back to platform from journald
- Provide a tunneled remote shell on demand
- Self-update when platform publishes a new agent version

### Game-server process model (Phase 11)
The agent does NOT spawn game servers as child processes. Each
deployed server runs as a systemd-managed unit:

```
foundry-<gameSlug>@<slotId>.service
  ├── User=foundry-srv-<slotId>          ← unique per server
  ├── Group=foundry-srv-<slotId>
  ├── AppArmorProfile=foundry-<gameSlug> ← MAC confinement
  ├── ExecStart=/usr/local/bin/foundry-launch <slotId>
  └── EnvironmentFile=/etc/foundry/servers/<slotId>.env
```

`<slotId>` is the first 16 hex chars of the serverId UUID (full
UUID would overflow Linux's 32-char username limit).

The agent itself is unprivileged (`User=foundry`, never root).
Privileged operations bridge to root via two paths:
1. **systemctl + polkit**: `/etc/polkit-1/rules.d/49-foundry-server.rules`
   allow-lists the foundry user to manage `foundry-*-game-template@*`
   and `foundry-srv-{provision,deprovision}@*` units. No sudo.
2. **Privilege-bridge oneshot units**: `foundry-srv-provision@<slotId>`
   and `foundry-srv-deprovision@<slotId>` run a strict-input-validating
   helper (`/usr/local/sbin/foundry-server-userctl`) as root to
   `useradd`, `chown`, `mkdir` per-server resources.

Logs flow uniformly through journald: the agent follows
`journalctl -fu` for each game-server unit AND for its own
`foundry-agent.service`, then forwards lines as `log` messages
over the WebSocket. Phase 6's SSE feed reads from a single coherent
stream regardless of source.

See `docs/security.md` for the full hardening posture (sysctl,
nftables, AppArmor profiles, systemd directives).

### Connection flow
1. User generates a pairing code on dashboard (8 chars, format `XXXX-XXXX`, 15-min expiry)
2. User runs `curl https://serverfoundry.gg/install.sh | bash` on their Linux host with `FOUNDRY_PAIR=XXXX-XXXX` env var
3. Install script provisions the host: pkg deps (Node 22, AppArmor,
   polkit, nftables), foundry user, AppArmor profiles, per-game
   systemd templates, polkit rule, sysctl hardening, nftables
   firewall — all installed before the agent starts
4. Agent connects to `wss://serverfoundry.gg/ws/agent` with pairing code
5. Platform validates code, issues long-lived agent token (HMAC-signed), agent stores it in `/etc/foundry/credentials`
6. Agent reconnects with token after this; pairing code is single-use and expires

## Component 3: GameServerOS

### Status
Lives in the sibling repo
[`server-foundry-os`](https://github.com/serverfoundry/server-foundry-os).
Phase 13 v1 shipped — see that repo's `docs/architecture.md` for the
full boot/install/pair flow diagram.

### What it is
A custom Debian 12-based bootable ISO that comes with the agent
pre-installed and a first-boot TUI installer. Users can boot a spare
PC from this ISO, walk through six whiptail dialogs (welcome → disk
→ network → pairing → summary → install), enter a pairing code, and
have a fully managed game server host without ever opening a Linux
shell.

### Stack
- Debian 12 (bookworm) base via `live-build`
- Hybrid ISO — boots in both UEFI and legacy BIOS firmware modes
- GPT layout: 1 MB BIOS-boot + 512 MB FAT32 ESP + 4 GB swap + ext4 root
- Phase 11 hardening pre-applied: sysctl, nftables, AppArmor profiles
  for the four game profiles authored so far, polkit-scoped systemd
  unit management, per-game-server static users via privilege-bridge
  oneshot units. **All baked into the squashfs at build time** —
  `install.sh`'s runtime steps translated into `live-build` chroot
  hooks.
- Agent pre-baked at the SHA pinned in the OS repo's `versions.env`,
  refreshed automatically on every agent tag via cross-repo
  `repository_dispatch`.
- Whiptail TUI installer authored in this repo at
  `/usr/local/sbin/foundry-installer`.
- First-boot pairing on tty1 with explicit failure UX (distinct error
  per failure mode, recovery loop on tty1, `sudo foundry-pair <CODE>`
  for later re-pair).

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
