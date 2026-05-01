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

// Per-game config form schemas. The deploy wizard renders these field
// definitions server-side; the agent treats `config` as opaque JSON.

const VALHEIM_CONFIG_SCHEMA = {
  fields: [
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

const CS2_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'gameServerLoginToken',
      label: 'Game Server Login Token (GSLT)',
      type: 'string',
      required: true,
      maxLength: 64,
      help: 'Issue one at https://steamcommunity.com/dev/managegameservers. Required by Valve to host a public CS2 server.',
    },
    {
      key: 'map',
      label: 'Starting map',
      type: 'string',
      required: false,
      default: 'de_dust2',
      maxLength: 64,
    },
    {
      key: 'maxPlayers',
      label: 'Max players',
      type: 'string',
      required: false,
      default: '10',
      help: '1–64.',
    },
  ],
} as const

const RUST_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'description',
      label: 'Server description',
      type: 'string',
      required: false,
      maxLength: 256,
      default: 'A Server Foundry Rust server.',
    },
    {
      key: 'rconPassword',
      label: 'RCON password',
      type: 'string',
      required: true,
      minLength: 8,
      maxLength: 64,
      help: 'Used to administer the server remotely. Keep it secret.',
    },
    {
      key: 'maxPlayers',
      label: 'Max players',
      type: 'string',
      required: false,
      default: '50',
    },
    {
      key: 'seed',
      label: 'World seed',
      type: 'string',
      required: false,
      default: '1234',
    },
    {
      key: 'worldSize',
      label: 'World size',
      type: 'string',
      required: false,
      default: '3000',
      help: '1000–6000.',
    },
  ],
} as const

const ARK_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'map',
      label: 'Map',
      type: 'string',
      required: false,
      default: 'TheIsland',
      maxLength: 64,
      help: 'TheIsland, ScorchedEarth_P, Aberration_P, Extinction, Genesis, etc.',
    },
    {
      key: 'password',
      label: 'Server password',
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 32,
    },
    {
      key: 'adminPassword',
      label: 'Admin password',
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 32,
    },
    {
      key: 'maxPlayers',
      label: 'Max players',
      type: 'string',
      required: false,
      default: '70',
    },
    {
      key: 'queryPort',
      label: 'Query port',
      type: 'string',
      required: false,
      default: '27015',
      help: 'UDP port Steam uses to list the server. Open this too.',
    },
  ],
} as const

const TERRARIA_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'worldName',
      label: 'World name',
      type: 'string',
      required: true,
      pattern: '^[A-Za-z0-9_-]{1,32}$',
      default: 'world',
    },
    {
      key: 'password',
      label: 'Server password (optional)',
      type: 'string',
      required: false,
      maxLength: 32,
    },
    {
      key: 'maxPlayers',
      label: 'Max players',
      type: 'string',
      required: false,
      default: '8',
      help: '1–16.',
    },
  ],
} as const

const PROJECT_ZOMBOID_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'adminPassword',
      label: 'Admin password',
      type: 'string',
      required: true,
      minLength: 4,
      maxLength: 64,
    },
    {
      key: 'password',
      label: 'Server password (optional)',
      type: 'string',
      required: false,
      maxLength: 64,
    },
  ],
} as const

const SEVEN_DAYS_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'note',
      label: 'Note',
      type: 'string',
      required: false,
      maxLength: 256,
      default:
        'Server config (max players, password, world type, etc.) is set via serverconfig.xml in the install dir. Edit it via the host terminal.',
    },
  ],
} as const

const MINECRAFT_CONFIG_SCHEMA = {
  fields: [
    {
      key: 'eulaAccepted',
      label: "I accept Mojang's EULA (https://account.mojang.com/documents/minecraft_eula)",
      type: 'boolean',
      required: true,
      default: false,
    },
    {
      key: 'maxRam',
      label: 'Max RAM (e.g. 4G)',
      type: 'string',
      required: false,
      default: '4G',
      maxLength: 8,
    },
    {
      key: 'minRam',
      label: 'Min RAM (e.g. 1G)',
      type: 'string',
      required: false,
      default: '1G',
      maxLength: 8,
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
  {
    slug: 'cs2',
    name: 'Counter-Strike 2',
    description: "Valve's competitive shooter. Requires a GSLT from Steam.",
    steamAppId: 730,
    defaultPort: 27015,
    minRamMb: 2048,
    recRamMb: 4096,
    configSchemaJson: CS2_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'rust',
    name: 'Rust',
    description: 'Open-world survival. Server size scales with world + players.',
    steamAppId: 258550,
    defaultPort: 28015,
    minRamMb: 4096,
    recRamMb: 8192,
    configSchemaJson: RUST_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'ark',
    name: 'ARK: Survival Evolved',
    description: 'Dinosaur survival. Note: install is ~30 GB.',
    steamAppId: 376030,
    defaultPort: 7777,
    minRamMb: 6144,
    recRamMb: 12288,
    configSchemaJson: ARK_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'terraria',
    name: 'Terraria',
    description: 'Sandbox 2D adventure. Lightweight; runs anywhere.',
    steamAppId: 105600,
    defaultPort: 7777,
    minRamMb: 512,
    recRamMb: 1024,
    configSchemaJson: TERRARIA_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'project-zomboid',
    name: 'Project Zomboid',
    description: 'Isometric zombie survival. Up to 32 players.',
    steamAppId: 380870,
    defaultPort: 16261,
    minRamMb: 2048,
    recRamMb: 4096,
    configSchemaJson: PROJECT_ZOMBOID_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'seven-days-to-die',
    name: '7 Days to Die',
    description: 'Voxel zombie survival. Config lives in serverconfig.xml.',
    steamAppId: 294420,
    defaultPort: 26900,
    minRamMb: 4096,
    recRamMb: 8192,
    configSchemaJson: SEVEN_DAYS_CONFIG_SCHEMA,
    isEnabled: true,
  },
  {
    slug: 'minecraft-java',
    name: 'Minecraft (Java)',
    description: 'Vanilla Minecraft Java edition. Custom installer ships in a follow-up.',
    steamAppId: null,
    defaultPort: 25565,
    minRamMb: 1024,
    recRamMb: 4096,
    configSchemaJson: MINECRAFT_CONFIG_SCHEMA,
    isEnabled: false,
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
