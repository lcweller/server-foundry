import 'server-only'
import { auth } from '@/server/auth'
import type { Route } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Get the current session if one exists. Returns null when unauthenticated.
export async function getCurrentSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session ?? null
}

// Same as getCurrentSession but redirects to /login when there's no user.
// Use in server components or layouts that require authentication.
export async function requireUser(redirectTo: Route = '/login') {
  const session = await getCurrentSession()
  if (!session?.user) {
    redirect(redirectTo)
  }
  return session
}
