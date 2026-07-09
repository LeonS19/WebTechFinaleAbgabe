import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('index-') || tag.startsWith('chat-')
        }
      }
    }),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Dungeon Learn',
        short_name: 'DL',
        description: 'Kollaborative Lernplattform mit RPG-Gameplay – Karteikarten lernen und gemeinsam Dungeons erobern.',
        theme_color: '#4f8ef7',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Datei-Anhänge herunterladen: Cache First (Dateien ändern sich nach Upload nicht mehr)
            urlPattern: /\/api\/v1\/index-cards\/.*\/attachments\/.+$/,
            method: 'GET',
            handler: 'CacheFirst',
            options: {
              cacheName: 'attachment-downloads',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Tage
              },
            },
          },
          {
            // Anhänge-Liste: Network First (soll aktuell bleiben, Fallback bei Offline)
            urlPattern: /\/api\/v1\/index-cards\/.*\/attachments$/,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'attachment-lists',
            },
          },
          {
            // GraphQL-Endpoint: Network First, damit Live-Daten Vorrang haben,
            // aber ein Fallback existiert, falls die Anfrage offline fehlschlägt.
            // Die eigentliche Offline-Nutzbarkeit für GraphQL-Daten (Karteikarten,
            // Chat, Runs, Rangliste) läuft über den eigenen IndexedDB-Layer
            // (offlineStorage.service.js), nicht über diesen Workbox-Cache,
            // da Workbox nicht nach GraphQL-Query-Inhalt unterscheiden kann.
            urlPattern: /\/graphql$/,
            method: 'POST',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'graphql-fallback',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
