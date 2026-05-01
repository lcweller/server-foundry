import { env } from '@/lib/env'
import { NextResponse } from 'next/server'

// GET /api/agent/update-manifest
//
// Returns the platform's recommended agent version + signed download
// URL. Public read — agents check this on a polling schedule (Phase
// 11) and the dashboard reads it to show "an update is available".
// The route returns no-store so a stale CDN copy can't pin agents to
// an old version.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CURRENT_PUBLISHED_VERSION = env.AGENT_UPDATE_VERSION ?? null

export function GET() {
  if (!CURRENT_PUBLISHED_VERSION || !env.AGENT_UPDATE_DOWNLOAD_URL) {
    return NextResponse.json(
      { available: false, reason: 'AGENT_UPDATE_VERSION not configured.' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return NextResponse.json(
    {
      available: true,
      version: CURRENT_PUBLISHED_VERSION,
      downloadUrl: env.AGENT_UPDATE_DOWNLOAD_URL,
      signature: env.AGENT_UPDATE_SIGNATURE ?? null,
      sha256: env.AGENT_UPDATE_SHA256 ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
