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

export const GRID_STATS = {
  /** Number of user-facing plugins shipped by `@toolbox-web/grid`. */
  pluginCount: countPlugins(),
  /** Gzipped size of the core ESM bundle, in kB. */
  coreGzipKb: coreGzipKb(),
} as const;
