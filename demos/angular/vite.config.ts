import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      // Map @toolbox-web/grid imports to the local source
      '@toolbox-web/grid/all': resolve(__dirname, '../../libs/grid/src/all.ts'),
      '@toolbox-web/grid': resolve(__dirname, '../../libs/grid/src/index.ts'),
      // Map @toolbox-web/grid-angular to the local source
      '@toolbox-web/grid-angular': resolve(__dirname, '../../libs/grid-angular/src/index.ts'),
      // Map @demo/shared/employee-management imports to the shared folder
      '@demo/shared/employee-management/styles': resolve(
        __dirname,
        '../shared/employee-management/styles.ts',
      ),
      '@demo/shared/employee-management/demo-styles.css': resolve(
        __dirname,
        '../shared/employee-management/demo-styles.css',
      ),
      '@demo/shared/employee-management': resolve(
        __dirname,
        '../shared/employee-management/index.ts',
      ),
      '@demo/shared/demo-index.css': resolve(__dirname, '../shared/demo-index.css'),
    },
  },
});
