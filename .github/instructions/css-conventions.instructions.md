---
applyTo: '**/*.css'
---

# CSS Conventions

## Color Guidelines

When adding colors to CSS, follow these rules:

1. **Check existing color registries first:**
   - **Grid component code** (`libs/grid/src/lib/core/grid.css`): Check if a suitable `--tbw-*` variable exists (e.g., `--tbw-color-accent`, `--tbw-color-border`, `--tbw-color-fg-muted`)
   - **Docs site** (`apps/docs/src/styles/`): Check for any existing CSS variables in the docs site styles

2. **Reuse existing variables** when the semantic meaning matches. Don't create duplicates.

3. **If no suitable variable exists**, consider whether the color should be added to a registry:
   - Grid theming colors → add to `grid.css` with `--tbw-` prefix
   - Documentation site colors → add to docs site styles with appropriate prefix

4. **Always use `light-dark()` function** for new color definitions to support both light and dark modes:

   ```css
   --my-new-color: light-dark(#lightValue, #darkValue);
   ```

## Grid-Specific CSS Rules

- **Gate row hover styles with `@media (hover: hover)`** — Bare `:hover` on virtualized rows causes "jumping highlight" on touch devices: the browser applies `:hover` on touch-start, and as DOM elements are recycled during scroll the highlight follows the physical element. Always wrap row-level hover rules in `@media (hover: hover)`
- **`overflow: hidden` on ancestors blocks `position: sticky`** — When CSS sticky is impossible due to ancestor `overflow`, use `position: relative` with manual `translateX` in a scroll handler instead. Always verify the entire ancestor chain
