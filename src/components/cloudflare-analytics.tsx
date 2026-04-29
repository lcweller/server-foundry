import Script from 'next/script'

// Cloudflare Web Analytics — privacy-first, no cookies. Loaded only when the
// CLOUDFLARE_ANALYTICS_BEACON_TOKEN env var is set in production. No-op in dev
// or when the token is missing.
export function CloudflareAnalytics() {
  const token = process.env.CLOUDFLARE_ANALYTICS_BEACON_TOKEN
  if (!token || process.env.NODE_ENV !== 'production') {
    return null
  }

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
      defer
    />
  )
}
