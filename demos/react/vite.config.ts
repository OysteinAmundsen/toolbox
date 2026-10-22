import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { getResolveAliases } from '../shared/resolve-aliases';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), nxReadySignal()],
  resolve: {
    alias: getResolveAliases(__dirname, { includeReact: true }),
  },
  server: {
    port: 4300,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../dist/demos/react'),
    emptyOutDir: true,
  },
});
