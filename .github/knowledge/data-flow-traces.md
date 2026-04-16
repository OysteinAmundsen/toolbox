---
domain: data-flow-traces
related: [grid-core, grid-plugins, grid-features, adapters]
---

# Data Flow Traces — Mental Model

End-to-end traces for key operations. Follow these to understand what code runs and in what order.

## trace: first-render (connectedCallback)

```
SYNCHRONOUS (critical path):
  connectedCallback()
  ├─ parse light DOM shell elements (toolbar, header, panels)
  ├─ parse light DOM columns (<tbw-grid-column>)
  ├─ ConfigManager.merge() → freeze originalConfig → clone to effectiveConfig
  ├─ PluginManager.initializePlugins() → attach each in array order
  ├─ collect plugin shell contributions (getToolPanel, getHeaderContent)
  ├─ #render() → build shadow DOM tree → inject <style> → append to shadow root
  └─ #afterConnect() → setup event listeners, ResizeObserver, scroll handlers

DEFERRED (idle callback):
  └─ setup light DOM MutationObserver (frameworks may inject content async)

FIRST RAF (render-scheduler):
  ├─ _schedulerMergeConfig() — re-merge if sources changed
  ├─ _schedulerProcessRows() — sort + plugin processRows hooks
  ├─ _schedulerProcessColumns() — plugin processColumns hooks
  ├─ _schedulerUpdateTemplate() — calculate widths, CSS grid-template-columns
  ├─ _schedulerRenderHeader() — render header cells
  ├─ refreshVirtualWindow() — compute start/end, renderVisibleRows
  └─ _schedulerAfterRender() — plugin afterRender, auto-size, focus setup
      → resolves ready() promise → fires initialReadyResolver (once)
```

## trace: property-change (grid.rows = newData)

```
grid.rows setter
  ├─ store in #rows (raw input)
  └─ #queueUpdate(ROWS flag)
       └─ if not pending: queueMicrotask(#flushPendingUpdates)

MICROTASK:
  #flushPendingUpdates()
  ├─ #applyRowsUpdate()
  │   ├─ _rows = shallow copy of #rows
  │   ├─ _rebuildRowIdMap() — O(n) Map rebuild
  │   └─ scheduler.requestPhase(ROWS)
  └─ (other pending flags handled similarly)

NEXT RAF:
  scheduler#flush()
  ├─ _schedulerProcessRows() (ROWS phase)
  │   ├─ start with _rows (copy of input)
  │   ├─ reapplyCoreSort (maintain existing sort)
  │   └─ pluginManager.processRows() — each plugin transforms in priority order
  │       ServerSide(-10) → Tree/GroupingRows(10) → MultiSort(0) → Filtering(0) → others
  ├─ _schedulerProcessColumns() (if COLUMNS phase also requested)
  ├─ _schedulerUpdateTemplate()
  ├─ _schedulerRenderHeader()
  ├─ refreshVirtualWindow()
  │   ├─ initializePositionCache (if variable heights)
  │   ├─ calculate start/end from scroll position
  │   └─ renderVisibleRows(start, end) — reuse pooled row elements
  └─ _schedulerAfterRender()
      └─ plugin afterRender hooks
```

## trace: user-sorts-column (header click)

```
EVENT: click on .header-cell
  ├─ event-delegation captures click
  └─ pluginManager.onHeaderClick(detail)
      ├─ Pivot.onHeaderClick (priority -10) — intercepts pivot column headers → early exit if handled
      ├─ GroupingRows.onHeaderClick (priority -1) — intercepts group headers → early exit if handled
      └─ MultiSort.onHeaderClick (priority 0)
          ├─ toggle sort direction on clicked field (or add to multi-sort)
          ├─ update sortModel[]
          ├─ broadcast('sort-change', { sortModel })
          └─ grid.requestRender() → scheduler.requestPhase(ROWS)

RAF:
  ├─ _schedulerProcessRows()
  │   ├─ MultiSort.processRows() — sorts rows by sortModel
  │   ├─ Tree.processRows() — re-flattens with new sort (queries sort:get-model)
  │   └─ Filtering.processRows() — re-applies filters on sorted data
  ├─ refreshVirtualWindow() → renderVisibleRows
  └─ _schedulerAfterRender()
      └─ sort indicator styling applied to header cells
```

## trace: scroll (vertical)

```
EVENT: scroll on .rows-viewport
  ├─ virtualizationManager handles scroll
  │   ├─ getRowIndexAtOffset(scrollTop)
  │   │   └─ if variableHeights: binary search on positionCache
  │   │   └─ if uniform: simple division (scrollTop / rowHeight)
  │   ├─ calculate new start/end indices
  │   └─ if window changed: renderVisibleRows(start, end)
  │       ├─ for each row in window:
  │       │   ├─ get/create pooled row element
  │       │   ├─ set data-row-index attribute
  │       │   ├─ render cells (reuse or create)
  │       │   ├─ afterCellRender hooks (per cell)
  │       │   ├─ afterRowRender hooks (per row)
  │       │   └─ onScrollRender hooks (lightweight reapply for recycled rows)
  │       └─ recycle unused row elements back to pool
  └─ pluginManager.onScroll(event)
      ├─ PinnedColumns — update sticky positioning
      ├─ ServerSide — check if approaching data boundary, trigger fetch
      └─ others — update scroll-dependent UI
```

## trace: cell-edit (editing plugin)

```
EVENT: dblclick (or click/manual) on cell
  ├─ Editing.onCellClick(detail)
  │   ├─ check if column is editable
  │   ├─ store snapshot of current cell value
  │   ├─ increment grid.__editingCellCount
  │   ├─ emit 'edit-open' event
  │   └─ render editor into cell (replace content with editor component)

USER TYPES → editor captures input

EVENT: Enter/Tab/Escape/blur
  ├─ Editing.onKeyDown or blur handler
  │   ├─ if commit (Enter/Tab):
  │   │   ├─ get new value from editor
  │   │   ├─ compare with snapshot
  │   │   ├─ if changed: update row data, mark as dirty, emit 'cell-commit'
  │   │   ├─ UndoRedo pushes to undo stack (if listening)
  │   │   └─ decrement __editingCellCount
  │   ├─ if cancel (Escape):
  │   │   ├─ restore from snapshot
  │   │   └─ decrement __editingCellCount
  │   └─ remove editor, restore cell renderer
  ├─ if Tab: move focus to next editable cell → open new editor
  └─ grid.requestRender() if data changed → re-sort may apply
      └─ MultiSort caches sort during edit to prevent row jumping
```

## trace: framework-component-render (react example)

```
React app renders:
  <DataGrid columns={[{ field: 'status', renderer: StatusBadge }]} rows={data} />

MOUNT:
  ├─ DataGrid component (wrapper)
  │   ├─ processGridConfig(columns)
  │   │   ├─ detect StatusBadge is React component (not plain function)
  │   │   └─ wrap in createComponentRenderer(StatusBadge)
  │   │       └─ returns (ctx) => PortalManager.render(StatusBadge, container, ctx)
  │   ├─ set grid.gridConfig = { columns: [...processed] }
  │   └─ set grid.rows = data

RENDER CYCLE (in grid):
  ├─ for each visible cell with renderer:
  │   ├─ call renderer(ctx) → PortalManager.render(StatusBadge, cellDiv, { value, row, column })
  │   ├─ PortalManager creates React portal: createPortal(<StatusBadge {...ctx} />, cellDiv)
  │   └─ React renders StatusBadge into cellDiv

SCROLL RECYCLE:
  ├─ row element reused for different row
  ├─ cell container already has portal
  ├─ PortalManager.render() called again with new ctx → React re-renders in place
  └─ if cell removed: releaseCell() → PortalManager.unmountPortal(key) → cleanup
```

## trace: tree-expand (click expander)

```
EVENT: click on tree expander cell
  ├─ Tree.onCellClick(detail)
  │   ├─ toggle expandedKeys set (add or remove row key)
  │   ├─ IF expanding AND lazy children (truthy non-array childrenField):
  │   │   ├─ query datasource:is-active → ServerSide responds true
  │   │   ├─ add key to loadingKeys
  │   │   └─ query datasource:fetch-children { source:'tree', parentNode, nodePath }
  │   │       └─ ServerSide.fetchChildren() → getChildRows() → broadcast datasource:children
  │   │           └─ Tree listener: merge children into parent row, remove from loadingKeys, requestRender
  │   ├─ broadcast('tree-expand', { row, expanded })
  │   └─ grid.requestRender() → scheduler.requestPhase(ROWS)

RAF:
  ├─ _schedulerProcessRows()
  │   ├─ ServerSide.processRows(-10) — if async: trigger fetch children, insert placeholders
  │   ├─ Tree.processRows(10)
  │   │   ├─ query sort:get-model from MultiSort (apply hierarchical sort)
  │   │   ├─ flatten tree: walk rows, include children of expanded keys
  │   │   ├─ set __treeLevel, __isExpanded, __hasChildren on each row
  │   │   └─ return flattened array (more rows than input if expanded)
  │   ├─ MultiSort.processRows — sort the flattened tree respecting hierarchy
  │   └─ Filtering.processRows — filter respecting tree structure
  ├─ virtualization recalculates (row count changed)
  │   ├─ initializePositionCache (if variable heights — tree rows may have different heights)
  │   └─ refreshVirtualWindow → renderVisibleRows
  └─ _schedulerAfterRender()
      └─ Tree.afterCellRender — apply indent styling, expander icon state
```

## trace: config-merge (multiple sources)

```
ConfigManager.merge() called by scheduler (COLUMNS phase)
  ├─ if sourcesChanged || no columns exist:
  │   ├─ collectAllSources() — precedence order:
  │   │   1. gridConfig property (lowest)
  │   │   2. light DOM elements (<tbw-grid-column> with attributes)
  │   │   3. columns property
  │   │   4. fitMode property
  │   │   5. column inference from first row (if no columns defined)
  │   ├─ merge all sources into single config object
  │   ├─ apply TypeDefaults to columns
  │   ├─ Object.freeze(originalConfig) — immutable snapshot
  │   └─ effectiveConfig = structuredClone(originalConfig) — mutable runtime copy
  ├─ applyPostMergeOperations()
  │   ├─ set row height on virtualization manager
  │   ├─ calculate column widths for fixed mode
  │   └─ apply animation config via CSS custom properties
  └─ mark sourcesChanged = false
```
