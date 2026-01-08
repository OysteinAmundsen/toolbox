import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      // Map @toolbox-web/grid imports to the local source
      '@toolbox-web/grid/all': resolve(__dirname, '../../../libs/grid/src/all.ts'),
      '@toolbox-web/grid': resolve(__dirname, '../../../libs/grid/src/index.ts'),
      // Map @demo/shared imports to the shared folder
      '@demo/shared/styles': resolve(__dirname, '../shared/styles.ts'),
      '@demo/shared': resolve(__dirname, '../shared/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/demos/employee-management/vanilla'),
    emptyOutDir: true,
  },
});
