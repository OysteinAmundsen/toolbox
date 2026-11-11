---
domain: grid-plugins-catalog-data
related:
  [
    grid-plugins,
    grid-plugins-catalog-ui,
    grid-plugin-pinned-columns,
    grid-plugin-server-side,
    grid-plugin-pivot,
    grid-core,
    grid-data-pipeline,
    grid-features,
  ]
---

# Plugin Catalog — Data & Model Plugins

> Plugin system (manager, lifecycle, hooks, manifest) → grid-plugins.md. ServerSide → grid-plugin-server-side.md. Pivot → grid-plugin-pivot.md. Row hierarchy (Hierarchy, Tree, GroupingRows) → grid-plugins-hierarchy.md. Shell → grid-plugins-shell.md. Interaction/display plugins (MasterDetail, Reordering, Responsive, Tooltip, StickyRows) → grid-plugins-catalog-ui.md; Selection, ContextMenu → grid-plugin-selection.md. Editing/UndoRedo → grid-plugins-editing.md.

## Row-Transforming (`modifiesRowStructure: true`)

### ServerSide

→ grid-plugin-server-side.md (block cache, placeholders, viewport fill, AbortSignal + child-fetch contract, `data-src`). Cross-refs kept here: MultiSort #521 and Filtering #520 honour `datasource:sort-mode`/`filter-mode`; row-identity rule below.

### Pivot

→ grid-plugin-pivot.md (column regeneration, runtime-state carry, source restore, pinned pivot cells, utility-column omission, value keys, panel a11y).

### row-identity (ALL row-model plugins)

- DECIDED (Apr 2026): plugins MUST NOT spread/clone row objects in `processRows`. Output is either `===` the input refs or genuinely synthetic (group headers, pivot aggregates, ServerSide `__loading`/`managedNodes`). Decorate via parallel structures — `WeakMap<row,meta>` or wrappers (`RenderRow{kind:'data',row}`). WHY: `RowManager.updateRow` mutates `_rows[i]` in place; the next `processRows` rebuild discards clones. Audit: `expect(grid._rows[i]).toBe(sourceRows[i])`. Tests: `tree-row-update.spec.ts`.
- DECIDED (Apr 2026, sortHandler dispatch): plugins sorting USER DATA ROWS MUST resolve through `gridConfig.sortHandler ?? builtInSort`; async handlers can't be awaited in sync `processRows` → fall back to `builtInSort` (honors `sortComparator` + `valueAccessor`). EXCEPTIONS: GroupingRows (group nodes by agg), Pivot (row keys), clipboard/context-menu/excel-styles (indices), ServerSide (`managedNodes` is plugin-owned). Rules: (1) shallow-copy `[...rows]` when input could be user-owned (`TreePlugin#sortLevel`, MultiSort); (2) a Promise-returning handler needs `void result.catch(() => undefined)` BEFORE the sync fallback, and MUST NOT splice the resolved result into `managedNodes` async. PENDING: MultiSort `sortRowsInPlace` ignores `sortHandler` (signature mismatch).
- DECIDED (Apr 2026, public sort API): `column.sortComparator` is RECOMMENDED — survives every sort path (core/multi-sort/tree/server-side `sortMode:'local'`). `gridConfig.sortHandler` is an escape hatch only (bypassed by MultiSort, one field at a time). Server-side: `dataSource.getRows({sortModel})`.

## Column-Transforming

PinnedColumns → grid-plugin-pinned-columns.md.

### ColumnVirtualization / Visibility

- ColumnVirtualization — OWNS: scroll window (`startCol`/`endCol`/`#leftPadding`), widths/offsets, focus follow/park (#633). HOOKS: `windowColumns` (+ onScroll, afterRender, onKeyDown). QUERIES: `revealColumn` (column/field → scroll into window), `offWindowFocus` (parked column → core `focusedCell.field`).
  - INVARIANT (#633 focus): when `windowColumns` narrows either window, `#followFocus` remaps `_focusCol` by identity; unwindowed indices stay full-list. Off-window focus parks at `-1` while that value remains unchanged (any other write clears the park; hidden/removed column → 0). `onKeyDown` (priority −100, never claims keys) reveals via `_focusColumn` only for non-modifier keys from the host or an own body `.cell`; headers/in-cell controls keep their keys (sync re-render would detach them, PR #644). Unrevealable → 0; `detach` restores a full-list index. Test: `integration/column-virtualization-selection.spec.ts`.
  - DECIDED (#603): `windowColumns` is the sole windowing stage, called lazily from `_visibleColumns` after `processColumns`; `_columns`, `grid.columns`, `#baseColumns`, APIs and exports stay full-list. RULED OUT (#604): feeding the window back into `processColumns`, feedback heuristics, `'getFullColumns'` query. Test: `integration/column-virtualization-data-collection.spec.ts`.
  - INVARIANT: pinned/utility columns are never windowed out (`pinned ?? meta.pinned`); `#leftPadding` = `offset(startCol)` minus their pre-window widths. CV pads its own header/data rows inline and publishes `--tbw-column-window-offset` for other plugins' rows (GroupingColumns, PinnedRows); those rows use the variable because inline padding loses to hook order. Every consuming stylesheet resets it per host (`tbw-grid, [data-tbw-grid]`) so nested/versioned grids keep independent offsets. Width changes fall back from `#applyColumnState`'s fast path to `#setup()` when rendered fields change.
  - INVARIANT: DOM-index consumers use `visibleColumns` (MasterDetail span, GroupingRows, PinnedColumns offsets, Pivot cells/footers). Traversals across columns resolve a field/full-list index, then walk the full visible list: the rendered list is window + pins, so stepping it can land on pinned-right columns.
  - DECIDED (#633): TWO index spaces — RENDERED (`data-col`, `_focusCol`, `ContextMenuParams.columnIndex`, `CellClickEvent.colIndex`) vs SELECTION (`columns.filter(!hidden)`: Selection state, `CellRange.col`, Clipboard, ARIA); equal without windowing. A range from `c10` to rendered-adjacent pinned `c179` spans all columns (`#639 r13`). Navigation (core Arrow/Tab/Home/End, Editing Tab, `beginCellEdit`) uses the full visible list + `_focusColumn`; editor rows re-window by field (grid-render-pipeline.md). Selection → grid-plugin-selection.md; focus → above + grid-core.md. Open: #635 Responsive cards, #641 resize doesn't re-window.
  - DECIDED (#642): `aria-colcount` = full visible count; `aria-colindex` = each rendered column's 1-based position in the full visible (SELECTION) list, not the rendered window. `_visibleColumns` cache miss resolves window members identity-first, then by field via `indexOfColumn`, and stores `_ariaColIndex` only when windowed (unset → `i + 1`, zero per-cell lookup); `header.ts`/`rows.ts` stamp via `aria.ts#ariaColIndex`; `_updateAriaCounts(rowCount)` reads the count itself. Test: `integration/column-virtualization-aria.spec.ts`.
  - INVARIANT: hide/show recounts `isVirtualized`; `afterRender` clears stale styles once. `onScroll` stores `scrollLeft` but requests a window render only when range/total width changes (including in-place width edits).
  - DECIDED (PR #639 r12/#645): `onScroll`/`revealColumn` → `requestColumnWindowRender` → HEADER + `_schedulerRewindow` (cache, window epoch, template), never mergeConfig/processRows/processColumns or `data-change`. Horizontal scroll rAF flushes it before paint; pending COLUMNS subsumes it. Rows retain overlapping cells via `rewindowRow` → grid-render-pipeline.md. No larger default overscan or faux horizontal scroller: preserve native scrolling and the existing DOM bound. Tests: `column-virtualization-recycling.spec.ts`, `e2e/tests/column-virtualization-performance.spec.ts` (200 columns × 1k rows, bidirectional steps through 10 viewports/frame).
- Visibility — OWNS: hidden column set. HOOKS: processColumns. Requires shell (`static dependencies` `{name:'shell',required:true}`; throws TBW020 otherwise).
- DECIDED (#449, SC 2.5.7): panel drag handles double as click triggers (`createDragAlternativeMenu('tbw-visibility-move-menu', …)`, Move up/down/to top/to bottom). Column entries route through `requestColumnMove(field, from, dropIndex)`, which replays the drop handler's math VERBATIM (`dropIndex>from ? dropIndex-1 : dropIndex` → `targetField` in the non-utility list → `findIndex` in FULL order → emit `column-reorder-request`) so click and drag can never diverge; "down" is `from+2` (insert-before index). Group entries reuse `executeGroupDrop` against a neighbour from `currentFragments()` (extracted out of `rebuildToggles`, recomputed per click so a stale panel can't move the wrong block). Owner: `visibility-plugin.ts`. Tests: `visibility-plugin.spec.ts` + `group-drag.spec.ts` › "click-only … move menu (SC 2.5.7)".
- DECIDED (#651): Visibility `searchable:false` by default; matches `header || field` (trimmed, case-insensitive substring). Filter AFTER `currentFragments()` to preserve boundaries; group toggles target matches, Show All stays global, panel moves disabled during search. OWNS: transient instance query, stable input/polite status outside list rebuilds; `afterRender` compares rendered snapshots — INVARIANT: snapshot build stays O(n) (one first-wins field→config `Map` for `canMoveColumn`, no per-column `grid.columns.find`; PR #653). Shell rebuilds the panel on every config merge (see `grid-plugins-shell` TENSION) → cleanup captures a focused search's caret; next render restores it only if focus was dropped (own root focuses nothing; each ancestor root focuses nothing, `<body>`, or the shadow host on the path — browsers may leave that host as `document.activeElement`); `getToolPanel().onClose` (close/collapse, never config-refresh) clears a pending restore so a reopened panel never grabs focus. Tests: `visibility-plugin.spec.ts`, `integration/visibility-search-columns.spec.ts`, docs-e2e `visibility-and-print.spec.ts`.

### GroupingColumns

OWNS: column group structure. HOOKS: processColumns.

- INVARIANT (PR #639 r13): body `group-end` classes (`afterCellRender`) come from `#groupEndsFor(visibleColumns)`, cached on the RENDERED array's identity: the last column of every rendered group except the last. `afterRender`'s freshly merged groups always overwrite it, and `refresh()` drops it (a live `group` edit keeps the same array). A CV re-window rebuilds cells without `processColumns`, so a set written there (or in the old `column-move` precompute, removed) was a stale window's.
- DECIDED (Jul 2026): `#getStableColumnGrouping` is a 3-tier chain `#groupsFromResolvedDefs() ?? #groupsFromActiveGroups() ?? #groupsFromInlineColumns()` then `#sortGroupFieldsByDisplayOrder`. Tier order is load-bearing and MUST use `??` (not `||`) — tier 1 legitimately returns `[]` when every declarative def is filtered out and must short-circuit. Module-level `mergeInlineGroup(map, col)` is the shared inline-`group` upsert; tier 2 folds hidden columns into the SAME Map before `Array.from`.

## Sorting & Filtering

### MultiSort

OWNS: `sortModel[]`, cached sort result. HOOKS: processRows, onHeaderClick. QUERIES: `sort:get-model`, `sort:set-model`. EVENTS: `sort-change`.

- INVARIANT: MultiSort is the AUTHORITATIVE sort source — Tree and GroupingRows must query `sort:get-model` when it is loaded, never keep independent sort state.
- TENSION: caches the sort during a row edit so the edited row doesn't jump.
- DECIDED (#521): `processRows`: empty model OR `datasource:sort-mode` `'server'` → return input UNTOUCHED (data source sorted via `getRows({sortModel})`, placeholders keep block positions; a copy made ServerSide see every block load as derived). Else sort ONE own copy (`[...rows]` + `sortRowsInPlace`). WHY: plugin-manager does NOT copy between stages — input may BE consumer `grid.sourceRows`; in-place sort reordered it and `clearSort()` couldn't restore. Tests: `integration/server-side-sorting.spec.ts`, `multi-sort-source-rows.spec.ts`.
- Tree honors `datasource:sort-mode` too (#524) → grid-plugins-hierarchy.md (Tree).

### Filtering

OWNS: `filterModels` Map, cached unique values. HOOKS: processRows, afterRender, onHeaderClick, afterCellRender. EVENTS: `filter-change`. Generated-field filters (`rows:is-generated-field`) skip `processRows`; the generator asks `filter:get-predicate` (#622 → grid-plugin-pivot.md).

- INVARIANT: numeric ops (`greaterThan`/`>=`/`<`/`<=`/`between`) MUST exclude blanks (null/undefined/''/NaN) before coercion (`null >= 0` is true, `Number('') === 0`). Blanks match ONLY the explicit `blank` operator; NaN counts as blank.
- DECIDED (Apr 2026): the number filter panel's Apply clears the filter when both bounds are still data-derived defaults (else `between(dataMin,dataMax)` excludes blank rows).
- DECIDED (Apr 2026): `getDataRows()` prefers `sourceRows`, falling back to `grid.rows.filter(r => r.__loading !== true)`, so ServerSide hosts get unique values from loaded blocks without a `valuesHandler`; async `valuesHandler` remains canonical for a full server-side dataset.
- DECIDED (#520): `processRows` asks `datasource:filter-mode` (after the `filterHandler` passthrough). `'server'` → return input untouched (data source filtered with its own semantics; local re-filter zeroed the grid, dropped placeholders). `'local'` → `filterRows(…, keep = __loading)` (optional 5th arg) so placeholders keep their slots until their block lands. Tests: `integration/server-side-filtering.spec.ts`.
- INVARIANT (PR #525): the input-identity cache (`cachedInputRows`) is NOT sufficient alone — core passes `#rows` itself while no core sort is active, MultiSort/ServerSide pass input through, and edits/undo/rollback mutate rows in place. `attach()` nulls `cachedInputRows` on `cell-edit-committed`, `cell-edit-reverted` (Editing rollbacks) AND DOM `cell-change` (every `updateRow`/`updateRows`, incl. undo/redo `'history'` which skips `cell-edit-committed`). NOT `invalidateCache()`: async `filterHandler` serves `cachedResult`. Tests: `integration/filtering-edit-cache.spec.ts`.
- DECIDED (Jul 2026, `compileFilter`): a `??` chain — `compileBlankPredicate` → `compileSetPredicate` (in/notIn share one Set + `negate`) → `compileNumericPredicate` → `compileTextPredicate` → `() => true`. Order matters (blank/set claimed first). INVARIANT (perf): emitted per-row closures MUST stay specialized — do NOT collapse the 5 numeric ops or 12 text variants behind a shared comparator lookup (~8 % regression on `filter-model.bench > blank check`). File: [filter-model.ts](libs/grid/src/lib/plugins/filtering/filter-model.ts).

## Pinned Rows

### PinnedRows

OWNS: pinned row positions (top/bottom), info bar (counts/panels), aggregation rows. HOOKS: afterRender. READS: `grid.sourceRows` (`totalRows`), `grid.rows` (`filteredRows`), filter plugin `cachedResult` (preferred), selection plugin `selected`.

- INVARIANT: `filteredRows` reflects the post-filter count regardless of mechanism (filter plugin, column filters, server-side, direct `grid.rows =`). DECIDED (Apr 2026): `buildContext` derives counts from live grid state, not the `rows` argument.
- INVARIANT: **aggregation VALUES are computed over `grid.sourceRows`, not the filtered set** — `PinnedRowsPlugin` passes `this.sourceRows` into `buildContext`/`renderAggregationSlot`. So filtering changes the _count_ panels but leaves `.tbw-aggregation-cell` totals untouched. WHY: `grid.rows` can hold group markers and ServerSide `__loading` placeholders, which would corrupt sums. Consequence: any test or demo asserting "filter, and the total follows" is asserting behaviour the plugin does not have.
- DECIDED (#255, unified slots): `slots[]` replaces `aggregationRows[]` + `customPanels[]`; each slot is one DOM row, discriminated by presence of `render` → `PanelSlot`, else `AggregationSlot`. With `slots` set ALL legacy fields are ignored; legacy without `slots` keeps byte-identical DOM via `synthesizeLegacySlots`. `PanelRender` returns `HTMLElement | null` — null drops the contribution, and an all-null panel is dropped entirely (how `selectedCountPanel()` self-hides; adapters propagate null). Top slots render in `.tbw-header-pinned` AFTER `.header`, bottom in `.tbw-footer`; wrapper hidden under `tbw-grid[data-responsive]`.
- INVARIANT: built-in `rowCountPanel`/`selectedCountPanel`/`filteredCountPanel` are exported from `@toolbox-web/grid/plugins/pinned-rows` and hardcoded English — i18n consumers build their own renderer (do NOT add locale options).
- DECIDED (May 2026, demo-loop fix): `renderPanelSlot(slot, context, previousRow?)` is REF-CACHED — returns `previousRow` when every output is ref-equal; `populateSlotWrapper` diffs by ref and skips `replaceChildren`. WHY: consumers were remounted every `afterRender` (~30 Hz) → ResizeObserver autosizing loop. Built-in panels create a fresh element per call (so they keep updating). Contract: return the same element ref to opt into stable rendering.
- TENSION: panels rebuild only in `afterRender` and the plugin subscribes to **no** selection event, so `selectedCountPanel()` stays collapsed until another change forces a render (repro: `pinned-rows/PinnedRowsDefaultDemo`). Fix would be a `selection-change` subscription calling `requestRender()`.

## Export

### Clipboard

OWNS: clipboard buffer. HOOKS: onKeyDown (Ctrl/⌘+C only); paste = native `paste` listener on the host. NO cut (Ctrl+X) — never document it until implemented. DEPENDS: selection (optional).

- DECIDED (Jul 2026, structured payload): copy writes WYSIWYG `text/plain` via `processCell`, snapshots raw `{text, rawRows, fields}` in `#internalClipboard`, and writes an HTML table with a base64 `data-tbw-clip` payload. Paste precedence: matching in-memory text (preserves `Date`) → parsed HTML payload → parsed text; `defaultPasteHandler` clones each selected raw value. Codec stays in [clipboard-payload.ts](libs/grid/src/lib/plugins/clipboard/clipboard-payload.ts); importing it from `copy.ts`/`paste.ts` creates a TDZ cycle.
- DECIDED (Jul 2026, `fillSelection`): default `false`; modulo-tiles a smaller source only across a bounded selection. `#handleNativePaste` sets `PasteDetail.fillSelection` only with bounds and widens fields; `defaultPasteHandler` iterates the bounds. Never grows the grid; non-editable cells stay skipped and `detail.rows` remains source data. RULED OUT: pre-tiling `parsed`.
- DECIDED (Jul 2026, PASTE target): derive target/bounds from min/max across every `selection.ranges` (range mode can encode N cells as N single-cell ranges); this also normalizes reversed drags. `isMultiCell = axis ∈ {range,row} && (minRow!==maxRow || minCol!==maxCol)`. Without ranges use `selection.anchor ?? {0,0}` (keyboard nav clears ranges); anchor is a visible-column index, so resolve its field and walk the full visible list when unbounded. Bounded pastes use selected rendered columns.
- DECIDED (Jul 2026 + Aug 2026 #453, COPY target): derive bounds from every range and return `contains(rowOffset,colOffset)` only when both axes come from selection; mask text, HTML, and raw payload outside ranges. Skip the mask for explicit `options.columns`/`rowIndices`. Offsets use captured absolute row/column indices (`resolveColumns()` drops hidden/utility columns). With no ranges, resolve active cell from visible-index `selection.anchor` first, then focused DOM `data-field`; never mix anchor and full-list indices.
- INVARIANT (row copy): with row axis active, Ctrl-clicks produce multiple whole-row ranges; columns are not selection-derived. `#resolveData` must drop rows in the min/max span not covered by a range.
- DECIDED (Sep 2026 #488, axis not mode): shape decisions use `selectionAxis(sel) = sel.activeAxis ?? (typeof sel.mode === 'string' ? sel.mode : undefined)`, never `sel.mode` alone (array modes break paste bounds/row-copy gaps).
- DECIDED (Jul 2026, header strip): `#dropCopiedHeaderRow` removes `parsed[0]` only when headers are enabled, there is data beyond the header, and every header cell matches a label (`header || field`) from all columns. External pastes and partial label matches remain intact.
- INVARIANT (paste editability): writes only cells approved by `getCellEditableResolver` (`rowEditable` + `editable` boolean/function). No EditingPlugin → unanswered query → false, so paste is a no-op; resolve against pre-paste rows.
- DECIDED (Jul 2026, paste routes): rows with resolvable `getRowId` use `grid.updateRows(updates, 'paste')` (dirty/undo/validation/veto); id-less or newly-grown rows use `Object.assign`.
- DECIDED (Jul 2026, per-column `onPaste` + source): `false` skips, `{value}` rewrites, sync only; paste source is `'paste'`. `PasteCellContext.sourceField` carries the origin field through clipboard payloads (undefined for external paste); no column definition crosses grids.
- DECIDED (Jul 2026, `paste-rejected`): one `PasteRejectedDetail` per paste, reasons `'column'` / `'cell'`; non-editable skips are not reported. Custom handlers call `resolveColumnPaste` + `emitPasteRejected`. Parity: all three clipboard directives and Angular `_intentionallyOmittedEvents`.
- DECIDED (Nov 2025, perf): `parseClipboardText` extracts each cell with one `normalized.slice(cellStart, i)`; `formatDelimitedValue`/`formatCsvValue` dispatch strings before `Date`. Bench: `clipboard.bench.ts` (live `getSelectionAsText` path).
- DECIDED (Oct 2026, copy text owner): `copy.ts` only holds `copyToClipboard`; `ClipboardPlugin#buildDisplayGrid` builds display rows (HTML), plain rows, and headers. `formatDelimitedValue` applies `quoteStrings`/`escapeFormulas` only to raw strings; other types stay verbatim, as does `processCell`; headers auto-quote, never escape. Spec: `clipboard.spec.ts > copy text formatting`.

### Export

OWNS: export format/state. Download methods (`exportCsv`/`exportExcel`/`exportJson`) AND data accessors (`export()`/`formatCsv()`/`formatExcel()`/`getResolvedColumns()`) for ExcelJS/server hand-off. `mode: 'raw' | 'formatted'` (default raw).

- DECIDED (Jul 2026): `buildExcelXml` orchestrates only — `buildStylesXml` (pre-registers dynamic `cellStyle` results so data-cell style IDs exist), `buildColumnWidthsXml`, `buildPluginHeaderRowsXml` (group headers, `span>1` → `ss:MergeAcross="span-1"`), `buildHeaderRowXml`, `buildDataRowsXml` (+ pure `toExcelData(value)` → `{type,displayValue}`). `includeHeaders !== false` gates BOTH header helpers.
- DECIDED (#240): plugins MUST NOT import from `core/internal/rows.ts` at module scope (its module-level `document.createElement('template')` crashes happy-dom-less tests + pollutes plugin bundles) — inline small helpers like `resolveFormat`.
- DECIDED (#240): pre-resolving rows for downstream `buildCsv`/`buildExcelXml` (which re-call `resolveCellValue`) MUST strip `column.valueAccessor` from the passed columns — accessors mis-resolve against a synthetic `Record<string,unknown>` keyed by `field`.
- DECIDED (audit 2026-08-07, CWE-1236): `formatDelimitedValue(value, opts)` in `plugins/shared/data-collection.ts` is the single delimited-text formatter for CSV export + clipboard copy. Prefixes `'` onto **string** values starting with `= + - @ TAB CR`, default ON, opt out via `CsvOptions.escapeFormulas` / `ClipboardConfig.escapeFormulas`. `quoting` is tri-state `'auto'|'always'|'never'`. `formatCsvValue` remains a thin wrapper; clipboard calls it from `#buildDisplayGrid` (see Clipboard). PERF: `buildCsv`/`#buildDisplayGrid` build the options object ONCE outside the loops. Spec: `plugins/shared/data-collection-security.spec.ts`.
- NOTE: `plugins/export/excel.ts` is NOT formula-injectable (writes `ss:Type="String"`); grid-to-grid paste uses the structured `text/html` payload.

### Print

OWNS: print styling; exposes print methods. No shell dependency.
