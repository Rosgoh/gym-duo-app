import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'favicon-96x96.png',
        'android-icon-144x144.png',
        'android-icon-192x192.png',
        'ms-icon-144x144.png',
        'browserconfig.xml',
      ],
      manifest: {
        name: 'Power Duo',
        short_name: 'Power Duo',
        start_url: '/',
        display: 'standalone',
        background_color: '#121212',
        theme_color: '#FF8C00',
        icons: [
          {
            src: 'android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'ms-icon-310x310.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5176,
  },
})
