/// <reference types='vitest' />
import { copyFileSync } from 'fs';
import * as path from 'path';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const outDir = path.resolve(import.meta.dirname, '../../dist/libs/grid-angular');

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
  cacheDir: '../../node_modules/.vite/libs/grid-angular',
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      // Preserve @toolbox-web/grid imports in .d.ts output instead of resolving to relative paths
      pathsToAliases: false,
    }),
    copyReadme(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: '../../dist/libs/grid-angular',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Multiple entry points for tree-shakeable features
      entry: {
        index: 'src/index.ts',
        'features/index': 'src/features/index.ts',
        'features/clipboard': 'src/features/clipboard.ts',
        'features/column-virtualization': 'src/features/column-virtualization.ts',
        'features/context-menu': 'src/features/context-menu.ts',
        'features/editing': 'src/features/editing.ts',
        'features/export': 'src/features/export.ts',
        'features/filtering': 'src/features/filtering.ts',
        'features/grouping-columns': 'src/features/grouping-columns.ts',
        'features/grouping-rows': 'src/features/grouping-rows.ts',
        'features/master-detail': 'src/features/master-detail.ts',
        'features/pinned-columns': 'src/features/pinned-columns.ts',
        'features/pinned-rows': 'src/features/pinned-rows.ts',
        'features/pivot': 'src/features/pivot.ts',
        'features/print': 'src/features/print.ts',
        'features/reorder': 'src/features/reorder.ts',
        'features/responsive': 'src/features/responsive.ts',
        'features/row-reorder': 'src/features/row-reorder.ts',
        'features/selection': 'src/features/selection.ts',
        'features/server-side': 'src/features/server-side.ts',
        'features/sorting': 'src/features/sorting.ts',
        'features/tree': 'src/features/tree.ts',
        'features/undo-redo': 'src/features/undo-redo.ts',
        'features/visibility': 'src/features/visibility.ts',
      },
      name: '@toolbox-web/grid-angular',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [
        '@angular/core',
        '@angular/forms',
        '@toolbox-web/grid',
        '@toolbox-web/grid/all',
        /^@angular\/.*/,
        /^@toolbox-web\/grid.*/,
      ],
    },
  },
  test: {
    name: '@toolbox-web/grid-angular',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
