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
          // `@toolbox-web/grid` peer is intentionally pinned to the unreleased
          // v3 range (`^3.0.0-beta`) while local dev resolves the 2.17.x
          // workspace build — see build-and-deploy.md DECIDED #411. Vite's
          // build graph surfaces grid to this rule (ng-packagr/React do not),
          // so exempt it to keep the deliberate cross-major mismatch.
          ignoredDependencies: ['vitest', '@toolbox-web/grid'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
