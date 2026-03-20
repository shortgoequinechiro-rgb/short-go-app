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
        // Cache all app page navigations (HTML)
        urlPattern: /^https?:\/\/.*\/(dashboard|calendar|appointments|horses|owners|account|billing|onboarding|anatomy|intake|consent).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'app-pages',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        // Cache Supabase REST API responses (horse records, visits, etc.)
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-data',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          networkTimeoutSeconds: 8,
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Supabase Auth API
        urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-auth',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24,
          },
          networkTimeoutSeconds: 5,
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Supabase Storage (photos, logos, documents)
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'supabase-storage',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache static assets (JS, CSS, fonts)
        urlPattern: /^https?:\/\/.*\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        // Cache Google Fonts
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        // Cache images
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        // Cache 3D model files (GLB for anatomy viewer)
        urlPattern: /\.(?:glb|gltf)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'models',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
    ],
  },
})(nextConfig)
