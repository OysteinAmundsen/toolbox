/**
 * Build-time grid statistics, computed from the actual source and build output
 * so the numbers quoted throughout the docs can never drift from reality.
 *
 * - `pluginCount` is derived from the canonical `all.ts` barrel (the single
 *   source of truth for which plugins ship publicly — `shell` is a feature,
 *   not a re-exported plugin, so it is correctly excluded).
 * - `coreGzipKb` is the real gzipped size of the built core ESM bundle. The
 *   docs `build` target `dependsOn` `grid:build`, so `dist/libs/grid/index.js`
 *   is guaranteed to exist during a production build. During `astro dev` the
 *   dist may be absent, so a conservative fallback is used.
 * - The version / peer-range fields are read from each published package's
 *   `package.json`, so the support matrix cannot drift from what npm installs.
 *
 * Evaluated once, at build time, in Node — never shipped to the client.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const thisDir = dirname(fileURLToPath(import.meta.url));
// src/data -> src -> apps/docs -> apps -> <workspace root>
const rootDir = resolve(thisDir, '../../../..');

/** Gzip size (kB) reported when the built core bundle is unavailable (dev only). */
const CORE_GZIP_KB_FALLBACK = 45;

/** Count the plugins re-exported from the grid's public `all.ts` barrel. */
function countPlugins(): number {
  const allTs = resolve(rootDir, 'libs/grid/src/all.ts');
  const source = readFileSync(allTs, 'utf8');
  const matches = source.match(/export \* from '\.\/lib\/plugins\//g);
  return matches?.length ?? 0;
}

/** Gzipped size (rounded kB) of the built core ESM bundle. */
function coreGzipKb(): number {
  const coreBundle = resolve(rootDir, 'dist/libs/grid/index.js');
  if (!existsSync(coreBundle)) return CORE_GZIP_KB_FALLBACK;
  const gzipped = gzipSync(readFileSync(coreBundle)).length;
  return Math.round(gzipped / 1024);
}

interface PackageManifest {
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Read a published package's manifest from `libs/<dir>/package.json`. */
function manifest(libDir: string): PackageManifest {
  return JSON.parse(readFileSync(resolve(rootDir, 'libs', libDir, 'package.json'), 'utf8'));
}

/**
 * Collapse ranges the docs render as a single token, failing the build if they
 * ever diverge. The support matrix prints one range for `react` + `react-dom`
 * and one `@toolbox-web/grid` range for all three adapters; if that stops being
 * true the table has to show them separately, so surface it here rather than
 * silently rendering one package's range as if it covered the others.
 */
function sharedRange(label: string, ranges: Record<string, string | undefined>): string {
  const entries = Object.entries(ranges);
  const [, expected] = entries[0];
  if (!expected || entries.some(([, range]) => range !== expected)) {
    const seen = entries.map(([name, range]) => `${name}=${range ?? 'missing'}`).join(', ');
    throw new Error(
      `grid-stats: ${label} peer ranges diverged (${seen}). Update the Framework Support table in ` +
        `apps/docs/src/content/docs/grid/guides/platform.mdx to show them separately.`,
    );
  }
  return expected;
}

const grid = manifest('grid');
const angular = manifest('grid-angular');
const react = manifest('grid-react');
const vue = manifest('grid-vue');

export const GRID_STATS = {
  /** Number of user-facing plugins shipped by `@toolbox-web/grid`. */
  pluginCount: countPlugins(),
  /** Gzipped size of the core ESM bundle, in kB. */
  coreGzipKb: coreGzipKb(),
  /** Runtime dependencies declared by the core package (design goal: zero). */
  coreDependencyCount: Object.keys(grid.dependencies ?? {}).length,
  /** Published version of `@toolbox-web/grid`. */
  gridVersion: grid.version,
  /** Published version of the three adapters (they release in lockstep). */
  angularAdapterVersion: angular.version,
  reactAdapterVersion: react.version,
  vueAdapterVersion: vue.version,
  /** Framework peer ranges each adapter declares. */
  angularPeer: angular.peerDependencies?.['@angular/core'] ?? '',
  /** Shared by `react` and `react-dom` — asserted identical. */
  reactPeer: sharedRange('react/react-dom', {
    react: react.peerDependencies?.['react'],
    'react-dom': react.peerDependencies?.['react-dom'],
  }),
  vuePeer: vue.peerDependencies?.['vue'] ?? '',
  /** `@toolbox-web/grid` peer range — asserted identical across all three adapters. */
  gridPeer: sharedRange('@toolbox-web/grid', {
    'grid-angular': angular.peerDependencies?.['@toolbox-web/grid'],
    'grid-react': react.peerDependencies?.['@toolbox-web/grid'],
    'grid-vue': vue.peerDependencies?.['@toolbox-web/grid'],
  }),
} as const;
