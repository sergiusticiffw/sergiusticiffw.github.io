import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: '/expenses',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/dev-expenses-api\.pantheonsite\.io\/api\/expenses/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-expenses-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/dev-expenses-api\.pantheonsite\.io\/api\/loans/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-loans-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/dev-expenses-api\.pantheonsite\.io\/api\/payments\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-payments-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting for better caching
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['@tanstack/react-router'],
          'charts-vendor': ['highcharts', 'highcharts-react-official'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
