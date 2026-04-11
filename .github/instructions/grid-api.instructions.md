---
applyTo: 'libs/grid/**'
---

# Grid API Guidelines

## API Inclusion Criteria

Before adding any new public method, type, or event to a plugin, evaluate it against these criteria. All three must be met:

| Criterion                 | Question                                                             | Fail example                                                              |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Internal state access** | Does the consumer need data they can't get from existing public API? | `isAllSelected()` — derivable from `getUniqueValues()` + `getFilters()`   |
| **Non-trivial logic**     | Is the logic complex enough that reimplementing it is error-prone?   | `getNumericDataRange()` — it's `Math.min/max` over `getUniqueValues()`    |
| **Broad consumer value**  | Will a significant majority of consumers use this?                   | `getFilterSummaryLabel()` — hardcodes English UI text, unusable with i18n |

**Guidelines:**

- A method that wraps 1–3 lines of existing API calls does not belong in the library
- Getters are justified as companions to complex setters (e.g., `getBlankMode()` pairs with `toggleBlankFilter()`)
- Events that run on hot paths (e.g., every `processRows` call) must justify their performance cost — prefer on-demand methods over auto-emitting events
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

## Plugin Development

See the `new-plugin` skill for the complete guide: file structure, hooks, event bus, query system, manifest, dependencies, and runtime config validation.

## API & Plugin Conventions

- **Don't import from `internal/` in public API** — Keep `src/public.ts` as the only external export; internal modules are implementation details
- **Plugin barrel exports = published API surface** — Each plugin's `index.ts` is a Vite entry point. Everything exported becomes public `@toolbox-web/grid/plugins/<name>` surface and gets TypeDoc docs. Only export the plugin class, public types, and intentionally public utilities
- **Public API setters must always trigger render** — Plugin `set*` methods should call `refresh()` unconditionally, not `refreshIfActive()`. Guard rendering behind `isActive` only in internal callbacks

## Feature & Plugin Usage Reference

- **Editing is opt-in** — `editable: true` or `editor` requires `features: { editing: true }` or `EditingPlugin`
- **Dirty tracking is opt-in** — Enable via `new EditingPlugin({ dirtyTracking: true })`. Requires `getRowId`. Provides `isDirty()`, `getDirtyRows()`, `markAsPristine()`, `revertRow()`, and `dirty-change` event
- **Use `insertRow()`/`removeRow()` for manual row mutations** — Operates on the current sorted/filtered view without re-running the pipeline, auto-animates. Use `grid.rows = data` for full data refreshes
- **Use `focusCell()` and `scrollToRow()` for programmatic navigation** — `grid.focusCell(rowIndex, column)` accepts column index or field name. `grid.scrollToRow(rowIndex, { align, behavior })` scrolls into view
- **Silent filter updates for batching** — `setFilter()`, `setFilterModel()`, `clearAllFilters()`, `clearFieldFilter()` accept `{ silent: true }` to defer re-render
- **Filter state and column state persistence** — Set `trackColumnState: true` in FilteringPlugin config to include filter state in `column-state-change` events and `getColumnState()` snapshots
