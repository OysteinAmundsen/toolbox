---
domain: grid-plugins
related: [grid-plugins-catalog-data, grid-plugins-catalog-ui, grid-plugins-shell, grid-core, grid-features]
---

# Grid Plugin System — Mental Model

> Per-plugin OWNS/HOOKS/DECIDED → grid-plugins-catalog-data.md (row/column model, sorting, filtering, pinned rows, clipboard/export/print) and grid-plugins-catalog-ui.md (selection, editing, undo, master-detail, reordering, display). Shell plugin → grid-plugins-shell.md. This file = the SYSTEM (manager, lifecycle, hooks, communication, manifest, scroll, compatibility).

## plugin-manager

- OWNS: plugin instances (array order), hook caches (sorted by priority), renderer/editor registries, event bus, query handlers.
- READS FROM: plugin manifests (dependencies, incompatibilities, hookPriority, queries).
- WRITES TO: cached hook-presence flags, `cellRenderers`/`headerRenderers`/`cellEditors` maps.
- INVARIANT: plugins execute in array order; `manifest.hookPriority` overrides (**lower = earlier**). When a hook needs DOM produced by another plugin's same hook, raise the dependent plugin's `hookPriority` (runs later) OR defer with `queueMicrotask()`.
- INVARIANT: one PluginManager per grid; plugins are stateful singletons. Dependencies validated on attach; incompatibilities warned at runtime (dev only).

## plugin-lifecycle

- FLOW: `attach(grid)` → merge defaults + user config → store grid ref → `onPluginAttached()` notifications → [runtime hooks] → `detach()` → abort signal fires → cleanup.
- INVARIANT: `disconnectSignal` (AbortSignal) fires on detach — use it for ALL event-listener cleanup.
- INVARIANT: `plugin.grid` is available after `attach()`, null after `detach()`.
- INVARIANT: `plugin.grid` (typed `GridElement`) is the object plugins read internal state from (`_sortState`, `_visibleColumns`, `_virtualization`, …). Do **NOT** re-route those reads through `this.gridElement` / `grid._hostElement`. Production satisfies `_hostElement === this` (`grid.ts` `get _hostElement() { return this; }`), but plugin specs mock `grid` as a plain object with **no** `_hostElement`, so the swap yields `undefined` at runtime. Verified: 73 failures across 7 specs (tree, undo-redo, reorder-columns, multi-sort, grouping-rows, row-drag-drop, server-side).
- DECIDED (Aug 2026, #465): plugin grid types form one narrowing chain `PublicGrid<T>` → `InternalGrid<T>` → `GridElementRef<T>` → `GridElement`, with the **plugin-facing type at the bottom**. `GridElementRef<T = any> extends Omit<InternalGrid<T>, Exclude<keyof GridConfig<T>, ElementBackedConfigKey> | DomRedeclaredKey>, HTMLElement` (`core/plugin/types.ts`). WHY: the post-`attach()` view is the _most specific_ one, and `GridElementRef`/`GridElement` are **not exported from `public.ts`**, so all narrowing lands on types no consumer can name ⇒ zero public-API change, non-breaking. Deleted all ~13 `this.grid as unknown as GridHost` casts; bundle byte-identical (155.72 kB / 46.13 kB gz).
- INVARIANT: `GridElementRef extends HTMLElement`, so `this.grid` is directly assignable to `GridHost = InternalGrid<T> & HTMLElement`. MUST NOT re-add a hand-rolled DOM facade (`clientWidth`, `addEventListener`, `setAttribute`, …) — removed for real inheritance. `DomRedeclaredKey = 'querySelector' | 'querySelectorAll'` is omitted from the `InternalGrid` half: it declares 2 overloads vs `HTMLElement`'s 4, and multiply-inherited same-named members must be _identical_.
- INVARIANT: only 4 of `GridConfig`'s 25 keys are real accessors on the custom element — `ElementBackedConfigKey = 'columns' | 'fitMode' | 'columnState' | 'columnInference'`. Every other config key (`rowHeight`, `locale`, `sortable`, …) lives only in `gridConfig`/`effectiveConfig` and is `undefined` when read off the element, so `GridElementRef` omits them. `InternalGrid extends GridConfig` over-promises ~20 phantom members; reading them off a plugin's `grid` is now a compile error.
- DECIDED (#465, PR #466 review): `PublicGrid.getPlugin` and `GridElement.getPlugin` are both constrained to `GridPlugin` (`core/types.ts`), not `BaseGridPlugin` — the latter would reintroduce a circular import. `PublicGrid.getPlugin` is thus _stricter_ than before (was unconstrained `<P>`), but NOT breaking: `BaseGridPlugin implements GridPlugin` with `abstract readonly name` (subclasses must declare it) and `version` defaulted to `__GRID_VERSION__`, so every registerable plugin satisfies it by construction. Only `getPlugin(NonPluginClass)` is newly rejected — it returned `undefined` anyway (`plugin-manager` only stores `BaseGridPlugin`). RULED OUT: an unconstrained "back-compat" overload — TS resolves to it and the constraint never binds.
- RULED OUT: (a) re-routing via `this.gridElement` / `grid._hostElement` — 73 failures across 7 specs (plugin specs mock `grid` without `_hostElement`); (b) `GridElement extends GridElementRef, InternalGrid` — multiple inheritance needs identical same-named members; (c) hoisting `protected get internalGrid()` onto `BaseGridPlugin` — base-class names are unmanglable at every call site (editing has ~500 B headroom); (d) dropping `InternalGrid extends GridConfig<T>` — removes 25 members from an **exported** type = breaking.
- INVARIANT: a scratch/probe `.ts` file **cannot** verify grid type-compatibility. `InternalGrid extends GridConfig`, and 52 files `declare module '../core/types'`, so its shape depends on which augmentations the compilation loaded — a probe reported "no error" for a cast that fails in real plugin files. Verify via `bun nx build grid`, never an isolated file.
- DECIDED: prefer config-driven init over post-ready imperative setup. Known-at-config-time resources accept a config prop and auto-init in `attach()` (pattern: `ServerSidePlugin` reads `config.dataSource`). Reserve imperative setters (`setDataSource()`) for runtime swaps.
- DECIDED (Feb 2026, dead-config audit): a key declared on `*PluginConfig` + set in `defaultConfig` + documented, with ZERO consumers, is **dead and MUST be removed** — never "reserved for future use". Sweep with grep for `this.config.<key>`, `config.<key>`, `gridConfig.<key>` across the plugin dir + core. Removed: `visibility.allowHideAll`, `master-detail.collapseOnClickOutside`, `filtering.{trimInput,useWorker}`. PENDING: `pinned-rows.{showRowCount,showSelectedCount,showFilteredCount}` (removal needs a synthesized default `slots: []`).

## hook-system

### Render-cycle hooks

| Hook              | Phase        | Purpose                                  | Returns          |
| ----------------- | ------------ | ---------------------------------------- | ---------------- |
| `processColumns`  | COLUMNS      | transform column array                   | `ColumnConfig[]` |
| `processRows`     | ROWS         | transform row array (filter/sort/expand) | `any[]`          |
| `afterCellRender` | per-cell     | cell styling, badges                     | void             |
| `afterRowRender`  | per-row      | row styling, ARIA                        | void             |
| `afterRender`     | STYLE        | full DOM queries, event listeners        | void             |
| `onScrollRender`  | scroll-reuse | reapply visual state to recycled DOM     | void             |

### Event hooks (return `true` for early exit)

`onKeyDown` · `onCellClick` · `onRowClick` · `onHeaderClick` · `onScroll` · `onCellMouseDown`/`Move`/`Up` (drag).

### Virtualization hooks

| Hook                         | Purpose                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| `getRowHeight`               | synthetic row height (detail panels, tree)                          |
| `adjustVirtualStart`         | render extra rows above the viewport                                |
| `renderRow`                  | custom row DOM (bypasses the default renderer)                      |
| `getHorizontalScrollOffsets` | pinned-column spacing for keyboard navigation (PinnedColumnsPlugin) |
| `getVerticalScrollOffsets`   | overlay height above/below rows viewport (StickyRowsPlugin)         |

- INVARIANT (scroll-boundary hooks, #449): report ONLY space painted **over** the scrollable rows. Normal-flow content (pinned-row bars, `.tbw-footer`, header, shell header) already shrinks the viewport via `flex-shrink: 0` — reporting it scrolls twice as far. Only `.tbw-sticky-rows` (`absolute; top:0; z-index:22` inside `.rows-viewport`) qualifies today.
- FLOW (`getVerticalScrollOffsets`, 5 files, mirrors the horizontal chain): `BaseGridPlugin` hook → `PluginManager` sums `top`/`bottom`, ORs `skipScroll` → `InternalGrid._getVerticalScrollOffsets` (types.ts) → `grid.ts` delegator → `keyboard.ts scrollFocusedRowIntoView` **and** `focus-manager.ts scrollToRow`. A new boundary hook = all five files.
- `skipScroll: true` = "already visible by other means, don't move the viewport" (StickyRows returns it when the focused row IS a stuck clone).
- Consumers clamp with `Math.max(0, …)` and bail when `usableHeight <= 0` — a malformed report can't invert the band or yield NaN.

- INVARIANT (`renderRow` contract): when a plugin's `renderRow` takes over cell creation (Pivot, GroupingRows, Tree custom rows, MasterDetail panels), the grid's normal cell pipeline is **skipped entirely** — `format`, `cellRenderer`, `cellClass`, value-accessor caching and sanitize wrapping MUST be re-applied manually. Canonical pattern: the cell render path in [rows.ts](libs/grid/src/lib/core/internal/rows.ts). Forgetting = silent formatter loss inside grouped/pivot rows.

### State-persistence hooks

- `getColumnState()` → plugin's column state for save; `applyColumnState()` → restore.
- INVARIANT: a plugin owning sort (MultiSortPlugin) MUST broadcast `sort-change` from `applyColumnState`, deferred via microtask to batch per-column calls.
- DECIDED (Apr 2026, plugin-side render trigger): when a plugin owns state that core's `#applyColumnState` width-only fast path cannot observe (plugin nulled `_sortState`), the PLUGIN — not core — forces the re-render. MultiSortPlugin snapshots the model at batch start, compares in the deferred microtask, and on change broadcasts `sort-change` AND calls `this.requestRender()` (ROWS). Covers sort-add (core fast path bypassed via `incomingHasSort`) and sort-removal. WHY not a core `hasOwnedSort` query: ~30 bytes over budget. RULE: any plugin mutating owned state during `applyColumnState` must self-trigger the render.

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

## localization (`GridConfig.locale`)

- OWNS: `GridConfig.locale?: GridLocale` (flat `Record<string, string>`, `core/types.ts`). `BaseGridPlugin.t(key, fallback)` reads `this.grid?.effectiveConfig?.locale?.[key] ?? fallback`; `BaseGridPlugin.translate` is the bound `Translate` for handing to render modules that have no plugin reference.
- DECIDED (3.5.0, Aug 2026 audit D1): ship **no `DEFAULT_LOCALE` map** — every call site passes its English string inline as the fallback. WHY: a default map would put every plugin's strings in the core bundle regardless of what's loaded, and core is already past the 45 kB gz soft warning; inline fallbacks tree-shake with their plugin and keep the English adjacent to its usage. Measured cost ~0.01 kB gz. Tests: `core/plugin/locale.spec.ts`.
- INVARIANT: lookup uses `??`, not `||` — an intentionally blank translation (`''`) must win over the fallback.
- INVARIANT: `locale` is read live on every call (no snapshot), so swapping `gridConfig.locale` re-localizes on the next render.
- INVARIANT: `locale` is for STATIC labels only. `A11yConfig.messages` stays separate because announcements are functions of runtime values (counts, column names, direction). Do not merge them.
- Render modules with no plugin handle receive the function explicitly: `FilterPanelParams.t` (also makes third-party `filterPanelRenderer`s localizable), `renderPivotPanel(..., t)`, `renderPivotGrandTotalRow(..., t)` — each defaults to `(_key, fallback) => fallback`.
- Keys namespaced by owning plugin: `filter.*` (Filtering), `columns.*` (Visibility), `pinnedColumns.*`, `print.*`, `pivot.*`. Full catalogue: `apps/docs/src/content/docs/grid/guides/platform.mdx` → "Built-in UI strings".

## event registry (`DataGridEventMap`)

- OWNS: `DataGridEventMap<TRow>` in [core/types.ts](libs/grid/src/lib/core/types.ts) is the SSOT for DOM-visible grid events. Plugins extend it from their own `types.ts`: `declare module '../../core/types' { interface DataGridEventMap { 'foo-bar': FooBarDetail } }`. `keyof DataGridEventMap<TRow>` is the canonical event-name list.
- INVARIANT: emit site and registry MUST agree — an unregistered `_emit('foo-bar')` works at runtime but adapter satisfies-guards reject the prop. NEVER add a synthetic event name just to silence a guard error.
- INVARIANT: register EVERY event the plugin OR its core helpers emit. LESSON (May 2026): `'column-visibility'` is emitted from `config-manager.ts` (`setColumnVisible`/`toggleColumnVisibility`/`showAllColumns`) yet was only registered once added to `plugins/visibility/types.ts`.
- DECIDED (v3): the hand-maintained `DGEvents`/`PluginEvents` string mirrors are REMOVED from `public.ts` (they had drifted — 7 stale `PluginEvents` entries, `CLIPBOARD_COPY` vs `COPY`). Use `keyof DataGridEventMap` + string literals.
- DECIDED (3.4.0): plugin **hook payload** types are public — `public.ts` re-exports `CellClickEvent`, `CellCoords`, `HeaderClickEvent`, `HookName`, `RowClickEvent`, `ScrollEvent` from `./lib/core/plugin`, and they are removed from `libs/grid/typedoc.json > intentionallyNotExported`. WHY: you cannot write a typed `onCellClick`/`onScroll` hook without them. Still internal (in `intentionallyNotExported`): `AggregatorRef, AnyColumn, CellEditor, CellRenderer, DiagnosticCode, FeatureResolverFn, GridElement, HeaderRenderer, PluginConfigRule, PluginIncompatibility, PluginManager, PluginNameMap, PluginPropertyDefinition, RowPosition, ShellState`.

## plugin manifest schema

```
ownedProperties      — property validation rules
hookPriority         — Partial<Record<HookName, number>> (lower = earlier)
configRules          — plugin config validation
incompatibleWith     — warn if both loaded
queries              — query types this plugin handles
events               — event types this plugin emits
modifiesRowStructure — affects the render scheduler
```

- DECIDED (#372, conditional/soft dependencies): `PluginDependency` gained `when?: (pluginConfig: unknown) => boolean` and `severity?: 'error'|'warn'|'info'` alongside `name`/`required`/`reason`. `validatePluginDependencies` (`core/internal/validate-config.ts`) evaluates `dep.when(plugin.resolvedConfig)` FIRST, then `severity ?? (required ? 'error' : undefined)`. Dispatch: error → `throwDiagnostic(MISSING_DEPENDENCY/TBW020)`, warn → `warnDiagnostic(OPTIONAL_DEPENDENCY/TBW021)`, info → `debugDiagnostic(TBW021)`. Default reason verb: error → "requires", warn/info → "recommends". Use case: Pivot needs a shell host only when `showToolPanel === true`.
  - INVARIANT: validation runs BEFORE `plugin.attach()`, so `plugin.config` is not merged yet — `when` reads the `@internal` `BaseGridPlugin.resolvedConfig` getter, which returns `this.config` only while ATTACHED (gated on `#abortController`) and otherwise recomputes `{...defaultConfig, ...userConfig}`. `detach()` does NOT clear `this.config`, so trusting it when detached would leak stale config.
  - INVARIANT: omitted `severity` preserves legacy behavior — hard dep throws, `required:false` stays SILENT (not 'info'); warn/info are dev-only (`isDevelopment()`). Tests: `validate-config.spec.ts` (`config-conditional dependencies`, `explicit severity`).
- DECIDED (contextMenu): `BaseGridPlugin.refreshUserConfigFrom(other)` (used by the FEATURE-INSTANCE-GATE-370 in `grid.ts` `#gateFeatureInstance`) MUST SNAPSHOT `{...other.userConfig}` BEFORE the delete-all-keys loop on `this.userConfig`. WHY: a feature factory stores the consumer's config BY REFERENCE, so when `gridConfig` is a recomputed Angular `computed()` passing the same object, `cached.userConfig === fresh.userConfig` — clearing the target empties the shared object first and `Object.assign` copies back nothing → config silently wiped (context menu fell back to default Copy/Export items on the feature path only). Tests: `base-plugin.spec.ts` shared-object case + `context-menu-feature-path.spec.ts`.

## hook-priority map

| Plugin        | Hook             | Priority | Reason                                     |
| ------------- | ---------------- | -------- | ------------------------------------------ |
| ServerSide    | `processRows`    | -10      | provides managedNodes first                |
| PinnedColumns | `processColumns` | -10      | reorder pinned before ColumnVirtualization |
| Pivot         | `onHeaderClick`  | -10      | intercept before MultiSort                 |
| GroupingRows  | `onHeaderClick`  | -1       | intercept group headers before MultiSort   |
| Tree          | `processRows`    | 10       | after ServerSide, before others            |
| GroupingRows  | `processRows`    | 10       | after ServerSide                           |
| Pivot         | `processRows`    | 100      | after MultiSort, apply aggregation         |

## scroll dispatch

- FLOW: faux-scrollbar `scroll` → rAF batcher → `#onScrollBatched(scrollTop)` → geometry reads → `refreshVirtualWindow` → `onScrollRender` → pooled `ScrollEvent` → `pluginManager.onScroll` (gated by `#hasScrollPlugins`) → public `tbw-scroll` CustomEvent (always).
- INVARIANT: geometry reads (`scrollHeight`/`clientHeight`) MUST precede any DOM write in the same tick (forced-sync-layout avoidance). They are unconditional — the public event needs them too.
- INVARIANT: the pooled `#pooledScrollEvent` is reused across ticks (safe only for synchronous internal consumers); the public `tbw-scroll` detail MUST be a fresh literal.
- INVARIANT: public dispatch is gated by `#connected` via the `#emit` helper — no events after removal from the DOM.
- DECIDED (#234): `tbw-scroll` is always-on and vertical-only. `direction: 'vertical' | 'horizontal'` is declared for forward compatibility; horizontal dispatch is intentionally unimplemented (the horizontal listener stays behind `#hasScrollPlugins`). Adapter prop names are disambiguated (`onTbwScroll` / `tbwScroll` / `@tbw-scroll`) to avoid colliding with the native scroll event.

## compatibility

- INCOMPATIBLE: GroupingRows ↔ Tree (both transform the whole row array) · GroupingRows ↔ Pivot · Tree ↔ Pivot · ServerSide ↔ Pivot (lazy load vs full dataset).
- COMPATIBLE: ServerSide + GroupingRows **only** in pre-defined-groups mode (`setGroups()`/`setGroupRows()`) · ServerSide + Tree (Tree has its own `dataSource`) · MasterDetail + GroupingRows (skips `__isGroupRow`) · Responsive + GroupingRows (same) · Pivot + MultiSort (Pivot queries the sort model, `processRows` at priority 100).
