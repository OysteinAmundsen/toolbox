import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Map @toolbox-web/grid imports to the local source
      '@toolbox-web/grid/all': resolve(__dirname, '../../../libs/grid/src/all.ts'),
      '@toolbox-web/grid': resolve(__dirname, '../../../libs/grid/src/index.ts'),
      // Map @toolbox-web/grid-angular to the local source
      '@toolbox-web/grid-angular': resolve(__dirname, '../../../libs/grid-angular/src/index.ts'),
      // Map @demo/shared imports to the shared folder
      '@demo/shared/styles': resolve(__dirname, '../shared/styles.ts'),
      '@demo/shared/demo-styles.css': resolve(__dirname, '../shared/demo-styles.css'),
      '@demo/shared': resolve(__dirname, '../shared/index.ts'),
    },
  },
});
