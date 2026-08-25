---
domain: grid-plugins-catalog-ui
related: [grid-plugins, grid-plugins-catalog-data, grid-plugins-shell, grid-input, adapters]
---

# Plugin Catalog — Interaction & Display Plugins

> Architecture → grid-plugins.md · Shell → grid-plugins-shell.md · row/column model, sorting, filtering, pinned rows, export → grid-plugins-catalog-data.md.

## Selection & Navigation

### Selection

OWNS: selected rows/cells/ranges/columns (`Set<field>`), `activeAxis`, normalized mode. HOOKS: onCellClick, onRowClick, onHeaderClick, onKeyDown, afterCellRender, processColumns (checkbox column), afterRender, onScrollRender. EVENTS: `selection-change`. MODES: `cell | row | range | column`, or an array of `'column'` + exactly one in-row axis.

- DECIDED (#269): mode normalized at `attach()` into `NormalizedModeConfig { primary, columnEnabled, bothAxes }`; throws on empty, 3+ items, 2-element without `'column'`, duplicates, unknown. RULED OUT: `['cell','row']`. Column selection keys on **field names**; `clearSelectionSilent()` preserves `selectedColumns`; row↔column mutual exclusion in `#buildEvent()`. Chords: header plain/Shift+Click = sort; **Ctrl/⌘+Click** toggles a column, **Ctrl/⌘+Shift+Click** extends; **Ctrl/⌘+Space** toggles the focused cell's column, **Ctrl/⌘+Shift+←/→** extends. Utility columns skip every column-axis path. `column-selection.ts` (+ spec).
- DECIDED (#308): `selection-change.detail.selectedColumns` + `getSelectedColumns()` emit in **visible-column order** via `buildSelectionEvent` → `selectableColumnFields(visibleColumns)`; the `selectColumns` query batches through `#setColumnSelection(fields)`. `#applySelectionClasses()` MUST reset stale `aria-selected` **scoped** to cells that previously carried `.selected`/`.column-selected` — clearing all wipes the active-cell focused marker (e2e `accessibility.spec.ts`).
- DECIDED (#284): clears selection when the host swaps source `rows` to a DIFFERENT size (`data-change` + changed `sourceRowCount`, cached `lastSourceRowCount = -1`); same-count edits preserve. RULED OUT: clearing on every `data-change`; deep equality. Also auto-selects the row entering edit in `mode:'row'` (listens `edit-open` via `broadcast()`); skips if mode isn't row, `isRowSelectable` false, or already selected; `multiSelect:false` replaces. NO `edit-close` listener. Tests: `selection-editing-integration.spec.ts`.
- DECIDED (Jul 2026): `onCellClick`/`onKeyDown` are thin dispatchers; semantics live in `#clickSelect{Cell,Row,Range}` and `#key{ColumnAxis,ClearSelection,NavCellMode,RowMode,RangeMode,SelectAll}`; `NAV_KEYS` is module-level. MUST NOT re-inline — mode PRECEDENCE belongs to the dispatcher, SEMANTICS to the branch.
- DECIDED (Jul 2026): range-mode right-click (`onCellMouseDown`, `button === 2`) inside an existing range preserves the selection (early return, no drag) so the context menu acts on the whole range (`isCellInAnyRange`); outside falls through to clear+select.
- DECIDED (#304, `@since 3.5.0`): **touch selection mode** — long-press a row → mode on + row selected; taps then toggle (as Ctrl); a second long-press range-extends from the anchor; `Done`/`Escape` exits. API: `touchSelectionActive`, `exitTouchSelection()`, `SelectionConfig.touchMode: 'sticky' | 'transient'` (default `'transient'` = exiting clears). UI in `plugins/selection/touch-selection.ts`: `SelectionToolbar` (role=toolbar, `data-action` buttons) + `RangeCornerHandles` (`startPointerDrag` dots, hidden when the anchor cell is virtualized away); "More…" proxies to `ContextMenuPlugin.showMenu()` via `getPluginByName('contextMenu')`. Header presses (`rowIndex < 0`) ignored — reserved for #270.
  - INVARIANT: entry gates on the **event's** `pointerType` (`#isCoarseEvent`), NOT `getPrimaryPointer()` — a hybrid device reports `(pointer: coarse)` with a mouse in use. `#renderTouchChrome` MUST NOT re-test the media query.
  - INVARIANT: mouse chords untouched — the only change is `|| this.#touchActive` in `#clickSelectRow`'s `ctrlKey`. Long-press detection is free: `event-delegation.ts` dispatches the coarse `mousedown` hook only after 400 ms (#303); no plugin-side timer.
  - DECIDED (Aug 2026): range corner handles are **touch-only** — `#rangeFromCoarsePointer` (set from `#isCoarseEvent(originalEvent)` in BOTH `onCellMouseDown` range branch and `#clickSelectRange`) gates `#renderTouchChrome`'s `rect`. WHY: on desktop only the most recent Ctrl-range carries handles, so they sit inside other ranges and obstruct drag-select.
  - TENSION: selection chunk +2.39 kB gz — `pointer-drag.ts` inlines (plugin entries are self-contained, `manualChunks: undefined`); ≤50 kB gz/plugin passes.
  - Tests: `touch-selection.spec.ts` → "does not render handles for a mouse-started range" / "renders handles for a tap-created range". Stubbing `matchMedia` per-test does NOT work for `getPrimaryPointer()` — `pointer-modality.ts` caches one shared MediaQueryList module-level; assert via `pointerType`.

## Editing & Undo

### Editing

OWNS: active cell, editor snapshots, changed rows, dirty tracking. HOOKS: processColumns, processRows, afterCellRender, afterRowRender, onCellClick, onKeyDown. EVENTS: `cell-commit`, `row-commit`, `edit-open|close`. TENSION: caches the sort result during an edit so the edited row doesn't jump.

- DECIDED (Jul 2026): `onKeyDown` is a `switch (event.key)` dispatcher only; logic lives in `#onEscapeKey`/`#onArrowKey`/`#onTabKey`/`#onSpaceKey`/`#onEnterKey` (→ `#onEnterWhileEditorFocused`, `#beginRowEditFromEnter`)/`#onF2Key`. MUST NOT re-inline — the `#347`, `#427`, `#251`, `#250` guards each live in one specific branch.
- FLOW (`#exitRowEdit`, order is load-bearing): `#resolveEditedRow` (ID map → `#activeEditRowRef` → `_rows[rowIndex]`) → `#commitActiveEditors` (skips `data-editor-managed`) → `before-edit-close` → revert | `#finalizeRowCommit` (cancelable `row-commit`, dirty refresh, queue animation) → `#clearRowEditState` → `#pendingFocusRestore = true` → `#teardownRowEditors` → `edit-close`. MUST set `#pendingFocusRestore` before `#teardownRowEditors` (its `refreshVirtualWindow(true)` runs `afterRender()` synchronously and reads it); `releaseCell` MUST run while editor DOM is still in the cell or overlay editors leak `<body>` panels.
- DECIDED (Jul 2026, `getInputValue`): `libs/grid/src/lib/plugins/editing/editors.ts` switches on `input.type` over `readNumericValue`/`readDateValue`/`readTextInputValue`, plus `readTextControlValue` for `<textarea>`/`<select>`. INVARIANT: every branch PRESERVES THE ORIGINAL VALUE'S TYPE and distinguishes `nullable` empty → `null` from non-nullable empty → `''`/`min`; MUST NOT be "simplified" to `input.value`.
- RULE: editor detection MUST use `closest(FOCUSABLE_EDITOR_SELECTOR)`, never `matches()` — non-focusable descendants (`<option>`, spans in `contenteditable`) fail it.
- DECIDED (#347 + #427, popup-`<select>` keyboard): in `mode:'grid'` ArrowUp/Down MUST NOT navigate cells when the keydown target is inside an editor descendant; Enter on a popup `<option>` MUST bail WITHOUT `preventDefault`/`stopPropagation` — in BOTH `editor-injection.ts` host-keydown AND `EditingPlugin.onKeyDown`. #427: that guard (`getEditorAncestor(target) !== target`) MUST sit ABOVE the mode split — inside `isGridMode` only, ROW mode fell through and DISCARDED the picked value. WHY: Chromium's popup walks focus SELECT→OPTION (flips `#gridModeInputFocused`) and `preventDefault` blocks the native commit; Enter-on-open-popup defers to native (`change`), a SECOND Enter exits the row. Enter with no popup: commit + blur + focus grid (`#gridModeEditLocked = true`). RULE: editor-chain keydown handlers MUST NOT `stopPropagation` in grid mode.
- DECIDED (Apr 2026): row-mode ArrowUp/Down MUST NOT commit + jump to the adjacent row while a row is in edit mode — returns `true` (handled, no-op) so the focused editor consumes the key natively; same rationale as the `editing && colType === 'select'` early return in `core/internal/keyboard.ts`.
- DECIDED (#250): the `editor-injection.ts` keydown handler MUST short-circuit on `e.defaultPrevented` BEFORE inspecting `e.key` — portal pickers (Downshift, MUI date) `preventDefault()` on option-confirming Enter; without it the editor tears down first.
- INVARIANT (`ColumnEditorContext` idempotency): `ctx.commit`/`ctx.cancel` are one-shot — `libs/grid/src/lib/plugins/editing/internal/editor-injection.ts` L119-120 `commit` returns early when `editFinalized` is set, L135-143 `cancel` sets it unconditionally, so the built-in `Escape→cancel` + `blur→commit` pair is safe. Custom editors MUST guard their OWN teardown (e.g. `mask.destroy()`) and MUST NOT `preventDefault`/`stopPropagation` on Enter/Escape — the host keydown listener (L306-308) needs them to drive `exitRowEdit()`. Recipe: `apps/docs/src/content/docs/grid/recipes/input-masks-validation.mdx`.
- DECIDED (#251, overlay-editor parity): (1) generic `aria-expanded="true" + aria-controls=<id>` fallback via `isInsideOpenAriaOverlay(target, scopeEl)`, called from `editor-injection.ts` host keydown, `EditingPlugin.onKeyDown` and document-pointerdown outside-click; (2) opt-in `ColumnEditorContext.grid` → `registerExternalFocusContainer(panel)` or `useGridOverlay(panelRef,{open})`. Tests: `editing-overlay-aria.spec.ts`, `use-grid-overlay.spec.tsx`.
- DECIDED (Jul 2026, `commitCellValue`): EditingPlugin answers the core `commitCellValue` query (`#handleCommitCellValue`) so `grid.updateRow/updateRows` route programmatic mutations through the full edit pipeline; `source:'history'` applies + recomputes dirty but does NOT re-record history (undo-loop fix). Plugin bundle budget 50 → 55 kB for editing (the outlier). Contract: grid-plugins.md § inter-plugin-communication.
- DECIDED (Jul 2026, `source:'sync'`): applies the value in place AND re-baselines the cell (`DirtyTrackingManager.rebaselineCell`) — no dirty marking, no undo history, no cascade. Re-baseline (not skip) because `dirtyTracking` deep-compares a whole-row `structuredClone` baseline. Runs BEFORE the column guard so non-column fields re-baseline too. `cell-change` still fires; `cell-edit-committed` does not, so UndoRedo stays clean. Adapters route value-only, same-order/count rows-prop updates through `updateRows(diff,'sync')` (unresolvable id → full `el.rows` replace): `grid-react/src/lib/data-grid.tsx`, `grid-angular/src/lib/directives/{grid.directive.ts,row-diff.ts}`, `grid-vue/src/lib/TbwGrid.vue`.

### UndoRedo

OWNS: undo/redo stacks. HOOKS: onKeyDown (Ctrl+Z/Y). DEPENDS: editing (required). Applies reverts via `grid.updateRow(id, {field: val}, 'history')` — the `'history'` source makes Editing apply-without-re-recording (`#suppressRecording` guards the buffered path).

- DECIDED (Jul 2026, TBW111): `beginTransaction()`/`endTransaction()` are re-entrant via `#transactionDepth`; only the outermost `endTransaction` finalizes the buffer, and nesting coalesces a paste into ONE compound undo entry. WHY: paste emits one synchronous `cell-commit` per cell; consumers bracketing each with `beginTransaction()` + `queueMicrotask(endTransaction)` hit a nested begin and the old `TRANSACTION_IN_PROGRESS` throw escaped the loop ("paste only fills one cell"). `endTransaction` still throws `NO_TRANSACTION` at depth 0; depth reset in `detach()` + `clearHistory()`.

## Row Details

### MasterDetail

OWNS: expanded rows, detail height, animation state. HOOKS: processColumns (expander), onCellClick, afterRowRender, getRowHeight, adjustVirtualStart. EVENTS: `master-detail-toggle`.

- SHARED expander util `core/plugin/expander-column.ts`: `EXPANDER_COLUMN_FIELD`, `EXPANDER_COLUMN_WIDTH`, `isExpanderColumn`, `isUtilityColumn`, `findExpanderColumn`, `createExpanderColumnConfig`, `ExpanderColumnRenderer`. DECIDED (Jun 2026): `createExpanderContainer`/`EXPANDER_COLUMN_STYLES` removed (zero consumers) — do not reintroduce.
- DECIDED (Jul 2026, `#syncDetailRows`): `#collectVisibleRowMap` (prefers the index-aligned `_rowPool`, `querySelectorAll` as fallback) → `#pruneDetachedDetails` (adapter `unmount` BEFORE `remove()`) → per-row `#insertDetailRow`. INVARIANT: the `.tbw-row-expanded` toggle MUST run on the collapsed branch too — recycling otherwise leaks the class onto another row.

## Reordering

### ReorderColumns

OWNS: column order, drag state, `BaseColumnConfig.lockPosition` augmentation. HOOKS: onCellMouseDown/Move/Up, afterRender. QUERIES: `canMoveColumn`.

- DECIDED: per-column lock is top-level `ColumnConfig.lockPosition` (augmented from `reorder-columns/types.ts`, NOT core). Legacy `meta.lockPosition`/`meta.suppressMovable` honored in `column-drag.ts#canMoveColumn` (top-level first).
- DECIDED: ReorderColumns owns the authoritative `canMoveColumn` query — other plugins (Visibility panel-drag) MUST `grid.query<boolean>('canMoveColumn', column)` and treat any `false` as a veto. Without the plugin it returns `[]` (= non-reorderable); an eager local check keeps test mocks (`query: () => []`) working.
- DECIDED: ALL column-level flags are top-level on `ColumnConfig` via module augmentation from the owning plugin's `types.ts` — never `meta.<flag>`, never directly in core. Flags: `lockVisible` (core), `lockPosition` (reorder-columns), `lockPinning`/`pinned` (pinned-columns), `utility` (public, core), `checkboxColumn` (`@internal`, selection), `group` (grouping-columns).
- INVARIANT: plugin-owned flags MUST NOT appear on the `grid.getAllColumns()` projection — only grid-universal fields (`field`, `header`, `visible`, `lockVisible`, `utility`). Plugins read raw config via `this.grid.columns.find(...)`.
- DECIDED (Apr 2026): `ColumnConfig.utility` is PUBLIC — "system column" flag (checkbox, expander, drag handle, action menu); prefix `__`. Honored by Visibility (chooser filter), Reorder (`canMoveColumn` false), Print (hidden unless `printHidden:false`), Clipboard/Export (`resolveColumns()` skips), Selection (clicks ignored), Filtering (no filter UI).

### ReorderRows

OWNS: row order, drag state. HOOKS: onCellMouseDown/Move/Up. QUERIES: `canMoveRow`.

### RowDragDrop (#225)

OWNS: row order + cross-grid drag/drop session. ALIASES: none. HOOKS: processColumns (drag-handle col), onKeyDown (Ctrl+arrow), onCellClick, delegated dragstart/over/leave/drop/dragend. QUERIES: `canMoveRow`. EVENTS: `row-move`, `row-drag-start` (cancelable), `row-drag-end`, `row-drop` (cancelable), `row-transfer`. USES: `core/internal/drag-drop-registry.ts` (WeakRef session map, shared across split bundles) + `plugins/shared/drag-drop-protocol.ts` (MIME constants, payload codec, drop-position math, auto-scroller, session tracker).

- DECIDED (v3, Jun 2026): `RowReorderPlugin`, the `reorderRows` feature key and the `['reorderRows','rowReorder']` aliases are ALL REMOVED (they pointed at a v3-deleted plugin); `RowDragDropPlugin.aliases` is `undefined` — asserted by `row-drag-drop.spec.ts > aliases`. Docs redirect `/grid/plugins/reorder-rows/` → `/grid/plugins/row-drag-drop/`.
- DECIDED (#225, alias dedup — still live for OTHER plugins, e.g. `ReorderPlugin`↔`reorder`): `PluginManager#collapseAliasDuplicates` keys on **constructor identity**, not plugin name; `BaseGridPlugin.mergeConfigsFrom` — silent on equal scalars/refs, TBW023 on dedupe (silent in PROD), TBW025 throw on conflict.
- DECIDED (#225, session lookup): same-window cross-grid uses the module-level `currentSession` singleton for synchronous `canDrop` during `dragover` (`dataTransfer.getData()` returns `''` there); cross-window falls back to JSON via `getData(TBW_ROW_DRAG_MIME)` + `deserializeRow`. WeakRef registry matters only for live-object recovery on **drop**.
- DECIDED (Apr 2026, cross-window via `BroadcastChannel`): cross-window `getElementById(sourceGridId)` is null, so source-side removal + `row-transfer` no-op'd; fix is a module-level `BroadcastChannel('tbw-row-drag-drop')` — after a cross-grid drop where `findPeerOnGrid(sourceGridId) === null` the target broadcasts `tbw-row-drag-drop:transfer` `{sourceGridId,toGridId,dropZone,rowIndices,toIndex,operation,serializedRows}`; instances filter on matching `sourceGridId` + `dropZone`. Channel is lazy, ref-counted, closed on last detach. INVARIANT: origin-scoped — when unavailable the target gets rows but the source is untouched, so `row-transfer` is the authoritative success signal.
- DECIDED (Apr 2026): `dragFrom?: 'handle'|'row'|'both'` (default `'handle'`); `'row'` hides the handle column unless `showDragHandle` is explicit. `applyRowDraggable()` MUST run from BOTH `afterRender` AND `onScrollRender` (recycling loses `draggable="true"`).
- INVARIANT: interactive descendants (`button,input,select,textarea,a[href],[contenteditable]`) never start a drag — `INTERACTIVE_DRAG_SELECTORS` / `isInteractiveDragOrigin()`.
- INVARIANT (CSS scoping): the row clone for `setDragImage` MUST be appended INSIDE `this.gridElement`, never `document.body` (`core/styles/*.css` is scoped under `tbw-grid{…}`; `--tbw-column-template` lives on the host). Clone is `position:fixed; top/left:-10000px`, removed in `setTimeout(0)`. Do NOT add `opacity`/`box-shadow` (browser already applies ~70 % translucency; blur captures as a horizontal fade).

## Display

### Responsive

OWNS: breakpoint-based column visibility. HOOKS: processColumns, getRowHeight.

- INVARIANT: the header ROW is ALWAYS hidden in card mode (unconditional `tbw-grid[data-responsive] .header { display: none }`). `hideHeader` does NOT control that — it gates per-card FIELD LABELS (the `Name:` `::before` prefix).
- DECIDED (May 2026): `hideHeader` defaults to `false`; `#applyResponsiveState()` sets `data-responsive-hide-header` on the host only when `isResponsive && hideHeader === true` (CSS hides `.data-grid-row:not(.group-row) > .cell::before`), cleared on leaving card mode.

### Tooltip

OWNS: active tooltip + positioning. HOOKS: afterCellRender.

### StickyRows (#279)

OWNS: `.tbw-sticky-rows` overlay container, clone cache by row index, displayed indices, push displacement. HOOKS: afterRender, onScrollRender, onScroll. READS: `grid.rows`, `grid._virtualization.{container,positionCache,rowHeight}`. CONFIG: `isSticky` (field name or `(row,index)=>unknown`), `mode:'push'|'stack'` (default push), `maxStacked`, `className`.

- INVARIANT: clones are decorative — `aria-hidden="true"`, no `tabindex`, focus classes stripped. The live row stays in the pool for keyboard + AT.
- INVARIANT: the container is `position:absolute; top:0` INSIDE `.rows-viewport`, NOT a flex child of `.rows-body` (a flex child pushes the viewport down → duplicate during push). Viewport `overflow: clip` hides the live row underneath.
- INVARIANT: `getCurrentScrollTop()` MUST read `_virtualization.container.scrollTop`, never derive from `start * rowHeight` (lags up to `rowHeight - 1` px → "invisible until row #3").
- INVARIANT: the clone cache MUST be primed while the row is live (`findRenderedRow` returns null once scrolled out).
- INVARIANT: sticky qualifies when `offsetOf(idx) < scrollTop` (STRICT: equality = live row at top, cloning would duplicate). `'stack'`: `offsetOf(idx) < scrollTop + cumulativeHeightOfStuck`; at `maxStacked` the edge tightens to `offsetOf(idx) < scrollTop + sumStuck - heightOf(oldest)`, the container translating `-distance` (capped at `heightOf(oldest)`); push equivalent `pushOffset = heightOfStuck - distance`. Do NOT add the incoming clone during anticipation.
- INVARIANT: `displayedIndices` tracks the actually-appended set (missing clones retry next refresh).
- DECIDED (Jun 2026, settle pass): React/Vue portal managers flush cell content a microtask AFTER `data-row` is set, so a `cloneNode` snapshot taken synchronously in `onScrollRender` captures the PREVIOUS row's content, cached forever. FIX: `onScrollRender` calls `maybeScheduleSettlePass()` → `requestAfterRender()` (STYLE phase, rAF, post-microtask) re-runs `afterRender`; coalesced via `settlePassScheduled` (cleared at `afterRender` start), only when a sticky row is in the window. Re-capturing a DISPLAYED clone (`refreshClonesInWindow`) MUST happen ONLY in `afterRender`, NEVER in `onScrollRender` (which keeps only `primeCloneCache` + `refreshDisplay` + `maybeScheduleSettlePass`) — `refreshDisplay`'s `sameSet` short-circuit would strand a stale node until absolute top, and unflushed content paints for a frame. Test: `sticky-rows.spec.ts > never paints stale content on the displayed clone during a scroll-up recycle (no flash)`.
- DECIDED (Feb 2026, #1370): `refreshDisplay` falls back to a **synthesized clone** when a desired index has no DOM capture — `synthesizeClone(index)` deep-clones `templateClone` (detached copy of the last real capture, from `buildClone`) and rewrites each `.cell[data-field]` via `resolveCellValue(row, column, index)` from `visibleColumns`; marked `data-synthetic-sticky-row`, cached, replaced by a real capture later. WHY: clones exist only after a row has passed the render window, and scrolling **down** never brings a missed row back. Guard: bail (omit the row) if any template cell has `firstElementChild` — custom-renderer DOM cannot be re-targeted. `sticky-rows.spec.ts` → `'synthesizes a stand-in…'`, `'omits rather than synthesizes…'`.
- INVARIANT: any config/data change (`detach`, or a sticky-index change in `recomputeStickyIndices`) clears `cloneCache` while **scroll position is preserved**; only sticky rows inside the render window can be re-primed — this, not fast scrolling, caused the `'stack'`-mode "stuck at 1 row" bug (same on mount-while-scrolled).
- DECIDED (#279): zero core bytes — reads `_virtualization` internals directly. RULED OUT: `core/internal/rows.ts#renderInlineRow` (#240 — module-level `document.createElement('template')` crashes happy-dom-less tests).

### ContextMenu

OWNS: menu items, open state. HOOKS: afterRender, onKeyDown. QUERIES: `getContextMenuItems` (collects contributions from all plugins).
