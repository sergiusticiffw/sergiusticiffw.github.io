import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: '/expenses',
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ['src'],
        includePaths: ['src'],
      } as Record<string, unknown>,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
