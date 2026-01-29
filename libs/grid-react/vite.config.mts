/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import * as path from 'path';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const outDir = path.resolve(import.meta.dirname, '../../dist/libs/grid-react');

// Resolve @toolbox-web/grid paths for tests
const gridDistPath = path.resolve(import.meta.dirname, '../../dist/libs/grid');

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
  cacheDir: '../../node_modules/.vite/libs/grid-react',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      // Preserve @toolbox-web/grid imports in .d.ts output instead of resolving to relative paths
      pathsToAliases: false,
    }),
    copyReadme(),
  ],
  build: {
    outDir: '../../dist/libs/grid-react',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Multiple entry points: main index + all feature modules
      entry: {
        index: 'src/index.ts',
        'features/index': 'src/features/index.ts',
        'features/selection': 'src/features/selection.ts',
        'features/sorting': 'src/features/sorting.ts',
        'features/multi-sort': 'src/features/multi-sort.ts',
        'features/filtering': 'src/features/filtering.ts',
        'features/editing': 'src/features/editing.ts',
        'features/undo-redo': 'src/features/undo-redo.ts',
        'features/clipboard': 'src/features/clipboard.ts',
        'features/context-menu': 'src/features/context-menu.ts',
        'features/reorder': 'src/features/reorder.ts',
        'features/row-reorder': 'src/features/row-reorder.ts',
        'features/visibility': 'src/features/visibility.ts',
        'features/pinned-columns': 'src/features/pinned-columns.ts',
        'features/grouping-columns': 'src/features/grouping-columns.ts',
        'features/grouping-rows': 'src/features/grouping-rows.ts',
        'features/tree': 'src/features/tree.ts',
        'features/column-virtualization': 'src/features/column-virtualization.ts',
        'features/export': 'src/features/export.ts',
        'features/print': 'src/features/print.ts',
        'features/responsive': 'src/features/responsive.ts',
        'features/master-detail': 'src/features/master-detail.ts',
        'features/pinned-rows': 'src/features/pinned-rows.ts',
        'features/pivot': 'src/features/pivot.ts',
        'features/server-side': 'src/features/server-side.ts',
      },
      name: '@toolbox-web/grid-react',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@toolbox-web/grid',
        '@toolbox-web/grid/all',
        /^@toolbox-web\/grid/,
      ],
      output: {
        // Preserve the entry structure
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  test: {
    name: '@toolbox-web/grid-react',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    alias: [
      // Resolve @toolbox-web/grid-react feature imports to local source (for tests)
      {
        find: /^@toolbox-web\/grid-react\/features\/(.+)$/,
        replacement: path.join(import.meta.dirname, 'src/features/$1.ts'),
      },
      {
        find: '@toolbox-web/grid-react/features',
        replacement: path.join(import.meta.dirname, 'src/features/index.ts'),
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
}));
