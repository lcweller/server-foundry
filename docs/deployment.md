# Deployment

How Server Foundry is built, packaged, and deployed to Unraid.

## Architecture

```
GitHub repo (push to main)
       │
       ▼
GitHub Actions (.github/workflows/build.yml)
       │
       │ docker build
       │ run tests + lint
       │ push image
       ▼
GitHub Container Registry (ghcr.io)
       │
       │ user manually pulls
       ▼
Unraid Docker tab
       │
       │ runs container
       ▼
Cloudflare Tunnel
       │
       │ public TLS
       ▼
Public internet (serverfoundry.gg)
```

## Repo structure

```
server-foundry/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── tech-stack.md
│   ├── features.md
│   ├── data-model.md
│   ├── api.md
│   ├── security.md
│   ├── deployment.md
│   ├── conventions.md
│   ├── roadmap.md
│   └── branding.md
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (marketing)/      # Public landing
│   │   ├── (auth)/           # Login, signup, etc.
│   │   ├── (dashboard)/      # Authenticated app
│   │   ├── api/              # REST + WebSocket
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/               # shadcn/ui base
│   │   ├── marketing/        # Landing-specific
│   │   └── dashboard/        # Dashboard-specific
│   ├── lib/                  # Utilities, helpers
│   ├── server/
│   │   ├── actions/          # Server Actions
│   │   ├── auth/             # Better Auth config
│   │   ├── db/               # Drizzle setup (schema.ts, index.ts, migrate.ts)
│   │   ├── email/            # Resend client + helpers
│   │   └── ws/               # WebSocket server (Phase 4+)
│   ├── shared/               # Shared types (agent ↔ platform)
│   └── styles/
├── drizzle/
│   └── migrations/           # Generated SQL migrations (committed)
├── emails/                   # React Email templates
├── public/
├── .github/
│   └── workflows/
│       ├── build.yml         # Docker build + push
│       └── ci.yml            # Lint, typecheck, test on PR
├── Dockerfile
├── docker-compose.yml        # For local dev
├── biome.json
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

## Local development

### One-time setup

```bash
# Clone
git clone https://github.com/<your-username>/server-foundry.git
cd server-foundry

# Install deps (Bun preferred, npm fine)
bun install

# Spin up Postgres locally via Docker Compose
docker compose up -d postgres

# Copy env file and fill in values
cp .env.example .env.local
# Edit .env.local — Better Auth secret, Resend key, OAuth credentials

# Apply migrations
bun run db:migrate

# Start dev server
bun run dev
```

App runs on `http://localhost:3000`.

### docker-compose.yml (local dev only)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: foundry
      POSTGRES_PASSWORD: foundry_dev
      POSTGRES_DB: foundry
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

The web app is NOT run via Docker Compose locally — it runs via `bun run dev` for fast HMR.

## Production Dockerfile

Multi-stage build for minimal image size:

```dockerfile
# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: dependencies
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Install build deps
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# ============================================================
# Stage 2: build
# ============================================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for Next.js public env vars
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================================
# Stage 3: runner
# ============================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built artifacts (Next.js standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations bundled in image
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run migrations on startup, then start server
CMD ["sh", "-c", "node drizzle/migrate.js && node server.js"]
```

Notes:
- `output: 'standalone'` in `next.config.ts` produces a minimal runtime
- Migrations run on every container start (idempotent — Drizzle skips already-applied)
- Non-root user for security
- Healthcheck endpoint at `/api/health` returns 200 if DB is reachable

## GitHub Actions

### `.github/workflows/ci.yml` — runs on every PR

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: foundry
          POSTGRES_PASSWORD: foundry_test
          POSTGRES_DB: foundry_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Migrate
        run: npm run db:migrate
        env:
          DATABASE_URL: postgres://foundry:foundry_test@localhost:5432/foundry_test

      - name: Test
        run: npm run test
        env:
          DATABASE_URL: postgres://foundry:foundry_test@localhost:5432/foundry_test
```

### `.github/workflows/build.yml` — runs on push to main

```yaml
name: Build & Push Docker

on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=sha,prefix=,format=short
            type=raw,value=latest,enable={{is_default_branch}}

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_APP_URL=https://serverfoundry.gg
```

After this workflow succeeds, the image is available at:
```
ghcr.io/<your-username>/server-foundry:latest
ghcr.io/<your-username>/server-foundry:<short-sha>
ghcr.io/<your-username>/server-foundry:<branch-name>
```

## Unraid deployment

### Initial setup

1. **Create dedicated Docker network** (so app and Postgres can talk privately):
   - Unraid Docker tab → "Add Network"
   - Name: `foundry`
   - Driver: bridge

2. **Deploy Postgres container**:
   - Repository: `postgres:16-alpine`
   - Network: `foundry`
   - Variables:
     - `POSTGRES_USER`: `foundry`
     - `POSTGRES_PASSWORD`: <generate strong password, save in 1Password/etc>
     - `POSTGRES_DB`: `foundry`
   - Path mapping: `/mnt/user/appdata/foundry-postgres` → `/var/lib/postgresql/data`
   - **Do not expose port** to host — only accessible inside the `foundry` network

3. **Generate GitHub PAT for image pulling**:
   - GitHub → Settings → Developer settings → Personal access tokens (classic)
   - Scope: `read:packages`
   - Save the token

4. **Authenticate Unraid Docker with GHCR**:
   ```bash
   echo "<YOUR_PAT>" | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
   ```

5. **Deploy Server Foundry container**:
   - Repository: `ghcr.io/<your-username>/server-foundry:latest`
   - Network: `foundry`
   - Port mapping: `3000` → `3000`
   - Variables:
     - `DATABASE_URL`: `postgres://foundry:<password>@foundry-postgres:5432/foundry`
     - `BETTER_AUTH_SECRET`: <generated>
     - `BETTER_AUTH_URL`: `https://serverfoundry.gg`
     - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
     - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
     - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
     - `RESEND_API_KEY`
     - `RESEND_WEBHOOK_SECRET`
     - `AGENT_HMAC_SECRET`: <generated>
     - `BACKUP_ENCRYPTION_KEY`: <generated>
     - `NEXT_PUBLIC_APP_URL`: `https://serverfoundry.gg`
   - Restart policy: `unless-stopped`

### Cloudflare Tunnel configuration

Already configured on the Unraid host. Add a public hostname:

- **Subdomain**: `serverfoundry.gg` (apex) and `www.serverfoundry.gg`
- **Service**: `http://<unraid-ip>:3000`
- **Origin Server Name**: leave blank
- Cloudflare-side: enable "Always Use HTTPS", set "Edge Certificates" to "Full (strict)"

For the agent WebSocket endpoint, the same tunnel handles WSS — no separate config needed.

### Updates

Manual deployment workflow:

```bash
# On Unraid via SSH or terminal:
docker pull ghcr.io/<your-username>/server-foundry:latest

# Stop and remove the old container
docker stop server-foundry
docker rm server-foundry

# Start new (Unraid Docker UI handles this — just hit "Update" or restart the container)
```

Or use Unraid's "Check for Updates" — it'll show when the image has been updated.

### Database backups

Set up nightly backup via Unraid's `User Scripts` plugin:

```bash
#!/bin/bash
# Nightly Postgres backup for Server Foundry
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/mnt/user/backups/foundry"
mkdir -p "$BACKUP_DIR"

docker exec foundry-postgres pg_dump -U foundry -d foundry | \
  gzip > "$BACKUP_DIR/foundry-$TIMESTAMP.sql.gz"

# Keep last 30 days
find "$BACKUP_DIR" -name "foundry-*.sql.gz" -mtime +30 -delete
```

Schedule: daily at 3am.

## Local-prod parity

To keep local dev close to production:
- Same Postgres major version (16)
- Same Node major version (22)
- Same Next.js, React versions
- `.env.local` mirrors production env shape (different values)
- Run `npm run build && npm run start` periodically to test production build locally

## Rollback

If a deployment breaks production:

```bash
# Pull a previous version by SHA
docker pull ghcr.io/<your-username>/server-foundry:<previous-sha>

# Update the Unraid container's repository field to use that tag
# Restart container
```

GitHub Actions tags every build with the short SHA, so rollback to any previous build is one config change away.

## Health checks

- App-level: `GET /api/health` returns 200 if DB connection works, 503 otherwise
- Container-level: `HEALTHCHECK` in Dockerfile uses the same endpoint
- Cloudflare Tunnel: monitors origin and shows health in Cloudflare dashboard
- Optional: external uptime monitoring (UptimeRobot, BetterStack) for landing page

## Logs

- Container logs: `docker logs server-foundry -f` on Unraid
- Persisted: configure Unraid to forward Docker logs to a file (Unraid's Logs tab) or a syslog endpoint
- Production-grade: future migration to Loki + Grafana on Unraid

## Performance tuning

For the launch and early users, defaults are fine. When optimization becomes necessary:

- Next.js `standalone` output already minimizes container size
- Postgres connection pool: start at 10 connections (configurable in `src/server/db/index.ts`)
- Add Redis container for session cache + rate limit counters when needed
- Cloudflare caching for static assets (already automatic)
