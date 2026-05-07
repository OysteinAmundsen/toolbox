---
applyTo: 'apps/docs/**'
---

# Documentation Site (Astro/Starlight)

Documentation lives in `apps/docs/` using Astro + Starlight. MDX content pages are in `src/content/docs/grid/`. Interactive demo components are in `src/components/demos/`. Run the docs site: `bun nx serve docs` (port 4401). See the `astro-demo` skill for demo component templates and the `docs-update` skill for the full documentation inventory.

## Key Components

- `DemoControls.astro` — Reusable Storybook-like interactive controls panel (number/boolean/radio/select/check-group)
- `ShowSource.astro` — Source code viewer wrapper for demos. Uses an AST-based extractor (TypeScript compiler API + text edits) to strip boilerplate (`document.getElementById` container, `if (container) {}` guard, `control-change` listeners, type assertions, `!` operators) without regex pitfalls. **Multi-grid demos:** when 2+ `queryGrid()` calls are present, original selectors are preserved (so the displayed snippet is still runnable). Single-grid demos collapse the selector to `'tbw-grid'`.
- For per-framework code examples, use Starlight's `<Tabs syncKey="framework">` / `<TabItem>` from `@astrojs/starlight/components` (page-wide synced selection). See [getting-started.mdx](apps/docs/src/content/docs/grid/getting-started.mdx) for the canonical pattern.
- `ThemeBuilder.astro` — Interactive CSS variable editor
- `CSSVariableReference.astro` — CSS variable reference table

## Demo CSS Gotcha — Use `<style is:global>` for grid-internal selectors

Astro scopes `<style>` blocks by appending `:where(.astro-<hash>)` to every selector. This means `#my-demo tbw-grid .row-section .cell` becomes `#my-demo:where(.astro-X) tbw-grid:where(.astro-X) .row-section:where(.astro-X) .cell:where(.astro-X)` — and since the grid's rows are dynamically rendered web-component DOM that does NOT carry the Astro hash class, **none of those selectors will match**. Demos that style elements rendered by `tbw-grid` (rows, cells, plugin clones) MUST use `<style is:global>` so the selectors stay un-scoped. Symptom: the rule shows up in DevTools but never matches anything; rowClass-tagged rows render unstyled.
