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
          // Nx 23's dependency-checks now surfaces the Angular build graph to
          // this rule (it previously did not for ng-packagr — see the same note
          // in grid-vue). Exempt:
          //  - `vitest` — test-only, never a runtime dependency.
          //  - `@angular/forms` / `rxjs` — used only by the OPTIONAL
          //    `features/editing` secondary entry, and provided transitively by
          //    any Angular app; keeping them out of package-wide peers avoids a
          //    spurious peer warning for consumers that don't use editing.
          //  - `@angular/compiler` — build-time only (in devDependencies).
          //  - `@toolbox-web/grid` — intentional cross-major internal dep, as in
          //    grid-vue (see build-and-deploy.md DECIDED #411).
          ignoredDependencies: ['vitest', '@angular/forms', '@angular/compiler', 'rxjs', '@toolbox-web/grid'],
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
