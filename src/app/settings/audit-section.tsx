import { SettingsSection } from './section'

type Severity = 'info' | 'warning' | 'error'

type AuditRow = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  ip: string | null
  createdAt: string
}

type Props = {
  rows: AuditRow[]
}

const severityForAction: Record<string, Severity> = {
  host_paired: 'info',
  host_removed: 'warning',
  pairing_code_created: 'info',
  server_deployed: 'info',
  server_started: 'info',
  server_stopped: 'info',
  server_restarted: 'info',
  server_deleted: 'warning',
  backup_triggered: 'info',
  backup_restored: 'warning',
  backup_config_updated: 'info',
  agent_update_triggered: 'warning',
  auth_failure: 'error',
}

const severityClass: Record<Severity, string> = {
  info: 'text-text',
  warning: 'text-warning',
  error: 'text-danger',
}

export function AuditSection({ rows }: Props) {
  return (
    <SettingsSection
      title="Activity log"
      description="Insert-only record of privileged actions on your account. Useful for spotting an unfamiliar IP or unexpected change."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((r) => {
            const severity = severityForAction[r.action] ?? 'info'
            return (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className={`text-sm ${severityClass[severity]}`}>{prettyAction(r.action)}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    {r.entityType ? `${r.entityType}` : ''}
                    {r.entityType && r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    {formatDate(r.createdAt)}
                  </p>
                  {r.ip ? (
                    <p className="mt-1 font-mono text-[11px] text-text-faint">{maskIp(r.ip)}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SettingsSection>
  )
}

function prettyAction(action: string): string {
  return action.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

// Mask the last octet of an IPv4 / last group of an IPv6 — the audit
// log is for self-review, not raw forensics. Operators with DB access
// see the full address.
function maskIp(ip: string): string {
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/)
  if (v4?.[1]) return `${v4[1]}.×`
  const v6 = ip.match(/^([0-9a-f:]+):[0-9a-f]+$/i)
  if (v6?.[1]) return `${v6[1]}:×`
  return ip
}
