import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  resolve: {
    alias: [
      // Map @toolbox-web/grid plugin imports to local source (most specific first)
      {
        find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
        replacement: resolve(__dirname, '../../../libs/grid/src/lib/plugins/$1/index.ts'),
      },
      // Map @toolbox-web/grid/all to local source
      { find: '@toolbox-web/grid/all', replacement: resolve(__dirname, '../../../libs/grid/src/all.ts') },
      // Map @toolbox-web/grid to local source
      { find: '@toolbox-web/grid', replacement: resolve(__dirname, '../../../libs/grid/src/index.ts') },
      // Map @toolbox-web/grid-react feature imports to local source
      {
        find: /^@toolbox-web\/grid-react\/features\/(.+)$/,
        replacement: resolve(__dirname, '../../../libs/grid-react/src/features/$1.ts'),
      },
      {
        find: '@toolbox-web/grid-react/features',
        replacement: resolve(__dirname, '../../../libs/grid-react/src/features/index.ts'),
      },
      // Map @toolbox-web/grid-react to the local source
      { find: '@toolbox-web/grid-react', replacement: resolve(__dirname, '../../../libs/grid-react/src/index.ts') },
      // Map @demo/shared imports to the shared folder
      { find: '@demo/shared/styles', replacement: resolve(__dirname, '../shared/styles.ts') },
      { find: '@demo/shared/demo-styles.css', replacement: resolve(__dirname, '../shared/demo-styles.css') },
      { find: '@demo/shared', replacement: resolve(__dirname, '../shared/index.ts') },
    ],
  },
  server: {
    port: 4300,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/demos/employee-management/react'),
    emptyOutDir: true,
  },
});
