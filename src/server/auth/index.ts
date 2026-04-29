import 'server-only'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

// Better Auth configuration.
// OAuth providers are registered conditionally — they activate only when their
// client ID/secret pair is configured in the environment. This keeps Phase 0/1
// running without OAuth credentials, and Phase 2 just fills in env vars.
const oauthProviders: Record<string, { clientId: string; clientSecret: string }> = {}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  oauthProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  }
}
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  oauthProviders.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  }
}
if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
  oauthProviders.discord = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: oauthProviders,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
})

export type Session = typeof auth.$Infer.Session
