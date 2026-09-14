import type { NextConfig } from 'next'
import path from 'node:path'

// DEMO MODE: '@clerk/nextjs' and '@clerk/nextjs/server' are aliased to a
// cookie-based mock (lib/demo-auth) so the app runs with no real Clerk
// instance — see DEMO.md. To restore real Clerk auth: delete these aliases,
// restore middleware.ts from middleware.ts.real-clerk-bak, and drop real
// keys into .env.local.
const clerkServerShim = path.resolve(process.cwd(), 'lib/demo-auth/server.ts')
const clerkClientShim = path.resolve(process.cwd(), 'lib/demo-auth/client.tsx')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' }, // allow photo uploads via server actions
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@clerk/nextjs/server': clerkServerShim,
      '@clerk/nextjs': clerkClientShim,
    }
    return config
  },
  turbopack: {
    resolveAlias: {
      '@clerk/nextjs/server': './lib/demo-auth/server.ts',
      '@clerk/nextjs': './lib/demo-auth/client.tsx',
    },
  },
}

export default nextConfig
