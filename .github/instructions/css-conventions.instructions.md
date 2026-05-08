---
applyTo: '**/*.css'
---

# CSS Conventions

## Color Guidelines

When adding a color to CSS, walk through these steps **in order**. Stop as soon as a step resolves your need.

### Step 1: Check existing color registries

Before writing any new value, look up an existing CSS custom property in the registry that matches your context:

- **Grid component code** (`libs/grid/src/lib/core/grid.css`): look for a `--tbw-*` variable (e.g. `--tbw-color-accent`, `--tbw-color-border`, `--tbw-color-fg-muted`).
- **Docs site** (`apps/docs/src/styles/`): look for an existing CSS variable in the docs-site styles.

### Step 2: Reuse if the existing variable fits

Reuse an existing variable only when **both** of the following are true:

- **Functional purpose matches** — the variable is intended for the same role (e.g. "accent color for interactive elements", "border between rows", "muted foreground text"). Do not reuse a variable just because it currently happens to render the same shade.
- **Visual appearance is acceptable** in the new context for both the light and dark themes the variable resolves to.

If both hold, use the existing variable and stop. Do **not** create a duplicate variable.

### Step 3: If no variable fits, decide whether to add one to a registry

If the new color will be reused, or it represents a themable concept, add it to the appropriate registry rather than hard-coding the literal:

- Grid theming colors → add to `grid.css` with the `--tbw-` prefix.
- Documentation-site colors → add to the docs-site styles with the appropriate prefix.

If the color is genuinely one-off and not themable, you may use a literal in place — but prefer the registry when in doubt.

### Step 4: Always define new color values with `light-dark()`

Any new color definition (whether a new CSS variable or an inline literal) **must** use the `light-dark()` function so both light and dark modes are supported:

```css
--my-new-color: light-dark(#lightValue, #darkValue);
```

## Grid-Specific CSS Rules

- **Gate row hover styles with `@media (hover: hover)`** — Bare `:hover` on virtualized rows causes "jumping highlight" on touch devices: the browser applies `:hover` on touch-start, and as DOM elements are recycled during scroll the highlight follows the physical element. Always wrap row-level hover rules in `@media (hover: hover)`
- **`overflow: hidden` on ancestors blocks `position: sticky`** — When CSS sticky is impossible due to ancestor `overflow`, use `position: relative` with manual `translateX` in a scroll handler instead. Always verify the entire ancestor chain
- **Themes overriding `--tbw-cell-padding` must also set `--tbw-cell-padding-v` and `--tbw-cell-padding-h`** — The editing plugin's `min-height` formula uses `--tbw-cell-padding-v` to match non-editing cell height. If a theme sets a shorthand `--tbw-cell-padding` without updating the individual components, editing cells will be the wrong height
- **`background: currentColor` is NOT a generic rule for `[data-icon]`** — Inline SVGs that use `fill="currentColor"` rely on the icon being the foreground (text), so applying `background: currentColor` to all `[data-icon]` makes those SVGs invisible (background and fill are the same color). Apply `background: currentColor` only to icons that use the CSS `mask`/`-webkit-mask` technique to render their shape (where the element's background paints through a mask). For `<svg>` icons that use `fill`/`stroke`, leave the background unset and let the SVG handle its own color via `currentColor`.
