import type { NextConfig } from 'next'
const withPWA = require('@ducanh2912/next-pwa').default

const nextConfig: NextConfig = {
  turbopack: {},
}

export default withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Cache Supabase REST API responses (horse records, visits, etc.)
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-data',
          expiration: {
            maxEntries: 300,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          networkTimeoutSeconds: 8,
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache app pages visited by Drew
        urlPattern: /^https?:\/\/.*\/horses\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'horse-pages',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24,
          },
        },
      },
    ],
  },
})(nextConfig)
