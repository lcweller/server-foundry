// Seed reference data into game_catalog. Idempotent — uses ON CONFLICT
// on the slug unique index so re-running upserts the latest definition.
//
// Run with: bun run db:seed (or `npm run db:seed`).
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { type NewGameCatalog, gameCatalog } from './schema'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in')
  process.exit(1)
}

// Per-game config form schema. The deploy wizard renders these field
// definitions server-side; the agent treats `config` as opaque JSON.
const VALHEIM_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'serverName',
      label: 'Server name',
      type: 'string',
      required: true,
      maxLength: 64,
      placeholder: 'My Valheim Server',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 32,
      help: 'Required by Valheim. Must be at least 5 characters.',
    },
    {
      key: 'world',
      label: 'World name',
      type: 'string',
      required: true,
      pattern: '^[A-Za-z0-9_-]{1,32}$',
      placeholder: 'Dedicated',
      default: 'Dedicated',
    },
    {
      key: 'public',
      label: 'List on community server browser',
      type: 'boolean',
      default: true,
    },
  ],
} as const

const games: NewGameCatalog[] = [
  {
    slug: 'valheim',
    name: 'Valheim',
    description: 'Viking survival co-op. Up to 10 players per world.',
    steamAppId: 896660,
    defaultPort: 2456,
    minRamMb: 2048,
    recRamMb: 4096,
    configSchemaJson: VALHEIM_CONFIG_SCHEMA,
    isEnabled: true,
  },
]

async function main() {
  const client = postgres(databaseUrl as string, { max: 1 })
  const db = drizzle(client)

  console.info(`Seeding ${games.length} game(s)…`)
  for (const game of games) {
    await db
      .insert(gameCatalog)
      .values(game)
      .onConflictDoUpdate({
        target: gameCatalog.slug,
        set: {
          name: game.name,
          description: game.description,
          steamAppId: game.steamAppId,
          defaultPort: game.defaultPort,
          minRamMb: game.minRamMb,
          recRamMb: game.recRamMb,
          configSchemaJson: game.configSchemaJson,
          isEnabled: game.isEnabled,
          updatedAt: new Date(),
        },
      })
    console.info(`  ✓ ${game.slug}`)
  }
  await client.end()
  console.info('Seed complete.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
