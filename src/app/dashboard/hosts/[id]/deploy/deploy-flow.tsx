'use client'

import { deployServer } from '@/server/actions/servers'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'

type ConfigField =
  | {
      key: string
      label: string
      type: 'string'
      required?: boolean
      minLength?: number
      maxLength?: number
      pattern?: string
      placeholder?: string
      default?: string
      help?: string
    }
  | { key: string; label: string; type: 'boolean'; default?: boolean; help?: string }

type ConfigSchema = { fields: ConfigField[] } | null

type Game = {
  id: string
  slug: string
  name: string
  description: string | null
  defaultPort: number
  minRamMb: number | null
  recRamMb: number | null
  configSchemaJson: unknown
}

type Props = {
  hostId: string
  hostName: string
  games: Game[]
}

function parseSchema(raw: unknown): ConfigSchema {
  if (!raw || typeof raw !== 'object') return null
  const fields = (raw as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return null
  return { fields: fields as ConfigField[] }
}

export function DeployFlow({ hostId, hostName, games }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(games[0]?.id ?? null)

  if (games.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-8 text-sm text-text-muted">
        <p className="text-text">No games available yet.</p>
        <p className="mt-2">
          Run <code className="font-mono text-xs text-accent">bun run db:seed</code> to populate the
          catalog.
        </p>
      </div>
    )
  }

  const selected = games.find((g) => g.id === selectedId) ?? games[0]
  if (!selected) return null
  const schema = parseSchema(selected.configSchemaJson)

  function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (!selected) return

    const formData = new FormData(formEvent.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const portRaw = String(formData.get('port') ?? '').trim()
    const port = portRaw ? Number(portRaw) : selected.defaultPort

    if (!name) {
      setError('Server name is required.')
      return
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError('Port must be between 1 and 65535.')
      return
    }

    const config: Record<string, string | boolean> = {}
    if (schema) {
      for (const field of schema.fields) {
        const raw = formData.get(`config.${field.key}`)
        if (field.type === 'boolean') {
          config[field.key] = raw === 'on'
        } else {
          const text = String(raw ?? '').trim()
          if (field.required && !text) {
            setError(`${field.label} is required.`)
            return
          }
          if (text) config[field.key] = text
        }
      }
    }

    setError(null)
    startTransition(async () => {
      const result = await deployServer({
        hostId,
        gameId: selected.id,
        name,
        port,
        config,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/dashboard/servers/${result.data.serverId}` as Route)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-border bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
          Step 1 — Choose a game
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {games.map((game) => {
            const active = game.id === selected.id
            return (
              <li key={game.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(game.id)}
                  className={`w-full rounded-md border p-4 text-left transition-colors ${
                    active
                      ? 'border-accent bg-surface-elevated'
                      : 'border-border bg-background hover:border-text-muted'
                  }`}
                >
                  <p className="text-lg text-text">{game.name}</p>
                  {game.description ? (
                    <p className="mt-1 text-xs text-text-muted">{game.description}</p>
                  ) : null}
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
                    Port {game.defaultPort}
                    {game.recRamMb ? ` · ${game.recRamMb} MB RAM` : ''}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <form
        onSubmit={onSubmit}
        className="space-y-8"
        aria-label={`Deploy ${selected.name} to ${hostName}`}
      >
        <section className="rounded-md border border-border bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
            Step 2 — Configure
          </p>

          <div className="mt-5 grid gap-5">
            <Field label="Server name" htmlFor="server-name" hint="Shown on your dashboard.">
              <input
                id="server-name"
                name="name"
                type="text"
                required
                maxLength={64}
                defaultValue={`${selected.name} on ${hostName}`}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text outline-none focus:border-accent"
              />
            </Field>

            <Field
              label="Port"
              htmlFor="server-port"
              hint={`Defaults to ${selected.defaultPort}. Must be open on the host.`}
            >
              <input
                id="server-port"
                name="port"
                type="number"
                min={1}
                max={65535}
                defaultValue={selected.defaultPort}
                className="h-10 w-32 rounded-md border border-border bg-background px-3 font-mono text-sm text-text outline-none focus:border-accent"
              />
            </Field>

            {schema?.fields.map((field) => (
              <ConfigInput key={field.key} field={field} />
            ))}
          </div>
        </section>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-medium text-background transition-colors hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? 'Deploying…' : `Deploy ${selected.name}`}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/hosts/${hostId}` as Route)}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-text transition-colors hover:bg-surface-elevated disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string | undefined
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-2 text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

function ConfigInput({ field }: { field: ConfigField }) {
  const id = `config-${field.key}`
  if (field.type === 'boolean') {
    return (
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={`config.${field.key}`}
          type="checkbox"
          defaultChecked={field.default ?? false}
          className="mt-1 h-4 w-4 rounded border-border bg-background accent-accent"
        />
        <div>
          <label htmlFor={id} className="text-sm text-text">
            {field.label}
          </label>
          {field.help ? <p className="mt-1 text-xs text-text-muted">{field.help}</p> : null}
        </div>
      </div>
    )
  }
  return (
    <Field label={field.label} htmlFor={id} hint={field.help}>
      <input
        id={id}
        name={`config.${field.key}`}
        type="text"
        required={field.required ?? false}
        minLength={field.minLength}
        maxLength={field.maxLength}
        pattern={field.pattern}
        placeholder={field.placeholder}
        defaultValue={field.default ?? ''}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text outline-none focus:border-accent"
      />
    </Field>
  )
}
