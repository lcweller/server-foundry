# Backlog

Engineering items not yet scheduled into a phase but tracked for when
they bite again or when the relevant phase comes around.

## 1. Container boot smoke test in CI — HIGH

Add a CI job that builds the production Docker image, runs it for ~30
seconds with placeholder env vars sufficient to satisfy module-load,
and fails if the container exits non-zero or doesn't bind a port.

This catches the class of bugs that have hit production deploys five
times so far, none of which `next build` or the current CI catches:

- env validation crashing at build (build-time variant — same class)
- `public/` empty directory not tracked in git
- `import 'server-only'` directive throwing at module load
- `globalThis.AsyncLocalStorage` not initialised before scheduler boot
- `emails/` directory not copied into the runner stage

All five are runtime errors that only surface when the actual
production image is started. A 30-second boot smoke would have caught
every one.

### Approximate shape

GitHub Actions step in `.github/workflows/ci.yml` (or a new
`smoke.yml`):

```yaml
- name: Container boot smoke
  run: |
    docker build -t sf:smoke .
    docker run --rm -d --name sf-smoke \
      --env-file .ci/smoke.env -p 3000:3000 sf:smoke
    sleep 30
    docker inspect -f '{{.State.Running}}' sf-smoke | grep -q true
    curl -fsS http://127.0.0.1:3000/ > /dev/null
    docker kill sf-smoke
```

`.ci/smoke.env` holds non-secret placeholders (32-char dummy
`BETTER_AUTH_SECRET`, dummy `RESEND_API_KEY`, a `DATABASE_URL`
pointing at a sidecar Postgres service or a host that produces a
connection error rather than a module-load error).

### Priority

HIGH — do this immediately after the production deploy is verified
working. Every additional deploy without it is one more chance to
ship a sixth instance of this bug class.

---

## 2. Runner-stage `COPY` allowlist fragility — MEDIUM

The `Dockerfile` runner stage uses a hand-maintained allowlist of
paths copied from the builder stage. Any future top-level resource
added to the repo (template directories, asset directories, config
files) will silently miss the runner image until someone hits the
runtime crash.

The `emails/` miss in commit `dd0eae7` → next-commit hotfix is the
canonical example.

### Possible mitigations

a. **Switch to a deny-list.** COPY everything from the builder except
   `node_modules`, dev-only artefacts, and source-only files.
   Inverts the failure mode — accidentally include things rather
   than miss them. Trade-off: larger images, may include build
   artefacts we don't want in production.

b. **CI check.** Compare top-level entries in the builder context
   against top-level entries in the final image. Warn (or fail) on
   directories present in the source but missing in the runner.
   Cheaper than (a), preserves the allowlist's tightness, just
   notices when it falls out of date.

c. **Convention comment in the Dockerfile.** Document prominently
   above the runner-stage `COPY` block that *adding a top-level
   resource to the repo also requires adding a `COPY` line here*.
   Lowest-effort; doesn't actually catch the bug, just makes it
   easier for the next person to remember.

### Priority

MEDIUM — addressed reactively when it bites again, unless the boot
smoke test (item 1) makes it moot. The smoke test catches the
*symptom*; this catches the *cause* earlier.
