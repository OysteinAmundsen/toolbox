---
domain: build-and-deploy
related: [grid-core]
---

# Build, CSS & Deploy — Mental Model

## vite-build (libs/grid/vite.config.ts)

- OWNS: ES & UMD outputs (core + all-in-one), per-plugin module builds, per-feature module builds, theme distribution, version injection (**GRID_VERSION**)
- INPUT: src/index.ts + src/all.ts (core), src/lib/plugins/_/index.ts (auto-discovered), src/lib/features/_.ts (auto-discovered), libs/themes/\*.css
- OUTPUT: dist/libs/grid/ → index.js, all.js, lib/plugins/_/index.js, lib/features/_.js, umd/_.umd.js, themes/_.css
- INVARIANT: plugin directory scan auto-discovers from src/lib/plugins/ (excludes all/, shared/)
- INVARIANT: plugins externalize core imports (@toolbox-web/grid) to prevent duplication
- INVARIANT: UMD global naming: "pinned-rows" → TbwGridPlugin_pinnedRows
- DECIDED: parallel plugin/feature builds (in writeBundle hook) with pre-created directories to avoid race conditions
- DECIDED: ES only for plugins (not CJS) — lighter, modern
- DECIDED: each entry is self-contained (manualChunks: undefined) — may duplicate shared code but simpler imports
- DECIDED: all comments stripped from final bundle (code golf for CDN)
- DECIDED: terser inlines constant property accesses (e.g. `GridClasses.CELL_FOCUS` → `"cell-focus"`) — using constants from `constants.ts` has zero bundle overhead vs raw strings; repeated string values are hoisted to single-letter variables
- TENSION: bundle duplication vs shared chunks — larger total but simpler per-import

## bundle-budget (tools/vite-bundle-budget.ts)

- OWNS: budget validation, file size calculation (raw + gzip via zlib), glob resolution
- RUNS IN: Vite closeBundle hook (after all sub-builds complete)
- BUDGETS: core index.js ≤170 kB raw / ≤50 kB gzip hard fail, ≤45 kB gzip soft warn; plugins ≤50 kB each; adapters: react ≤50 kB / vue ≤50 kB
- INVARIANT: both raw and gzip checked if thresholds configured
- INVARIANT: warn-only thresholds (`warnSize` / `warnGzip`) emit yellow warnings but never fail the build; hard thresholds (`maxSize` / `maxGzip`) fail when severity: 'error'
- INVARIANT: build fails with exit code 1 if severity: 'error' mode
- DECIDED (Apr 2026): raised hard gzip ceiling 45 → 50 kB and added 45 kB warn gate. Bundle was at the 45 kB cliff blocking bug fixes; new policy is design-target 45 kB, hard ceiling 50 kB. Any new code that pushes core toward 50 kB MUST first try a plugin extraction — only land in core if a plugin would damage performance (hot path, render scheduler, virtualization).

## css-layer-strategy

- CASCADE (lowest→highest): @layer tbw-base → @layer tbw-plugins → @layer tbw-theme → unlayered (user CSS always wins)
- DECIDED: layers eliminate specificity wars; three layers separate structure / features / cosmetics
- DECIDED: unlayered CSS wins so users can always override without !important

## css-custom-properties

- ALL prefixed --tbw-\* (no collision risk)
- Em-based spacing/icons: scales proportionally with font size
- Colors use light-dark() function (CSS level 4): responds to `color-scheme` on :root
- Color mixing via color-mix(in hsl, ...) for derived colors
- Grid inherits: `color-scheme: inherit` (respects page settings)

## style-injection

- Grid styles: concatenated partials → `<style>` tag in shadow DOM (connectedCallback)
- Custom/plugin styles: CSSStyleSheet via document.adoptedStyleSheets (survives DOM rebuilds)
- Plugin styles registered via `grid.registerStyles(id, css)` → creates sheet → replaceSync → add to adopted

## css-partials (libs/grid/src/lib/core/styles/)

| File              | Layer    | Responsibility                             |
| ----------------- | -------- | ------------------------------------------ |
| variables.css     | tbw-base | ~150 CSS custom properties (design tokens) |
| base.css          | tbw-base | grid root, flex layout, box-sizing         |
| header.css        | tbw-base | column headers, sort icons, resize handles |
| rows.css          | tbw-base | data rows, cells, borders, focus           |
| shell.css         | tbw-base | toolbar, shell header                      |
| tool-panel.css    | tbw-base | side panels, accordion                     |
| icons.css         | tbw-base | icon sizing, SVG                           |
| loading.css       | tbw-base | spinners, overlay                          |
| animations.css    | tbw-base | keyframes, transitions                     |
| media-queries.css | tbw-base | @prefers-reduced-motion, responsive        |

- INVARIANT: order matters — variables first, media queries last
- Plugin CSS uses @layer tbw-plugins; theme CSS uses @layer tbw-theme

## themes (libs/themes/)

- 6 built-in: standard, material, bootstrap, contrast (a11y), vibrant, large (a11y)
- All wrap in @layer tbw-theme
- Source files (not built), copied as-is to dist
- Optional — grid works without any theme using base variables only
- Usage: `<link>` tag or `import '@toolbox-web/grid/themes/dg-theme-standard.css'`

## release (release-please-config.json)

- OWNS: per-package versioning (grid, grid-angular, grid-react, grid-vue)
- MODE: prerelease (all versions tagged -rc.X)
- PATTERN: single PR for all package bumps, component in tag (grid-v2.0.0-rc.4)
- COMMIT TYPES: feat/fix/enhance/perf visible in changelog; docs/style/chore/refactor/test/build/ci hidden
- INVARIANT: each library is an independent release-please component; major bumps are per-scope. A `feat(<scope>)!:` (or `BREAKING CHANGE:` footer) on one scope triggers a major for **only** that scope.
- INVARIANT: `separate-pull-requests: false` ⇒ all pending bumps land in a single coordinated release PR.
- INVARIANT (peer-dep cascade): release-please does NOT bump `peerDependencies` automatically. When `grid` jumps a major, every adapter's `peerDependencies."@toolbox-web/grid"` range must be widened **manually** in the same PR. That peer change is itself a breaking change, so adapters get a major even when they have no own deprecation removals.
- DECIDED: publish order on a coordinated multi-major is `grid` first, then `grid-angular` / `grid-react` / `grid-vue` (peer-range satisfied at install time).
- DECIDED: v1.x deprecation commits intentionally do NOT use `!`; the `!` is reserved for the major-bump PR itself.
- DECIDED (cadence): aim for ~1 major / quarter (v1 → v2 was 22 Jan → 16 Apr 2026). Long-lived release branches are NOT used; branch from `main` ~1 week before the cut, run the cleanup as 4 `feat(<scope>)!:` commits + peer-dep bumps in one PR, let release-please publish, delete branch.

## docs versioning (`@since` pipeline + version badges)

- OWNS: per-symbol "introduced in vX.Y.Z" pills in TypeDoc-generated MDX, footer version badges linking to changelogs.
- WHERE: `tools/build-since-map.ts` (git-history scan → `tools/since-map.json`), `tools/apply-since-tags.ts` (writes `@since` JSDoc into source), `tools/typedoc-mdx-shared.ts` (`sinceBadge` / `sinceBlock` helpers), `libs/grid/scripts/typedoc-to-mdx.ts` (calls helpers in genClass/genPluginClass/genInterface/genTypeAlias/genFunction/genEnum/genPropertiesTable/genMethod/genAccessor + `genDataGridSplit` Public API), `libs/{grid,grid-angular,grid-react,grid-vue}/typedoc.json` (`blockTags` allowlist includes `@since`).
- OWNS (footer): `apps/docs/src/components/VersionBadges.astro` reads `package.json` files via static `import` (NOT `readFileSync` — fails in `astro build`), `apps/docs/src/components/Footer.astro` slots it after `<Default />`. CSS in `apps/docs/src/styles/custom.css` (`.since-badge`, `.tbw-versions`).
- INVARIANT: `build-since-map.ts` MUST enumerate every TypeDoc entry point. Grid has 1 + 26 plugin entries (`libs/grid/src/lib/plugins/*/index.ts`); missing them silently drops plugin classes from the since-map and the MDX renders no Since pill. Adapter libs have a single entry each.
- INVARIANT: tag-prefix scoping is required — grid uses `grid-` (and legacy `v`), each adapter uses `grid-<framework>-`. Mixing causes wrong "since" attribution.
- INVARIANT: `apply-since-tags.ts` is idempotent — re-running on already-tagged source skips, never duplicates.
- FLOW (back-fill, run once per cycle): `bun tools/build-since-map.ts` → `bun tools/apply-since-tags.ts` → `bun nx typedoc grid && bun nx typedoc grid-angular && bun nx typedoc grid-react && bun nx typedoc grid-vue`.
- DECIDED: `@since` lives in source JSDoc (not in a separate sidecar) so it survives refactors and is visible in IDE hovers. Generator no-ops when the tag is absent.
- DECIDED: Plugin/Adapter splits of `DataGridElement` (internal API pages) intentionally do NOT show the Since pill — it lives only on the Public API split to avoid noise on plugin-developer pages.
- DECIDED: Version badges link to `/grid/<framework>/changelog/` (slug convention); changelog pages are MDX shells that import the package CHANGELOG.md.

## ci-pipeline (.github/workflows/ci.yml)

- FLOW: setup (detect release merge) → validation (lint + test + build, parallel) → e2e (build all → start 4 demo servers with USE_DIST=true → Playwright) → release-please → build-docs → deploy-pages
- INVARIANT: e2e runs against dist/ (validates release packaging)
- INVARIANT: release-please merge commits skip validation (already passed on feature branch)
- INVARIANT: docs deploy only triggers on grid release

## nx-config (nx.json)

- Plugins: @nx/js/typescript, @nx/vite/plugin, @nx/vitest, @nx/eslint/plugin, @nx/playwright/plugin
- Named inputs: production excludes test files; sharedGlobals includes ci.yml
- TENSION: CI workflow in sharedGlobals means any CI change invalidates all caches

## tsconfig-paths (tsconfig.base.json)

- All point to dist/ (built artifacts) for CI type checking
- @toolbox-web/grid → dist/libs/grid/index.d.ts
- @toolbox-web/grid/plugins/_ → dist/libs/grid/lib/plugins/_/index.d.ts
- @toolbox-web/grid/features/_ → dist/libs/grid/lib/features/_.d.ts
- @toolbox/themes/_ → libs/themes/_ (source, not built)
- INVARIANT: TypeScript `compilerOptions.paths` does **NOT merge** across `extends`. A child tsconfig that declares its own `paths` block fully **replaces** the parent's. Same applies to `compilerOptions.types` and `compilerOptions.lib`.
- DECIDED: when a child tsconfig must override one mapping (e.g. `tsconfig.typedoc.json` pointing `@toolbox-web/grid-angular` at source instead of dist), it MUST repeat every `@toolbox-web/grid*` parent mapping it still needs, using wildcard forms (`plugins/*`, `features/*`) for compactness. Detection signal: a sudden burst of `TS2307: Cannot find module '@toolbox-web/...'` from a child config that has its own `paths` block — suspect path-shadowing first.

## v3.0.0 cleanup plan (deprecation removal)

Tracked in milestone `v3.0.0` and epic issue #263. Sub-issues: #259 (grid), #260 (grid-angular), #261 (grid-react), #262 (grid-vue) and #228 (touch DnD). Use `grep -rn '@deprecated\|MOVE-IN-V2' libs/` to enumerate at cut time.

### grid → 3.0.0

- Remove `DGEvents`, `DGEventName`, `PluginEvents`, `PluginEventName` from `libs/grid/src/public.ts`. Replacement: `keyof DataGridEventMap`.
- Delete `libs/grid/src/lib/plugins/reorder-rows/**` and `libs/grid/src/lib/features/reorder-rows.ts`. Superseded by `row-drag-drop`.
- Prune legacy `PinnedRowsConfig` fields (`top`, `bottom`, `showRowCount`, `showSelectedCount`, `showFilteredCount`, `panels`, `aggregations`) and the legacy `PinnedRowSlot` type. Keep only the unified `slots[]` API.
- Drop `RowDragDropConfig.canDragRow` (use `canDrag`).
- Drop `ServerSidePlugin.getNodeCount` / `isLoaded` aliases (use `getTotalNodeCount` / `isNodeLoaded`).

### grid-angular → 2.0.0

ng-packagr forbids primary→secondary imports, so the source must be **written in** the feature secondary entry and the primary-entry copy deleted in the **same commit**. Source files currently carry `MOVE-IN-V2:` markers (NOT `@deprecated`, because that would leak warnings to consumers importing from the correct feature entry).

- Move `base-filter-panel.ts` → `features/filtering/`.
- Move `base-grid-editor.ts`, `base-grid-editor-cva.ts`, `base-overlay-editor.ts` → `features/editing/`.
- Move `directives/grid-column-editor.directive.ts`, `grid-form-array.directive.ts`, `grid-lazy-form.directive.ts` → `features/editing/`.
- Split `directives/structural-directives.ts`: `TbwEditor` → `features/editing/`. **`TbwRenderer` STAYS in core** (editor-agnostic).
- Master-detail: `GridDetailView`, `GridDetailContext`, `getDetailTemplate` → `features/master-detail/`.
- Strip every `@deprecated` re-export from `src/index.ts`.
- Strip every `@deprecated` per-feature input/output shim prop from `directives/grid.directive.ts` (~lines 538–1098 in current file).
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### grid-react → 2.0.0

- Drop `reorderRows` alias (use `rowDragDrop`) and `SSRProps` + `ssr` prop entirely from `feature-props.ts`.
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### grid-vue → 2.0.0

- Drop `reorderRows` alias and `SSRProps` + `ssr` prop from `feature-props.ts`.
- Remove the deprecated re-export in `vue-grid-adapter.ts` (consumers import from `./editor-mount-hooks`).
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### Verification before tagging

- `bun nx run-many -t build lint test -p grid grid-angular grid-react grid-vue`
- `bun nx build demo-angular` / `demo-react` / `demo-vue` (catches dangling main-entry imports)
- `bun nx build docs` (catches stale code blocks)
- `bun nx run grid-angular:typedoc` (regen MDX matches new file layout)
- `bun nx run e2e:e2e` and `bun nx run docs-e2e:e2e`
