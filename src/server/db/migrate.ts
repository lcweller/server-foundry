import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set — copy .env.example to .env.local and fill it in')
  process.exit(1)
}

const client = postgres(databaseUrl, { max: 1 })
const db = drizzle(client)

async function main() {
  console.info('Running migrations from drizzle/migrations…')
  await migrate(db, { migrationsFolder: 'drizzle/migrations' })
  console.info('Migrations complete.')
  await client.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
