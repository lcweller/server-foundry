# Tech Stack

Every technology choice for Server Foundry, with rationale and version pins.

## Frontend

### Next.js 16 (App Router)
- React Server Components by default
- Server Actions for mutations
- Built-in image optimization, font optimization, route groups
- Turbopack for dev (stable in 16)
- File-based routing in `/app`

### React 19
- Server Components, Suspense, `use()` API
- Form Actions native to forms
- Document metadata API
- Optimistic updates with `useOptimistic`

### TypeScript 5.6+
- Strict mode enabled
- `verbatimModuleSyntax: true`
- Path aliases (`@/*` → `./src/*`)

### Tailwind CSS 4
- New engine, no PostCSS required
- CSS variables for theming (light/dark)
- `@theme` blocks instead of `tailwind.config.js`

### shadcn/ui
- Copy-paste component library, not a dependency
- Tailwind-based, fully customizable
- Used for: Button, Input, Card, Dialog, Toast, Form, Tabs, Dropdown, Skeleton, etc.

### Lucide React
- Icon library, tree-shakeable
- Used for all UI icons

### Framer Motion
- Page transitions and micro-interactions
- Use sparingly — performance over animation

## State / Data

### Drizzle ORM
- Type-safe SQL builder
- Generates migrations from schema definition
- Edge-runtime compatible
- Works with Postgres, MySQL, SQLite (we use Postgres)
- `drizzle-kit` for migration generation
- `drizzle-zod` for runtime schema validation

### Postgres 16
- Containerized via official `postgres:16-alpine` Docker image
- Runs as separate container on same Unraid host
- JSONB for flexible config schemas
- Connection pooling via `pg-pool`

### Zod
- Runtime validation for everything that crosses a boundary (form input, API request body, env vars, agent messages)
- Schema-first: define once, infer TypeScript type, validate at runtime

### TanStack Query (React Query)
- Client-side data fetching and caching for components that need real-time updates
- Server Components handle most fetching; React Query for the live/interactive parts

## Auth

### Better Auth
- Modern alternative to NextAuth/Auth.js
- Native Google + GitHub + Discord OAuth providers
- Email/password with verification flows
- Session management via signed cookies
- TypeScript-first, framework-agnostic
- Supports magic links, 2FA, organization features (future)

**Why Better Auth over NextAuth/Clerk/Lucia:**
- More flexible than NextAuth's plugin model
- Self-hosted (Clerk requires you to host with them)
- Active development, modern patterns
- Better TypeScript inference than alternatives

## Email

### Resend
- Best DX for transactional email
- React Email templates (`@react-email/components`) for type-safe email composition
- Free tier: 3,000 emails/month, 100/day — plenty for waitlist + auth flows
- Webhooks for delivery tracking (future)

### React Email
- Compose emails as React components
- Preview locally during development
- Used for: welcome email, email verification, waitlist confirmation, notifications

## Real-time

### `ws` (WebSocket library)
- Standard Node.js WebSocket implementation
- Used for the agent ↔ platform connection
- Lightweight, battle-tested

### Server-Sent Events (SSE)
- Native browser API, no library needed
- Used for one-way streaming from server to dashboard (live metrics, log tail)
- Falls back gracefully on slow connections

## Dev tools

### Bun (or Node 22)
- Bun for local dev (faster install, faster test runner)
- Node 22 in production Docker image (more conservative for runtime)
- Decision can flip later if Bun stabilizes more in production

### Biome
- Replaces ESLint + Prettier with one tool
- Faster (Rust-based)
- Sensible defaults, less config noise
- `npm run lint` → `biome check`
- `npm run format` → `biome format --write`

### Vitest
- Vite-native test runner
- Fast, ESM-native
- Used for unit tests of utilities and Server Actions
- `npm run test`

### Playwright
- E2E tests for critical flows
- `npm run test:e2e`
- Initially: signup → waitlist confirmation. Will expand as features ship.

## Infrastructure

### Docker
- Single Dockerfile for the web app
- Multi-stage build: deps → build → runner
- Final image based on `node:22-alpine` for minimal size
- Postgres in separate official container

### GitHub Actions
- Build Docker image on push to `main`
- Push to GitHub Container Registry (`ghcr.io/[username]/server-foundry`)
- Run tests + lint on every PR
- Manual deployment to Unraid (you pull the image)

### Cloudflare Tunnel
- Public exposure without port forwarding
- TLS handled by Cloudflare
- Already configured on Unraid host

### GitHub Container Registry
- Free for public repos
- Authenticated pull from Unraid using a GitHub PAT

## Observability

### Pino
- Structured JSON logging
- Fast, low-overhead
- Used in both web app and (future) agent

### Sentry (future)
- Error tracking for production
- Free tier: 5k errors/month
- Add when we have real users

## What we are NOT using

These were considered and rejected:

- **NextAuth/Auth.js** — too plugin-heavy, type inference is weaker, recent versions have rough edges. Better Auth is cleaner.
- **Clerk** — hosted only, doesn't fit self-hosted Unraid model.
- **Lucia** — author deprecated it; community forks exist but the ecosystem is uncertain.
- **Prisma** — Drizzle has better TypeScript inference and no codegen step.
- **tRPC** — Server Actions cover this need natively in Next.js 15+; no need for an extra abstraction.
- **Zustand/Jotai/Redux** — Server Components + URL state + React Query covers state management. No global client store needed.
- **CSS-in-JS (styled-components, Emotion)** — runtime cost, doesn't compose well with RSC. Tailwind is the better choice.
- **GraphQL** — overkill for this product. Server Actions + REST suffices.
- **Vercel** — user preference for self-hosted. Stack is portable; we can change later.
- **Supabase** — convenient but locks us into their auth + storage. Better Auth + Postgres + S3-compatible storage gives flexibility.
- **TypeScript decorators / experimental features** — stick to stable language features.

## Version pins (initial)

Lock these in `package.json`:

```json
{
  "next": "16.x",
  "react": "19.x",
  "react-dom": "19.x",
  "typescript": "5.6.x",
  "tailwindcss": "4.x",
  "drizzle-orm": "0.36.x",
  "drizzle-kit": "0.28.x",
  "postgres": "3.4.x",
  "better-auth": "1.x",
  "resend": "4.x",
  "@react-email/components": "0.0.x",
  "zod": "3.23.x",
  "ws": "8.x",
  "@tanstack/react-query": "5.x",
  "lucide-react": "0.450.x",
  "framer-motion": "11.x",
  "@biomejs/biome": "1.9.x",
  "vitest": "2.x",
  "@playwright/test": "1.x"
}
```

Update versions only with intentional review of changelogs. Don't `^` everything blindly.
