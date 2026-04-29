# Security

Threat model, secrets management, and hardening for Server Foundry.

## Threat model

### What we're protecting
- User accounts and their associated hosts
- User-to-host pairing (preventing hijacking)
- Agent-to-platform communication (preventing impersonation or MITM)
- Game server processes (preventing privilege escalation from a compromised game)
- The Unraid host running the platform itself

### Who we're defending against
- **Untrusted internet**: anyone who can reach our public domain
- **Compromised user account**: limited blast radius (only their hosts/servers affected)
- **Compromised game server process**: should not be able to escape its sandbox
- **Compromised agent host**: should not gain access to other users' hosts or the platform itself
- **Insider risk (you)**: defense in depth, audit trails

### What we are NOT defending against
- Nation-state attackers (out of scope)
- Physical access to the user's hardware
- Social engineering of the user
- A user voluntarily running malicious commands in their own remote terminal

## Secrets management

### Where secrets live
- `.env.local` — local development only, gitignored
- `.env.example` — committed, shows shape, no values
- Production: environment variables passed to Docker container via Unraid template
- Never in code, never in commits, never in logs

### Secrets the platform needs
| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Postgres container |
| `BETTER_AUTH_SECRET` | Session signing key | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Public URL for OAuth callbacks | e.g. `https://serverfoundry.gg` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth | Google Cloud Console |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth | GitHub Developer Settings |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth | Discord Developer Portal |
| `RESEND_API_KEY` | Email sending | Resend dashboard |
| `RESEND_WEBHOOK_SECRET` | Verify email webhooks | Resend dashboard |
| `AGENT_HMAC_SECRET` | Sign agent tokens | `openssl rand -hex 32` |
| `BACKUP_ENCRYPTION_KEY` | Encrypt user S3 credentials | `openssl rand -hex 32` |

### Rotation policy
- Application secrets (`BETTER_AUTH_SECRET`, `AGENT_HMAC_SECRET`): rotate annually or on suspected compromise
- OAuth client secrets: rotate per provider's recommendation, typically annually
- Resend API key: rotate annually
- Postgres password: rotate every 6 months

## Authentication

### Stack
Better Auth handles all auth flows. We do not roll our own.

### Password storage
- Argon2id (built into Better Auth)
- No bcrypt, no MD5, no SHA, no custom hashing

### Session management
- HttpOnly, Secure, SameSite=Lax cookies
- Session token is a 256-bit random value, hashed before storage
- Sessions expire after 30 days, sliding window
- Sessions can be revoked from settings page (logout all devices)

### OAuth
- State parameter validated on callback (CSRF protection)
- PKCE used where supported
- Tokens stored encrypted at rest in `oauth_accounts` table
- Account linking requires re-authentication

### Email verification
- Required before account is fully usable (can browse landing-only features without verification)
- Single-use, time-limited tokens (1 hour)
- New email → verification required again

### Password reset
- Single-use, time-limited tokens (15 min)
- Sent only to verified email
- Existing sessions invalidated on password reset

## Agent authentication

### Pairing flow
1. User generates pairing code in dashboard (8 chars, format `XXXX-XXXX`)
2. Code stored in `pairing_codes` with 15-min expiry
3. User runs install script with code
4. Agent posts to `POST /api/agent/pair` with code + host info
5. Platform validates code (single-use, not expired, belongs to user)
6. Platform generates long-lived agent token (256-bit random, HMAC-signed with `AGENT_HMAC_SECRET`)
7. Token hash stored in `hosts.agent_token_hash` (we never store the raw token)
8. Agent stores token in `/etc/foundry/credentials` with `chmod 600`
9. Code is marked used; future agent requests use the token

### Token validation
- Every agent message (HTTP or WS) must include the token
- HMAC signature verification on every message
- Token rotation: agents request new token every 90 days; old token valid for 24h grace period
- Compromised token: user can revoke from dashboard, agent stops working immediately

### Agent download integrity
- Agent binaries signed with platform's signing key (separate from `AGENT_HMAC_SECRET`)
- Signature verified before binary swap during self-update
- Failed signature → reject update, log incident, notify user

## Network security

### TLS everywhere
- Cloudflare Tunnel handles TLS termination at the edge
- All traffic to Unraid is encrypted in the tunnel
- Inside Unraid: web app talks to Postgres over loopback (no TLS needed)

### Cloudflare protections
- DDoS protection (built-in)
- WAF rules: block common attack patterns
- Bot Fight Mode for the public landing page
- Rate limiting at the edge for `/api/auth/*` and `/api/waitlist`

### Headers
Set on every response:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: <see below>
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://avatars.githubusercontent.com https://cdn.discordapp.com https://lh3.googleusercontent.com;
connect-src 'self' wss://serverfoundry.gg https://api.resend.com;
font-src 'self' data:;
frame-ancestors 'none';
```

Tighten this further once we have full CSP audit.

### CSRF
- Better Auth handles CSRF for auth flows
- Server Actions have built-in CSRF protection in Next.js
- REST endpoints: validate `Origin` header against expected origins; require `X-Requested-With` for state-changing requests

## Database security

### Postgres hardening
- Postgres container not exposed outside Docker network
- Strong, randomly-generated password (32+ chars)
- Only the web app container can reach it
- No SUPERUSER for the application user; restrict to its own database

### Query safety
- Drizzle ORM (parameterized queries always)
- Never construct SQL with string concatenation
- Never use `sql.raw()` with user input

### Sensitive column encryption
Encrypted at rest with `BACKUP_ENCRYPTION_KEY`:
- `oauth_accounts.access_token`, `oauth_accounts.refresh_token`
- `backup_configs.destination_config_json` (when type=s3)

Use `node:crypto` AES-256-GCM. Helper functions in `src/lib/crypto.ts`.

### Backups
- Postgres backed up daily via Unraid's backup tools
- Backup encrypted with separate key
- Test restore quarterly

## Application-level protections

### Input validation
- Every user input validated with Zod before processing
- Schema mismatch = reject with 400, never proceed with bad data
- Server Actions and API endpoints both use the same Zod schemas

### Output encoding
- React handles HTML escaping automatically
- Never use `dangerouslySetInnerHTML` without explicit sanitization (DOMPurify)
- JSON responses: serialize via `JSON.stringify` only (no template strings)

### Authorization (not just authentication)
Pattern for every protected operation:
```ts
// 1. Verify user is authenticated
const session = await requireSession()

// 2. Verify user owns the resource
const host = await db.query.hosts.findFirst({
  where: and(eq(hosts.id, hostId), eq(hosts.userId, session.userId))
})
if (!host) throw new NotFoundError() // not unauthorized — same response

// 3. Proceed
```

### Rate limiting
- Per-IP for public endpoints (`/api/waitlist`, `/api/auth/*`)
- Per-user for authenticated endpoints
- Per-agent for agent endpoints
- Implementation: simple in-memory or Redis-backed counter (start in-memory, switch to Redis if we scale)

### Email enumeration protection
- Login: same response time + message regardless of whether email exists
- Password reset: always returns success, only sends email if user exists
- Signup: tells user explicitly that email is taken (this is acceptable since it's a feature)

### Logging hygiene
- Pino logger configured with redaction for sensitive fields:
  - `password`, `token`, `apiKey`, `authorization`, `cookie`, `secret`
- Never log user content (emails, names) at INFO level — DEBUG only
- Production logs default to INFO; DEBUG only enabled temporarily

## Agent host security

### Agent process
- Runs as `foundry` user, not root
- Narrow sudoers rules: only specific game-server-control commands
- AppArmor profile restricting agent's filesystem and network access

### Game server isolation
- Each game server runs as its own user (`foundry-server-<uuid>`)
- AppArmor profile per game (Valheim profile, CS2 profile, etc.)
- Process resource limits via systemd (CPU, memory, file handles)
- Filesystem confined to `/var/foundry/servers/<server-id>/`

### Firewall (nftables)
Default policy: drop everything.

```
inbound:
  - SSH (port 22) from anywhere — optional, user can disable
  - Game server ports — opened dynamically per deployed server
  - Established connections — allowed
outbound:
  - DNS (53), NTP (123)
  - Platform endpoints (HTTPS, WSS to serverfoundry.gg)
  - Steam CDN (for SteamCMD downloads)
  - Game-specific update endpoints (per game)
  - Drop everything else
```

### sysctl hardening
```
net.ipv4.ip_forward = 0
net.ipv4.conf.all.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.tcp_syncookies = 1
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
fs.suid_dumpable = 0
```

## Incident response

### What to do if compromised

**Suspected platform breach:**
1. Rotate all secrets (`.env`, OAuth client secrets)
2. Invalidate all sessions (purge `sessions` table)
3. Force password reset for all users via email
4. Revoke all agent tokens (purge `agent_token_hash`)
5. Audit logs for the period of suspected compromise
6. Notify users of the incident within 72 hours

**Suspected agent compromise (single host):**
1. User revokes host from dashboard (revokes token)
2. Inspect agent logs from platform side
3. Help user reinstall agent from clean state if needed

**Suspected user account compromise:**
1. User initiates password reset (or admin tools force-reset)
2. All sessions revoked
3. Audit recent actions on account
4. Notify user via verified email

## Audit logging

Tables that need audit trails:
- `audit_log` (table to create) — every privileged action: host added, host removed, agent token rotated, password changed, account deleted
- Each entry: `user_id`, `action`, `target_id`, `metadata_json`, `ip`, `user_agent`, `timestamp`
- Retain for 90 days minimum
- Never delete except via explicit retention policy

## Compliance considerations

Not subject to GDPR/CCPA-level compliance pre-launch, but build with these in mind:
- User can delete their account (cascades, hard delete after 30 days)
- User can export their data (JSON dump from Settings → Data Export)
- Privacy policy + terms of service required before public launch
- Cookie consent if we add analytics that require it (avoid this — use Plausible or Cloudflare Analytics)

## Pre-launch security checklist

Before flipping the landing page from "soft preview" to public:

- [ ] All secrets rotated to production values
- [ ] Cloudflare WAF rules active
- [ ] Rate limiting verified on all public endpoints
- [ ] CSP headers tight (no `unsafe-eval`, minimize `unsafe-inline`)
- [ ] HTTPS enforced (HSTS preload eligible)
- [ ] Privacy policy + terms of service published
- [ ] Email verification required before signup completes (waitlist confirms email)
- [ ] Argon2id verified as the password hasher
- [ ] Postgres not exposed beyond Docker network
- [ ] Database backups configured and tested
- [ ] Sentry or equivalent error monitoring active
- [ ] Logs aggregated and persistent (not just container stdout)
- [ ] OAuth redirect URIs restricted to production domain only
- [ ] No `console.log` of sensitive data
- [ ] Penetration test or `nikto`/`zap` scan of public surface
