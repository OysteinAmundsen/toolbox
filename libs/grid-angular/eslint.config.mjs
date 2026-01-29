import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    // Disable module boundary checks for grid-angular
    // This library has many cross-package imports to @toolbox-web/grid which causes
    // the rule to be extremely slow (minutes) when analyzing the import graph
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
