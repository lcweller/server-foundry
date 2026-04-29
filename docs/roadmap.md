# Roadmap

Phased plan for building Server Foundry. Each phase produces a working, demo-able increment. Don't optimize or polish until the critical path of the current phase is solid.

## Phase 0: Foundation (1-2 days)

**Goal**: Empty repo → ready-to-build skeleton.

- [ ] Initialize Next.js 16 + TypeScript project
- [ ] Configure Tailwind 4
- [ ] Install and configure shadcn/ui
- [ ] Set up Drizzle ORM with Postgres
- [ ] Define the four schemas needed for Phase 1 + Phase 2 auth: `users`, `oauth_accounts`, `sessions`, `waitlist_signups` (only `waitlist_signups` is exercised in Phase 1 — the other three lie dormant until Phase 2)
- [ ] Configure Better Auth (email + OAuth providers — providers register conditionally on env-var presence)
- [ ] Set up Resend client + a React Email waitlist confirmation template
- [ ] Configure Biome (lint + format)
- [ ] Set up Vitest
- [ ] Create `Dockerfile` and `docker-compose.yml`
- [ ] Set up `.github/workflows/ci.yml` and `build.yml`
- [ ] Create the documentation set (this folder)
- [ ] Write `README.md` for the public repo

**Done when**: `bun run dev` starts the app, Postgres connects, all quality gates pass on a hello-world page.

## Phase 1: Landing page (1 week)

**Goal**: Polished public-facing landing page with waitlist signup. Ready to publish.

- [ ] Design and implement landing page (hero, problem, solution, how it works, supported games, waitlist signup, footer)
- [ ] Waitlist Server Action + Postgres table
- [ ] Confirmation email via Resend + React Email
- [ ] Email confirmation flow (magic link click → marks signup confirmed)
- [ ] Cloudflare Web Analytics integration
- [ ] OG image generation (`/api/og`)
- [ ] Sitemap, robots.txt, meta tags
- [ ] Mobile responsive (this is the only surface that needs mobile in v1)
- [ ] Privacy policy + terms placeholders
- [ ] Deploy to Unraid behind Cloudflare Tunnel
- [ ] Verify production: signup works, email arrives, confirmation works

**Done when**: anyone on the internet can visit `serverfoundry.gg`, sign up, get a confirmation email, click the link, and see a success state.

## Phase 2: Auth & accounts (3-5 days)

**Goal**: Users can create accounts and log in via multiple methods.

- [ ] Login page (email + 3 OAuth buttons)
- [ ] Signup page
- [ ] Email verification flow (post-signup)
- [ ] Password reset flow (request + token + reset)
- [ ] OAuth callbacks for Google, GitHub, Discord
- [ ] Session management (cookies, expiration)
- [ ] Account linking (existing email user can link OAuth)
- [ ] Settings page: profile (name, avatar), email change, password change, linked accounts, account deletion
- [ ] Logout

**Done when**: a user can sign up via any method, verify email, log in, log out, change password, link accounts, and delete account.

## Phase 3: Dashboard skeleton + host pairing (1 week)

**Goal**: Users can add a host and see it appear in the dashboard. Agent doesn't need to do anything yet.

- [ ] Dashboard layout (sidebar/topbar, main content area)
- [ ] Empty state for "no hosts"
- [ ] "Add Host" flow:
  - Generate pairing code (Server Action)
  - Display code with copy button
  - Show countdown until expiry
  - Show install command for the user to run on their host
- [ ] `POST /api/agent/pair` endpoint (validates code, creates host, returns token)
- [ ] Hosts list page (rendered server-side)
- [ ] Host detail page skeleton (with offline state)
- [ ] Remove host action

**Done when**: user can generate a pairing code, simulate it being consumed via curl, and see a host appear in their dashboard.

## Phase 4: Agent skeleton + heartbeat (1-2 weeks)

**Goal**: Real agent on real Linux host connects to platform and reports vitals.

This is split work — agent is in a separate repo (`server-foundry-agent`).

Platform side:
- [ ] WebSocket server at `/ws/agent`
- [ ] Authenticate via agent token + HMAC
- [ ] Handle `hello`, `heartbeat`, `log` messages
- [ ] Update `hosts.last_seen_at`, `hosts.status` based on heartbeat
- [ ] Persist heartbeat data into hourly aggregates (`host_metrics_hourly`)
- [ ] SSE endpoint for streaming live metrics to dashboard
- [ ] Dashboard host detail Overview tab — shows live CPU, memory, disk

Agent side:
- [ ] Node.js project with WebSocket client
- [ ] Reads token from `/etc/foundry/credentials`
- [ ] Sends heartbeat every 3 seconds with vitals from `systeminformation`
- [ ] Reconnects with exponential backoff on disconnect
- [ ] Install script (`curl https://serverfoundry.gg/install.sh | bash`)
- [ ] systemd unit file for auto-start

**Done when**: a real Linux host runs the install script, connects, and the user sees live CPU/memory/disk in the dashboard.

## Phase 5: Game server deployment (1-2 weeks)

**Goal**: User can deploy a Valheim server through the dashboard and connect to it.

- [ ] Game catalog seed data (Valheim first, others later)
- [ ] Game catalog page
- [ ] Deploy flow: choose game → choose host → name + config → submit
- [ ] Platform sends `deploy_server` to agent
- [ ] Agent uses SteamCMD to download Valheim, configures, starts process
- [ ] Agent reports `deployment_progress` and `server_status_change` back
- [ ] Dashboard shows the server appearing under the host
- [ ] Lifecycle controls: start, stop, restart, delete
- [ ] Port conflict detection at deploy time

**Done when**: user deploys a Valheim server, connects to it via Valheim client, and stops/starts it from dashboard.

## Phase 6: Logs & remote terminal (1 week)

- [ ] Agent streams game server stdout as `log` messages
- [ ] Agent streams host syslog as `log` messages
- [ ] Logs tab on host detail page
- [ ] Logs filtering (severity, source, time range)
- [ ] Search within logs
- [ ] Remote terminal via xterm.js + WebSocket PTY tunnel
- [ ] Terminal tab on host detail page

**Done when**: user can read live logs from a deployed game server, and SSH into the host via a browser terminal.

## Phase 7: More games (1-2 weeks)

Add support for: Minecraft, Counter-Strike 2, Rust, ARK, Terraria, Project Zomboid, 7 Days to Die.

For each game:
- [ ] Seed `game_catalog`
- [ ] Define config schema
- [ ] Add SteamCMD recipe (or non-Steam install for Minecraft Java)
- [ ] Test deployment end-to-end
- [ ] Add icon/logo

## Phase 8: Notifications (3-5 days)

- [ ] Notification bell + dropdown
- [ ] Full history page
- [ ] Generate notifications from server-side events (heartbeat lost, server crashed, deployment complete, etc.)
- [ ] Email delivery for opted-in notifications
- [ ] User preferences page

## Phase 9: Backups (1 week)

- [ ] Per-server backup config
- [ ] On-demand backup
- [ ] Scheduled backups (cron)
- [ ] Restore flow
- [ ] S3 destination support (user provides credentials, encrypted at rest)
- [ ] Platform-provided storage with quota (future, requires storage strategy)

## Phase 10: Agent self-update (3-5 days)

- [ ] Agent version endpoint
- [ ] Platform pushes update command
- [ ] Agent downloads, verifies signature, swaps, restarts
- [ ] Health check rollback
- [ ] Update history per host

## Phase 11: Security hardening (1 week)

- [ ] nftables firewall config in agent install
- [ ] AppArmor profiles for game server processes
- [ ] sysctl hardening
- [ ] Game servers run as separate users
- [ ] Penetration test of public surface
- [ ] Audit log table + writes for privileged actions

## Phase 12: Dashboard polish (1-2 weeks)

- [ ] Cinematic Operations design implementation
- [ ] Sankey traffic flow diagram
- [ ] Uptime heatmap
- [ ] Polished animations and transitions
- [ ] Empty states and error states for every page

## Phase 13: GameServerOS (2-3 weeks)

- [ ] `live-build` configuration
- [ ] First-boot TUI installer
- [ ] Hardened base image
- [ ] ISO build in CI
- [ ] ISO download in dashboard

## What's NOT on the roadmap (out of scope)

Documented for clarity. Don't build these without explicit re-prioritization:

- Mobile app or mobile-responsive dashboard (landing IS mobile responsive; dashboard is desktop-only)
- Billing, pricing, subscription tiers — until product-market fit
- Team accounts / multi-user access
- Public server listings / discovery
- Built-in voice chat
- Game mods / plugin management
- AI insights / anomaly detection ("Forge AI")
- Custom game support beyond the supported list
- Windows or macOS agents
- Public API for third parties
- Webhooks
- Import from competitors

## Critical path priority

If forced to cut scope to ship faster, this is the minimum viable critical path:

1. Landing page (Phase 1) — public, collect signups
2. Auth (Phase 2) — users can log in
3. Add Host + heartbeat (Phase 3 + 4) — users see their hardware
4. Deploy Valheim (Phase 5) — users deploy ONE game
5. Logs (part of Phase 6) — users can debug

That's the MVP. Everything beyond is improvement.

## Estimating

These estimates assume one solo developer working with Claude Code. Adjust if multiple contributors or different working pace.

Total to MVP (Phases 0-5): ~5-6 weeks
Total to full launch (Phases 0-12): ~3-4 months
GameServerOS (Phase 13): additional 2-3 weeks
