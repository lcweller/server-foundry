// Loaded by both Next.js routes and the custom server.ts. The
// `server-only` guard would throw at custom-server boot (tsx doesn't
// have Next's bundler shim), so we omit it here. This module imports
// `process.env` directly — it cannot run in the browser regardless.
import { z } from 'zod'

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  // OAuth — optional during Phase 0/1; required when those flows go live
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Email — required for Phase 1 waitlist
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('hello@serverfoundry.gg'),

  // Analytics — optional. When set in production, loads Cloudflare Web Analytics.
  CLOUDFLARE_ANALYTICS_BEACON_TOKEN: z.string().optional(),

  // Agent — required for Phase 4+
  AGENT_HMAC_SECRET: z.string().optional(),
  BACKUP_ENCRYPTION_KEY: z.string().optional(),

  // Agent self-update (Phase 10) — recommended version + signed
  // download URL. Optional; when unset the manifest endpoint returns
  // the current AGENT_VERSION constant with no upgrade target.
  AGENT_UPDATE_VERSION: z.string().max(64).optional(),
  AGENT_UPDATE_DOWNLOAD_URL: z.string().url().optional(),
  AGENT_UPDATE_SIGNATURE: z.string().max(512).optional(),
  AGENT_UPDATE_SHA256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
})

export type Env = z.infer<typeof envSchema>

// Build-time shim — Next.js evaluates env validation during page-data
// collection, where production secrets are not available. Runtime
// validation in the runner stage is unaffected: SKIP_ENV_VALIDATION is
// set only in the Docker builder stage and the CI build step, never in
// the runner image or production environment.
let resolvedEnv: Env

if (process.env.SKIP_ENV_VALIDATION) {
  // TEMPORARY: build-time stubs for SKIP_ENV_VALIDATION mode.
  // These satisfy schema validation during `next build` page-data
  // collection. Several modules (Resend, Postgres, Better Auth)
  // read env values at module-load time and crash on undefined,
  // so we can't simply cast process.env — we need real strings.
  //
  // TODO(env-lazy-init): refactor module-load consumers in
  // src/server/email/client.ts, src/server/db/index.ts, and
  // src/server/auth/index.ts to lazy-init their clients. When
  // that's done, this stub block can be replaced with a true
  // short-circuit cast.
  const stubs = {
    DATABASE_URL: 'postgres://stub:stub@localhost:5432/stub',
    BETTER_AUTH_SECRET: 'stub_secret_min_32_chars_for_validation',
    BETTER_AUTH_URL: 'http://localhost:3000',
    RESEND_API_KEY: 're_stub_build_only',
  }
  const parsed = envSchema.safeParse({ ...stubs, ...process.env })
  if (!parsed.success) {
    console.error('SKIP_ENV_VALIDATION stub parse failed:', parsed.error.flatten().fieldErrors)
    throw new Error(
      'SKIP_ENV_VALIDATION stub schema mismatch — add the missing required var to the stub block in src/lib/env.ts',
    )
  }
  resolvedEnv = parsed.data
} else {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables — see logs above')
  }
  resolvedEnv = parsed.data
}

export const env: Env = resolvedEnv
