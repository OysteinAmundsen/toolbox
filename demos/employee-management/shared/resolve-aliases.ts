import { resolve } from 'path';
import type { Alias } from 'vite';

/**
 * Shared alias resolver for demo applications.
 *
 * Supports two modes controlled by the `USE_DIST` environment variable:
 *
 * - **Development (default)**: Resolves to source files for fast HMR
 * - **Dist mode (`USE_DIST=true`)**: Resolves to built packages to validate releases
 *
 * Usage in vite.config.ts:
 * ```typescript
 * import { getResolveAliases } from '../shared/resolve-aliases';
 * export default defineConfig({
 *   resolve: { alias: getResolveAliases(__dirname) }
 * });
 * ```
 *
 * Running demos against dist (for E2E validation):
 * ```bash
 * USE_DIST=true bun nx run demo-react:serve
 * ```
 */

const ROOT = resolve(import.meta.dirname, '../../..');

/**
 * Whether to resolve @toolbox-web/* packages to dist/ (built output)
 * instead of source files. Set USE_DIST=true to enable.
 */
export const USE_DIST = process.env.USE_DIST === 'true';

/**
 * Get Vite resolve aliases for a demo application.
 *
 * @param demoDir - The __dirname of the demo's vite.config.ts
 * @param options - Configuration options
 * @returns Array of Vite alias configurations
 */
export function getResolveAliases(
  demoDir: string,
  options: {
    /** Include grid-react aliases (default: false) */
    includeReact?: boolean;
    /** Include grid-angular aliases (default: false) */
    includeAngular?: boolean;
  } = {},
): Alias[] {
  const { includeReact = false, includeAngular = false } = options;
  const sharedDir = resolve(demoDir, '../shared');

  const aliases: Alias[] = [];

  if (USE_DIST) {
    // ============================================================
    // DIST MODE: Resolve to built packages (validates releases)
    // ============================================================
    console.log('🔧 Demo running in DIST mode - using built packages from dist/');

    // Grid plugin imports (must be before base @toolbox-web/grid)
    aliases.push({
      find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
      replacement: resolve(ROOT, 'dist/libs/grid/lib/plugins/$1/index.js'),
    });

    // Grid /all bundle
    aliases.push({
      find: '@toolbox-web/grid/all',
      replacement: resolve(ROOT, 'dist/libs/grid/all.js'),
    });

    // Grid base
    aliases.push({
      find: '@toolbox-web/grid',
      replacement: resolve(ROOT, 'dist/libs/grid/index.js'),
    });

    if (includeReact) {
      // React feature imports (must be before base)
      aliases.push({
        find: /^@toolbox-web\/grid-react\/features\/(.+)$/,
        replacement: resolve(ROOT, 'dist/libs/grid-react/features/$1.js'),
      });
      aliases.push({
        find: '@toolbox-web/grid-react/features',
        replacement: resolve(ROOT, 'dist/libs/grid-react/features/index.js'),
      });
      aliases.push({
        find: '@toolbox-web/grid-react',
        replacement: resolve(ROOT, 'dist/libs/grid-react/index.js'),
      });
    }

    if (includeAngular) {
      // Angular feature imports (must be before base)
      aliases.push({
        find: /^@toolbox-web\/grid-angular\/features\/(.+)$/,
        replacement: resolve(ROOT, 'dist/libs/grid-angular/features/$1.js'),
      });
      aliases.push({
        find: '@toolbox-web/grid-angular',
        replacement: resolve(ROOT, 'dist/libs/grid-angular/index.js'),
      });
    }
  } else {
    // ============================================================
    // SOURCE MODE (default): Resolve to source files for fast HMR
    // ============================================================

    // Grid plugin imports (must be before base @toolbox-web/grid)
    aliases.push({
      find: /^@toolbox-web\/grid\/plugins\/(.+)$/,
      replacement: resolve(ROOT, 'libs/grid/src/lib/plugins/$1/index.ts'),
    });

    // Grid /all bundle
    aliases.push({
      find: '@toolbox-web/grid/all',
      replacement: resolve(ROOT, 'libs/grid/src/all.ts'),
    });

    // Grid base
    aliases.push({
      find: '@toolbox-web/grid',
      replacement: resolve(ROOT, 'libs/grid/src/index.ts'),
    });

    if (includeReact) {
      // React feature imports (must be before base)
      aliases.push({
        find: /^@toolbox-web\/grid-react\/features\/(.+)$/,
        replacement: resolve(ROOT, 'libs/grid-react/src/features/$1.ts'),
      });
      aliases.push({
        find: '@toolbox-web/grid-react/features',
        replacement: resolve(ROOT, 'libs/grid-react/src/features/index.ts'),
      });
      aliases.push({
        find: '@toolbox-web/grid-react',
        replacement: resolve(ROOT, 'libs/grid-react/src/index.ts'),
      });
    }

    if (includeAngular) {
      // Angular feature imports (must be before base)
      aliases.push({
        find: /^@toolbox-web\/grid-angular\/features\/(.+)$/,
        replacement: resolve(ROOT, 'libs/grid-angular/src/features/$1.ts'),
      });
      aliases.push({
        find: '@toolbox-web/grid-angular',
        replacement: resolve(ROOT, 'libs/grid-angular/src/index.ts'),
      });
    }
  }

  // Shared demo imports (always from source)
  aliases.push(
    { find: '@demo/shared/styles', replacement: resolve(sharedDir, 'styles.ts') },
    { find: '@demo/shared/demo-styles.css', replacement: resolve(sharedDir, 'demo-styles.css') },
    { find: '@demo/shared', replacement: resolve(sharedDir, 'index.ts') },
  );

  return aliases;
}

/**
 * Get esbuild alias paths for Angular demo (used by esbuild-alias-plugin.mjs).
 * Only needed because Angular uses esbuild directly, not Vite.
 */
export function getEsbuildPaths(): {
  useDist: boolean;
  libsRoot: string;
  distRoot: string;
} {
  return {
    useDist: USE_DIST,
    libsRoot: resolve(ROOT, 'libs'),
    distRoot: resolve(ROOT, 'dist/libs'),
  };
}
