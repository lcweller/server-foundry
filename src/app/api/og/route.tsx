import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Server Foundry — Forge your world.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const titleParam = searchParams.get('title')
  const headline = titleParam?.slice(0, 80) ?? 'Forge your world.'

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background:
          'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(255,91,20,0.28), transparent 70%), #0E0D0C',
        padding: '80px',
        color: '#F5F1E8',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28 }}>
        <span style={{ fontWeight: 600 }}>Server</span>
        <span style={{ fontStyle: 'italic', color: '#FF5B14' }}>Foundry</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <p
          style={{
            fontSize: 18,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#8A8278',
            margin: 0,
          }}
        >
          <span style={{ color: '#FF5B14' }}>01</span>
          {'  ·  Now in pre-launch'}
        </p>
        <p
          style={{
            fontSize: 120,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          {headline}
        </p>
        <p style={{ fontSize: 28, color: '#8A8278', margin: 0, maxWidth: 900 }}>
          Run multiplayer game servers on hardware you already own.
        </p>
      </div>

      <div
        style={{
          fontSize: 18,
          color: '#5C564E',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        serversfoundry.app
      </div>
    </div>,
    { ...size },
  )
}
