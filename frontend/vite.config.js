import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'offline.html',
        'icons/pwa-192.png',
        'icons/pwa-512.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        id: '/',
        name: '29 Gold & Jewellery Membership',
        short_name: '29 Gold',
        description: 'Membership and loyalty club for 29 Gold & Jewellery',
        theme_color: '#f8fafc',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        // Relative start keeps LAN IP / preview hosts working after Add to Home Screen.
        start_url: './',
        scope: './',
        lang: 'en',
        categories: ['shopping', 'business'],
        icons: [
          {
            src: 'icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/storage/, /^\/@/],
        runtimeCaching: [
          // Live revision polling must always hit the network and should not
          // be written into the API cache on every tick (NetworkFirst does both).
          {
            urlPattern: ({ url }) =>
              url.pathname === '/api/spinwheel/wheel/published/revision',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      // Dev SW + Vite unbundled modules is a common cause of blank
      // standalone / home-screen launches. Test installable PWA via preview.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    // 0.0.0.0 so phones on the same Wi‑Fi can hit Vite for live reload.
    host: '0.0.0.0',
    // Allow ngrok / Cloudflare Tunnel hostnames (any network access).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
