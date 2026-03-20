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
