---
applyTo: 'libs/grid/**'
---

# Grid API Guidelines

## API Inclusion Criteria

Before adding any new public method, type, or event to a plugin, evaluate it against these criteria. **All three must be met.** If any criterion fails, the API does not belong in the library.

| Priority | Criterion                 | Question                                                             | Fail example                                                              |
| -------- | ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **1**    | **Internal state access** | Does the consumer need data they can't get from existing public API? | `isAllSelected()` — derivable from `getUniqueValues()` + `getFilters()`   |
| **2**    | **Non-trivial logic**     | Is the logic complex enough that reimplementing it is error-prone?   | `getNumericDataRange()` — it's `Math.min/max` over `getUniqueValues()`    |
| **3**    | **Broad consumer value**  | Will a significant majority of consumers use this?                   | `getFilterSummaryLabel()` — hardcodes English UI text, unusable with i18n |

The criteria are conjunctive (AND), not weighted — there is **no trade-off** to resolve. Use the priority column only as the order in which to evaluate them: a failure at priority 1 short-circuits the rest. Borderline cases on any criterion default to **reject** (push back on the issue with the failing criterion as the reason); add the API later if real consumer demand emerges.

**Guidelines:**

- A method that wraps 1–3 lines of existing API calls does not belong in the library
- Getters are justified as companions to complex setters (e.g., `getBlankMode()` pairs with `toggleBlankFilter()`)
- Events that run on hot paths (e.g., every `processRows` call) must demonstrate **measurable** performance benefits or **negligible** runtime impact before being accepted. Concretely: emitting the event must add no more than ~0.1 ms per `processRows` call on a 10 000-row dataset (measured with the existing performance benchmarks under `e2e/`), or it must replace existing work that costs at least as much. If you cannot produce that measurement, prefer an on-demand method (consumers call it when they need the value) over an auto-emitting event.
- Library code must never contain hardcoded locale-specific strings; if a method needs UI text, it doesn't belong in the library

## API Stability & Breaking Changes

**`@toolbox-web/grid` is now a released library.** Avoid breaking changes to the public API.

**What constitutes a breaking change:**

- Removing or renaming exported types, interfaces, classes, or functions from `public.ts`
- Changing method signatures (adding required parameters, changing return types)
- Removing or renaming public properties/methods on `<tbw-grid>` element
- Removing or renaming CSS custom properties (theming variables)
- Changing event names or payload structures
- Removing or renaming plugin hook methods in `BaseGridPlugin`
- Changing the `disconnectSignal` contract (plugins depend on it for cleanup)

**What is NOT a breaking change:**

- Adding new optional properties, methods, or events
- Internal refactoring that doesn't affect public API
- Bug fixes (even if they change incorrect behavior)
- Adding new exports to `public.ts`
- Performance improvements
- New plugins or plugin features

**When breaking changes are unavoidable:**

1. Document clearly in PR description
2. Update CHANGELOG with migration guide
3. Consider deprecation period with console warnings before removal
4. Bump major version

## Features vs Plugins

There are two ways to enable grid capabilities. **Features** (recommended) use declarative config with tree-shakeable side-effect imports. **Plugins** (advanced) give direct class access for custom plugin development.

| Aspect       | Features (recommended)                          | Plugins (advanced)                                                      |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| API          | `features: { selection: 'row' }`                | `plugins: [new SelectionPlugin({ mode: 'row' })]`                       |
| Import       | `import '@toolbox-web/grid/features/selection'` | `import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection'` |
| Dependencies | Auto-resolved                                   | Manual ordering                                                         |
| Use when     | Configuring grid capabilities                   | Building custom plugins, extending BaseGridPlugin                       |

There are **22 features** — one per plugin, ~200-300 bytes each. Framework adapters expose features as component props.

**Always prefer `getPluginByName()` over `getPlugin()`.** It avoids importing the plugin class and returns the actual instance.

## Security Contracts

- **User-supplied HTML strings MUST pass through `sanitizeHTML()`** — Any path that writes a user-supplied string to `innerHTML` (`gridConfig.icons.*`, cell renderer string returns, group-header renderer string returns, light-DOM tool panel fallback content, plugin wrappers, anywhere else a string becomes markup) must wrap the value with `sanitizeHTML()` from `core/internal/sanitize.ts`. `textContent` is wrong here — it renders HTML/SVG icon strings as literal text. Raw `innerHTML` is wrong — it is an XSS sink. The canonical reference implementation is `core/internal/rows.ts` (cell renderer path); when adding a new renderer-like extension point, mirror that pattern exactly.

## Plugin Development

See the `new-plugin` skill for the complete guide: file structure, hooks, event bus, query system, manifest, dependencies, and runtime config validation.

## API & Plugin Conventions

- **Don't import from `internal/` in public API** — Keep `src/public.ts` as the only external export; internal modules are implementation details
- **Plugin barrel exports = published API surface** — Each plugin's `index.ts` is a Vite entry point. Everything exported becomes public `@toolbox-web/grid/plugins/<name>` surface and gets TypeDoc docs. Only export the plugin class, public types, and intentionally public utilities
- **Public API setters must always trigger render** — Plugin `set*` methods should call `refresh()` unconditionally, not `refreshIfActive()`. Guard rendering behind `isActive` only in internal callbacks
- **`builtInSort` is public API and MUST NOT mutate input** — The exported `builtInSort` is documented as non-mutating (`[...rows].sort()`). Internal callers that already own a mutable copy bypass it via `sortInPlace()`. When you need to add an internal fast path, gate it with `handler === builtInSort` (reference equality) — never string comparison or duck-typing.
- **`applySorts()` copies; `sortRowsInPlace()` does not** — The public `applySorts()` creates a copy before sorting, so consumers can pass any array safely. Inside `MultiSortPlugin.processRows` (and any other plugin operating on the already-cloned plugin pipeline input), use `sortRowsInPlace()` instead — the input is already a mutable copy from `plugin-manager` and a second copy is wasted allocation in the hot path.
- **Use `BaseGridPlugin.updateSortIndicator(cell, direction)` to render sort indicators** — Core CSS targets `[part~='sort-indicator']` for visibility/opacity; MultiSort CSS targets `.sort-indicator` for margin. The helper sets BOTH the `part` attribute and the `class`, resolves the icon, sets aria/data attributes, and inserts the element at the correct DOM position. Never construct sort indicators manually — missing either selector hook breaks visibility or layout.
- **Master-detail `Set` helpers mutate in place and return the same reference** — `toggleDetailRow`, `expandDetailRow`, and `collapseDetailRow` mutate the input `Set<number>` and return it (same reference). This is intentional for O(1) performance. Do NOT rely on reference inequality (`result !== input`) to detect changes; inspect the returned set's contents instead.

## Custom Editor / Overlay Focus Contract

- **Custom editors that render outside the cell DOM MUST register with the grid focus manager.** Editors that append elements to `<body>` (datepickers, dropdowns, color pickers, autocomplete portals) call `grid.registerExternalFocusContainer(panel)` so the grid treats focus inside those elements as "still in the grid" and does not close the editor when focus moves to the overlay. Call `grid.unregisterExternalFocusContainer(panel)` when the overlay is destroyed. Angular's `BaseOverlayEditor` and React's `useGridOverlay` hook do this automatically; pure-vanilla overlay editors must wire it up themselves.
- **`aria-expanded` + `aria-controls` is the generic fallback** — if a portal panel sets `aria-expanded="true" aria-controls=<id>` on its trigger inside the active row, the grid's `editor-injection.ts` and `EditingPlugin` outside-click / Enter handlers will treat targets inside that panel as inside the editor without per-library glue. Use this as the contract when registering the focus container is impractical.

## Inter-Plugin Communication Conventions

### Choosing the right channel

Use this table to pick the right communication mechanism. The detailed rules and the known query types follow underneath.

| Mechanism               | Use when…                                                                                                | Example                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **`broadcast()`**       | The event is a state change that **both** consumers (`addEventListener`) **and** other plugins react to. | `sort-change`, `filter-change`, `tree-expand`, `group-toggle`                 |
| **`emitPluginEvent()`** | Only other plugins care; consumers should not see the event.                                             | Internal coordination notifications between plugins.                          |
| **`emit()`**            | Consumer-facing event with **no** plugin subscribers. (Rare — most state changes need both.)             | One-off lifecycle notifications consumers may subscribe to.                   |
| **`grid.query(…)`**     | You need a synchronous answer from another plugin's state.                                               | `grid.query('sort:get-model')` instead of `grid.plugins.multiSort.getModel()` |

### Event-bus rules

- **Never use `emit()` alone for state changes that other plugins react to** (Selection, ColumnState, etc.) — they will silently miss the event. Use `broadcast()`.
- **Never access another plugin's methods directly** (e.g., `grid.plugins.clipboard.copy()`). Always go through `grid.query('clipboard:copy')`. Direct access bypasses the manifest and breaks plugin substitution.
- **Declare everything in manifests** — Queries in `manifest.queries`, events in `manifest.events`, dependencies in `static dependencies`. Undeclared contracts are invisible to validation and documentation tools.
- **Cross-plugin sort coordination** — When a plugin supports sorting and MultiSort may also be loaded, query `sort:get-model` to get the authoritative sort state rather than maintaining a separate sort model.

### Known Query Types

| Query Type            | Handler Plugin     | Purpose                            |
| --------------------- | ------------------ | ---------------------------------- |
| `sort:get-model`      | MultiSort          | Get current sort model             |
| `sort:set-model`      | MultiSort          | Set sort model programmatically    |
| `canMoveColumn`       | PinnedColumns      | Check if column can be reordered   |
| `canMoveRow`          | GroupingRows, Tree | Check if row can be reordered      |
| `clipboard:copy`      | Clipboard          | Trigger copy action                |
| `export:csv`          | Export             | Trigger CSV export                 |
| `getContextMenuItems` | Various            | Collect context menu contributions |

## Feature & Plugin Usage Reference

- **Editing is opt-in** — `editable: true` or `editor` requires `features: { editing: true }` or `EditingPlugin`
- **Dirty tracking is opt-in** — Enable via `new EditingPlugin({ dirtyTracking: true })`. Requires `getRowId`. Provides `isDirty()`, `getDirtyRows()`, `markAsPristine()`, `revertRow()`, and `dirty-change` event
- **Use `insertRow()`/`removeRow()` for manual row mutations** — Operates on the current sorted/filtered view without re-running the pipeline, auto-animates. Use `grid.rows = data` for full data refreshes
- **Use `focusCell()` and `scrollToRow()` for programmatic navigation** — `grid.focusCell(rowIndex, column)` accepts column index or field name. `grid.scrollToRow(rowIndex, { align, behavior })` scrolls into view
- **Silent filter updates for batching** — `setFilter()`, `setFilterModel()`, `clearAllFilters()`, `clearFieldFilter()` accept `{ silent: true }` to defer re-render
- **Filter state and column state persistence** — Set `trackColumnState: true` in FilteringPlugin config to include filter state in `column-state-change` events and `getColumnState()` snapshots
