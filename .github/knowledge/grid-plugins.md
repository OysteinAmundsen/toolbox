---
domain: grid-plugins
related: [grid-core, grid-features]
---

# Grid Plugins — Mental Model

## plugin-manager

- OWNS: plugin instances (array order), hook caches (sorted by priority), renderer/editor registries, event bus, query handlers
- READS FROM: plugin manifests (dependencies, incompatibilities, hookPriority, queries)
- WRITES TO: cached hook presence flags, cellRenderers/headerRenderers/cellEditors maps
- INVARIANT: plugins execute in array order by default; `manifest.hookPriority` overrides (lower = earlier). When a hook needs DOM from another plugin's same hook, raise the dependent plugin's `hookPriority` value (runs later) OR defer with `queueMicrotask()`. Same for `processColumns` — PinnedColumnsPlugin uses `{processColumns: -10}` so reorder happens before TreePlugin wraps columns.
- INVARIANT: dependencies validated on attach; incompatibilities warned at runtime (dev only). One PluginManager per grid; plugins are stateful singletons.

## plugin-lifecycle

- FLOW: attach(grid) → merge defaults + user config → store grid ref → onPluginAttached() notifications → [runtime hooks] → detach() → abort signal fires → cleanup
- INVARIANT: disconnectSignal (AbortSignal) fires on detach — use for all event listener cleanup
- INVARIANT: plugin.grid is available after attach(), null after detach()
- DECIDED: prefer config-driven init over post-ready imperative setup. Known-at-config-time resources (e.g. data source) accept config prop + auto-init in `attach()`. Reserve imperative methods (`setDataSource()`) for runtime swaps only. Pattern: ServerSidePlugin reads `config.dataSource` in `attach()`.
- DECIDED (Feb 2026, dead-config audit): key declared on `*PluginConfig` + set in `defaultConfig` + listed in README/MDX with ZERO consumers → **dead**, MUST remove (not "reserved for future use"). Sweep: grep `this.config.<key>` AND `config.<key>` AND `gridConfig.<key>` across plugin dir + core. Removed this pass: `visibility.allowHideAll`, `master-detail.collapseOnClickOutside`, `filtering.{trimInput,useWorker}`. PENDING: `pinned-rows.{showRowCount,showSelectedCount,showFilteredCount}` (alive in `pinned-rows.ts:54,62,70`; removal needs synthesizing default `slots: []`).

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

- INVARIANT (`renderRow` contract): when a plugin's `renderRow` takes over cell creation (Pivot, GroupingRows, Tree custom rows, MasterDetail panels), grid's normal cell pipeline is **skipped entirely**. Column-level features — `format`, `cellRenderer`, `cellClass`, value-accessor caching, sanitize wrapping — MUST be applied manually. Canonical re-application pattern: `core/internal/rows.ts` cell render path. Forgetting = silent formatter loss inside grouped/pivot rows.

### State Persistence Hooks

- getColumnState() → return plugin column-specific state for save
- applyColumnState() → restore from load
- INVARIANT: plugins owning sort (MultiSortPlugin) must broadcast `sort-change` from `applyColumnState` so consumers see restored state. Deferred via microtask to batch per-column calls.
- DECIDED (Apr 2026, plugin-side render-trigger): when plugin owns state core's `#applyColumnState` width-only fast-path can't observe (plugin nulled `_sortState`), plugin — not core — forces re-render after restore. MultiSortPlugin: snapshots model at batch start; in deferred microtask compares prev vs current; if changed, broadcasts `sort-change` AND `this.requestRender()` (ROWS). Covers sort-add (incoming `state.columns[i].sort` triggers core fast-path bypass via `incomingHasSort`) AND sort-removal. WHY: `hasOwnedSort` core query costs ~30 bytes (over budget). Pattern: any plugin mutating owned state during `applyColumnState` must self-trigger render.

## inter-plugin-communication

- BUS: `this.emitPluginEvent(type, detail)` (plugin-only) or `this.broadcast(type, detail)` (plugin + DOM). QUERIES (sync, manifest-routed): `this.grid.query(query)` invokes only plugins declaring the query type. DIRECT: `this.grid.getPluginByName('multiSort')` / `this.getPlugin(MultiSortPlugin)`.
- INVARIANT: events = one-way notifications; queries = sync state retrieval. PATTERN: events for state broadcasts (`sort-change`, `filter-change`); queries for reads within a lifecycle phase.
- DECIDED (May 2026, #284): promote existing `emit()` events to `broadcast()` for cross-plugin coord, don't invent parallel plugin-bus events. `EditingPlugin#startRowEdit`/`#exitRowEdit` `emit('edit-open'/'edit-close')` → `broadcast(...)` so SelectionPlugin can subscribe via `this.on('edit-open', ...)` in row mode. RULE: before adding a new event for inter-plugin coord, check if existing `emit()` covers the moment; promote first.
- DECIDED (May 2026, #314, cross-plugin enrichment query): generic query owned by neither side. `QUERY_COLLECT_HEADER_ROWS` ('collectHeaderRows') in `core/plugin/types.ts` + `CollectHeaderRowsContext{columns}` + `HeaderRowContribution{cells:{label,span,source?,meta?}[]}`. GroupingColumnsPlugin declares query, replies with merged spans aligned to `context.columns`. ExportPlugin: Excel `<Row>`s with `ss:MergeAcross`; JSON gets `{headerRows, rows}` envelope when contributions exist (back-compat); CSV stays flat. `includeHeaders: false` skips leaf + contributed (all-or-nothing). User filter is per-cell `processHeaderRow(cell, rowIndex) => HeaderRowCell | null` (null blanks, preserves span; row dropped only when every cell blank). RULE: inter-plugin enrichment with reply shape a third plugin could produce → query + reply types in `core/plugin/types.ts`, not either plugin. Tests: `export-grouping-integration.spec.ts`. Excel style: `excelStyles.groupHeaderStyle` (fallback `headerStyle`).
- DECIDED (Jun 2026, prep for #272/#273, clipboard↔editing decouple): clipboard's `defaultPasteHandler` (plugins/clipboard/types.ts) MUST NOT read editing-owned `column.editable` directly. Asks `grid.query<string[]>('getEditableFields', {columns})` instead. EditingPlugin declares `{type:'getEditableFields'}` in manifest.queries + answers in `handleQuery` with field names where `editable === true` (function-typed/row-conditional editable EXCLUDED — no row context). Contract `GetEditableFieldsContext{columns}` lives in `core/plugin/types.ts` (owned by neither plugin, same rule as collectHeaderRows). No editing plugin loaded → empty response → paste targets nothing (was: relied on `col.editable===true` which is `undefined` without editing → same no-op, so zero behavior change). Tests: editing `getEditableFields` case in `editing-integration.spec.ts`; clipboard mock grid grows a `query` stub.
- DECIDED (Jun 2026, #272, plugins read own light-DOM attrs): core `parseLightDomColumns` (core/internal/columns.ts) NO LONGER parses plugin-owned attributes. It exposes the source element via `ColumnInternal.__element?: HTMLElement` (core/types.ts) and writes the structural fields it already owned (`field`, `type`, `header`, `sortable`, `width`, `minWidth`, `resizable`, `options`, `__viewTemplate`, `__headerTemplate`) plus `__element`; it STOPS writing plugin-owned `editable` / `__editorTemplate` / `__editorName`. Each plugin reads its own attributes from `col.__element` inside its EXISTING `processColumns` hook. WHY: keeps editing/pinned/visibility attribute knowledge out of core; shrinks index.js (−304 B raw / −52 B gz). Migrations: EditingPlugin reads `editable` (+`<tbw-grid-column-editor>` template); PinnedColumnsPlugin reads `pinned` (`left/right/start/end`); VisibilityPlugin reads `hidden`/`lock-visible`. INVARIANT: attribute = INITIAL state only. BOTH PinnedColumnsPlugin and EditingPlugin seed each `__element` ONCE (WeakSet `#seededFromAttr`, reset in `detach()` so a re-attached instance re-seeds) so a runtime change back to a falsy value (e.g. pinned `setPinPosition(...,undefined)` does `delete col.pinned`) is NOT re-applied next render — a plain `== null` guard would re-pin/re-enable. On the first (seeding) pass a config value still wins via `col.pinned == null` / `col.editable == null`. VisibilityPlugin relies on its runtime "off" writing a falsy value not delete (`col.hidden === undefined`, unhide writes `hidden=false`); treat `attr="false"` as not-set for booleans. The `type` allowlist gate is DROPPED — any custom/plugin type string passes through. Dead `__editorName` AND `__rendererName` (incl. the empty `ColumnParsedAttributes` type and the never-read `renderer=""` string attribute) removed — zero readers; the real renderer paths are the `renderer`/`viewRenderer` config FUNCTION and adapter `<tbw-grid-column-view>` templates. `__element` is NOT auto-copied by `mergeColumns` programmatic+DOM branch (explicit field enumeration) → copied explicitly there + in the domMap merge branch; preserved by `#cloneConfig` spread + `#mergeColumnsPreservingOrder`. Adapter editor path (`editorAdapter.createEditor`) STAYS in core — only the `__editorTemplate` assignment moved to editing. Tests: `columns.spec.ts`, `pinned-columns.spec.ts`, `visibility-plugin.spec.ts`, `editing-integration.spec.ts`, `config-precedence` integration.

## event-registry (DataGridEventMap)

- OWNS: `DataGridEventMap<TRow>` in `libs/grid/src/lib/core/types.ts` is the SSOT for DOM-visible grid events. Plugin events via `declare module '../../core/types' { interface DataGridEventMap { 'foo-bar': FooBarDetail; } }` in plugin's `types.ts`. `keyof DataGridEventMap<TRow>` is canonical event-name list.
- INVARIANT: emit-site and registry MUST agree — unregistered `_emit('foo-bar')` succeeds at runtime but adapter satisfies-guards reject the prop. NEVER add synthetic event name just to silence a guard error — lying misleads `addEventListener` typing across all adapters.
- DECIDED (May 2026): `DGEvents` / `PluginEvents` in `libs/grid/src/public.ts` are `@deprecated` (hand-maintained string mirrors of `DataGridEventMap` that drifted: 7 stale entries in `PluginEvents`; `CLIPBOARD_COPY` should have been `COPY`). Kept as stubs; removed in future major. Use `keyof DataGridEventMap` for unions + string literals for individual names.
- DECIDED (May 2026): `'column-visibility'` emitted from `config-manager.ts` (`setColumnVisible`/`toggleColumnVisibility`/`showAllColumns`) but visibility plugin only registered `'column-reorder-request'`. Registered `'column-visibility': ColumnVisibilityDetail` in `plugins/visibility/types.ts`. LESSON: register EVERY event the plugin OR its core helpers emit — visibility flows through `config-manager` (core).

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

- DECIDED (#372): `PluginDependency` gained `when?: (pluginConfig: unknown) => boolean` (config-conditional, skip dep when false) and `severity?: 'error'|'warn'|'info'` on top of `name`/`required`/`reason`. `validatePluginDependencies` (core/internal/validate-config.ts) evaluates `dep.when(plugin.resolvedConfig)` FIRST, then resolves effective severity = `dep.severity ?? (required ? 'error' : undefined)`. Dispatch: error→throwDiagnostic(`MISSING_DEPENDENCY`/TBW020), warn→warnDiagnostic(`OPTIONAL_DEPENDENCY`/TBW021), info→debugDiagnostic(TBW021). Default reason verb is severity-driven: error→"requires", warn/info→"recommends". WHY: lets a plugin recommend another only under certain config (e.g. Pivot needs shell host only when `showToolPanel===true`); warn/info are soft so they use the optional-dependency code + "recommends" wording. INVARIANT: validation runs BEFORE `plugin.attach()` (plugin-manager.ts attach() L167 before L194), so `plugin.config` is NOT merged yet — `when` reads `BaseGridPlugin.resolvedConfig` getter (`@internal`, base-plugin.ts). `resolvedConfig` returns `this.config` only while ATTACHED (gated on `#abortController`, set in attach/cleared in detach) else recomputes `{...defaultConfig, ...userConfig}` — `detach()` does NOT clear `this.config`, so trusting it when detached would leak stale config into a re-validation. INVARIANT: omitted `severity` preserves legacy behavior — hard dep throws, soft dep (`required:false`) stays SILENT (not 'info'); warn/info fire dev-only (`isDevelopment()`), matching configRules/incompatibilities. Tests: validate-config.spec.ts `config-conditional dependencies` + `explicit severity` (mocks `extends BaseGridPlugin`, no `as unknown as`).

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

## scroll-dispatch

- FLOW: faux-scrollbar `scroll` event → rAF batcher → `#onScrollBatched(scrollTop)` → geometry reads (unconditional) → `refreshVirtualWindow` → `onScrollRender` → pooled `ScrollEvent` → `pluginManager.onScroll` (gated by `#hasScrollPlugins`) → public `tbw-scroll` CustomEvent (always)
- INVARIANT: geometry reads (`scrollHeight`/`clientHeight` etc.) MUST happen before any DOM writes in the same tick to avoid forced synchronous layout. Reads moved out of the `#hasScrollPlugins` gate when `tbw-scroll` shipped — they are now unconditional because the public event needs them too.
- INVARIANT: pooled `#pooledScrollEvent` is reused across ticks — only safe for synchronous internal plugin consumers. Public `tbw-scroll` detail MUST be a fresh literal (consumers retain references).
- INVARIANT: public dispatch is gated by `#connected` via `#emit` helper — events do not fire after the grid is removed from the DOM.
- DECIDED (Apr 2026, #234): `tbw-scroll` is always-on, vertical-only, fresh detail per dispatch. `direction: 'vertical' | 'horizontal'` declared up-front for forward compatibility; horizontal dispatch intentionally not implemented (horizontal scroll listener still gated behind `#hasScrollPlugins`). Adapter prop names disambiguated (`onTbwScroll` / `tbwScroll` / `@tbw-scroll`) to avoid native scroll-event collision.

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

## all-plugins (25 total, categorized)

### Row-Transforming (modifiesRowStructure: true)

**ServerSide** — OWNS: fetch cache, lazy blocks, placeholder nodes (`{__loading:true,__index}`), `managedNodes`, `blockControllers: Map<number,AbortController>`. HOOKS: processRows(-10) — IGNORES input, returns `managedNodes` (length-clamped to viewport). EVENTS: datasource:data/children/loading/error. QUERIES: datasource:fetch-children, datasource:is-active. LISTENS: sort-change, filter-change.

- INVARIANT: `totalNodeCount=-1` activates infinite scroll; `0` = unknown; short block auto-detects end. `grid.sourceRows` stays empty. `onModelChange` MUST call `loadRequiredBlocks()` after cache clear. Block resolution with `previousManagedLength === 0` OR `managedNodes.length < totalNodeCount` MUST `requestRender()` ROWS (not `requestVirtualRefresh()` — skips processRows). `loadRequiredBlocks()` expands viewport by `loadThreshold` rows both dirs before computing blocks.
- DECIDED (Apr 2026): core `applySort`/`grid.sort()` emits `sort-change` to BOTH DOM and plugin bus via `_pluginManager.emitPluginEvent`. WHY: ServerSide otherwise misses without MultiSort. `setDataSource()` calls `loadRequiredBlocks()` after initial block only when `loadThreshold > 0` (else breaks ~12 tests; preserves "first fetch = block 0").
- DECIDED (Apr 2026, AbortSignal + Subscribable): `getRows()` receives non-aborted `AbortSignal` on `params.signal` (REQUIRED). Return `Promise<GetRowsResult>` OR `Subscribable<GetRowsResult>` (duck-typed `{subscribe(observer):{unsubscribe()}}` — no RxJS dep). Per-block `AbortController` aborted on `setDataSource`/`refresh`/`purgeCache`/`onModelChange`/`detach`. `toResultPromise`: Subscribables subscribe once, settle on `next`, unsubscribe on error/complete/abort (cancels Angular HttpClient XHR without `firstValueFrom`/`takeUntil`). Promise sources defensively rejected with `DOMException('Aborted','AbortError')`. Result-shape guard drops stored result if abort lands before `loadedBlocks.set`. `setDataSource()` adds block 0 to `loadingBlocks` (parallel scroll-triggered call won't double-fetch). RULED OUT: separate `fromObservable` adapter helper (polymorphic core ~30 LoC cleaner). Files: `server-side/datasource.ts`, `ServerSidePlugin.ts` (`abortAllBlocks`). Tests: `server-side.spec.ts` (AbortSignal + Subscribable).
- DECIDED (Feb 2026, pageSize canonical): `ServerSideConfig.pageSize` documented; `cacheBlockSize` `@deprecated` alias. Resolve at consumption: `this.config.pageSize ?? this.config.cacheBlockSize ?? 100`. `defaultConfig` MUST NOT set `pageSize` (would outrank legacy specs setting only `cacheBlockSize`). `GetRowsParams.pageSize: number` (= `endNode - startNode`) for REST `?start=0&pageSize=100`. Test: `server-side.spec.ts > loadBlock`.
- DECIDED (Jun 2026, #273, declarative `data-src` host attr): plugins may read host-level `data-*` attributes off the `<tbw-grid>` element in `attach()` via `this.gridElement.getAttribute('data-*')`. ServerSide is the proof: when no JS `config.dataSource`, `attach()` reads `data-src` and calls `setDataSource(createUrlDataSource(src))`. `createUrlDataSource(url)` (server-side/datasource.ts, `@internal`) = fetch-once-on-success-and-cache: fetches the URL with `params.signal`, accepts a plain array (`totalNodeCount=length`) OR `{rows,totalNodeCount}` envelope (honours `totalNodeCount`), then slices per `getRows` block from the cached dataset. A failed/aborted fetch is NOT cached (`datasetPromise=null` in `.catch`) — otherwise the rejected promise would poison every later block load (plugin aborts in-flight blocks on sort/filter/refresh via `abortAllBlocks()`), leaving the grid blank. Enables a zero-JS server-fetched grid from static HTML. INVARIANT: host `data-*` read is INIT-TIME ONLY — `observedAttributes` is a static class getter (`['rows','columns','grid-config','fit-mode','loading']`) so per-plugin host attrs CANNOT be reactive without a per-plugin MutationObserver; the JSON `grid-config` attr / JS property remain the reactive escape hatch. `data-*` namespace avoids colliding with core reactive attrs. JS `config.dataSource` ALWAYS wins over `data-src`. Zero core-bundle delta (lives in server-side plugin chunk). NOT for true server pagination/remote sort-filter — use a `dataSource` callback. Tests: `server-side.spec.ts > createUrlDataSource` + `> data-src host attribute (declarative)`. FOLLOW-UP (#369 review): `FeatureConfig.serverSide` widened `ServerSideConfig` → `boolean | ServerSideConfig` so `features:{serverSide:true}` is type-valid (was the lone object-only feature among 18 `boolean|XxxConfig` siblings); factory normalizes `if (config===true) new ServerSidePlugin()`. This is what makes the zero-JS `data-src` example (`{"features":{"serverSide":true}}`) compile. NOTE: spreading a boolean in `BaseGridPlugin` (`{...true}`) yields `{}`, does NOT throw (registry treats any truthy feature value as enabled). Test: `server-side.spec.ts > serverSide feature boolean shorthand`.
- TENSION: tall grid + small `cacheBlockSize` + no threshold still needs scroll to fill viewport.

**Tree** — OWNS: expanded keys, flattened rows, row key map (`Map<key,FlattenedTreeRow>`), per-row metadata (`WeakMap<row,FlattenedTreeRow>`), per-row stable keys (`WeakMap<row,string>`), animation state, loading keys. HOOKS: processRows(10), processColumns, afterCellRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart. QUERIES: canMoveRow, datasource:viewport-mapping, sort:get-model. EVENTS: tree-expand. FIRES: datasource:fetch-children (on expand of lazy nodes).

- INVARIANT: lazy children signaled by truthy non-array childrenField value (e.g. `children: true`); child rows are single-batch (no pagination).
- INVARIANT (row-identity): `processRows` returns user's source row references — never spread/clones. Decoration (depth, key, hasChildren, isExpanded) lives in `#rowMeta` WeakMap keyed by row identity; renderer reads via `getRowMeta(row)`. Stable keys live in `#rowKeys` WeakMap. Path-based keys assigned in _unsorted_ order before `#sortLevel` so they match `expandAll`'s key generation.

- DECIDED (Apr 2026, row-identity — ALL row-model plugins): plugins MUST NOT spread/clone row objects in `processRows`. Output is either (a) `===` input refs, or (b) genuinely synthetic (group headers, pivot aggregates, ServerSide `__loading`/`managedNodes`). Decoration goes in parallel structures — `WeakMap<row,meta>` or wrappers (GroupingRows `RenderRow{kind:'data',row}`). WHY: `RowManager.updateRow` mutates `_rows[i]` in place; next ROWS rebuild re-runs `processRows` — clones discard the mutation. Symptoms: `cell-change.row` not `===` source; mutations vanish after filter; edit dirty resets. Audit: `expect(grid._rows[i]).toBe(sourceRows[i])`. Refs: `TreePlugin.ts` `#rowKeys`/`#rowMeta`; `tree-row-update.spec.ts`.
- DECIDED (Apr 2026, sortHandler dispatch — data-row sorts): plugins sorting USER DATA ROWS MUST resolve through `gridConfig.sortHandler ?? builtInSort` (mirrors core `applySort`). Async handlers can't be awaited in sync `processRows` → fall back to `builtInSort`. `builtInSort` honors per-column `sortComparator` + `valueAccessor`. EXCEPTIONS: GroupingRows (group nodes by agg value), Pivot (row-keys), clipboard/context-menu/excel-styles (indices). Rules: (1) pass shallow copy `[...rows]` when input could be user-owned (`TreePlugin#sortLevel` per-level `row.children`). ServerSide exempt (`managedNodes` is plugin-owned). (2) Promise-returning handler: `void result.catch(()=>undefined)` BEFORE returning sync fallback (else unhandled rejection). Do NOT splice resolved Promise back into `managedNodes` async (race with next `processRows`). Refs: `TreePlugin.ts#sortLevel`, `ServerSidePlugin.ts._localSort`. PENDING: MultiSort `sortRowsInPlace` ignores `sortHandler` (signature mismatch).
- DECIDED (Apr 2026, public sort API): `column.sortComparator` RECOMMENDED. `gridConfig.sortHandler` escape hatch only — bypassed by MultiSort, sees one field at a time. Server-side: `ServerSidePlugin` `dataSource.getRows({sortModel})`. WHY: `sortComparator` survives every sort path (core/multi-sort/tree/server-side `sortMode:'local'`) and composes. Doc steer: `core/types.ts` JSDoc, `apps/docs/.../multi-sort/index.mdx`.
- DECIDED (May 2026, #264 WAI-ARIA Treegrid): Tree or GroupingRows registered → swap `.rows-body` `role` from `grid` to `treegrid` + emit `aria-level`/`aria-setsize`/`aria-posinset` per visible row. WHY: `aria-expanded` on hierarchical rows only valid inside `treegrid`; SRs need "level 2, item 3 of 5". Both set role idempotently in `afterRender`, restore `role="grid"` in `detach()`. Tree: `posInSet`/`setSize` on `FlattenedTreeRow` (`tree-data.ts#flattenTree`, `TreePlugin.#flattenWithSort`). GroupingRows: parallel `flatMeta` array (`computeFlatMeta`) by flat index. `aria-multiselectable` valid on `treegrid` (SelectionPlugin unchanged). INVARIANT: `posInSet`/`setSize` is 1-based per parent (NOT global rowIndex). Tests: `tree-integration.spec.ts`, `grouping-rows-integration.spec.ts`, `tree-datasource.spec.ts#makeFlatRow`.

**GroupingRows** — OWNS: grouped row model, expanded keys, animation state. HOOKS: processRows(10), onHeaderClick(-1), renderRow. QUERIES: canMoveRow, grouping:get-grouped-fields, datasource:viewport-mapping. EVENTS: group-toggle/expand/collapse.

- DECIDED (May 2026, #335 deferred-expansion): `setGroupOn(fn, expanded?)` accepts `DefaultExpandedValue: boolean|number|string|string[]` seeding expansion against NEW group set on next rebuild. `expandAll`/`collapseAll` called immediately after `setGroupOn(fn)` ALSO defer (same `pendingExpansion` field) instead of reading stale `flattenedRows`. WHY: `setGroupOn` mutates config + `requestRender()`; `flattenedRows` rebuilds async in `processRows` — pre-fix `expandAll()` populated `expandedKeys` from previous grouping → new groups landed collapsed. Mechanism: `setGroupOn` sets `groupConfigDirty=true`; `expandAll`/`collapseAll` check flag, store `pendingExpansion` instead of touching `flattenedRows`; `processRows` snapshots+clears at top, resolves against fresh `getGroupKeys(initialBuild)`, applies unconditionally, broadcasts `group-toggle` once.
- INVARIANT: bulk `group-toggle` emissions (deferred-apply, `expandAll`, `collapseAll`) MUST use `broadcast<GroupToggleDetail>` not `emitPluginEvent` so DOM listeners see the change. `GroupToggleDetail.{key,expanded,value,depth}` are optional (bulk ops carry only `expandedKeys`). Tests: `grouping-rows-plugin.spec.ts` (5 cases for #335).

**Pivot** — OWNS: pivot result, flattened pivot rows, expanded keys, column totals, sort state. HOOKS: onHeaderClick(-10), processRows(100). QUERIES: sort:get-sort-config. EVENTS: pivot-toggle, pivot-config-change. INVARIANT: `PivotRow.isGroup` means "has sub-groups" (`remainingFields.length > 0`), NOT "is a group row" — single `rowGroupFields` produces `isGroup: false`; `getAllGroupKeys()` returns nothing for single-level pivots

### Column-Transforming

**PinnedColumns** — OWNS: pinned state per column. HOOKS: processColumns(-10), afterCellRender. TENSION: runs first to reorder before ColumnVirtualization.

- INVARIANT (sticky-cell painting): `.sticky-left`/`.sticky-right` carry opaque `background: var(--tbw-color-panel-bg)` (`core/styles/rows.css`) + `position: sticky; z-index: 25` (`core/styles/base.css`). Two consequences for row-level visuals:
  1. **Background tints** on `.data-grid-row` (`.row-focus`, `:hover`, `:nth-child(even)`) are HIDDEN under sticky cells. Re-paint with layered gradient: `background: linear-gradient(<tint>,<tint>), var(--tbw-color-panel-bg)`.
  2. **`::after` border overlays** are covered when `z-index ≤ 25`. Fix: bump row-level `::after` to `z-index: 26` (cell-level `::after { inset: 0 }` is clipped by `overflow: hidden`). Single overlay spans pinned + unpinned with perfect alignment. Canonical: `selection.css` `.data-grid-row.row-focus`.

**ColumnVirtualization** — OWNS: visible column subset based on scroll. HOOKS: processColumns

**Visibility** — OWNS: hidden column set. HOOKS: processColumns

**GroupingColumns** — OWNS: column groups structure. HOOKS: processColumns

### Selection & Navigation

**Selection** — OWNS: selected rows/cells, ranges, columns (Set\<field\>), activeAxis, mode (normalized). HOOKS: onCellClick, onRowClick, onHeaderClick, onKeyDown, afterCellRender, processColumns (checkbox column), afterRender, onScrollRender. EVENTS: selection-change. MODES: cell, row, range, column. Mode can be `SelectionMode | SelectionMode[]` — array form must contain `'column'` plus exactly one in-row axis.

- DECIDED (Feb 2026, #269, modes + storage + chord): `mode: SelectionMode | SelectionMode[]` enables column axis alongside in-row. Normalized at `attach()` into `NormalizedModeConfig { primary, columnEnabled, bothAxes }`. Validation throws on: empty, 3+ items, 2-element without `'column'`, duplicates, unknown. RULED OUT: `['cell','row']` (doesn't compose). Column selection stores **field names** (`Set<string>`) — survives pinning/reordering/virtualization/visibility. `clearSelectionSilent()` preserves `selectedColumns`. Row↔column mutual exclusion auto-handled inside `#buildEvent()`. Header chord: plain & plain-Shift+Click reserved for sort; **Ctrl/⌘+Click** toggles column, **Ctrl/⌘+Shift+Click** extends from anchor. Keyboard: **Ctrl/⌘+Space** toggles focused cell's column; **Ctrl/⌘+Shift+←/→** extends. Utility columns skip every column-axis path. Spec: `column-selection.ts`, `column-selection.spec.ts`.
- DECIDED (May 2026, #308 review): `selection-change.detail.selectedColumns` + `getSelectedColumns()` emit in **visible-column order**, not Set-insertion (would leak interaction history). `buildSelectionEvent` filters `selectableColumnFields(visibleColumns)`. `selectColumns` query batches via private `#setColumnSelection(fields)`: filter unknowns, set once, emit once, render once. `#applySelectionClasses()` MUST reset stale `aria-selected` on cells previously carrying `.selected`/`.column-selected`, **scoped** — clearing all wipes active-cell focused marker (e2e: `accessibility.spec.ts > keyboard navigation updates aria-selected`).
- DECIDED (May 2026, #284): clears selection when host swaps source `rows` to different size; gated on `data-change` with changed `sourceRowCount` (stored row indices resolve against post-processRows `_rows`). Closure-cached `lastSourceRowCount = -1`. In-place edits (same count) preserve. RULED OUT: clear on every `data-change` (wipes on cell edit); deep-equality (too expensive). Also auto-selects row entering edit in `mode: 'row'` so `getSelectedRows()` reflects what user edits. Listens `edit-open` (now `broadcast()`). Gating: skip if `mode !== 'row'`, if `isRowSelectable` false, if already selected. `multiSelect:false` replaces; else adds. NO `edit-close` listener (persists post-edit). Tests: `selection-editing-integration.spec.ts`.

### Editing & Undo

**Editing** — OWNS: active cell, editor snapshots, changed rows, dirty tracking. HOOKS: processColumns, processRows, afterCellRender, afterRowRender, onCellClick, onKeyDown. EVENTS: cell-commit, row-commit, edit-open/close. TENSION: must handle row re-sorting during edit (caches sort result)

- RULE: editor detection in `EditingPlugin` MUST use `closest(FOCUSABLE_EDITOR_SELECTOR)`, never `matches()`. Non-focusable editor descendants (`<option>` inside `<select>`, spans inside `contenteditable`) fail `matches()`.
- DECIDED (May 2026, #347, popup-`<select>` keyboard): `mode: 'grid'` ArrowUp/Down does not navigate cells when keydown target is inside editor descendant; Enter on popup-`<option>` must bail without `preventDefault`/`stopPropagation` (in BOTH `editor-injection.ts` host-keydown AND `EditingPlugin.onKeyDown`). WHY: Chromium `<select>` popup walks focus SELECT→OPTION→OPTION (flips `#gridModeInputFocused`); `preventDefault` blocks native popup commit. Fix: `focusout` keeps flag when `related.closest(FOCUSABLE_EDITOR_SELECTOR)` non-null; ArrowUp/Down branch uses `event.target.closest(...)` as fallback. Enter on focused editor (no popup) still commits + blurs + focuses grid (sets `#gridModeEditLocked=true`). RULE: editor-chain keydown handlers MUST NOT `stopPropagation` in grid mode. Tests: `editing-integration.spec.ts > ArrowDown originating from a focused <select> editor` / `> Enter on an <option>`.
- DECIDED (Apr 2026): row-mode `ArrowUp`/`Down` in `EditingPlugin.onKeyDown` MUST NOT commit + jump to adjacent row while a row is in edit mode. Returns `true` (handled, no-op) so focused editor consumes the key natively — number spinners, `<select>` traversal, `<textarea>` caret, MUI autocomplete/datepicker/combobox all rely on ArrowUp/Down. Users must Enter/Esc/Tab/click out before arrows resume cell nav. CONSISTENT WITH: `mode: 'grid'` when input focused, `editing && colType === 'select'` early return in `core/internal/keyboard.ts`, Excel/Sheets. Tests: `editing-integration.spec.ts > arrow keys while a row is in edit mode (row mode)`.
- DECIDED (#250 — portal-overlay editors): `keydown` handler in `editor-injection.ts` MUST short-circuit on `e.defaultPrevented` BEFORE inspecting `e.key`. WHY: portal pickers (EDS/Downshift, MUI date) call `e.preventDefault()` on option-confirming Enter; without guard, plugin treats Enter as "exit row edit" and tears editor down before picker's commit lands (surfaces as #250 row-recycle `removeChild`). Tests: `editor-injection.spec.ts`. Click-to-select on portal overlays still needs `registerExternalFocusContainer` (#251).
- DECIDED (#251 — overlay-editor parity): two mechanisms make portal editors work without per-library glue. (1) Generic `aria-expanded="true" + aria-controls=<id>` fallback: `editor-injection.ts` (host keydown) AND `EditingPlugin.onKeyDown` (Enter while row-editing) AND `EditingPlugin` document-pointerdown (outside-click) call `isInsideOpenAriaOverlay(target, scopeEl)` — walks `[aria-expanded="true"][aria-controls]` triggers in active row, resolves panel via `getElementById`, treats target as inside editor when panel contains it. (2) Explicit React opt-in: `ColumnEditorContext.grid` populated in `editor-injection.ts` from `deps.grid`. Editors call `ctx.grid.registerExternalFocusContainer(panel)` OR use `useGridOverlay(panelRef, {open})`. Tests: `editing-overlay-aria.spec.ts`, `use-grid-overlay.spec.tsx`.

**UndoRedo** — OWNS: undo/redo stacks. HOOKS: onKeyDown (Ctrl+Z/Y). DEPENDS: editing (required)

### Sorting & Filtering

**MultiSort** — OWNS: sortModel[], cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: sort:get-model, sort:set-model. EVENTS: sort-change. TENSION: caches sort during row edit to prevent edited row from jumping. INVARIANT: MultiSort is the authoritative sort source — Tree and GroupingRows must query `sort:get-model` when MultiSort is loaded, not maintain independent sort state (causes desync of sort indicators vs actual order)

**Filtering** — OWNS: filterModels Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: filter-change.

- INVARIANT: numeric ops (`greaterThan`/`>=`/`<`/`<=`/`between`) MUST exclude blank values (null/undefined/''/NaN) before coercion — JS implicit conversion leaks them (`null >= 0` true, `Number('') === 0`). Blanks match ONLY explicit `blank` operator. NaN treated as blank.
- DECIDED (Apr 2026): number filter panel's Apply clears filter when both bounds are still data-derived defaults — else `between(dataMin,dataMax)` silently excludes blank rows.
- DECIDED (Apr 2026): `getDataRows()` resolves unique-value source — prefers `sourceRows`, falls back to `grid.rows.filter(r => r.__loading !== true)` so ServerSide hosts get unique values from loaded blocks (excluding placeholders) without `valuesHandler`. Async `valuesHandler` remains canonical for full server-side dataset.

### Row Details

**MasterDetail** — OWNS: expanded rows, detail height, animation state. HOOKS: processColumns (expander), onCellClick, afterRowRender, getRowHeight, adjustVirtualStart. EVENTS: master-detail-toggle

- SHARED expander util `core/plugin/expander-column.ts` surface: `EXPANDER_COLUMN_FIELD`, `EXPANDER_COLUMN_WIDTH`, `isExpanderColumn`, `isUtilityColumn`, `findExpanderColumn`, `createExpanderColumnConfig`, `ExpanderColumnRenderer`. DECIDED (Jun 2026): `createExpanderContainer` + `EXPANDER_COLUMN_STYLES` removed — zero consumers (plugins build their own DOM; real styling is in the modular CSS layers). Do not reintroduce.

### Reordering

**ReorderColumns** — OWNS: column order, drag state, `BaseColumnConfig.lockPosition` augmentation. HOOKS: onCellMouseDown/Move/Up, afterRender. QUERIES: owns `canMoveColumn` (local check + aggregates `grid.query('canMoveColumn', column)` for vetoes from PinnedColumnsPlugin etc.).

- DECIDED: per-column lock = top-level `ColumnConfig.lockPosition` (sibling of `lockVisible`). Augmentation in `reorder-columns/types.ts`, NOT core. Legacy `meta.lockPosition`/`meta.suppressMovable` honored in `column-drag.ts#canMoveColumn` (top-level first).
- DECIDED: ReorderPlugin owns authoritative `canMoveColumn` query — other plugins (VisibilityPlugin panel-drag) MUST `grid.query<boolean>('canMoveColumn', column)`, treat any `false` as veto. Without ReorderPlugin: query returns `[]` (treat as non-reorderable). Plugin keeps eager local check so test mocks (`query: () => []`) work.
- DECIDED: all column-level flags top-level on `ColumnConfig` via module augmentation from owning plugin's `types.ts` — never `meta.<flag>`, never directly in core. Flags: `lockVisible` (core), `lockPosition` (reorder-columns), `lockPinning`/`pinned` (pinned-columns), `utility` (public, core), `checkboxColumn` (`@internal`, selection), `group` (grouping-columns).
- INVARIANT: plugin-owned flags MUST NOT appear on `grid.getAllColumns()` projection — only grid-universal fields (`field`, `header`, `visible`, `lockVisible`, `utility`). Plugins read raw config via `this.grid.columns.find(c => c.field === ...)`. Keeps core bytes proportional to grid-universal concerns.
- INVARIANT: new query type costs ZERO core bytes (string-routed via `manifest.queries`). Core growth = JSDoc on public type OR field added to a projection.
- DECIDED (Apr 2026): `ColumnConfig.utility` is **public** (was `@internal`). Umbrella "system column" flag (selection checkbox, expander, drag handle, action menu). Honored by Visibility (chooser filter), Reorder (`canMoveColumn` false), Print (hidden unless `printHidden: false`), Clipboard/Export (`resolveColumns()` skips), Selection (clicks ignored), Filtering (no filter UI). Convention: prefix `__`.

**ReorderRows** — OWNS: row order, drag state. HOOKS: onCellMouseDown/Move/Up. QUERIES: canMoveRow

**RowDragDrop** (#225) — OWNS: row order + cross-grid drag/drop session. ALIASES: `reorderRows`, `rowReorder` (legacy). HOOKS: processColumns (drag-handle col), onKeyDown (Ctrl+arrow), onCellClick, delegated dragstart/over/leave/drop/dragend. QUERIES: canMoveRow. EVENTS: row-move (back-compat), row-drag-start (cancelable), row-drag-end, row-drop (cancelable), row-transfer (both source + target). USES: `core/internal/drag-drop-registry.ts` (WeakRef session map shared across split bundles) + `plugins/shared/drag-drop-protocol.ts` (MIME constants, payload codec, drop-position math, auto-scroller, current-session tracker for sync canDrop).

- DECIDED (#225, alias rules): `reorder-rows/index.ts` MUST NOT re-export `ROW_DRAG_HANDLE_FIELD`/`RowMoveDetail` (collides in `all.ts`). Only `RowReorderPlugin` + `RowReorderConfig` re-exported. UMD/ESM bundle inlines full `RowDragDropPlugin` (~16 kB / 5.4 kB gz) — Vite `externalizeCore` only externalizes `../../components/`/`../../../`. Both under 50 kB plugin budget. Alias dedup in `PluginManager#collapseAliasDuplicates` keyed by **constructor identity**, not plugin name. Configs merge via `BaseGridPlugin.mergeConfigsFrom`: silent on equal scalars/refs, warns TBW023 once on dedupe, throws TBW025 on conflict. Dedup warning silenced under `import.meta.env.PROD`.
- DECIDED (#225, session lookup): Same-window cross-grid uses `currentSession` (module-level singleton in `shared/drag-drop-protocol.ts`) for sync `canDrop` during `dragover` (where `dataTransfer.getData()` returns `''`). Cross-window falls back to JSON via `dataTransfer.getData(TBW_ROW_DRAG_MIME)` + `deserializeRow`. WeakRef registry matters only for live-object recovery on **drop**.
- DECIDED (Apr 2026, cross-window via `BroadcastChannel`): target window can only mutate its own `document`; `document.getElementById(payload.sourceGridId)` returns null cross-window — legacy code silently no-op'd source-side removal + `row-transfer` + `dragAccepted` flip. Fix: module-level `BroadcastChannel('tbw-row-drag-drop')` shared by all plugin instances. After successful cross-grid drop where `findPeerOnGrid(payload.sourceGridId) === null`, target broadcasts `tbw-row-drag-drop:transfer` `{sourceGridId,toGridId,dropZone,rowIndices,toIndex,operation,serializedRows}`. Instances filter by matching `sourceGridId` + `dropZone`, run source-side path. Channel lazy + ref-counted + closed on last detach. INVARIANT: origin-scoped — cross-origin cannot coordinate; when undefined (old browsers, sandboxed iframes), target receives rows but source untouched — `row-transfer` is authoritative success signal. Same-window peer path preserved via sync `findPeerOnGrid`. Tests: `row-drag-drop.spec.ts > cross-window transfer (BroadcastChannel)`.
- DECIDED (Apr 2026, `dragFrom` + row-clone drag image): `dragFrom?: 'handle'|'row'|'both'` (default `'handle'`). `'row'` hides handle col unless `showDragHandle` explicit. `applyRowDraggable()` called from BOTH `afterRender` AND `onScrollRender` (recycling loses `draggable="true"`).
- INVARIANT: interactive descendants (`button,input,select,textarea,a[href],[contenteditable]`) never start drag — `INTERACTIVE_DRAG_SELECTORS` in `isInteractiveDragOrigin()`.
- INVARIANT (CSS-scoping): row-clone for `setDragImage` MUST be appended INSIDE `this.gridElement`, NOT `document.body` (all `core/styles/*.css` scoped under `tbw-grid{…}` + `--tbw-column-template` on host — body clone collapses). Clone `position:fixed; top/left:-10000px`, removed in `setTimeout(0)`. Do NOT add `opacity`/`box-shadow` (browser already ~70% translucency; multiplies; box-shadow blur captures as horizontal fade). Tests: `row-drag-drop.spec.ts`.

### Display

**Responsive** — OWNS: breakpoint-based column visibility. HOOKS: processColumns, getRowHeight.

- INVARIANT: column header _row_ ALWAYS hidden in card mode (unconditional CSS `tbw-grid[data-responsive] .header { display: none }`). `hideHeader` config does NOT control that — it gates per-card _field labels_ (`Name:` `::before` prefix).
- DECIDED (May 2026): `hideHeader` default = `false` (labels visible). Plugin sets `data-responsive-hide-header` on host in `#applyResponsiveState()` only when `isResponsive && hideHeader === true`; CSS `tbw-grid[data-responsive][data-responsive-hide-header] .data-grid-row:not(.group-row) > .cell::before { display: none }`. Attribute cleared leaving card mode. Files: `ResponsivePlugin.ts`, `responsive.css`.

**Tooltip** — OWNS: active tooltip, positioning. HOOKS: afterCellRender

**StickyRows** (#279) — OWNS: clone container `.tbw-sticky-rows` (overlay), clone cache by row index, displayed indices, push displacement. HOOKS: afterRender, onScrollRender, onScroll. READS: `grid.rows`, `grid._virtualization.{container,positionCache,rowHeight}`. CONFIG: `isSticky` (string field or `(row,index)=>unknown`), `mode: 'push'|'stack'` (default push), `maxStacked`, `className`.

- INVARIANT: clones are decorative — `aria-hidden="true"`, no `tabindex`, focus classes stripped. Live row stays in pool for keyboard + AT.
- INVARIANT: container is `position: absolute; top: 0` overlay INSIDE `.rows-viewport`, NOT a flex child of `.rows-body`. Flex child would push viewport down by sticky height; rows are translated in scroll coords that don't account for the shift → visible duplicate during push transition. Viewport `overflow: clip` hides live row underneath.
- INVARIANT: `getCurrentScrollTop()` MUST read `_virtualization.container.scrollTop` (live faux-scroll), NOT derive from `start * rowHeight` (lags up to `rowHeight - 1` px, causes "invisible until row#3" symptom).
- INVARIANT: clone cache MUST be primed while row is live (`findRenderedRow` returns null once scrolled out).
- INVARIANT: sticky qualifies when `offsetOf(idx) < scrollTop` (strict — equality = live row at top, cloning would duplicate). In `'stack'` mode: `offsetOf(idx) < scrollTop + cumulativeHeightOfStuck` (each latches at stack bottom, not viewport top). At `maxStacked`: stricter edge `offsetOf(idx) < scrollTop + sumStuck - heightOf(oldest)` so eviction happens after full cross; meanwhile container is translated `-distance` (cap `heightOf(oldest)`) to animate. Push-mode equivalent: `pushOffset = heightOfStuck - distance`. Do NOT add incoming clone during anticipation (duplicates live row + covers prior section).
- INVARIANT: `refreshDisplay` tracks `displayedIndices` as actually-appended set (missing-clone retries next refresh).
- TENSION: fast scroll-jump past sticky's render window before `onScrollRender` fires → clone unprimed until user scrolls back. Fix would require synthesising from data (re-couples to `core/internal/rows.ts`).
- DECIDED (Nov 2025, #279): zero core bytes. WHY: plugin reads `_virtualization` internals (same pattern as `MasterDetailPlugin.ts:577`). RULED OUT: `core/internal/rows.ts.renderInlineRow` (#240 — module-level `document.createElement('template')` crashes happy-domless tests). Files: `StickyRowsPlugin.ts`, `sticky-rows.css`. Bundle: 4.01 kB gz ESM. Tests: `sticky-rows.spec.ts` (16).

**ContextMenu** — OWNS: menu items, open state. HOOKS: afterRender, onKeyDown. QUERIES: getContextMenuItems (queries all plugins for contributions)

### Export

**Clipboard** — OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl+C/V/X). DEPENDS: selection (optional).

- DECIDED (Nov 2025, paste perf): `parseClipboardText` ([paste.ts](libs/grid/src/lib/plugins/clipboard/paste.ts)) MUST extract cells via single `normalized.slice(cellStart, i)`, not char-by-char `currentCell += char`. State machine still scans char-by-char for `inQuotes`/delimiter/newline tracking. WHY: bench [clipboard.bench.ts](libs/grid/src/lib/plugins/clipboard/clipboard.bench.ts) — 10K-row no-quotes 168→455 hz (+172%), mixed 164→289 hz (+77%). Quoted cells go through `unquoteCell()` (rare path).
- DECIDED (Nov 2025, format perf): `formatCellValue` (`copy.ts`) and `formatCsvValue` ([csv.ts](libs/grid/src/lib/plugins/export/csv.ts)) MUST dispatch `typeof === 'string'` first, before `instanceof Date`. Strings dominate; `instanceof` is non-trivial. WHY: `formatCsvValue` "string with comma" 5.66M→6.25M hz (+10%), `buildCsv` 10K rows 57.9→77.7 hz (+34% compounding). `processCell` escape hatch + config-driven quoting still checked first.

**Export** — OWNS: export format/state. Exposes download methods (`exportCsv`/`exportExcel`/`exportJson`) AND data accessors (`export()`/`formatCsv()`/`formatExcel()`/`getResolvedColumns()`) for ExcelJS/clipboard/server-upload hand-off. `mode: 'raw' | 'formatted'` (default raw; formatted applies type defaults + `column.format`).

- DECIDED (#240): plugins MUST NOT import from `core/internal/rows.ts` at module scope — module-level `document.createElement('template')` crashes happy-domless tests + pollutes plugin bundles. Inline small helpers (`resolveFormat`) instead.
- DECIDED (#240): pre-resolving rows for downstream `buildCsv`/`buildExcelXml` (which re-call `resolveCellValue`) MUST strip `column.valueAccessor` from passed columns — accessors mis-resolve against synthetic `Record<string,unknown>` keyed by `field`, produce `undefined`/`NaN`.

**Print** — OWNS: print styling. Exposes print methods

### Pinned Rows

**PinnedRows** — OWNS: pinned row positions (top/bottom), info bar (counts/panels), aggregation rows. HOOKS: afterRender. READS FROM: `grid.sourceRows` (`totalRows`), `grid.rows` (`filteredRows`), filter plugin `cachedResult` (preferred when present), selection plugin `selected`.

- INVARIANT: `filteredRows` reflects post-filter count regardless of mechanism (filter plugin / column filters / external/server-side / direct `grid.rows =`). DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not the `rows` arg — externally-filtered hosts get correct counts without the filter plugin.
- DECIDED (Apr 2026, #255 unified slots): `slots[]` replaces parallel `aggregationRows[]` + `customPanels[]`. Each slot = one DOM row. Discriminator = **presence of `render`** → `PanelSlot`, else `AggregationSlot`. When `slots` set, ALL legacy fields ignored. Legacy without `slots` keeps byte-identical DOM via `synthesizeLegacySlots`. `PanelRender` returns `HTMLElement | null` — null drops contribution; panel with all-null renderers dropped entirely (how `selectedCountPanel()` self-hides on 0 selected). Top slots render inside NEW `.tbw-header-pinned` AFTER `.header`; bottom in `.tbw-footer`. Wrapper hidden under `tbw-grid[data-responsive]`. Adapters propagate null (React null/false/undefined; Vue null/undefined; Angular always rendered).
- INVARIANT: built-in `rowCountPanel`/`selectedCountPanel`/`filteredCountPanel` exported from `@toolbox-web/grid/plugins/pinned-rows`. Hardcoded English (`"Total: N rows"`) lives inside — i18n consumers build own renderer (do NOT add locale options).
- DECIDED (May 2026, demo-loop fix): `renderPanelSlot(slot, context, previousRow?)` is **ref-cached** — returns `previousRow` when every output is ref-equal; `populateSlotWrapper` diffs by ref, skips `replaceChildren`. WHY: framework consumers mounting components into returned container were torn down + remounted every `afterRender` (~30Hz), bouncing rows viewport through ResizeObserver autosizer = infinite loop. Built-in panels create fresh element per call so ref-equality fails and they keep updating. Consumer contract: return same element ref across calls to opt into stable rendering.
