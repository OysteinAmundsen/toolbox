// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from '@storybook/web-components-vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read grid version for build-time injection (same as grid's vite.config.ts)
const gridPkg = JSON.parse(readFileSync(resolve(__dirname, '../../../libs/grid/package.json'), 'utf-8'));
const gridVersion = gridPkg.version;

const config: StorybookConfig = {
  stories: [
    // Stories from library stories/ directories
    '../../../**/stories/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    // Stories from core and plugin directories
    '../../../libs/grid/src/lib/core/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/grid/src/lib/plugins/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  typescript: {
    check: false,
  },

  core: {},
  viteFinal: async (cfg) => {
    // Add Vite resolve aliases for @toolbox/* paths
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      '@toolbox/themes/': resolve(__dirname, '../../../libs/themes') + '/',
      '@toolbox/themes': resolve(__dirname, '../../../libs/themes'),
      '@toolbox/storybook/': resolve(__dirname, '../../../libs/storybook') + '/',
      '@toolbox/storybook': resolve(__dirname, '../../../libs/storybook'),
      '@toolbox-web/grid/': resolve(__dirname, '../../../libs/grid/src/lib') + '/',
      '@toolbox-web/grid': resolve(__dirname, '../../../libs/grid/src/index.ts'),
    };

    // Allow Vite to serve files from the monorepo root
    cfg.server = cfg.server || {};
    cfg.server.fs = cfg.server.fs || {};
    cfg.server.fs.allow = [resolve(__dirname, '../../..')];

    // Ensure grid component side-effects (custom element registration) are preserved
    cfg.optimizeDeps = cfg.optimizeDeps || {};
    cfg.optimizeDeps.include = [...(cfg.optimizeDeps.include || []), '../../../libs/grid/src/index.ts'];

    // Prevent tree-shaking of side-effect imports during build
    cfg.build = cfg.build || {};
    cfg.build.rollupOptions = cfg.build.rollupOptions || {};
    cfg.build.rollupOptions.treeshake = {
      moduleSideEffects: (id: string) => {
        // Preserve side effects for grid component (custom element registration)
        if (id.includes('libs/grid/src')) return true;
        return 'no-external';
      },
    };

    // Disable minification to preserve code examples in stories
    // The extractCode() utility uses fn.toString() which needs unminified source
    cfg.build.minify = false;

    // Inject grid version constant (same as grid's vite.config.ts)
    cfg.define = {
      ...cfg.define,
      __GRID_VERSION__: JSON.stringify(gridVersion),
    };

    return cfg;
  },
};
export default config;
