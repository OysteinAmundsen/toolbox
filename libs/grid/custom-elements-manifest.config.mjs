import { litPlugin } from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js';

export default {
  globs: ['src/lib/core/grid.ts'],
  exclude: ['**/*.spec.ts', '**/*.stories.ts', '**/internal/**'],
  outdir: '.',
  litelement: false,
  plugins: [
    // Use lit plugin for better JSDoc parsing
    ...litPlugin(),
  ],
};
