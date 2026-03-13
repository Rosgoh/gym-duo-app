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
        name: 'POWER DUO',
        short_name: 'POWER DUO',
        description: 'Entrena y sincroniza con tu pareja',
        theme_color: '#FF8C00',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          {
            src: 'android-icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'ms-icon-310x310.png',
            sizes: '310x310',
            type: 'image/png',
            purpose: 'any',
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
