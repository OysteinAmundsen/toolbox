import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import { defineConfig } from 'astro/config';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import remarkGfm from 'remark-gfm';

const rootDir = resolve(import.meta.dirname, '../..');
// The docs site builds into the workspace-wide `dist/docs` output (alongside
// every other `dist/<project>` artifact) rather than the project-local
// `apps/docs/dist`. `pagefindDir` tracks that location for the dev-server shim.
const pagefindDir = resolve(rootDir, 'dist/docs/pagefind');
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

/**
 * Vite plugin that makes the per-page `**.md` agent-markdown endpoint reachable
 * WITHOUT a trailing slash during `astro dev`.
 *
 * The global `trailingSlash: 'always'` setting forces `astro dev` to 404 a
 * no-slash request to the `[...slug].md.ts` rest-route (only the `foo.md/` form
 * matches). The static production build emits literal `foo.md` files, so GitHub
 * Pages / `astro preview` already serve the clean no-slash URL correctly — this
 * shim only closes the dev/prod gap by internally rewriting `foo.md` ->
 * `foo.md/` before Astro routes it, reusing the existing endpoint (no transform
 * logic duplicated here).
 */
function llmsMarkdownDevPlugin() {
  return {
    name: 'llms-markdown-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path, query] = (req.url || '').split('?');
        if (path.endsWith('.md')) {
          req.url = path + '/' + (query ? '?' + query : '');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  site: 'https://toolboxjs.com',
  trailingSlash: 'always',

  // Emit the build into the workspace-wide `dist/docs` (next to `dist/libs/*`),
  // not the project-local `apps/docs/dist`. `outDir` is resolved relative to the
  // Astro project root (`apps/docs`), so `../../dist/docs` reaches the repo root.
  outDir: '../../dist/docs',

  // Astro 6 + @astrojs/mdx 5 no longer auto-injects remark-gfm into the MDX
  // pipeline once another integration (astro-mermaid) populates
  // markdown.remarkPlugins via the legacy API, so GFM tables in .mdx files
  // render as raw pipe text. Re-add remark-gfm explicitly so .mdx regains
  // table/strikethrough/autolink support (.md files are unaffected).
  markdown: {
    remarkPlugins: [remarkGfm],
  },

  redirects: {
    // custom-plugins.mdx moved from guides/ to plugin-development/ so it lives
    // alongside the conceptual architecture page and the typedoc API reference.
    // Keep the old URL working for inbound links and historical bookmarks.
    '/grid/guides/custom-plugins/': '/grid/plugin-development/custom-plugins/',
    // system-columns.mdx merged into core.mdx as a section — it documents a
    // column-config flag, not a guide topic. Old URL redirects to the anchor.
    '/grid/guides/system-columns/': '/grid/core/#system-columns',
    // multi-version was briefly relocated to framework-adapters/ during a
    // restructure pass, but the content is framework-agnostic (it's about the
    // custom-elements registry, which applies to vanilla JS, Native Federation,
    // Module Federation, etc.). Keep the short-lived URL redirecting home.
    '/grid/framework-adapters/multi-version/': '/grid/guides/multi-version/',
  },

  vite: {
    plugins: [pagefindDevPlugin(), llmsMarkdownDevPlugin()],
    resolve: {
      alias: {
        ...gridAliases(),
        '@toolbox/themes': resolve(rootDir, 'libs/themes'),
        '@demo/shared/employee-management': resolve(rootDir, 'demos/shared/employee-management'),
        // Alias to the directory (not `index.ts`) so subpaths like
        // `@demo/shared/calendar/demo-styles.css` resolve naturally — matches
        // the `@demo/shared/employee-management` pattern above. Vite's
        // resolver then handles index resolution for the bare specifier.
        '@demo/shared/calendar': resolve(rootDir, 'demos/shared/calendar'),
        '@demo/vanilla/employee-management': resolve(
          rootDir,
          'demos/vanilla/src/demos/employee-management/grid-factory.ts',
        ),
        '@demo/vanilla/calendar': resolve(rootDir, 'demos/vanilla/src/demos/calendar/grid-factory.ts'),
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
        // Starlight appends the page path relative to the Astro project root
        // (`apps/docs/`), e.g. `src/content/docs/index.mdx`. The repo path is
        // `apps/docs/src/content/docs/index.mdx`, so the baseUrl must include
        // the `apps/docs/` prefix or every edit link 404s.
        baseUrl: 'https://github.com/OysteinAmundsen/toolbox/edit/main/apps/docs/',
      },
      head: [
        // AI / LLM documentation
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: '/llms.txt',
            title: 'LLM-optimized documentation (summary)',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: '/llms-full.txt',
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
            {
              label: 'Guides',
              items: [{ autogenerate: { directory: 'grid/guides' } }],
            },
            {
              label: 'Plugins',
              collapsed: true,
              items: [{ autogenerate: { directory: 'grid/plugins', collapsed: true } }],
            },
            {
              label: 'API Docs',
              collapsed: true,
              items: [
                { slug: 'grid/api-reference' },
                { label: 'Grid Architecture', slug: 'grid/architecture' },
                {
                  label: 'Plugin Development',
                  collapsed: true,
                  items: [
                    { slug: 'grid/plugin-development' },
                    { slug: 'grid/plugin-development/architecture' },
                    { slug: 'grid/plugin-development/custom-plugins' },
                    {
                      label: 'API Reference',
                      collapsed: true,
                      items: [{ autogenerate: { directory: 'grid/api/plugin-development' } }],
                    },
                  ],
                },
                {
                  label: 'Framework Adapters',
                  collapsed: true,
                  items: [
                    { slug: 'grid/framework-adapters' },
                    { slug: 'grid/framework-adapters/architecture' },
                    {
                      label: 'API Reference',
                      collapsed: true,
                      items: [{ autogenerate: { directory: 'grid/api/framework-adapters' } }],
                    },
                  ],
                },
                {
                  label: 'Core API',
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'grid/api/core' } }],
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
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'grid/angular/api' } }],
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
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'grid/react/api' } }],
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
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'grid/vue/api' } }],
                },
              ],
            },
            { label: 'Compared to other grids', slug: 'grid/comparison' },
            { label: 'Changelog', slug: 'grid/changelog' },
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
