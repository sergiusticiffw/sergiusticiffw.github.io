import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/expenses',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        background_color: '#13122d',
        theme_color: '#282a36',
      },
      workbox: {
        // Main bundle is ~2.1 MB; default Workbox limit is 2 MiB.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@features/assistant': fileURLToPath(
        new URL('./src/features/assistant', import.meta.url)
      ),
      '@features/netWorth': fileURLToPath(
        new URL('./src/features/netWorth', import.meta.url)
      ),
    },
  },
  server: {
    port: 3000,
  },
  worker: {
    format: 'es',
  },
});
