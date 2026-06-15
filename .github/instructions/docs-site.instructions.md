---
applyTo: 'apps/docs/**'
---

# Documentation Site (Astro/Starlight)

Documentation lives in `apps/docs/` using Astro + Starlight. MDX content pages are in `src/content/docs/grid/`. Interactive demo components are in `src/components/demos/`. Run the docs site: `bun nx serve docs` (port 4401). See the `astro-demo` skill for demo component templates and the `docs-update` skill for the full documentation inventory.

## Key Components

- `DemoControls.astro` — Reusable Storybook-like interactive controls panel (number/boolean/radio/select/check-group)
- `ShowSource.astro` — Source code viewer wrapper for demos. Behaviour:
  - **Extractor**: AST-based, using the TypeScript compiler API plus targeted text edits (no regex pitfalls).
  - **Boilerplate stripped from the displayed snippet**: the `document.getElementById` container lookup, the `if (container) {}` guard, `control-change` listeners, type assertions, and `!` non-null operators.
  - **Single-grid demos**: the original selector is collapsed to `'tbw-grid'` so the snippet reads like idiomatic standalone usage.
  - **Multi-grid demos** (2 or more `queryGrid()` calls present): original selectors are preserved verbatim, so the displayed snippet is still runnable.
- For per-framework code examples, use Starlight's `<Tabs syncKey="framework">` / `<TabItem>` from `@astrojs/starlight/components` (page-wide synced selection). See `apps/docs/src/content/docs/grid/getting-started.mdx` for the canonical pattern.
- `ThemeBuilder.astro` — Interactive CSS variable editor
- `CSSVariableReference.astro` — CSS variable reference table

## Shell API — recommend `grid.getPluginByName('shell')`, never the deprecated `grid.*` delegates

The header bar / toolbar content / tool panels are owned by the built-in **shell plugin** (extraction #370). The 15 `grid.*` element delegates (`openToolPanel`, `closeToolPanel`, `toggleToolPanel`, `toggleToolPanelSection`, `get`/`register`/`unregisterToolPanel`, `get`/`register`/`unregister`{HeaderContent,ToolbarContent}, getters `isToolPanelOpen`/`expandedToolPanelSections`) are `@deprecated` and removed at v3. In guides, examples, and JSDoc, ALWAYS show `const shell = grid.getPluginByName('shell'); shell?.openToolPanel()` — never `grid.openToolPanel()`. JSDoc `@link`s in shell/adapter source must target `ShellPlugin.*`, not `DataGridElement.*`. The only acceptable `grid.openToolPanel()` occurrences are inside the auto-generated `DataGridElement` deprecated-method reference pages (which document the deprecated surface itself and carry the replacement notice).

## Internal links must be lowercase — Astro lowercases every slug

Astro lowercases the slug of every content-collection page, so a page whose source file is `api/core/Classes/DataGridElement.mdx` is served at `/grid/api/core/classes/datagridelement/`. **Any internal link that includes uppercase path segments (e.g. `/grid/react/api/features/useGridExport/`) 404s in production**, even though the on-disk typedoc directory is capitalized. Always write internal links fully lowercased: `/grid/react/api/features/usegridexport/`. This applies to hand-authored MDX links, the `externalSymbolLinkMappings` in each adapter's `typedoc.json`, and any hard-coded link strings in `libs/grid/scripts/typedoc-to-mdx.ts`. Note: `grep_search` is case-insensitive — use a case-sensitive terminal `grep -E '\]\(/[^) ]*[A-Z]'` to detect offending links.

## Demo CSS Gotcha — Use `<style is:global>` for grid-internal selectors

Astro scopes `<style>` blocks by appending `:where(.astro-<hash>)` to every selector. This means `#my-demo tbw-grid .row-section .cell` becomes `#my-demo:where(.astro-X) tbw-grid:where(.astro-X) .row-section:where(.astro-X) .cell:where(.astro-X)` — and since the grid's rows are dynamically rendered web-component DOM that does NOT carry the Astro hash class, **none of those selectors will match**. Demos that style elements rendered by `tbw-grid` (rows, cells, plugin clones) MUST use `<style is:global>` so the selectors stay un-scoped. Symptom: the rule shows up in DevTools but never matches anything; rowClass-tagged rows render unstyled.
