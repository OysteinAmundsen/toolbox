/// <reference types='vitest' />
import vue from '@vitejs/plugin-vue';
import { copyFileSync } from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { bundleBudget } from '../../tools/vite-bundle-budget';

const outDir = path.resolve(import.meta.dirname, '../../dist/libs/grid-vue');

// Resolve @toolbox-web/grid paths for tests
const gridSrcPath = path.resolve(import.meta.dirname, '../../libs/grid/src');

/** Copy README.md to dist for npm publishing */
function copyReadme(): Plugin {
  return {
    name: 'copy-readme',
    writeBundle() {
      try {
        copyFileSync(path.resolve(import.meta.dirname, 'README.md'), path.resolve(outDir, 'README.md'));
      } catch {
        /* ignore */
      }
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/grid-vue',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat tbw-* tags as custom elements (web components), not Vue components
          // This is critical to avoid infinite recursion when resolving <tbw-grid>
          isCustomElement: (tag) => tag.startsWith('tbw-'),
        },
      },
    }),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      // Preserve @toolbox-web/grid imports in .d.ts output instead of resolving to relative paths
      pathsToAliases: false,
      afterBuild: () => {
        // Copy package.json after DTS generation
        copyFileSync(path.resolve(import.meta.dirname, 'package.json'), path.resolve(outDir, 'package.json'));
      },
    }),
    copyReadme(),
    bundleBudget({
      outDir,
      budgets: [{ path: 'index.js', maxSize: 50 * 1024 }],
    }),
  ],
  build: {
    outDir: '../../dist/libs/grid-vue',
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: true,
    lib: {
      // Multiple entry points: main index + all feature modules
      entry: {
        index: 'src/index.ts',
        'features/clipboard': 'src/features/clipboard.ts',
        'features/column-virtualization': 'src/features/column-virtualization.ts',
        'features/context-menu': 'src/features/context-menu.ts',
        'features/editing': 'src/features/editing.ts',
        'features/export': 'src/features/export.ts',
        'features/filtering': 'src/features/filtering.ts',
        'features/grouping-columns': 'src/features/grouping-columns.ts',
        'features/grouping-rows': 'src/features/grouping-rows.ts',
        'features/index': 'src/features/index.ts',
        'features/master-detail': 'src/features/master-detail.ts',
        'features/multi-sort': 'src/features/multi-sort.ts',
        'features/pinned-columns': 'src/features/pinned-columns.ts',
        'features/pinned-rows': 'src/features/pinned-rows.ts',
        'features/pivot': 'src/features/pivot.ts',
        'features/print': 'src/features/print.ts',
        'features/reorder-columns': 'src/features/reorder-columns.ts',
        'features/reorder-rows': 'src/features/reorder-rows.ts',
        'features/responsive': 'src/features/responsive.ts',
        'features/selection': 'src/features/selection.ts',
        'features/server-side': 'src/features/server-side.ts',
        'features/tooltip': 'src/features/tooltip.ts',
        'features/tree': 'src/features/tree.ts',
        'features/undo-redo': 'src/features/undo-redo.ts',
        'features/visibility': 'src/features/visibility.ts',
      },
      name: 'TbwGridVue',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: ['vue', '@toolbox-web/grid', /^@toolbox-web\/grid\/.*/],
      output: {
        globals: {
          vue: 'Vue',
          '@toolbox-web/grid': 'TbwGrid',
        },
        // Preserve directory structure for features
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  test: {
    name: '@toolbox-web/grid-vue',
    watch: false,
    globals: true,
    environment: 'happy-dom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: process.env.CI
      ? [
          'default',
          ['github-actions', { jobSummary: { enabled: false } }],
          '../../tools/vitest-github-summary-reporter.ts',
        ]
      : ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/grid-vue',
      provider: 'v8' as const,
      reporter: ['text', 'json-summary'],
      thresholds: { statements: 98, branches: 89, functions: 100, lines: 99 },
    },
    alias: [
      // Resolve @toolbox-web/grid imports to grid source (so tests pass without building grid)
      {
        find: /^@toolbox-web\/grid\/features\/(.+)$/,
        replacement: path.join(gridSrcPath, 'lib/features/$1.ts'),
      },
      {
        find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
        replacement: path.join(gridSrcPath, 'lib/plugins/$1/index.ts'),
      },
      { find: '@toolbox-web/grid/all', replacement: path.join(gridSrcPath, 'all.ts') },
      { find: '@toolbox-web/grid', replacement: path.join(gridSrcPath, 'public.ts') },
    ],
  },
}));
