/// <reference types='vitest' />
import vue from '@vitejs/plugin-vue';
import { copyFileSync } from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const outDir = path.resolve(import.meta.dirname, '../../dist/libs/grid-vue');

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
    vue(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      // Preserve @toolbox-web/grid imports in .d.ts output instead of resolving to relative paths
      pathsToAliases: false,
    }),
    copyReadme(),
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
        'features/index': 'src/features/index.ts',
        'features/selection': 'src/features/selection.ts',
        'features/editing': 'src/features/editing.ts',
        'features/clipboard': 'src/features/clipboard.ts',
        'features/context-menu': 'src/features/context-menu.ts',
        'features/multi-sort': 'src/features/multi-sort.ts',
        'features/filtering': 'src/features/filtering.ts',
        'features/reorder': 'src/features/reorder.ts',
        'features/visibility': 'src/features/visibility.ts',
        'features/pinned-columns': 'src/features/pinned-columns.ts',
        'features/grouping-columns': 'src/features/grouping-columns.ts',
        'features/column-virtualization': 'src/features/column-virtualization.ts',
        'features/row-reorder': 'src/features/row-reorder.ts',
        'features/grouping-rows': 'src/features/grouping-rows.ts',
        'features/pinned-rows': 'src/features/pinned-rows.ts',
        'features/tree': 'src/features/tree.ts',
        'features/master-detail': 'src/features/master-detail.ts',
        'features/responsive': 'src/features/responsive.ts',
        'features/undo-redo': 'src/features/undo-redo.ts',
        'features/export': 'src/features/export.ts',
        'features/print': 'src/features/print.ts',
        'features/pivot': 'src/features/pivot.ts',
        'features/server-side': 'src/features/server-side.ts',
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
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/grid-vue',
      provider: 'v8' as const,
    },
  },
}));
