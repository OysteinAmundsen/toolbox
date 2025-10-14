// This file has been automatically migrated to valid ESM format by Storybook.
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: [
    // Stories from library stories/ directories
    '../../../**/stories/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    // Stories from core and plugin directories
    '../../../libs/grid/src/lib/core/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../libs/grid/src/lib/plugins/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [getAbsolutePath("@storybook/addon-a11y")],
  framework: {
    name: getAbsolutePath("@storybook/web-components-vite"),
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
      '@toolbox-web/grid': resolve(__dirname, '../../../libs/grid/src'),
    };

    // Allow Vite to serve files from the monorepo root
    cfg.server = cfg.server || {};
    cfg.server.fs = cfg.server.fs || {};
    cfg.server.fs.allow = [resolve(__dirname, '../../..')];

    return cfg;
  },
};
export default config;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
