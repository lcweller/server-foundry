import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { CloudflareAnalytics } from '@/components/cloudflare-analytics'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})

const SITE_URL = process.env.BETTER_AUTH_URL ?? 'https://serversfoundry.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Server Foundry — Forge your world.',
    template: '%s · Server Foundry',
  },
  description:
    'Run multiplayer game servers on hardware you already own. One command, then you’re online.',
  applicationName: 'Server Foundry',
  keywords: [
    'game server hosting',
    'self-hosted',
    'Valheim server',
    'Minecraft server',
    'CS2 server',
    'multiplayer hosting',
  ],
  authors: [{ name: 'Server Foundry' }],
  creator: 'Server Foundry',
  openGraph: {
    type: 'website',
    siteName: 'Server Foundry',
    title: 'Server Foundry — Forge your world.',
    description:
      'Run multiplayer game servers on hardware you already own. One command, then you’re online.',
    url: '/',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Server Foundry — Forge your world.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Server Foundry — Forge your world.',
    description:
      'Run multiplayer game servers on hardware you already own. One command, then you’re online.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}

export const viewport: Viewport = {
  themeColor: '#0E0D0C',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-text">
        {children}
        <CloudflareAnalytics />
      </body>
    </html>
  )
}
