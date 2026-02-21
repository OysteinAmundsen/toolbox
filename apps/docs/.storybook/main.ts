// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from '@storybook/web-components-vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'path';
import remarkGfm from 'remark-gfm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read grid version for build-time injection (same as grid's vite.config.ts)
const gridPkg = JSON.parse(readFileSync(resolve(__dirname, '../../../libs/grid/package.json'), 'utf-8'));
const gridVersion = gridPkg.version;

const config: StorybookConfig = {
  // 'assets' — icons, logos, etc. shipped with .storybook/
  // pagefind mapping — serves the build-generated search index at /pagefind
  //   (run `bun nx build docs` once to generate the index, then `bun nx serve docs`)
  staticDirs: ['assets', { from: '../../../dist/docs/pagefind', to: 'pagefind' }],
  // Disable toolbar features that don't add value for this component library
  features: {
    // Grid overlay - not useful for grid component demos
    backgrounds: false,
    // Measure distances - requires dev tools, not useful in docs
    measure: false,
    // Outline elements - not useful for styled components
    outline: false,
  },
  stories: [
    // All stories and docs from libs and demos (node_modules/dist excluded by default)
    '../../../{libs,demos}/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  ],
  addons: [
    '@storybook/addon-a11y',
    '@vueless/storybook-dark-mode',
    {
      name: '@storybook/addon-docs',
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
  ],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  typescript: {
    check: false,
  },
  // Note: docsMode: true would hide stories - we show both MDX docs and stories
  core: {},
  viteFinal: async (cfg) => {
    // Add Vite resolve aliases for @toolbox/* paths
    // Use array format to ensure proper ordering (more specific paths first)
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.alias = [
      // Preserve any existing aliases
      ...(Array.isArray(cfg.resolve.alias) ? cfg.resolve.alias : []),
      // Theme paths
      { find: /^@toolbox\/themes\/(.*)/, replacement: resolve(__dirname, '../../../libs/themes/$1') },
      { find: '@toolbox/themes', replacement: resolve(__dirname, '../../../libs/themes') },
      // Grid paths - most specific first
      { find: '@toolbox-web/grid/all', replacement: resolve(__dirname, '../../../libs/grid/src/all.ts') },
      { find: /^@toolbox-web\/grid\/(.*)/, replacement: resolve(__dirname, '../../../libs/grid/src/lib/$1') },
      { find: '@toolbox-web/grid', replacement: resolve(__dirname, '../../../libs/grid/src/index.ts') },
      // Demo shared module - more specific path first
      {
        find: '@demo/shared/demo-styles.css',
        replacement: resolve(__dirname, '../../../demos/employee-management/shared/demo-styles.css'),
      },
      {
        find: '@demo/shared/styles',
        replacement: resolve(__dirname, '../../../demos/employee-management/shared/styles.ts'),
      },
      { find: '@demo/shared', replacement: resolve(__dirname, '../../../demos/employee-management/shared/index.ts') },
    ];

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
