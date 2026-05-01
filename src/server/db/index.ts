import { env } from '@/lib/env'
// Reachable from both Next.js routes and the custom server.ts WS
// handler. Omits `server-only` to avoid the tsx-vs-Next bundler
// mismatch — see src/lib/env.ts for the same note.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined
}

const client =
  globalForDb.client ??
  postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

if (env.NODE_ENV !== 'production') {
  globalForDb.client = client
}

export const db = drizzle(client, { schema, casing: 'snake_case' })
export type Db = typeof db
