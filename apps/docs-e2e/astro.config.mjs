/**
 * Minimal Astro configuration for E2E testing of demo components.
 *
 * This is a stripped-down version of the main docs astro.config.mjs.
 * It only includes the Vite aliases needed to resolve @toolbox-web/grid
 * and the @components alias for DemoControls.astro. No Starlight, no
 * MDX, no mermaid — just enough to render each demo in isolation.
 */
import { defineConfig } from 'astro/config';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const rootDir = resolve(import.meta.dirname, '../..');
const docsDir = resolve(rootDir, 'apps/docs');

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
    aliases[`@toolbox-web/grid/plugins/${name}`] = resolve(rootDir, `libs/grid/src/lib/plugins/${name}/index.ts`);
  }
  for (const name of featureNames) {
    aliases[`@toolbox-web/grid/features/${name}`] = resolve(rootDir, `libs/grid/src/lib/features/${name}.ts`);
  }
  aliases['@toolbox-web/grid/features/registry'] = resolve(rootDir, 'libs/grid/src/lib/features/registry.ts');
  aliases['@toolbox-web/grid/all'] = resolve(rootDir, 'libs/grid/src/all.ts');
  aliases['@toolbox-web/grid'] = resolve(rootDir, 'libs/grid/src/public.ts');
  return aliases;
}

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        ...gridAliases(),
        '@toolbox/themes': resolve(rootDir, 'libs/themes'),
        // Per-demo shared aliases — must point at the DIRECTORY (not index.ts)
        // so subpaths like `@demo/shared/calendar/demo-styles.css` resolve
        // naturally. Mirrors apps/docs/astro.config.mjs.
        '@demo/shared/employee-management': resolve(rootDir, 'demos/shared/employee-management'),
        '@demo/shared/booking-logs': resolve(rootDir, 'demos/shared/booking-logs'),
        '@demo/shared/calendar': resolve(rootDir, 'demos/shared/calendar'),
        '@demo/vanilla/employee-management': resolve(
          rootDir,
          'demos/vanilla/src/demos/employee-management/grid-factory.ts',
        ),
        '@demo/vanilla/calendar': resolve(rootDir, 'demos/vanilla/src/demos/calendar/grid-factory.ts'),
        // Point to the real docs components directory so DemoControls.astro resolves
        '@components': resolve(docsDir, 'src/components'),
      },
    },
  },
});
