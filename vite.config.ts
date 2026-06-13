import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'seanantha.jfif'
      ],
      manifest: {
        name: 'SEANANTHA',
        short_name: 'SEANANTHA',
        description: 'Aplikasi validasi foto berbasis PWA',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/seanantha.jfif',
            sizes: '192x192',
            type: 'image/jfif'
          },
          {
            src: '/seanantha.jfif',
            sizes: '512x512',
            type: 'image/jfif'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}']
      }
    })
  ],

  server: {
    port: 5173,
    host: true,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});