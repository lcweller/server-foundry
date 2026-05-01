# Runbook — first public deploy

The single checklist for flipping `serverfoundry.gg` from soft-preview
to publicly indexable. Work top to bottom; every box must be checked
before tweeting the URL. Anything that fails is a stop-the-line — go
back to soft-preview and fix before retrying.

Replace `serverfoundry.gg` below with the actual deploy domain if it
differs.

## 1. Pre-flight (before push)

- [ ] **All secrets rotated to production values.** No dev/test
  tokens in the running env. Inventory the `.env.local` shape against
  the running container's env:
  ```bash
  ssh unraid "docker exec server-foundry env | sort | grep -E '_(SECRET|KEY|TOKEN|PASSWORD)='"
  ```
  Cross-check against `docs/security.md` § "Secrets the platform
  needs". Anything matching `dev_`, `test_`, `local_`, `re_test_`,
  `XXXX`, etc. is a fail. Rotate via the relevant provider dashboard
  (Resend / OAuth providers / `openssl rand -hex 32` for the in-
  house secrets) before continuing.

- [ ] **Cloudflare WAF rules active.** Confirm in the Cloudflare
  dashboard → Security → WAF: at minimum the OWASP Core Ruleset is on
  in *Block* mode (not Log), Bot Fight Mode is on for the public
  zone, and rate-limit rules exist for `/api/auth/*` and
  `/api/waitlist*` (see next item).

- [ ] **Rate limiting on `/api/waitlist` and `/api/auth/*` verified
  active.** From a host outside the Cloudflare network, run:
  ```bash
  for i in {1..30}; do
    curl -s -o /dev/null -w "%{http_code}\n" \
      -X POST https://serverfoundry.gg/api/auth/sign-in/email \
      -H 'content-type: application/json' \
      -d '{"email":"ratelimit-probe@example.invalid","password":"x"}'
  done
  ```
  Expected: a mix of `400`/`401` for the first ~10 requests, then
  `429` for the rest. If everything is still `400`/`401` after 30
  attempts, the limiter is not active — stop and fix.

## 2. Deploy

- [ ] **Push the tagged commit.** Use the release commit SHA (the one
  that will be tagged in step 9):
  ```bash
  git push origin main
  ```
  GitHub Actions builds the image and pushes to ghcr.io. Wait for the
  build job green before continuing.

- [ ] **Pull the new image on Unraid and restart the container.** Via
  the Unraid Docker tab or:
  ```bash
  ssh unraid "docker pull ghcr.io/serverfoundry/server-foundry:latest \
    && docker restart server-foundry"
  ```

## 3. Live-deploy verification

- [ ] **Cloudflare Tunnel health green.** Cloudflare dashboard →
  Zero Trust → Networks → Tunnels: the tunnel for `serverfoundry.gg`
  shows status `HEALTHY` with at least one connector. From a fresh
  curl:
  ```bash
  curl -sSI https://serverfoundry.gg/ | head -1
  ```
  Expected: `HTTP/2 200`. Anything else (520, 521, 522 — Cloudflare
  origin errors) means the tunnel isn't reaching the container.

- [ ] **HSTS + CSP headers present in production.**
  ```bash
  curl -sSI https://serverfoundry.gg/ | grep -iE \
    '^(strict-transport-security|content-security-policy|x-content-type-options|x-frame-options|referrer-policy|permissions-policy):'
  ```
  Expected, all six headers present:
  - `strict-transport-security: max-age=31536000; includeSubDomains`
  - `content-security-policy: …` (matches the policy in
    `docs/security.md` § "Content Security Policy")
  - `x-content-type-options: nosniff`
  - `x-frame-options: DENY`
  - `referrer-policy: strict-origin-when-cross-origin`
  - `permissions-policy: camera=(), microphone=(), geolocation=()`
  Missing or weakened directive → fail.

- [ ] **Agent install script returns 200 over HTTPS.**
  ```bash
  curl -sSI https://serverfoundry.gg/install.sh | head -1
  curl -sS https://serverfoundry.gg/install.sh | head -3
  ```
  Expected: `HTTP/2 200` and the first line starts with `#!/usr/bin/env
  bash`. If the redirect/path serves anything else, the agent
  installer is broken before it ever runs.

## 4. Functional smoke

- [ ] **Real-flow signup → confirmation email → login.** Use a real
  inbox you control (not an alias):
  1. Open `https://serverfoundry.gg/` in a clean browser profile
  2. Enter the email in the waitlist form, submit
  3. Check the inbox — confirmation email should arrive within 60s
     from `<FROM_EMAIL>`
  4. Click the confirmation link — `/waitlist/confirm` shows "You're
     in"
  5. Hit `/signup`, register with the same email
  6. Verify email via the second mail
  7. Log in via `/login`
  8. Land on `/dashboard` (empty state — no hosts yet)

  If any step fails, stop. Most likely failure mode is Resend mis-
  configuration or `BETTER_AUTH_URL` mismatch.

- [ ] **Backup job ran at least once.** Even with no game servers
  yet, the Postgres backup configured in Unraid must have produced an
  artifact:
  ```bash
  ssh unraid "ls -lh /mnt/user/backups/server-foundry-postgres/ | tail -3"
  ```
  Expected: at least one `.sql.gz` (or whatever the backup format is)
  with a recent timestamp and non-zero size. If the dir is empty,
  Unraid's backup task didn't fire — investigate before public.

## 5. Security smoke

These two scans take 20–40 minutes each. Run them in parallel in
separate terminals; while they run, work through step 7 below.

- [ ] **OWASP ZAP baseline scan against the live URL.**
  ```bash
  docker run --rm -v $(pwd):/zap/wrk/:rw \
    ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
    -t https://serverfoundry.gg \
    -r zap-baseline-$(date +%Y%m%d).html
  ```
  Save the report alongside the runbook in `docs/runbooks/scans/`.

- [ ] **nikto scan against the live URL.**
  ```bash
  nikto -h https://serverfoundry.gg \
    -o docs/runbooks/scans/nikto-$(date +%Y%m%d).txt
  ```

- [ ] **Triage scan findings against `docs/pen-test-2026-05.md`.**
  Walk both reports. For each finding:
  - Already covered in pen-test-2026-05's "Fixed" section → ignore
  - Already covered in "Deferred" section → cross-reference, decide
    if the live evidence elevates it (e.g., scanner confirms a
    deferred low to actionable now)
  - Not in pen-test-2026-05 → **new finding**. Add it to that doc
    under a new "2026-MM-DD live scan" section, classify (high /
    medium / low), and decide fix-now-or-defer. Anything high or
    medium MUST be fixed before flipping public.

## 6. Tag the release

- [ ] **Tag the deployed image so rollback is trivial.** Run on the
  exact commit that was pushed in step 2:
  ```bash
  git tag -a v0.1.0-public -m "First public deploy"
  git push origin v0.1.0-public
  ```
  Rollback path if a regression surfaces in the next 24h:
  ```bash
  ssh unraid "docker pull ghcr.io/serverfoundry/server-foundry:v0.1.0-public \
    && docker tag ghcr.io/serverfoundry/server-foundry:v0.1.0-public \
                  ghcr.io/serverfoundry/server-foundry:latest \
    && docker restart server-foundry"
  ```

## 7. Then — flip public

Only after every box above is green:

- [ ] Update `robots.ts` if it currently `disallow`s anything we now
  want indexed (today it disallows `/api/` and `/waitlist/confirm` —
  leave both, those are correct).
- [ ] Submit `https://serverfoundry.gg/sitemap.xml` to Google Search
  Console.
- [ ] Tweet / share the URL.

---

## Re-audit triggers

When any of the following happens *after* first public deploy, the
work is not done — re-run `docs/pen-test-2026-05.md`'s findings list
against the relevant surface and update that doc with new findings.
This list is the source of truth; the pen-test doc points here.

- Adding any new `/api/*` route or `/ws/*` socket handler
- Modifying any `'use server'` file (treat every new export as a
  public RPC unless gated)
- Changing the agent protocol (`src/shared/agent-protocol.ts`)
- Auth-related dependency bump (Better Auth, Drizzle, `ws`,
  `next-auth-*`)
- Any new Server Action or REST endpoint that handles secrets,
  cross-tenant data, or unauthenticated traffic
- Any change to the agent's WS handler ownership/auth path
  (`src/server/ws/agent-handler.ts`)
- Cloudflare WAF rule changes — re-run the rate-limit probe in step 1
- Pre-launch quarterly cadence: even with no triggers above, re-run
  ZAP baseline + nikto every 90 days while the service is public,
  triage delta into `docs/pen-test-YYYY-MM.md`
