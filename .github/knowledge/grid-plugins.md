---
domain: grid-plugins
related:
  [
    grid-plugins-catalog-data,
    grid-plugin-pinned-columns,
    grid-plugin-contracts,
    grid-plugins-catalog-ui,
    grid-plugins-shell,
    grid-core,
    grid-features,
  ]
---

# Grid Plugin System — Mental Model

> Scope: plugin manager, lifecycle, hooks, communication, and scroll dispatch.
>
> - Cross-cutting contracts and registries → grid-plugin-contracts.md.
> - Per-plugin models → grid-plugins-catalog-data.md, grid-plugin-pinned-columns.md, grid-plugin-pivot.md, grid-plugins-hierarchy.md, grid-plugin-selection.md, grid-plugins-catalog-ui.md, grid-plugin-responsive.md, grid-plugins-editing.md, and grid-plugins-shell.md.
>
> Read order for "a plugin hook does not run": lifecycle → hook system → plugin-specific model.

## plugin-manager

- OWNS: plugin instances (array order), hook caches (sorted by priority), renderer/editor registries, event bus, query handlers.
- READS FROM: plugin manifests (dependencies, incompatibilities, hookPriority, queries).
- WRITES TO: cached hook-presence flags, `cellRenderers`/`headerRenderers`/`cellEditors` maps.
- INVARIANT: plugins execute in array order; `manifest.hookPriority` overrides (**lower = earlier**). When a hook needs DOM produced by another plugin's same hook, raise the dependent plugin's `hookPriority` (runs later) OR defer with `queueMicrotask()`.
- INVARIANT: one PluginManager per grid; plugins are stateful singletons. Dependencies validated on attach; incompatibilities warned at runtime (dev only).

## plugin-lifecycle

- FLOW: `attach(grid)` → merge defaults + user config → store grid ref → `onPluginAttached()` notifications → [runtime hooks] → `detach()` → abort signal fires → cleanup.
- INVARIANT: `disconnectSignal` (AbortSignal) fires on detach — use it for ALL event-listener cleanup. GUARANTEED by `PluginManager.detachAll()` calling `plugin.__releaseDisconnectSignal()` (idempotent; base `detach()` calls it too) AFTER `plugin.detach()` — 7 plugins (clipboard, context-menu, filtering, grouping-columns, reorder, selection, visibility) override `detach()` without `super.detach()` and leaked host listeners until PR #525. Tests: `integration/plugin-detach-signal.spec.ts`.
- INVARIANT: `plugin.grid` is available after `attach()`, null after `detach()`.
- INVARIANT: `plugin.grid` (typed `GridElement`) is the object plugins read internal state from (`_sortState`, `_visibleColumns`, `_virtualization`, …). Do **NOT** re-route those reads through `this.gridElement` / `grid._hostElement`. Production satisfies `_hostElement === this`, but plugin specs mock `grid` as a plain object with **no** `_hostElement` (see RULED OUT (a) below).
- DECIDED (Aug 2026, #465): plugin grid types form one narrowing chain `PublicGrid<T>` → `InternalGrid<T>` → `GridElementRef<T>` → `GridElement`, with the **plugin-facing type at the bottom**. `GridElementRef<T = any> extends Omit<InternalGrid<T>, Exclude<keyof GridConfig<T>, ElementBackedConfigKey> | DomRedeclaredKey>, HTMLElement` (`core/plugin/types.ts`). WHY: the post-`attach()` view is the _most specific_ one, and `GridElementRef`/`GridElement` are **not exported from `public.ts`**, so all narrowing lands on types no consumer can name ⇒ zero public-API change. No `this.grid as unknown as GridHost` casts remain.
- INVARIANT: `GridElementRef extends HTMLElement`, so `this.grid` is directly assignable to `GridHost = InternalGrid<T> & HTMLElement`. MUST NOT re-add a hand-rolled DOM facade (`clientWidth`, `addEventListener`, `setAttribute`, …) — removed for real inheritance. `DomRedeclaredKey = 'querySelector' | 'querySelectorAll'` is omitted from the `InternalGrid` half: it declares 2 overloads vs `HTMLElement`'s 4, and multiply-inherited same-named members must be _identical_.
- INVARIANT: only 4 of `GridConfig`'s 25 keys are real accessors on the custom element — `ElementBackedConfigKey = 'columns' | 'fitMode' | 'columnState' | 'columnInference'`. Every other config key (`rowHeight`, `locale`, `sortable`, …) lives only in `gridConfig`/`effectiveConfig` and is `undefined` when read off the element, so `GridElementRef` omits them. `InternalGrid extends GridConfig` over-promises ~20 phantom members; reading them off a plugin's `grid` is now a compile error.
- DECIDED (#465, PR #466 review): `PublicGrid.getPlugin` and `GridElement.getPlugin` are both constrained to `GridPlugin` (`core/types.ts`), not `BaseGridPlugin` — the latter would reintroduce a circular import. `PublicGrid.getPlugin` is thus _stricter_ than before (was unconstrained `<P>`), but NOT breaking: `BaseGridPlugin implements GridPlugin` with `abstract readonly name` (subclasses must declare it) and `version` defaulted to `__GRID_VERSION__`, so every registerable plugin satisfies it by construction. Only `getPlugin(NonPluginClass)` is newly rejected — it returned `undefined` anyway (`plugin-manager` only stores `BaseGridPlugin`). RULED OUT: an unconstrained "back-compat" overload — TS resolves to it and the constraint never binds.
- RULED OUT: (a) re-routing via `this.gridElement` / `grid._hostElement` — 73 failures across 7 specs (tree, undo-redo, reorder-columns, multi-sort, grouping-rows, row-drag-drop, server-side); (b) `GridElement extends GridElementRef, InternalGrid` — multiple inheritance needs identical same-named members; (c) hoisting `protected get internalGrid()` onto `BaseGridPlugin` — base-class names are unmanglable at every call site (editing has ~500 B headroom); (d) dropping `InternalGrid extends GridConfig<T>` — removes 25 members from an **exported** type = breaking.
- INVARIANT: a scratch/probe `.ts` file **cannot** verify grid type-compatibility. `InternalGrid extends GridConfig`, and 52 files `declare module '../core/types'`, so its shape depends on which augmentations the compilation loaded — a probe reported "no error" for a cast that fails in real plugin files. Verify via `bun nx build grid`, never an isolated file.
- DECIDED: prefer config-driven init over post-ready imperative setup. Known-at-config-time resources accept a config prop and auto-init in `attach()` (pattern: `ServerSidePlugin` reads `config.dataSource`). Reserve imperative setters (`setDataSource()`) for runtime swaps.
- DECIDED (Feb 2026, dead-config audit): a key declared on `*PluginConfig` + set in `defaultConfig` + documented, with ZERO consumers, is **dead and MUST be removed** — never "reserved for future use". Sweep: grep `config.<key>` across the plugin dir + core. Removed: `visibility.allowHideAll`, `master-detail.collapseOnClickOutside`, `filtering.{trimInput,useWorker}`. PENDING: `pinned-rows.{showRowCount,showSelectedCount,showFilteredCount}` (removal needs a synthesized default `slots: []`).
- INVARIANT (Sep 2026): imperative plugin state set via a plugin-API call does **NOT** survive a `gridConfig` reassignment. `set gridConfig` → `#queueUpdate` → (scheduler rAF) `#syncPlugins()` → `pluginManager.detachAll()` + `#initializePlugins()`, so the instance returned by `getPluginByName()` **before** the flush is discarded. Observer-driven plugins re-`observe()` on the fresh `attach()`, and RO callbacks fire **after** rAF callbacks in the same frame, so even `requestAnimationFrame(() => plugin.setX())` is undone. To pin state across a config rebuild, re-assert from the plugin's own change event, not a one-shot rAF (`ResponsiveDefaultDemo`, `setResponsive()`).

## hook-system

### Render-cycle hooks

| Hook              | Phase        | Purpose                                  | Returns          |
| ----------------- | ------------ | ---------------------------------------- | ---------------- |
| `orderColumns`    | COLUMNS      | reorder FULL list, hidden incl. (#512)   | `ColumnConfig[]` |
| `processColumns`  | COLUMNS      | transform column array                   | `ColumnConfig[]` |
| `windowColumns`   | lazy         | render-only subset (#603), `@internal`   | `ColumnConfig[]` |
| `processRows`     | ROWS         | transform row array (filter/sort/expand) | `any[]`          |
| `afterCellRender` | per-cell     | cell styling, badges                     | void             |
| `afterRowRender`  | per-row      | row styling, ARIA                        | void             |
| `afterRender`     | STYLE        | full DOM queries, event listeners        | void             |
| `onScrollRender`  | scroll-reuse | reapply visual state to recycled DOM     | void             |

- INVARIANT: `windowColumns` runs on a `_visibleColumns` cache miss. `processColumns` MUST be idempotent on its OWN output (each COLUMNS pass re-seeds `#baseColumns`): rebuild an injected column in place by field, keeping runtime state (RowDragDrop: pin, #603). Column-REPLACING plugins must cache their source columns in `orderColumns` (full list) to restore them (Pivot, #605).

### Event hooks (return `true` for early exit)

`onKeyDown` · `onCellClick` · `onRowClick` · `onHeaderClick` · `onScroll` · `onCellMouseDown`/`Move`/`Up` (drag).

### Virtualization hooks

| Hook                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `getRowHeight`               | synthetic row height (detail panels, tree)                          |
| `adjustVirtualStart`         | render extra rows above the viewport                                |
| `renderRow`                  | custom row DOM, bypasses default renderer; `hookPriority` order     |
| `getHorizontalScrollOffsets` | pinned-column spacing for keyboard navigation (PinnedColumnsPlugin) |
| `getVerticalScrollOffsets`   | overlay height above/below rows viewport (StickyRowsPlugin)         |

- INVARIANT (scroll-boundary hooks, #449): report ONLY space painted **over** the scrollable rows. Normal-flow content (pinned-row bars, `.tbw-footer`, header, shell header) already shrinks the viewport via `flex-shrink: 0` — reporting it scrolls twice as far. Only `.tbw-sticky-rows` (`absolute; top:0; z-index:22` inside `.rows-viewport`) qualifies today.
- FLOW (`getVerticalScrollOffsets`, 5 files, mirrors the horizontal chain): `BaseGridPlugin` hook → `PluginManager` sums `top`/`bottom`, ORs `skipScroll` → `InternalGrid._getVerticalScrollOffsets` (types.ts) → `grid.ts` delegator → `keyboard.ts scrollFocusedRowIntoView` **and** `focus-manager.ts scrollToRow`. A new boundary hook = all five files.
- `skipScroll: true` = "already visible by other means, don't move the viewport" (StickyRows returns it when the focused row IS a stuck clone).
- Consumers clamp with `Math.max(0, …)` and bail when `usableHeight <= 0` — a malformed report can't invert the band or yield NaN.

- INVARIANT (`renderRow` contract): when a plugin's `renderRow` takes over cell creation (Pivot, GroupingRows, Tree custom rows, MasterDetail panels), the grid's normal cell pipeline is **skipped entirely** — `format`, `cellRenderer`, `cellClass`, value-accessor caching and sanitize wrapping MUST be re-applied manually. Canonical pattern: the cell render path in [rows.ts](libs/grid/src/lib/core/internal/rows.ts). Forgetting = silent formatter loss inside grouped/pivot rows.
- DECIDED (#548): `column.format(value, row)` keeps its required-row type — pass a REAL row where one exists (set filter: first row per value, `getUniqueValues(…, rowsByValue)`). No row (`valuesHandler` values, Pivot aggregates) → `plugins/shared/format-value.ts#tryFormat` with `row` undefined: throw → raw value + one TBW062 (warn-once state on the plugin, e.g. Pivot `formatErrorFields`, since `buildValueFormatters` reruns per `processRows`). Never fake a row (`{}`) or `undefined as never`. WHY: `TRow | undefined` breaks row-reading formats; a row-free 2nd formatter = two callbacks per column.
- INVARIANT (PR #553): `BLANK_FILTER_VALUE` is the ONLY blank `compileSetPredicate` matches → `valuesHandler` results go through `normalizeValuesHandlerResult`: `null`/`undefined` (+ `''` if no `filterValue`/`valueAccessor` extractor) → sentinel, labels re-keyed, dupes dropped (raw `null` became `notIn: [null]`, never hiding blanks). The panel never formats the sentinel.

### State-persistence hooks

- `getColumnState()` → plugin's column state for save; `applyColumnState()` → restore.
- INVARIANT: a plugin owning sort (MultiSortPlugin) MUST broadcast `sort-change` from `applyColumnState`, deferred via microtask to batch per-column calls.
- DECIDED (Apr 2026, plugin-side render trigger): plugin state that core's `#applyColumnState` width-only fast path can't observe (plugin nulled `_sortState`) → the PLUGIN forces the re-render. MultiSortPlugin snapshots the model at batch start, compares in the deferred microtask, and on change broadcasts `sort-change` + `this.requestRender()` (ROWS); covers sort-add (`incomingHasSort` bypass) and removal. WHY not a core `hasOwnedSort` query: ~30 bytes over budget. RULE: a plugin mutating owned state in `applyColumnState` self-triggers the render.

## inter-plugin communication

- BUS: `this.emitPluginEvent(type, detail)` (plugin-only) or `this.broadcast(type, detail)` (plugin + DOM). QUERIES (sync, manifest-routed): `this.grid.query(query)` invokes only plugins declaring that query type. DIRECT: `this.grid.getPluginByName('multiSort')` / `this.getPlugin(MultiSortPlugin)`.
- INVARIANT: `grid.query<T>(type, ctx)` ALWAYS returns `T[]` — and `[]` is **truthy**. A yes/no query MUST use `BaseGridPlugin.queryBoolean(type, ctx)` (`.some(Boolean)`), never `if (this.grid.query(...))`. DECIDED (#430): this bit twice — `TreePlugin.requestLazyChildren` always took the ServerSide branch (so `loadChildren` never ran) and `MasterDetailPlugin` always fired `datasource:fetch-children` (permanent detail spinner). Audit every new `query()` used as a condition. File: [base-plugin.ts](libs/grid/src/lib/core/plugin/base-plugin.ts).
- INVARIANT: events = one-way notifications; queries = sync state retrieval within a lifecycle phase.
- DECIDED (#284): promote an existing `emit()` to `broadcast()` for cross-plugin coordination instead of inventing a parallel plugin-bus event. `EditingPlugin#startRowEdit`/`#exitRowEdit` broadcast `edit-open`/`edit-close` so SelectionPlugin can `this.on('edit-open', …)` in row mode.
- DECIDED (#314, cross-plugin enrichment query): a query owned by NEITHER side. `QUERY_COLLECT_HEADER_ROWS` (`'collectHeaderRows'`) + `CollectHeaderRowsContext{columns}` + `HeaderRowContribution{cells:{label,span,source?,meta?}[]}` live in `core/plugin/types.ts`. GroupingColumnsPlugin answers with merged spans aligned to `context.columns`; ExportPlugin emits Excel `<Row>`s with `ss:MergeAcross` and wraps JSON as `{headerRows, rows}` when contributions exist (CSV stays flat). `includeHeaders: false` skips leaf + contributed rows (all-or-nothing). User filter is per-cell `processHeaderRow(cell, rowIndex) => HeaderRowCell | null` (null blanks but preserves span; the row drops only when every cell blanks). Excel style `excelStyles.groupHeaderStyle` (fallback `headerStyle`). RULE: inter-plugin enrichment whose reply shape a THIRD plugin could produce → query + reply types in `core/plugin/types.ts`. Tests: `export-grouping-integration.spec.ts`.
- DECIDED (Jul 2026, clipboard↔editing decouple): clipboard's `defaultPasteHandler` (`plugins/clipboard/types.ts`) MUST NOT read editing-owned `column.editable`/`rowEditable`. It queries `grid.query<CellEditablePredicate>('getCellEditableResolver')` ONCE and calls the returned `(field, row) => boolean` per cell (one dispatch, not per-cell dispatch — keeps big pastes cheap). EditingPlugin declares the query and returns a predicate wrapping `#isCellEditable` (rowEditable gate + `editable` true/false/function, so row-conditional editability is honored). `CellEditablePredicate` lives in `core/plugin/types.ts`, re-exported from the `core/plugin/index.ts` barrel but NOT from `public.ts` (internal contract). No editing plugin → query unanswered → predicate defaults to `() => false` → paste no-op. RULED OUT: the earlier column-level `getEditableFields → string[]` query (cannot express row-conditional editability). Tests: `editing-integration.spec.ts`.
- DECIDED (Jul 2026, `updateRow` routes through data plugins): core `RowManager.updateRow`/`updateRows` ([row-manager.ts](libs/grid/src/lib/core/internal/row-manager.ts) `#applyRowChanges`) dispatch a `commitCellValue` query PER changed field BEFORE mutating, so programmatic mutations get the same validation/dirty/history/abort semantics as an interactive edit. Contract `CommitCellValueContext{rowIndex,rowId,field,oldValue,newValue,source}` in `core/plugin/types.ts`. Response: `false` = vetoed (skip field); `true` = plugin applied + tracked (core does not re-apply); `undefined` = core applies in place + `invalidateAccessorCache`. Core ALWAYS emits `cell-change` per changed field, then schedules `RenderPhase.VIRTUALIZATION`. EditingPlugin answers via `#handleCommitCellValue` (returns `undefined` if row/column unresolvable, else runs `#commitCellValue` and returns `row[field] === newValue`). `UpdateSource` `'history'` applies the value + recomputes dirty but records NO history — breaks the undo→updateRow→commit→record→undo loop (UndoRedo `#applyValue` calls `updateRow(id, changes, 'history')`). INVARIANT: `updateRow` MUST NOT gate editability (server sync writes read-only columns); editability filtering stays in clipboard. Tests: `editing-integration.spec.ts > programmatic mutation routing via updateRow`.
- DECIDED (Jul 2026, `cell-commit` re-entrancy self-guard): `#commitCellValue` ([EditingPlugin.ts](libs/grid/src/lib/plugins/editing/EditingPlugin.ts)) tracks in-flight commits in `#committingCells: Set<string>` keyed `` `${rowId ?? rowIndex}\0${field}` ``, adding the key around the cancelable `cell-commit` emit in try/finally. A nested commit for a cell ALREADY in the set (a `cell-commit` listener cascading via `updateRow` back into the SAME cell) RETURNS EARLY; the outer commit still applies the value and emits `cell-edit-committed` exactly once. WHY early-return not fall-through: re-applying would fire a duplicate `cell-edit-committed` (phantom UndoRedo entry — UndoRedo auto-records with no de-dupe) and would sneak the value in even after `preventDefault()`. Without the guard, a listener calling `updateRow` recurses forever (`RangeError: Maximum call stack size exceeded`). Per-(row,field) keying keeps cascades to OTHER cells working. Consumers need no re-entrancy flag of their own. RULED OUT: adding `source` to `CellCommitDetail` for a consumer-side `source !== 'user'` check (burdens every consumer). Tests: `editing-integration.spec.ts > … does not recurse when a cell-commit listener calls updateRow for the same cell` (+ the `preventDefault` sibling).
- DECIDED (#272, plugins read their own light-DOM attrs): core `parseLightDomColumns` (`core/internal/columns.ts`) writes ONLY structural fields (`field`, `type`, `header`, `sortable`, `width`, `minWidth`, `resizable`, `options`, `__viewTemplate`, `__headerTemplate`) plus `ColumnInternal.__element?: HTMLElement` (the source element). It no longer writes plugin-owned `editable` / `__editorTemplate` / `__editorName`. Each plugin reads its own attributes from `col.__element` inside its EXISTING `processColumns` hook: EditingPlugin → `editable` + `<tbw-grid-column-editor>`; PinnedColumnsPlugin → `pinned` (`left/right/start/end`); VisibilityPlugin → `hidden`/`lock-visible`. WHY: keeps attribute knowledge out of core (−304 B raw / −52 B gz).
  - INVARIANT: an attribute is INITIAL state only. PinnedColumns and Editing seed each `__element` ONCE (WeakSet `#seededFromAttr`, reset in `detach()` so re-attach re-seeds) so a runtime change back to a falsy value (e.g. `setPinPosition(…, undefined)` does `delete col.pinned`) is not re-applied next render — a plain `== null` guard would re-pin/re-enable. On the seeding pass a config value still wins via `col.pinned == null` / `col.editable == null`. VisibilityPlugin instead writes falsy rather than deleting. Treat `attr="false"` as not-set for booleans.
  - The `type` allowlist gate is DROPPED (any custom type string passes through). Dead `__editorName`/`__rendererName` (+ `ColumnParsedAttributes`, the never-read `renderer=""` attribute) removed. `__element` is NOT auto-copied by `mergeColumns`' programmatic+DOM branch (explicit field enumeration) → copied explicitly there and in the domMap merge branch; preserved by `#cloneConfig` spread and `#mergeColumnsPreservingOrder`. The adapter editor path (`editorAdapter.createEditor`) STAYS in core. Tests: `columns.spec.ts`, `pinned-columns.spec.ts`, `visibility-plugin.spec.ts`, `editing-integration.spec.ts`, config-precedence integration.

## scroll dispatch

- FLOW: faux-scrollbar `scroll` → rAF batcher → `#onScrollBatched(scrollTop)` → geometry reads → `refreshVirtualWindow` → `onScrollRender` → pooled `ScrollEvent` → `pluginManager.onScroll` (gated by `#hasScrollPlugins`) → public `tbw-scroll` CustomEvent (always).
- INVARIANT: geometry reads (`scrollHeight`/`clientHeight`) MUST precede any DOM write in the same tick (forced-sync-layout avoidance). They are unconditional — the public event needs them too.
- INVARIANT: the pooled `#pooledScrollEvent` is reused across ticks (safe only for synchronous internal consumers); the public `tbw-scroll` detail MUST be a fresh literal.
- INVARIANT: public dispatch is gated by `#connected` via the `#emit` helper — no events after removal from the DOM.
- DECIDED (#234): `tbw-scroll` is always-on and vertical-only. `direction: 'vertical' | 'horizontal'` is declared for forward compatibility; horizontal dispatch is intentionally unimplemented (the horizontal listener stays behind `#hasScrollPlugins`). Adapter prop names are disambiguated (`onTbwScroll` / `tbwScroll` / `@tbw-scroll`) to avoid colliding with the native scroll event.
