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

Platform side (committed at `43a969f`):
- [x] Game catalog seed data (Valheim first, others later) — `src/server/db/seed.ts`, `npm run db:seed`
- [x] Deploy flow: choose game → name + config → submit — at `/dashboard/hosts/[id]/deploy`
- [x] Platform sends `deploy_server` to agent — via `sendToHost(hostId, msg)` from `src/server/ws/agent-handler.ts`
- [x] Platform handles `deployment_progress` and `server_status_change` from agent
- [x] Dashboard shows the server appearing under the host — server list on host detail
- [x] Lifecycle controls: start, stop, restart, delete — `/dashboard/servers/[id]`
- [x] Port conflict detection at deploy time — checked in `deployServer` action

Agent side (separate `server-foundry-agent` repo, not started):
- [ ] Agent uses SteamCMD to download Valheim, configures, starts process
- [ ] Agent reports `deployment_progress` and `server_status_change` back

Polish:
- [ ] Game catalog browse page (`/dashboard/games`) — currently games are picked inline at deploy time

**Done when**: user deploys a Valheim server, connects to it via Valheim client, and stops/starts it from dashboard.

## Phase 6: Logs & remote terminal (1 week)

Logs (committed):
- [x] Platform: `host_logs` + `game_server_logs` tables (migration 0004)
- [x] Platform: `handleLog` persists + publishes to `live-logs-bus`
- [x] Platform: SSE endpoints `/api/stream/host/[id]/logs` and `/api/stream/server/[id]/logs`
- [x] Platform: `LiveLogsPanel` component (live tail, severity filter, follow) on host + server detail
- [x] Agent: line-buffered stdout/stderr piping with severity heuristic

Logs polish (later):
- [ ] Agent: stream host syslog (journalctl tail) as `log` messages
- [ ] Time-range filtering and search within logs (currently severity + tail only)
- [ ] Log export endpoints (CSV)
- [ ] Partition `host_logs` / `game_server_logs` by week, archive after 7 days

Remote terminal (committed):
- [x] Remote terminal via xterm.js + WebSocket PTY tunnel
- [x] Terminal section on host detail page (online hosts only)
- [ ] Audit-log terminal sessions (open/close, originating user) — Phase 11 hardening item

**Done when**: user can read live logs from a deployed game server, and SSH into the host via a browser terminal.

## Phase 7: More games (1-2 weeks)

Add support for: Minecraft, Counter-Strike 2, Rust, ARK, Terraria, Project Zomboid, 7 Days to Die.

Catalog + recipes (committed):
- [x] Counter-Strike 2 — SteamCMD 730, requires GSLT
- [x] Rust — SteamCMD 258550
- [x] ARK: Survival Evolved — SteamCMD 376030, ~30 GB install
- [x] Terraria — SteamCMD 105600
- [x] Project Zomboid — SteamCMD 380870
- [x] 7 Days to Die — SteamCMD 294420 (XML config edited via terminal for v1)
- [x] Minecraft (Java) — recipe shape only; install function throws (custom Mojang installer + EULA flow is the follow-up); seeded with `is_enabled=false` so it won't appear in the deploy UI yet
- [x] Recipe shape refactored: each `GameRecipe` owns its install function, so non-Steam games (Minecraft) plug in alongside SteamCMD ones

Per-game polish (backlog):
- [ ] Test each deployment end-to-end on a real Linux host
- [ ] Add icon/logo per game (`logo_url` populated)
- [ ] Render INI/XML configs from richer config schemas (currently 7DTD requires terminal edits)
- [ ] Minecraft Java installer (download Mojang server.jar, write eula.txt + server.properties)

## Phase 8: Notifications (3-5 days)

Committed:
- [x] Schema: `notifications` + `notification_preferences` (migration 0005, 14-type enum, severity enum, composite-PK preferences)
- [x] Notification bell in app shell — 20s poll, unread badge, dropdown with last 10 + click-through to detail
- [x] `/dashboard/notifications` history page (filter all/unread, mark read, mark all read, dismiss)
- [x] `/settings` notifications section with per-type in-app + email checkboxes
- [x] Server-side hooks: host_online (transition), host_offline (transition), server_started, server_crashed, pairing_used
- [x] Email delivery via `emails/Notification.tsx` + Resend (fire-and-forget so the WS path stays fast)

Backlog (deferred):
- [ ] Hooks for `agent_updated`/`agent_update_failed` (Phase 10)
- [ ] Hooks for `backup_completed`/`backup_failed` (Phase 9)
- [ ] Hooks for `memory_threshold`/`disk_threshold` (Phase 11 — needs threshold config UI)
- [ ] Hooks for `auth_failure` (needs Better Auth event integration)
- [ ] Live SSE for the bell (currently 20s poll)

## Phase 9: Backups (1 week)

Committed:
- [x] Schema: `backups` + `backup_configs` (migration 0006, status + destination enums, encrypted destination JSON)
- [x] Per-server backup config (form on server detail page)
- [x] On-demand backup (Back up now button + `triggerBackup` action)
- [x] Scheduled backups via in-process cron loop in `server.ts` (5-field spec, lastRunAt throttle, retention sweep)
- [x] Restore flow (confirmation dialog → `restoreBackup` action → agent unpacks tarball over installDir)
- [x] S3 destination support — user-provided credentials encrypted at rest with AES-256-GCM (BACKUP_ENCRYPTION_KEY). `aws4fetch` on the agent does single-PUT/GET with SigV4
- [x] Backup completion notifications (`backup_completed` / `backup_failed` wired into Phase 8)

Backlog:
- [ ] Multipart upload for backups >5 GiB (S3 single-PUT limit). ARK + 7DTD will hit this
- [ ] Platform-provided storage (requires the platform to operate its own object store + per-user quota)
- [ ] Pre-backup pause / post-restore start orchestration (currently snapshots live install dir; correct approach is to stop the server first)
- [ ] Object-side delete on retention expiry (today only the DB row is removed)
- [ ] Streaming progress percentage during upload (we report bytesSoFar at completion only)

## Phase 10: Agent self-update (3-5 days)

Committed:
- [x] Schema: `agent_updates` (migration 0007) + `agent_update_status` enum
- [x] Manifest endpoint `GET /api/agent/update-manifest` (env-driven: AGENT_UPDATE_VERSION, AGENT_UPDATE_DOWNLOAD_URL, AGENT_UPDATE_SIGNATURE, AGENT_UPDATE_SHA256)
- [x] Server Action `triggerAgentUpdate` — owner-checked, dispatches `update_agent` to the connected agent
- [x] Protocol additions: `update_agent` (platform→agent), `agent_update_progress` (agent→platform; phases include staged/completed/failed/rolled_back)
- [x] Agent: streaming download with sha-256 hash, ed25519 signature verify (FOUNDRY_UPDATE_PUBLIC_KEY), tar -xzf into /opt/foundry-agent.new, drop pending marker
- [x] Privilege-separated swap: foundry-agent-swap.path watches the marker file, foundry-agent-swap.service runs as root and does stop → swap → start → 45s health-check → rollback if the new build fails to come online
- [x] Update history UI on host detail (current version + manifest pull + Update agent confirm dialog + status list)
- [x] Notifications: `agent_updated` + `agent_update_failed` (Phase 8 wiring)

Backlog:
- [ ] Real signing pipeline (CI generates ed25519 sigs over the tarball sha256, publishes both to a CDN). Today the manifest fields are env-driven; signing is documented in docs/security.md but not yet automated
- [ ] In-flight progress percentage during download (we report at phase boundaries only)
- [ ] Multi-architecture tarballs (amd64 only for now)
- [ ] Agent-side polling against /api/agent/update-manifest so out-of-band updates can land without a dashboard click

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
