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

## touch-action policy (`base.css`, #307)

- DECIDED (#307, Jul 2026): JS-managed scroll surfaces and drag affordances carry `touch-action: none`. Exhaustive list: `.tbw-grid-content` + `.rows-viewport` + `.faux-vscroll` (`base.css`), `.resize-handle` (`header.css`). The comment at the canonical declaration in `base.css` records the rationale. NOT applied to `.header-cell` — a header must stay swipe-scrollable.
- MUST NOT use `pan-x pan-y` — delegates scroll to the browser compositor, bypasses the faux scrollbar.
- MUST NOT use `manipulation` — suppresses double-tap-to-zoom; WCAG 1.4.4 violation.
- `touch-action: none` is the only correct value for JS-managed scroll elements. Verified in touch-input audit #307 (Jul 2026): no plugin sets `pan-x pan-y` or `manipulation`.

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

## touch-pointer-a11y (#305)

- OWNS: `--tbw-touch-target-min: 24px` in `variables.css`. 24px = WCAG 2.2 SC **2.5.8** Target Size (Minimum), Level **AA**. Override to 44px for SC **2.5.5** Target Size (Enhanced), Level **AAA**. (Do not swap these — the two SCs are easy to confuse.)
- SUPERSEDED (#449): #305's "all `min-width`/`min-height` hit-target rules live under `@media (pointer: coarse)`; fine-pointer rendering is UNCHANGED" was WRONG — SC 2.5.8 is not pointer-conditional. Coarse blocks now only enlarge the **visible box** (comfort); the 24px **target** is unconditional. See touch-target-min-fine-pointer below.
- INVARIANT: every `:hover`-_reveal_ rule (opacity 0→1, display none→block, visibility hidden→visible) MUST have a sibling `@media (hover: none)` rule keeping the control visible. Hover _emphasis_ (colour/opacity change on an already-visible control) is exempt.
- DECIDED (Jul 2026 #305): "hover-emphasis stays hover-only" exception — `header.css` `.sortable:hover > span[part~='sort-indicator']` and `.resize-handle:hover::before/::after` are emphasis-only (the indicator/handle are always rendered); they stay hover-only on fine pointers and are NOT wrapped in `@media (hover: hover)`. Coarse-pointer hit-target rules are in a separate `@media (pointer: coarse)` block.
- Controls patched (coarse min-size + hover-none reveal where applicable): `.tbw-filter-btn` (filtering.css), `.tbw-visibility-handle` (visibility.css), `.dg-row-drag-handle` (row-drag-drop.css), `.resize-handle` + sort `span[part~='sort-indicator']` (header.css), `.tbw-tool-panel-resize` (shell.css), `.group-toggle` (grouping-rows.css), `.master-detail-toggle` (master-detail.css), `.tree-toggle` + `.tree-spacer` (tree.css — the spacer holds the toggle slot on leaf rows and MUST grow with it, or leaf rows misalign), `.pivot-toggle` (pivot.css), `.tbw-select-row-checkbox` + `.tbw-select-all-checkbox` (selection.css).

## touch-target-min-fine-pointer (#449, SC 2.5.8)

- DECIDED (#449): **grow the target, not the box.** SC 2.5.8 applies to every pointer type, but a density-critical grid cannot raise row height / column width / tree indent to reach it. Five mechanisms, in order of preference:
  1. transparent centred `::after` overlay (`inline-size`/`block-size: var(--tbw-touch-target-min, 24px)`, `translate: -50% -50%`) on a `position: relative` control — `.tree-toggle`, `.group-toggle`, `.master-detail-toggle`, `.pivot-toggle`, `.dg-row-drag-handle`;
  2. already-absolute handle simply widened — `.resize-handle` (`width: max(var(--tbw-resize-hit-area, 18px), var(--tbw-touch-target-min, 24px))`, moved OUT of the coarse block);
  3. `min-width`/`min-height` on the box where 4px of width is affordable — `.tbw-filter-btn`, `.tbw-col-move-btn`;
  4. `<label>` wrapper, for **replaced elements that cannot take a pseudo-element** — `.tbw-checkbox-header` is a `<label>` so the whole 32px cell activates `.tbw-select-all-checkbox`;
  5. nothing, when the row/cell click already performs the action — `.tbw-select-row-checkbox` has no listener of its own.
- INVARIANT (#449): a small target may overlap a LARGE one (icon inside a cell), never another small one. `.resize-handle` reaches 12px into the cell, so `header.css > .cell.resizable` carries `padding-inline-end: max(var(--tbw-cell-padding-h, 0.5em), calc(var(--tbw-touch-target-min, 24px) / 2))` (8px → 12px) to keep `.tbw-filter-btn` clear.
- INVARIANT (#449): `.tbw-tool-panel-resize` straddles the panel's docked edge (`left/right: calc(3px - var(--tbw-tool-panel-resize-overhang, 12px))`, width = overhang × 2) so it never covers panel controls. This needs `.tbw-tool-panel { overflow: clip; overflow-clip-margin: var(--tbw-tool-panel-resize-overhang, 12px) }` (was `hidden`) + `display:none` on `:not(.open)`, or the splitter hangs over the grid while closed.
- INVARIANT (#449, Chromium): `overflow-clip-margin` silently DROPS a `calc()` value. `var()` works, a bare length works, `calc(var(--x)/2)` does not. Hence the separate `--tbw-tool-panel-resize-overhang` token rather than deriving it from `--tbw-touch-target-min`.
- INVARIANT (#449): the visible 6px splitter bar moved to `::before` (the element itself is now the 24px hit area) — inset from the outer side by `calc(var(--tbw-tool-panel-resize-overhang, 12px) - 3px)`.
- INVARIANT (#449): CSS target size is **untestable in happy-dom** (no layout engine). The gate is `e2e/tests/accessibility.spec.ts` → `Accessibility: target size (WCAG 2.2 SC 2.5.8)`, which probes the four corners of a 24px square with `document.elementFromPoint` and requires the hit to be the control or a descendant. Do NOT accept `hit.contains(el)` — an ancestor cell match makes the assertion vacuous.
- TENSION (#449): a resizable column narrower than ~48px loses most of its header sort target to the two neighbouring resize handles. Accepted: consumer-chosen density, and the same trade already applied on coarse pointers.

## text-spacing & reflow (#449, SC 1.4.12 / 1.4.10)

- VERTICAL is already conformant, by accident of virtualization: `rows.css > .cell` uses `min-height: var(--tbw-row-height)` (NOT `height`), and `virtualization-manager.ts#setupRowHeightObserver` `ResizeObserver`s the first ROW (not its cells), so a taller line box re-measures the whole layout. Measured with the SC's own override at 1280px and at 320px card mode: rows 96 → 120/124px, zero clipping, zero overlap. Do not swap that `min-height` for a fixed `height`.
- HORIZONTAL is not: `rows.css > .cell` sets `white-space: var(--tbw-cell-white-space, nowrap)` + `text-overflow: ellipsis`. Applying the four SC 1.4.12 properties took the employee demo from 32 to **59** truncated cells — 27 cells lost content purely to user spacing.
- DECIDED (#449): W3C `understanding/21/text-spacing.html#ellipses` permits the ellipsis ONLY while "the content is still available", and states outright: _"Where text is not truncated but it is when text is spaced, if there is no mechanism to show the truncated text, it fails this success criterion."_ The Tooltip PLUGIN was the only reveal, and conformance may not depend on an optional plugin (same rule as the SC 2.5.7 drag alternatives). So CORE now owns a minimal reveal and the plugin upgrades it.
- Mechanism: `event-delegation.ts#syncTruncationTitle`, called from a delegated `mouseover` on `renderRoot` in `setupRootEventDelegation`. Sets `cell.title = textContent` when `scrollWidth > clientWidth`, marks it `data-tbw-truncated`, and removes both once the cell fits again.
- INVARIANT (#449): resolve the title on HOVER, never at render time. A render-path `title` write would touch every cell and would make non-truncated cells sprout tooltips (intrusive). `scrollWidth` forces sync layout, but only on pointer entry — the cost the Tooltip plugin already accepts.
- INVARIANT (#449): the `data-tbw-truncated` marker exists so an author's / renderer's own `title` is never clobbered and never deleted. Only a title core set may be removed.
- INVARIANT (#449): the handler bails when `grid.getPluginByName('tooltip')` resolves — otherwise the native tooltip and the plugin popover stack. Layering: core = conformant native `title` (no popover, no positioning, no CSS, ~0 gz); plugin = styled, hoverable, focus-triggered, Escape-dismissible.
- REJECTED (#449): a pure-CSS hover "peek" (`overflow: visible; width: max-content; z-index`) — zero JS, but it moves layout on EVERY truncated cell the pointer crosses. Fails the project's non-intrusive bar.
- `--tbw-cell-white-space: normal` is the documented opt-in for consumers who want wrapping instead of any truncation; it composes with virtualization because of the row observer above.
- SC 1.4.10: the grid table itself uses the SC's explicit **data-table exception** (two-dimensional layout). Nothing else does — see grid-plugins-shell.md › tool-panel width clamp. There are NO viewport `@media` queries anywhere in grid CSS; reflow of the table is the ResponsivePlugin's element-width-driven card mode.

## themes (libs/themes/)

- 6 built-in: standard, material, bootstrap, contrast (a11y), vibrant, large (a11y)
- All wrap in @layer tbw-theme
- Source files (not built), copied as-is to dist
- Optional — grid works without any theme using base variables only
- Usage: `<link>` tag or `import '@toolbox-web/grid/themes/dg-theme-standard.css'`
- INVARIANT (Jul 2026 #449): `dg-theme-contrast.css` + `dg-theme-large.css` must clear **WCAG AAA (7:1)** on every text pair and SC 1.4.11 (3:1) on `--tbw-color-accent`/`--tbw-color-border-strong` vs `--tbw-color-bg`, in **both** schemes. Guarded by `apps/docs-e2e/tests/theme-contrast.spec.ts` (measures live via a probe span, not by parsing CSS — `light-dark()`/`color-mix()` only resolve in the engine). Core default stays AA.
- DECIDED (Jul 2026 #449): a11y themes flip `--tbw-color-accent-fg` polarity per scheme (`light-dark(#ffffff, #000000)`). WHY: the dark-mode accent must stay bright to clear 3:1 against the dark grid bg (focus ring / sort indicator), and a bright accent can never carry white text at 7:1. Darkening the dark accent instead fails 1.4.11 (`#1b45c4` on `#1f2125` = 2.07:1).
- DECIDED (Jul 2026 #449): a11y themes set `--tbw-color-header-fg` explicitly instead of inheriting core's `color-mix(in hsl, fg 75%, panel-bg)`. WHY: the mix dilutes header text toward the panel bg — `large` landed at 7.05:1, i.e. zero margin.
- INVARIANT: `color-mix()` computes in Chrome to `color(srgb r g b)` with **0-1** components, never `rgb()`. Any JS reading computed colours (`ThemeBuilder.astro` contrast panel, e2e contrast probe) must parse that form or every derived token reads as unresolved. Also: `#000000` is a legitimate token value (contrast theme light `--tbw-color-fg`) — don't treat it as "unset".
- GOTCHA: on the theming guide page `document.querySelector('[data-tbw-grid]')` matches the injected `<style id="tbw-grid-styles">` first. Scope colour probes to a real `<tbw-grid>` (`#css-var-probe`).
- INVARIANT (#449): `--tbw-color-hover-bg` DOES NOT EXIST in any theme or `variables.css` — hover backgrounds use `--tbw-color-row-hover` + a `light-dark()` fallback. `--tbw-border-radius` varies wildly per theme (`0` contrast … `12px` material), so controls under ~30px MUST cap it: `min(var(--tbw-border-radius, 0.25rem), 6px)`.

## browser support floor

- DECIDED (Jun 2026): supported baseline is **Chrome/Edge 123, Firefox 121, Safari 17.5**. Driven by `light-dark()` (Chrome 123 / FF 120 / Safari 17.5 — 18 uses across `variables.css`, `loading.css`, `empty.css`) and `:has()` (FF 121). Also required: CSS Nesting, `@layer`, `adoptedStyleSheets` (Safari 16.4), `ResizeObserver`/`IntersectionObserver`. Documented in `apps/docs/src/content/docs/grid/guides/platform.mdx#browser-support` + `libs/grid/README.md`.
- DECIDED: NO `prefers-color-scheme` fallback for `light-dark()`. WHY: would roughly double shipped CSS and reintroduce flash-of-wrong-theme. Raising the floor is the accepted trade.
- Progressively enhanced (guarded, degrade gracefully): Popover API + CSS anchor positioning — `supportsPopover()` / `CSS.supports('anchor-name', '--test')` in `plugins/tooltip/TooltipPlugin.ts` L82-88. NOT guarded: `:has()` in `plugins/print/print-isolated.ts` (hard requirement).
