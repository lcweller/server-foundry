import type { MetadataRoute } from 'next'

const SITE_URL = process.env.BETTER_AUTH_URL ?? 'https://serverfoundry.gg'

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
