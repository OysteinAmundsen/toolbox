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
- TENSION: variable heights must measure rendered rows; unmeasured use averageHeight estimate → visible scroll jumps until measured
- TENSION: dual-cache pattern (position rebuilt frequently, height persists) reduces remeasure but adds complexity
- TENSION: inconsistent row heights cause oscillation — `#measureRowHeight()` measures first visible row each frame; if rows have different heights (e.g., tree parent vs child), virtual window shifts on each measurement, exposing different row type, causing rowHeight to oscillate. Fix: ensure consistent rendered height across row types

## grid.ts (main component)

- OWNS: component lifecycle, framework adapter registry (static), core state (\_rows, \_columns, \_visibleColumns, \_sortState, \_baseColumns, \_rowIdMap, \_\_rowRenderEpoch)
- OWNS: manager instances: ConfigManager, RenderScheduler, VirtualizationManager, RowManager, PluginManager, FocusManager
- OWNS: DOM refs (\_bodyEl, \_\_rowsBodyEl, \_renderRoot), row pool (\_rowPool), touch state, batched update coalescing (#pendingUpdate, #pendingUpdateFlags)
- READS FROM: user properties (rows, columns, gridConfig, fitMode), light DOM, plugin hooks, DOM events, ResizeObserver, MutationObserver
- WRITES TO: shadow DOM, CSS grid-template-columns, visible row elements (pooled), custom events (cell-click, row-click, header-click, cell-change, sort-change, data-change)
- INVARIANT: \_rows always reflects #rows (input) after plugin processing
- INVARIANT: \_columns contains ALL columns including hidden; \_visibleColumns is cached filter
- INVARIANT: row ID map always in sync with \_rows at read time (lazy: #applyRowsUpdate marks dirty, #ensureRowIdMap rebuilds on first read, #rebuildRowModel rebuilds unconditionally)
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

## dom-structure (shadow DOM tree)

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

## state-ownership-matrix

| State                      | Owner                 | Mutators                                     | Notes                                                        |
| -------------------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| gridConfig/columns/fitMode | ConfigManager         | merge(), property setters                    | frozen original + mutable effective                          |
| \_rows (processed)         | grid.ts               | rebuildRowModel, processRows hooks           | after plugin transforms                                      |
| #rows (raw input)          | grid.ts               | property setter only                         | raw user input, copied to \_rows                             |
| \_sortState                | grid.ts               | sort API, rebuildRowModel                    | field + direction                                            |
| \_rowIdMap                 | grid.ts               | \_rebuildRowIdMap on row changes             | O(1): rowId → {row, index}; lazy-rebuilt via #ensureRowIdMap |
| VirtualState               | VirtualizationManager | refreshVirtualWindow, init methods           | shared mutable object                                        |
| positionCache/heightCache  | VirtualizationManager | initializePositionCache, invalidateRowHeight | variable height support                                      |
| shell config + runtime     | grid.ts + ShellState  | registerToolPanel, light DOM parsing         | config maps vs runtime sets                                  |
| plugin instances           | PluginManager         | Plugin.attach                                | registered in array order                                    |

## type-interfaces

- `GridHost` = `InternalGrid & HTMLElement` (from `core/types.ts`) — used by internal modules
- `PluginGridApi` (from `plugin/types.ts`) — used by plugins
- TENSION: both define `_pluginManager` with different shapes; if you need a plugin-manager property in internal code, ensure it's on `InternalGrid`'s definition too

## internal-modules (other files in core/internal/)

| Module             | Responsibility                                                  |
| ------------------ | --------------------------------------------------------------- |
| rows               | row rendering, template cloning, pool management, row mutations |
| dom-builder        | DOM construction helpers, template fragments                    |
| shell              | header, tool panel state, rendering, light DOM parsing          |
| event-delegation   | delegated mouse/keyboard handlers at grid level                 |
| columns            | column definitions, merging, template updates                   |
| header             | header row rendering, cell templates                            |
| keyboard           | keyboard navigation, cell focus                                 |
| sorting            | sort state, sort application, sort UI updates                   |
| row-manager        | row CRUD (insertRow, removeRow, updateRow)                      |
| focus-manager      | focus state, external focus containers                          |
| row-animation      | row insertion/removal animations                                |
| resize             | column resize, user resize tracking, width persistence          |
| touch-scroll       | touch/momentum scrolling (mobile)                               |
| idle-scheduler     | deferred work (requestIdleCallback pattern)                     |
| sanitize           | HTML sanitization for user renderers                            |
| style-injector     | CSS injection, plugin styles, custom styles                     |
| aria / aria-labels | accessibility state, ARIA attributes, announcements             |
| aggregators        | sum, avg, count for grouping                                    |
