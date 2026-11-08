---
domain: grid-core
related: [grid-render-pipeline, grid-data-pipeline, grid-input, grid-plugins, grid-features, data-flow-traces]
---

# Grid Core — Mental Model

Core = `libs/grid/src/lib/core/`. Lifecycle, config precedence, DOM structure, state ownership — the "what exists and who owns it" file.

- Render scheduler, virtualization, `rows.ts` hot path → grid-render-pipeline.md; sanitizer & `{{ }}` templates → grid-sanitize.md.
- value-accessor, row-manager, sorting, aggregators → grid-data-pipeline.md.
- Pointer modality, drag capture, long-press policy → grid-input.md.
- Shell chrome (header/toolbar/panels) = PLUGIN → grid-plugins-shell.md.

## config-manager (`core/internal/config-manager.ts`)

- OWNS: `originalConfig` (frozen) + `effectiveConfig` (mutable runtime clone); light-DOM column cache; MutationObserver (idle-deferred; framework content arrives late); debounced change listeners (100 ms).
- PRECEDENCE (low→high): `gridConfig` prop → light-DOM elements → `columns` prop → `fitMode` prop → inference from `rows[0]`.
- FLOW: setter → `markSourcesChanged()` → scheduler FULL/COLUMNS phase → `merge()` (only when `sourcesChanged === true` OR no columns yet) → `collectAllSources` → freeze original → clone to effective → `applyPostMergeOperations`.
- INVARIANT: `originalConfig` frozen; column OBJECTS inside stay mutable (runtime `hidden`/`width`/sort live there).
- INVARIANT: `setGridConfig(config)` short-circuits when `config === #gridConfig` — adapters re-assign the same memoized ref, and `merge()` would rebuild `effectiveConfig.columns`, discarding runtime `setColumnVisible()`/`applyColumnState()` mutations. Grid setter's `oldValue !== value` guard stops only `#queueUpdate`. Test: `config-manager.spec.ts > preserve runtime column.hidden mutations`.
- DECIDED (#629/#639): `order` is INITIAL only. `#cloneConfig` stamps `__placedOrder = order` on effective CLONES (never source objects; deleted when `order` is absent); it also stamps `__freshOrder` when a source column lacks the matching placed marker. `applyInitialOrder` skips `__placedOrder === order`; ties keep declaration order. PinnedColumns consumes `__freshOrder` once to distinguish newly declared tie order from runtime feedback. `applyState` always signals plugins for saved ordering, even if it is already current, so saved order supersedes declarative replay. WHY: replaying consumed `order` shuffles pinned/reordered layouts; ignoring fresh tied peers loses declaration order. `columnInference: 'merge'` strips placement markers after rebuilding data-key order, on copies. Test: `pinned-columns-explicit-order.spec.ts`.
- DECIDED (#276): column shorthand in `core/internal/column-shorthand.ts`, exported from `public.ts` (`parseColumnShorthand`, `normalizeColumns`, `hasColumnShorthands`, `applyColumnDefaults`, type `ColumnShorthand`); adapters re-export (React widens `ColumnConfig`).
- INVARIANT: shorthand is normalized in `parseLightDomColumns` and the `columns` setter. Light DOM parses only `string|number|boolean|date|datetime|currency` suffixes; explicit non-empty type/header win, others remain literal. Setter normalizes JS/JSON arrays and compares the stored reference. Tests: `column-shorthand.spec.ts`, `columns.spec.ts`.
- DECIDED (#384): `columnInference` = `'auto'` (default) or `'merge'`. Merge mode infers from `rows[0]`, overlays provided columns by field (provided defined keys win), preserves data-key order, and appends provided-only columns. Mode: standalone property → gridConfig → auto. `overlayInferred` differs from `mergeColumns`.
  - INVARIANT: `overlayInferred` skips `undefined` values; otherwise a missing header clobbers inference.
  - FLOW: `columnInference` has property/attribute setters like `fitMode`; React/Vue/Angular adapters expose it. Tests: `inference.spec.ts`, `config-precedence.spec.ts`.
- DECIDED (3.8.0): `typeDefaults` is **property-agnostic** — free fn `applyTypeDefaults(columns, typeDefaults)` copies EVERY own key of the matching type default onto columns that left it nullish. Core enumerates nothing, so plugin-augmented column props (`editor`, `filterType`, …) work with zero core knowledge (upholds HARD RULE #370). Tests: `config-manager.spec.ts > Type Defaults`.
  - Types: `TypeDefault<TRow> extends Partial<Omit<ColumnConfig<TRow>, NonInheritableTypeDefaultKey>>`; deny-list `field|header|order|group|hidden|utility` mirrored in `core/types.ts` (exported union) AND `NON_INHERITABLE_TYPE_DEFAULT_KEYS` Set in config-manager — keep in sync.
  - INVARIANT: `TypeDefault` MUST stay an `interface` — `plugins/filtering/types.ts` augments `filterPanelRenderer` (no `ColumnConfig` counterpart). `plugins/editing/types.ts` deliberately does NOT augment it; `editor`/`editorParams`/`editable` arrive via the `BaseColumnConfig` augmentation (re-declaring = TS2717).
  - INVARIANT: called from `#collectAllSources` BEFORE the `sortable ??= true` / `resizable ??= true` defaults, else those two can never come from a type default; the light-DOM `<tbw-grid-type>` merge moved above the column block too.
  - INVARIANT: guard is nullish, so explicit falsy column values (`sortable: false`, `width: 0`) win. `renderer`/`viewRenderer` alias: either on the column suppresses both type-level forms.
  - DECIDED (PR #476): the copy uses `Reflect.get/set`, NOT an indexed cast. `applyTypeDefaults<T>(columns: ColumnInternal<T>[], …)` is generic so the call site needs no cast; inside, `column as Record<string, unknown>` is a TS2352 error (interfaces have no implicit index signature) and `as unknown as` is banned (typescript-conventions priority 1). Do not "simplify" this back.
  - Adapters: `Omit<BaseTypeDefault<TRow>, 'renderer'|'editor'|'editorParams'|'filterPanelRenderer'>` + redeclare those 4; rest inherited. Now generic in `TRow` → casts must be `BaseTypeDefault<TRow>['editor']`.

## column-groups (`computeColumnGroups` in `core/internal/columns.ts`)

- INVARIANT: groups are **fragmented, not merged** — one entry per contiguous run of same-group columns, each carrying its own pin/sticky/border state.
- INVARIANT: for a merged view call `mergeAdjacentSameIdGroups()` ONCE (pre-computed via `mergeGroups()` per render) — never `findEmbeddedImplicitGroups()` + merge per function (double allocation).
- TENSION: `splitMixedPinImplicitGroup()` splits an implicit group across a pin boundary; pinned fragment gets `sticky`, remnant loses `border-right`.

## grid.ts (main component)

- DECIDED (Aug 2026, module-size budget): `max-lines` (max 1000, `skipBlankLines`+`skipComments`) in `eslint.config.mjs` for `libs/**` + `tools/**`; companion to `tools/vite-bundle-budget.ts`. Counts code lines, not raw. `max-lines: 'off'` override lists `grid.ts`, `editing-plugin.ts`, `selection-plugin.ts` — **shrink them and delete the entry; never raise the limit or add entries.**
- DECIDED (Aug 2026, extraction cost model): terser mangles `#private` class members, never a name crossing a module boundary → **free function, positional params only** = byte-free; **private method** ≈ 25 B; shared `_`-prefixed seam or public method = permanent bytes. WHY: tight plugin budgets (editing) bound splits, not effort. Prefer pure helpers (`computeRowsTranslateY`) over manager objects when shrinking a file.
- DECIDED (Aug 2026, `core/defaults.ts`): three `DEFAULT_*` value constants (`DEFAULT_A11Y_MESSAGES`, `DEFAULT_ANIMATION_CONFIG`, `DEFAULT_GRID_ICONS`) live in `core/defaults.ts`, type-importing `./types` (one-directional, fully erased). `FitModeEnum`/`ColumnInferenceModeEnum` STAY in `types.ts` — `FitMode`/`ColumnInferenceMode` derive via `typeof`, so moving them creates a type-level back-edge. `public.ts` re-exports both groups; public API unchanged.
- DECIDED (Aug 2026, plugin filenames): every file under `libs/grid/src/lib/plugins/**` is kebab-case (`clipboard-plugin.ts`, not `ClipboardPlugin.ts`); class names unchanged.
- DECIDED (Aug 2026): keep `core/types.ts` a single file; 52 module augmenters target its exact path, while a re-export barrel creates empty interfaces and breaks plugin config typing. Splitting also triggers fallow circular-dependency errors.
- OWNS: lifecycle, static adapter registry, core state (`_rows`, `_columns` (all, incl. hidden), `_visibleColumns` (cached render set, `windowColumns`-narrowed, #603), `_sortState`, `_baseColumns`, `_rowIdMap`, `__rowRenderEpoch`), managers, DOM refs, row pool, batched update coalescing (`#pendingUpdate`/`#pendingUpdateFlags`).
- INVARIANT (HARD RULE #370): **core MUST NOT reference any plugin.** All plugin access = `import type` or the PluginManager seam — `getPluginByName`/`getPlugin`, duck-typed (`getPluginByName('shell') as { disposeShellState?(): void }`).
- ENFORCED: `no-restricted-imports` on `libs/grid/src/lib/core/**` blocks `['**/plugins/*','**/plugins/*/**']`, `allowTypeImports: true` (specs/benches exempt).
- CONSEQUENCE: seam hides plugin members from static analysis — `MasterDetailPlugin.refreshDetailRenderer`, `RowDragDropPlugin.emitTransfer`, `ShellPlugin.disposeShellState` are LIVE though reported "unused". **Grep the member name as a string before deleting anything fallow flags.**
- DECIDED (audit 2026-08-07): Nx `depConstraints` cannot enforce core boundaries while grid path aliases point at `dist/` (adapter→core imports are misattributed). Tags only serve `nx affected`; use `no-restricted-imports`. Revisit only if paths stop targeting `dist/`.
- INVARIANT: `#rows` ALWAYS an array — `rows`/`sourceRows` setters coerce nullish/non-array to `[]` (frameworks sync `grid.rows = undefined` when there is no `rows` prop, common with ServerSidePlugin).
- INVARIANT: `_rowIdMap` builds lazily on first lookup; `_rows` reassignment dirties it, in-place sort/splice does not (#526). `requestVirtualRefresh` marks it dirty for ServerSide placeholder swaps (#525). Tests: `server-side-row-lookup.spec.ts`, `undo-redo-row-identity.spec.ts`.
- INVARIANT (#525): `requestVirtualRefresh()` swaps rows in place and calls `refreshVirtualWindow(false)`. On virtualized paths it skips `afterRender` and `onScrollRender`; when the window changes it must call `pluginManager.onScrollRender()` to restore plugin row state (same contract as `#onScrollBatched`). Test: `integration/server-side-selection.spec.ts`.
- INVARIANT: every property change goes through `#queueUpdate` → `queueMicrotask` → `#flushPendingUpdates`. `ConfigManager.effective` is THE config source of truth. (Position-cache and sort fast-path rules: grid-render-pipeline.md.)
- INVARIANT: `renderHeader` (`core/internal/header.ts`) ALWAYS appends the resize handle for resizable columns on every path (`headerRenderer`, `headerLabelRenderer`, light-DOM `__headerTemplate`, plain text) — docs MUST say GRID owns it, else Vue/React users duplicate it. Sort icon + filter button differ: full `headerRenderer` opts in via `ctx.renderSortIcon()`/`ctx.renderFilterButton()`; other paths get them automatically.
- INVARIANT: `headerRenderer` and `headerLabelRenderer` mutually exclusive (`headerRenderer` wins); `mergeColumns` MUST only fill from DOM when the programmatic column has NEITHER. Test: `columns.spec.ts > propagates headerRenderer / headerLabelRenderer from DOM`.
- DECIDED (#449, SC 2.5.7 overlays): `size-popover.ts` and `drag-alternative-menu.ts` mount inside the host (theme inheritance); `buildBareGridDOMIntoElement` preserves foreign children; `popover="manual"` escapes overflow. Place once per open (no anchor-follow); `[data-tbw-size-open]` marks the anchor. Close on outside `focusout` (`relatedTarget === null` ignored for Firefox/Safari).
- DECIDED (#449): `createSizePopover<T>` is the shared resize alternative for core columns and shell splitter. Its CSS is in `core/styles/base.css` outside `tbw-grid` scope (top-layer); `step="any"` avoids false `aria-invalid`; native spinners are suppressed.
- DECIDED (#449, `a11y.dragAlternatives`): SC 2.5.7 requires a pointer-operable alternative, not visible chrome. Reuse existing handles; column reorder uses `contextmenu` (`Shift+F10`) because header click sorts. `prefersInlineDragAlternative` = mode `'inline'` or `(hover: none)`; never gate on `pointer: coarse` (assistive pointers may be fine + hover).
- INVARIANT (#449, drag-alternative menus): a click on `draggable` is the tap (no `dragstart` without a real drag); `role="button"` makes descendants presentational, so use a childless handle; `dispose()` is permanent (`open()` bails), so rerenders call `close()` and only `detach()` calls `dispose()`.
- DECIDED (#449, non-intrusiveness gate — user-ratified): alternatives never add persistent chrome on hover pointers, preempt browser/app gestures, or fire on the first half of a double-click; no SC 2.5.7 opt-out. Selection suppresses native `contextmenu` only without ContextMenuPlugin (otherwise action order 60); group headers are not exempt because ContextMenu handles neither header selector and already prevents default.
- INVARIANT (#449, resize tap vs. dblclick): the resize handle answers BOTH tap (width popover) and `dblclick` (`resetColumn`, bound in `header.ts`); a double-click's first press is indistinguishable from a tap, so `resize.ts` defers `openWidthPopover` by `DOUBLE_CLICK_WINDOW_MS` (300 ms) and cancels the timer from `start()`, `resetColumn()`, `dispose()`. Any affordance sharing an element with a `dblclick` handler must do the same.
- INVARIANT (header trailing cluster): header is flex; trailing controls align to the end via auto inline-start margin. Always-present controls consume 24px, and `opacity:0` still reserves width, so `'menu'` omits `.tbw-col-move-btn`. Sort target is the label, not cell center. Hover alternatives use `opacity:0; pointer-events:none` (not `display:none`/`visibility:hidden`, which removes them from the a11y tree).
- TENSION: `_baseColumns` tracked separately (plugins reorder/transform; needed to restore hidden); `__rowRenderEpoch` forces a full row rebuild on column changes; two sort sources (core vs plugin), core sort re-applied before plugin `processRows`.
- INVARIANT (#512): move columns in `orderColumns` on the FULL list (hidden included), before visible-only `processColumns`; `_schedulerMergeConfig()` feeds `_columns` back to `#baseColumns`, so a hidden misplacement persists after reveal. `interleaveHiddenColumns` keeps `processColumns` order authoritative; its LIS fallback only resolves third-party reorders (ties are undecidable). It skips hidden fields still present (Visibility seeds `hidden`). Never rebuild `_columns` in source order. Pivot's `orderColumns` is the only non-permutation (stale output #605, hidden pivot fields #609).
- DECIDED (Apr 2026): grid renders into **light DOM** — `#renderRoot` returns `this`, `gridEl.shadowRoot` always null; plugins/internal query the host directly (`gridEl.querySelector('.rows-body')`). No encapsulation: plugin styles prefix `tbw-grid`; nested grids are inside your subtree → dom-structure INVARIANT below.
- DECIDED (Jul 2026, import cycles): keep `FOCUSABLE_EDITOR_SELECTOR` in `core/constants.ts` (rows↔keyboard); `sorting.ts` calls `grid._schedulerRenderHeader()` (header↔sorting); tag access goes through `tag-registry.ts` (grid↔style-injector). Enforced by fallow circular-dependencies.

### column state

- DECIDED (Apr 2026): `#applyColumnState`'s width-only fast path MUST also check for sort entries in the INCOMING state. WHY: plugins (MultiSort) null `_sortState` after restoring their model, so before/after comparison is blind and `#setup()` is skipped, leaving icons rendered but data unsorted.
- DECIDED (Apr 2026): `applyColumnState()` MUST NOT write `#initialColumnState` when already initialized — branch on `#initialized`. WHY: one-shot slot consumed+cleared by `#setup()`, so writing on every call makes a later `grid.columns = […]` re-apply stale state.
- DECIDED (May 2026): `#applyGridConfigUpdate` MUST consume `#initialColumnState` — after the second `merge()`, clear the slot and call `configManager.applyState(state, plugins)`. WHY: that flow `merge()`s twice, cloning a fresh `effectiveConfig` (discarding runtime `hidden`/`width`/order) and ends at `requestPhase(COLUMNS)`, never `#setup()`, so the slot is never consumed and declared visibility vanishes. Test: `grid-config-column-state-regression.spec.ts`.

### multi-version coexistence (#339 / #382)

- DECIDED (#339): `registerDataGrid()` auto-suffixes tags — no existing `tbw-grid` → bare; same version → reuse bare; different version → `tbw-grid-v{version sanitised to [a-z0-9-]+}`; `DataGridElement.activeTag` reflects the choice. Every instance sets `data-tbw-grid=""` in `connectedCallback` — **that attribute is the stable selector contract**.
- INVARIANT: themes/adapters traverse `[data-tbw-grid]`, not the bare tag. React/Vue create `activeTag`; `closest()` accepts both forms. Styles are scoped by activeTag. `globalThis.DataGridElement` is first-wins; multi-version code imports `DataGridElement` or uses `customElements.get(activeTag)`.
- DECIDED (#382): `createGrid()` / `queryGrid(..., awaitUpgrade)` use `DataGridElement.activeTag`. Angular selectors include `[data-tbw-grid]` because selectors compile before runtime tag suffixing; feature directives remain tag-bound. Tests: `multi-version-registration.spec.ts`, `grid-shell-content.spec.ts`; docs: `multi-version.mdx`.
- DECIDED (#338/#340 REVERTED): no `globalThis`-anchored cross-bundle shared store for feature registry / React Context / Vue `InjectionKey` / Angular `InjectionToken`. WHY: each bundle owns its framework runtime, so Context identity (`$$typeof`) mismatches → "Invalid hook call" or silent `===` failure. RULED OUT: versioned bucket keys; opt-in shared store (silent failure until prod).

### focus & a11y

- DECIDED (#324, always-on focus trap): one `FocusManager` keeps host listeners through reconnect. Capture `focusin` records user focus; null-relatedTarget `focusout` restores it in a microtask only when focus reaches body/host. Ignore host, bare cells (virtual focus), and registered external containers; track editors. API: `lastFocusedElement`, `restoreLastFocus()`. Test: `focus-management.spec.ts`.
  - INVARIANT: `EditingConfig.focusTrap` NOT deprecated — both layers coexist (trap fixes accidental focus theft; opt-in `focusout` handler reclaims on intentional outside nav).
  - RULED OUT: `focusManager.destroy()` — constructor runs once, so reconnect would leave the trap uninstalled. It plus `#trapCleanup`/`AbortController` were DELETED (Aug 2026 audit); the two listeners live on the host and die with it.
- DECIDED (Jul 2026, `keyboard.ts`): keydown dispatch → ownership guards → navigation/activation → `ensureCellVisible` (vertical mapping + plugin horizontal offsets) → focus target. RTL flips once in `navigateHorizontal`; keep comments above case groups to satisfy `no-fallthrough`.
  - DECIDED (#493): Ctrl/⌘+↑/↓ = first/last row, column kept. `jumpToRowEdge` (commit row edit → `_focusRow` 0/max) is shared by `navigateVertical` and `navigateRowEdge` (Ctrl+Home/End). No Ctrl+←/→ (= Home/End alias) and no Ctrl+PgUp/PgDn (browser tab switch). Selection needs no change: row mode treats any ↑/↓ as a row nav key; range mode uses `NAV_KEYS`.
  - DECIDED (Sep 2026): PgUp/PgDn = one viewport page (`pageTargetRow`): `viewportEl.clientHeight` minus `_getVerticalScrollOffsets` bands, ÷ `rowHeight` (uniform) or `getRowIndexAtOffset(positionCache, offset±usable)` (variable; a row taller than the page resolves to itself, so force ±1 or focus pins). Unconstrained grid → viewport = all rows → pages to the edge. 20-row fallback ONLY when no layout (happy-dom, pre-mount).
- DECIDED (#633): `_focusCol` is a plain RENDERED index; follow/park/reveal is OWNED by ColumnVirtualization (grid-plugins-catalog-data.md), moved out of core for the gz budget (−243 B). Core keeps: `_focusColumn(column)` (`revealColumn`, assign the destination index, THEN sync `scheduler.flushPending()` — the flush runs afterRender hooks that read focus, e.g. Selection's pending keyboard update); the parked guard (`_focusCol < 0` → core navigation AND Selection nav/span-chord skip); `focusedCell.field` via the `offWindowFocus` query; a `[data-row]` body cell a plugin's `onKeyDown` re-rendered away navigates as the host. Keys from a header CONTROL (`utils.ts#isHeaderControlEvent`, composedPath → crosses open shadow roots) are left to the control by core, Editing Tab and Selection alike. Home/End resolve the full-list edge via `_focusColumn`; Arrow/Tab step the full visible list by column IDENTITY (`keyboard.ts` `stepColumn` + `utils.ts#indexOfColumn`: object, else field after a re-merge clone; a field lookup trapped focus on duplicate fields, PR #644).
- DECIDED (PR #644 review): duplicate `field` values are NOT a supported column configuration — the column model keys by field (`setColumnVisible(field)`, `setColumnOrder(string[])`, column state, pinning, Editing's `editorValueCallbacks` `rowIndex:field`). #633/#640 only keep unwindowed Arrow/Tab parity with main on duplicates (identity step) and refuse an ambiguous `revealColumn`; deeper duplicate handling (editor-cell matching, edit state) is out of scope, not a bug. WHY not full-list: ~60 rendered-index readers. INVARIANT: `-1` must never fall back to a cell. Test: `integration/column-virtualization-selection.spec.ts`.
- DECIDED (#449, SC 2.4.11 Focus Not Obscured): `scrollFocusedRowIntoView` (keyboard.ts) and `FocusManager.scrollToRow` BOTH consult `grid._getVerticalScrollOffsets?.(rowIndex)` and shrink the legal landing band by `top`/`bottom` before computing a target; `skipScroll` bails entirely. Horizontal: `_getHorizontalScrollOffsets`. See `grid-plugins.md → Virtualization hooks` for the 5-file hook chain.
  - Integration suite can't test it (happy-dom `clientHeight: 0` bails before the offset math). Coverage lives in `focus-manager.spec.ts` (co-located, hand-built mock incl. a **non-capped `scrollMapping`** — `fromVirtualScrollTop` dereferences `mapping.capped` and throws on `undefined`) and `keyboard.spec.ts > vertical scroll offsets (#449)`.
- DECIDED (Apr 2026, aria): `aria-multiselectable` belongs on the `role="grid"` element (`.rows-body`), NOT the host; SelectionPlugin sets it from `multiSelect`, detach removes it. `aria-busy` toggles on the host alongside the `loading` attribute; plugins doing async work set/clear it directly. `dataLoaded` announces only when `sourceRowCount` CHANGES between `_emitDataChange()` calls (`AriaState.lastAnnouncedSourceCount`); initial `0 → 0` suppressed.
- DECIDED (#321, empty overlay): loading wins over `emptyRenderer`; recreate on show. Evaluate in `set loading()` and `_schedulerAfterRender()`. `filteredOut` means source rows exist but none render. Mount at rows or grid scope; `null` opts out. Tests: `empty.spec.ts`, `integration/empty-state.spec.ts`.

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

- INVARIANT (#513/#582/#581/#585, nested grids): child grids render inside parent `.rows`; guard queries/events both ways (pitfall #13). Host/`_bodyEl` queries use `:scope > .data-grid-row` and direct cells across virtualization, focus, Selection, RowDragDrop, and PinnedColumns; unscoped keyboard queries shift by child rows. Delegated handlers call `isOwnTarget(host, event)` first using dispatch-time `composedPath()`; element checks walk shadow hosts. Child click events still bubble, so consumers inspect `event.target`. Tests: `integration/nested-grid-focus.spec.ts`, `integration/selection-nested-grid.spec.ts`.

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
