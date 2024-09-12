import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: '/expenses',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate' }), tsconfigPaths()],
  server: {
    port: 3000,
  },
});
