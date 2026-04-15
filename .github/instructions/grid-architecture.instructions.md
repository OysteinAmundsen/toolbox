---
applyTo: 'libs/grid/src/**'
---

# Grid Component Architecture

The `<tbw-grid>` component (`libs/grid/src/lib/core/grid.ts`) is a light DOM web component with:

- **Single Source of Truth**: `#effectiveConfig` holds the merged canonical configuration
- **Public API surface** defined in `src/public.ts` - only export types/functions meant for external consumption
- **Internal modules** in `core/internal/` directory that power core features:
  - `columns.ts` - Column config resolution, header rendering, auto-sizing
  - `rows.ts` - Row rendering, virtualization, inline editing
  - `row-manager.ts` - Row lifecycle management
  - `keyboard.ts` - Keyboard navigation (arrows, Enter, Escape)
  - `resize.ts` - Column resizing controller
  - `header.ts` - Header row rendering with custom header renderers
  - `aggregators.ts` - Footer aggregation functions (sum, avg, etc.)
  - `sanitize.ts` - Template string evaluation with safety guards
  - `inference.ts` - Column type inference from data
  - `dom-builder.ts` - DOM element construction helpers
  - `config-manager.ts` - Configuration merging and management
  - `shell.ts` - Grid shell/container layout
  - `style-injector.ts` - Programmatic style injection via `adoptedStyleSheets`
  - `sorting.ts` - Sort state management and comparators
  - `virtualization-manager.ts` - Virtualization window calculations
  - `focus-manager.ts` - Focus tracking and restoration

## Configuration Precedence System (Single Source of Truth)

The Grid follows a **single source of truth** pattern where all configuration inputs converge into `#effectiveConfig`:

**Input Sources → `#mergeEffectiveConfig()` → `#effectiveConfig` (canonical)**

Users can configure via:

- `gridConfig` property - full config object
- `columns` property - shorthand for `gridConfig.columns`
- `fitMode` property - shortcut for `gridConfig.fitMode`
- Light DOM elements (`<tbw-grid-column>`, `<tbw-grid-header>`)

**Precedence (low → high):**

1. `gridConfig` prop (base)
2. Light DOM elements (declarative)
3. `columns` prop (direct array)
4. Inferred columns (auto-detected from first row)
5. Individual props (`fitMode`) - highest

**Internal State Categories:**

- **Input Properties** (`#rows`, `#columns`, `#gridConfig`, `#fitMode`) - raw user input
- **Effective Config** (`#effectiveConfig`) - **THE single source of truth**
- **Derived State** (`_columns`, `_rows`) - result of plugin processing hooks
- **Runtime State** (`#hiddenColumns`, `sortState`) - user-driven changes at runtime

**Key rule**: All rendering logic reads from `effectiveConfig` or derived state, never from input properties.

See `config-precedence.spec.ts` for test examples.

## Centralized Render Scheduler

All grid rendering is orchestrated through a **single RenderScheduler** (`internal/render-scheduler.ts`). See the `debug-perf` skill for the full phase table and pipeline details.

**Key rules:**

- Use `this.#scheduler.requestPhase(RenderPhase.X, 'source')` to request renders
- Never call `requestAnimationFrame` directly for rendering (exception: scroll hot path)
- Phases: STYLE(1) → VIRTUALIZATION(2) → HEADER(3) → ROWS(4) → COLUMNS(5) → FULL(6); highest wins

## CSS Layer Architecture

Styles are modularized in `libs/grid/src/lib/core/styles/` using CSS cascade layers:

1. `@layer tbw-base` — Core grid structure (base, shell, header, rows, loading, animations, tool-panel, media-queries)
2. `@layer tbw-plugins` — Plugin-contributed styles
3. `@layer tbw-theme` — Theme overrides
4. Unlayered — User styles win automatically (highest specificity)

CSS variables for theming are defined in `styles/variables.css`.

## Custom Styles API (adoptedStyleSheets)

The grid uses light DOM — standard CSS (global stylesheets, `<style>` in `<head>`, external CSS files) works normally for styling grid content.

For **programmatic runtime styles**, use `registerStyles()` which injects CSS via `adoptedStyleSheets`:

```typescript
grid.registerStyles('my-id', '.my-class { color: blue; }');
grid.unregisterStyles('my-id');
```

**Do NOT** create `<style>` elements as **children of `<tbw-grid>`** — they get removed by `replaceChildren()` during renders. This only affects styles placed _inside_ the grid element; external CSS is unaffected.

## Vite Build Auto-Discovery

Plugins and features are auto-discovered from the filesystem in `vite.config.ts` — each plugin directory and feature file is automatically registered as a separate entry point. No manual registration is needed when adding new plugins or features.

## Virtualization & Performance

The Grid uses **row virtualization**:

- Configurable via `virtualization` internal state object
- Default `rowHeight: 28px`, `overscan: 8` rows
- Rows rendered only for visible viewport window
- Row pooling via `rowPool: HTMLElement[]` for efficient DOM reuse
- Update via `refreshVirtualWindow(full: boolean)` - called via scheduler or directly for scroll

## Row Data Access Convention

When plugins or APIs expose row references to consumers, **prefer returning row data objects** over raw indices:

- **Row objects are stable identifiers** — indices shift when the grid sorts, filters, or groups data. A row index from `selection-change` refers to the grid's _processed_ `rows` array, not the user's original input array.
- **Always offer a row-object alternative** — e.g., `getSelectedRows()` alongside `getSelectedRowIndices()`. Framework adapters should expose the object-based accessor as the primary API.
- **Indices are fine as positional coordinates** — `CellRange`, `rowIndex`/`colIndex` in events, and similar positional references are naturally index-based. But when the consumer's goal is _data access_, provide the resolved object.
- **Use `this.rows`** (or `this.grid?.rows`) in plugins to resolve indices — this returns the grid's current post-processing row array, which is what indices correspond to.

```typescript
// ✅ Preferred: return actual row objects
const employees = selection.getSelectedRows<Employee>();

// ⚠️ Fragile: forces consumer to maintain index mapping
const indices = selection.getSelectedRowIndices();
const employees = indices.map((i) => myLocalData[i]); // May be wrong after sort/filter!
```

## Inter-Plugin Communication

Plugins communicate via three distinct channels. **Choosing the wrong channel is a common source of bugs** — other plugins silently miss events.

| Channel              | Method                               | Audience              | Use when                                                                        |
| -------------------- | ------------------------------------ | --------------------- | ------------------------------------------------------------------------------- |
| **DOM Event**        | `this.emit(type, detail)`            | External consumers    | Consumer-facing: `sort-change`, `filter-applied`, `selection-change`            |
| **Plugin Event Bus** | `this.emitPluginEvent(type, detail)` | Other plugins only    | Plugin-internal: `filter-change`, state sync between plugins                    |
| **Broadcast (both)** | `this.broadcast(type, detail)`       | Consumers AND plugins | Events that both consumers AND plugins need: `sort-change`, `tree-state-change` |
| **Query System**     | `this.grid.query(type, context)`     | Sync request/response | State retrieval: `sort:get-model`, `canMoveRow`, `clipboard:copy`               |

### Decision Tree

1. **Does this event need to reach external `addEventListener` consumers?**
   - No → `emitPluginEvent()` (plugin bus only)
   - Yes → continue to Q2
2. **Does this event also need to reach other plugins** (e.g., Selection clearing on sort)?
   - No → `emit()` (DOM only)
   - Yes → `broadcast()` (both channels)
3. **Is this a synchronous state request** (not a notification)?
   - → `this.grid.query(type, context)` — declare query in manifest, handle in `handleQuery()`

### Sorting Ownership Protocol

When multiple plugins handle sorting (MultiSort, Tree, GroupingRows), follow this protocol:

- **MultiSort is the sort authority** when loaded — other plugins must query `sort:get-model` from MultiSort rather than maintaining independent sort state
- **Tree/GroupingRows**: Query `sort:get-model` in `processRows()` to get the effective sort; delegate header clicks to MultiSort when it's active; fall back to own sort logic only when MultiSort is absent
- **All plugins that change sort state** must use `broadcast('sort-change', ...)` so both consumers and plugins (e.g., Selection) are notified

### Query System Contracts

Plugins that handle queries must:

1. **Declare queries in manifest**: `static override readonly manifest = { queries: [{ type: 'myQuery' }] }`
2. **Declare dependencies**: If you call `this.grid.query('x')`, declare the plugin that handles `x` as a dependency (at minimum `required: false`)
3. **Return `undefined`** from `handleQuery()` for unrecognized query types — the PluginManager aggregates non-undefined responses

## Web Component Patterns

- **Properties**: Use getters/setters for reactive properties that trigger re-renders
- **State**: Use private fields with `#` prefix for internal state
- **Events**: Use `CustomEvent` with `dispatchEvent()` - consumers listen via `addEventListener('event-name', ...)`
- **Methods**: Public methods callable from JS, use `async` for operations that need component ready
- **Element ref**: Access via `this` (extends HTMLElement)
- **Lifecycle**: `connectedCallback()`, `disconnectedCallback()`, `attributeChangedCallback()`
- **Light DOM**: Render directly to element with CSS nesting (`tbw-grid { }`) for style scoping

## Plugin DOM Access

- **Use `this.gridElement`** for DOM queries — the grid uses light DOM (no Shadow DOM)
- **`#applyColumnState` width-only fast path** — When `columnState` changes only column widths, the grid skips `#setup()` → `RenderPhase.FULL` and instead invalidates the visible columns cache + calls `updateTemplate()` directly. `#isWidthOnlyChange` normalizes `hidden` with `!!` because `applyState` sets `hidden = !visible`

## DOM Constants (`core/constants.ts`)

- **Always use `GridClasses`** for CSS class names in TypeScript — never raw strings like `'sticky-left'` or `'dragging'`
- **Bundle-safe**: Terser inlines the string values and tree-shakes the object — zero overhead in plugin bundles
- **Shell UI classes are separate**: `shell.ts` uses `'expanded'`/`'resizing'` for its own accordion UI, NOT for grid row expansion — do not replace those with `GridClasses`
- **`GridDataAttrs`** constants must match actual DOM attributes used in code (e.g., `data-row`, `data-col`, `data-field`)
