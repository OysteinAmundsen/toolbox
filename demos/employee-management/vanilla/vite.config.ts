import { resolve } from 'path';
import { defineConfig } from 'vite';
import { getResolveAliases } from '../shared/resolve-aliases';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: getResolveAliases(__dirname),
  },
  server: {
    port: 4000,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/demos/employee-management/vanilla'),
    emptyOutDir: true,
  },
});
