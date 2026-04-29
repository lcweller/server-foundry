import 'server-only'
import { env } from '@/lib/env'
import { db } from '@/server/db'
import { sendPasswordReset } from '@/server/email/send-password-reset'
import { sendVerifyEmail } from '@/server/email/send-verify-email'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'

// OAuth providers register only when their full credential pair is set in env.
// Phase 0 + 1 ran without any OAuth credentials; Phase 2 wires it on.
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  }
}
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  }
}
if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
  socialProviders.discord = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordReset({ to: user.email, name: user.name, url })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyEmail({ to: user.email, name: user.name, url })
    },
  },

  socialProviders,

  user: {
    // Allow account deletion from settings. UI requires the user to type
    // "delete my account" to confirm; we skip the email-verification round
    // trip Better Auth offers because the in-UI confirmation is sufficient
    // for an account that hasn't yet provisioned hosts.
    deleteUser: {
      enabled: true,
    },
    // Email change requires the user to click a link in the new address
    // before the change takes effect. Better Auth handles the token + email
    // send via the verification flow we already configured above.
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        newEmail,
        url,
      }: {
        newEmail: string
        url: string
      }) => {
        await sendVerifyEmail({ to: newEmail, name: '', url })
      },
    },
  },

  account: {
    accountLinking: {
      // A user signed up via email can later link Google/GitHub/Discord and
      // log in via any. Trusted providers verify the email at the OAuth
      // layer and we trust that here.
      enabled: true,
      trustedProviders: ['google', 'github', 'discord'],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh sliding window once per day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // nextCookies must be the LAST plugin — it sets cookies on the
  // outgoing response in Server Action contexts.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
export type AuthUser = (typeof auth.$Infer.Session)['user']
