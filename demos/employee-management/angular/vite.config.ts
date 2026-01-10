import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@toolbox-web/grid': resolve(__dirname, '../../../dist/libs/grid/index.js'),
      '@toolbox-web/grid/all': resolve(__dirname, '../../../dist/libs/grid/all.js'),
      '@toolbox-web/grid-angular': resolve(__dirname, '../../../dist/libs/grid-angular/index.js'),
    },
  },
});
