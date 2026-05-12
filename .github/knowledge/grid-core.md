---
domain: grid-core
related: [grid-plugins, grid-features, data-flow-traces]
---

# Grid Core — Mental Model

## config-manager

- OWNS: two-layer config state — `originalConfig` (frozen immutable) + `effectiveConfig` (mutable runtime clone)
- OWNS: source precedence chain (low→high): gridConfig prop → light DOM elements → columns prop → fitMode prop → column inference from first row
- OWNS: light DOM column cache, mutation observer, debounced change listeners
- READS FROM: user API setters (setGridConfig, setColumns, setFitMode), light DOM mutations, column inference from row data
- WRITES TO: effectiveConfig (drives all rendering), CSS custom properties (animation), row height on virtualization, column widths for fixed mode
- INVARIANT: originalConfig is Object.frozen after merge; never mutated
- INVARIANT: effectiveConfig is always a clone of originalConfig + runtime mutations
- INVARIANT: sources re-merged only when `sourcesChanged === true` OR no columns exist yet
- FLOW: user sets config → mark sourcesChanged → scheduler requests FULL/COLUMNS phase → merge() → collectAllSources → freeze original → clone to effective → applyPostMergeOperations
- TENSION: light DOM observation deferred to idle (framework async content arrives late)
- TENSION: debounced state-change events (100ms) to batch rapid attribute changes
- TENSION: original is frozen but columns inside are mutable (needed for runtime state like hidden, width, sort)
- INVARIANT: `setGridConfig(config)` short-circuits when `config === #gridConfig` (Apr 2026). WHY: framework adapters can re-assign the same memoized config reference on re-render (notably React's inline ref callback before it was gated — see `adapters.md` react-adapter). Without short-circuit, `sourcesChanged` flipped `true`, next `merge()` rebuilt `effectiveConfig.columns` from `gridConfig.columns`, discarding runtime mutations (`hidden`, `width`, sort indicators) written by `setColumnVisible()`/`applyColumnState()`. The grid setter's `oldValue !== value` guard only stops `#queueUpdate('gridConfig')` — does NOT prevent `setGridConfig` being called. Tests: `config-manager.spec.ts > should preserve runtime column.hidden mutations when the same gridConfig reference is set again`.

## column-groups (computeColumnGroups in `core/internal/columns.ts`)

- OWNS: per-render computation of header group structure from `column.group` strings
- INVARIANT: groups are **fragmented, not merged** — one entry per contiguous run of same-group columns. A group whose columns are split across the grid (e.g. by Visibility/PinnedColumns reordering) produces multiple fragments. WHY: lets each fragment carry its own pin / sticky / border state without the renderer having to split a single group cell mid-render.
- INVARIANT: when a renderer needs the merged view (e.g. for a single header label spanning the visual width), call `mergeAdjacentSameIdGroups()` once — do NOT call `findEmbeddedImplicitGroups()` + `mergeAdjacentSameIdGroups()` separately in each function (allocates twice). Pre-compute via `mergeGroups()` per render.
- TENSION (pinned + implicit groups): `splitMixedPinImplicitGroup()` replaces a single group header cell with separate fragments at pin boundaries when an implicit (unlabelled) group straddles a pin. The pinned fragment gets `sticky` positioning; the non-pinned utility-only remnant has its `border-right` suppressed so it visually merges with the adjacent explicit group.

## render-scheduler

- OWNS: single RAF orchestration, phase system, ready promise, initial ready resolver
- OWNS: phase hierarchy (higher includes lower): STYLE(1) → VIRTUALIZATION(2) → HEADER(3) → ROWS(4) → COLUMNS(5) → FULL(6)
- READS FROM: phase requests from throughout codebase (ResizeObserver, adapters, property setters)
- WRITES TO: executes grid methods in strict phase order: mergeConfig → processRows → processColumns → updateTemplate → renderHeader → refreshVirtualWindow → afterRender
- INVARIANT: only one RAF pending at a time
- INVARIANT: higher phase requests merge to highest (never downgrade)
- INVARIANT: phases execute descending: 6→5→4→3→2→1
- INVARIANT: ready promise resolves when RAF completes; initialReadyResolver fires only once
- FLOW: any subsystem calls requestPhase(phase) → if phase > pending: update pending → if no RAF: schedule → on RAF: execute phases in order → resolve ready
- TENSION: mergeConfig MUST run before processRows (plugins may register renderers after gridConfig set by adapters)
- TENSION: all batching adds complexity vs immediate rendering, but eliminates race conditions between ResizeObserver, framework updates, scroll events
- DECIDED: single-RAF batching chosen over microtask or synchronous rendering to prevent layout thrashing

## virtualization-manager

- OWNS: VirtualState (mutable shared object): enabled, rowHeight, bypassThreshold, start/end indices, DOM refs, position cache, height cache, geometry cache, averageHeight, measuredCount
- READS FROM: grid.\_rows (count/data), effectiveConfig.rowHeight, effectiveConfig.getRowId, plugin row heights via \_getPluginRowHeight, scroll position, DOM measurements (ResizeObserver)
- WRITES TO: start/end (visible window), positionCache, heightCache, averageHeight, faux-vscroll-spacer height CSS
- INVARIANT: positionCache is O(n) array indexed by row index; null unless variableHeights === true
- INVARIANT: heightCache persists across position cache rebuilds (keyed by row identity)
- INVARIANT: start < end for valid window; clamped to [0, _rows.length]
- INVARIANT: bypass rendering (all rows) when count ≤ bypassThreshold (default 24)
- FLOW[scroll]: scroll → getRowIndexAtOffset(scrollTop) via binary search on positionCache → calculate start/end → renderVisibleRows(start, end) using row pool
- FLOW[row-change]: initializePositionCache → rebuild from rows + heightCache → compute averageHeight → update spacer height
- TENSION: position cache O(n) rebuild on every row count change (expand/collapse, filter)
- OWNS: row height measurement lifecycle — configureVariableHeights, measureRowHeight, measureRowHeightForPlugins, resolveCssRowHeight, setupRowHeightObserver, disposeRowHeightObserver
- TENSION: variable heights must measure rendered rows; unmeasured use averageHeight estimate → visible scroll jumps until measured
- TENSION: dual-cache pattern (position rebuilt frequently, height persists) reduces remeasure but adds complexity
- TENSION: inconsistent row heights cause oscillation — measureRowHeight measures first visible row each frame; if rows have different heights (e.g., tree parent vs child), virtual window shifts on each measurement, exposing different row type, causing rowHeight to oscillate. Fix: ensure consistent rendered height across row types

## grid.ts (main component)

- OWNS: component lifecycle, framework adapter registry (static), core state (\_rows, \_columns, \_visibleColumns, \_sortState, \_baseColumns, \_rowIdMap, \_\_rowRenderEpoch)
- OWNS: manager instances: ConfigManager, RenderScheduler, VirtualizationManager, RowManager, PluginManager, FocusManager
- OWNS: DOM refs (\_bodyEl, \_\_rowsBodyEl, \_renderRoot), row pool (\_rowPool), touch state, batched update coalescing (#pendingUpdate, #pendingUpdateFlags)
- READS FROM: user properties (rows, columns, gridConfig, fitMode), light DOM, plugin hooks, DOM events, ResizeObserver, MutationObserver
- WRITES TO: shadow DOM, CSS grid-template-columns, visible row elements (pooled), custom events (cell-click, row-click, header-click, cell-change, sort-change, data-change)
- INVARIANT: \_rows always reflects #rows (input) after plugin processing
- INVARIANT: #rows is ALWAYS an array — the `rows` and `sourceRows` setters coerce nullish/non-array input to `[]`. Frameworks (React `useEffect`, Vue, Angular) may sync `grid.rows = undefined` when the caller did not pass a `rows` prop; without this coercion, `_emitDataChange` (and any `this.#rows.length` reader) crashes with "Cannot read properties of undefined". Common trigger: ServerSidePlugin (data owned by plugin, no `rows` prop required). DECIDED (Apr 2026): coerce at the setter rather than guarding every reader.
- INVARIANT: \_columns contains ALL columns including hidden; \_visibleColumns is cached filter
- INVARIANT: row ID map always in sync with \_rows at read time, but rebuild is fully lazy. Both `#applyRowsUpdate` (setter path) and `#rebuildRowModel` (RAF path) only flip `#rowIdMapDirty = true`; `#ensureRowIdMap` does the O(n) `Map.set` loop on first read by `getRow` / `_getRowEntry` / plugin afterRender hooks. DECIDED (May 2026): the eager rebuild inside `#rebuildRowModel` was 129ms / 175ms total at 1M rows — a 5× initial-render speedup (175→35ms at 1M) was unlocked by deferring it. Nothing in the scheduler pipeline between `processRows` and `afterRender` reads the map (`renderVisibleRows` iterates by index; `renderHeader` / `updateTemplate` don't touch rows). Plugins that DO need it pay only for what they consume — first call triggers rebuild once. WHY this didn't already hold: a comment claimed the eager call was needed "to keep indices in sync"; in practice the dirty flag carries the same invariant. File: [grid.ts](libs/grid/src/lib/core/grid.ts) `#rebuildRowModel`.
- INVARIANT: every property change goes through batched #queueUpdate → queueMicrotask → #flushPendingUpdates
- INVARIANT: ConfigManager.effective is THE source of truth for config
- FLOW[property-change]: set prop → queueUpdate(flag) → microtask → flushPendingUpdates → apply\*Update → request scheduler phase
- FLOW[render-cycle]: RAF fires → mergeConfig → processRows → processColumns → updateTemplate → renderHeader → refreshVirtualWindow → afterRender
- INVARIANT: position cache rebuild in #rebuildRowModel is NOT needed — scheduler always calls refreshVirtualWindow(force=true) after \_schedulerProcessRows(), which rebuilds the cache
- INVARIANT: core sort fast-path (in-place sort + refreshVirtualWindow) only safe when no row-structure plugins active — plugins declaring `modifiesRowStructure: true` require full `ROWS` phase pipeline (reapplyCoreSort on base rows → processRows rebuilds groups)
- TENSION: batched updates add indirection (flags, queued handlers) but coalesce rapid framework updates
- TENSION: \_baseColumns must be tracked separately from processed columns (plugins reorder/transform; need original to restore hidden)
- TENSION: \_\_rowRenderEpoch forces full row rebuild on column changes (avoids stale cell reuse) but adds cost when only data changed
- TENSION: two sources of sort — core sort (grid-based) vs plugin sort (tree); core sort re-applied before plugin processRows
- DECIDED (Apr 2026): `#applyColumnState` width-only fast path must also check for sort entries in the incoming state. Plugins (e.g., MultiSortPlugin) null `_sortState` after restoring their own sort model, making `_sortState` before/after comparison blind to plugin-level sort changes. Without this check the fast path skips `#setup()` → `processRows()` never runs → sort icons render but data stays unsorted.
- DECIDED (Apr 2026): `applyColumnState()` must NOT write to `#initialColumnState` when the grid is already initialized. `#initialColumnState` is a one-shot "apply on next #setup()" slot consumed and cleared by `#setup()`. If the public method stores the state on every call, a later `grid.columns = […]` (which queues `#applyColumnsUpdate` → `merge()` → `#setup()`) silently re-applies the stored state on top of the freshly merged defaults — making the first reset look like a no-op and only succeeding on the second attempt (because the first call cleared the slot). Branch on `#initialized`: apply immediately when true, store only when false.
- DECIDED (May 2026): `#applyGridConfigUpdate` MUST consume `#initialColumnState` after its source rebuild. The flow calls `markSourcesChanged()` + `merge()` twice (lines ~2171-2181 in `grid.ts`) which clones a fresh `effectiveConfig` from the original gridConfig and discards runtime `col.hidden`/`width`/order mutations. During that merge `#collectAllSources` re-stores `gridConfig.columnState` into `#initialColumnState`, but the path ends in `requestPhase(COLUMNS)` — NEVER `#setup()` — so the slot is never consumed and the declared visibility silently vanishes. Fix: after the second `merge()`, if `configManager.initialColumnState` is set, clear it and call `configManager.applyState(state, plugins)`. Regression: liquids-operations-roma cargo-list bug where a saved preset's hidden columns became visible after several filter/refetch cycles caused a React Query data ref change to rebuild the memoized gridConfig. Test: `__tests__/integration/grid-config-column-state-regression.spec.ts`.
- DECIDED (Apr 2026): grid renders into **light DOM**, not shadow DOM. `#renderRoot` returns `this`. Plugins/internal MUST query host directly (`gridEl.querySelector('.rows-body')`); `gridEl.shadowRoot` is always null. Legacy term "shadow DOM tree" in this file refers to render tree structure, not actual ShadowRoot. WHY: simpler styling (user CSS + theme variables work without `::part()` everywhere), easier framework integration, no slotting complexity. Trade-off: no encapsulation — plugin styles use `tbw-grid` selector prefix.
- DECIDED (Apr 2026): `aria-multiselectable` belongs on `role="grid"` element (`.rows-body`), NOT host. SelectionPlugin sets it in `#applySelectionClasses` based on `multiSelect` (default `true`); detach removes. Setting on host is invalid per WAI-ARIA — AT only checks role-bearing element.
- DECIDED (Apr 2026): `dataLoaded` a11y announcement only fires when `sourceRowCount` changes between `_emitDataChange()` calls. Internal sort/filter/edit emits leave count unchanged — don't spam live region or conflict with dedicated announcements (`sortApplied`, `filterApplied`, `editingCommitted`). Initial `0 → 0` mount suppressed; later increases from 0 announce normally. State: `AriaState.lastAnnouncedSourceCount`.
- DECIDED (Apr 2026): `aria-busy` toggles on host alongside `loading` HTML attribute in `loading` setter. Plugins doing async work (e.g. `FilteringPlugin` server-side filter) also set `aria-busy` directly while request in flight; clear on completion.

## dom-structure (render tree, light DOM)

```
<tbw-grid>
└─ shadow root
   ├─ <style> (grid styles)
   └─ .tbw-grid-root [.has-shell]
      ├─ .tbw-shell-header (if shell)
      ├─ .tbw-shell-body / .tbw-grid-content
      │  ├─ .tbw-tool-panel (if shell, sidebar)
      │  └─ .tbw-scroll-area
      │     ├─ .rows-body-wrapper
      │     │  └─ .rows-body [role=grid]
      │     │     ├─ .header [role=rowgroup]
      │     │     │  └─ .header-row [role=row, part=header-row]
      │     │     │     └─ .header-cell [part=header-cell] ×N
      │     │     └─ .rows-container [role=presentation]
      │     │        └─ .rows-viewport [role=presentation]
      │     │           └─ .rows
      │     │              └─ .data-grid-row [role=row, part=row] ×M (pooled)
      │     │                 └─ .cell [role=gridcell, part=cell] ×N
      │     ├─ .faux-vscroll (scrollbar proxy)
      │     │  └─ .faux-vscroll-spacer [style=height]
      │     └─ .tbw-sr-only (screen reader announcements)
```

## scroll-driven-dom-state (cross-cutting INVARIANT for plugins)

- INVARIANT: any plugin that maintains scroll-driven DOM state (e.g. `translateX`, toggled classes derived from `scrollLeft`/`scrollTop`, sticky offsets) MUST apply that state from **three** call sites:
  1. `onScroll` — fires during scroll but `afterRender` does not.
  2. `afterRender` — fires after re-renders that rebuild the DOM (re-renders do NOT replay scroll state).
  3. `afterCellRender` — virtualization recycles row pool elements; per-cell visual state (`position: sticky`, offsets, etc.) does not survive recycling unless re-applied per cell.
- WHY: the three triggers are independent. A plugin that only listens on `onScroll` loses state after any re-render; one that only writes in `afterRender` loses state during scroll; one that writes only at row level loses per-cell visual state when virtualization recycles a row into a different position. Symptom: visual state is right at first paint, then disappears after sort/filter/scroll.
- DECIDED: this is a render-cycle invariant, not a per-plugin gotcha — apply it whenever a plugin's visual contract depends on `scrollLeft` / `scrollTop` / row position.

## state-ownership-matrix

| State                      | Owner                 | Mutators                                     | Notes                                                           |
| -------------------------- | --------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| gridConfig/columns/fitMode | ConfigManager         | merge(), property setters                    | frozen original + mutable effective                             |
| \_rows (processed)         | grid.ts               | rebuildRowModel, processRows hooks           | after plugin transforms                                         |
| #rows (raw input)          | grid.ts               | property setter only                         | raw user input, copied to \_rows                                |
| \_sortState                | grid.ts               | sort API, rebuildRowModel                    | field + direction                                               |
| \_rowIdMap                 | grid.ts               | \_rebuildRowIdMap on row changes             | O(1): rowId → {row, index}; lazy-rebuilt via #ensureRowIdMap    |
| VirtualState               | VirtualizationManager | refreshVirtualWindow, init methods           | shared mutable object                                           |
| positionCache/heightCache  | VirtualizationManager | initializePositionCache, invalidateRowHeight | variable height support                                         |
| shell config + runtime     | grid.ts + ShellState  | registerToolPanel, light DOM parsing         | config maps vs runtime sets                                     |
| plugin instances           | PluginManager         | Plugin.attach                                | registered in array order                                       |
| accessor cache             | value-accessor.ts     | resolveCellValue, invalidateAccessorCache    | WeakMap<row, Map<field, value>>; in-place edits must invalidate |

## type-interfaces

- `GridHost` = `InternalGrid & HTMLElement` (from `core/types.ts`) — used by internal modules
- `PluginGridApi` (from `plugin/types.ts`) — used by plugins
- TENSION: both define `_pluginManager` with different shapes; if you need a plugin-manager property in internal code, ensure it's on `InternalGrid`'s definition too

## internal-modules (other files in core/internal/)

| Module             | Responsibility                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| rows               | row rendering, template cloning, pool management, row mutations                |
| dom-builder        | DOM construction helpers, template fragments                                   |
| shell              | header, tool panel state, rendering, light DOM parsing, DOM construction       |
| shell-controller   | ShellController: tool panel orchestration, header/toolbar content registration |
| event-delegation   | delegated mouse/keyboard handlers at grid level                                |
| columns            | column definitions, merging, template updates                                  |
| header             | header row rendering, cell templates                                           |
| keyboard           | keyboard navigation, cell focus                                                |
| sorting            | sort state, sort application, sort UI updates                                  |
| row-manager        | row CRUD (insertRow, removeRow, updateRow)                                     |
| focus-manager      | focus state, external focus containers                                         |
| row-animation      | row insertion/removal animations                                               |
| resize             | column resize, user resize tracking, width persistence                         |
| touch-scroll       | touch/momentum scrolling (mobile)                                              |
| idle-scheduler     | deferred work (requestIdleCallback pattern)                                    |
| sanitize           | HTML sanitization for user renderers                                           |
| style-injector     | CSS injection, plugin styles, custom styles                                    |
| aria / aria-labels | accessibility state, ARIA attributes, announcements                            |
| aggregators        | sum, avg, count for grouping                                                   |
| value-accessor     | single source of truth for cell value resolution; per-row WeakMap cache        |

- DECIDED (May 2026): `shell.header.toolPanelToggle: false` opts out of the built-in `<button.tbw-toolbar-btn[data-panel-toggle]>` AND the auto-inserted `.tbw-toolbar-separator`. Tool panels stay registered/openable via `grid.toggleToolPanel()` / `toggleToolPanelSection(id)`. WHY: lets consumers (e.g. Equinor EDS) ship their own design-system button via `shell.header.toolbarContents` without hiding library DOM with CSS — and avoids orphaned separator. Default `true` preserves existing behavior. Both render paths gated: `renderShellHeader` in [shell.ts](libs/grid/src/lib/core/internal/shell.ts) and `buildShellHeader` in [dom-builder.ts](libs/grid/src/lib/core/internal/dom-builder.ts) (via `ShellHeaderOptions.showToggle`). Tests: `shell.spec.ts > omits built-in toggle button when shell.header.toolPanelToggle is false`.

- DECIDED (May 2026): tool-panel sidebar open state is controlled by three knobs on `shell.toolPanel`. `initialState: 'open' | 'closed'` (default `'closed'`) is the forward-compatible way to control sidebar open state on load. `locked: true` implies `initialState: 'open'`, makes `closeToolPanel()` a no-op (early return in [shell-controller.ts](libs/grid/src/lib/core/internal/shell-controller.ts)), and suppresses the built-in toggle button (folded into `showToggle` alongside `toolPanelToggle: false` in [shell.ts](libs/grid/src/lib/core/internal/shell.ts) and `buildShellOptions`). `defaultOpen: '<id>'` selects which accordion section auto-expands on first open. TENSION: in v2.x `defaultOpen` ALSO opens the sidebar (legacy behavior preserved for non-breaking release); v3.0.0 will drop that — issue #259. The legacy fallback is gated by `initialState === undefined`, so setting `initialState: 'closed'` opts into the v3 behavior today. Search marker `TOOLPANEL-OPEN-LEGACY-259` in [grid.ts](libs/grid/src/lib/core/grid.ts) (`afterConnect` + `#afterShellRefresh`) marks the code to delete for v3. JSDoc on `ToolPanelConfig.defaultOpen` is `@deprecated` with the same #259 reference. Tests: `grid.integration.spec.ts > legacy v2: defaultOpen alone opens the sidebar (deprecated, see #259)` (remove/invert in v3) and `> expands the configured default section but does not open the sidebar` (uses `initialState: 'closed'` to assert v3 behavior).

- DECIDED (#316, May 2026): `grid.openToolPanel(panelId?: string)` accepts an optional section id for one-click panel routing (multiple toolbar buttons → distinct panels). WHY: replaces the `openToolPanel() + toggleToolPanelSection(id)` two-call dance every consumer was reinventing; `toggleToolPanelSection` is a _toggle_, so callers had to guard against the section already being expanded. Precedence: explicit `panelId` > `shell.toolPanel.defaultOpen` > first panel by `order`. Unknown id → `TBW072` warn + fall back to default behavior (do not throw — id may have been transiently unregistered). If panel is already open with a different section, switches via `toggleToolPanelSection` for accordion exclusivity + correct event emission. If requested section already expanded, no-op (no duplicate `tool-panel-open` event). `VisibilityPlugin.show()` collapsed to a one-liner. API surfaces: [grid.ts](libs/grid/src/lib/core/grid.ts) `openToolPanel`, [shell-controller.ts](libs/grid/src/lib/core/internal/shell-controller.ts), [types.ts](libs/grid/src/lib/core/types.ts) `InternalGrid`, [plugin/types.ts](libs/grid/src/lib/core/plugin/types.ts) `PluginGridApi`. Tests: `grid.integration.spec.ts > opens tool panel with explicit panelId expanding the requested section`, `> switches expanded section when openToolPanel is called with a different panelId while open`, `> falls back to default behavior when openToolPanel is called with an unknown panelId`.

- INVARIANT: numeric aggregators (`sum`, `avg`, `min`, `max`) skip blank cells (`null`/`undefined`/`''`/`NaN`) — matches Excel SUM/AVG/MIN/MAX. `Number('') || 0` would pull blanks in as zero, dragging `min` down against positive data, inflating `avg` denominator, letting blanks beat all-negative in `max`. `avg` divides by count of non-blank (returns 0 if all blank). Pivot value extraction applies same filter. DECIDED (Apr 2026): blank-skipping is default; callers needing zero-substitution provide custom aggregator.

- DECIDED (#230): `column.valueAccessor({ row, column, rowIndex })` is single source of truth for cell value resolution. Used by sort, filter, render, export, clipboard, and built-in aggregators (sum/avg/min/max/first/last) via `resolveCellValue(row, column, rowIndex)`. Precedence: `sortComparator` overrides for sort; `filterValue` overrides for filter; `valueAccessor` always wins over plain field reads for render/format/export/copy/aggregate. `valueAccessor` is the _default_, never an override of per-feature escape hatch. `resolveCellValue` and `invalidateAccessorCache` exported from `public.ts`.

- INVARIANT: accessor results memoized per `(row identity, column.field)` in `WeakMap<row, Map<field, CacheBox>>` where `CacheBox = { v: unknown }`. The box wrapper is required so cached `undefined` is distinguishable from cache miss with a single `Map.get()` lookup (truthy box check) — `has() + get()` doubles the Map probes on the hottest grid path. Immutable updates (new row reference) auto-invalidate. In-place mutations MUST call `invalidateAccessorCache(row, field)` — wired into `RowManager.updateRow/updateRows/applyTransaction` and `EditingPlugin` commit. Primitive rows bypass cache (WeakMap key constraint). FLOW: sort/filter/render/export → `resolveCellValue` → cache hit OR `accessor()` → cache write. DECIDED (Nov 2025): single-lookup cache via box wrapper. WHY: bench `resolveCellValue` cache hit ~+5% (42.9K → 45.2K hz) — small per-call but compounds across every visible cell on every render. File: [value-accessor.ts](libs/grid/src/lib/core/internal/value-accessor.ts), bench [value-accessor.bench.ts](libs/grid/src/lib/core/internal/value-accessor.bench.ts).

## sort hot path

- INVARIANT: `Array.prototype.sort` callbacks MUST be allocation-free and MUST NOT re-extract row values per compare. V8 calls the comparator ~n·log·n times (≈130k for 10k rows × 2 keys); any per-pair `column?.valueAccessor` branch, `chain.some(...)`, or `localeCompare()` (which lazily allocates an `Intl.Collator`) multiplies that cost.
- DECIDED (May 2026): `multi-sort.ts` uses **Schwartzian transform** — extract sort keys once per row into a flat `unknown[]`, sort a `Uint32Array` of indices using cached keys, permute rows in one pass. Collapses ~2·k·n·log·n value extractions to k·n (13× reduction at 10k×2). Comparator body is pure key-vs-key array indexing the JIT inlines tightly. RULED OUT: per-link `getValue` closures alone (still fires per-pair); separate fast/slow comparator variants per (chain.length, needsPin) combo (4× code, smaller win).
- DECIDED (May 2026): hot-path setup MUST pre-compute every config-derived flag. Pre-bind value getter per chain link (`col.valueAccessor ? row => resolveCellValue(row, col) : row => row[field]`); pre-scan `__loading` rows once and skip pin checks entirely when none exist; cache module-level `Intl.Collator` for `defaultComparator` string fallback. File: [multi-sort.ts](libs/grid/src/lib/plugins/multi-sort/multi-sort.ts).
- TENSION: the 50ms unit-test budget in [multi-sort.spec.ts](libs/grid/src/lib/plugins/multi-sort/multi-sort.spec.ts) was a poor early-warning system — single-sample wall-clock with <2× headroom hides latent waste until unrelated test additions consume the slack (May 2026: clipboard/undo-redo spec growth surfaced regression that had been latent since #230). Now uses best-of-N sampling. Real perf signal lives in [e2e/tests/performance-regression.spec.ts](e2e/tests/performance-regression.spec.ts).
