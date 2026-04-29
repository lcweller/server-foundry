import { requireUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { accounts as accountsTable } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { DangerZoneSection } from './danger-zone-section'
import { EmailSection } from './email-section'
import { LinkedAccountsSection } from './linked-accounts-section'
import { PasswordSection } from './password-section'
import { ProfileSection } from './profile-section'

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
}

export default async function SettingsPage() {
  const { user } = await requireUser()

  // Look up which providers the user has linked. providerId is "credential"
  // for the email/password account and the provider name for OAuth.
  const linkedRows = await db
    .select({ providerId: accountsTable.providerId })
    .from(accountsTable)
    .where(eq(accountsTable.userId, user.id))

  const linkedProviders = new Set(linkedRows.map((r) => r.providerId))
  const hasPassword = linkedProviders.has('credential')

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <span className="text-ember">00</span>
        <span className="mx-2 text-text-faint">·</span>
        <span>Settings</span>
      </p>
      <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-text sm:text-4xl">
        Account.
      </h1>

      <div className="mt-12 space-y-16">
        <ProfileSection user={{ name: user.name, image: user.image ?? null }} />
        <EmailSection currentEmail={user.email} />
        <PasswordSection hasPassword={hasPassword} />
        <LinkedAccountsSection linkedProviders={Array.from(linkedProviders)} />
        <DangerZoneSection />
      </div>
    </div>
  )
}
