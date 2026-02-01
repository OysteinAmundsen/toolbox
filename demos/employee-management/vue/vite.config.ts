import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { getResolveAliases } from '../shared/resolve-aliases';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat tbw-* tags as custom elements (web components), not Vue components
          isCustomElement: (tag) => tag.startsWith('tbw-'),
        },
      },
    }),
  ],
  resolve: {
    alias: getResolveAliases(__dirname, { includeVue: true }),
  },
  server: {
    port: 4100,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/demos/employee-management/vue'),
    emptyOutDir: true,
  },
});
