---
domain: build-css
related: [build-and-deploy, grid-core]
---

# Styling & CSS — Mental Model

> Build/release/CI/bench live in build-and-deploy.md. This file owns the CSS layer strategy, custom properties, partials, themes, style injection, and demo-asset aliases.

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

## css-self-reference-pitfall

- INVARIANT: `--x: var(--x, fallback)` declared at the **same scope** is self-referencing → produces the [CSS guaranteed-invalid value](https://www.w3.org/TR/css-variables-1/#guaranteed-invalid-value). It does NOT mean "use `--x` from the parent, else fallback" — that pattern only works when the inner declaration is on a **descendant** element of the one where `--x` was defined.
- SYMPTOM: a child rule that consumes `--x` silently renders nothing (e.g. `outline: 2px dotted var(--cell-focus)` invisible, `background: var(--today-ring)` empty). DevTools shows the property as defined but with the invalid-value indicator.
- DECIDED: never re-declare an existing token with `var(--same-token, fallback)` to "set a default". Either pick a different variable name for the local layer, or assign the fallback value directly. Bit our demo CSS when the calendar shell re-declared `--demo-color-accent` on `.calendar-demo` to seed a default — clobbered the parent cascade. File context: [demos/shared/calendar/demo-styles.css](demos/shared/calendar/demo-styles.css).

## demo-shared-aliases (`@demo/shared/*`)

- OWNS: cross-demo import paths used by `demos/{vanilla,react,vue,angular}` and by `apps/docs` Astro components consuming the same shared data/types/styles under `demos/shared/<demo-name>/`.
- WHERE: [demos/shared/resolve-aliases.ts](demos/shared/resolve-aliases.ts) (consumed by each demo's Vite config); [apps/docs/astro.config.mjs](apps/docs/astro.config.mjs) `vite.resolve.alias` block.
- INVARIANT: bare alias values MUST point at a **directory**, not a specific `index.ts` file. Vite's resolver appends unmatched subpath tails to the alias `replacement` (Node-style). With `find: '@demo/shared/calendar'` → `replacement: '.../calendar/index.ts'`, a postcss-import of `@demo/shared/calendar/demo-styles.css` resolves to `.../calendar/index.ts/demo-styles.css` (ENOENT). Directory form lets bare specifiers go through default index resolution AND subpath imports work naturally.
- DECIDED (May 2026): drop the dedicated per-file `@demo/shared/<name>/demo-styles.css` alias and the regex-anchored bare alias. One directory alias per demo covers both bare and subpath cases and matches the existing `employee-management` pattern. Verified with `bun nx run-many -t build -p demo-vanilla,demo-react,demo-vue,docs`.
- RULED OUT: regex-anchored `new RegExp(\`^@demo/shared/${name}$\`)` to disambiguate prefix-match. Works for Vite arrays but Astro's alias map is object-keyed, and the directory pattern is simpler and uniform across both consumers.

## demo-css-leak (Astro prod-bundle gotcha)

- INVARIANT: a demo's CSS MUST scope any `tbw-grid …` grid-override selector under the demo's container class (e.g. `.calendar-demo tbw-grid .data-grid-row > .cell`). A **bare** `tbw-grid .data-grid-row > .cell { … }` is a global rule that matches EVERY grid on EVERY page.
- WHY dev hides it: Astro **dev** only loads a component's CSS on routes that use that component, so the leak is invisible locally. Astro **production** bundles component CSS into shared `_astro/*.css` files that load on other pages too — so the leak only appears in the built/deployed site.
- SYMPTOM (gh: missing cell borders on `/grid/core/` in prod, fine locally): the calendar demo's unscoped `tbw-grid .data-grid-row > .cell { border: 1px solid var(--cal-color-cell-border) }` won the cascade over the grid's own equal-specificity `border-bottom: var(--tbw-row-divider)` rule. `--cal-color-cell-border` is only defined on `.calendar-demo`, so on other pages it was undefined → the whole `border` declaration invalid → cells rendered `0px none`.
- DECIDED (gh): scope all four `tbw-grid` selectors in [demos/shared/calendar/demo-styles.css](demos/shared/calendar/demo-styles.css) under `.calendar-demo`. The file header already claimed the styles were "scoped under `.calendar-demo`"; the border rules simply weren't. Verify via a **production** docs build + preview (dev won't reproduce): `bun nx build docs && bun nx preview docs` then inspect `.data-grid-row > .cell` border on a non-calendar page.
- NOTE: bare `tbw-grid …` selectors that end in a **demo-specific class** (e.g. booking-logs `tbw-grid .cell:focus-within .bl-trace-cell-show`) are harmless — that class exists on no other page — so they need no scoping.

## style-injection

- Grid styles: concatenated partials → `<style>` tag in shadow DOM (connectedCallback)
- Custom/plugin styles: CSSStyleSheet via document.adoptedStyleSheets (survives DOM rebuilds)
- Plugin styles registered via `grid.registerStyles(id, css)` → creates sheet → replaceSync → add to adopted
- INVARIANT: plugin CSS is transformed **in isolation** (each plugin's own `?inline` build) and injected as a **standalone** adopted stylesheet. Any CSS lowering that depends on a companion `:root` rule (see lightningcss-light-dark below) breaks, because that root rule lives in a _different_ stylesheet.

## lightningcss-light-dark (build minifier gotcha)

- INVARIANT: Vite 8 (rolldown-vite) minifies CSS with **lightningcss by default**. Given browser targets, lightningcss LOWERS `light-dark()` into `var(--lightningcss-light,a) var(--lightningcss-dark,b)` toggle vars, whose defining `:root {--lightningcss-light: …}` / `@media (prefers-color-scheme)` rule it emits **into the same stylesheet**. It is NOT emitted for a fragment that has no such context.
- SYMPTOM: after the Vite 8 upgrade the tooltip lost its background, border, and arrow (all three use `light-dark()`) only in the **built/published** package — dev server was fine (unminified). Core grid looked OK only because theme CSS (copied as-is, not minified) supplied the colours; core's own `variables.css` light-dark defaults were equally broken but masked.
- DECIDED (gh tooltip regression): exclude the LightDark lowering feature so `light-dark()` ships verbatim. `libs/grid/vite.config.ts` defines a shared `cssConfig = { transformer: 'lightningcss', lightningcss: { exclude: Features.LightDark } }` and spreads `css: cssConfig` into the main `defineConfig` **and every nested `build({ configFile: false })`** (libBuild, plugin/feature/umd/all builds) — those do NOT inherit the top-level `css`. WHY: the grid targets modern browsers that support `light-dark()` natively (it also relies on CSS anchor positioning / `@position-try`, which lightningcss passes through and cannot polyfill anyway). Verify: `grep -c lightningcss-light dist/libs/grid/**/index.js` must be 0.
- RULED OUT: raising lightningcss `targets` (even Chrome 123 / Safari 17.4 / FF 120) — lightningcss 1.32 still treats `light-dark()` as not-yet-baseline and lowers it. Feature `exclude` is the only reliable lever. esbuild minify preserves it, but keep lightningcss for the rest of the pipeline.

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
