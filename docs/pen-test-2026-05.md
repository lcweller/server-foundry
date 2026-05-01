# Pen-test pass — 2026-05-01

Pre-deploy security audit of Server Foundry's public surface and agent
attack surface. This is a code-level review, not a live scan — at the
time of this audit no public instance exists for `nikto`/`zap` to hit.
The live scan should rerun against the real domain after first deploy
and the findings re-validated.

## Scope

**Public web surface (anyone on the internet):**
- Landing page + waitlist (`/`, `joinWaitlist`, `confirmWaitlist`)
- Auth flows (`/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/verify-email`, `/api/auth/[...all]` — Better Auth wrapper)
- OG image (`/api/og`)
- Sitemap + robots

**Public agent surface (no auth):**
- `POST /api/agent/pair`
- `GET /api/agent/update-manifest`

**Authenticated dashboard surface (browser session):**
- Server Actions across `src/server/actions/*` (hosts, servers,
  backups, agent-updates, notifications, waitlist)
- SSE streams (`/api/stream/host/[id]/{logs,metrics}`,
  `/api/stream/server/[id]/logs`)
- Notifications poll (`/api/notifications/latest`)
- Browser terminal WebSocket (`/ws/terminal`)

**Agent ↔ platform protocol surface (bearer-token-authed):**
- `/ws/agent` — WebSocket; HMAC-validated then DB-hashed bearer
- All agent → platform messages (`hello`, `heartbeat`, `log`,
  `server_status_change`, `deployment_progress`, `terminal_data`,
  `terminal_closed`, `backup_progress`, `restore_progress`,
  `agent_update_progress`)

**Out of scope:**
- Better Auth internals (treat as trusted dependency)
- Drizzle ORM SQL safety (parameterised by construction)
- `nikto` / OWASP ZAP baseline scans — deferred until a live deploy
  exists. Rerun this audit's "Deferred" list against the running
  service before flipping the landing page to public.

## Findings

### Fixed in this pass

#### Medium — `backups.ts` Server Actions bypass auth/ownership

`src/server/actions/backups.ts` declares `'use server'` at the top, so
**every export in the file is a client-callable RPC**, not just the
explicitly user-facing Server Actions. `listBackups`,
`loadBackupConfig`, and `sweepExpiredBackups` had no `getCurrentSession`
+ ownership check inside the function — they relied on caller
discipline ("server component pre-checks ownership"). Any authenticated
browser session could:

- Call `listBackups("<any-server-uuid>")` and enumerate up to 50
  historical backup rows (sizes, timestamps, storage URLs) for a
  server they don't own.
- Call `loadBackupConfig("<any-server-uuid>")` and read schedule,
  retention, destination type, plus the encrypted destination JSON
  (creds-at-rest are AES-256-GCM, so plaintext leak is bounded — but
  the schedule/destination metadata itself is a privacy leak).
- Call `sweepExpiredBackups()` to trigger the retention reaper across
  all users (not destructive beyond what the scheduler already does,
  but should not be exposed as RPC).

**Fix applied:**
- `listBackups` / `loadBackupConfig` now resolve `getCurrentSession()`
  and re-run the ownership join (`loadOwnedServer`) before reading.
  Unauthenticated → empty result; not-owner → empty result.
- `sweepExpiredBackups` moved to `src/server/backups/sweep.ts` (no
  `'use server'` directive). Can no longer be invoked over RPC; only
  the scheduler imports it.

#### Medium — race in `POST /api/agent/pair` produces orphan hosts

The `findFirst(pairingCodes)` call is non-blocking. Between that read
and the conditional `UPDATE pairing_codes SET used_at = now() WHERE
id = X AND used_at IS NULL`, two concurrent agents posting the same
code can both pass the find. The conditional UPDATE picks one winner
correctly, but the `INSERT INTO hosts` runs eagerly *before* the
UPDATE. Result: two host rows, one consumed code, one orphan host
without a pairing trail.

In practice this is hard to trigger — the agent has to be paired by a
single user with a single code, and codes are 30^8 entropy. But a
malicious user with the code or a compromised installer process could
trigger it deliberately to get a host row that's not auditable to a
pairing event.

**Fix applied:** the UPDATE now uses `.returning({ id })` and the code
checks `consumed.length === 0`. If we lost the race, throw
`PAIRING_CODE_RACE`, which rolls back the host insert via the
surrounding `db.transaction(...)`. The outer catch maps that error to
HTTP 409 so the agent installer surfaces it the same as any other
"already used" code.

#### Low — hand-rolled timing-safe comparison in `agent-token.ts`

`isAgentTokenSignatureValid` used a custom `timingSafeEqualString`
(`charCodeAt` xor + bitwise OR over the length). The intent was right
but hand-rolled crypto loops can pick up timing channels via JIT
de-optimisation, branch hints, or future re-writes.

**Fix applied:** replaced with `crypto.timingSafeEqual` over UTF-8
buffers. Lengths are deterministic (HMAC-SHA256 base64url = 43 chars),
so the early length check before `timingSafeEqual` is purely a defence
against malformed input, not a path-dependent branch.

### Deferred — needs a live target or follow-up commit

#### Low — no rate limiting on public/auth endpoints

Endpoints with no per-IP limit:
- `POST /api/agent/pair`
- `GET /api/agent/update-manifest`
- `GET /api/og`
- Better Auth's own routes (delegated, but no Cloudflare WAF rules
  yet)
- `joinWaitlist` Server Action
- `GET /api/notifications/latest` (per-user, polled every 20s)

The `docs/security.md` "Pre-launch security checklist" already calls
this out. Implement Cloudflare rate-limit rules on `/api/auth/*` and
`/api/waitlist*` before flipping to public; consider a Redis-backed
limiter in-app for `/api/agent/pair`.

#### Low — error messages on `/api/agent/pair` distinguish failure modes

Returns 404 for unknown code, 409 for used, 410 for expired. An
attacker brute-forcing pairing codes can use the status code to
distinguish "this code never existed" from "this code was real but is
gone". Pairing codes are 30^8 ≈ 6.5e11 — brute-force is infeasible at
realistic rate-limited speeds — so this is informational rather than
actionable. If we ever drop entropy or remove rate limits, collapse
all three responses to a uniform 410 with no body distinction.

#### Low — agent token has no rotation

Once issued at pairing time, an agent token is valid until the host is
soft-deleted. `docs/security.md` already lists 90-day rotation with
24h grace as a goal; not yet implemented. Add to Phase 11 backlog or
Phase 12 polish.

#### Low — no reserved-port denylist on `deployServer`

A user can deploy a game server with `port = 22` (SSH) or `port =
5432` (Postgres) on their own host. The systemd unit's empty
`CapabilityBoundingSet=` prevents binding privileged ports < 1024
without `CAP_NET_BIND_SERVICE`, so SSH is safe. Other system services
on non-privileged ports could still conflict with the user's own
infrastructure. Pure UX risk, not security; users only shoot
themselves.

#### Informational — OG endpoint accepts arbitrary title

`GET /api/og?title=<anything>` renders the supplied string into the
OG card (capped at 80 chars). React escapes the JSX child, so XSS is
N/A. The risk is social-engineering — an attacker can craft URLs that
make Server Foundry "endorse" arbitrary text in social previews
(Twitter, Discord, etc.). Lock down later by signing the title param
with a server-only secret if abuse is observed.

#### Informational — `/api/agent/update-manifest` is fully public

By design — agents poll it without auth (they may not yet have a
token if mid-pair). Leaks the published agent version,
`AGENT_UPDATE_DOWNLOAD_URL`, signature, and sha256. The download URL
should be a dedicated CDN endpoint that itself enforces signed-URL
semantics if we don't want unauthenticated downloads.

#### Deferred until live — `nikto` / OWASP ZAP baseline

Cannot run from this machine against a non-existent deploy. Re-run as
part of the Phase 12 / pre-launch checklist:

```bash
# After first public deploy:
nikto -h https://serverfoundry.gg -o nikto.txt
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://serverfoundry.gg -r zap-baseline-report.html
```

Compare the reports against the findings in this document; prioritise
anything in the "High" or "Medium" buckets for fix-before-public.

## Verified-OK surfaces

The following were inspected and found free of obvious issues at the
time of audit. (Brief note on what was checked, not a full proof.)

- **`/ws/agent`** — Bearer token validated via HMAC pre-DB; DB hash
  compared after; per-message Zod validation; per-message ownership
  checks (`hostId == conn.hostId`) on `server_status_change`,
  `deployment_progress`, `log` (for `source='server'`), `backup_*`,
  `restore_*`, `agent_update_progress`. No SQL injection paths
  (Drizzle parameterised). `Origin` header not validated, but auth
  uses `Authorization: Bearer …` which browsers can't forge cross-
  origin, so CSWSH is N/A.
- **`/ws/terminal`** — session-cookie auth, UUID host id validation,
  ownership join, host-online check before bind. Session is a real
  Better Auth session; CSWSH would require cookie theft.
- **SSE streams** (host metrics, host logs, server logs) — UUID
  validation on path param; `getCurrentSession` + ownership join;
  same response (`Not found`) for invalid id and non-owner so no
  enumeration.
- **`crypto.ts`** — AES-256-GCM with 12-byte nonce per call, tag
  appended, version-prefixed (`v1:`) ciphertext envelope. Key length
  + hex format validated. Standard envelope shape.
- **Server Actions** for hosts/servers/backups/agent-updates/
  notifications — every state-changing action calls
  `getCurrentSession()` first and re-runs the ownership join (or
  inline `userId == session.user.id` filter) on the target row.
  Drizzle parameterised queries throughout. Audit log writes on every
  privileged action via `recordAudit`.
- **`waitlist.ts`** — Zod-validated email, randomBytes(32) token,
  parameterised insert/update, idempotent re-confirm. IP captured
  from `cf-connecting-ip` first then `x-forwarded-for[0]`.
- **`agent-token.ts`** — HMAC integrity check pre-DB, SHA-256 hash for
  storage (raw never persisted), constant-time HMAC compare via
  `crypto.timingSafeEqual` (after fix).

## What's NOT covered

Re-running this audit should add coverage for:

- Better Auth's CSRF, session, and cookie handling (assumed correct;
  validate on first prod scan)
- Email rendering (`@react-email/components` HTML output) — XSS
  potential if names/email subjects ever come from user input;
  current paths don't, but verify if that ever changes
- Agent host-side: `install.sh` download integrity (TLS to
  `serverfoundry.gg`, but no signature verify on the script itself —
  curl|bash trust assumption)
- Agent self-update signature verification — Phase 10 implementation
  uses ed25519 public key embedded at install time; needs end-to-end
  verification once a real signing pipeline exists (currently env-
  driven manifest, signing pipeline is Phase 11/12 backlog)
- Cloudflare Tunnel / WAF / Bot-Fight configuration — out of repo,
  audit at infra layer

## Re-audit triggers

Re-run this audit when:

- Adding any new `/api/*` route or `/ws/*` socket handler
- Modifying `'use server'` files (treat every new export as a public
  RPC unless gated)
- Changing the agent protocol (`src/shared/agent-protocol.ts`)
- Before flipping the landing page from soft-preview to public
- After any auth-related dependency bump (Better Auth, Drizzle, ws)
