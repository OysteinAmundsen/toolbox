---
domain: grid-core
related: [grid-render-pipeline, grid-plugins, grid-features, data-flow-traces]
---

# Grid Core — Mental Model

Core = `libs/grid/src/lib/core/`. Shell chrome is a PLUGIN (see grid-plugins-shell.md). Render scheduler, virtualization, rows hot path, value-accessor, row-manager, sorting and aggregators → grid-render-pipeline.md.

## config-manager (`core/internal/config-manager.ts`)

- OWNS: `originalConfig` (frozen) + `effectiveConfig` (mutable runtime clone); light-DOM column cache; MutationObserver; debounced change listeners (100 ms).
- PRECEDENCE (low→high): `gridConfig` prop → light-DOM elements → `columns` prop → `fitMode` prop → inference from `rows[0]`.
- FLOW: setter → `markSourcesChanged()` → scheduler FULL/COLUMNS phase → `merge()` → `collectAllSources` → freeze original → clone to effective → `applyPostMergeOperations`.
- INVARIANT: re-merge only when `sourcesChanged === true` OR no columns exist yet.
- INVARIANT: `originalConfig` is frozen, but column OBJECTS inside stay mutable (runtime `hidden`/`width`/sort live there).
- INVARIANT: `setGridConfig(config)` short-circuits when `config === #gridConfig`. WHY: adapters re-assign the same memoized ref; otherwise `merge()` rebuilds `effectiveConfig.columns` and discards runtime mutations from `setColumnVisible()`/`applyColumnState()`. The grid setter's `oldValue !== value` guard only stops `#queueUpdate`, not `setGridConfig`. Test: `config-manager.spec.ts > preserve runtime column.hidden mutations`.
- TENSION: light-DOM observation deferred to idle (framework content arrives late).
- DECIDED (#276): column shorthand lives in core `core/internal/column-shorthand.ts`, exported from `public.ts` (`parseColumnShorthand`, `normalizeColumns`, `hasColumnShorthands`, `applyColumnDefaults`, type `ColumnShorthand`). Adapters re-export (React keeps widened-`ColumnConfig` wrappers).
  - INVARIANT: wired in TWO places — (a) `parseLightDomColumns` splits `field="price:number"` into `field`+`type`+auto-`header`, ONLY when the suffix ∈ `{string,number,boolean,date,datetime,currency}`; other colons stay literal; non-empty explicit `type`/`header` win. (b) `set columns` (grid.ts) runs `normalizeColumns` on array input, so both the `columns='["id:number"]'` JSON attr and JS assignment accept shorthand; the `oldValue !== normalized` guard compares the STORED (normalized) ref. Tests: `column-shorthand.spec.ts`, `columns.spec.ts > #276`.
- DECIDED (#384): `columnInference: 'auto' | 'merge'` (default `'auto'`). In `'merge'`, `#collectAllSources` ALWAYS infers from `rows[0]` then `overlayInferred(inferred, provided)` overlays merged provided columns by `field` — provided wins per-defined-key, canonical order = data-key order, provided columns absent from data are APPENDED as computed columns. Mode resolved `#columnInference (standalone) ?? base.columnInference ?? 'auto'`. `overlayInferred` lives in [inference.ts](libs/grid/src/lib/core/internal/inference.ts) — distinct from `mergeColumns` (supplement semantics).
  - INVARIANT: `overlayInferred` MUST skip `undefined` provided values or a declared column without a header clobbers the inferred header.
  - Standalone source mirrors `fitMode`: `setColumnInference`/`getColumnInference` + `column-inference` attribute + `#applyColumnsUpdate()`. Adapters: React prop / Vue prop+watch / Angular `input()`+effect. Tests: `inference.spec.ts`, `config-precedence.spec.ts`.

## column-groups (`computeColumnGroups` in `core/internal/columns.ts`)

- INVARIANT: groups are **fragmented, not merged** — one entry per contiguous run of same-group columns. WHY: each fragment carries its own pin/sticky/border state.
- INVARIANT: when a merged view is needed, call `mergeAdjacentSameIdGroups()` ONCE (pre-compute via `mergeGroups()` per render) — do NOT call `findEmbeddedImplicitGroups()` + merge separately per function (double allocation).
- TENSION: `splitMixedPinImplicitGroup()` splits an implicit group straddling a pin boundary; pinned fragment gets `sticky`, non-pinned remnant has `border-right` suppressed.

## grid.ts (main component)

- OWNS: lifecycle, static adapter registry, core state (`_rows`, `_columns`, `_visibleColumns`, `_sortState`, `_baseColumns`, `_rowIdMap`, `__rowRenderEpoch`), manager instances, DOM refs, row pool, batched update coalescing (`#pendingUpdate`/`#pendingUpdateFlags`).
- INVARIANT (HARD RULE #370): **core MUST NOT reference any plugin.** All plugin access is `import type` or the PluginManager seam (`getPluginByName`/`getPlugin`). Enforced by `no-restricted-imports` scoped to `libs/grid/src/lib/core/**` (allowTypeImports).
- INVARIANT: `#rows` is ALWAYS an array — `rows`/`sourceRows` setters coerce nullish/non-array to `[]`. WHY: frameworks sync `grid.rows = undefined` when no `rows` prop (common with ServerSidePlugin); coerce at the setter, not at every reader.
- INVARIANT: `_columns` holds ALL columns incl. hidden; `_visibleColumns` is a cached filter.
- INVARIANT: `_rowIdMap` rebuild is FULLY LAZY. `#applyRowsUpdate` and `#rebuildRowModel` only set `#rowIdMapDirty = true`; `#ensureRowIdMap` does the O(n) loop on first read (`getRow` / `_getRowEntry` / plugin afterRender). WHY: eager rebuild cost 129 ms of 175 ms total at 1M rows — deferring gave a 5× initial-render speedup (175→35 ms). Nothing between `processRows` and `afterRender` reads the map.
- INVARIANT: every property change goes through `#queueUpdate` → `queueMicrotask` → `#flushPendingUpdates`. `ConfigManager.effective` is THE config source of truth.
- INVARIANT: `#rebuildRowModel` does NOT need a position-cache rebuild — the scheduler always calls `refreshVirtualWindow(force=true)` after `_schedulerProcessRows()`.
- INVARIANT: `renderHeader` ([header.ts](libs/grid/src/lib/core/internal/header.ts)) ALWAYS appends the resize handle for resizable columns, on every renderer path (`headerRenderer`, `headerLabelRenderer`, light-DOM `__headerTemplate`, plain text). Docs MUST say the GRID owns the resize handle — otherwise Vue/React users render a duplicate. Sort icon + filter button differ: full `headerRenderer` opts in via `ctx.renderSortIcon()` / `ctx.renderFilterButton()`; other paths get them automatically.
- INVARIANT: `headerRenderer` and `headerLabelRenderer` are mutually exclusive (`headerRenderer` wins). `mergeColumns` MUST only fill from DOM when the programmatic column has NEITHER. Test: `columns.spec.ts > propagates headerRenderer / headerLabelRenderer from DOM`.
- INVARIANT: the core sort fast-path (in-place sort + `refreshVirtualWindow`) is only safe when no plugin declares `modifiesRowStructure: true`; otherwise a full ROWS phase is required.
- TENSION: `_baseColumns` tracked separately (plugins reorder/transform; needed to restore hidden). `__rowRenderEpoch` forces full row rebuild on column changes. Two sort sources (core vs plugin); core sort re-applied before plugin `processRows`.
- DECIDED (Apr 2026): grid renders into **light DOM** — `#renderRoot` returns `this`, `gridEl.shadowRoot` is always null. Plugins/internal query the host directly (`gridEl.querySelector('.rows-body')`). WHY: simpler styling + framework integration, no slotting. Trade-off: no encapsulation — plugin styles prefix with `tbw-grid`.
- DECIDED (Jul 2026, import cycles — keep them broken): (1) `FOCUSABLE_EDITOR_SELECTOR` lives in `core/constants.ts` (re-exported from `rows.ts` for back-compat) — do NOT move back (rows↔keyboard). (2) `sorting.ts` repaints via `grid._schedulerRenderHeader()`, NOT a direct `renderHeader` import (header↔sorting). (3) `DataGridElement.tagName`/`activeTag` delegate to `core/internal/tag-registry.ts`; `style-injector.ts` reads the REGISTRY, never `DataGridElement` (grid↔style-injector). Enforced by fallow `circular-dependencies: error`.

### column state

- DECIDED (Apr 2026): `#applyColumnState` width-only fast path MUST also check for sort entries in the INCOMING state. Plugins (MultiSort) null `_sortState` after restoring their model, so before/after comparison is blind; without the check `#setup()` is skipped → icons render but data stays unsorted.
- DECIDED (Apr 2026): `applyColumnState()` MUST NOT write `#initialColumnState` when already initialized. That field is a one-shot slot consumed+cleared by `#setup()`; storing on every call makes a later `grid.columns = […]` silently re-apply stale state. Branch on `#initialized`.
- DECIDED (May 2026): `#applyGridConfigUpdate` MUST consume `#initialColumnState`. The flow calls `markSourcesChanged()`+`merge()` twice, cloning a fresh `effectiveConfig` and discarding runtime `hidden`/`width`/order; `#collectAllSources` re-stores `gridConfig.columnState` but the path ends at `requestPhase(COLUMNS)`, never `#setup()` → slot never consumed → declared visibility vanishes. Fix: after the second `merge()`, clear the slot and call `configManager.applyState(state, plugins)`. Test: `grid-config-column-state-regression.spec.ts`.

### multi-version coexistence (#339 / #382)

- DECIDED (#339): `registerDataGrid()` auto-suffixes tags — no existing `tbw-grid` → bare; same version → reuse bare; different version → `tbw-grid-v{version sanitised to [a-z0-9-]+}`. `DataGridElement.activeTag` reflects the choice. Every instance sets `data-tbw-grid=""` in `connectedCallback` regardless of tag — **that attribute is the stable selector contract**.
- INVARIANT: themes + adapter DOM traversal use `[data-tbw-grid]`, NEVER the bare tag. Adapters render via `createElement(GridElement.activeTag)` (React) / `<component :is="gridTag">` (Vue). `style-injector.ts` scopes `<style id="tbw-grid-styles-{activeTag}">` and rewrites bare `tbw-grid` selectors via `(?<![-\w])tbw-grid(?![-\w])`. `globalThis.DataGridElement` is FIRST-WINS — multi-version code MUST `import { DataGridElement }` or `customElements.get(activeTag)`. Adapter `closest()` uses `'tbw-grid, [data-tbw-grid]'`.
- DECIDED (#382): `createGrid()` → `document.createElement(DataGridElement.activeTag)`; `queryGrid(..., awaitUpgrade)` → `customElements.whenDefined(activeTag)` (both `public.ts`). Angular `Grid` directive selector `'tbw-grid'` → `'tbw-grid,[data-tbw-grid]'`; shell-content directives use `closest('[data-tbw-grid]')`. WHY: Angular matches selectors at COMPILE time, so a runtime-suffixed tag can't be name-matched — consumers add `data-tbw-grid` literally. Per-feature Angular directives (`tbw-grid[filtering]`) remain tag-bound.
- Files: `grid.ts`, `style-injector.ts`, `data-grid.tsx`, `TbwGrid.vue`, `libs/themes/`. Tests: `multi-version-registration.spec.ts`, `grid-shell-content.spec.ts`. Docs: `multi-version.mdx`.
- DECIDED (#338/#340 REVERTED): do NOT introduce a `globalThis`-anchored cross-bundle shared store for feature registry / React Context / Vue `InjectionKey` / Angular `InjectionToken`. Each bundle owns its own framework runtime, so Context identity (`$$typeof`) mismatches across bundles → "Invalid hook call" or silent `===` failure. RULED OUT: versioned bucket keys; opt-in shared store (silent failure until prod). `shared-store.ts`, `DataGridElement.shared` and the architecture.mdx section are gone.

### focus & a11y

- DECIDED (#324, always-on focus trap): `FocusManager` constructed once; host listeners survive disconnect/reconnect. Tracks last meaningful user-focused element via capture-phase `focusin`; restores on `focusout` when `relatedTarget === null` (body bounce). `#noteFocus` SKIPS: the grid host itself, a bare `.cell` (cell focus is virtual via `_focusRow`/`_focusCol`), and descendants of registered external containers. Editor inputs inside `.cell.editing` ARE tracked. Restore is `queueMicrotask`-gated to when `activeElement` is `<body>` or the host. Public: `grid.lastFocusedElement`, `grid.restoreLastFocus(): boolean`.
  - INVARIANT: `EditingConfig.focusTrap` is NOT deprecated — the two layers coexist (always-on trap fixes accidental focus theft; the opt-in `focusout` handler reclaims on intentional outside nav).
  - RULED OUT: `focusManager.destroy()` in `disconnectedCallback` (constructor runs once → reconnect leaves the trap uninstalled).
  - Files: `focus-manager.ts`, `keyboard.ts`, `grid.ts`, `plugins/editing/types.ts`. Tests: `focus-management.spec.ts > always-on focus trap`.
- DECIDED (Jul 2026, `keyboard.ts` shape): `handleGridKeyDown` = plugin dispatch → `shouldIgnoreKeyDown` (one guard chain: non-`.rows-body` target, form-field key ownership, `editing && colType==='select'` arrows) → `switch (e.key)` → `navigateTab` / `navigateHorizontal(towardEnd)` / `navigateRowEdge(toEnd)` / `emitCellActivate` → `ensureCellVisible(grid)`. `ensureCellVisible` = `scrollFocusedRowIntoView` (ScrollMapping-aware) → `findFocusedCell` → `scrollCellIntoViewHorizontally` (plugin `_getHorizontalScrollOffsets`) → `applyFocusTarget`. RTL is ONE `forward` flip inside `navigateHorizontal` — do NOT re-add per-case `isRTL` branches. ESLint `no-fallthrough` fires on a comment BETWEEN `case` labels — keep such comments above the whole group.
- DECIDED (Apr 2026): `aria-multiselectable` belongs on the `role="grid"` element (`.rows-body`), NOT the host — SelectionPlugin sets it from `multiSelect`; detach removes it.
- DECIDED (Apr 2026): the `dataLoaded` announcement fires only when `sourceRowCount` CHANGES between `_emitDataChange()` calls (state: `AriaState.lastAnnouncedSourceCount`). Initial `0 → 0` suppressed.
- DECIDED (Apr 2026): `aria-busy` toggles on the host alongside the `loading` attribute; plugins doing async work set it directly and clear on completion.
- DECIDED (#321, empty-state overlay): `emptyRenderer` is mutually exclusive with the loading overlay — `loading=true` always wins. Overlay recreated on every show (no caching). Evaluated in `set loading()` (after `#updateLoadingOverlay()`) and `_schedulerAfterRender()` (after plugin `afterRender`). `EmptyContext.filteredOut = sourceRowCount > 0 && renderedRowCount === 0`. Default mount `.rows-container` (`emptyOverlay: 'rows'`); `'grid'` covers the header; `emptyRenderer: null` is the opt-out. Files: `empty.ts`, `empty.css`. Tests: `empty.spec.ts`, `__tests__/integration/empty-state.spec.ts`.

## public class names (GridClasses ↔ DOM)

- INVARIANT: `GridClasses.DATA_ROW === 'data-grid-row'` and `GridClasses.DATA_CELL === 'cell'` MUST match what `rows.ts` templates (and grouping-rows/pivot row-className writes) actually apply. Derived `GridSelectors.*` follow.
- RULE: renaming/adding row or cell classes in `rows.ts`/`grouping-rows`/`pivot` REQUIRES updating `GridClasses` in the same change (#348 fixed values that matched nothing).

## dom-structure (light DOM render tree)

```
<tbw-grid>                                 (renderRoot === the host; no shadow root)
└─ .tbw-grid-root [.has-shell]
   ├─ .tbw-shell-header                    (ShellPlugin only)
   ├─ .tbw-shell-body / .tbw-grid-content
   │  ├─ .tbw-tool-panel                   (ShellPlugin only)
   │  └─ .tbw-scroll-area
   │     ├─ .rows-body-wrapper
   │     │  └─ .rows-body [role=grid|treegrid]
   │     │     ├─ .header [role=rowgroup] › .header-row › .header-cell ×N
   │     │     └─ .rows-container › .rows-viewport › .rows
   │     │        └─ .data-grid-row [role=row] ×M (pooled) › .cell [role=gridcell] ×N
   │     ├─ .faux-vscroll › .faux-vscroll-spacer [style=height]
   │     └─ .tbw-sr-only                   (live region)
```

## state-ownership matrix

| State                          | Owner                 | Mutators                                         | Notes                                   |
| ------------------------------ | --------------------- | ------------------------------------------------ | --------------------------------------- |
| gridConfig / columns / fitMode | ConfigManager         | `merge()`, property setters                      | frozen original + mutable effective     |
| `#rows` (raw input)            | grid.ts               | property setter only                             | always coerced to array                 |
| `_rows` (processed)            | grid.ts               | `rebuildRowModel`, `processRows` hooks           | after plugin transforms                 |
| `_sortState`                   | grid.ts               | sort API, `rebuildRowModel`                      | field + direction                       |
| `_rowIdMap`                    | grid.ts               | `#ensureRowIdMap` (lazy)                         | rowId → `{row,index}`                   |
| `VirtualState`                 | VirtualizationManager | `refreshVirtualWindow`, init                     | shared mutable object                   |
| positionCache / heightCache    | VirtualizationManager | `initializePositionCache`, `invalidateRowHeight` | position rebuilt often; height persists |
| shell (header/toolbar/panels)  | ShellPlugin           | `registerToolPanel`, light DOM, `processConfig`  | core has ZERO shell state (v3)          |
| plugin instances               | PluginManager         | `Plugin.attach`                                  | registered in array order               |
| accessor cache                 | value-accessor.ts     | `resolveCellValue`, `invalidateAccessorCache`    | `WeakMap<row, Map<field, box>>`         |

## pointer-modality (`core/internal/pointer-modality.ts`)

- OWNS: `PointerModality` type (`'fine' | 'coarse'`), `getPrimaryPointer()`, `onPointerModalityChange(cb)`. **NOT exported from `public.ts`** — internal use only.
- INVARIANT: single shared `MediaQueryList` for `(pointer: coarse)` — one OS listener regardless of subscriber count. Created lazily on first call.
- INVARIANT: SSR / happy-dom safe — guard `typeof globalThis.matchMedia !== 'function'`; returns `'fine'` as the safe default. Fallback also for legacy `addListener` API (old Safari / happy-dom).
- INVARIANT: unsubscribe is idempotent (`removed` flag guards double-call).
- DECIDED (#307, Jul 2026): part of touch-input epic #302 cross-cutting infra. Plugins and features MUST use this module rather than calling `matchMedia` directly. `@since 3.5.0`. Tests: `pointer-modality.spec.ts`.

## pointer-drag (`core/internal/pointer-drag.ts`)

- OWNS: `startPointerDrag(startEvent, captureTarget, handlers, options?) => cancelFn`, `PointerDragHandlers` (`onMove`, `onEnd`, `onPromote?`, `onCancel?`), `PointerDragOptions` (`threshold?`, `longPressDuration?`, `longPressSlop?` default 8). **NOT in `public.ts`** — internal. `@since 3.5.0`.
- INVARIANT: uses `setPointerCapture` ONLY — no `document`/`window` `pointermove`/`pointerup` listeners. The single exception is a capture-phase `document` `keydown` for Escape-to-abort. WHY: capture survives DOM virtualization re-renders that would otherwise detach the drag source mid-gesture.
- INVARIANT: `setPointerCapture` is claimed at **promotion**, never on `pointerdown`. WHY: a captured pointer makes the browser retarget the compatibility mouse events (`mouseup`, `click`, `dblclick`) to the capture element, so capturing on press silently kills every `closest()`-based click feature — dblclick-to-edit died this way in #303 (24 e2e failures). Capture failure at promotion → `cancel()` so callers can roll back UI state.
- INVARIANT: `captureTarget` must be a stable element (the resize _handle_, not the header cell). `ResizeController.start` therefore takes a 4th param `captureTarget?: Element`.
- INVARIANT: `touch-action: none` is applied to the capture target only inside `onPromote` — never on `pointerdown`. WHY: applying it at pointerdown would swallow a plain swipe-to-scroll over the grid. Restored in both `onEnd` and `onCancel`.
- INVARIANT: re-entrancy guarded by a module-level `WeakMap<Element, Set<number>>` of active pointerIds; a second `pointerdown` with the same id on the same target is ignored.
- FLOW (promotion): no threshold + no long-press → promoted synchronously at call time. `threshold > 0` → promoted on first move past distance. `longPressDuration > 0` → promoted by timer; any move beyond `longPressSlop` before the timer fires **cancels the whole drag** (it was a scroll, not a drag).
- `onPromote` exists so callers can act at promotion time even when the pointer never moves (range-paint dispatches its `mousedown` hook there). Fired from all three promotion sites.
- DECIDED (#303, Jul 2026): fine-vs-coarse branch uses per-event `e.pointerType` (`touch`/`pen` → coarse, `mouse` → fine) in preference to `getPrimaryPointer()`. WHY: hybrid devices (Surface) report `(pointer: coarse)` even while a mouse is in use. `getPrimaryPointer()` is only the fallback for synthetic events with no `pointerType`.
- DECIDED (#303, Jul 2026): #228 never shipped this module, so #303 created it. It is deliberately generic so the DnD plugins (#228: column reorder, row drag-drop) can consume it later instead of growing a second drag primitive.
- Consumers: `resize.ts` (column resize), `plugins/shell/shell.ts` (tool-panel splitter), `event-delegation.ts` (cell-range paint, `LONG_PRESS_MS = 400` on coarse pointers, `DRAG_THRESHOLD_PX = 3` on fine pointers — the threshold is what keeps a plain click/dblclick from capturing).
- INVARIANT: `buildCellMouseEvent` falls back to `document.elementFromPoint` whenever the resolved target has no `[data-col]` ancestor — not merely when it is outside `renderRoot`. WHY: pointer capture retargets moves to `renderRoot`, which _is_ inside `renderRoot`, so the old check never fired and every drag move reported the anchor cell (range paint stuck at 1 cell).
- TENSION: listeners are typed `(event: Event)` and narrowed, not `(e: PointerEvent)` — `pointer*` lives on `HTMLElementEventMap`, not `ElementEventMap`, so a generic `Element.addEventListener` rejects the narrower signature.
- Tests: `pointer-drag.spec.ts` (24), `resize.spec.ts` (8). happy-dom has `PointerEvent` but pointer capture does not route events — specs MUST stub `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` on the capture target and dispatch pointer events **directly on that target**.

## long-press priority policy (#307 / touch-input epic #302)

- DECIDED (#307, Jul 2026; implemented #303/#304/#306): priority chain for a coarse long-press:
  1. **Header → column header menu** — highest; blocked on #270, falls through to context menu meanwhile.
  2. **Row + `SelectionPlugin` `mode: 'row'` → selection mode** (#304).
  3. **Cell + `SelectionPlugin` `mode: 'cell'|'range'` → range paint** (#303).
  4. **Otherwise → `ContextMenuPlugin`** (#306).
- DECIDED (#306): the fallback is **passive, not a polyfill**. Browsers already synthesise `contextmenu` from a long-press, so `ContextMenuPlugin` needs no touch code at all. Instead `handlePointerDown`'s `onPromote` calls `suppressNextContextMenu(renderRoot)` **only when `dispatchDown()` returned true** — i.e. only when a plugin claimed the press. WHY: inverting the check (opt-in per plugin) would need every future long-press consumer to remember to suppress; this way the default is correct. `core/internal/event-delegation.ts`.
- INVARIANT: `suppressNextContextMenu` is one-shot and time-boxed (`CONTEXT_MENU_SUPPRESS_MS = 700`, vs browser synthesis at ~500 ms). It registers on `document` **capture phase** so it precedes `ContextMenuPlugin`'s listener (bound on `.tbw-grid-root`), and removes itself on first event _or_ timeout. It MUST NOT latch — a right-click seconds later must still open the menu. Guarded by 5 tests in `event-delegation.spec.ts` → `describe('long-press → contextmenu priority (#306)')`.
- INVARIANT: every future long-press handler MUST honour this order. Documented in `apps/docs/src/content/docs/grid/guides/touch-input.mdx` and in the `ContextMenuPlugin` class JSDoc.
- TENSION: suppression is invisible in happy-dom's favour — happy-dom never _synthesises_ a `contextmenu` from touch, so the unit tests dispatch one manually. Whether real browsers fire it inside the 700 ms window is only covered by `e2e/tests/touch-input.spec.ts` (unrun).

## type interfaces

- `GridHost = InternalGrid & HTMLElement` (`core/types.ts`) — used by internal modules. `PluginGridApi` (`plugin/types.ts`) — used by plugins.
- TENSION: both declare `_pluginManager` with different shapes; adding a plugin-manager property for internal code requires it on `InternalGrid` too.
