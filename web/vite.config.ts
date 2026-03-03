import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: deployed behind an ingress subpath.
  // Keep in sync with ingress path (e.g. /agent-control-center/)
  base: '/agent-control-center/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
      },
    },
  },
});
