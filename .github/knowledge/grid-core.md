---
domain: grid-core
related: [grid-render-pipeline, grid-data-pipeline, grid-input, grid-plugins, grid-features, data-flow-traces]
---

# Grid Core — Mental Model

Core = `libs/grid/src/lib/core/`. Lifecycle, config precedence, DOM structure, state ownership — the "what exists and who owns it" file.

- Render scheduler, virtualization, `rows.ts` hot path, sanitize → grid-render-pipeline.md.
- value-accessor, row-manager, sorting, aggregators → grid-data-pipeline.md.
- Pointer modality, drag capture, long-press policy → grid-input.md.
- Shell chrome (header/toolbar/panels) = PLUGIN → grid-plugins-shell.md.

## config-manager (`core/internal/config-manager.ts`)

- OWNS: `originalConfig` (frozen) + `effectiveConfig` (mutable runtime clone); light-DOM column cache; MutationObserver (idle-deferred; framework content arrives late); debounced change listeners (100 ms).
- PRECEDENCE (low→high): `gridConfig` prop → light-DOM elements → `columns` prop → `fitMode` prop → inference from `rows[0]`.
- FLOW: setter → `markSourcesChanged()` → scheduler FULL/COLUMNS phase → `merge()` (only when `sourcesChanged === true` OR no columns yet) → `collectAllSources` → freeze original → clone to effective → `applyPostMergeOperations`.
- INVARIANT: `originalConfig` frozen; column OBJECTS inside stay mutable (runtime `hidden`/`width`/sort live there).
- INVARIANT: `setGridConfig(config)` short-circuits when `config === #gridConfig` — adapters re-assign the same memoized ref, and `merge()` would rebuild `effectiveConfig.columns`, discarding runtime `setColumnVisible()`/`applyColumnState()` mutations. Grid setter's `oldValue !== value` guard stops only `#queueUpdate`. Test: `config-manager.spec.ts > preserve runtime column.hidden mutations`.
- DECIDED (#276): column shorthand in `core/internal/column-shorthand.ts`, exported from `public.ts` (`parseColumnShorthand`, `normalizeColumns`, `hasColumnShorthands`, `applyColumnDefaults`, type `ColumnShorthand`); adapters re-export (React widens `ColumnConfig`).
  - INVARIANT: wired in TWO places — (a) `parseLightDomColumns` splits `field="price:number"` → `field`+`type`+auto-`header`, ONLY for suffixes ∈ `{string,number,boolean,date,datetime,currency}` (other colons literal; explicit non-empty `type`/`header` win); (b) `set columns` runs `normalizeColumns` on array input, so the `columns='["id:number"]'` attr and JS assignment both accept shorthand, and the `oldValue !== normalized` guard compares the STORED ref. Tests: `column-shorthand.spec.ts`, `columns.spec.ts > #276`.
- DECIDED (#384): `columnInference: 'auto' | 'merge'` (default `'auto'`). In `'merge'`, `#collectAllSources` always infers from `rows[0]`, then `overlayInferred(inferred, provided)` overlays by `field`: provided wins per-defined-key, order = data-key order, provided-only columns APPENDED as computed. Mode = `#columnInference (standalone) ?? base.columnInference ?? 'auto'`. `overlayInferred` in `core/internal/inference.ts`, distinct from `mergeColumns` (supplement semantics).
  - INVARIANT: `overlayInferred` MUST skip `undefined` provided values, else a declared column without a header clobbers the inferred one.
  - Standalone source mirrors `fitMode`: `setColumnInference`/`getColumnInference`, `column-inference` attribute, `#applyColumnsUpdate()`. Adapters: React prop / Vue prop+watch / Angular `input()`+effect. Tests: `inference.spec.ts`, `config-precedence.spec.ts`.

## column-groups (`computeColumnGroups` in `core/internal/columns.ts`)

- INVARIANT: groups are **fragmented, not merged** — one entry per contiguous run of same-group columns, each carrying its own pin/sticky/border state.
- INVARIANT: for a merged view call `mergeAdjacentSameIdGroups()` ONCE (pre-computed via `mergeGroups()` per render) — never `findEmbeddedImplicitGroups()` + merge per function (double allocation).
- TENSION: `splitMixedPinImplicitGroup()` splits an implicit group across a pin boundary; pinned fragment gets `sticky`, remnant loses `border-right`.

## grid.ts (main component)

- DECIDED (Aug 2026, module-size budget): `max-lines` (max 1000, `skipBlankLines`+`skipComments`) in `eslint.config.mjs` for `libs/**` + `tools/**`; companion to `tools/vite-bundle-budget.ts`. Counts code lines, not raw (heavy JSDoc: `core/types.ts` = 4.7k raw / 645 code). `max-lines: 'off'` override lists `grid.ts`, `editing-plugin.ts`, `selection-plugin.ts` — **shrink them and delete the entry; never raise the limit or add entries.**
- DECIDED (Aug 2026, extraction cost model): terser mangles `#private` class members, never a name crossing a module boundary → **free function, positional params only** = byte-free; **private method** ≈ 25 B; shared `_`-prefixed seam or public method = permanent bytes. WHY: `plugins/editing` = 54.5 kB vs 55 kB budget (453 B headroom) — splits there are budget-bounded, not effort-bounded. Prefer pure helpers (`computeRowsTranslateY`) over manager objects when shrinking a file.
- DECIDED (Aug 2026, `core/defaults.ts`): three `DEFAULT_*` value constants (`DEFAULT_A11Y_MESSAGES`, `DEFAULT_ANIMATION_CONFIG`, `DEFAULT_GRID_ICONS`) live in `core/defaults.ts`, type-importing `./types` (one-directional, fully erased). `FitModeEnum`/`ColumnInferenceModeEnum` STAY in `types.ts` — `FitMode`/`ColumnInferenceMode` derive via `typeof`, so moving them creates a type-level back-edge. `public.ts` re-exports both groups; public API unchanged.
- DECIDED (Aug 2026, plugin filenames): every file under `libs/grid/src/lib/plugins/**` is kebab-case (`clipboard-plugin.ts`, not `ClipboardPlugin.ts`); class names unchanged.
- DECIDED (Aug 2026): `core/types.ts` MUST stay a single file — never `core/types/` + `index.ts` barrel. WHY: 52 files `declare module '../core/types'` / `'../../core/types'` augment `FeatureConfig`, `BaseColumnConfig`, `ColumnConfig`, `GridConfig`, `TypeDefault`, `ColumnState`, `DataGridEventMap`, `PluginNameMap`, `UpdateSourceMap`; augmenting a re-exporting barrel creates NEW EMPTY interfaces instead of merging, silently breaking every feature/plugin config type. Also trips fallow `circular-dependencies: error`.
- OWNS: lifecycle, static adapter registry, core state (`_rows`, `_columns` (all, incl. hidden), `_visibleColumns` (cached filter), `_sortState`, `_baseColumns`, `_rowIdMap`, `__rowRenderEpoch`), managers, DOM refs, row pool, batched update coalescing (`#pendingUpdate`/`#pendingUpdateFlags`).
- INVARIANT (HARD RULE #370): **core MUST NOT reference any plugin.** All plugin access = `import type` or the PluginManager seam — `getPluginByName`/`getPlugin`, duck-typed (`getPluginByName('shell') as { disposeShellState?(): void }`).
- ENFORCED: `no-restricted-imports` on `libs/grid/src/lib/core/**` blocks `['**/plugins/*','**/plugins/*/**']`, `allowTypeImports: true` (specs/benches exempt).
- CONSEQUENCE: seam hides plugin members from static analysis — `MasterDetailPlugin.refreshDetailRenderer`, `RowDragDropPlugin.emitTransfer`, `ShellPlugin.disposeShellState` are LIVE though reported "unused". **Grep the member name as a string before deleting anything fallow flags.**
- DECIDED (audit 2026-08-07): Nx tag `depConstraints` CANNOT enforce this boundary — tsconfig `paths` for `@toolbox-web/grid[/subpath]` point at `dist/`, so Nx mis-attributes every adapter→core import (same limitation that forced `enforceBuildableLibDependency: false`). Tags `layer:core|adapter|styles` + `type:lib|app|e2e` serve only `nx affected`; boundaries use `no-restricted-imports`. RULED OUT: retrying tag constraints before changing the dist-pointing paths.
- INVARIANT: `#rows` ALWAYS an array — `rows`/`sourceRows` setters coerce nullish/non-array to `[]` (frameworks sync `grid.rows = undefined` when there is no `rows` prop, common with ServerSidePlugin).
- INVARIANT: `_rowIdMap` FULLY LAZY — `#applyRowsUpdate`/`#rebuildRowModel` only set `#rowIdMapDirty`; `#ensureRowIdMap` runs the O(n) loop on first read (`getRow`/`_getRowEntry`/plugin afterRender). Eager cost 129/175 ms at 1M rows; lazy 175→35 ms.
- INVARIANT: every property change goes through `#queueUpdate` → `queueMicrotask` → `#flushPendingUpdates`. `ConfigManager.effective` is THE config source of truth. (Position-cache and sort fast-path rules: grid-render-pipeline.md.)
- INVARIANT: `renderHeader` (`core/internal/header.ts`) ALWAYS appends the resize handle for resizable columns on every path (`headerRenderer`, `headerLabelRenderer`, light-DOM `__headerTemplate`, plain text) — docs MUST say GRID owns it, else Vue/React users duplicate it. Sort icon + filter button differ: full `headerRenderer` opts in via `ctx.renderSortIcon()`/`ctx.renderFilterButton()`; other paths get them automatically.
- INVARIANT: `headerRenderer` and `headerLabelRenderer` mutually exclusive (`headerRenderer` wins); `mergeColumns` MUST only fill from DOM when the programmatic column has NEITHER. Test: `columns.spec.ts > propagates headerRenderer / headerLabelRenderer from DOM`.
- TENSION: `_baseColumns` tracked separately (plugins reorder/transform; needed to restore hidden); `__rowRenderEpoch` forces a full row rebuild on column changes; two sort sources (core vs plugin), core sort re-applied before plugin `processRows`.
- DECIDED (Apr 2026): grid renders into **light DOM** — `#renderRoot` returns `this`, `gridEl.shadowRoot` always null; plugins/internal query the host directly (`gridEl.querySelector('.rows-body')`). No encapsulation: plugin styles prefix `tbw-grid`.
- DECIDED (Jul 2026, import cycles — keep them broken): (1) `FOCUSABLE_EDITOR_SELECTOR` in `core/constants.ts` (re-exported from `rows.ts`) — do NOT move back (rows↔keyboard). (2) `sorting.ts` repaints via `grid._schedulerRenderHeader()`, never a direct `renderHeader` import (header↔sorting). (3) `DataGridElement.tagName`/`activeTag` delegate to `core/internal/tag-registry.ts`; `style-injector.ts` reads the REGISTRY, never `DataGridElement` (grid↔style-injector). Enforced by fallow `circular-dependencies: error`.

### column state

- DECIDED (Apr 2026): `#applyColumnState`'s width-only fast path MUST also check for sort entries in the INCOMING state. WHY: plugins (MultiSort) null `_sortState` after restoring their model, so before/after comparison is blind and `#setup()` is skipped, leaving icons rendered but data unsorted.
- DECIDED (Apr 2026): `applyColumnState()` MUST NOT write `#initialColumnState` when already initialized — branch on `#initialized`. WHY: one-shot slot consumed+cleared by `#setup()`, so writing on every call makes a later `grid.columns = […]` re-apply stale state.
- DECIDED (May 2026): `#applyGridConfigUpdate` MUST consume `#initialColumnState` — after the second `merge()`, clear the slot and call `configManager.applyState(state, plugins)`. WHY: that flow `merge()`s twice, cloning a fresh `effectiveConfig` (discarding runtime `hidden`/`width`/order) and ends at `requestPhase(COLUMNS)`, never `#setup()`, so the slot is never consumed and declared visibility vanishes. Test: `grid-config-column-state-regression.spec.ts`.

### multi-version coexistence (#339 / #382)

- DECIDED (#339): `registerDataGrid()` auto-suffixes tags — no existing `tbw-grid` → bare; same version → reuse bare; different version → `tbw-grid-v{version sanitised to [a-z0-9-]+}`; `DataGridElement.activeTag` reflects the choice. Every instance sets `data-tbw-grid=""` in `connectedCallback` — **that attribute is the stable selector contract**.
- INVARIANT: themes + adapter DOM traversal use `[data-tbw-grid]`, NEVER the bare tag; adapters render `createElement(GridElement.activeTag)` (React) / `<component :is="gridTag">` (Vue); `closest()` uses `'tbw-grid, [data-tbw-grid]'`. `style-injector.ts` scopes `<style id="tbw-grid-styles-{activeTag}">` and rewrites bare selectors via `(?<![-\w])tbw-grid(?![-\w])`. `globalThis.DataGridElement` is FIRST-WINS — multi-version code MUST `import { DataGridElement }` or `customElements.get(activeTag)`.
- DECIDED (#382): `createGrid()` → `document.createElement(DataGridElement.activeTag)`; `queryGrid(..., awaitUpgrade)` → `customElements.whenDefined(activeTag)` (both `public.ts`). Angular `Grid` selector `'tbw-grid'` → `'tbw-grid,[data-tbw-grid]'`; shell-content directives use `closest('[data-tbw-grid]')`. WHY: Angular matches selectors at COMPILE time → a runtime-suffixed tag can't be name-matched; consumers add `data-tbw-grid` literally. Per-feature directives (`tbw-grid[filtering]`) stay tag-bound.
- Tests: `multi-version-registration.spec.ts`, `grid-shell-content.spec.ts`. Docs: `multi-version.mdx`.
- DECIDED (#338/#340 REVERTED): no `globalThis`-anchored cross-bundle shared store for feature registry / React Context / Vue `InjectionKey` / Angular `InjectionToken`. WHY: each bundle owns its framework runtime, so Context identity (`$$typeof`) mismatches → "Invalid hook call" or silent `===` failure. RULED OUT: versioned bucket keys; opt-in shared store (silent failure until prod). `shared-store.ts` and `DataGridElement.shared` are gone.

### focus & a11y

- DECIDED (#324, always-on focus trap): `FocusManager` constructed once; host listeners survive disconnect/reconnect. Capture-phase `focusin` records the last user-focused element; `focusout` with `relatedTarget === null` restores it, `queueMicrotask`-gated to `activeElement === <body>` or the host. `#noteFocus` SKIPS the grid host, a bare `.cell` (cell focus is virtual via `_focusRow`/`_focusCol`), and descendants of registered external containers; editors inside `.cell.editing` ARE tracked. Public: `grid.lastFocusedElement`, `grid.restoreLastFocus()`. Files: `focus-manager.ts`, `keyboard.ts`, `grid.ts`, `plugins/editing/types.ts`. Tests: `focus-management.spec.ts > always-on focus trap`.
  - INVARIANT: `EditingConfig.focusTrap` NOT deprecated — both layers coexist (trap fixes accidental focus theft; opt-in `focusout` handler reclaims on intentional outside nav).
  - RULED OUT: `focusManager.destroy()` — constructor runs once, so reconnect would leave the trap uninstalled. It plus `#trapCleanup`/`AbortController` were DELETED (Aug 2026 audit); the two listeners live on the host and die with it.
- DECIDED (Jul 2026, `keyboard.ts` shape): `handleGridKeyDown` = plugin dispatch → `shouldIgnoreKeyDown` (non-`.rows-body` target, form-field key ownership, `editing && colType==='select'` arrows) → `switch (e.key)` → `navigateTab` / `navigateHorizontal(towardEnd)` / `navigateRowEdge(toEnd)` / `emitCellActivate` → `ensureCellVisible(grid)` (= `scrollFocusedRowIntoView` (ScrollMapping-aware) → `findFocusedCell` → `scrollCellIntoViewHorizontally` (plugin `_getHorizontalScrollOffsets`) → `applyFocusTarget`). RTL = ONE `forward` flip in `navigateHorizontal`, no per-case `isRTL` branches. ESLint `no-fallthrough` fires on comments BETWEEN `case` labels — keep them above the group.
- DECIDED (Apr 2026, aria): `aria-multiselectable` belongs on the `role="grid"` element (`.rows-body`), NOT the host; SelectionPlugin sets it from `multiSelect`, detach removes it. `aria-busy` toggles on the host alongside the `loading` attribute; plugins doing async work set/clear it directly. `dataLoaded` announces only when `sourceRowCount` CHANGES between `_emitDataChange()` calls (`AriaState.lastAnnouncedSourceCount`); initial `0 → 0` suppressed.
- DECIDED (#321, empty-state overlay): `emptyRenderer` mutually exclusive with the loading overlay (`loading=true` wins); recreated on every show. Evaluated in `set loading()` (after `#updateLoadingOverlay()`) and `_schedulerAfterRender()`. `EmptyContext.filteredOut = sourceRowCount > 0 && renderedRowCount === 0`. Mounts `.rows-container` (`emptyOverlay: 'rows'`) or `'grid'` (covers header); `emptyRenderer: null` opts out. Files: `empty.ts`, `empty.css`. Tests: `empty.spec.ts`, `integration/empty-state.spec.ts`.

## public class names (GridClasses ↔ DOM)

- INVARIANT: `GridClasses.DATA_ROW === 'data-grid-row'` and `GridClasses.DATA_CELL === 'cell'` MUST match what `rows.ts` templates (and grouping-rows/pivot row-className writes) apply; derived `GridSelectors.*` follow.
- RULE: renaming/adding row or cell classes in `rows.ts`/`grouping-rows`/`pivot` REQUIRES updating `GridClasses` in the same change (#348).

## dom-structure (light DOM render tree)

```
<tbw-grid>                         (the renderRoot; no shadow root)
└─ .tbw-grid-root [.has-shell]
   ├─ .tbw-shell-header            (ShellPlugin)
   ├─ .tbw-shell-body / .tbw-grid-content
   │  ├─ .tbw-tool-panel           (ShellPlugin)
   │  └─ .tbw-scroll-area
   │     ├─ .rows-body-wrapper
   │     │  └─ .rows-body [role=grid|treegrid]
   │     │     ├─ .header [role=rowgroup] › .header-row › .header-cell ×N
   │     │     └─ .rows-container › .rows-viewport › .rows
   │     │        └─ .data-grid-row [role=row] ×M (pooled) › .cell [role=gridcell] ×N
   │     ├─ .faux-vscroll › .faux-vscroll-spacer [style=height]
   │     └─ .tbw-sr-only           (live region)
```

## state-ownership matrix

Format: `state` → owner; mutators; notes.

- gridConfig / columns / fitMode → ConfigManager; `merge()`, property setters; frozen original + mutable effective
- `#rows` (raw input) → grid.ts; property setter only; always coerced to array
- `_rows` (processed) → grid.ts; `rebuildRowModel`, `processRows` hooks; after plugin transforms
- `_sortState` → grid.ts; sort API, `rebuildRowModel`; field + direction
- `_rowIdMap` → grid.ts; `#ensureRowIdMap` (lazy); rowId → `{row,index}`
- `VirtualState` → VirtualizationManager; `refreshVirtualWindow`, init; shared mutable object
- positionCache / heightCache → VirtualizationManager; `initializePositionCache`/`invalidateRowHeight`; position rebuilt, height persists
- shell (header/toolbar/panels) → ShellPlugin; `registerToolPanel`, light DOM, `processConfig`; core has ZERO shell state (v3)
- plugin instances → PluginManager; `Plugin.attach`; registered in array order
- accessor cache → value-accessor.ts; `resolveCellValue`, `invalidateAccessorCache`; `WeakMap<row, Map<field, box>>`

## type interfaces

- `GridHost = InternalGrid & HTMLElement` (`core/types.ts`) internal; `PluginGridApi` (`plugin/types.ts`) for plugins.
- TENSION: both declare `_pluginManager` differently — new plugin-manager properties must be added to `InternalGrid` too.
