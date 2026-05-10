import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import { defineConfig } from 'astro/config';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const rootDir = resolve(import.meta.dirname, '../..');
const pagefindDir = resolve(import.meta.dirname, 'dist/pagefind');
const isProductionBuild = process.argv.includes('build');

/**
 * Build Vite aliases for `@toolbox-web/grid` and all its plugin sub-paths.
 * During production builds, resolve to the pre-built dist output so the
 * package.json `sideEffects` field is honoured (prevents tree-shaking of
 * `customElements.define`). During dev, resolve to source for HMR.
 */
function gridAliases() {
  const pluginsDir = resolve(rootDir, 'libs/grid/src/lib/plugins');
  const pluginNames = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(pluginsDir, d.name, 'index.ts')))
    .map((d) => d.name);

  const featuresDir = resolve(rootDir, 'libs/grid/src/lib/features');
  const featureNames = readdirSync(featuresDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f !== 'registry.ts')
    .map((f) => f.replace('.ts', ''));

  const aliases = {};
  for (const name of pluginNames) {
    aliases[`@toolbox-web/grid/plugins/${name}`] = isProductionBuild
      ? resolve(rootDir, `dist/libs/grid/lib/plugins/${name}/index.js`)
      : resolve(rootDir, `libs/grid/src/lib/plugins/${name}/index.ts`);
  }
  for (const name of featureNames) {
    aliases[`@toolbox-web/grid/features/${name}`] = isProductionBuild
      ? resolve(rootDir, `dist/libs/grid/lib/features/${name}.js`)
      : resolve(rootDir, `libs/grid/src/lib/features/${name}.ts`);
  }
  aliases['@toolbox-web/grid/features/registry'] = isProductionBuild
    ? resolve(rootDir, 'dist/libs/grid/lib/features/registry.js')
    : resolve(rootDir, 'libs/grid/src/lib/features/registry.ts');
  aliases['@toolbox-web/grid/all'] = isProductionBuild
    ? resolve(rootDir, 'dist/libs/grid/all.js')
    : resolve(rootDir, 'libs/grid/src/all.ts');
  aliases['@toolbox-web/grid'] = isProductionBuild
    ? resolve(rootDir, 'dist/libs/grid/index.js')
    : resolve(rootDir, 'libs/grid/src/public.ts');
  return aliases;
}

/**
 * Vite plugin that enables Pagefind search during dev.
 * Serves the pre-built pagefind index from the last production build.
 * Requires one `bun nx build docs` to generate the pagefind index.
 */
function pagefindDevPlugin() {
  return {
    name: 'pagefind-dev-server',
    configureServer(server) {
      if (!existsSync(pagefindDir)) return;
      server.middlewares.use('/pagefind', (req, res, next) => {
        const filePath = join(pagefindDir, req.url.split('?')[0]);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = filePath.split('.').pop();
          const types = {
            js: 'application/javascript',
            css: 'text/css',
            json: 'application/json',
            pf_meta: 'application/octet-stream',
            pf_fragment: 'application/octet-stream',
            pf_index: 'application/octet-stream',
          };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(readFileSync(filePath));
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  site: 'https://toolboxjs.com',
  trailingSlash: 'always',

  vite: {
    plugins: [pagefindDevPlugin()],
    resolve: {
      alias: {
        ...gridAliases(),
        '@toolbox/themes': resolve(rootDir, 'libs/themes'),
        '@demo/shared/employee-management': resolve(rootDir, 'demos/shared/employee-management'),
        '@demo/vanilla/employee-management': resolve(
          rootDir,
          'demos/vanilla/src/demos/employee-management/grid-factory.ts',
        ),
        '@components': resolve(import.meta.dirname, 'src/components'),
      },
    },
  },

  integrations: [
    mermaid({ autoTheme: true, enableLog: false }),
    starlight({
      title: 'ToolboxJS',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/OysteinAmundsen/toolbox' }],
      customCss: ['./src/styles/custom.css'],
      editLink: {
        baseUrl: 'https://github.com/OysteinAmundsen/toolbox/edit/main/',
      },
      head: [
        // AI / LLM documentation
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: 'https://raw.githubusercontent.com/OysteinAmundsen/toolbox/main/llms.txt',
            title: 'LLM-optimized documentation (summary)',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: 'https://raw.githubusercontent.com/OysteinAmundsen/toolbox/main/llms-full.txt',
            title: 'LLM-optimized documentation (full)',
          },
        },
        // On browser refresh, clear Starlight's persisted sidebar state so only
        // the current page's path is expanded. Normal link clicks ('navigate')
        // keep their state so users can browse with groups open.
        {
          tag: 'script',
          content:
            "if(performance.getEntriesByType('navigation')[0]?.type==='reload')sessionStorage.removeItem('sl-sidebar-state');",
        },
      ],
      sidebar: [
        {
          label: 'Grid',
          items: [
            { label: 'Introduction', slug: 'grid/introduction' },
            { label: 'Getting Started', slug: 'grid/getting-started' },
            { label: 'Core Features', slug: 'grid/core' },
            { label: 'Demos', slug: 'grid/demos' },
            { label: 'Changelog', slug: 'grid/changelog' },
            {
              label: 'Guides',
              autogenerate: { directory: 'grid/guides' },
            },
            {
              label: 'Plugins',
              autogenerate: { directory: 'grid/plugins', collapsed: true },
              collapsed: true,
            },
            {
              label: 'API Docs',
              collapsed: true,
              items: [
                { slug: 'grid/api-reference' },
                { slug: 'grid/architecture' },
                {
                  label: 'Core',
                  autogenerate: { directory: 'grid/api/core' },
                  collapsed: true,
                },
                {
                  label: 'Framework Adapters',
                  autogenerate: { directory: 'grid/api/framework-adapters' },
                  collapsed: true,
                },
                {
                  label: 'Plugin Development',
                  autogenerate: { directory: 'grid/api/plugin-development' },
                  collapsed: true,
                },
              ],
            },
            // Divider
            {
              label: 'Angular',
              collapsed: true,
              items: [
                { label: 'Angular Integration', slug: 'grid/angular/getting-started' },
                { label: 'Base Classes', slug: 'grid/angular/base-classes' },
                { label: 'Reactive Forms', slug: 'grid/angular/reactive-forms' },
                { label: 'Changelog', slug: 'grid/angular/changelog' },
                {
                  label: 'API Reference',
                  autogenerate: { directory: 'grid/angular/api' },
                  collapsed: true,
                },
              ],
            },
            {
              label: 'React',
              collapsed: true,
              items: [
                { label: 'React Integration', slug: 'grid/react/getting-started' },
                { label: 'Changelog', slug: 'grid/react/changelog' },
                {
                  label: 'API Reference',
                  autogenerate: { directory: 'grid/react/api' },
                  collapsed: true,
                },
              ],
            },
            {
              label: 'Vue',
              collapsed: true,
              items: [
                { label: 'Vue Integration', slug: 'grid/vue/getting-started' },
                { label: 'Changelog', slug: 'grid/vue/changelog' },
                {
                  label: 'API Reference',
                  autogenerate: { directory: 'grid/vue/api' },
                  collapsed: true,
                },
              ],
            },
            { label: 'Compared to other grids', slug: 'grid/comparison' },
          ],
        },
      ],
      components: {
        Head: './src/components/Head.astro',
        Search: './src/components/Search.astro',
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
      },
      pagefind: true, // Built-in search via Pagefind
    }),
  ],
});
