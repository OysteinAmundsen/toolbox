---
domain: grid-plugins
related: [grid-core, grid-features]
---

# Grid Plugins — Mental Model

## plugin-manager

- OWNS: plugin instances (array order), hook caches (sorted by priority), renderer/editor registries, event bus, query handlers
- READS FROM: plugin manifests (dependencies, incompatibilities, hookPriority, queries)
- WRITES TO: cached hook presence flags, cellRenderers/headerRenderers/cellEditors maps
- INVARIANT: plugins execute in array order by default; hookPriority overrides (lower = earlier)
- INVARIANT: dependencies validated on attach; incompatibilities warned at runtime (dev only)
- PATTERN: one PluginManager per grid instance; plugins are stateful singletons

## plugin-lifecycle

- FLOW: attach(grid) → merge defaults + user config → store grid ref → onPluginAttached() notifications → [runtime hooks] → detach() → abort signal fires → cleanup
- INVARIANT: disconnectSignal (AbortSignal) fires on detach — use for all event listener cleanup
- INVARIANT: plugin.grid is available after attach(), null after detach()
- DECIDED: Plugins should prefer config-driven initialization over post-ready imperative setup. If a resource (e.g., data source) is known at config time, accept it as a config property and auto-init in `attach()`. Reserve imperative methods (e.g., `setDataSource()`) for runtime swaps only. Pattern: ServerSidePlugin reads `config.dataSource` in `attach()`.

## hook-system

### Render-Cycle Hooks (PluginManager invokes)

| Hook            | Phase        | Purpose                                  | Returns        |
| --------------- | ------------ | ---------------------------------------- | -------------- |
| processColumns  | COLUMNS      | transform column array                   | ColumnConfig[] |
| processRows     | ROWS         | transform row array (filter/sort/expand) | any[]          |
| afterCellRender | per-cell     | cell-level styling, badges               | void           |
| afterRowRender  | per-row      | row-level styling, ARIA                  | void           |
| afterRender     | STYLE        | full DOM queries, event listeners        | void           |
| onScrollRender  | scroll-reuse | reapply visual state to recycled DOM     | void           |

### Event Hooks (return true for early exit)

| Hook                    | Trigger              |
| ----------------------- | -------------------- |
| onKeyDown               | key pressed in grid  |
| onCellClick             | data cell clicked    |
| onRowClick              | any row area clicked |
| onHeaderClick           | header clicked       |
| onScroll                | viewport scrolls     |
| onCellMouseDown/Move/Up | drag operations      |

### Virtualization Hooks

| Hook                       | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| getRowHeight               | report synthetic row height (detail panels, tree) |
| adjustVirtualStart         | render extra rows above viewport                  |
| renderRow                  | custom row DOM (bypasses default renderer)        |
| getHorizontalScrollOffsets | pinned column spacing for keyboard                |

### State Persistence Hooks

- getColumnState() → return plugin column-specific state for save
- applyColumnState() → restore from load

## inter-plugin-communication

- EVENT BUS (broadcast, async): `this.emitPluginEvent(type, detail)` or `this.broadcast(type, detail)` (also reaches DOM)
- QUERY SYSTEM (sync, manifest-routed): `this.grid.query(query)` → only plugins declaring query type in manifest are invoked
- DIRECT ACCESS: `this.grid.getPluginByName('multiSort')` or `this.getPlugin(MultiSortPlugin)`
- INVARIANT: events are one-way notifications; queries are synchronous state retrieval
- PATTERN: use events for state broadcasts (sort-change, filter-change); use queries for state reads within a lifecycle phase

## plugin-manifest-schema

```
ownedProperties    — property validation rules
hookPriority       — Partial<Record<HookName, number>> (lower = earlier)
configRules        — validation for plugin config
incompatibleWith   — warn if both loaded
queries            — query types this plugin handles
events             — event types this plugin emits
modifiesRowStructure — affects render scheduler
```

## hook-priority-map (key priorities from codebase)

| Plugin        | Hook           | Priority | Reason                                     |
| ------------- | -------------- | -------- | ------------------------------------------ |
| ServerSide    | processRows    | -10      | provides managedNodes first                |
| PinnedColumns | processColumns | -10      | reorder pinned before ColumnVirtualization |
| Pivot         | onHeaderClick  | -10      | intercept before MultiSort                 |
| GroupingRows  | onHeaderClick  | -1       | intercept group headers before MultiSort   |
| Tree          | processRows    | 10       | after ServerSide, before others            |
| GroupingRows  | processRows    | 10       | after ServerSide                           |
| Pivot         | processRows    | 100      | after MultiSort, apply aggregation         |

## incompatibility-graph

- GroupingRows ↔ Tree (both transform entire row array)
- GroupingRows ↔ Pivot (pivot creates own row/column structure)
- Tree ↔ Pivot (same reason)
- ServerSide ↔ Pivot (lazy-load vs full dataset)

## coexistence-rules

- ServerSide + GroupingRows: COMPATIBLE only in pre-defined groups mode (`setGroups()` / `setGroupRows()`)
- ServerSide + Tree: COMPATIBLE — Tree has its own `dataSource` for lazy-loading paginated tree data
- MasterDetail + GroupingRows: COMPATIBLE (MasterDetail skips `__isGroupRow`)
- Responsive + GroupingRows: COMPATIBLE (Responsive skips `__isGroupRow`)
- Pivot + MultiSort: COMPATIBLE (Pivot queries sort model, processRows at priority 100)

## all-plugins (24 total, categorized)

### Row-Transforming (modifiesRowStructure: true)

**ServerSide** — OWNS: fetch cache, lazy-loaded blocks, placeholder nodes, infinite scroll state. HOOKS: processRows(-10). EVENTS: datasource:data/children/loading/error. QUERIES: datasource:fetch-children, datasource:is-active. LISTENS: sort-change, filter-change (cache purge + refetch). INVARIANT: totalNodeCount=-1 activates infinite scroll; lastNode finalizes total; short blocks auto-detect end.

**Tree** — OWNS: expanded keys, flattened rows, row key map, animation state, loading keys. HOOKS: processRows(10), processColumns, afterCellRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart. QUERIES: canMoveRow, datasource:viewport-mapping, sort:get-model. EVENTS: tree-expand. FIRES: datasource:fetch-children (on expand of lazy nodes). INVARIANT: lazy children signaled by truthy non-array childrenField value (e.g., `children: true`); child rows are single-batch (no pagination).

**GroupingRows** — OWNS: grouped row model, expanded group keys, animation state. HOOKS: processRows(10), onHeaderClick(-1), renderRow. QUERIES: canMoveRow, grouping:get-grouped-fields, datasource:viewport-mapping. EVENTS: group-toggle/expand/collapse

**Pivot** — OWNS: pivot result, flattened pivot rows, expanded keys, column totals, sort state. HOOKS: onHeaderClick(-10), processRows(100). QUERIES: sort:get-sort-config. EVENTS: pivot-toggle, pivot-config-change. INVARIANT: `PivotRow.isGroup` means "has sub-groups" (`remainingFields.length > 0`), NOT "is a group row" — single `rowGroupFields` produces `isGroup: false`; `getAllGroupKeys()` returns nothing for single-level pivots

### Column-Transforming

**PinnedColumns** — OWNS: pinned state per column. HOOKS: processColumns(-10), afterCellRender. TENSION: runs first to reorder before ColumnVirtualization

**ColumnVirtualization** — OWNS: visible column subset based on scroll. HOOKS: processColumns

**Visibility** — OWNS: hidden column set. HOOKS: processColumns

**GroupingColumns** — OWNS: column groups structure. HOOKS: processColumns

### Selection & Navigation

**Selection** — OWNS: selected rows/cells, ranges, mode. HOOKS: onCellClick, onRowClick, onKeyDown, afterCellRender, processColumns (checkbox column). EVENTS: selection-change. MODES: cell, row, range

### Editing & Undo

**Editing** — OWNS: active cell, editor snapshots, changed rows, dirty tracking. HOOKS: processColumns, processRows, afterCellRender, afterRowRender, onCellClick, onKeyDown. EVENTS: cell-commit, row-commit, edit-open/close. TENSION: must handle row re-sorting during edit (caches sort result)

**UndoRedo** — OWNS: undo/redo stacks. HOOKS: onKeyDown (Ctrl+Z/Y). DEPENDS: editing (required)

### Sorting & Filtering

**MultiSort** — OWNS: sortModel[], cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: sort:get-model, sort:set-model. EVENTS: sort-change. TENSION: caches sort during row edit to prevent edited row from jumping. INVARIANT: MultiSort is the authoritative sort source — Tree and GroupingRows must query `sort:get-model` when MultiSort is loaded, not maintain independent sort state (causes desync of sort indicators vs actual order)

**Filtering** — OWNS: filterModels Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: filter-change. INVARIANT: numeric comparison operators (`greaterThan`, `>=`, `<`, `<=`, `between`) must exclude blank values (null / undefined / '' / NaN) before coercion — JS implicit conversion leaks them through (`null >= 0` is `true`, `Number('') === 0`). Blank rows are matched _only_ by the explicit `blank` operator. NaN is treated as blank (strictly an error but conceptually "no value"). DECIDED (Apr 2026): number filter panel's Apply button clears the filter when both bounds are still at the data-derived defaults — otherwise applying `between(dataMin, dataMax)` would silently exclude blank rows the user never intended to filter out.

### Row Details

**MasterDetail** — OWNS: expanded rows, detail height, animation state. HOOKS: processColumns (expander), onCellClick, afterRowRender, getRowHeight, adjustVirtualStart. EVENTS: master-detail-toggle

### Reordering

**ReorderColumns** — OWNS: column order, drag state. HOOKS: onCellMouseDown/Move/Up, afterRender. QUERIES: canMoveColumn

**ReorderRows** — OWNS: row order, drag state. HOOKS: onCellMouseDown/Move/Up. QUERIES: canMoveRow

### Display

**Responsive** — OWNS: breakpoint-based column visibility. HOOKS: processColumns, getRowHeight

**Tooltip** — OWNS: active tooltip, positioning. HOOKS: afterCellRender

**ContextMenu** — OWNS: menu items, open state. HOOKS: afterRender, onKeyDown. QUERIES: getContextMenuItems (queries all plugins for contributions)

### Export

**Clipboard** — OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl+C/V/X). DEPENDS: selection (optional)

**Export** — OWNS: export format/state. Exposes export methods (CSV, JSON, Excel)

**Print** — OWNS: print styling. Exposes print methods

### Pinned Rows

**PinnedRows** — OWNS: pinned row positions (top/bottom), info bar (row counts / custom panels), aggregation rows. HOOKS: afterRender. READS FROM: `grid.sourceRows` (for `totalRows`), `grid.rows` (for `filteredRows`), filter plugin's `cachedResult` (preferred when present), selection plugin's `selected` set. INVARIANT: `filteredRows` must reflect the actual post-filter count regardless of _which_ mechanism did the filtering — filter plugin, column filters, external/server-side, or direct `grid.rows =` assignment. DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not from the passed `rows` argument, so externally-filtered hosts get correct counts without needing the filter plugin.
