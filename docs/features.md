# Features

Complete feature list for Server Foundry, organized by area. Each feature has implementation notes and is checkboxed for tracking.

## Phase 1: Landing page (current milestone)

- [ ] Polished, public-ready coming soon / pre-launch landing page
- [ ] Above-the-fold hero with name, tagline, primary CTA
- [ ] Problem statement (why existing game server hosting is broken)
- [ ] Solution summary (how Server Foundry is different)
- [ ] How it works: 3 steps (install agent → pick game → play)
- [ ] Supported games grid (Valheim, Minecraft, CS2, Rust, ARK, Terraria, Project Zomboid, 7 Days to Die)
- [ ] Email capture for waitlist (stored in `waitlist_signups` table)
- [ ] Waitlist confirmation email (via Resend, designed in React Email)
- [ ] Success state after signup with social share prompts
- [ ] Footer (minimal: name, X/Twitter link, GitHub link, legal placeholders)
- [ ] SEO: open graph image, meta tags, sitemap
- [ ] Analytics: Cloudflare Web Analytics or Plausible (privacy-first, no cookies)
- [ ] Mobile responsive (yes, even though dashboard is desktop-only — landing page must work on mobile)

## Phase 2: Auth & accounts

- [ ] Email/password signup with email verification
- [ ] Email/password login
- [ ] Google OAuth signup/login
- [ ] GitHub OAuth signup/login
- [ ] Discord OAuth signup/login (gaming audience uses Discord heavily)
- [ ] Account linking (user signs up with email, later links Google — same account)
- [ ] Password reset flow
- [ ] Email change (with verification)
- [ ] Session management (persistent across browser refresh)
- [ ] Logout
- [ ] Account deletion with confirmation (cascades to remove hosts, servers, backups)
- [ ] User profile (display name, email, avatar from OAuth)

## Phase 3: Host management

- [ ] Add Host flow with two paths:
  - **GameServerOS path**: download ISO, enter pairing code at first boot (Phase 5+)
  - **Manual install path** (Phase 3): run `curl | bash` on existing Linux host
- [ ] Pairing code generation — `XXXX-XXXX` format, 15-min expiry, single-use
- [ ] Zero-config enrollment — agent connects with pairing code, platform issues long-lived auth token
- [ ] Host list view — all hosts with online/offline status, game server count, resource summary
- [ ] Host detail page with tabs: Overview, Game Servers, Terminal, Logs, Settings
- [ ] Rename host (display name)
- [ ] Remove host (confirmation, revokes agent token, disconnects agent)
- [ ] Host status: `online | offline | connecting | updating`
- [ ] Display host metadata: hostname, IP, OS, kernel, CPU model, cores, RAM, storage, GPU, agent version, uptime

## Phase 4: Real-time monitoring

- [ ] WebSocket heartbeat every 3 seconds from agent to platform
- [ ] Live CPU usage (overall)
- [ ] Live memory usage (used/total in GB)
- [ ] Live disk usage per mount
- [ ] Network I/O throughput (MB/s up/down)
- [ ] CPU temperature (when available)
- [ ] GPU model and temperature (when present)
- [ ] Per-game-server player counts
- [ ] Hourly metric aggregates stored in DB (30-day retention)
- [ ] Live sparkline charts in dashboard

## Phase 5: Game server deployment

- [ ] Game catalog page listing supported games
- [ ] Supported games (MVP): Valheim, Minecraft (Java), Counter-Strike 2, Rust, ARK, Terraria, Project Zomboid, 7 Days to Die
- [ ] Each game entry includes: name, description, official logo, SteamCMD app ID, default port, RAM recs, config schema
- [ ] Deploy new game server flow:
  - Choose game from catalog
  - Choose target host (only online hosts eligible)
  - Name the server
  - Configure game-specific settings (world name, seed, max players, password, etc.)
  - Deploy — platform sends task to agent via WebSocket
  - Progress UI: downloading → configuring → starting
- [ ] Lifecycle actions: start, stop, restart, delete
- [ ] Per-server config editing (with restart prompt if running)
- [ ] Process isolation (separate system user per server, AppArmor profile)
- [ ] Port conflict detection
- [ ] SteamCMD orchestration on agent side

## Phase 6: Remote terminal

- [ ] Browser-based shell via xterm.js
- [ ] WebSocket PTY tunnel: dashboard ↔ platform ↔ agent ↔ shell process
- [ ] "Open Terminal" button; empty state when host offline
- [ ] Disconnect button
- [ ] Copy/paste support
- [ ] Terminal resize handling

## Phase 7: Logs

- [ ] Live log streaming from agent (host-level + per-game-server)
- [ ] Filters: source, severity (INFO/WARN/ERROR/DEBUG), time range
- [ ] Text search within current view
- [ ] Auto-scroll toggle
- [ ] 7-day retention in DB, older archived to blob storage
- [ ] Each log entry: timestamp, source, severity, message
- [ ] Export logs as plain text

## Phase 8: Notifications

- [ ] In-app notification bell with unread count badge
- [ ] Dropdown of recent notifications (paginated)
- [ ] Mark as read individually or all
- [ ] Dismiss (soft delete)
- [ ] Full history page
- [ ] Severity levels: info, warning, error
- [ ] Notification triggers:
  1. Host came online
  2. Host went offline
  3. Agent updated successfully
  4. Agent update failed
  5. Game server started
  6. Game server crashed
  7. Game server updated
  8. Game server update failed
  9. Backup completed
  10. Backup failed
  11. Memory threshold exceeded (configurable, default 85%)
  12. Disk threshold exceeded (configurable, default 85%)
  13. Pairing code used (new host enrolled)
  14. Authentication failure (suspicious activity)
- [ ] Email notifications (opt-in per trigger via settings)

## Phase 9: Backups

- [ ] Per-game-server backup configuration:
  - Enable/disable
  - Schedule (hourly, daily, weekly, custom cron)
  - Retention (last N backups)
  - Destination (S3-compatible — user provides credentials, or platform-provided with quota)
- [ ] On-demand backup button
- [ ] Backup format: tar.gz of save directory + config
- [ ] Backup history with download links and restore action
- [ ] Restore flow: select backup, confirm (stops server), agent downloads + applies + restarts
- [ ] Backup progress streamed via WebSocket

## Phase 10: Agent self-update

- [ ] Platform tracks current recommended agent version
- [ ] Agent checks version on connect
- [ ] Platform pushes update with signed download URL
- [ ] Agent downloads, verifies signature, swaps, restarts
- [ ] Health check rollback if new version fails within 2 minutes
- [ ] Update history per host

## Phase 11: Security hardening

- [ ] nftables firewall config (default deny inbound except SSH + game ports)
- [ ] AppArmor profiles for game server binaries
- [ ] sysctl hardening
- [ ] Game servers run as separate unprivileged users
- [ ] Agent token rotation (90 days, 24h grace period)
- [ ] Rate limiting on platform API
- [ ] CSRF tokens (built into Better Auth)
- [ ] Content Security Policy headers
- [ ] Secrets sanitizer in logs

## Phase 12: GameServerOS

- [ ] Custom Debian 12 ISO via `live-build`
- [ ] First-boot TUI installer (whiptail)
- [ ] Pairing code entry at boot
- [ ] Agent pre-baked, auto-configures
- [ ] Hardened base image
- [ ] ISO download from dashboard (signed URL)

## Phase 13: Dashboard polish

- [ ] Cinematic operations UI (charcoal background, frosted glass, neon accent)
- [ ] Sankey traffic flow diagram (Hosts → Games → Players)
- [ ] Uptime heatmap (24h or 7d)
- [ ] Host cards with callsigns (A01, B02, C03)
- [ ] Worlds in session grid
- [ ] Recent activity feed

## Out of scope for v1

These are explicitly NOT going to be built in the initial launch:

- Mobile app or mobile-responsive dashboard (landing page IS mobile responsive; dashboard is desktop-only)
- Billing, pricing, subscription tiers
- Team accounts / multi-user access to one account
- Public server listings / discovery
- Built-in voice chat
- Game mods / plugin management (users SSH in if they need this)
- "Forge AI" insights / anomaly detection
- Custom game support beyond the 8 supported
- Windows or macOS agent (Linux only)
- Public API for third parties
- Webhooks
- Import from other hosting platforms
