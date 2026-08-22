import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: { outDir: '../../dist/frontend', emptyOutDir: true },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});