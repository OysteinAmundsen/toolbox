# RFC: Remove Shadow DOM from tbw-grid

**Status:** ✅ Implemented  
**Author:** @copilot  
**Created:** 2026-01-18  
**Implemented:** 2026-01-18  
**Branch:** `feature/remove-shadow-dom`

## Summary

Remove Shadow DOM encapsulation from `<tbw-grid>` to make the component significantly easier to style. The grid will remain a web component (custom element) but render to light DOM instead of shadow DOM.

## Motivation

### Problem

Shadow DOM is the #1 barrier to styling the grid:

1. **Custom renderers/editors** - Content injected into cells cannot be styled with external CSS
2. **Workarounds are painful** - `registerStyles()`, `::part()`, CSS variables all have limitations
3. **Framework integration** - Angular/React components rendered inside the grid need special handling
4. **Learning curve** - Developers expect standard CSS to work

### Current Workarounds

```typescript
// Consumer must use registerStyles() API
grid.registerStyles('my-styles', `
  .my-custom-cell { color: blue; }
`);

// Or rely on CSS variables (limited)
tbw-grid {
  --tbw-color-accent: blue;
}
```

### Desired State

```css
/* Standard CSS just works */
tbw-grid .my-custom-cell {
  color: blue;
}

/* Or with CSS nesting */
tbw-grid {
  .my-custom-cell {
    color: blue;
  }
}
```

## Proposal

### 1. Remove Shadow DOM

Replace `attachShadow()` with direct DOM rendering:

```typescript
// BEFORE
constructor() {
  super();
  this.#shadow = this.attachShadow({ mode: 'open' });
}

// AFTER
constructor() {
  super();
  // No shadow attachment - render directly to this element
}
```

### 2. Convert CSS to Use CSS Nesting

Wrap all selectors inside `tbw-grid { }` using native CSS nesting:

```css
/* BEFORE (Shadow DOM) */
:host {
  --tbw-color-bg: transparent;
  position: relative;
  display: block;
}
:host .header { ... }
:host .data-grid-row { ... }

/* AFTER (Light DOM with nesting) */
tbw-grid {
  --tbw-color-bg: transparent;
  position: relative;
  display: block;

  .header { ... }
  .data-grid-row { ... }
}
```

**Browser support:** CSS nesting is supported in all major browsers since December 2023.

### 3. Update Plugin Architecture

Change `shadowRoot` references to use the grid element directly:

```typescript
// BEFORE (in plugins)
const body = this.shadowRoot?.querySelector('.rows');

// AFTER
const body = this.gridElement.querySelector('.rows');
```

### 4. Simplify Style Injection

- Remove `adoptedStyleSheets` machinery
- Plugins can export CSS as regular stylesheets
- `registerStyles()` becomes optional convenience API (or deprecated)

## Technical Details

### Files Affected

| Category   | Files            | Changes                             |
| ---------- | ---------------- | ----------------------------------- |
| Core       | `grid.ts`        | Remove shadow, update render target |
| Core       | `grid.css`       | Convert to CSS nesting              |
| Base       | `base-plugin.ts` | Update `shadowRoot` getter          |
| Plugins    | 15+ plugin files | Change `shadowRoot` → `gridElement` |
| Tests      | 50+ test files   | Update DOM queries                  |
| Plugin CSS | 8+ CSS files     | Convert to CSS nesting              |

### Rendering Changes

```typescript
// Current: render to shadow root
this.#shadow.replaceChildren(...);

// Proposed: render to element itself
this.replaceChildren(...);
// OR use a root container
this.#root.replaceChildren(...);
```

### Root Container Option

To maintain a clean separation, we could use an internal root:

```typescript
connectedCallback() {
  if (!this.#root) {
    this.#root = document.createElement('div');
    this.#root.className = 'tbw-grid-root';
    this.appendChild(this.#root);
  }
}
```

This keeps light DOM children (like `<tbw-grid-column>`) separate from grid internals.

## Migration Guide

### For Consumers

**Breaking changes:**

1. `grid.shadowRoot` returns `null` - use `grid` or `grid.querySelector()` directly
2. External CSS now affects grid internals (this is intentional!)
3. Selectors like `.cell` could conflict with page CSS (we use distinctive class names)

**What works better:**

```css
/* Custom renderer styling - just works now! */
tbw-grid .my-status-badge {
  padding: 4px 8px;
  border-radius: 4px;
}

/* Override grid styles easily */
tbw-grid .header {
  background: navy;
}
```

### For Plugin Authors

```typescript
// BEFORE
const rows = this.shadowRoot?.querySelector('.rows');

// AFTER
const rows = this.gridElement.querySelector('.rows');
```

## Alternatives Considered

### 1. Keep Shadow DOM + Better `::part()` Support

**Pros:** Maintains encapsulation  
**Cons:** Requires adding `part` attributes everywhere, still limited for custom content

### 2. Hybrid Approach (Declarative Shadow DOM)

**Pros:** Could allow external stylesheets  
**Cons:** More complexity, limited browser support for some features

### 3. CSS Layers Inside Shadow DOM

**Pros:** Better override control  
**Cons:** Still can't style injected custom content

## Risks and Mitigations

| Risk                             | Mitigation                                                   |
| -------------------------------- | ------------------------------------------------------------ |
| Page CSS breaks grid             | Use distinctive class names (`.tbw-*` prefix if needed)      |
| Consumers depend on `shadowRoot` | Document in migration guide, provide transition period       |
| Plugin CSS conflicts             | Wrap plugin CSS in `tbw-grid { }` nesting                    |
| Performance (style recalc)       | Unlikely significant impact; grids already use CSS variables |

## Implementation Plan

### Phase 1: Core Changes ✅

1. [x] Update `grid.ts` to render without shadow DOM
2. [x] Convert `grid.css` to CSS nesting (`grid-light.css`)
3. [x] Update `base-plugin.ts` shadowRoot getter
4. [x] Verify basic grid rendering works

### Phase 2: Plugin Updates ✅

1. [x] Update all plugin `shadowRoot` → `gridElement` references (12 plugins)
2. [x] Convert plugin CSS files to nesting (editing, filtering, selection)
3. [x] Update helper functions (`applyStickyOffsets`, `clearStickyOffsets`)

### Phase 3: Test Updates ✅

1. [x] Update test DOM queries to use light DOM
2. [x] Update mock grids to be real DOM elements
3. [x] All 1503+ tests pass

### Phase 4: Documentation 🔄

1. [x] Update RFC status
2. [ ] Update copilot-instructions.md
3. [ ] Update Storybook examples if needed

### Phase 5: Demos & Verification ✅

1. [x] Verify vanilla demo works
2. [x] Verify Angular demo works
3. [x] Verify React demo works
4. [x] Test custom renderer/editor styling

## Success Criteria

1. [x] All 1500+ tests pass (1503 passed)
2. All three demo apps work correctly
3. Custom renderers/editors can be styled with plain CSS
4. No significant performance regression
5. Bundle size unchanged or smaller

## Open Questions

1. **Class name prefixing:** Should we rename `.cell` → `.tbw-cell` for extra safety?
   - Current: Distinctive names like `.data-grid-row`, `.tbw-grid-root` are already safe
   - Could be done incrementally if conflicts arise

2. **`registerStyles()` API:** Keep, deprecate, or remove?
   - Proposal: Keep as convenience for programmatic style injection
   - Works differently (appends `<style>` instead of adoptedStyleSheets)

3. **Light DOM children:** How to handle `<tbw-grid-column>` elements?
   - They already exist in light DOM; grid reads and hides them
   - No change needed

## References

- [CSS Nesting MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)
- [CSS Layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [GitHub Elements (light DOM custom elements)](https://github.com/github/github-elements)
- [Shoelace hybrid approach discussion](https://github.com/shoelace-style/shoelace/discussions/1749)
