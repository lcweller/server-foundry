'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // baseURL is inferred from the current origin in the browser; only set it
  // explicitly when running outside the browser (we don't need that here).
})

export const { signIn, signUp, signOut, useSession } = authClient
