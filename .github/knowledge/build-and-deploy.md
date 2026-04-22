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
