---
domain: grid-plugins-catalog-data
related: [grid-plugins, grid-plugins-catalog-ui, grid-core, grid-data-pipeline, grid-features]
---

# Plugin Catalog — Data & Model Plugins

> Plugin system (manager, lifecycle, hooks, manifest) → grid-plugins.md. Shell → grid-plugins-shell.md. Interaction/display plugins (Selection, MasterDetail, Reordering, Responsive, Tooltip, StickyRows, ContextMenu) → grid-plugins-catalog-ui.md. Editing/UndoRedo → grid-plugins-editing.md.

## Row-Transforming (`modifiesRowStructure: true`)

### ServerSide

OWNS: fetch cache, lazy blocks, placeholders (`{__loading,__index}`), `managedNodes`, `blockControllers: Map<number,AbortController>`.
HOOKS: processRows(-10) — IGNORES input, returns viewport-clamped `managedNodes`.
EVENTS: `datasource:data|children|loading|error`. QUERIES: `datasource:fetch-children`, `datasource:is-active`. LISTENS: `sort-change`, `filter-change`.

- INVARIANT: `totalNodeCount = -1` → infinite scroll; `0` → unknown; short block auto-detects end. `grid.sourceRows` stays empty. `onModelChange` MUST call `loadRequiredBlocks()` after cache clear. Block resolution with `previousManagedLength === 0` OR `detail.claimed` OR `managedNodes.length < totalNodeCount` MUST `requestRender()` ROWS (`claimed`: a structural plugin derives its own model from `managedNodes`, so the in-place element swap is invisible to it — without ROWS the tail stays blank forever) (`requestVirtualRefresh()` skips processRows). `loadRequiredBlocks()` first expands the viewport by `loadThreshold` rows both ways.
- DECIDED (Apr 2026): core `applySort`/`grid.sort()` emits `sort-change` to BOTH DOM and plugin bus (`_pluginManager.emitPluginEvent`). WHY: without MultiSort ServerSide misses it. `setDataSource()` calls `loadRequiredBlocks()` only when `loadThreshold > 0`, and puts block 0 in `loadingBlocks`.
- DECIDED (Apr 2026, AbortSignal + Subscribable): `getRows()` gets a non-aborted `params.signal` (REQUIRED); returns `Promise<GetRowsResult>` OR a duck-typed `Subscribable` (`{subscribe(observer):{unsubscribe()}}`, no RxJS dep), which cancels Angular HttpClient XHRs. Per-block `AbortController` aborted on `setDataSource`/`refresh`/`purgeCache`/`onModelChange`/`detach`; `toResultPromise` subscribes once, settles on `next`, unsubscribes on error/complete/abort; Promise sources rejected with `DOMException('Aborted','AbortError')`; a result-shape guard drops the result if abort lands before `loadedBlocks.set`. RULED OUT: a `fromObservable` helper. Files: `server-side/datasource.ts`, `server-side-plugin.ts#abortAllBlocks`.
- DECIDED (Feb 2026): `pageSize` canonical, `cacheBlockSize` a `@deprecated` alias; resolve at consumption (`pageSize ?? cacheBlockSize ?? 100`). `defaultConfig` MUST NOT set `pageSize`. `GetRowsParams.pageSize = endNode - startNode`.
- DECIDED (#273, `data-src`): plugins MAY read host `data-*` in `attach()` via `this.gridElement.getAttribute()`. No JS `dataSource` → `setDataSource(createUrlDataSource(src))` (`@internal`, fetch-once-and-cache; array or `{rows,totalNodeCount}`). A failed/aborted fetch MUST NOT be cached (`datasetPromise = null` in `.catch`). JS `config.dataSource` wins; NOT for true server pagination. INVARIANT: host `data-*` reads are INIT-TIME ONLY — `observedAttributes` is static (`rows`,`columns`,`grid-config`,`fit-mode`,`loading`); `grid-config` is the reactive escape hatch.
- DECIDED (#369): `FeatureConfig.serverSide` widened to `boolean | ServerSideConfig`; factory normalizes `true` → `new ServerSidePlugin()`. `{...true}` yields `{}`, no throw.
- TENSION: tall grid + small `pageSize` + no threshold needs a scroll to fill the viewport.
- Tests: `server-side.spec.ts` (AbortSignal, Subscribable, `loadBlock`, `createUrlDataSource`, `data-src`, boolean shorthand).

### Tree

OWNS: expanded keys, flattened rows, `rowKeyMap`, `#rowMeta` `WeakMap<row,FlattenedTreeRow>`, `#rowKeys` `WeakMap<row,string>`, animation state, `loadingKeys`/`loadedKeys`, `#childRequests: Map<key,AbortController>`.
HOOKS: processRows(10), processColumns, afterCellRender, afterRender, onCellClick, onHeaderClick, renderRow, getRowHeight, adjustVirtualStart.
QUERIES: `canMoveRow`, `datasource:viewport-mapping`, `sort:get-model`. EVENTS: `tree-expand`, `tree-load-start|end|error`. FIRES: `datasource:fetch-children`. LISTENS: `datasource:children|error` (filtered on `context.source === 'tree'`).

- DECIDED (v3.4.0, lazy loading): two routes, ServerSide wins. `requestLazyChildren` checks `datasource:is-active` **via `queryBoolean`** (#430 — raw `query()` returns a truthy `[]`). Else `TreeConfig.loadChildren` (Promise or `Subscribable`, per-request `AbortController`, aborted on `detach()`). `Subscribable` is **take-one** — `finish()` removes the controller `detach()` would abort; a `settled` flag covers synchronous emission. Ref: `TreePlugin.#loadChildrenLocally`, `tree-integration.spec.ts`.
- INVARIANT (#430): `detectTreeStructure(rows, childrenField, hasChildren)` MUST receive `config.hasChildren` (predicate-only lazy trees have no `children` field), else detection returns false. File: [tree-detect.ts](libs/grid/src/lib/plugins/tree/tree-detect.ts).
- INVARIANT: lazy children are signalled by a truthy non-array `childrenField` or a `TreeConfig.hasChildren` predicate; single-batch (no pagination). `loadedKeys` (NOT `row[childrenField].length`) gates re-fetch; fetched at most once per attach, errors do NOT mark loaded. `datasource:error` MUST be handled — else the key stays in `loadingKeys` forever and retries short-circuit.
- INVARIANT: loading UI reuses core `createDefaultSpinner('small')` (+ `.tree-loading` sizing in `@layer tbw-plugins`). `afterRender` sets AND removes `aria-busy` (explicit negative branch).
- DECIDED (#264, WAI-ARIA treegrid): Tree or GroupingRows registered → `.rows-body` `role` swaps `grid` → `treegrid` + per-visible-row `aria-level`/`aria-setsize`/`aria-posinset`, set idempotently in `afterRender`, `role="grid"` restored in `detach()`. Tree carries `posInSet`/`setSize` on `FlattenedTreeRow`; GroupingRows uses a parallel `flatMeta` array (`computeFlatMeta`). INVARIANT: `posInSet`/`setSize` are 1-based PER PARENT, not global rowIndex.
- INVARIANT (async rows): `processColumns` is a no-op while `flattenedRows` is empty, and a ROWS-only render never re-runs COLUMNS — so rows arriving asynchronously (`grid.rows = …` after `ready()`, or a ServerSide block) would leave the tree column undecorated. `processRows` (BOTH branches) calls `#syncTreeColumn()`, which microtask-defers a `#treeColumnWrapped !== flattenedRows.length > 0` check and `requestColumnsRender()`s on mismatch.
- INVARIANT: `_schedulerMergeConfig` reseeds `#baseColumns` from `_columns`, so a plugin-installed `viewRenderer` is **already baked in** by the time `processColumns` runs — columns handed to a plugin are NOT pristine. To un-decorate, the plugin MUST actively restore `originalTreeColumnRenderer` (dropping the cache alone leaks the wrapper, and re-wrapping nests it).
- INVARIANT (perf): `flattenTree` allocates one result array; recursive `appendFlattenedRows` appends preorder rows into it. Do NOT return/spread child arrays: wide expanded nodes can exceed the JS argument limit. Bench: `tree-data.bench.ts`.

### GroupingRows

OWNS: grouped row model, expanded keys, animation state. HOOKS: processRows(10), onHeaderClick(-1), renderRow. QUERIES: `canMoveRow`, `grouping:get-grouped-fields`, `datasource:viewport-mapping`. EVENTS: `group-toggle|expand|collapse`.

- DECIDED (#335, deferred expansion): `setGroupOn(fn, expanded?)` takes `DefaultExpandedValue: boolean|number|string|string[]` seeding expansion against the NEW group set on the next rebuild (sets `groupConfigDirty`); `expandAll`/`collapseAll` called right after it ALSO defer via `pendingExpansion`. `processRows` snapshots+clears `pendingExpansion` at the top, resolves against fresh `getGroupKeys(initialBuild)` and broadcasts `group-toggle` once.
- INVARIANT: bulk `group-toggle` emissions MUST use `broadcast<GroupToggleDetail>`, not `emitPluginEvent`. `GroupToggleDetail.{key,expanded,value,depth}` are optional (bulk carries only `expandedKeys`).

### Pivot

OWNS: pivot result, flattened pivot rows, expanded keys, column totals, sort state. HOOKS: onHeaderClick(-10), processRows(100). QUERIES: `sort:get-sort-config`. EVENTS: `pivot-toggle`, `pivot-config-change`.

- INVARIANT: `PivotRow.isGroup` means "has sub-groups" (`remainingFields.length > 0`), NOT "is a group row". A single `rowGroupFields` yields `isGroup: false`; `getAllGroupKeys()` returns nothing.
- DECIDED (Aug 2026, duplicate value fields + streaming): pivot value identity is `columnKey|field` for unique fields and adds `|aggFunc` (then config index for repeated identical aggregators) only when the field repeats. WHY: `PivotValueField` permits the same source field with multiple aggregators; field-only keys silently overwrote earlier results. Built-ins stream filtered numbers without arrays; repeated built-ins for one field share one row scan. Custom functions retain separate collected arrays. Owners: `pivot-model.ts#createValueKeys`, `pivot-engine.ts#aggregateValueFields`. Tests/bench: `pivot.spec.ts`, `pivot-engine.bench.ts`.
- DECIDED (#449, SC 2.5.7): plain `click` on a field chip opens `plugins/shared/drag-alternative-menu`. (a) `role`/`aria-label`/`tabindex=-1` sit on `.tbw-pivot-chip-label`, NOT the chip (the chip holds `.tbw-pivot-chip-remove`); available-field chips are childless so the role sits on the chip. (b) `chipMenu` is a MODULE-LEVEL singleton: `refreshPanel()` does `innerHTML=''` + re-render without running cleanup, so a per-chip menu would be torn out mid-click; `menu.open()` re-parents to the anchor's grid host ⇒ safe across grids; `renderPivotPanel` cleanup disposes+nulls it. (c) `onReorderFieldInZone` takes an INSERT-BEFORE index in the pre-move list ⇒ up = `index-1`, down = `index+2`. Owner: `pivot-panel.ts`. Tests: `pivot-panel.spec.ts` › "click-only chip menu (SC 2.5.7)".

### row-identity (ALL row-model plugins)

- DECIDED (Apr 2026): plugins MUST NOT spread/clone row objects in `processRows`. Output is either `===` the input refs or genuinely synthetic (group headers, pivot aggregates, ServerSide `__loading`/`managedNodes`). Decorate via parallel structures — `WeakMap<row,meta>` or wrappers (`RenderRow{kind:'data',row}`). WHY: `RowManager.updateRow` mutates `_rows[i]` in place; the next `processRows` rebuild discards clones. Audit: `expect(grid._rows[i]).toBe(sourceRows[i])`. Tests: `tree-row-update.spec.ts`.
- DECIDED (Apr 2026, sortHandler dispatch): plugins sorting USER DATA ROWS MUST resolve through `gridConfig.sortHandler ?? builtInSort`; async handlers can't be awaited in sync `processRows` → fall back to `builtInSort` (honors `sortComparator` + `valueAccessor`). EXCEPTIONS: GroupingRows (group nodes by agg), Pivot (row keys), clipboard/context-menu/excel-styles (indices), ServerSide (`managedNodes` is plugin-owned). Rules: (1) shallow-copy `[...rows]` when input could be user-owned (`TreePlugin#sortLevel`); (2) a Promise-returning handler needs `void result.catch(() => undefined)` BEFORE the sync fallback, and MUST NOT splice the resolved result into `managedNodes` async. PENDING: MultiSort `sortRowsInPlace` ignores `sortHandler` (signature mismatch).
- DECIDED (Apr 2026, public sort API): `column.sortComparator` is RECOMMENDED — survives every sort path (core/multi-sort/tree/server-side `sortMode:'local'`). `gridConfig.sortHandler` is an escape hatch only (bypassed by MultiSort, one field at a time). Server-side: `dataSource.getRows({sortModel})`.

## Column-Transforming

### PinnedColumns

OWNS: pinned state per column. HOOKS: processColumns(-10), afterCellRender. TENSION: runs first, before ColumnVirtualization.

- INVARIANT (sticky-cell painting): `.sticky-left`/`.sticky-right` carry opaque `background: var(--tbw-color-panel-bg)` (`rows.css`) + `position: sticky; z-index: 25` (`base.css`). So (1) row tints (`.row-focus`, `:hover`, `:nth-child(even)`) are HIDDEN under sticky cells — re-paint with `background: linear-gradient(<tint>,<tint>), var(--tbw-color-panel-bg)`; (2) `::after` border overlays need row-level `z-index: 26` (cell-level `::after { inset: 0 }` is clipped by `overflow: hidden`). Canonical: `selection.css .data-grid-row.row-focus`.

### ColumnVirtualization / Visibility

- ColumnVirtualization — OWNS: scroll-derived visible column subset. HOOKS: processColumns.
- Visibility — OWNS: hidden column set. HOOKS: processColumns. Requires the shell (`static dependencies` `{name:'shell',required:true}`; throws TBW020 otherwise).
- DECIDED (#449, SC 2.5.7): panel drag handles double as click triggers (`createDragAlternativeMenu('tbw-visibility-move-menu', …)`, Move up/down/to top/to bottom). Column entries route through `requestColumnMove(field, from, dropIndex)`, which replays the drop handler's math VERBATIM (`dropIndex>from ? dropIndex-1 : dropIndex` → `targetField` in the non-utility list → `findIndex` in FULL order → emit `column-reorder-request`) so click and drag can never diverge; "down" is `from+2` (insert-before index). Group entries reuse `executeGroupDrop` against a neighbour from `currentFragments()` (extracted out of `rebuildToggles`, recomputed per click so a stale panel can't move the wrong block). Owner: `visibility-plugin.ts`. Tests: `visibility-plugin.spec.ts` + `group-drag.spec.ts` › "click-only … move menu (SC 2.5.7)".

### GroupingColumns

OWNS: column group structure. HOOKS: processColumns.

- DECIDED (Jul 2026): `#getStableColumnGrouping` is a 3-tier chain `#groupsFromResolvedDefs() ?? #groupsFromActiveGroups() ?? #groupsFromInlineColumns()` then `#sortGroupFieldsByDisplayOrder`. Tier order is load-bearing and MUST use `??` (not `||`) — tier 1 legitimately returns `[]` when every declarative def is filtered out and must short-circuit. Module-level `mergeInlineGroup(map, col)` is the shared inline-`group` upsert; tier 2 folds hidden columns into the SAME Map before `Array.from`.

## Sorting & Filtering

### MultiSort

OWNS: `sortModel[]`, cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: `sort:get-model`, `sort:set-model`. EVENTS: `sort-change`.

- INVARIANT: MultiSort is the AUTHORITATIVE sort source — Tree and GroupingRows must query `sort:get-model` when it is loaded, never keep independent sort state.
- TENSION: caches the sort during a row edit so the edited row doesn't jump.

### Filtering

OWNS: `filterModels` Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: `filter-change`.

- INVARIANT: numeric ops (`greaterThan`/`>=`/`<`/`<=`/`between`) MUST exclude blanks (null/undefined/''/NaN) before coercion (`null >= 0` is true, `Number('') === 0`). Blanks match ONLY the explicit `blank` operator; NaN counts as blank.
- DECIDED (Apr 2026): the number filter panel's Apply clears the filter when both bounds are still data-derived defaults (else `between(dataMin,dataMax)` excludes blank rows).
- DECIDED (Apr 2026): `getDataRows()` prefers `sourceRows`, falling back to `grid.rows.filter(r => r.__loading !== true)`, so ServerSide hosts get unique values from loaded blocks without a `valuesHandler`; async `valuesHandler` remains canonical for a full server-side dataset.
- DECIDED (Jul 2026, `compileFilter`): a `??` chain — `compileBlankPredicate` → `compileSetPredicate` (in/notIn share one Set + `negate`) → `compileNumericPredicate` → `compileTextPredicate` → `() => true`. Order matters (blank/set claimed first). INVARIANT (perf): emitted per-row closures MUST stay specialized — do NOT collapse the 5 numeric ops or 12 text variants behind a shared comparator lookup (~8 % regression on `filter-model.bench > blank check`). File: [filter-model.ts](libs/grid/src/lib/plugins/filtering/filter-model.ts).

## Pinned Rows

### PinnedRows

OWNS: pinned row positions (top/bottom), info bar (counts/panels), aggregation rows. HOOKS: afterRender. READS: `grid.sourceRows` (`totalRows`), `grid.rows` (`filteredRows`), filter plugin `cachedResult` (preferred), selection plugin `selected`.

- INVARIANT: `filteredRows` reflects the post-filter count regardless of mechanism (filter plugin, column filters, server-side, direct `grid.rows =`). DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not the `rows` argument.
- INVARIANT: **aggregation VALUES are computed over `grid.sourceRows`, not the filtered set** — `PinnedRowsPlugin` passes `this.sourceRows` into `buildContext`/`renderAggregationSlot`. So filtering changes the *count* panels but leaves `.tbw-aggregation-cell` totals untouched. WHY: `grid.rows` can hold group markers and ServerSide `__loading` placeholders, which would corrupt sums. Consequence: any test or demo asserting "filter, and the total follows" is asserting behaviour the plugin does not have.
- DECIDED (#255, unified slots): `slots[]` replaces `aggregationRows[]` + `customPanels[]`; each slot is one DOM row, discriminated by presence of `render` → `PanelSlot`, else `AggregationSlot`. With `slots` set ALL legacy fields are ignored; legacy without `slots` keeps byte-identical DOM via `synthesizeLegacySlots`. `PanelRender` returns `HTMLElement | null` — null drops the contribution, and an all-null panel is dropped entirely (how `selectedCountPanel()` self-hides; adapters propagate null). Top slots render in `.tbw-header-pinned` AFTER `.header`, bottom in `.tbw-footer`; wrapper hidden under `tbw-grid[data-responsive]`.
- INVARIANT: built-in `rowCountPanel`/`selectedCountPanel`/`filteredCountPanel` are exported from `@toolbox-web/grid/plugins/pinned-rows` and hardcoded English — i18n consumers build their own renderer (do NOT add locale options).
- DECIDED (May 2026, demo-loop fix): `renderPanelSlot(slot, context, previousRow?)` is REF-CACHED — returns `previousRow` when every output is ref-equal; `populateSlotWrapper` diffs by ref and skips `replaceChildren`. WHY: consumers were remounted every `afterRender` (~30 Hz) → ResizeObserver autosizing loop. Built-in panels create a fresh element per call (so they keep updating). Contract: return the same element ref to opt into stable rendering.
- TENSION: panels rebuild only in `afterRender` and the plugin subscribes to **no** selection event, so `selectedCountPanel()` stays collapsed until another change forces a render (repro: `pinned-rows/PinnedRowsDefaultDemo`). Fix would be a `selection-change` subscription calling `requestRender()`.

## Export

### Clipboard

OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl+C/V/X). DEPENDS: selection (optional).

- DECIDED (Jul 2026, structured payload): copy writes WYSIWYG `text/plain` (via `processCell`), snapshots RAW values in `#internalClipboard = {text, rawRows, fields}`, and writes `text/html` — a `<table>` whose root carries a base64 `data-tbw-clip` payload. Paste value precedence: (1) in-memory match on `text` (preserves `Date`), (2) `parseClipboardHtmlPayload(getData('text/html'))`, (3) parsed text. Winner → `PasteDetail.rawRows`; `defaultPasteHandler` uses `rawRows ?? rows` + `cloneStructured` per value so tiled pastes never share a ref. Codec MUST live in [clipboard-payload.ts](libs/grid/src/lib/plugins/clipboard/clipboard-payload.ts), NOT copy.ts/paste.ts (circular import → TDZ at test load).
- DECIDED (Jul 2026, `fillSelection`): default `false`; tiles a smaller source across a larger **bounded** selection by modulo indexing. `#handleNativePaste` sets `PasteDetail.fillSelection` (only when `bounds != null`) and widens `fields` to the selection width; `defaultPasteHandler` iterates bounds with `pastedRows[r%srcRows]` / `sourceRow[c%srcCols]`. Never grows the grid; non-editable columns still skipped; `detail.rows` stays the source. RULED OUT: pre-tiling `parsed` in the plugin.
- DECIDED (Jul 2026, PASTE target resolution): `#handleNativePaste` MUST derive `targetRow/targetCol` + `bounds` from min/max over **every** `selection.ranges`, NOT `ranges[0]` (range mode stores N selected cells as N SINGLE-CELL ranges, so `ranges[0]` sees 1×1 → `bounds=null` → only the first cell pastes; the repro test uses multiple single-cell ranges). The bbox also normalizes reversed drags. `isMultiCell = mode ∈ {range,row} && (minRow!==maxRow || minCol!==maxCol)`. With no range, target = `selection.anchor ?? {0,0}` (range mode CLEARS `ranges` on keyboard nav — SelectionPlugin `afterRender` `pendingKeyboardUpdate`). `anchor` is a VISIBLE-column index (`_visibleColumns[targetCol]`).
- DECIDED (Jul 2026 + Aug 2026 #453, COPY target resolution): `#resolveData` MUST derive row AND column bounds from min/max over **every** `selection.ranges` (was `ranges[ranges.length-1]`) and return `contains(rowOffset,colOffset)` — non-null ONLY when both axes came from the selection; `#buildDisplayGrid` emits `''` outside every range (Excel-style multi-range copy). The mask applies to `text/plain`, the `text/html` table AND `rawRows`, and MUST be skipped when `options.columns`/`options.rowIndices` are supplied (else `copyRows()` blanks everything). Offsets → absolute indices via captured `rowIndices`/`colIndices`; `resolveColumns()` drops hidden/utility columns so `minCol + offset` is WRONG. With empty `ranges`, `#handleCopy` resolves the active cell via `selection.anchor` FIRST (visible-col index → `visibleColumns[anchor.col].field`), then the focused DOM cell (`.cell[data-field]` + `dataset.field`). INVARIANT: `anchor` (visible index) and the DOM fallback (`this.columns` full index) are DIFFERENT index spaces — resolve each to a `field` separately, NEVER mix.
- INVARIANT (row mode ≠ range mode on copy): in `mode: 'row'` the selection query merges Ctrl+clicked indices into SEVERAL whole-row ranges (`SelectionPlugin` `toSelectionResult`: rows sorted, contiguous runs merged, each `col 0..colCount-1`). Columns are NOT selection-derived there, so `contains` is null and no mask exists — `#resolveData` MUST DROP rows in the `minRow..maxRow` span that no range covers.
- DECIDED (Jul 2026, header strip on paste): `#dropCopiedHeaderRow` removes a copied header row from `parsed` BEFORE building `PasteDetail`, only when `config.includeHeaders` AND `parsed.length > 1` AND **every cell of `parsed[0]` is one of this grid's column labels** (`#columnLabels()` = Set of `header || field` over ALL columns). The full-label-set match (not target-column-only) is what strips the header on a CROSS-COLUMN paste; external pastes left intact.
- INVARIANT (paste editability): paste writes ONLY to cells EditingPlugin approves via the `getCellEditableResolver` query (`(field,row)=>boolean` applying `#isCellEditable` — rowEditable gate + `editable` true/false/**function**). No EditingPlugin → query unanswered → predicate defaults to `() => false` → paste is a no-op. Resolved against the PRE-paste row snapshot.
- DECIDED (Jul 2026, paste routes through `updateRows`): `defaultPasteHandler` uses `grid.updateRows(updates, 'paste')` for rows with a resolvable `getRowId`, so paste participates in dirty tracking, undo history, validation and veto (via `commitCellValue`). Rows without an id (or a throwing `getRowId`) and freshly-grown rows for unbounded pastes fall back to `Object.assign`.
- DECIDED (Jul 2026, per-column `onPaste` + source): `onPaste?: boolean | (ctx: PasteCellContext) => boolean | { value }` (augmented onto `BaseColumnConfig`) applies at `defaultPasteHandler`'s `addEdit` chokepoint AFTER the editability check — `false` skips the cell (alignment preserved), `{ value }` rewrites it. Sync only. Paste commits with source `'paste'` (was `'api'`). `PasteCellContext.sourceField` (origin column) enables cross-type rejection; threaded `#internalClipboard.fields`/`payload.fields` → `PasteDetail.sourceFields` → `sourceFields?.[colOffset]` (mod `srcCols` when tiling), `undefined` for external (Excel) pastes. The source column DEFINITION is deliberately not offered (not serializable cross-grid).
- DECIDED (Jul 2026, `paste-rejected`): `PasteRejectedDetail = { rejected: PasteRejectedCell[] }`, reason `'column'` (`onPaste:false`) or `'cell'` (callback false); emitted ONCE per paste, even when everything was rejected (before the early return). Non-editable skips NOT reported. Exported pure helpers `resolveColumnPaste(onPaste, ctx)` + `emitPasteRejected(grid, rejected[])` — a custom `ClipboardConfig.pasteHandler` MUST call them. Adapter parity: all 3 clipboard directives + Angular `_intentionallyOmittedEvents` (else `_assertEventOutputMapCoversCore` fails the build).
- DECIDED (Nov 2025, perf): `parseClipboardText` ([paste.ts](libs/grid/src/lib/plugins/clipboard/paste.ts)) MUST extract cells via a single `normalized.slice(cellStart, i)`, not `currentCell += char` (10K rows 168→455 hz). `formatCellValue` (copy.ts) and `formatCsvValue` ([csv.ts](libs/grid/src/lib/plugins/export/csv.ts)) MUST dispatch `typeof === 'string'` BEFORE `instanceof Date` (`buildCsv` 57.9→77.7 hz). Bench: `clipboard.bench.ts`.

### Export

OWNS: export format/state. Download methods (`exportCsv`/`exportExcel`/`exportJson`) AND data accessors (`export()`/`formatCsv()`/`formatExcel()`/`getResolvedColumns()`) for ExcelJS/server hand-off. `mode: 'raw' | 'formatted'` (default raw).

- DECIDED (Jul 2026): `buildExcelXml` orchestrates only — `buildStylesXml` (pre-registers dynamic `cellStyle` results so data-cell style IDs exist), `buildColumnWidthsXml`, `buildPluginHeaderRowsXml` (group headers, `span>1` → `ss:MergeAcross="span-1"`), `buildHeaderRowXml`, `buildDataRowsXml` (+ pure `toExcelData(value)` → `{type,displayValue}`). `includeHeaders !== false` gates BOTH header helpers.
- DECIDED (#240): plugins MUST NOT import from `core/internal/rows.ts` at module scope (its module-level `document.createElement('template')` crashes happy-dom-less tests + pollutes plugin bundles) — inline small helpers like `resolveFormat`.
- DECIDED (#240): pre-resolving rows for downstream `buildCsv`/`buildExcelXml` (which re-call `resolveCellValue`) MUST strip `column.valueAccessor` from the passed columns — accessors mis-resolve against a synthetic `Record<string,unknown>` keyed by `field`.
- DECIDED (audit 2026-08-07, CWE-1236): `formatDelimitedValue(value, opts)` in `plugins/shared/data-collection.ts` is the single delimited-text formatter for CSV export + clipboard copy. Prefixes `'` onto **string** values starting with `= + - @ TAB CR`, default ON, opt out via `CsvOptions.escapeFormulas` / `ClipboardConfig.escapeFormulas`. `quoting` is tri-state `'auto'|'always'|'never'`. `formatCsvValue`/`formatCellValue` remain thin wrappers. PERF: `buildCsv`/`buildClipboardText` build the options object ONCE outside the loops. Spec: `plugins/shared/data-collection-security.spec.ts`.
- NOTE: `plugins/export/excel.ts` is NOT formula-injectable (writes `ss:Type="String"`); grid-to-grid paste uses the structured `text/html` payload.

### Print

OWNS: print styling; exposes print methods. No shell dependency.
