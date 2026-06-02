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

