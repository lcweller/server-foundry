import type { MetadataRoute } from 'next'

const SITE_URL = process.env.BETTER_AUTH_URL ?? 'https://serversfoundry.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/waitlist/confirm'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
