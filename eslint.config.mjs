import reactHooks from 'eslint-plugin-react-hooks';

import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
      '**/.angular',
      '**/.astro',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Disabled intentionally: every library here (grid + adapters + themes)
          // is buildable/publishable, and the adapters depend on the grid via the
          // published `@toolbox-web/grid` package whose tsconfig `paths` point at
          // `dist/` (deliberate, for multi-version isolation). Since Nx 23's
          // resolver treats those dist-pointing aliases as non-buildable, this
          // sub-check false-positives on a genuinely buildable dependency.
          enforceBuildableLibDependency: false,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Deliberately permissive. The same dist-pointing aliases above mean Nx
          // cannot attribute `@toolbox-web/grid[/subpath]` back to the `grid`
          // project, so ANY tag-based constraint here fires on every legitimate
          // adapter -> core import. Projects still carry real `type:`/`scope:`/
          // `layer:` tags (useful for `nx affected` filtering); the boundaries
          // themselves are enforced by the graph-independent
          // `no-restricted-imports` rules further down.
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {
      // Honor the conventional `_`-prefix for intentionally unused parameters,
      // variables, destructure rest siblings, and caught errors. Matches the
      // TypeScript compiler's own `noUnusedParameters` / `noUnusedLocals`
      // behavior so the compiler and the linter agree.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // React hooks rules for TSX files
    files: ['**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Relax strict type rules for test files (flexibility needed for mocks, assertions, etc.)
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Disable module boundary checks for files that use intentional dynamic imports
    // The rule causes performance issues when analyzing dynamic imports across library boundaries
    files: ['**/grid-react/**/data-grid.tsx'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // Disable module boundary checks for build-time scripts (not part of distributed packages)
    files: ['**/scripts/*.ts', '**/scripts/*.mts', 'tools/**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // Disable module boundary checks for demo vite configs (they import shared utilities)
    files: ['demos/**/vite.config.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // Disable module boundary checks for lib vite configs (they import shared build tools)
    files: ['libs/**/vite.config.ts', 'libs/**/vite.config.mts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    // HARD RULE (#370): the grid core MUST NOT depend on any plugin. Forbid
    // value imports from `plugins/**` in `libs/grid/src/lib/core/**`.
    // `import type` is allowed (core/types re-aliases some plugin types, and
    // the PluginManager seam is typed against plugin interfaces).
    files: ['libs/grid/src/lib/core/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.bench.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/plugins/*', '**/plugins/*/**'],
              allowTypeImports: true,
              message:
                'Core must not depend on any plugin (#370). Use `import type` only, or route through the PluginManager seam (`getPluginByName`/`getPlugin`).',
            },
          ],
        },
      ],
    },
  },
  {
    // Adapters are siblings: each one may depend on the core grid, but NEVER on
    // another adapter (that would drag React into a Vue bundle, etc.). Enforced
    // here rather than via Nx `depConstraints` because the dist-pointing
    // tsconfig aliases stop Nx from resolving these specifiers to a project.
    files: ['libs/grid-angular/**/*.ts', 'libs/grid-react/**/*.{ts,tsx}', 'libs/grid-vue/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@toolbox-web/grid-angular', '@toolbox-web/grid-react', '@toolbox-web/grid-vue', '**/grid-angular/**', '**/grid-react/**', '**/grid-vue/**'],
              message:
                'An adapter must not import another adapter. Depend on `@toolbox-web/grid` and duplicate the small amount of framework-specific glue instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Every string that reaches `innerHTML` in library source must go through
    // the sanitizer. `setSanitizedHTML(el, html)` is the canonical sink. The
    // only accepted right-hand sides are static markup (a string literal or a
    // template literal with no interpolation) and a `sanitizeHTML()` call. The
    // rare legitimate exception (editor markup, which is built from the very
    // form controls the sanitizer strips) carries an inline disable + reason.
    files: ['libs/grid/src/lib/**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.bench.ts', '**/internal/sanitize.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "AssignmentExpression[left.property.name='innerHTML']:not([right.type='Literal']):not([right.type='TemplateLiteral'][right.expressions.length=0]):not([right.callee.name='sanitizeHTML']):not([right.callee.name='booleanCellHTML'])",
          message:
            'Assigning a computed string to innerHTML is an XSS sink. Use `setSanitizedHTML(el, html)` from core/internal/sanitize.',
        },
      ],
    },
  },
];
