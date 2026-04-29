# Conventions

Code style, file structure, and patterns for Server Foundry.

## File and folder naming

- **Components**: PascalCase, one component per file (`Button.tsx`, `HostCard.tsx`)
- **Hooks**: camelCase, prefixed with `use` (`useHostMetrics.ts`)
- **Utilities**: camelCase (`formatBytes.ts`, `cn.ts`)
- **Server Actions**: camelCase, action-named (`joinWaitlist.ts`, `deployGameServer.ts`)
- **Types**: PascalCase, in `types.ts` files or alongside their owner (`Host.ts`)
- **Folders**: kebab-case (`game-servers/`, `waitlist-form/`)
- **Pages (App Router)**: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`

## TypeScript

### Strict mode
`tsconfig.json` enables:
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "verbatimModuleSyntax": true,
  "exactOptionalPropertyTypes": true
}
```

### Types over interfaces
Prefer `type` aliases. Use `interface` only when extending or when explicitly needed.

```ts
// Good
type User = { id: string; email: string }

// Use interface only for class declarations or when intentional
interface Repository<T> {
  find(id: string): Promise<T | null>
}
```

### Avoid `any`
`any` is banned by Biome. Use `unknown` when the type is genuinely unknown, then narrow.

### Exhaustive switches
```ts
function describeStatus(status: HostStatus): string {
  switch (status) {
    case 'online': return 'Online'
    case 'offline': return 'Offline'
    case 'connecting': return 'Connecting'
    case 'updating': return 'Updating'
    default: {
      const _exhaustive: never = status
      throw new Error(`Unhandled status: ${_exhaustive}`)
    }
  }
}
```

### Imports
- Absolute imports via `@/*` alias for everything in `src/`
- Side-effect imports first (e.g. `'server-only'`, `'./styles.css'`)
- External packages, then internal
- Type-only imports use `import type`

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/server/db'
import { hosts } from '@/server/db/schema'
import type { Host } from '@/types'
```

## React

### Server Components by default
A component is a Server Component unless it explicitly needs interactivity. Mark Client Components with `'use client'` at the top.

### When to use Client Components
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- React state and effects (`useState`, `useEffect`, `useReducer`)
- Third-party libraries that require client (Framer Motion, xterm.js)

### Server Actions for mutations
```tsx
// src/server/actions/waitlist.ts
'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { waitlistSignups } from '@/server/db/schema'

const schema = z.object({
  email: z.string().email(),
  source: z.string().optional()
})

export async function joinWaitlist(input: unknown) {
  const data = schema.parse(input)
  await db.insert(waitlistSignups).values(data).onConflictDoNothing()
  return { ok: true }
}
```

### Component file structure
```tsx
// 1. Imports
import { cn } from '@/lib/utils'

// 2. Types (exported if reused)
type Props = {
  title: string
  variant?: 'default' | 'highlighted'
}

// 3. Component
export function Card({ title, variant = 'default' }: Props) {
  return <div className={cn('rounded-2xl', variant === 'highlighted' && 'border-accent')}>{title}</div>
}

// 4. Sub-components if any (kept private to file unless needed elsewhere)
```

### Avoid prop drilling
For more than 2-3 levels, use Context (Client) or pass via Server Component composition.

### Keys
Always use stable, unique keys. Index keys are a code smell unless the list is truly static.

## Styling

### Tailwind CSS 4
- Use utility classes, not custom CSS
- Use `cn()` helper for conditional class combinations
- Define design tokens in `@theme` block
- Avoid arbitrary values (`w-[57px]`) when a token exists; use them when it doesn't

### `cn()` utility
```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Component variants
For variants beyond simple boolean toggles, use `class-variance-authority`:

```ts
import { cva } from 'class-variance-authority'

const buttonVariants = cva('rounded-lg font-medium', {
  variants: {
    variant: {
      primary: 'bg-accent text-white',
      secondary: 'border border-border'
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2'
    }
  },
  defaultVariants: { variant: 'primary', size: 'md' }
})
```

## Error handling

### Server Actions return discriminated unions
```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }

export async function deployServer(input: unknown): Promise<ActionResult<{ serverId: string }>> {
  try {
    // ...
    return { ok: true, data: { serverId } }
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false, error: err.message, code: 'VALIDATION_ERROR' }
    }
    return { ok: false, error: 'Something went wrong' }
  }
}
```

### Custom error classes
```ts
// src/lib/errors.ts
export class ValidationError extends Error {
  code = 'VALIDATION_ERROR'
}
export class UnauthorizedError extends Error {
  code = 'UNAUTHORIZED'
}
export class NotFoundError extends Error {
  code = 'NOT_FOUND'
}
```

### Don't swallow errors
```ts
// Bad
try { await something() } catch {}

// Good — log it, even if you don't surface it
try { await something() } catch (err) {
  logger.warn({ err }, 'something failed; continuing')
}
```

## Database

### Use Drizzle queries, not raw SQL
```ts
// Good
const host = await db.query.hosts.findFirst({
  where: eq(hosts.id, hostId)
})

// Use raw SQL only for things Drizzle can't express
```

### Always include soft-delete filter
```ts
// Bad — returns soft-deleted hosts
const host = await db.query.hosts.findFirst({ where: eq(hosts.id, id) })

// Good
const host = await db.query.hosts.findFirst({
  where: and(eq(hosts.id, id), isNull(hosts.deletedAt))
})
```

### Wrap multi-step operations in transactions
```ts
await db.transaction(async (tx) => {
  await tx.insert(hosts).values({...})
  await tx.insert(notifications).values({...})
})
```

### Migrations: never destructive without two phases
1. Add new column (nullable initially)
2. Backfill data, switch reads/writes
3. In a separate migration: drop old column

## Logging

### Use Pino, not console.log
```ts
import { logger } from '@/lib/logger'

logger.info({ userId, hostId }, 'host removed')
logger.warn({ err, context }, 'auth failed')
logger.error({ err }, 'database connection lost')
```

### Log levels
- `error` — something went wrong, action required
- `warn` — something is suspicious or degraded
- `info` — meaningful business events (signup, host added, server deployed)
- `debug` — detailed diagnostics, off in production

### Never log secrets or PII at info level
- Pino redaction config strips `password`, `token`, `apiKey`, `authorization`, etc.
- Don't log full email addresses at info level — log `userId` instead

## Validation

### Validate at every boundary
- Form submissions: Zod schema in Server Action
- API request bodies: Zod schema in route handler
- Environment variables: Zod schema in `src/lib/env.ts`
- Agent messages: Zod schema in `src/shared/agent-protocol.ts`

### Reuse schemas
Don't duplicate Zod schemas — define once, infer types from them:
```ts
const userSchema = z.object({ id: z.string().uuid(), email: z.string().email() })
type User = z.infer<typeof userSchema>
```

## Testing

### Vitest for units
- Test pure logic and Server Actions
- Mock the database with a test container or in-memory adapter
- Don't test UI implementation details — test behavior

### Playwright for E2E
- Test the critical path: signup → waitlist → confirmation email
- As features ship: add a P1 path per phase
- Run E2E in CI on every PR

### Test file location
- Unit tests: `[file].test.ts` next to the file
- E2E tests: `e2e/[feature].spec.ts`

## Git

### Branch naming
- `feature/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — non-feature work
- `docs/<short-description>` — docs only

### Commit messages
Conventional Commits format:
```
feat(landing): add waitlist form
fix(auth): prevent double-submission of signup
chore(deps): update next to 16.0.3
docs(api): document agent WebSocket protocol
refactor(db): extract user queries to repo file
```

No "Generated by Claude" or co-author lines.

### PR size
Smaller is better. Anything > 500 LOC needs justification. Bundle related changes; split unrelated.

## Comments

- Code should be self-documenting; comments explain *why*, not *what*
- TODO comments must include context: `// TODO(cwell): wire to backend once metrics_hourly table populates`
- Don't leave commented-out code; delete it (Git remembers)

## Performance

### Server Components first
Default to fetching data on the server. Only push to client when interactivity is needed.

### Streaming
Use Suspense boundaries to stream slow data without blocking the whole page.

```tsx
<Suspense fallback={<Skeleton />}>
  <HostMetrics hostId={hostId} />
</Suspense>
```

### Image optimization
Always use `next/image` for images. Provide explicit `width` and `height`.

### Avoid re-renders
- Memoize expensive calculations with `useMemo` only when measured
- Don't reach for `React.memo` proactively — it's a yak you don't need to shave

## Accessibility

- Semantic HTML always: `<button>`, `<nav>`, `<header>`, `<main>`, `<section>`
- Form inputs always have `<label>` (visible or `sr-only`)
- Keyboard navigation must work for every interactive element
- Color contrast: AA minimum, AAA preferred for body text
- Focus states visible (don't `outline: none` without replacement)
- ARIA only when semantic HTML isn't sufficient

## Things to avoid

- `any` type
- `// @ts-ignore` (use `// @ts-expect-error` with explanation if necessary)
- `eslint-disable` lines without explanation
- `console.log` in committed code (use `logger`)
- `dangerouslySetInnerHTML` without sanitization
- Synchronous network calls
- Catching errors only to swallow them
- New dependencies without justification
- Premature abstraction
- Over-engineering for hypothetical future requirements
