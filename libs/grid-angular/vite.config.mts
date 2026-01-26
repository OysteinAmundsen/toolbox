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
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '@toolbox-web/grid-angular',
      fileName: 'index',
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
        /^@toolbox-web\/.*/,
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
