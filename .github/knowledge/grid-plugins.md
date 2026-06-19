---
domain: grid-plugins
related: [grid-plugins-catalog, grid-core, grid-features]
---

# Grid Plugins — Mental Model

> Per-plugin OWNS/HOOKS/DECIDED entries for all 25 plugins + the shell plugin live in grid-plugins-catalog.md. This file covers the plugin SYSTEM (manager, lifecycle, hooks, communication, manifest, scroll, incompatibility).

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

- DECIDED (#contextMenu): `BaseGridPlugin.refreshUserConfigFrom(other)` (used by the FEATURE-INSTANCE-GATE-370 in `grid.ts` `#gateFeatureInstance`) must SNAPSHOT `other.userConfig` (`{...other.userConfig}`) BEFORE the `delete`-all-keys loop on `this.userConfig`. WHY: a feature factory stores the consumer's config object BY REFERENCE (`new ContextMenuPlugin(config)` → `userConfig = config`). When `gridConfig` is a recomputed Angular `computed()` that passes the SAME config object across re-resolutions, the cached and fresh instances share one `userConfig` reference (`cached.userConfig === fresh.userConfig`). Without the snapshot, clearing `target` empties that shared object first, then `Object.assign(target, source)` copies back nothing → config silently wiped → menu falls back to default Copy/Export items (the bug: feature-path lost items, directive-path kept them because the directive path doesn't go through the gate refresh). Tests: base-plugin.spec.ts `refreshUserConfigFrom` shared-object case + context-menu-feature-path.spec.ts re-set regression.

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

## per-plugin catalog

See grid-plugins-catalog.md for the OWNS/HOOKS/QUERIES/EVENTS + DECIDED entries of every plugin (ServerSide, Tree, GroupingRows, Pivot, PinnedColumns, ColumnVirtualization, Visibility, GroupingColumns, Selection, Editing, UndoRedo, MultiSort, Filtering, MasterDetail, ReorderColumns, ReorderRows, RowDragDrop, Responsive, Tooltip, StickyRows, ContextMenu, Clipboard, Export, Print, PinnedRows) and the shell plugin (#370).
