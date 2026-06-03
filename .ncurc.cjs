/**
 * npm-check-updates configuration — encodes this repo's dependency "clusters".
 *
 * The problem: `ncu --target minor` freezes every package at its current major,
 * so unlocked dev tools (concurrently, jsdom, typedoc, ...) rot. `ncu --target latest`
 * crosses every major, which breaks the packages that are pinned to an anchor.
 *
 * The fix: default to `latest`, but force the cluster-anchored packages to stay
 * within their current major (`minor`), and let `nx migrate` exclusively own the
 * Nx + Angular toolchain (codemods).
 *
 * Run `bunx npm-check-updates -u` (this config is picked up automatically), then
 * `bun install`. Re-run `nx migrate latest` separately for Nx/Angular.
 */

// Owned by `nx migrate` (runs codemods). ncu must never touch these.
const migrateOwned = ['nx', '@nx/*', '@angular/*', '@angular-devkit/build-angular', 'ng-packagr'];

// Cluster-anchored: a new major requires its anchor to advance first, so stay
// within the current major (minor/patch upgrades only). Entries ending in `/`
// are treated as prefixes so a whole family (e.g. every `@astrojs/*` package)
// is covered by membership — you do NOT have to enumerate each new member.
const majorLocked = [
  // TypeScript ceiling — Angular 21 and typescript-eslint 8 both cap at < 6.
  'typescript',
  // ESLint 9 — typescript-eslint 8 and @nx/eslint do not support ESLint 10 yet.
  'eslint',
  '@eslint/js',
  // Vite/Vitest cluster — @nx/vite 22.7.x supports Vite 7, not 8.
  'vite',
  'vite-plugin-dts',
  '@vitejs/', // plugin-react, plugin-vue, ...
  'vitest',
  '@vitest/', // coverage-v8, ui, browser, ...
  // Astro/Starlight docs cluster — Starlight gates the safe Astro major.
  'astro',
  'astro-mermaid',
  '@astrojs/', // mdx, starlight, cloudflare, ...
  // Vue ecosystem — router/i18n majors track Vue; bump deliberately, not via ncu.
  'vue',
  'vue-router',
];

/** True when `name` is an exact match or sits under a `family/` prefix entry. */
function isMajorLocked(name) {
  return majorLocked.some((entry) => (entry.endsWith('/') ? name.startsWith(entry) : name === entry));
}

module.exports = {
  reject: migrateOwned,
  target: (packageName) => (isMajorLocked(packageName) ? 'minor' : 'latest'),
};
