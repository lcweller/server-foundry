import { AppShell } from '@/components/app/app-shell'
import { requireUser } from '@/server/auth/session'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireUser()
  const u = session.user
  return (
    <AppShell user={{ id: u.id, email: u.email, name: u.name, image: u.image ?? null }}>
      {children}
    </AppShell>
  )
}
