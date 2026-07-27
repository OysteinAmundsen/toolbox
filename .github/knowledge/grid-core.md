---
domain: grid-core
related: [grid-plugins, grid-features, data-flow-traces]
---

# Grid Core — Mental Model

Core = `libs/grid/src/lib/core/`. Shell chrome is a PLUGIN (see grid-plugins-catalog.md § shell-plugin).

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

## render-scheduler (`core/internal/render-scheduler.ts`)

- OWNS: single-RAF orchestration, phase system, `ready()` promise, one-shot initial resolver.
- PHASES (higher includes lower): STYLE(1) → VIRTUALIZATION(2) → HEADER(3) → ROWS(4) → COLUMNS(5) → FULL(6). Execute DESCENDING 6→5→4→3→2→1: `mergeConfig → processRows → processColumns → updateTemplate → renderHeader → refreshVirtualWindow → afterRender`.
- INVARIANT: one RAF pending at a time; requests merge to the HIGHEST phase (never downgrade).
- INVARIANT: `mergeConfig` MUST run before `processRows` (plugins register renderers after adapters set `gridConfig`).
- DECIDED: single-RAF batching over microtask/sync rendering — prevents layout thrash + races between ResizeObserver, framework updates and scroll.
- DECIDED (May 2026): public `'render'` CustomEvent at end of `#flush()`, after `_schedulerAfterRender` and after the ready resolvers. Detail `{ phase, initial, rowCount, visibleRange }`, bubbles + composed. WHY: `ready()` is one-shot; consumers need a post-mutation DOM hook.
  - INVARIANT: NOT dispatched on the disconnected-bail path. Fires on EVERY flush incl. scroll-only renders — gate on `phase >= RenderPhase.ROWS` or use `{ once: true }`.
  - RULED OUT: `beforeRender` (plugin hooks cover it), per-row `row-render` (too noisy).
  - Files: `render-scheduler.ts#dispatchRenderEvent`, `types.ts > RenderDetail`. Tests: `render-scheduler.spec.ts > render event`, `__tests__/integration/render-event.spec.ts`.

## virtualization-manager (`core/internal/virtualization-manager.ts`)

- OWNS: `VirtualState` (shared mutable): enabled, rowHeight, bypassThreshold, start/end, DOM refs, positionCache, heightCache, geometry cache, averageHeight, measuredCount, scrollMapping.
- INVARIANT: `positionCache` is an O(n) array indexed by row index; `null` unless `variableHeights === true`. `heightCache` PERSISTS across position-cache rebuilds (keyed by row identity).
- INVARIANT: `start < end`, clamped to `[0, _rows.length]`. Bypass (render all) when `count ≤ bypassThreshold` (default 24).
- FLOW[scroll]: `getRowIndexAtOffset(scrollTop)` (binary search) → start/end → `renderVisibleRows` from row pool.
- TENSION: position cache rebuilds O(n) on every row-count change (expand/collapse/filter). Unmeasured variable-height rows use `averageHeight` → visible jumps until measured.
- DECIDED (Nov 2026, median row-height sampling): `#measureRowHeight` samples EVERY rendered `.data-grid-row` and uses the MEDIAN. WHY: first-row-only measurement let one outlier (editing chrome, wrapping cell) permanently ratchet `_virtualization.rowHeight` up, shrinking visible-row count for all rows. INVARIANT: rows with inline `style="--tbw-row-height: …"` are EXCLUDED (intentional per-row overrides). File: `grid.ts#measureRowHeight`. Test: `row-height-median-sampling.spec.ts`.
- DECIDED (#326, `MAX_ELEMENT_HEIGHT_PX`): browsers cap element height at ~33.5M px (Chromium 2^25) → faux-vscroll spacer truncates above ~986 895 rows at `rowHeight:34`. Clamp spacer at `33_500_000` + store `ScrollMapping` (`rawContentHeight`, `spacerHeight`, `viewportHeight`, `capped`) on `VirtualState`. Four translation sites: `refreshVirtualWindow` + `grid.ts` scroll listener → `toVirtualScrollTop`; `focus-manager.scrollToRow` + `keyboard.ensureCellVisible` → `fromVirtualScrollTop`. Identity below cap. `tbw-scroll` + plugin `onScroll` keep reporting NATIVE spacer-space coords. Public from `public.ts`: `MAX_ELEMENT_HEIGHT_PX`, `ScrollMapping`, `computeScrollMapping`, `toVirtualScrollTop`, `fromVirtualScrollTop`. RULED OUT: pure fractional mapping below cap (loses pixel granularity). TENSION: above cap, wheel/scrollbar visibly skip rows; keyboard nav unaffected. Files: `virtualization.ts`, `virtualization-manager.ts`, `focus-manager.ts`, `keyboard.ts`, `grid.ts`. Tests: `virtualization.spec.ts > Scroll Mapping Tests`, `scroll-mapping-cap.spec.ts`.
- DECIDED (Jul 2026, `refreshVirtualWindow` shape): dispatch + orchestration only — `#renderUnvirtualized` / `#renderBypassWindow` short-circuit, then `#computeWindowStart` (binary search or `scrollTop/rowHeight`, zebra-parity round-down, plugin `_adjustPluginVirtualStart`) → `#computeWindowEnd` (always +3 overscan) → early-exit → transform/render/measure → `#scheduleSpacerRecalc`. INVARIANT: `#computeWindowStart` MUST read `s.positionCache` AFTER the force-path `initializePositionCache()` — hoisting the read reintroduces the stale-cache bug.

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

## scroll-driven DOM state (cross-cutting plugin INVARIANT)

- INVARIANT: any plugin keeping scroll-derived DOM state (`translateX`, sticky offsets, classes from `scrollLeft`/`scrollTop`) MUST apply it from **three** sites: `onScroll` (scrolling, no afterRender), `afterRender` (re-renders don't replay scroll), `afterCellRender` (virtualization recycles pool elements; per-cell visual state doesn't survive). Symptom of missing one: correct at first paint, gone after sort/filter/scroll.

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

## type interfaces

- `GridHost = InternalGrid & HTMLElement` (`core/types.ts`) — used by internal modules. `PluginGridApi` (`plugin/types.ts`) — used by plugins.
- TENSION: both declare `_pluginManager` with different shapes; adding a plugin-manager property for internal code requires it on `InternalGrid` too.

## internal modules (`core/internal/`)

| Module             | Responsibility                                                   |
| ------------------ | ---------------------------------------------------------------- |
| rows               | row rendering, template cloning, pool management, row mutations  |
| dom-builder        | DOM construction helpers, template fragments, shell builders     |
| event-delegation   | delegated mouse/keyboard handlers at grid level                  |
| columns            | column definitions, merging, template updates                    |
| header             | header row rendering, cell templates                             |
| keyboard           | keyboard navigation, cell focus                                  |
| sorting            | sort state/application, sort UI                                  |
| row-manager        | row CRUD + transactions                                          |
| focus-manager      | focus state, external containers, always-on last-focus trap      |
| row-animation      | insertion/removal animations                                     |
| resize             | column resize, user width tracking                               |
| touch-scroll       | touch/momentum scrolling                                         |
| idle-scheduler     | deferred work                                                    |
| sanitize           | HTML sanitization for user renderers                             |
| style-injector     | CSS injection (core + plugin + custom)                           |
| aria / aria-labels | ARIA attributes + live-region announcements                      |
| aggregators        | sum/avg/min/max/count/first/last                                 |
| value-accessor     | single source of truth for cell value resolution + per-row cache |
| tag-registry       | `GRID_TAG_NAME`, `get/setActiveGridTag` (leaf, breaks cycles)    |
| column-shorthand   | `field="price:number"` parsing (#276)                            |
| inference          | column inference + `overlayInferred` (#384)                      |
| empty / loading    | empty-state + loading overlays                                   |
| virtualization*    | virtual window, position/height caches, scroll mapping           |

> `shell.ts` + `shell-controller.ts` moved OUT of core into `plugins/shell/` (#370).

### sanitize

- INVARIANT: EVERY string returned by a **user renderer** and assigned to `innerHTML` MUST pass through `sanitizeHTML()`. There is NO opt-out config — do not add one. Covered: `rows.ts` (6 sites), `header.ts`, `empty.ts`, `loading.ts`, `dom-builder.ts`, `base-plugin.ts`, `context-menu/menu.ts`, `grouping-columns`, `master-detail.ts`, `shell.ts`. WHY it recurs: a new renderer copies the `HTMLElement` branch and hand-writes the `string` branch. Grep `innerHTML =` before merging any new renderer.

### rows.ts (hot path)

- INVARIANT: the render/patch path is decomposed into named private helpers — do NOT re-inline (cognitive complexity was 100+/70+ before Feb 2026). Patch layer: `syncRowPool` → `reconcileRow` → `patchPlainCells` → `patchCellContent` (a pure dispatcher; each branch writes via `applyRendererOutput` / `applyTemplateOutput` / `applyFormattedValue`, then ONE shared `emitAfterCellRender` at the end — do not re-duplicate the emit per branch) → `applyCellClass`/`applyRowClass`/`applyChangedClass` (all via `clearDynamicClasses`+`applyDynamicClasses`, tracked in `data-dynamic-classes`) → `patchCellFocus` → `resetCustomRow`. Build layer (`renderInlineRow`): `clearRowForRebuild` (adapter `releaseCell` inside `beginBatch`/`endBatch`, #330) → `buildCellElement` → `renderCellContent` (→ `renderViaRenderer` / `mountExternalView` / `renderPlainValue`) → `scrubRenderedCell` → `applyCellTabIndex`.
- DECIDED (Jul 2026): per-cell helpers on the patch path take **flat parameters, never an options object** — `patchCellContent` keeps 8 params on purpose. WHY: it runs once per cell per patch, so a context object allocates per cell. fallow will flag the param count; that is accepted. Its cyclomatic/cognitive is 8/10 after the dispatcher split (was 32/47).
- INVARIANT: `renderCellContent` and `patchCellContent` MUST keep the SAME precedence order (renderer → compiledView → viewTemplate → externalView → format/date/boolean/plain). They are the build and patch halves of one contract; divergence surfaces only as a stale cell after scrolling.
- INVARIANT: `hasMissingExternalView` (attribute lookup, used by `renderVisibleRows`) and `hasMissingExternalViewCell` (positional over `children`, used by `fastPatchRow`) are deliberately TWO functions — do not merge.
- Regression gate: `rows.bench.ts` (`bunx vitest bench --config libs/grid/vite.config.ts --run rows.bench`) — 3 scenarios × plain/rich columns. `render-pipeline.bench.ts` does NOT cover `rows.ts` DOM work. rme ~8–12 %; take a median of 3 runs before calling a delta real.
- DECIDED (#430): `renderVisibleRows` guards the `aria-rowindex` write behind a `RowElementInternal.__ariaRowIndex` cache — pooled rows usually keep their index, so the unconditional write cost ~40 wasted mutations/frame. Safe because only StickyRows otherwise touches it (on detached clones).

### resize.ts / DOM refs

- INVARIANT: `createResizeController(grid).dispose()` MUST fully unwind an in-flight drag — run `onUp()` (remove window listeners, restore `cursor` + `userSelect`) AND `cancelAnimationFrame(pendingRaf)`. `grid.ts` recreates the controller in both `#afterConnect()` and `#afterShellRefresh()`, disposing the previous instance first.
- `#cacheDomRefs()` is the SINGLE place re-resolving hot-path refs (`_headerRowEl`, `_bodyEl`, `__rowsBodyEl`, `_virtualization.viewportEl`/`totalHeightEl`) from `.tbw-grid-content ?? .tbw-grid-root`, returning that root for `#setupScrollListeners()`. Called from `#afterConnect()` + `#afterShellRefresh()` — do not re-inline the querySelector block.

## value-accessor & field paths (`core/internal/value-accessor.ts`)

- DECIDED (#230): `column.valueAccessor({ row, column, rowIndex })` is the single source of truth for cell value resolution — used by sort, filter, render, export, clipboard and built-in aggregators via `resolveCellValue(row, column, rowIndex)`. Precedence: `sortComparator` overrides for sort, `filterValue` for filter; otherwise `valueAccessor` always wins over plain field reads. `resolveCellValue` + `invalidateAccessorCache` exported from `public.ts`.
- DECIDED (#438, nested dotted paths): `column.field` supports `'deal.capture.field'` WITHOUT a `valueAccessor`. Read chokepoint `readCellField(row, field)` in `resolveCellValue`'s no-accessor branch (so sort/filter/render/export/aggregate inherit it free). Writes go through `writeCellField(row, field, value)` at EVERY in-place mutation site: EditingPlugin `#commitCellValue`/sync/history, editor-injection revert, UndoRedo fallback, row-manager `#applyRowChanges`+`applyTransaction`, dirty `rebaselineCell`; `isCellDirty` compares via `readCellField`.
  - RULES (must hold): (1) `valueAccessor` wins — nested read only in the no-accessor branch (preserves the synthetic-key pattern from #230). (2) A literal own key containing a dot wins over traversal (`hasOwnProperty` check). (3) Only dotted fields pay any cost. (4) Prototype-pollution guard `isUnsafeKey` rejects `__proto__`/`constructor`/`prototype` per path segment AND on the plain-key branches of read+write (symmetric). Uses explicit `===` comparisons, NOT `Set.has`, so CodeQL recognises the barrier (PR #439 alert). `setByPath` walks EXISTING objects only — never fabricates intermediates.
  - Types: default `field: ColumnFieldKey<TRow> = (keyof TRow & string) | (string & {})` (dotted strings compile, top-level autocomplete, no deep validation); opt-in strict via a 2nd generic + `NestedPaths<TRow>` (stops at array/Date/RegExp/fn, depth cap 5 avoids TS2589) — `GridConfig<Deal, NestedPaths<Deal>>`.
- DECIDED (#430): `createFieldReader(field): FieldReader` compiles the plain/unsafe/dotted decision ONCE into a monomorphic closure; `isPlainField(field)` exposes the same decision for call sites that must inline. `fieldPathCache` caches **dotted keys only** (`indexOf('.') === -1` short-circuits first) — PivotPlugin mints synthetic field names at runtime, which grew the Map unbounded. TENSION: a closure call still costs ~8 % on two-operation predicates, so `compileNumericPredicate` keeps a literal `row[plainField]` fast path gated on `isPlainField`.
- INVARIANT (cache shape): results memoized per `(row identity, column.field)` in `WeakMap<row, Map<field, CacheBox>>` where `CacheBox = { v: unknown }`. The box is REQUIRED so a cached `undefined` is distinguishable from a miss with ONE `Map.get()` (`has()+get()` doubles probes on the hottest path). Immutable updates auto-invalidate. Primitive rows bypass the cache.
- INVARIANT (invalidation): in-place mutations MUST call **whole-row** `invalidateAccessorCache(row)`, never per-field. WHY: (1) callers invalidate by the MUTATED property key, which need not be any column's `field` (e.g. mutating `dealComment` while a column is `field:'deal.comments'` + accessor); (2) other columns' accessors may derive from the changed field but cache under their own `field`. Whole-row delete is O(1) and robust to both. Per-field is valid ONLY when every affected column's own `field` is invalidated. Wired into `RowManager.updateRow/updateRows/applyTransaction` and EditingPlugin commit. Test: `updaterow-renderer.spec.ts`.

## row-manager (`core/internal/row-manager.ts`)

- INVARIANT: `updateRow`/`updateRows` (`#applyRowChanges`) dispatch a `commitCellValue` query per changed field BEFORE mutating, so programmatic mutations get editing's validation/dirty/history/cascade. Veto is ORDER-INDEPENDENT: `responses.includes(false)` → field skipped; `includes(true)` → a plugin applied+tracked; neither → core applies + `invalidateAccessorCache`. Always emits `cell-change` per changed field; schedules `RenderPhase.VIRTUALIZATION` (NOT ROWS — a ROWS rebuild re-sorts `insertRow`-added rows into ghost duplicates). `updateRow` MUST NOT gate editability. Full contract: grid-plugins.md § inter-plugin-communication.
- INVARIANT (prototype pollution): `#applyRowChanges` skips `__proto__`/`constructor`/`prototype` BEFORE any read/query/write (caller-supplied `changes`). Guard is INLINED — row-manager is core and MUST NOT import the editing plugin's helper (PR #420).
- DECIDED (Jul 2026, transactions): `applyTransaction` is a 5-phase orchestrator — `#txRemove` (async) → `#txUpdate` → `#txAdd` → `#txRender` → `#txAnimate` (async). `#invalidateAndRerender()` is the SINGLE canonical aftermath of a structural row mutation (`invalidateCellCache` + `_rebuildRowIdMap` + `__rowRenderEpoch++` + reset every `_rowPool[i].__epoch = -1` + `refreshVirtualWindow(true)`), shared by `insertRow`/`removeRow`/`#txRender`. `#clearRemoveAnimations()` shared by `removeRow`/`#txAnimate`. Any NEW structural mutation MUST call `#invalidateAndRerender()` — skipping the pool-epoch reset leaves recycled rows rendering stale cells.
- DECIDED (Jul 2026, resolve from full dataset + warn): `updateRow`/`updateRows` resolve IDs via `grid._getSourceRowEntry(id)` (NOT `_getRowEntry`), so a row filtered/paged OUT of `_rows` is still updatable. `_getSourceRowEntry` = visible fast path → else linear scan of `sourceRows`/`#rows` returning `{ row, index: -1 }` (`-1` = "not in the processed view"). An unresolvable ID WARNS (`ROW_NOT_FOUND`) and skips instead of throwing, so `updateRows` finishes the batch. `CommitCellValueContext.row` (resolved object) is threaded so EditingPlugin prefers it over `_rows[ctx.rowIndex]`. Updating a filtered-out row mutates the source but does NOT re-run the filter. Test: `row-update.spec.ts > updateRows updates a row that is filtered out of view`.
- DECIDED (Jul 2026, extensible `UpdateSource`): `UpdateSource = keyof UpdateSourceMap`. Core declares only `'user' | 'cascade' | 'api' | 'history'` (+ `'sync'`); plugins add their own via module augmentation (clipboard adds `'paste'`) so core never hardcodes plugin values. RULED OUT: `'user'|'cascade'|(string & {})` (loses typo-safety and the `history` guarantee the edit pipeline branches on). Public `cell-commit` (`CellCommitDetail`) carries `source`; `'history'` never reaches `#commitCellValue`, so `cell-commit` never fires for undo/redo replays.

## sort hot path (`core/internal/sorting.ts`)

- INVARIANT: `Array.prototype.sort` callbacks MUST be allocation-free and MUST NOT re-extract row values per compare. V8 calls the comparator ~n·log n times (~130k for 10k rows × 2 keys) — any per-pair `valueAccessor` branch, `chain.some(...)` or `localeCompare()` (lazily allocates an `Intl.Collator`) multiplies that cost.
- DECIDED (#430): decorate-sort-undecorate ONLY when the key read is non-trivial. `sortInPlace` keeps the inline `rA[field]` comparator for plain fields; dotted paths and `valueAccessor` columns go through `sortByExtractedKeys` (extract each key once into a parallel array, sort an index array) — N reads instead of ~2·N·log N. Stability preserved (stable sort + tie → ascending index). `__loading` pinning uses a `Uint8Array`. INVARIANT: BOTH comparator bodies stay fully inlined — a shared `compareValues` helper was extracted once and had to be reverted.
- DECIDED (May 2026, MultiSort): `multi-sort.ts` uses a Schwartzian transform — extract keys once per row into a flat `unknown[]`, sort a `Uint32Array` of indices, permute in one pass (~13× fewer extractions at 10k×2). Pre-compute every config-derived flag at setup: pre-bind the per-link getter, pre-scan `__loading` rows once, cache a module-level `Intl.Collator`. RULED OUT: per-link `getValue` closures alone; per-shape comparator variants.
- TENSION: the old 50 ms wall-clock budget in `multi-sort.spec.ts` was a poor early-warning system (single sample, <2× headroom). Now best-of-N. Real perf signal lives in `e2e/tests/performance-regression.spec.ts`.
- DECIDED (#430, scroll): horizontal scroll dispatch to plugins is rAF-coalesced (`#hScrollRaf`), mirroring the vertical path — each dispatch forced layout (`scrollHeight`/`scrollWidth`/`clientHeight`/`clientWidth`); moving reads inside the rAF collapses them to one per frame. The pooled `#pooledScrollEvent` is still mutated in place.

## aggregators (`core/internal/aggregators.ts`)

- INVARIANT: numeric aggregators (`sum`, `avg`, `min`, `max`) SKIP blank cells (`null`/`undefined`/`''`/`NaN`) — matches Excel. `Number('') || 0` would drag `min` down, inflate the `avg` denominator, and let blanks beat all-negative `max`. `avg` divides by the non-blank count (0 if all blank). Pivot value extraction applies the same filter. Callers needing zero-substitution supply a custom aggregator.
- INVARIANT: `AggregatorRef` is declared ONCE here (`string | AggregatorFn`); `core/types.ts` imports and re-exports it. It previously had a second `unknown`-based declaration in `types.ts` — same name, different variance. Do not re-declare. `plugins/pinned-rows/types.ts` keeps its own stricter `AggregatorFn` (`column?: ColumnConfig`) on purpose — separate plugin entry point.
