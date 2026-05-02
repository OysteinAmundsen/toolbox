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
- DECIDED (Apr 2026): plugin-side render-trigger pattern for state restoration. When a plugin owns state (e.g. sort model) that core's `#applyColumnState` width-only fast-path can't observe (plugin nulled `_sortState`), the plugin — not core — forces re-render after restore. MultiSortPlugin: snapshots model at start of `applyColumnState` batch; in deferred microtask compares prev vs current; if changed, broadcasts `sort-change` AND calls `this.requestRender()` (ROWS phase). Covers sort-add (incoming `state.columns[i].sort` triggers core's fast-path bypass via `incomingHasSort` check) AND sort-removal (no incoming sort entries; fast-path WOULD run but plugin's requestRender forces processRows). WHY: core stays minimal — a `hasOwnedSort` query in core costs ~30 bytes (over budget); plugin chunks absorb logic for free. Pattern generalizes: any plugin that mutates owned state during `applyColumnState` must self-trigger render if change isn't visible in incoming `GridColumnState`.

## inter-plugin-communication

- EVENT BUS (broadcast, async): `this.emitPluginEvent(type, detail)` or `this.broadcast(type, detail)` (also reaches DOM)
- QUERY SYSTEM (sync, manifest-routed): `this.grid.query(query)` → only plugins declaring query type in manifest are invoked
- DIRECT ACCESS: `this.grid.getPluginByName('multiSort')` or `this.getPlugin(MultiSortPlugin)`
- INVARIANT: events are one-way notifications; queries are synchronous state retrieval
- PATTERN: use events for state broadcasts (sort-change, filter-change); use queries for state reads within a lifecycle phase

## event-registry (DataGridEventMap)

- OWNS: `DataGridEventMap<TRow>` in `libs/grid/src/lib/core/types.ts` is the single source of truth for all DOM-visible grid events. Core events live there directly; plugin events are added via `declare module '../../core/types' { interface DataGridEventMap { 'foo-bar': FooBarDetail; } }` in the plugin's own `types.ts`. The `keyof DataGridEventMap<TRow>` union is the canonical event-name list — no separate constant needed.
- INVARIANT: emit-site and registry must agree. A plugin can call `this._emit('foo-bar', detail)` without ever registering `'foo-bar'` in the map — the emit succeeds at runtime but adapter satisfies-guards reject it as a "non-existent" event. Always pair an `_emit` call with the matching module augmentation in the same plugin's `types.ts`.
- INVARIANT: NEVER add a synthetic event name to `DataGridEventMap` just to satisfy a stale adapter prop or to silence a satisfies-guard error. The map is the consumer-facing contract; lying in it would mislead `addEventListener` typing across all three adapters.
- DECIDED (May 2026): `DGEvents` / `PluginEvents` constants in `libs/grid/src/public.ts` are `@deprecated`. They were hand-maintained string-literal mirrors of `DataGridEventMap` and drifted (7 stale entries in `PluginEvents` referenced events that were never emitted; `CLIPBOARD_COPY` should have been `COPY`, etc.). Kept as deprecated stubs for now to avoid a major-version breaking change; will be removed in a future major. Consumers should use `keyof DataGridEventMap` for unions and string literals for individual names — both autocomplete and fail compile on typos.
- DECIDED (May 2026): `'column-visibility'` was emitted from `config-manager.ts` (`setColumnVisible`/`toggleColumnVisibility`/`showAllColumns`) but visibility plugin's module augmentation only registered `'column-reorder-request'`. Adapter satisfies-guards rejected `onColumnVisibility`/`columnVisibility` props as "non-existent". Fix: registered `'column-visibility': ColumnVisibilityDetail` in `libs/grid/src/lib/plugins/visibility/types.ts`. LESSON: when registering plugin event, register EVERY event the plugin OR its core helpers emit — visibility-related state changes flow through `config-manager` (core), not `VisibilityPlugin` directly, but the event semantically belongs to the visibility domain.

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

**ServerSide** — OWNS: fetch cache, lazy-loaded blocks, placeholder nodes (`{ __loading: true, __index }`), infinite scroll state, `managedNodes` array, `blockControllers: Map<number, AbortController>`. HOOKS: processRows(-10) — IGNORES input rows, returns `managedNodes` directly (length-clamped to viewport). EVENTS: datasource:data/children/loading/error. QUERIES: datasource:fetch-children, datasource:is-active. LISTENS: sort-change, filter-change (cache purge + refetch).

- INVARIANT: `totalNodeCount=-1` activates infinite scroll; lastNode finalizes total; short blocks auto-detect end. `totalNodeCount === 0` treated as "unknown" (not "empty") so initial fetch isn't clamped to nothing.
- INVARIANT: `grid.sourceRows` stays empty — plugin owns data via processRows return value, never via `#rows`.
- INVARIANT: `onModelChange` MUST call `loadRequiredBlocks()` after clearing caches (no other path triggers a fetch).
- INVARIANT: when a block resolves and `previousManagedLength === 0` OR `managedNodes.length < totalNodeCount`, MUST call `requestRender()` (ROWS phase) — `requestVirtualRefresh()` skips processRows so managedNodes never grows.
- INVARIANT: `loadRequiredBlocks()` expands viewport by `loadThreshold` rows in both directions before computing required blocks.
- DECIDED (Apr 2026): core grid sort (`applySort`/`grid.sort()`) emits `sort-change` to BOTH DOM and plugin event bus via `_pluginManager.emitPluginEvent`. Without plugin-bus emit, ServerSide (and any plugin using `this.on('sort-change')`) silently misses sort events when MultiSortPlugin is absent — cache never purged. MultiSort uses `broadcast()` which already covers both; core sort now matches.
- DECIDED (Apr 2026): `setDataSource()` calls `loadRequiredBlocks()` after initial block resolves ONLY when `loadThreshold > 0`. Preserves historical "first fetch is just block 0" behavior — without gate, viewport spanning multiple blocks would silently fetch block 1+ on attach (breaks ~12 unit tests).
- DECIDED (Apr 2026, AbortSignal + Subscribable): every `getRows()` call receives a non-aborted `AbortSignal` on `params.signal`. `getRows` may return `Promise<GetRowsResult>` OR `Subscribable<GetRowsResult>` (minimal `{ subscribe(observer): { unsubscribe() } }` duck-type — no RxJS dep). Per-block `AbortController` aborted whenever superseded — `setDataSource()`/`refresh()`/`purgeCache()`/`onModelChange()` (sort/filter)/`detach()`. `signal` is REQUIRED on `GetRowsParams` so users get one easy contract. `loadBlock` calls `toResultPromise(getRows(...), signal)`: for Subscribables subscribes once, settles on `next`, unsubscribes on `error`/`complete`/abort — the `unsubscribe()` cancels Angular HttpClient's XHR (no `firstValueFrom`/`takeUntil` plumbing). For Promise sources, plugin defensively rejects with `DOMException('Aborted', 'AbortError')` regardless of whether underlying fetch honored signal. Catch handlers short-circuit on `controller.signal.aborted`. Result-shape guard drops stored result if `signal.aborted` becomes true before `loadedBlocks.set`. REJECTED: separate `fromObservable` helper in adapter — duct-tape; polymorphic core contract (~30 LoC) is better. KNOWN BEHAVIOR CHANGE: `setDataSource()` now adds block 0 to `loadingBlocks` so parallel scroll-triggered `loadRequiredBlocks()` won't double-fetch. Files: `server-side/datasource.ts`, `ServerSidePlugin.ts` (`abortAllBlocks`). Tests: `server-side.spec.ts` "AbortSignal cancellation" + "Subscribable getRows" describes.
- TENSION: tall grid with small `cacheBlockSize` and no threshold still needs scroll to fully populate visible area — ungating would be a behavior change.

**Tree** — OWNS: expanded keys, flattened rows, row key map (`Map<key,FlattenedTreeRow>`), per-row metadata (`WeakMap<row,FlattenedTreeRow>`), per-row stable keys (`WeakMap<row,string>`), animation state, loading keys. HOOKS: processRows(10), processColumns, afterCellRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart. QUERIES: canMoveRow, datasource:viewport-mapping, sort:get-model. EVENTS: tree-expand. FIRES: datasource:fetch-children (on expand of lazy nodes).

- INVARIANT: lazy children signaled by truthy non-array childrenField value (e.g. `children: true`); child rows are single-batch (no pagination).
- INVARIANT (row-identity): `processRows` returns user's source row references — never spread/clones. Decoration (depth, key, hasChildren, isExpanded) lives in `#rowMeta` WeakMap keyed by row identity; renderer reads via `getRowMeta(row)`. Stable keys live in `#rowKeys` WeakMap. Path-based keys assigned in _unsorted_ order before `#sortLevel` so they match `expandAll`'s key generation.

DECIDED (Apr 2026, row-identity invariant — applies to ALL row-model plugins): plugins MUST NOT spread/clone row objects in `processRows`. Output elements MUST be either (a) `===` input row references, or (b) genuinely synthetic rows with no source counterpart (group headers, pivot aggregates, ServerSide `__loading` placeholders, ServerSide-owned `managedNodes`). Decoration metadata MUST live in parallel structures — `WeakMap<row, meta>` or wrapper objects like GroupingRows' `RenderRow { kind: 'data', row }`. Violation breaks `grid.updateRow(s)` and EditingPlugin commits: `RowManager.updateRow` mutates `_rows[i]` in place and schedules a VIRTUALIZATION repaint, but next ROWS-phase rebuild (filter/sort) calls `processRows` again — if plugin returns fresh clones, mutation lives on a discarded clone. Symptoms: `cell-change.row` not `===` source row; mutations vanishing after filter; edit dirty state reset. Audit: assert `expect(grid._rows[i]).toBe(sourceRows[i])` after `processRows`. Reference: `TreePlugin.ts` `#rowKeys`/`#rowMeta`; tests `tree-row-update.spec.ts`.

DECIDED (Apr 2026, sortHandler dispatch — applies to all data-row sorts): plugins sorting USER DATA ROWS (vs synthetic group/pivot nodes) MUST resolve through `gridConfig.sortHandler ?? builtInSort` — mirrors core's `applySort`. Lets user locale-aware/null-handling overrides take effect when row-model plugins loaded. Async handlers can't be awaited in sync `processRows` → fall back to `builtInSort` (or in-memory order). `builtInSort` honors per-column `sortComparator` and `valueAccessor` for free. EXCEPTIONS: GroupingRows (group nodes by aggregated value), Pivot (row-keys), clipboard/context-menu/excel-styles (indices/string keys). Two safety rules: (1) pass shallow copy `[...rows]` when input could be user-owned (notably `row.children` in TreePlugin's per-level sort) — `builtInSort` copies internally but user `sortHandler` may not. ServerSidePlugin exempt (`managedNodes` is plugin-owned). (2) When handler returns Promise, `void result.catch(() => undefined)` BEFORE returning sync fallback — else rejecting handler surfaces as unhandled rejection. Do NOT splice resolved Promise back into `managedNodes` async — would race next `processRows` cycle. References: `TreePlugin.ts#sortLevel`, `ServerSidePlugin.ts._localSort`. PENDING: MultiSort's `sortRowsInPlace` ignores `sortHandler` (by design — handler is single-field, model is multi-column).

DECIDED (Apr 2026, public sort customization): `column.sortComparator` is the RECOMMENDED override. `gridConfig.sortHandler` is a low-level escape hatch only — bypassed by MultiSortPlugin, sees one field at a time. For server-side sort use `ServerSidePlugin`'s `dataSource.getRows({ sortModel })`. WHY: `sortComparator` survives every sort path (core, multi-sort, tree, server-side `sortMode: 'local'`) and composes across columns; `sortHandler` requires user to implement field/direction dispatch + null handling per column. NOT teaching MultiSort to consult `sortHandler` (single-field handler vs multi-column model = breaking signature or surprising semantics). Doc steer applied: `core/types.ts` JSDoc (`:::caution` on both), `apps/docs/.../multi-sort/index.mdx`, `apps/docs/.../react/getting-started.mdx`.

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

- DECIDED (Apr 2026): row-mode `ArrowUp`/`ArrowDown` in `EditingPlugin.onKeyDown` MUST NOT commit + jump to adjacent row while a row is in edit mode. Returns `true` (handled, no-op) so focused editor consumes the key natively — number spinners, `<select>` traversal, `<textarea>` caret, MUI/Material autocomplete/datepicker/combobox/number-stepper all rely on ArrowUp/Down. Users must explicitly leave edit (Enter/Esc/Tab/click) before arrows resume cell nav. CONSISTENT WITH: `mode: 'grid'` when input focused, `editing && colType === 'select'` early return in `core/internal/keyboard.ts`, Excel/Sheets. Core keyboard handler's commit-and-navigate fallback (`core/internal/keyboard.ts` ArrowUp/Down) remains as dead-code defense for hosts that set `_activeEditRows` without loading EditingPlugin (no such host today). Tests: `editing-integration.spec.ts > arrow keys while a row is in edit mode (row mode)`.
- DECIDED (#250 — portal-overlay editors): `keydown` handler attached to editor host in `editor-injection.ts` MUST short-circuit on `e.defaultPrevented` BEFORE inspecting `e.key`. WHY: portal pickers (EDS/Downshift autocomplete, MUI date picker) call `e.preventDefault()` on option-confirming Enter; without guard, plugin treats Enter as "exit row edit" and tears editor down a frame before picker's commit lands — surfaces as #250 row-recycle `removeChild` family. Tests: `editor-injection.spec.ts > should NOT exit on Enter when defaultPrevented`. NOTE: only covers keyboard-confirm; click-to-select on portal overlays needs `registerExternalFocusContainer` (#251).
- DECIDED (#251 — overlay-editor parity): two complementary mechanisms make portal editors work without per-library glue. (1) Generic `aria-expanded="true" + aria-controls=<id>` fallback: `editor-injection.ts` (host keydown) AND `EditingPlugin.onKeyDown` (Enter while row-editing) AND `EditingPlugin` document-pointerdown (outside-click) call `isInsideOpenAriaOverlay(target, scopeEl)` — walks `[aria-expanded="true"][aria-controls]` triggers in active row, resolves panel via `getElementById`, treats target as inside editor when panel contains it. (2) Explicit React opt-in: `ColumnEditorContext.grid` populated in `editor-injection.ts` from `deps.grid` (mirrors `CellRenderContext.grid`). Editors call `ctx.grid.registerExternalFocusContainer(panel)` directly OR use `useGridOverlay(panelRef, { open })` hook. Helper resolves grid via `panelRef.current.closest('tbw-grid')` then `GridElementContext` (needed for portaled panels). Tests: `editing-overlay-aria.spec.ts`, `use-grid-overlay.spec.tsx`. Bundle: grid-react `index.js` 10.24 → 10.35 kB gz.

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
- DECIDED (Apr 2026, cross-window via `BroadcastChannel`): target-window `onDrop` can only mutate its own `document`; `document.getElementById(payload.sourceGridId)` returns null cross-window, so legacy code silently no-op'd source-side row removal + `row-transfer` emit + `dragAccepted` flip. Fix: module-level `BroadcastChannel('tbw-row-drag-drop')` shared by all `RowDragDropPlugin` instances. After successful cross-grid drop where `findPeerOnGrid(payload.sourceGridId) === null`, target broadcasts `tbw-row-drag-drop:transfer` with `{ sourceGridId, toGridId, dropZone, rowIndices, toIndex, operation, serializedRows }`. Instances filter by `msg.sourceGridId === this.gridId` + `msg.dropZone === this.config.dropZone`, then run source-side path: remove rows on `move`, emit `row-transfer` (rows recovered via `deserializeRow`), flip `dragAccepted`. Channel created lazily on first attach, ref-counted, closed when last instance detaches. INVARIANT: `BroadcastChannel` is origin-scoped — cross-origin windows cannot coordinate. When undefined (old browsers, sandboxed iframes), target receives rows but source is untouched — `row-transfer` is authoritative success signal; `row-drag-end.accepted` may report `false` even on successful remote drop. Same-window peer path preserved via `findPeerOnGrid` (sync direct call) — broadcast only when same-window resolution fails. Tests: `row-drag-drop.spec.ts` "cross-window transfer (BroadcastChannel)". Demo: `apps/docs/.../RowDragDropCrossWindowDemo.astro` + popout page `apps/docs/src/pages/grid/row-drag-drop-popout.astro`.
- DECIDED (Apr 2026, `dragFrom` config + row-clone drag image): added `dragFrom?: 'handle' | 'row' | 'both'` (default `'handle'`). `'row'` hides handle column by default unless `showDragHandle` explicitly set. `applyRowDraggable()` called from BOTH `afterRender` AND `onScrollRender` — virtualization recycles `.data-grid-row`, so setting `draggable="true"` once at attach loses it on new visible rows. INVARIANT: interactive descendants (`button`, `input`, `select`, `textarea`, `a[href]`, `[contenteditable]`) never start a drag — `INTERACTIVE_DRAG_SELECTORS` checked in `isInteractiveDragOrigin()`. INVARIANT (CSS-scoping): row-clone for `setDragImage` MUST be appended INSIDE `this.gridElement`, NOT `document.body`. All `core/styles/*.css` rules are scoped under `tbw-grid { … }` AND `--tbw-column-template` defined on host — `document.body` clone misses every selector and collapses to empty box. Clone positioned via `.tbw-row-drag-clone { position: fixed; top/left: -10000px }`, removed in `setTimeout(0)` after `setDragImage`. Browser applies ~70% translucency to rasterized drag image — do NOT layer extra `opacity`/`box-shadow` on clone (multiplies with browser's effect, looks washed out; box-shadow blur captures into snapshot as horizontal fade on dark bg). Tests: `row-drag-drop.spec.ts` "dragFrom config", "row-as-handle DOM wiring", "row-as-handle dragstart behaviour", "drag image".

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

- DECIDED (Apr 2026, issue #255): Unified `slots[]` API replaces the parallel `aggregationRows[]` + `customPanels[]` axes. Each slot is one DOM row. Discriminator is **presence of `render`** — anything with `render` is a `PanelSlot`, anything without is an `AggregationSlot` (same shape as `AggregationRowConfig`). This keeps cells-only legacy aggregation rows expressible inside `slots[]` without inventing a `kind:` tag and without losing the ability to express "aggregation row whose cells are all literal labels". When `config.slots` is set, ALL legacy fields (`position`, `showRowCount`, `showSelectedCount`, `showFilteredCount`, `customPanels`, `aggregationRows`) are ignored. Legacy fields without `slots` keep byte-identical DOM (synthesized via `synthesizeLegacySlots` only as a refactor convenience — `afterRender` dispatches to `renderLegacyMode` for the legacy path).
- DECIDED (Apr 2026, issue #255): `PanelRender` returns `HTMLElement | null`. A null return drops that contribution; a panel slot whose renderers all return null is dropped from the DOM entirely. This is how built-in `selectedCountPanel()` self-hides when `selectedRows === 0` and `filteredCountPanel()` self-hides when `filteredRows === totalRows`. Adapters propagate the null contract: React null/false/undefined, Vue null/undefined, Angular component-class is always rendered (no null contract) — null is purely a render-function feature.
- DECIDED (Apr 2026, issue #255): When `config.slots` is provided, top slots render inside a NEW `.tbw-header-pinned` wrapper inserted AFTER the `.header` element (mirror of `.tbw-footer` for bottom slots). Legacy mode keeps the asymmetric "info bar inserted at `container.firstChild` BEFORE top aggregation rows" placement so existing DOM/CSS does not change. The slot-mode wrapper hides under `tbw-grid[data-responsive]` (responsive plugin) the same way `.tbw-footer` does.
- INVARIANT: Built-in panel renderers (`rowCountPanel`, `selectedCountPanel`, `filteredCountPanel`) are exported as values from `@toolbox-web/grid/plugins/pinned-rows`. They are factories returning `PanelRender` (no arguments today; reserved for future formatting options). Hardcoded English strings ("Total: N rows", "Selected: N", "Filtered: N of M") live inside these renderers — i18n consumers must build their own renderer (do NOT add locale options to the library).
