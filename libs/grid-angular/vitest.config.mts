/// <reference types='vitest' />
import * as path from 'path';
import { defineConfig } from 'vitest/config';

// Resolve @toolbox-web/grid paths for tests (point to source so tests work without building grid first)
const gridSrcPath = path.resolve(import.meta.dirname, '../../libs/grid/src');

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/grid-angular',
  test: {
    name: '@toolbox-web/grid-angular',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,features}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: process.env.CI
      ? [
          'default',
          ['github-actions', { jobSummary: { enabled: false } }],
          '../../tools/vitest-github-summary-reporter.ts',
        ]
      : ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      reporter: ['text', 'json-summary'],
      thresholds: { statements: 72, branches: 74, functions: 71, lines: 73 },
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
      // Resolve plugin imports to source for tests (must be first, more specific)
      {
        find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
        replacement: path.join(gridSrcPath, 'lib/plugins/$1/index.ts'),
      },
      // Resolve feature imports to source for tests
      {
        find: /^@toolbox-web\/grid\/features\/(.+)$/,
        replacement: path.join(gridSrcPath, 'lib/features/$1.ts'),
      },
      // Resolve @toolbox-web/grid/all to source
      { find: '@toolbox-web/grid/all', replacement: path.join(gridSrcPath, 'all.ts') },
      // Resolve @toolbox-web/grid to source
      { find: '@toolbox-web/grid', replacement: path.join(gridSrcPath, 'public.ts') },
    ],
  },
});
