/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import * as path from 'path';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

const outDir = path.resolve(import.meta.dirname, '../../dist/libs/grid-react');

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
      entry: 'src/index.ts',
      name: '@toolbox-web/grid-react',
      fileName: 'index',
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
  },
}));
