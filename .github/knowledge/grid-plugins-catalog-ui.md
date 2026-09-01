---
domain: grid-plugins-catalog-ui
related:
  [
    grid-plugins,
    grid-plugins-catalog-data,
    grid-plugin-responsive,
    grid-plugins-editing,
    grid-plugins-shell,
    grid-input,
    adapters,
  ]
---

# Plugin Catalog — Interaction & Display Plugins

> Architecture → grid-plugins.md · Shell → grid-plugins-shell.md · Editing/UndoRedo → grid-plugins-editing.md · Responsive → grid-plugin-responsive.md · row/column model, sorting, filtering, pinned rows, export → grid-plugins-catalog-data.md.
>
> Read order for "a pointer gesture does the wrong thing": Selection dispatchers → the drag-alternative `DECIDED` bullets (#449) → ContextMenu order bands.

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
- DECIDED (#449, SC 2.5.7): range paint-drag gets TWO pointer alternatives, both reusing existing affordances (zero new chrome). (1) `getContextMenuItems` contributes **"Extend selection to here"** at `EXTEND_ITEM_ORDER = 60` (own tens band, below column move 50s); extends from `#extendAnchor` → `params.rowIndex/columnIndex` (`ContextMenuParams.columnIndex` IS `data-col`, same space as `colIndex`). `#extendAnchor` is SEPARATE from `cellAnchor` because right-click outside the range re-anchors `cellAnchor` at the clicked cell — `#setExtendAnchor` skips `button === 2`. (2) `RangeCornerHandles` handles are now `role="button"` + `aria-label` + `aria-pressed`; `#onPointerDown` tracks `moved` inside `onMove` and branches in `onEnd` (tap → `callbacks.arm(corner)`, drag → `commit()`), because `startPointerDrag` promotes immediately. Armed corner: `onCellMouseDown` returns `true` early (swallow, no drag reset), `#clickSelectRange` places it, `Escape` disarms BEFORE the touch-mode/clear branches.
  - INVARIANT: the fallback `createDragAlternativeMenu('tbw-range-extend-menu', …)` is bound as ONE delegated `contextmenu` listener on the grid host (cells are recycled every render) and MUST bail when `#contextMenuPlugin()` is truthy — else two menus stack.

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

Moved to grid-plugin-responsive.md (breakpoints, card layout, view transitions, column fades, card height).

### Tooltip

OWNS: active tooltip + positioning, shared `#tbw-tooltip-popover`. HOOKS: afterCellRender, getVerticalScrollOffsets(no). CONFIG adds `focus` (default true), `hideDelay` (default 120ms).

- DECIDED (#449, WCAG 2.2 SC 1.4.13): popover carries `id=tbw-tooltip-popover` + `role="tooltip"`; anchor cell gets `aria-describedby` while shown. `pointer-events: auto` + `user-select: text` in `tooltip.css` (was `none`) so the pointer can rest on it — "Hoverable".
- INVARIANT: `mouseout` schedules a **delayed** hide (`hideDelay`, default 120 ms), cancelled by `mouseenter` on the popover; only `hideDelay: 0` hides synchronously. Specs asserting immediate teardown MUST construct with `{ hideDelay: 0 }` or use fake timers.
- DECIDED (#449, Escape): the `keydown` listener is on **`document`** with `capture: true` because a hover-triggered tooltip can be visible while focus sits outside the grid. It deliberately does NOT `preventDefault`/`stopPropagation` — Escape also cancels an in-progress edit.
- DECIDED (#449, focus path): grid cell focus is **virtual** (host holds DOM focus, cell gets `.cell-focus`; no `aria-activedescendant` anywhere), so `:focus-visible` is unusable. Focus tooltips are driven from a `keydown` on a `NAVIGATION_KEYS` allow-list → `requestAnimationFrame` → `querySelector('.cell-focus')`. Side benefit: this is keyboard-only by construction, so pointer users see zero change — the closest available substitute for the AT-detection flag browsers refuse to expose (fingerprinting vector).
- INVARIANT: that nav `keydown` MUST bind on `this.gridElement` (the HOST), never on `.tbw-grid-root`. `grid.ts` puts `tabindex=0` on the host, so keydown targets the host and bubbles OUTWARD — it never traverses `.tbw-grid-root`, a _child_. Same element `setupRootEventDelegation` binds the grid's own handler on. A spec dispatching a bubbling `keydown` on `.tbw-grid-root` reaches the host anyway and will NOT catch the mis-binding — dispatch on `_hostElement`. Applies to **every** plugin that wants grid key events.
- DECIDED (#449, placement): above the anchor is preferred, dropping below only when the popover doesn't fit (`#prefersAbove`: `height <= spaceAbove || spaceAbove >= spaceBelow`, `ARROW_GAP_PX = 11`). Resolved in JS, NOT by `position-try-fallbacks`: the browser's flip is invisible to script, so the `.tbw-tooltip-above` arrow class could disagree with the painted box — most visibly on re-hover, where the `hideDelay` grace period keeps the popover open and a stale class survives.
- INVARIANT (#469): `#syncTooltipToFocusedCell()` MUST compare `cell === #anchorCell` **before** testing `anchor-name`. Keyboard nav **clamps** (`Math.max(0, _focusRow - 1)` in `keyboard.ts`), so ArrowUp on row 0 / ArrowDown on the last row re-runs the sync with `.cell-focus` on the _same_ cell — which already carries our own `--tbw-tooltip-anchor`. A bare "has any `anchor-name` → hide" test dismisses a tooltip that never should have moved. A _foreign_ anchor (overlay editor) still hides: we cannot re-anchor there, and leaving the previous cell's tooltip up would be stale.
- TENSION: no browser API reports "user needs a11y features" (only `prefers-reduced-motion`/`-contrast`/`forced-colors`); input-modality inference is the blessed substitute. Of SC 1.4.13's four sub-requirements only "focus-triggered" is modality-gateable — "Hoverable" is specifically a mouse-user requirement. Docs must say **no browser flag is needed**.

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
- DECIDED (#449, SC 2.4.11): implements `getVerticalScrollOffsets(focusedRowIndex?)` → `{ top: container.offsetHeight, bottom: 0 }` while any clone is displayed, so keyboard navigation scrolls a focused row clear of the overlay instead of under it. Returns `{ top: 0, bottom: 0, skipScroll: true }` when `displayedIndices.includes(focusedRowIndex)` (the row is already pinned in view). Returns `undefined` before the container exists or when nothing is stuck.

### ContextMenu

OWNS: menu items, open state. HOOKS: afterRender, onKeyDown. QUERIES: `getContextMenuItems` (collects contributions from all plugins).
INVARIANT: contributions sort by `order` (default 100); `insertGroupSeparators` groups by the TENS digit. Bands: sort 10s, filter 20s, visibility 30s, pinning 40s, column move 50-53 (reorder-columns, #449), selection 60 (range extend, #449). A plugin that contributes AND self-hosts its own menu MUST bail when `grid.getPluginByName('contextMenu')` is truthy, else two menus stack.
