---
domain: grid-plugins-catalog-data
related: [grid-plugins, grid-plugins-catalog-ui, grid-core, grid-features]
---

# Plugin Catalog — Data & Model Plugins

> System architecture (manager, lifecycle, hooks, manifest, communication) → grid-plugins.md. Shell → grid-plugins-shell.md. Interaction/display plugins (Selection, Editing, UndoRedo, MasterDetail, Reordering, Responsive, Tooltip, StickyRows, ContextMenu) → grid-plugins-catalog-ui.md.

## Row-Transforming (`modifiesRowStructure: true`)

### ServerSide

OWNS: fetch cache, lazy blocks, placeholders (`{__loading,__index}`), `managedNodes`, `blockControllers: Map<number,AbortController>`.
HOOKS: processRows(-10) — IGNORES input, returns viewport-clamped `managedNodes`.
EVENTS: `datasource:data|children|loading|error`. QUERIES: `datasource:fetch-children`, `datasource:is-active`. LISTENS: `sort-change`, `filter-change`.

- INVARIANT: `totalNodeCount = -1` → infinite scroll; `0` → unknown; short block auto-detects end. `grid.sourceRows` stays empty. `onModelChange` MUST call `loadRequiredBlocks()` after cache clear. Block resolution with `previousManagedLength === 0` OR `managedNodes.length < totalNodeCount` MUST `requestRender()` ROWS (`requestVirtualRefresh()` skips processRows). `loadRequiredBlocks()` expands the viewport by `loadThreshold` rows both directions first.
- DECIDED (Apr 2026): core `applySort`/`grid.sort()` emits `sort-change` to BOTH DOM and plugin bus (`_pluginManager.emitPluginEvent`) — ServerSide otherwise misses it without MultiSort. `setDataSource()` calls `loadRequiredBlocks()` after the initial block only when `loadThreshold > 0`.
- DECIDED (Apr 2026, AbortSignal + Subscribable): `getRows()` gets a non-aborted `params.signal` (REQUIRED); may return `Promise<GetRowsResult>` OR a duck-typed `Subscribable` (`{subscribe(observer):{unsubscribe()}}`, no RxJS dep). Per-block `AbortController` aborted on `setDataSource`/`refresh`/`purgeCache`/`onModelChange`/`detach`. `toResultPromise` subscribes once, settles on `next`, unsubscribes on error/complete/abort (cancels Angular HttpClient XHR without `firstValueFrom`). Promise sources defensively rejected with `DOMException('Aborted','AbortError')`; result-shape guard drops the stored result if abort lands before `loadedBlocks.set`. `setDataSource()` adds block 0 to `loadingBlocks` so a parallel scroll-triggered call can't double-fetch. RULED OUT: a separate `fromObservable` helper. Files: `server-side/datasource.ts`, `ServerSidePlugin.ts#abortAllBlocks`.
- DECIDED (Feb 2026): `pageSize` is canonical; `cacheBlockSize` is a `@deprecated` alias. Resolve at consumption (`pageSize ?? cacheBlockSize ?? 100`); `defaultConfig` MUST NOT set `pageSize` (would outrank legacy specs). `GetRowsParams.pageSize = endNode - startNode`.
- DECIDED (#273, declarative `data-src`): plugins MAY read host `data-*` attributes in `attach()` via `this.gridElement.getAttribute()`. With no JS `dataSource`, ServerSide reads `data-src` → `setDataSource(createUrlDataSource(src))` (`@internal`, fetch-once-and-cache; accepts a plain array or `{rows,totalNodeCount}`; a failed/aborted fetch is NOT cached — `datasetPromise = null` in `.catch`, else the rejection poisons every later block after `abortAllBlocks()`). INVARIANT: host `data-*` reads are INIT-TIME ONLY — `observedAttributes` is static (`rows`,`columns`,`grid-config`,`fit-mode`,`loading`); the `grid-config` attr/property is the reactive escape hatch. JS `config.dataSource` always wins. NOT for true server pagination — use a `dataSource` callback.
- DECIDED (#369): `FeatureConfig.serverSide` widened to `boolean | ServerSideConfig` (was the lone object-only feature among 18); factory normalizes `config === true` → `new ServerSidePlugin()`. Note: `{...true}` yields `{}` and does not throw.
- TENSION: tall grid + small `pageSize` + no threshold still needs a scroll to fill the viewport.
- Tests: `server-side.spec.ts` (AbortSignal, Subscribable, `loadBlock`, `createUrlDataSource`, `data-src`, boolean shorthand).

### Tree

OWNS: expanded keys, flattened rows, `rowKeyMap`, `#rowMeta` `WeakMap<row,FlattenedTreeRow>`, `#rowKeys` `WeakMap<row,string>`, animation state, `loadingKeys`/`loadedKeys`, `#childRequests: Map<key,AbortController>`.
HOOKS: processRows(10), processColumns, afterCellRender, afterRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart.
QUERIES: `canMoveRow`, `datasource:viewport-mapping`, `sort:get-model`. EVENTS: `tree-expand`, `tree-load-start|end|error`. FIRES: `datasource:fetch-children`. LISTENS: `datasource:children|error` (filtered on `context.source === 'tree'`).

- DECIDED (v3.4.0, lazy loading): two routes, ServerSide wins. `requestLazyChildren` checks `datasource:is-active` **via `queryBoolean`** (raw `query()` returns `[]` which is truthy → always chose ServerSide, so `loadChildren` never ran, #430). Else `TreeConfig.loadChildren` (Promise or `Subscribable`, per-request `AbortController`, aborted on `detach()`). `Subscribable` is **take-one** (unsubscribe on first `next`/`error`) because `finish()` removes the controller `detach()` would abort; a `settled` flag covers synchronous emission. Ref: `TreePlugin.#loadChildrenLocally`, `tree-integration.spec.ts`.
- INVARIANT (#430): `detectTreeStructure(rows, childrenField, hasChildren)` MUST receive `config.hasChildren` — predicate-only lazy trees have no `children` field, so without it detection returns false → empty `flattenedRows`, no toggle. File: [tree-detect.ts](libs/grid/src/lib/plugins/tree/tree-detect.ts).
- INVARIANT: `loadedKeys` (not `row[childrenField].length`) gates re-fetch — a node resolving to `[]` with a truthy `hasChildren` would refetch on every expand. Fetched at most once per attach; errors do NOT mark loaded (retry-by-re-expand works).
- INVARIANT: `datasource:error` MUST be handled — otherwise the key stays in `loadingKeys` forever and retries short-circuit.
- INVARIANT: loading UI reuses core `createDefaultSpinner('small')` (+ `.tree-loading` sizing in `@layer tbw-plugins`). `afterRender` sets AND removes `aria-busy` with an explicit negative branch (row recycling).
- INVARIANT: lazy children are signalled by a truthy non-array `childrenField` (e.g. `children: true`) or a `TreeConfig.hasChildren` predicate; child rows are single-batch (no pagination).
- DECIDED (#264, WAI-ARIA treegrid): Tree or GroupingRows registered → `.rows-body` `role` swaps `grid` → `treegrid` + per-visible-row `aria-level`/`aria-setsize`/`aria-posinset`. Both set idempotently in `afterRender`, restore `role="grid"` in `detach()`. Tree carries `posInSet`/`setSize` on `FlattenedTreeRow`; GroupingRows uses a parallel `flatMeta` array (`computeFlatMeta`). INVARIANT: `posInSet`/`setSize` are 1-based PER PARENT, not global rowIndex. `aria-multiselectable` stays valid on `treegrid`.

### GroupingRows

OWNS: grouped row model, expanded keys, animation state. HOOKS: processRows(10), onHeaderClick(-1), renderRow. QUERIES: `canMoveRow`, `grouping:get-grouped-fields`, `datasource:viewport-mapping`. EVENTS: `group-toggle|expand|collapse`.

- DECIDED (#335, deferred expansion): `setGroupOn(fn, expanded?)` takes `DefaultExpandedValue: boolean|number|string|string[]` seeding expansion against the NEW group set on the next rebuild. `expandAll`/`collapseAll` called right after `setGroupOn` ALSO defer (same `pendingExpansion` field) instead of reading stale `flattenedRows`. Mechanism: `setGroupOn` sets `groupConfigDirty`; `expandAll`/`collapseAll` store `pendingExpansion`; `processRows` snapshots+clears at the top and resolves against fresh `getGroupKeys(initialBuild)`, broadcasting `group-toggle` once.
- INVARIANT: bulk `group-toggle` emissions MUST use `broadcast<GroupToggleDetail>`, not `emitPluginEvent`, so DOM listeners see them. `GroupToggleDetail.{key,expanded,value,depth}` are optional (bulk carries only `expandedKeys`).

### Pivot

OWNS: pivot result, flattened pivot rows, expanded keys, column totals, sort state. HOOKS: onHeaderClick(-10), processRows(100). QUERIES: `sort:get-sort-config`. EVENTS: `pivot-toggle`, `pivot-config-change`.

- INVARIANT: `PivotRow.isGroup` means "has sub-groups" (`remainingFields.length > 0`), NOT "is a group row". A single `rowGroupFields` produces `isGroup: false` and `getAllGroupKeys()` returns nothing.

### row-identity (ALL row-model plugins)

- DECIDED (Apr 2026): plugins MUST NOT spread/clone row objects in `processRows`. Output is either `===` the input refs or genuinely synthetic (group headers, pivot aggregates, ServerSide `__loading`/`managedNodes`). Decoration goes in parallel structures — `WeakMap<row,meta>` or wrappers (`RenderRow{kind:'data',row}`). WHY: `RowManager.updateRow` mutates `_rows[i]` in place and the next ROWS rebuild re-runs `processRows` — clones discard the mutation. Symptoms: `cell-change.row` not `===` source; mutations vanish after filter; edit dirty resets. Audit: `expect(grid._rows[i]).toBe(sourceRows[i])`. Tests: `tree-row-update.spec.ts`.
- DECIDED (Apr 2026, sortHandler dispatch): plugins sorting USER DATA ROWS MUST resolve through `gridConfig.sortHandler ?? builtInSort` (mirrors core `applySort`); async handlers can't be awaited in sync `processRows` → fall back to `builtInSort` (which honors `sortComparator` + `valueAccessor`). EXCEPTIONS: GroupingRows (group nodes by agg), Pivot (row keys), clipboard/context-menu/excel-styles (indices), ServerSide (`managedNodes` is plugin-owned). Rules: (1) pass a shallow copy `[...rows]` when input could be user-owned (`TreePlugin#sortLevel`); (2) a Promise-returning handler needs `void result.catch(() => undefined)` BEFORE the sync fallback, and MUST NOT splice the resolved result back into `managedNodes` async. PENDING: MultiSort `sortRowsInPlace` ignores `sortHandler` (signature mismatch).
- DECIDED (Apr 2026, public sort API): `column.sortComparator` is RECOMMENDED — it survives every sort path (core/multi-sort/tree/server-side `sortMode:'local'`) and composes. `gridConfig.sortHandler` is an escape hatch only (bypassed by MultiSort, one field at a time). Server-side: `dataSource.getRows({sortModel})`.

## Column-Transforming

### PinnedColumns

OWNS: pinned state per column. HOOKS: processColumns(-10), afterCellRender. TENSION: runs first, before ColumnVirtualization.

- INVARIANT (sticky-cell painting): `.sticky-left`/`.sticky-right` carry opaque `background: var(--tbw-color-panel-bg)` (`rows.css`) + `position: sticky; z-index: 25` (`base.css`). Consequences: (1) row-level background tints (`.row-focus`, `:hover`, `:nth-child(even)`) are HIDDEN under sticky cells — re-paint with `background: linear-gradient(<tint>,<tint>), var(--tbw-color-panel-bg)`; (2) `::after` border overlays need row-level `z-index: 26` (cell-level `::after { inset: 0 }` is clipped by `overflow: hidden`). Canonical: `selection.css .data-grid-row.row-focus`.

### ColumnVirtualization / Visibility

- ColumnVirtualization — OWNS: scroll-derived visible column subset. HOOKS: processColumns.
- Visibility — OWNS: hidden column set. HOOKS: processColumns. Requires the shell (`static dependencies` `{name:'shell',required:true}` → throws TBW020 without it).

### GroupingColumns

OWNS: column group structure. HOOKS: processColumns.

- DECIDED (Jul 2026): `#getStableColumnGrouping` is a 3-tier chain `#groupsFromResolvedDefs() ?? #groupsFromActiveGroups() ?? #groupsFromInlineColumns()` then `#sortGroupFieldsByDisplayOrder`. Tier order is load-bearing and MUST use `??` (not `||`) — tier 1 legitimately returns `[]` when every declarative def is filtered out and must short-circuit. Module-level `mergeInlineGroup(map, col)` is the shared inline-`group` upsert; tier 2 folds hidden columns into the SAME Map before `Array.from`, which preserves insertion order.

## Sorting & Filtering

### MultiSort

OWNS: `sortModel[]`, cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: `sort:get-model`, `sort:set-model`. EVENTS: `sort-change`.

- INVARIANT: MultiSort is the AUTHORITATIVE sort source — Tree and GroupingRows must query `sort:get-model` when it is loaded, never keep independent sort state (desyncs indicators from actual order).
- TENSION: caches the sort during a row edit so the edited row doesn't jump.

### Filtering

OWNS: `filterModels` Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: `filter-change`.

- INVARIANT: numeric ops (`greaterThan`/`>=`/`<`/`<=`/`between`) MUST exclude blanks (null/undefined/''/NaN) before coercion — JS coercion leaks them (`null >= 0` is true, `Number('') === 0`). Blanks match ONLY the explicit `blank` operator; NaN counts as blank.
- DECIDED (Apr 2026): the number filter panel's Apply clears the filter when both bounds are still data-derived defaults — otherwise `between(dataMin,dataMax)` silently excludes blank rows.
- DECIDED (Apr 2026): `getDataRows()` prefers `sourceRows`, falling back to `grid.rows.filter(r => r.__loading !== true)`, so ServerSide hosts get unique values from loaded blocks without a `valuesHandler`. Async `valuesHandler` remains canonical for a full server-side dataset.
- DECIDED (Jul 2026, `compileFilter`): a `??` chain — `compileBlankPredicate` → `compileSetPredicate` (in/notIn share one Set + `negate`) → `compileNumericPredicate` → `compileTextPredicate` → `() => true`. Order matters (blank/set must be claimed first). INVARIANT (perf): emitted per-row closures MUST stay specialized — do NOT collapse the 5 numeric ops or 12 text variants behind a shared comparator lookup. Routing `blank` through the shared `isBlank()` helper cost ~8 % on `filter-model.bench > blank check`. File: [filter-model.ts](libs/grid/src/lib/plugins/filtering/filter-model.ts).

## Pinned Rows

### PinnedRows

OWNS: pinned row positions (top/bottom), info bar (counts/panels), aggregation rows. HOOKS: afterRender. READS: `grid.sourceRows` (`totalRows`), `grid.rows` (`filteredRows`), filter plugin `cachedResult` (preferred when present), selection plugin `selected`.

- INVARIANT: `filteredRows` reflects the post-filter count regardless of mechanism (filter plugin, column filters, server-side, or a direct `grid.rows =`). DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not the `rows` argument.
- DECIDED (#255, unified slots): `slots[]` replaces parallel `aggregationRows[]` + `customPanels[]`; each slot is one DOM row. Discriminator = presence of `render` → `PanelSlot`, else `AggregationSlot`. When `slots` is set, ALL legacy fields are ignored; legacy without `slots` keeps byte-identical DOM via `synthesizeLegacySlots`. `PanelRender` returns `HTMLElement | null` — null drops the contribution, and a panel whose renderers are all null is dropped entirely (how `selectedCountPanel()` self-hides). Top slots render in `.tbw-header-pinned` AFTER `.header`; bottom in `.tbw-footer`. Wrapper hidden under `tbw-grid[data-responsive]`. Adapters propagate null (React null/false/undefined; Vue null/undefined; Angular always rendered).
- INVARIANT: built-in `rowCountPanel`/`selectedCountPanel`/`filteredCountPanel` are exported from `@toolbox-web/grid/plugins/pinned-rows` and are hardcoded English — i18n consumers build their own renderer (do NOT add locale options).
- DECIDED (May 2026, demo-loop fix): `renderPanelSlot(slot, context, previousRow?)` is REF-CACHED — returns `previousRow` when every output is ref-equal; `populateSlotWrapper` diffs by ref and skips `replaceChildren`. WHY: framework consumers mounting components into the returned container were torn down + remounted every `afterRender` (~30 Hz), bouncing the rows viewport through ResizeObserver autosizing into an infinite loop. Built-in panels create a fresh element per call (so they keep updating). Consumer contract: return the same element ref across calls to opt into stable rendering.
- TENSION (found while writing the `@promo` pinned-rows scene): the plugin only rebuilds panels in `afterRender` and subscribes to **no** selection event. Selecting a row updates `aria-selected`/`.selected` via the selection plugin's own DOM patch without a grid render, so `selectedCountPanel()` stays collapsed until some _other_ change forces a render. Repro: `pinned-rows/PinnedRowsDefaultDemo`, click a row — `[data-pinned-row-id="selected"]` never appears. Fix would be a `selection-change` subscription calling `requestRender()`.

## Export

### Clipboard

OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl+C/V/X). DEPENDS: selection (optional).

- DECIDED (Jul 2026, structured payload): copy writes WYSIWYG `text/plain` (via `processCell`) AND (a) snapshots RAW values in-memory (`#internalClipboard = {text, rawRows, fields}`) AND (b) writes `text/html` — a real `<table>` whose root carries a base64 `data-tbw-clip` structured payload. Paste value-source precedence: (1) exact in-memory match on `text` (preserves `Date` etc.), (2) `parseClipboardHtmlPayload(getData('text/html'))` for cross-grid/cross-window/post-reload, (3) parsed text. The winner becomes `PasteDetail.rawRows`; `defaultPasteHandler` uses `rawRows ?? rows` and `cloneStructured`s each value so tiled pastes never share a ref. Codec lives in its OWN module [clipboard-payload.ts](libs/grid/src/lib/plugins/clipboard/clipboard-payload.ts) — MUST NOT live in copy.ts/paste.ts (paste.ts importing a VALUE from copy.ts created a circular import → TDZ `X is not defined` at test load).
- DECIDED (Jul 2026, `fillSelection`): default `false`; tiles a smaller source across a larger **bounded** selection via modulo indexing (1 cell → fill all; `v1,v2` → `v1,v2,v1,v2`; 2×2 → 4×4). Policy in the plugin, mechanism in the handler: `#handleNativePaste` sets `PasteDetail.fillSelection` (only when `bounds != null`) and widens `fields` to the full selection width; `defaultPasteHandler` iterates the bounds with `pastedRows[r%srcRows]` / `sourceRow[c%srcCols]`. Never grows the grid; non-editable columns still skipped; `detail.rows` stays the literal source. RULED OUT: pre-tiling `parsed` in the plugin.
- DECIDED (Jul 2026, paste target = bounding box of ALL ranges): `#handleNativePaste` MUST compute `targetRow/targetCol` + `bounds` from min/max over **every** `selection.ranges`, NOT `ranges[0]`. WHY: a real range-mode selection of N cells in a column is stored as N SINGLE-CELL ranges (often with duplicates), so `ranges[0]` saw 1×1 → `bounds=null` → only the first cell pasted. The bounding box also normalizes reversed drags. `isMultiCell = mode ∈ {range,row} && (minRow!==maxRow || minCol!==maxCol)`. The programmatic `setRanges([oneContiguousRange])` path masks it — the repro test uses multiple single-cell ranges.
- DECIDED (Jul 2026, paste anchor fallback): target = `firstRange ? boundingBoxTopLeft : (selection.anchor ?? {0,0})`. WHY: range mode CLEARS `selection.ranges` on plain keyboard navigation (see SelectionPlugin `afterRender` `pendingKeyboardUpdate`), keeping only `anchor` — so "copy, arrow to another cell, paste" hit the old `: 0` fallback and pasted into cell (0,0). `anchor` is a VISIBLE-column index (matches `_visibleColumns[targetCol]`).
- DECIDED (Jul 2026, COPY anchor fallback + stale attr): `#handleCopy` with empty `ranges` resolves the active cell via `selection.anchor` FIRST (visible-col index → `visibleColumns[anchor.col].field`), then the focused DOM cell — after keyboard nav `document.activeElement` is NOT a cell, so the DOM-only fallback made keyboard Ctrl+C a silent no-op. Also `#getFocusedCellFromDOM` queried `[data-field-cache]`/`dataset.fieldCache`, an attribute that never existed; fixed to `.cell[data-field]` + `dataset.field`. INVARIANT: `anchor` (visible index) and the DOM fallback (`this.columns` full index) are DIFFERENT index spaces — resolve each to a `field` separately, never mix.
- DECIDED (Jul 2026, header strip on paste): `#dropCopiedHeaderRow` removes a copied header row from `parsed` BEFORE building `PasteDetail`. Guarded: only when `config.includeHeaders` AND `parsed.length > 1` AND **every cell of `parsed[0]` is one of this grid's column labels** (`#columnLabels()` = Set of `header || field` over ALL columns). The full-label-set match (not target-column-only) is what makes a CROSS-COLUMN paste strip the header too. External pastes are left intact.
- INVARIANT (paste editability): paste writes ONLY to cells EditingPlugin approves via the `getCellEditableResolver` query (`(field,row)=>boolean` applying `#isCellEditable` — rowEditable gate + `editable` true/false/**function**, row-conditional honored). No EditingPlugin → query unanswered → predicate defaults to `() => false` → paste is a no-op. Editability is resolved against the PRE-paste row snapshot.
- DECIDED (Jul 2026, paste routes through `updateRows`): `defaultPasteHandler` routes edits through `grid.updateRows(updates, 'paste')` for rows with a resolvable `getRowId`, so paste participates in dirty tracking, undo history, validation and veto (via `commitCellValue`). Rows without an id (or a throwing `getRowId`), plus freshly-grown rows for unbounded pastes, fall back to direct `Object.assign`. This SUPERSEDES the old "raw string, no validation" behavior for the id-backed path.
- DECIDED (Jul 2026, per-column `onPaste` + source): (1) column `onPaste?: boolean | (ctx: PasteCellContext) => boolean | { value }` (augmented onto `BaseColumnConfig`) applies in `defaultPasteHandler`'s `addEdit` chokepoint AFTER the editability check — `false` skips the cell (alignment preserved), `{ value }` rewrites it. Returning `{ value }` rather than a bare value keeps boolean columns unambiguous. Sync only. (2) Paste commits with source `'paste'` (was `'api'`). `PasteCellContext` carries `sourceField` (origin column) so `onPaste` can reject cross-type pastes; threaded via `#internalClipboard.fields` / `payload.fields` → `PasteDetail.sourceFields` → `sourceFields?.[colOffset]` (mod `srcCols` when tiling); `undefined` for external (Excel) pastes. The full source column DEFINITION is deliberately not offered (not serializable cross-grid).
- DECIDED (Jul 2026, `paste-rejected`): `PasteRejectedDetail = { rejected: PasteRejectedCell[] }`, reason `'column'` (`onPaste:false`) or `'cell'` (callback false); emitted ONCE per paste even when everything was rejected (before the early return). Non-editable skips are NOT reported (by design). Resolution logic is extracted into exported pure helpers `resolveColumnPaste(onPaste, ctx)` + `emitPasteRejected(grid, rejected[])` — a custom `ClipboardConfig.pasteHandler` MUST call them to honor `onPaste` and emit the event. Adapter parity: wired in all 3 clipboard directives + added to Angular `_intentionallyOmittedEvents` (else `_assertEventOutputMapCoversCore` fails the build).
- DECIDED (Nov 2025, perf): `parseClipboardText` ([paste.ts](libs/grid/src/lib/plugins/clipboard/paste.ts)) MUST extract cells via a single `normalized.slice(cellStart, i)`, not `currentCell += char` (10K-row no-quotes 168→455 hz, mixed 164→289 hz; quoted cells take the rare `unquoteCell()` path). `formatCellValue` (copy.ts) and `formatCsvValue` ([csv.ts](libs/grid/src/lib/plugins/export/csv.ts)) MUST dispatch `typeof === 'string'` BEFORE `instanceof Date` (`buildCsv` 10K rows 57.9→77.7 hz). Bench: `clipboard.bench.ts`.

### Export

OWNS: export format/state. Download methods (`exportCsv`/`exportExcel`/`exportJson`) AND data accessors (`export()`/`formatCsv()`/`formatExcel()`/`getResolvedColumns()`) for ExcelJS/server hand-off. `mode: 'raw' | 'formatted'` (default raw).

- DECIDED (Jul 2026): `buildExcelXml` orchestrates only — `buildStylesXml` (also pre-registers every dynamic `cellStyle` result so data-cell style IDs exist), `buildColumnWidthsXml`, `buildPluginHeaderRowsXml` (group headers, `span>1` → `ss:MergeAcross="span-1"`), `buildHeaderRowXml`, `buildDataRowsXml` (+ pure `toExcelData(value)` → `{type,displayValue}`). `includeHeaders !== false` gates BOTH header helpers.
- DECIDED (#240): plugins MUST NOT import from `core/internal/rows.ts` at module scope (module-level `document.createElement('template')` crashes happy-dom-less tests + pollutes plugin bundles) — inline small helpers like `resolveFormat` instead.
- DECIDED (#240): pre-resolving rows for downstream `buildCsv`/`buildExcelXml` (which re-call `resolveCellValue`) MUST strip `column.valueAccessor` from the passed columns — accessors mis-resolve against a synthetic `Record<string,unknown>` keyed by `field`.
- DECIDED (audit 2026-08-07, CWE-1236): `formatDelimitedValue(value, opts)` in `plugins/shared/data-collection.ts` is the single delimited-text formatter for CSV export and clipboard copy. Prefixes `'` onto **string** values starting with `= + - @ TAB CR` (spreadsheet formula injection), default ON, opt out via `CsvOptions.escapeFormulas` / `ClipboardConfig.escapeFormulas`. WHY strings only: `-5` is unambiguously numeric to a spreadsheet. `quoting` is tri-state `'auto'|'always'|'never'`. `formatCsvValue`/`formatCellValue` remain thin wrappers (imported by specs + benches). PERF: `buildCsv`/`buildClipboardText` build the options object ONCE outside the loops — 50K×6 cells, no per-cell alloc. Spec: `plugins/shared/data-collection-security.spec.ts`.
- NOTE: `plugins/export/excel.ts` is NOT formula-injectable (writes `ss:Type="String"`). Grid-to-grid paste is unaffected too — it uses the structured `text/html` payload, not the escaped text.

### Print

OWNS: print styling; exposes print methods. No shell dependency.
