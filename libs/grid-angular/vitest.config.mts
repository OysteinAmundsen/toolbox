/// <reference types='vitest' />
import * as path from 'path';
import { defineConfig } from 'vitest/config';

// Resolve @toolbox-web/grid paths for tests
const gridDistPath = path.resolve(import.meta.dirname, '../../dist/libs/grid');

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/grid-angular',
  test: {
    name: '@toolbox-web/grid-angular',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,features}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    alias: [
      // Resolve @toolbox-web/grid-angular feature imports to local source (for tests)
      {
        find: /^@toolbox-web\/grid-angular\/features\/(.+)$/,
        replacement: path.join(import.meta.dirname, 'features/$1/src/index.ts'),
      },
      // Resolve @toolbox-web/grid-angular to local source
      {
        find: '@toolbox-web/grid-angular',
        replacement: path.join(import.meta.dirname, 'src/index.ts'),
      },
      // Resolve plugin imports to dist for tests (must be first, more specific)
      {
        find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
        replacement: path.join(gridDistPath, 'lib/plugins/$1/index.js'),
      },
      // Resolve @toolbox-web/grid/all to dist
      { find: '@toolbox-web/grid/all', replacement: path.join(gridDistPath, 'all.js') },
      // Resolve @toolbox-web/grid to dist
      { find: '@toolbox-web/grid', replacement: path.join(gridDistPath, 'index.js') },
    ],
  },
});
