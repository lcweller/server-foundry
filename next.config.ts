import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 'standalone' is incompatible with our custom server.ts — the
  // standalone bundler tries to inline a Next-managed entry point.
  // Custom server pulls full node_modules in the image instead.
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
}

export default nextConfig
