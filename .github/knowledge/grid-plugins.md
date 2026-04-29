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
- INVARIANT: plugins that own sort (MultiSortPlugin) must broadcast `sort-change` from applyColumnState so consumers are notified of restored sort state. Deferred via microtask to batch per-column calls.
- DECIDED (Apr 2026): plugin-side render-trigger pattern for state restoration. When a plugin owns state (e.g. sort model) that core's `#applyColumnState` width-only fast-path can't observe (because the plugin has nulled `_sortState`), the plugin — not core — is responsible for forcing a re-render after state restoration. MultiSortPlugin: snapshots its model at the start of an `applyColumnState` batch, and in the deferred microtask compares prev vs current; if changed, broadcasts `sort-change` AND calls `this.requestRender()` (ROWS phase). This covers both sort-add (incoming `state.columns[i].sort` triggers core's fast-path bypass via the `incomingHasSort` check) AND sort-removal (no incoming sort entries, fast-path WOULD run, but plugin's requestRender forces processRows to re-run with empty model). Rationale: core stays minimal — adding a `hasOwnedSort` query in core costs ~30 bytes of `index.js` (over budget); plugin chunks absorb the logic for free. Past attempt to query plugins from core was rejected on this basis. Pattern generalizes: any plugin that mutates owned state during applyColumnState must self-trigger render if the change isn't visible in the incoming `GridColumnState`.

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

## scroll-dispatch

- FLOW: faux-scrollbar `scroll` event → rAF batcher → `#onScrollBatched(scrollTop)` → geometry reads (unconditional) → `refreshVirtualWindow` → `onScrollRender` → pooled `ScrollEvent` → `pluginManager.onScroll` (gated by `#hasScrollPlugins`) → public `tbw-scroll` CustomEvent (always)
- INVARIANT: geometry reads (`scrollHeight`/`clientHeight` etc.) MUST happen before any DOM writes in the same tick to avoid forced synchronous layout. Reads moved out of the `#hasScrollPlugins` gate when `tbw-scroll` shipped — they are now unconditional because the public event needs them too.
- INVARIANT: pooled `#pooledScrollEvent` is reused across ticks — only safe for synchronous internal plugin consumers. Public `tbw-scroll` detail MUST be a fresh literal (consumers retain references).
- INVARIANT: public dispatch is gated by `#connected` via `#emit` helper — events do not fire after the grid is removed from the DOM.
- DECIDED (Apr 2026, #234): `tbw-scroll` is always-on, vertical-only, fresh detail per dispatch. `direction: 'vertical' | 'horizontal'` is declared up-front for forward compatibility; horizontal dispatch is intentionally not implemented (horizontal scroll listener is still gated behind `#hasScrollPlugins` to avoid attaching a listener for grids without scroll plugins). Adapter prop names disambiguated (`onTbwScroll` / `tbwScroll` / `@tbw-scroll`) to avoid collision with native scroll event handling.
  | GroupingRows | processRows | 10 | after ServerSide |
  | Pivot | processRows | 100 | after MultiSort, apply aggregation |

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

**ServerSide** — OWNS: fetch cache, lazy-loaded blocks, placeholder nodes (`{ __loading: true, __index }`), infinite scroll state, `managedNodes` array. HOOKS: processRows(-10) — IGNORES input rows, returns `managedNodes` directly (length-clamped to viewport). EVENTS: datasource:data/children/loading/error. QUERIES: datasource:fetch-children, datasource:is-active. LISTENS: sort-change, filter-change (cache purge + refetch). INVARIANTS: (1) totalNodeCount=-1 activates infinite scroll; lastNode finalizes total; short blocks auto-detect end. (2) `grid.sourceRows` stays empty under ServerSide — plugin owns data via processRows return value, never via `#rows`. (3) `onModelChange` MUST call `loadRequiredBlocks()` after clearing caches (no other path triggers a fetch — scroll alone won't fire if viewport hasn't moved). (4) When a block resolves and `previousManagedLength === 0` OR `managedNodes.length < totalNodeCount`, MUST call `requestRender()` (full ROWS phase) — `requestVirtualRefresh()` skips processRows so managedNodes never grows. (5) `loadRequiredBlocks()` expands the viewport by `loadThreshold` rows in both directions before computing required blocks; `totalNodeCount === 0` is treated as "unknown" (not "empty") so the initial fetch isn't clamped to nothing. DECIDED (Apr 2026): sort/filter blanking and missing-fetch bugs fixed by adding eager `loadRequiredBlocks()` to `onModelChange` and conditional `requestRender` vs `requestVirtualRefresh` in the post-resolve path. DECIDED (Apr 2026): core grid sort (`applySort`/`grid.sort()`) emits `sort-change` to BOTH the DOM and the plugin event bus via `_pluginManager.emitPluginEvent`. Without the plugin-bus emit, ServerSide (and any other plugin using `this.on('sort-change')`) silently misses sort events when MultiSortPlugin is not loaded — cache is never purged and the grid appears unresponsive to header-click sorts. MultiSort uses `broadcast()` which already covers both channels; core sort now matches. DECIDED (Apr 2026): `setDataSource()` calls `loadRequiredBlocks()` after the initial block resolves **only when `loadThreshold > 0`**. Gating preserves the historical "first fetch is just block 0" behavior — without the gate, any initial viewport spanning multiple blocks would silently start fetching block 1+ on attach, breaking ~12 unit tests. TENSION: a tall grid with small `cacheBlockSize` and no threshold still needs a scroll to fully populate the visible area — fixing that would require ungating, which is a behavior change worth its own task.

**Tree** — OWNS: expanded keys, flattened rows, row key map (Map<key,FlattenedTreeRow>), per-row metadata (WeakMap<row,FlattenedTreeRow>), per-row stable keys (WeakMap<row,string>), animation state, loading keys. HOOKS: processRows(10), processColumns, afterCellRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart. QUERIES: canMoveRow, datasource:viewport-mapping, sort:get-model. EVENTS: tree-expand. FIRES: datasource:fetch-children (on expand of lazy nodes). INVARIANT: lazy children signaled by truthy non-array childrenField value (e.g., `children: true`); child rows are single-batch (no pagination). INVARIANT (Apr 2026, row-identity): `processRows` returns the user's source row references — never spread/clones. Tree decoration (depth, key, hasChildren, isExpanded) lives in the `#rowMeta` WeakMap keyed by row identity; the renderer reads it via the public `getRowMeta(row)` accessor. Stable keys (used for expansion state and animation) live in the `#rowKeys` WeakMap. Path-based keys are assigned in _unsorted_ order before `#sortLevel` runs so they match `expandAll`'s key generation. Violating identity breaks `grid.updateRow(s)` and EditingPlugin commits — see DECIDED entry below.

DECIDED (Apr 2026, row-identity invariant): Plugins MUST NOT spread/clone row objects in `processRows`. The output array's elements MUST be either (a) === input row references, or (b) genuinely synthetic rows that have no source counterpart (group headers, pivot aggregates, ServerSide `__loading` placeholders, ServerSide-owned `managedNodes`). Decoration metadata (depth, key, expanded state, dirty state, etc.) MUST live in plugin-owned parallel structures — `WeakMap<row, meta>` by row identity, or wrapper objects like GroupingRows' `RenderRow { kind: 'data', row }`. Violation breaks `grid.updateRow(s)` and `EditingPlugin` cell commits: `RowManager.updateRow` mutates `_rows[i]` in place and schedules a VIRTUALIZATION-phase repaint, but the next ROWS-phase rebuild (filter, sort, etc.) calls `processRows` again — if the plugin returns fresh clones, the just-applied mutation lives only on a discarded clone and the source row appears unchanged. Symptoms: `cell-change.row` not `===` the user's source row; mutations vanishing after a filter; edit dirty state inexplicably reset. Audit checklist for any new `processRows`: every output element should be either an input element by reference or a fresh synthetic with no claim to be "the user's row". Test: assert `expect(grid._rows[i]).toBe(sourceRows[i])` after `processRows`. Reference fix: `libs/grid/src/lib/plugins/tree/TreePlugin.ts` `#rowKeys` / `#rowMeta` WeakMaps; tests in `libs/grid/src/__tests__/integration/tree-row-update.spec.ts`.

DECIDED (Apr 2026, sortHandler is the single source of truth for data-row sorts): Any plugin that sorts USER DATA ROWS (as opposed to synthetic group nodes, pivot keys, or numeric indices) MUST resolve the comparator chain through `gridConfig.sortHandler ?? builtInSort` instead of inlining its own comparator. This mirrors core's `applySort` / `reapplyCoreSort` resolution and is what makes user-supplied locale-aware / server-side / null-handling overrides actually take effect when row-model plugins are loaded. Async (`Promise`-returning) handlers can't be awaited inside synchronous `processRows` — fall back to `builtInSort` (or the in-memory order, as ServerSide does) so the synchronous path always returns SOMETHING sensible. `builtInSort` already honors per-column `sortComparator` and `valueAccessor`, so going through it gives both override layers for free. DEFENSIBLE EXCEPTIONS: GroupingRows sorts group nodes by aggregated value (not data rows); Pivot sorts pivot row-keys; clipboard / context-menu / excel-styles sort indices or string keys — none of these consume `sortHandler`. PERFORMANCE: the resolution is `effectiveConfig?.sortHandler ?? builtInSort` (a property read + null-coalesce + reference-equality fast path inside `builtInSort`) — measurable cost is in the comparator itself, not the dispatch. Reference fixes: `libs/grid/src/lib/plugins/tree/TreePlugin.ts#sortLevel` (Apr 2026), `libs/grid/src/lib/plugins/server-side/ServerSidePlugin.ts` `_localSort` (Apr 2026). PENDING: MultiSort's `sortRowsInPlace` still ignores `sortHandler` — by-design for multi-column sorts (handler signature is single-field), but worth a follow-up DECIDED entry once we agree on whether single-entry sort models should round-trip through the handler.

DECIDED (Apr 2026, defensive copy + Promise rejection on sortHandler dispatch): When a plugin invokes the resolved `sortHandler` chain inside `processRows`, two safety rules apply: (1) ALWAYS pass a shallow copy `[...rows]` to the handler when the input array could be user-owned (notably `row.children` arrays in TreePlugin's per-level sort) — `builtInSort` copies internally, but a user-supplied `sortHandler` may not, and an in-place sort would silently corrupt the user's source data. ServerSidePlugin is exempt because `managedNodes` is plugin-owned. (2) When the handler returns a Promise, attach `void result.catch(() => undefined)` BEFORE returning the synchronous fallback — otherwise a rejecting handler surfaces as an unhandled promise rejection in the browser/test runner. We deliberately do NOT splice the resolved Promise result back into `managedNodes` and call `requestRender` later: that would race with the next `processRows` cycle and silently re-order rows the user has already interacted with. The honest contract is "sync path returns a sensible synchronous order; async sortHandler is bypassed in row-model plugins." Reference: `libs/grid/src/lib/plugins/tree/TreePlugin.ts#sortLevel` and `libs/grid/src/lib/plugins/server-side/ServerSidePlugin.ts` `_localSort`.

DECIDED (Apr 2026, public sort customization guidance): `column.sortComparator` is the RECOMMENDED public override point for per-column sort logic. `gridConfig.sortHandler` is documented as a low-level escape hatch only — it's bypassed by MultiSortPlugin (which owns its own multi-column comparator chain via `sortRowsInPlace`) and only sees a single field at a time. For server-side sort, users should use `ServerSidePlugin`'s `dataSource.getRows({ sortModel })`, not `sortHandler`. Rationale: `sortComparator` survives every sort code path (core, multi-sort, tree, server-side `sortMode: 'local'`) and composes naturally across columns, while `sortHandler` requires the user to implement field/direction dispatch and null handling for every sortable column themselves. We're NOT teaching MultiSort to consult `sortHandler` — the API mismatch (single-field handler vs multi-column model) would either require a breaking signature change or surprising "works for one column, drops when you shift-click a second" semantics. Documentation steer applied in: `libs/grid/src/lib/core/types.ts` JSDoc (both `GridConfig.sortHandler` and `SortHandler` carry `:::caution` blocks), `apps/docs/src/content/docs/grid/plugins/multi-sort/index.mdx` ("Custom Sort Logic" section leads with `sortComparator`), `apps/docs/src/content/docs/grid/react/getting-started.mdx` (server-side example switched from `sortHandler` to `ServerSidePlugin`).

DECIDED (Apr 2026, ServerSidePlugin AbortSignal cancellation + Subscribable getRows): Every `getRows()` call receives a non-aborted `AbortSignal` on `params.signal` AND `getRows` may return `Promise<GetRowsResult> | Subscribable<GetRowsResult>` (a minimal `{ subscribe(observer): { unsubscribe() } }` duck-type — no RxJS dependency). A per-block `AbortController` is stored in `blockControllers: Map<number, AbortController>` and aborted whenever the request is superseded — `setDataSource()`, `refresh()`, `purgeCache()`, `onModelChange()` (sort/filter), and `detach()`. The `signal` field is REQUIRED (not optional) on `GetRowsParams` so users get a single, easy-to-document contract: `fetch(url, { signal })` works out of the box. The plugin's `loadBlock` calls `toResultPromise(getRows(...), signal)` which detects Subscribable vs Promise: for Subscribables it subscribes once, settles on `next`, and unsubscribes on `error`/`complete`/abort — that `unsubscribe()` is what cancels Angular `HttpClient`'s XHR (no `firstValueFrom`/`takeUntil` plumbing needed in adapter code). For Promise sources, the plugin defensively rejects with `DOMException('Aborted', 'AbortError')` on abort regardless of whether the underlying fetch honored `params.signal`. Catch handlers also short-circuit on `controller.signal.aborted` so a user-thrown AbortError doesn't surface as a `datasource:error` event. Result-shape guard: stored result is dropped if `signal.aborted` becomes true before `loadedBlocks.set` runs (covers the Promise path where the data source ignored the signal). REJECTED: a separate `fromObservable` helper in `@toolbox-web/grid-angular/features/server-side` — duct-tape that the user has to remember; better to make the contract polymorphic. The Subscribable bridge lives in core (~30 LoC) so React/Vue users with non-RxJS observable libs (Solid signals' `from`, etc.) also benefit. KNOWN BEHAVIOR CHANGE: `setDataSource()` now adds block 0 to `loadingBlocks` (previously it didn't), so a parallel scroll-triggered `loadRequiredBlocks()` won't double-fetch block 0 between `setDataSource` and its first resolution. Reference: `libs/grid/src/lib/plugins/server-side/datasource.ts` (`Subscribable`, `toResultPromise`, `loadBlock`), `libs/grid/src/lib/plugins/server-side/ServerSidePlugin.ts` (`abortAllBlocks`, `blockControllers`); tests in `libs/grid/src/lib/plugins/server-side/server-side.spec.ts` "AbortSignal cancellation" + "Subscribable getRows" describes.

**GroupingRows** — OWNS: grouped row model, expanded group keys, animation state. HOOKS: processRows(10), onHeaderClick(-1), renderRow. QUERIES: canMoveRow, grouping:get-grouped-fields, datasource:viewport-mapping. EVENTS: group-toggle/expand/collapse

**Pivot** — OWNS: pivot result, flattened pivot rows, expanded keys, column totals, sort state. HOOKS: onHeaderClick(-10), processRows(100). QUERIES: sort:get-sort-config. EVENTS: pivot-toggle, pivot-config-change. INVARIANT: `PivotRow.isGroup` means "has sub-groups" (`remainingFields.length > 0`), NOT "is a group row" — single `rowGroupFields` produces `isGroup: false`; `getAllGroupKeys()` returns nothing for single-level pivots

### Column-Transforming

**PinnedColumns** — OWNS: pinned state per column. HOOKS: processColumns(-10), afterCellRender. TENSION: runs first to reorder before ColumnVirtualization

- INVARIANT: Sticky cells (`.sticky-left`/`.sticky-right`) carry `background: var(--tbw-color-panel-bg)` in `core/styles/rows.css` AND `position: sticky; z-index: 25` in `core/styles/base.css`. Two consequences for any plugin painting row-level visuals across pinned columns:
  1. **Background tints** on `.data-grid-row` (selection `.row-focus`, `:hover`, `:nth-child(even)` row-alt, etc.) are HIDDEN under sticky cells because the cells' `panel-bg` is opaque. Re-paint sticky cells with the same tint layered over panel-bg: `background: linear-gradient(<tint>, <tint>), var(--tbw-color-panel-bg)`.
  2. **Pseudo-element border overlays** on the row (e.g. `.row-focus::after`) are covered when their `z-index` ≤ 25. Don't try to redraw the border on individual sticky cells (a cell-level `::after { inset: 0 + border-style }` is clipped by the cell's `overflow: hidden` and ends up 1px above the row-level border — the cell's own `border-bottom` row divider sits between the padding edge and the cell's outer bottom). Instead, just bump the row-level `::after` to `z-index: 26` (or any value > 25). The `::after` has `pointer-events: none` and `inset: 0` paints across the row's full width, so a single overlay covers both unpinned and pinned cells with perfect alignment. See `selection.css` `.data-grid-row.row-focus` for the canonical example (z-index: 26 on the border `::after` + gradient background on sticky cells for the tint).

**ColumnVirtualization** — OWNS: visible column subset based on scroll. HOOKS: processColumns

**Visibility** — OWNS: hidden column set. HOOKS: processColumns

**GroupingColumns** — OWNS: column groups structure. HOOKS: processColumns

### Selection & Navigation

**Selection** — OWNS: selected rows/cells, ranges, mode. HOOKS: onCellClick, onRowClick, onKeyDown, afterCellRender, processColumns (checkbox column). EVENTS: selection-change. MODES: cell, row, range

### Editing & Undo

**Editing** — OWNS: active cell, editor snapshots, changed rows, dirty tracking. HOOKS: processColumns, processRows, afterCellRender, afterRowRender, onCellClick, onKeyDown. EVENTS: cell-commit, row-commit, edit-open/close. TENSION: must handle row re-sorting during edit (caches sort result)

- DECIDED (Apr 2026): The row-mode `ArrowUp` / `ArrowDown` handler in `EditingPlugin.onKeyDown` MUST NOT commit + jump to an adjacent row while a row is in edit mode. Returns `true` (handled, no-op) so the focused editor consumes the key natively — number spinners, `<select>` option traversal, `<textarea>` caret movement, and framework-adapter editors (Material/MUI autocomplete, datepicker, combobox, number-stepper) all rely on ArrowUp/Down. Users must explicitly leave edit mode (Enter / Escape / Tab / click) before arrow keys resume cell navigation. Initial fix (Apr 2026) was scoped only to `<input type="number">` to preserve commit+navigate for text editors; broadened the same week after UX review concluded "any editor in edit mode owns its arrow keys" is the consistent rule (matches `mode: 'grid'` behavior when an input is focused, matches the `editing && colType === 'select'` ArrowUp/Down early return in `handleGridKeyDown` in `core/internal/keyboard.ts`, and matches Excel/Sheets where Esc must be pressed to leave a cell before arrows navigate). The core keyboard handler's commit-and-navigate fallback in `core/internal/keyboard.ts` (ArrowUp/Down switch case) remains as dead-code defense for hosts that set `_activeEditRows` without loading EditingPlugin (no such host today). Tests: `editing-integration.spec.ts > arrow keys while a row is in edit mode (row mode)` covers number, text, and ArrowUp paths.
- DECIDED (issue #250 — portal-overlay editors): The `keydown` handler attached to the editor host in `editor-injection.ts` MUST short-circuit on `e.defaultPrevented` BEFORE inspecting `e.key`. WHY: portal-rendered pickers (EDS / Downshift autocomplete, MUI date picker, custom comboboxes) call `e.preventDefault()` on the option-confirming Enter so the host page doesn't submit a form; that event still bubbles up through the editor's input → `editorHost`. Without the guard, the plugin treats the Enter as "exit row edit", commits the partial value, and tears the editor down a frame before the picker's own commit lands — surfacing as the row-recycle `removeChild` family from #250 and as "edit closed unexpectedly" UX. Tests: `editor-injection.spec.ts > should NOT exit on Enter when defaultPrevented`. NOTE: this only covers the keyboard-confirm path; the click-to-select path on portal overlays still requires `registerExternalFocusContainer` (tracked in #251).
- DECIDED (issue #251 — overlay-editor parity): Two complementary mechanisms now make portal-rendered editors behave correctly without per-library glue. (1) Generic `aria-expanded="true" + aria-controls=<id>` fallback: in BOTH `editor-injection.ts` (editor-host keydown) AND `EditingPlugin.onKeyDown` (Enter while row-editing) AND `EditingPlugin` document-pointerdown (outside-click), the helper `isInsideOpenAriaOverlay(target, scopeEl)` walks `[aria-expanded="true"][aria-controls]` triggers in the active edit row, resolves their `aria-controls` panel by `getElementById`, and treats the target as inside the editor when the panel contains it. Cheap (zero or one combobox per row in practice). (2) Explicit React opt-in: `ColumnEditorContext.grid` is now populated in `editor-injection.ts` from `deps.grid`, mirroring `CellRenderContext.grid`. Editors call `ctx.grid.registerExternalFocusContainer(panel)` directly OR use the `useGridOverlay(panelRef, { open })` hook from `@toolbox-web/grid-react` which wraps the lifecycle. Helper resolves the grid via `panelRef.current.closest('tbw-grid')` first, then `GridElementContext` from `<DataGrid>` (needed for portaled panels detached from the grid subtree). Tests: `editing-overlay-aria.spec.ts` (3 ARIA + 1 ctx.grid), `use-grid-overlay.spec.tsx` (5 hook lifecycle). Bundle impact: grid-react `index.js` 10.24 → 10.35 kB gzipped.

**UndoRedo** — OWNS: undo/redo stacks. HOOKS: onKeyDown (Ctrl+Z/Y). DEPENDS: editing (required)

### Sorting & Filtering

**MultiSort** — OWNS: sortModel[], cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: sort:get-model, sort:set-model. EVENTS: sort-change. TENSION: caches sort during row edit to prevent edited row from jumping. INVARIANT: MultiSort is the authoritative sort source — Tree and GroupingRows must query `sort:get-model` when MultiSort is loaded, not maintain independent sort state (causes desync of sort indicators vs actual order)

**Filtering** — OWNS: filterModels Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: filter-change. INVARIANT: numeric comparison operators (`greaterThan`, `>=`, `<`, `<=`, `between`) must exclude blank values (null / undefined / '' / NaN) before coercion — JS implicit conversion leaks them through (`null >= 0` is `true`, `Number('') === 0`). Blank rows are matched _only_ by the explicit `blank` operator. NaN is treated as blank (strictly an error but conceptually "no value"). DECIDED (Apr 2026): number filter panel's Apply button clears the filter when both bounds are still at the data-derived defaults — otherwise applying `between(dataMin, dataMax)` would silently exclude blank rows the user never intended to filter out. DECIDED (Apr 2026): `getDataRows()` helper resolves data source for unique-value collection — prefers `sourceRows`, falls back to `grid.rows.filter(r => r.__loading !== true)` so ServerSide hosts get unique values from loaded blocks (excluding placeholders) without requiring `valuesHandler`. The async `valuesHandler` config remains the way to source unique values from the full server-side dataset.

### Row Details

**MasterDetail** — OWNS: expanded rows, detail height, animation state. HOOKS: processColumns (expander), onCellClick, afterRowRender, getRowHeight, adjustVirtualStart. EVENTS: master-detail-toggle

### Reordering

**ReorderColumns** — OWNS: column order, drag state, `BaseColumnConfig.lockPosition` augmentation. HOOKS: onCellMouseDown/Move/Up, afterRender. QUERIES: handles `canMoveColumn` (returns local `column-drag.ts#canMoveColumn` check); calls `grid.query('canMoveColumn', column)` itself to aggregate vetoes from PinnedColumnsPlugin etc.

- DECIDED: Per-column drag lock is exposed as top-level `ColumnConfig.lockPosition` (sibling to `lockVisible`). The `lockPosition` augmentation lives in `reorder-columns/types.ts` (NOT core `types.ts`) — same pattern as `pinned-columns/types.ts` augmenting `pinned`/`lockPinning`. Legacy `meta.lockPosition` / `meta.suppressMovable` are still honored for back-compat inside `column-drag.ts#canMoveColumn` (top-level checked first). Core does NOT carry `lockPosition` on its `getAllColumns()` projection — see invariant below.
- DECIDED: ReorderPlugin owns the authoritative `canMoveColumn` query. Other plugins (e.g. VisibilityPlugin's panel-drag check) MUST NOT re-implement lock logic or read `column.lockPosition` directly — they query `grid.query<boolean>('canMoveColumn', column)` and treat any `false` response as a veto. When ReorderPlugin is absent, the query returns `[]` and consumers should treat that as "not reorderable" (panel drag stays disabled). ReorderPlugin's own internal check (`canMoveColumnWithPlugins`) keeps the local `canMoveColumn(column)` call eagerly so test mocks that stub `query: () => []` still work — the query is for cross-plugin aggregation, not self-lookup.
- INVARIANT: Plugin-owned column flags (`lockPosition`, `lockPinning`, `pinned`, `checkboxColumn`, etc.) MUST NOT appear on core projections like `grid.getAllColumns()`. The projection only carries grid-universal fields (`field`, `header`, `visible`, `lockVisible`, `utility`). When a plugin needs the raw config to forward to a query, it looks it up: `this.grid.columns.find(c => c.field === entry.field)`. This keeps `index.js` core bytes proportional to grid-universal concerns only — bundle budget is tight (`index.js` ≤50 kB gzip hard fail, 45 kB gzip warn; build fails on overage).
- INVARIANT: Adding a new query type costs ZERO core bytes. The query system in `plugin-manager.ts#queryPlugins` is string-routed (`query<T>(type: string, ctx?: unknown): T[]`) and dispatches via `manifest.queries`. If you find core growing when adding a new query, the leak is somewhere else (usually a JSDoc on a public type, or a field added to a core projection — see invariant above).
- DECIDED: All column-level flags MUST be top-level properties on `ColumnConfig` via module augmentation **from the owning plugin's `types.ts`**, never `meta.<flag>` and never directly in core `types.ts`. `meta` is for application-defined arbitrary data only. Documented top-level flags and their owning plugins: `lockVisible` (visibility — currently in core, candidate to move), `lockPosition` (reorder-columns), `lockPinning`/`pinned` (pinned-columns), `utility` (**public**, core — see "utility column" entry below), `checkboxColumn` (`@internal`, selection), `group` (grouping-columns). Legacy `meta.lockPosition` / `meta.suppressMovable` / `meta.lockVisibility` / `meta.lockPinning` / `meta.pinned` are deprecated and only kept as runtime fallbacks in plugin code (NOT in core). `meta.utility` and `meta.checkboxColumn` were never user-facing — no fallback. When adding a new column flag, augment `BaseColumnConfig` from the owning plugin's `types.ts` (see `pinned-columns/types.ts`, `reorder-columns/types.ts`, `selection/types.ts` for the pattern).

- DECIDED (Apr 2026): `ColumnConfig.utility` is **public API** (was `@internal`). It is the umbrella "system column" flag for any column that exists to support grid behaviour rather than display user data — selection checkbox, expander, drag handle, row-action menu, status indicator, etc. Honored by VisibilityPlugin (filtered from chooser), ReorderPlugin (`canMoveColumn` returns `false` — locks reorder regardless of `lockPosition`), PrintPlugin (hidden during print unless `printHidden: false`), ClipboardPlugin / ExportPlugin (skipped via `resolveColumns()` in `shared/data-collection.ts`), SelectionPlugin (clicks ignored via `isUtilityColumn`), FilteringPlugin (no filter UI). Not honored by: cell rendering (utility columns still render normally — that's the point) or core sort (irrelevant — no sort UI). Convention: prefix field with `__` (e.g. `__actions`). When adding a new feature that filters columns, decide whether to honor `utility` and document the choice here.

**ReorderRows** — OWNS: row order, drag state. HOOKS: onCellMouseDown/Move/Up. QUERIES: canMoveRow

**RowDragDrop** (#225) — OWNS: row order + cross-grid drag/drop session. ALIASES: `reorderRows`, `rowReorder` (legacy). HOOKS: processColumns (drag-handle col), onKeyDown (Ctrl+arrow), onCellClick, delegated dragstart/over/leave/drop/dragend. QUERIES: canMoveRow. EVENTS: row-move (back-compat), row-drag-start (cancelable), row-drag-end, row-drop (cancelable), row-transfer (fired on BOTH source + target). USES: `core/internal/drag-drop-registry.ts` (WeakRef session map shared across split bundles) + `plugins/shared/drag-drop-protocol.ts` (MIME constants, payload codec, drop-position math, auto-scroller, current-session tracker for synchronous canDrop).

- DECIDED (#225): `reorder-rows/index.ts` MUST NOT re-export `ROW_DRAG_HANDLE_FIELD` or `RowMoveDetail` — both would collide in `all.ts` with the same exports from `row-drag-drop/index.ts`. Only `RowReorderPlugin` (alias) and `RowReorderConfig` (Pick subset) are re-exported. Same rule for any future deprecated alias plugin.
- DECIDED (#225): The `reorder-rows` UMD/ESM bundle inlines the full `RowDragDropPlugin` (~16 kB / 5.4 kB gzip) because Vite's `externalizeCore` only externalizes `../../components/` and `../../../` paths, not sibling plugin paths. Acceptable trade-off for the V2.x deprecation period — both bundles are well under the 50 kB plugin budget. Revisit if budget pressure emerges.
- DECIDED (#225): Plugin alias dedup is centralised in `PluginManager#collapseAliasDuplicates`. Constructor identity is the dedup key (NOT plugin name) — that lets the same class be registered under multiple feature keys without instance bloat. Configs merge via `BaseGridPlugin.mergeConfigsFrom`: silent on equal scalars/refs, warns TBW023 once on dedupe, throws TBW025 on conflicting non-equal values. The dedup warning is silenced under `import.meta.env.PROD`.
- DECIDED (#225): Same-window cross-grid drag uses `currentSession` (module-level singleton in `shared/drag-drop-protocol.ts`) for synchronous `canDrop` resolution during `dragover` (where `dataTransfer.getData()` returns `''`). Cross-window drops fall back to JSON via `dataTransfer.getData(TBW_ROW_DRAG_MIME)` + `deserializeRow`. WeakRef registry only matters for live-object recovery on the **drop** event (so target gets the actual row reference, not a clone).
- DECIDED (Apr 2026, cross-window `move` coordination via `BroadcastChannel`): The target-window `onDrop` handler can only mutate its own `document` — `document.getElementById(payload.sourceGridId)` returns `null` when the source grid lives in another window, so the legacy code silently no-op'd source-side row removal AND the source-side `row-transfer` emit AND the `dragAccepted` flip on `move` operations. Symptom: dragging from window A's grid into window B's grid (same `dropZone`) succeeded on the target side but window A still showed the original rows, and `row-drag-end` reported `accepted: false`. Fix: a module-level `BroadcastChannel('tbw-row-drag-drop')` shared by all `RowDragDropPlugin` instances in the window. After a successful cross-grid drop where `findPeerOnGrid(payload.sourceGridId) === null`, the target broadcasts a `tbw-row-drag-drop:transfer` message containing `{ sourceGridId, toGridId, dropZone, rowIndices, toIndex, operation, serializedRows }`. Each window's plugin instances filter by `msg.sourceGridId === this.gridId` (and `msg.dropZone === this.config.dropZone` as a defensive zone check) and run the source-side path: remove rows on `move`, emit `row-transfer` (with rows recovered via `deserializeRow`), flip `dragAccepted`. The shared channel is created lazily on first `attach`, ref-counted, and closed when the last plugin detaches. INVARIANT: `BroadcastChannel` is origin-scoped — cross-origin windows cannot coordinate. ENVIRONMENT: when `BroadcastChannel` is undefined (very old browsers, sandboxed iframes), the target receives rows but the source is left untouched — `row-transfer` is the authoritative success signal; `row-drag-end.accepted` may report `false` even on a successful remote drop because the broadcast can race the source's `dragend`. TESTS: `row-drag-drop.spec.ts` "cross-window transfer (BroadcastChannel)" describe block stubs `BroadcastChannel` globally with a `FakeChannel` and verifies (1) source removes rows + emits `row-transfer` + flips `dragAccepted` on a remote `move` broadcast, (2) `sourceGridId` mismatch is ignored, (3) `dropZone` mismatch is ignored, (4) `copy` operation does not remove source rows, (5) detach closes the channel when the last instance leaves, (6) `deserializeRow` is honored on the source side. Same-window peer path is preserved via `findPeerOnGrid` (synchronous direct call) — broadcast is only sent when same-window resolution fails. DEMO: `apps/docs/src/components/demos/row-drag-drop/RowDragDropCrossWindowDemo.astro` opens `apps/docs/src/pages/grid/row-drag-drop-popout.astro` (a standalone Astro page outside Starlight chrome) via `window.open`; both grids share `dropZone: 'cross-window-employees'`.
- DECIDED (Apr 2026, `dragFrom` config + row-clone drag image): Added `dragFrom?: 'handle' | 'row' | 'both'` (default `'handle'`). When `'row'` the handle column is hidden by default (`shouldRenderDragHandle()` returns `false` unless `showDragHandle` is set explicitly). `applyRowDraggable()` is called from BOTH `afterRender` AND `onScrollRender` because virtualization recycles `.data-grid-row` nodes — setting `draggable="true"` once at attach is not enough; new visible rows would lose the attribute. INVARIANT: interactive descendants (`button`, `input`, `select`, `textarea`, `a[href]`, `[contenteditable]`) inside a row never start a drag — guarded by `INTERACTIVE_DRAG_SELECTORS` static list checked in `isInteractiveDragOrigin()`; without this guard, clicking a button in a row-as-handle row would initiate a drag instead of firing the click. CSS-SCOPING INVARIANT: the row-clone used for `setDragImage` MUST be appended INSIDE `this.gridElement`, NOT `document.body`. All core row/cell rules in `core/styles/*.css` are scoped under `tbw-grid { … }` (host selector) AND `--tbw-column-template` is defined on the host — appending the clone to `document.body` causes every selector to miss and the clone collapses to an empty box (also the case for inline-copying just the CSS variables, since the rules themselves are host-scoped). The clone is positioned off-screen via `.tbw-row-drag-clone { position: fixed; top/left: -10000px }` and removed in a `setTimeout(0)` after `setDragImage`. NON-NEGOTIABLE: the browser applies its own ~70% translucency to the rasterized drag image — there is no way to disable this from the page; do NOT layer extra `opacity` or `box-shadow` on the clone (the box-shadow blur is captured into the snapshot and reads as a horizontal "fade" against dark backgrounds; explicit opacity multiplies with the browser's effect and looks washed out). TESTS: `row-drag-drop.spec.ts` "dragFrom config", "row-as-handle DOM wiring", "row-as-handle dragstart behaviour", "drag image" describes.

### Display

**Responsive** — OWNS: breakpoint-based column visibility. HOOKS: processColumns, getRowHeight

**Tooltip** — OWNS: active tooltip, positioning. HOOKS: afterCellRender

**ContextMenu** — OWNS: menu items, open state. HOOKS: afterRender, onKeyDown. QUERIES: getContextMenuItems (queries all plugins for contributions)

### Export

**Clipboard** — OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl+C/V/X). DEPENDS: selection (optional)

**Export** — OWNS: export format/state. Exposes download methods (`exportCsv`/`exportExcel`/`exportJson`) AND data accessors (`export()`/`formatCsv()`/`formatExcel()`/`getResolvedColumns()`) for hand-off to real .xlsx writers (ExcelJS), clipboard, server upload, etc. Supports `mode: 'raw' | 'formatted'` (default `'raw'` — pre-existing behavior; `'formatted'` applies column-type defaults + `column.format`, returning what the user sees). DECIDED (#240): plugins MUST NOT import from `core/internal/rows.ts` at module scope — it has module-level `document.createElement('template')` which crashes Vitest happy-dom-less environments and pollutes plugin bundles. Inline small bits of logic (e.g. `resolveFormat`) instead. DECIDED (#240): when pre-resolving rows for downstream `buildCsv`/`buildExcelXml` (which re-call `resolveCellValue`), strip `column.valueAccessor` from the columns passed downstream — otherwise accessors mis-resolve against the synthetic `Record<string, unknown>` keyed by `field` and produce `undefined`/`NaN`.

**Print** — OWNS: print styling. Exposes print methods

### Pinned Rows

**PinnedRows** — OWNS: pinned row positions (top/bottom), info bar (row counts / custom panels), aggregation rows. HOOKS: afterRender. READS FROM: `grid.sourceRows` (for `totalRows`), `grid.rows` (for `filteredRows`), filter plugin's `cachedResult` (preferred when present), selection plugin's `selected` set. INVARIANT: `filteredRows` must reflect the actual post-filter count regardless of _which_ mechanism did the filtering — filter plugin, column filters, external/server-side, or direct `grid.rows =` assignment. DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not from the passed `rows` argument, so externally-filtered hosts get correct counts without needing the filter plugin.
