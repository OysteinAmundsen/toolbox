---
applyTo: 'apps/docs/**'
---

# Documentation Site (Astro/Starlight)

Documentation lives in `apps/docs/` using Astro + Starlight. MDX content pages are in `src/content/docs/grid/`. Interactive demo components are in `src/components/demos/`. Run the docs site: `bun nx serve docs` (port 4401). See the `astro-demo` skill for demo component templates and the `docs-update` skill for the full documentation inventory.

## Key Components

- `DemoControls.astro` — Reusable Storybook-like interactive controls panel (number/boolean/radio/select/check-group)
- `ShowSource.astro` — Source code viewer wrapper for demos. Uses an AST-based extractor (TypeScript compiler API + text edits) to strip boilerplate (`document.getElementById` container, `if (container) {}` guard, `control-change` listeners, type assertions, `!` operators) without regex pitfalls. **Multi-grid demos:** when 2+ `queryGrid()` calls are present, original selectors are preserved (so the displayed snippet is still runnable). Single-grid demos collapse the selector to `'tbw-grid'`.
- `FrameworkTabs.astro` — Framework code tab switcher (Vanilla/React/Vue/Angular)
- `ThemeBuilder.astro` — Interactive CSS variable editor
- `CSSVariableReference.astro` — CSS variable reference table
